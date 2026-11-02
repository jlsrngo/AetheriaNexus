use crate::db::DbManager;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::Emitter;

#[derive(Clone, Serialize, Deserialize)]
pub struct SchedulerEventPayload {
    pub message: String,
    pub video_id: String,
    pub title: String,
}

pub struct DispatchScheduler {
    running: Arc<AtomicBool>,
}

impl DispatchScheduler {
    pub fn new() -> Self {
        Self {
            running: Arc::new(AtomicBool::new(true)),
        }
    }

    pub fn start(&self, app_handle: tauri::AppHandle) {
        let running = self.running.clone();

        std::thread::spawn(move || {
            while running.load(Ordering::Relaxed) {
                // Sleep 30 seconds between queue polls (extremely light CPU usage)
                std::thread::sleep(Duration::from_secs(30));

                let db = DbManager::new(&app_handle);
                if let Ok(videos) = db.get_all_stock() {
                    for v in videos {
                        if v.status == "scheduled" {
                            // Automatically promote scheduled video to published in SQLite
                            let updated = crate::db::StockVideoRecord {
                                status: "published".to_string(),
                                ..v.clone()
                            };
                            let _ = db.insert_stock(&updated);

                            let _ = app_handle.emit(
                                "tiktok-scheduled-dispatch",
                                SchedulerEventPayload {
                                    message: format!("Video '{}' otomatis terbit sesuai jadwal!", v.title),
                                    video_id: v.id,
                                    title: v.title,
                                },
                            );
                            break;
                        }
                    }
                }
            }
        });
    }
}

