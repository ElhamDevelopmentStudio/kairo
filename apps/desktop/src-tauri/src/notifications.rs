use serde::Serialize;
use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
    sync::atomic::{AtomicBool, Ordering},
    thread,
    time::Duration,
};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_notification::NotificationExt;

#[derive(Default)]
pub struct NotificationState {
    session_notifications_enabled: AtomicBool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationSettings {
    pub session_notifications_enabled: bool,
}

#[tauri::command]
pub fn notification_settings(
    state: State<'_, NotificationState>,
) -> Result<NotificationSettings, String> {
    Ok(NotificationSettings {
        session_notifications_enabled: state.session_notifications_enabled.load(Ordering::SeqCst),
    })
}

#[tauri::command]
pub fn set_session_notifications(
    state: State<'_, NotificationState>,
    enabled: bool,
) -> Result<NotificationSettings, String> {
    state
        .session_notifications_enabled
        .store(enabled, Ordering::SeqCst);
    Ok(NotificationSettings {
        session_notifications_enabled: enabled,
    })
}

#[tauri::command]
pub fn notify_session_finalized(
    app: AppHandle,
    title: String,
    body: Option<String>,
) -> Result<(), String> {
    show_notification(&app, &title, body.as_deref());
    Ok(())
}

pub fn start_session_notifier(app: AppHandle) {
    thread::spawn(move || {
        let sessions_dir = repo_root().join(".kairo").join("sessions");
        let mut seen: HashSet<String> = session_markdown_files(&sessions_dir)
            .into_iter()
            .map(|path| path.display().to_string())
            .collect();
        loop {
            for path in session_markdown_files(&sessions_dir) {
                let state = app.state::<NotificationState>();
                if !state.session_notifications_enabled.load(Ordering::SeqCst) {
                    continue;
                }
                let key = path.display().to_string();
                if !seen.insert(key) {
                    continue;
                }
                if let Some(title) = session_title(&path) {
                    show_notification(&app, "Kairo session finalized", Some(&title));
                }
            }
            thread::sleep(Duration::from_secs(15));
        }
    });
}

fn show_notification(app: &AppHandle, title: &str, body: Option<&str>) {
    let builder = app.notification().builder().title(title);
    let builder = match body {
        Some(body) => builder.body(body),
        None => builder,
    };
    let _ = builder.show();
}

fn session_markdown_files(dir: &Path) -> Vec<PathBuf> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.extension().and_then(|value| value.to_str()) == Some("md"))
        .collect()
}

fn session_title(path: &Path) -> Option<String> {
    fs::read_to_string(path).ok()?.lines().find_map(|line| {
        line.strip_prefix("# ")
            .map(str::trim)
            .filter(|title| !title.is_empty())
            .map(ToOwned::to_owned)
    })
}

fn repo_root() -> PathBuf {
    std::env::var("KAIRO_REPO_ROOT")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../.."))
}
