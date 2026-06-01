use serde::Serialize;
use std::{
    env,
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    thread,
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager, State};
use thiserror::Error;

#[derive(Default)]
pub struct SidecarSupervisor {
    dashboard_api: Mutex<Option<ManagedProcess>>,
    observer: Mutex<Option<ManagedProcess>>,
    observation_paused: AtomicBool,
    sidecars_stopped: AtomicBool,
}

#[derive(Debug, Error)]
pub enum SidecarError {
    #[error("sidecar lock is poisoned")]
    Lock,
    #[error("failed to spawn {name}: {source}")]
    Spawn {
        name: &'static str,
        #[source]
        source: std::io::Error,
    },
}

impl Serialize for SidecarError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SidecarProcessStatus {
    pub name: &'static str,
    pub running: bool,
    pub pid: Option<u32>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SidecarStatus {
    pub dashboard_api: SidecarProcessStatus,
    pub observer: SidecarProcessStatus,
    pub observation_paused: bool,
}

struct ManagedProcess {
    name: &'static str,
    child: Child,
}

impl Drop for ManagedProcess {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

impl ManagedProcess {
    fn status(&mut self) -> SidecarProcessStatus {
        match self.child.try_wait() {
            Ok(Some(_)) => SidecarProcessStatus {
                name: self.name,
                running: false,
                pid: None,
            },
            Ok(None) => SidecarProcessStatus {
                name: self.name,
                running: true,
                pid: Some(self.child.id()),
            },
            Err(_) => SidecarProcessStatus {
                name: self.name,
                running: false,
                pid: None,
            },
        }
    }
}

impl SidecarSupervisor {
    pub fn start_dashboard_api(&self, app: &AppHandle) -> Result<(), SidecarError> {
        self.start(
            &self.dashboard_api,
            "dashboard-api",
            dashboard_api_command(),
            app,
        )
    }

    pub fn start_observer(&self, app: &AppHandle) -> Result<(), SidecarError> {
        self.start(&self.observer, "observer", observer_command(), app)
    }

    pub fn stop_observer(&self) -> Result<(), SidecarError> {
        let mut process = self.observer.lock().map_err(|_| SidecarError::Lock)?;
        process.take();
        Ok(())
    }

    pub fn stop_all(&self) {
        if let Ok(mut dashboard_api) = self.dashboard_api.lock() {
            dashboard_api.take();
        }
        if let Ok(mut observer) = self.observer.lock() {
            observer.take();
        }
    }

    pub fn status(&self) -> Result<SidecarStatus, SidecarError> {
        let mut dashboard_api = self.dashboard_api.lock().map_err(|_| SidecarError::Lock)?;
        let mut observer = self.observer.lock().map_err(|_| SidecarError::Lock)?;

        let dashboard_api_status = process_status(&mut dashboard_api, "dashboard-api");
        let observer_status = process_status(&mut observer, "observer");
        if !dashboard_api_status.running {
            dashboard_api.take();
        }
        if !observer_status.running {
            observer.take();
        }

        Ok(SidecarStatus {
            observation_paused: self.observation_paused.load(Ordering::SeqCst),
            dashboard_api: dashboard_api_status,
            observer: observer_status,
        })
    }

    pub fn start_monitor(&self, app: AppHandle) {
        thread::spawn(move || loop {
            let supervisor = app.state::<SidecarSupervisor>();
            if let Ok(status) = supervisor.status() {
                if supervisor.sidecars_stopped.load(Ordering::SeqCst) {
                    thread::sleep(Duration::from_secs(5));
                    continue;
                }
                if !status.dashboard_api.running {
                    let _ = supervisor.start_dashboard_api(&app);
                }
                if !status.observation_paused && !status.observer.running {
                    let _ = supervisor.start_observer(&app);
                }
            }
            thread::sleep(Duration::from_secs(5));
        });
    }

