//! Desktop metadata and native window control Tauri commands.

/// Provides system metadata and desktop environment status.
#[tauri::command]
pub fn desktop_info() -> serde_json::Value {
    serde_json::json!({
        "runtime": "tauri-v2",
        "engine": "Axum v0.7 + Tokio v1.40",
        "desktop": "Tauri v2 + Microsoft Edge WebView2",
        "docs": "Native Win32 COM Sidecar",
        "os": "Windows_NT x64"
    })
}

/// Native window minimize control for custom frameless titlebar.
#[tauri::command]
pub fn window_minimize(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

/// Native window maximize/restore toggle control.
#[tauri::command]
pub fn window_toggle_maximize(window: tauri::Window) -> Result<(), String> {
    let is_max = window.is_maximized().map_err(|e| e.to_string())?;
    if is_max {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

/// Native window close control.
#[tauri::command]
pub fn window_close(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

