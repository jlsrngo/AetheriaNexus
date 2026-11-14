//! Per-Session Message Inbox (`Steer` & `Queue`) — mirrors `packages/core/src/session/inbox.ts`.
//! Isolated into its own single-purpose file so editing inbox queueing never affects cancellation or error logic.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};

use crate::paths::{aetheria_data_dir, gen_id, now_ms};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum InboxDelivery {
    Steer,
    Queue,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InboxItem {
    pub id: String,
    pub session_id: String,
    pub text: String,
    pub delivery: InboxDelivery,
    pub created_at: u64,
    #[serde(default)]
    pub enqueued_seq: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub files: Option<Vec<Value>>,
}

static SESSION_INBOX: OnceLock<Mutex<HashMap<String, Vec<InboxItem>>>> = OnceLock::new();
static NEXT_ENQUEUED_SEQ: AtomicU64 = AtomicU64::new(1);

fn inbox_map() -> &'static Mutex<HashMap<String, Vec<InboxItem>>> {
    SESSION_INBOX.get_or_init(|| Mutex::new(HashMap::new()))
}

fn sanitize_session_filename(session_id: &str) -> String {
    session_id
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

fn inbox_dir() -> PathBuf {
    aetheria_data_dir().join("inbox")
}

fn inbox_file_path(session_id: &str) -> PathBuf {
    inbox_dir().join(format!("{}.json", sanitize_session_filename(session_id)))
}

fn bump_seq_above(items: &[InboxItem]) {
    let max_seq = items.iter().map(|it| it.enqueued_seq).max().unwrap_or(0);
    if max_seq > 0 {
        let mut cur = NEXT_ENQUEUED_SEQ.load(Ordering::Relaxed);
        while cur <= max_seq {
            match NEXT_ENQUEUED_SEQ.compare_exchange_weak(
                cur,
                max_seq + 1,
                Ordering::Relaxed,
                Ordering::Relaxed,
            ) {
                Ok(_) => break,
                Err(actual) => cur = actual,
            }
        }
    }
}

fn load_inbox_from_disk(session_id: &str) -> Vec<InboxItem> {
    let path = inbox_file_path(session_id);
    let Ok(raw) = std::fs::read_to_string(&path) else {
        return Vec::new();
    };
    let mut items: Vec<InboxItem> = serde_json::from_str(&raw).unwrap_or_default();
    items.sort_by_key(|it| (it.enqueued_seq, it.created_at));
    bump_seq_above(&items);
    items
}

fn persist_inbox_to_disk(session_id: &str, items: &[InboxItem]) {
    let dir = inbox_dir();
    let path = inbox_file_path(session_id);
    if items.is_empty() {
        let _ = std::fs::remove_file(&path);
        return;
    }
    let _ = std::fs::create_dir_all(&dir);
    if let Ok(json_str) = serde_json::to_string_pretty(items) {
        let tmp = dir.join(format!("{}.tmp", sanitize_session_filename(session_id)));
        if std::fs::write(&tmp, &json_str).is_ok() {
            let _ = std::fs::rename(&tmp, &path);
        }
    }
}

fn ensure_session_loaded<'a>(
    guard: &'a mut HashMap<String, Vec<InboxItem>>,
    session_id: &str,
) -> &'a mut Vec<InboxItem> {
    if !guard.contains_key(session_id) {
        let loaded = load_inbox_from_disk(session_id);
        guard.insert(session_id.to_string(), loaded);
    }
    guard
        .entry(session_id.to_string())
        .or_default()
}

/// Admits a new item into a session's inbox (`Steer` for mid-turn injection, `Queue` for next turn).
pub fn admit_inbox_item(session_id: &str, text: &str, delivery: InboxDelivery) -> InboxItem {
    admit_inbox_item_with_files(session_id, text, delivery, None)
}

