//! Per-Session Message Inbox (`Steer` & `Queue`) — mirrors `packages/core/src/session/inbox.ts`.
//! Isolated into its own single-purpose file so editing inbox queueing never affects cancellation or error logic.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

use crate::paths::{gen_id, now_ms};

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
}

static SESSION_INBOX: OnceLock<Mutex<HashMap<String, Vec<InboxItem>>>> = OnceLock::new();

fn inbox_map() -> &'static Mutex<HashMap<String, Vec<InboxItem>>> {
    SESSION_INBOX.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Admits a new item into a session's inbox (`Steer` for mid-turn injection, `Queue` for next turn).
pub fn admit_inbox_item(session_id: &str, text: &str, delivery: InboxDelivery) -> InboxItem {
    let item = InboxItem {
        id: gen_id("inbox"),
        session_id: session_id.to_string(),
        text: text.to_string(),
        delivery,
        created_at: now_ms(),
    };
    let mut guard = inbox_map().lock().unwrap_or_else(|e| e.into_inner());
    guard
        .entry(session_id.to_string())
        .or_default()
        .push(item.clone());
    item
}

/// Drains all pending `Steer` items for `session_id` to inject at the next step boundary.
pub fn drain_pending_steers(session_id: &str) -> Vec<InboxItem> {
    let mut guard = inbox_map().lock().unwrap_or_else(|e| e.into_inner());
    let Some(items) = guard.get_mut(session_id) else {
        return Vec::new();
    };
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
    steers
}

/// Pops the next queued (`Queue` or leftover `Steer`) item after a turn finishes.
pub fn pop_next_queued_input(session_id: &str) -> Option<InboxItem> {
    let mut guard = inbox_map().lock().unwrap_or_else(|e| e.into_inner());
    let items = guard.get_mut(session_id)?;
    if items.is_empty() {
        return None;
    }
    Some(items.remove(0))
}

/// Lists all pending inbox items for a session without removing them.
pub fn list_inbox_items(session_id: &str) -> Vec<InboxItem> {
    let guard = inbox_map().lock().unwrap_or_else(|e| e.into_inner());
    guard.get(session_id).cloned().unwrap_or_default()
}

