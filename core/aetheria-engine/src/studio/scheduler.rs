//! Studio background scheduler and auto-posting queue daemon.

use super::types::{CancelPostPayload, SchedulePostPayload, ScheduledPost};
use crate::paths::{aetheria_dot_dir, gen_id, now_ms};
use axum::{response::IntoResponse, Json};
use serde_json::json;
use std::sync::{OnceLock, RwLock};

static SCHEDULED_POSTS: OnceLock<RwLock<Vec<ScheduledPost>>> = OnceLock::new();

pub fn get_scheduled_posts_store() -> &'static RwLock<Vec<ScheduledPost>> {
    SCHEDULED_POSTS.get_or_init(|| {
        let file_path = aetheria_dot_dir().join("nexus_scheduled_posts.json");
        if file_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&file_path) {
                if let Ok(loaded) = serde_json::from_str::<Vec<ScheduledPost>>(&content) {
                    return RwLock::new(loaded);
                }
            }
        }
        RwLock::new(Vec::new())
    })
}

pub fn save_scheduled_posts() {
    let posts = get_scheduled_posts_store().read().unwrap_or_else(|e| e.into_inner());
    let file_path = aetheria_dot_dir().join("nexus_scheduled_posts.json");
    if let Ok(json) = serde_json::to_string_pretty(&*posts) {
        let _ = std::fs::write(file_path, json);
    }
}

pub fn start_scheduler_daemon() {
    tokio::spawn(async move {
        println!("[nexus-scheduler] Background Posting Queue Daemon active (30s polling)");
        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;
            let now = now_ms();
            let mut updated = false;
            {
                let mut posts = get_scheduled_posts_store().write().unwrap_or_else(|e| e.into_inner());
                for post in posts.iter_mut() {
                    if post.status == "scheduled" && post.scheduled_time <= now {
                        println!(
                            "[nexus-scheduler] Auto-publishing: [{}] {} to {}",
                            post.id, post.title, post.platform
                        );
                        post.status = "published".to_string();
                        updated = true;
                        crate::session::message::emit_event(
                            "global",
                            "studio.post_published",
                            json!({
                                "id": post.id,
                                "title": post.title,
                                "platform": post.platform,
                                "timestamp": now
                            }),
                        );
                    }
                }
            }
            if updated {
                save_scheduled_posts();
            }
        }
    });
}

pub async fn handle_schedule_post(
    Json(payload): Json<SchedulePostPayload>,
) -> impl IntoResponse {
    let id = gen_id("post");
    let post = ScheduledPost {
        id: id.clone(),
        title: payload.title,
        video_path: payload.video_path,
        caption: payload.caption,
        tags: payload.tags,
        platform: payload.platform,
        scheduled_time: payload.scheduled_time,
        status: "scheduled".to_string(),
        error: None,
        created_at: now_ms(),
    };

    {
        let mut posts = get_scheduled_posts_store().write().unwrap_or_else(|e| e.into_inner());
        posts.push(post.clone());
    }
    save_scheduled_posts();

    Json(json!({
        "success": true,
        "data": post
    }))
}

pub async fn handle_schedule_list() -> impl IntoResponse {
    let posts = get_scheduled_posts_store().read().unwrap_or_else(|e| e.into_inner());
    Json(json!({
        "success": true,
        "data": &*posts
    }))
}

pub async fn handle_schedule_cancel(
    Json(payload): Json<CancelPostPayload>,
) -> impl IntoResponse {
    let mut posts = get_scheduled_posts_store().write().unwrap_or_else(|e| e.into_inner());
    let initial_len = posts.len();
    posts.retain(|p| p.id != payload.id);
    let removed = posts.len() < initial_len;
    if removed {
        drop(posts);
        save_scheduled_posts();
    }
    Json(json!({
        "success": removed,
        "id": payload.id
    }))
}

