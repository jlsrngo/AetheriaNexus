//! Desktop module — modularized into workspace, fs, sys, and window.

pub mod fs;
pub mod sys;
pub mod window;
pub mod workspace;

use axum::{
    routing::{get, post},
    Router,
};

pub use sys::{handle_check_artcraft_updates, handle_check_updates, locate_web_dist, try_serve_static_asset};
pub use window::{hide_console_window, launch_desktop_window, DesktopAction, DESKTOP_INIT_SCRIPT};
pub use workspace::{check_allowed_path, get_active_workspace_root, set_active_workspace_root};

pub fn router() -> Router {
    Router::new()
        .route("/api/desktop/pick-folder", post(fs::handle_pick_folder))
        .route("/api/desktop/folder-tree", post(fs::handle_folder_tree))
        .route("/api/desktop/read-file", post(fs::handle_read_file))
        .route("/api/desktop/write-file", post(fs::handle_write_file))
        .route("/api/desktop/create-folder", post(fs::handle_create_folder))
        .route("/api/desktop/backup-folder", post(fs::handle_backup_folder))
        .route("/api/desktop/delete-path", post(fs::handle_delete_path))
        .route("/api/desktop/rename-path", post(fs::handle_rename_path))
        .route("/api/desktop/open-path", post(fs::handle_open_path))
        .route("/api/desktop/read-binary", post(fs::handle_read_binary))
        .route("/api/desktop/read-clipboard-image", post(fs::handle_read_clipboard_image))
        .route("/api/desktop/engine-info", get(sys::handle_engine_info))
        .route("/api/video/render", post(sys::handle_video_render))
        .route("/api/desktop/folder-watch", post(workspace::handle_folder_watch))
        .route("/api/desktop/folder-watch/acknowledge", post(workspace::handle_folder_watch_ack))
        .route("/api/desktop/notify", post(sys::handle_desktop_notify))
        .route("/api/desktop/open-url", post(sys::handle_open_url))
        .route("/api/desktop/check-updates", get(sys::handle_check_updates).post(sys::handle_check_updates))
        .route("/api/desktop/check-artcraft-updates", get(sys::handle_check_artcraft_updates).post(sys::handle_check_artcraft_updates))
        .route("/api/desktop/quit", post(sys::handle_quit))
}