    fn start(
        &self,
        slot: &Mutex<Option<ManagedProcess>>,
        name: &'static str,
        spec: CommandSpec,
        app: &AppHandle,
    ) -> Result<(), SidecarError> {
        let mut process = slot.lock().map_err(|_| SidecarError::Lock)?;
        if let Some(existing) = process.as_mut() {
            if existing.status().running {
                return Ok(());
            }
        }

        let mut command = Command::new(spec.program);
        command
            .args(spec.args)
            .current_dir(spec.cwd)
            .env("KAIRO_DESKTOP", "1")
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        let child = command
            .spawn()
            .map_err(|source| SidecarError::Spawn { name, source })?;
        let pid = child.id();
        *process = Some(ManagedProcess { name, child });
        let _ = app.emit(
            "kairo://sidecar-started",
            SidecarProcessStatus {
                name,
                running: true,
                pid: Some(pid),
            },
        );
        Ok(())
    }
}

#[tauri::command]
pub fn sidecar_status(
    supervisor: State<'_, SidecarSupervisor>,
) -> Result<SidecarStatus, SidecarError> {
    supervisor.status()
}

#[tauri::command]
pub fn start_sidecars(
    app: AppHandle,
    supervisor: State<'_, SidecarSupervisor>,
) -> Result<SidecarStatus, SidecarError> {
    supervisor.sidecars_stopped.store(false, Ordering::SeqCst);
    supervisor.start_dashboard_api(&app)?;
    supervisor.observation_paused.store(false, Ordering::SeqCst);
    supervisor.start_observer(&app)?;
    supervisor.status()
}

#[tauri::command]
pub fn restart_sidecars(
    app: AppHandle,
    supervisor: State<'_, SidecarSupervisor>,
) -> Result<SidecarStatus, SidecarError> {
    supervisor.stop_all();
    supervisor.sidecars_stopped.store(false, Ordering::SeqCst);
    supervisor.start_dashboard_api(&app)?;
    supervisor.observation_paused.store(false, Ordering::SeqCst);
    supervisor.start_observer(&app)?;
    supervisor.status()
}

#[tauri::command]
pub fn stop_sidecars(
    supervisor: State<'_, SidecarSupervisor>,
) -> Result<SidecarStatus, SidecarError> {
    supervisor.sidecars_stopped.store(true, Ordering::SeqCst);
    supervisor.observation_paused.store(true, Ordering::SeqCst);
    supervisor.stop_all();
    supervisor.status()
}

#[tauri::command]
pub fn pause_observation(
    paused: bool,
    app: AppHandle,
    supervisor: State<'_, SidecarSupervisor>,
) -> Result<SidecarStatus, SidecarError> {
    if paused {
        supervisor.observation_paused.store(true, Ordering::SeqCst);
        supervisor.stop_observer()?;
    } else {
        supervisor.sidecars_stopped.store(false, Ordering::SeqCst);
        supervisor.observation_paused.store(false, Ordering::SeqCst);
        supervisor.start_observer(&app)?;
    }
    supervisor.status()
}

fn process_status(
    process: &mut Option<ManagedProcess>,
    name: &'static str,
) -> SidecarProcessStatus {
    process.as_mut().map_or(
        SidecarProcessStatus {
            name,
            running: false,
            pid: None,
        },
        ManagedProcess::status,
    )
}

struct CommandSpec {
    program: String,
    args: Vec<String>,
    cwd: PathBuf,
}

fn dashboard_api_command() -> CommandSpec {
    if let Ok(command) = env::var("KAIRO_DESKTOP_API_COMMAND") {
        return shell_command(command);
    }
    pnpm_command(vec![
        "--filter",
        "@kairohq/cli",
        "exec",
        "tsx",
        "src/bin.ts",
        "serve",
        "--no-open",
        "--port",
        "4170",
    ])
}

fn observer_command() -> CommandSpec {
    if let Ok(command) = env::var("KAIRO_DESKTOP_OBSERVER_COMMAND") {
        return shell_command(command);
    }
    pnpm_command(vec![
        "--filter",
        "@kairohq/cli",
        "exec",
        "tsx",
        "src/bin.ts",
        "watch",
    ])
}

fn pnpm_command(args: Vec<&str>) -> CommandSpec {
    let mut full_args = vec!["--dir".to_string(), repo_root().display().to_string()];
    full_args.extend(args.into_iter().map(String::from));
    CommandSpec {
        program: env::var("KAIRO_DESKTOP_PNPM").unwrap_or_else(|_| "pnpm".to_string()),
        args: full_args,
        cwd: repo_root(),
    }
}

fn shell_command(command: String) -> CommandSpec {
    if cfg!(windows) {
        CommandSpec {
            program: "cmd".to_string(),
            args: vec!["/C".to_string(), command],
            cwd: repo_root(),
        }
    } else {
        CommandSpec {
            program: "sh".to_string(),
            args: vec!["-lc".to_string(), command],
            cwd: repo_root(),
        }
    }
}

fn repo_root() -> PathBuf {
    env::var("KAIRO_REPO_ROOT")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../.."))
}
