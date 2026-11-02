mod db;

use db::{DbManager, StockVideoRecord};
use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use tauri::Emitter;

#[derive(Clone, Serialize, Deserialize)]
pub struct RenderProgressPayload {
    pub percent: u32,
    pub message: String,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct RenderResult {
    pub success: bool,
    pub output_path: String,
    pub error: Option<String>,
}

#[tauri::command]
async fn render_tiktok_video(
    app: tauri::AppHandle,
    props_json: String,
    output_path: Option<String>,
) -> Result<RenderResult, String> {
    let output_target = output_path.unwrap_or_else(|| {
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        format!("output/tiktok-{}.mp4", timestamp)
    });

    let mut cmd = Command::new("node");
    cmd.arg("scripts/render.mjs")
        .arg("--props")
        .arg(&props_json)
        .arg("--output")
        .arg(&output_target)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("Gagal menjalankan proses render: {}", e))?;

    if let Some(stdout) = child.stdout.take() {
        let reader = BufReader::new(stdout);
        let app_handle = app.clone();
        std::thread::spawn(move || {
            for line in reader.lines().flatten() {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&line) {
                    if v["type"] == "progress" {
                        let percent = v["percent"].as_u64().unwrap_or(0) as u32;
                        let _ = app_handle.emit(
                            "render-progress",
                            RenderProgressPayload {
                                percent,
                                message: format!("Rendering frame {}%", percent),
                            },
                        );
                    }
                }
            }
        });
    }

    let status = child.wait().map_err(|e| format!("Render process error: {}", e))?;
    if status.success() {
        Ok(RenderResult {
            success: true,
            output_path: output_target,
            error: None,
        })
    } else {
        Err(format!("Render process exited with code {:?}", status.code()))
    }
}

#[tauri::command]
async fn get_stock_videos(app: tauri::AppHandle) -> Result<Vec<StockVideoRecord>, String> {
    let db = DbManager::new(&app);
    db.get_all_stock().map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_stock_video(app: tauri::AppHandle, item: StockVideoRecord) -> Result<(), String> {
    let db = DbManager::new(&app);
    db.insert_stock(&item).map_err(|e| e.to_string())
}

#[tauri::command]
async fn delete_stock_video(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let db = DbManager::new(&app);
    db.delete_stock(&id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_setting(app: tauri::AppHandle, key: String) -> Result<Option<String>, String> {
    let db = DbManager::new(&app);
    db.get_setting(&key).map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_setting(app: tauri::AppHandle, key: String, value: String) -> Result<(), String> {
    let db = DbManager::new(&app);
    db.set_setting(&key, &value).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            // Initialize SQLite tables on startup
            let _ = DbManager::new(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            render_tiktok_video,
            get_stock_videos,
            save_stock_video,
            delete_stock_video,
            get_setting,
            save_setting
        ])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
