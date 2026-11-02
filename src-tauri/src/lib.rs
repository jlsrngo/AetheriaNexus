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
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![render_tiktok_video])
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
