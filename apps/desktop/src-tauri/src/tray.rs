use crate::sidecar::SidecarSupervisor;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, Manager,
};

pub fn create_tray(app: &mut App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open Dashboard", true, None::<&str>)?;
    let pause = MenuItem::with_id(app, "pause", "Pause Observation", true, None::<&str>)?;
    let resume = MenuItem::with_id(app, "resume", "Resume Observation", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Kairo", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &pause, &resume, &quit])?;

    TrayIconBuilder::with_id("main")
        .tooltip("Kairo")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main_window(app),
            "pause" => {
                let supervisor = app.state::<SidecarSupervisor>();
                let _ = supervisor.stop_observer();
            }
            "resume" => {
                let supervisor = app.state::<SidecarSupervisor>();
                let _ = supervisor.start_observer(app);
            }
            "quit" => {
                let supervisor = app.state::<SidecarSupervisor>();
                supervisor.stop_all();
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}
