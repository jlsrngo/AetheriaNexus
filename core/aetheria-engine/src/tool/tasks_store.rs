//! Persistence Store, Query Matching & Google Calendar Link Helper for Operational Tasks.

use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

use super::websearch::encode_query;
use crate::session::message::emit_event;

pub(crate) fn tasks_file_path(workspace_dir: &str) -> PathBuf {
    Path::new(workspace_dir).join(".aetheria").join("tasks.json")
}

pub(crate) fn load_tasks(workspace_dir: &str) -> Vec<Value> {
    let path = tasks_file_path(workspace_dir);
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            return serde_json::from_str(&content).unwrap_or_default();
        }
    }
    Vec::new()
}

pub(crate) fn save_tasks_and_notify(
    workspace_dir: &str,
    tasks: &[Value],
    event_payload: Value,
) {
    let path = tasks_file_path(workspace_dir);
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = fs::write(&path, serde_json::to_string_pretty(tasks).unwrap_or_default());
    emit_event(workspace_dir, "tasks.updated", event_payload);
}

pub(crate) fn task_matches_query(task: &Value, query: &str, allow_empty: bool) -> bool {
    if query.is_empty() {
        return allow_empty;
    }
    let title = task
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_lowercase();
    let desc = task
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_lowercase();
    title.contains(query) || desc.contains(query) || query.contains(&title)
}

pub(crate) fn normalize_column(col: &str) -> &str {
    if col == "tomorrow" {
        "upcoming"
    } else {
        col
    }
}

pub(crate) fn build_gcal_url(
    title: &str,
    target_date: &str,
    reminder_time: &str,
    notes: &str,
    priority: &str,
) -> String {
    let gcal_title = format!("[AetheriaNexus] {}", title);
    let gcal_details = format!(
        "Production Notes / Instructions:\n{}\n\nPriority Level: {}\nManaged by AetheriaNexus Remotion Video Studio",
        if notes.is_empty() { "-" } else { notes },
        priority.to_uppercase()
    );
    let date_compact = target_date.replace('-', "");
    let time_compact = reminder_time.replace(':', "");
    format!(
        "https://calendar.google.com/calendar/render?action=TEMPLATE&text={}&dates={}T{}00/{}T{}00&details={}&ctz=Asia/Jakarta",
        encode_query(&gcal_title),
        date_compact,
        time_compact,
        date_compact,
        time_compact,
        encode_query(&gcal_details)
    )
}