/// Admits a new item with optional file/image attachments into a session's inbox.
pub fn admit_inbox_item_with_files(
    session_id: &str,
    text: &str,
    delivery: InboxDelivery,
    files: Option<Vec<Value>>,
) -> InboxItem {
    let seq = NEXT_ENQUEUED_SEQ.fetch_add(1, Ordering::Relaxed);
    let normalized_files = files.filter(|f| !f.is_empty());
    let item = InboxItem {
        id: gen_id("inbox"),
        session_id: session_id.to_string(),
        text: text.to_string(),
        delivery,
        created_at: now_ms(),
        enqueued_seq: seq,
        files: normalized_files,
    };
    let mut guard = inbox_map().lock().unwrap_or_else(|e| e.into_inner());
    let items = ensure_session_loaded(&mut guard, session_id);
    items.push(item.clone());
    items.sort_by_key(|it| (it.enqueued_seq, it.created_at));
    persist_inbox_to_disk(session_id, items);
    item
}

/// Drains all pending `Steer` items for `session_id` to inject at the next step boundary.
pub fn drain_pending_steers(session_id: &str) -> Vec<InboxItem> {
    let mut guard = inbox_map().lock().unwrap_or_else(|e| e.into_inner());
    let items = ensure_session_loaded(&mut guard, session_id);
    if items.is_empty() {
        return Vec::new();
    }
    let mut steers = Vec::new();
    let mut remaining = Vec::with_capacity(items.len());
    for item in items.drain(..) {
        if item.delivery == InboxDelivery::Steer {
            steers.push(item);
        } else {
            remaining.push(item);
        }
    }
    *items = remaining;
    persist_inbox_to_disk(session_id, items);
    steers
}

/// Pops the next queued (`Queue` or leftover `Steer`) item after a turn finishes.
pub fn pop_next_queued_input(session_id: &str) -> Option<InboxItem> {
    let mut guard = inbox_map().lock().unwrap_or_else(|e| e.into_inner());
    let items = ensure_session_loaded(&mut guard, session_id);
    if items.is_empty() {
        return None;
    }
    let next = items.remove(0);
    persist_inbox_to_disk(session_id, items);
    Some(next)
}

/// Lists all pending inbox items for a session without removing them.
pub fn list_inbox_items(session_id: &str) -> Vec<InboxItem> {
    let mut guard = inbox_map().lock().unwrap_or_else(|e| e.into_inner());
    ensure_session_loaded(&mut guard, session_id).clone()
}

/// Scans persisted inbox files at engine startup and returns session IDs with pending items.
pub fn recover_pending_inboxes_on_startup() -> Vec<String> {
    let dir = inbox_dir();
    let Ok(entries) = std::fs::read_dir(&dir) else {
        return Vec::new();
    };
    let mut guard = inbox_map().lock().unwrap_or_else(|e| e.into_inner());
    let mut pending_sessions = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let Ok(raw) = std::fs::read_to_string(&path) else {
            continue;
        };
        let mut items: Vec<InboxItem> = match serde_json::from_str(&raw) {
            Ok(v) => v,
            Err(_) => continue,
        };
        if items.is_empty() {
            let _ = std::fs::remove_file(&path);
            continue;
        }
        items.sort_by_key(|it| (it.enqueued_seq, it.created_at));
        bump_seq_above(&items);
        let sid = items[0].session_id.clone();
        guard.insert(sid.clone(), items);
        if !pending_sessions.contains(&sid) {
            pending_sessions.push(sid);
        }
    }
    pending_sessions.sort();
    pending_sessions
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn admit_assigns_strictly_increasing_enqueued_seq() {
        let sid = format!("test_inbox_seq_{}", now_ms());
        let a = admit_inbox_item(&sid, "satu", InboxDelivery::Queue);
        let b = admit_inbox_item(&sid, "dua", InboxDelivery::Queue);
        let c = admit_inbox_item(&sid, "tiga", InboxDelivery::Queue);
        assert!(a.enqueued_seq < b.enqueued_seq);
        assert!(b.enqueued_seq < c.enqueued_seq);
        assert_eq!(
            list_inbox_items(&sid)
                .into_iter()
                .map(|x| x.text)
                .collect::<Vec<_>>(),
            vec!["satu", "dua", "tiga"]
        );
        while pop_next_queued_input(&sid).is_some() {}
    }
}

