mod autostart;
mod notifications;
mod sidecar;
mod tray;

use sidecar::SidecarSupervisor;
use tauri::{Manager, RunEvent};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(notifications::NotificationState::default())
        .manage(SidecarSupervisor::default())
        .invoke_handler(tauri::generate_handler![
            autostart::autostart_status,
            autostart::set_autostart,
            notifications::notification_settings,
            notifications::notify_session_finalized,
            notifications::set_session_notifications,
            sidecar::pause_observation,
            sidecar::restart_sidecars,
            sidecar::sidecar_status,
            sidecar::start_sidecars,
            sidecar::stop_sidecars,
        ])
        .setup(|app| {
            tray::create_tray(app)?;

            let supervisor = app.state::<SidecarSupervisor>();
            if let Err(error) = supervisor.start_dashboard_api(app.handle()) {
                eprintln!("failed to start dashboard API sidecar: {error}");
            }
            if let Err(error) = supervisor.start_observer(app.handle()) {
                eprintln!("failed to start observer sidecar: {error}");
            }
            supervisor.start_monitor(app.handle().clone());
            notifications::start_session_notifier(app.handle().clone());
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("failed to build Kairo desktop")
        .run(|app, event| {
            if let RunEvent::ExitRequested { .. } = event {
                let supervisor = app.state::<SidecarSupervisor>();
                supervisor.stop_all();
            }
        });
}
