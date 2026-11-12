/// Global single-active-subagent lock & standby queue across ALL connected providers/models.
/// Prevents parallel subagents from bursting rate limits while keeping the main agent free
/// to answer user questions whenever idle in background mode.

use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;
use tokio::sync::{Notify, OwnedSemaphorePermit, Semaphore};

use crate::paths::now_ms;
use crate::session::message::emit_event;

static SUBAGENT_TURN_LOCK: OnceLock<Arc<Semaphore>> = OnceLock::new();
static PENDING_SUBAGENTS: OnceLock<Mutex<HashMap<String, usize>>> = OnceLock::new();
static PENDING_NOTIFIERS: OnceLock<Mutex<HashMap<String, Arc<Notify>>>> = OnceLock::new();

fn turn_semaphore() -> Arc<Semaphore> {
    SUBAGENT_TURN_LOCK
        .get_or_init(|| Arc::new(Semaphore::new(1)))
        .clone()
}

fn pending_map() -> &'static Mutex<HashMap<String, usize>> {
    PENDING_SUBAGENTS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn notify_map() -> &'static Mutex<HashMap<String, Arc<Notify>>> {
    PENDING_NOTIFIERS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn session_notify(parent_session_id: &str) -> Arc<Notify> {
    let mut map = notify_map().lock().unwrap_or_else(|e| e.into_inner());
    map.entry(parent_session_id.to_string())
        .or_insert_with(|| Arc::new(Notify::new()))
        .clone()
}

/// RAII tracker counting spawned subagents for a parent session so background completion
/// only wakes an idle parent once queued sibling subagents settle cleanly.
pub struct SubagentPendingGuard {
    parent_session_id: String,
    active: bool,
}

impl SubagentPendingGuard {
    /// Explicitly decrements the pending counter early and returns remaining subagents.
    pub fn release_now(mut self) -> usize {
        self.decrement()
    }

    fn decrement(&mut self) -> usize {
        if !self.active {
            return pending_subagent_count(&self.parent_session_id);
        }
        self.active = false;
        let remaining = {
            let mut map = pending_map().lock().unwrap_or_else(|e| e.into_inner());
            let next = map
                .get(&self.parent_session_id)
                .copied()
                .unwrap_or(0)
                .saturating_sub(1);
            if next == 0 {
                map.remove(&self.parent_session_id);
            } else {
                map.insert(self.parent_session_id.clone(), next);
            }
            next
        };
        if remaining == 0 {
            session_notify(&self.parent_session_id).notify_waiters();
        }
        remaining
    }
}

impl Drop for SubagentPendingGuard {
    fn drop(&mut self) {
        self.decrement();
    }
}

/// Registers any subagent as pending/active for `parent_session_id` regardless of connected model/provider.
pub fn register_subagent_pending(parent_session_id: &str) -> SubagentPendingGuard {
    let mut map = pending_map().lock().unwrap_or_else(|e| e.into_inner());
    let count = map.entry(parent_session_id.to_string()).or_insert(0);
    *count += 1;
    SubagentPendingGuard {
        parent_session_id: parent_session_id.to_string(),
        active: true,
    }
}

/// Returns how many subagents are currently running or queued in standby for `parent_session_id`.
pub fn pending_subagent_count(parent_session_id: &str) -> usize {
    let map = pending_map().lock().unwrap_or_else(|e| e.into_inner());
    map.get(parent_session_id).copied().unwrap_or(0)
}

/// Acquires the single-subagent execution lock across all connected models/providers.
/// Any additional sibling subagent enters standby with zero upstream requests sent until
/// the currently active subagent completes.
pub async fn acquire_subagent_turn_standby(
    parent_session_id: &str,
    child_session_id: &str,
    workspace_dir: &str,
    subagent_type: &str,
    _model_id: &str,
    child_depth: usize,
) -> Result<Option<OwnedSemaphorePermit>, String> {
    // Only top-level subagents (depth == 1) hold the queue lock so nested depth == 2 calls can never self-deadlock.
    if child_depth > 1 {
        return Ok(None);
    }

    let sem = turn_semaphore();
    if let Ok(permit) = sem.clone().try_acquire_owned() {
        return Ok(Some(permit));
    }

    crate::paths::log_engine(
        "ai",
        &format!(
            "⏸️ Subagent '{}' ({}) entering STANDBY — waiting for active subagent to finish before sending requests",
            subagent_type, child_session_id
        ),
    );
    emit_event(
        workspace_dir,
        "subagent.tool.called",
        serde_json::json!({
            "parentSessionId": parent_session_id,
            "subagentSessionId": child_session_id,
            "subagentType": subagent_type,
            "callID": "subagent_standby",
            "tool": "standby",
            "label": "Standby: waiting for active subagent to finish...",
            "step": 0,
            "timestamp": now_ms()
        }),
    );

    let acquire_fut = sem.acquire_owned();
    tokio::pin!(acquire_fut);

    let permit = loop {
        tokio::select! {
            res = &mut acquire_fut => {
                match res {
                    Ok(p) => break p,
                    Err(_) => return Err("Subagent standby queue closed unexpectedly".to_string()),
                }
            }
            _ = tokio::time::sleep(Duration::from_millis(250)) => {
                if let Some(reason) = crate::session::coordinator::is_session_interrupted(parent_session_id)
                    .or_else(|| crate::session::coordinator::is_session_interrupted(child_session_id))
                {
                    emit_event(
                        workspace_dir,
                        "subagent.tool.completed",
                        serde_json::json!({
                            "parentSessionId": parent_session_id,
                            "subagentSessionId": child_session_id,
                            "subagentType": subagent_type,
                            "callID": "subagent_standby",
                            "tool": "standby",
                            "label": "Standby interrupted",
                            "ok": false,
                            "step": 0,
                            "timestamp": now_ms()
                        }),
                    );
                    return Err(format!("Subagent interrupted while in standby ({})", reason));
                }
            }
        }
    };

    emit_event(
        workspace_dir,
        "subagent.tool.completed",
        serde_json::json!({
            "parentSessionId": parent_session_id,
            "subagentSessionId": child_session_id,
            "subagentType": subagent_type,
            "callID": "subagent_standby",
            "tool": "standby",
            "label": "Resumed from standby",
            "ok": true,
            "step": 0,
            "timestamp": now_ms()
        }),
    );

    Ok(Some(permit))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tracks_pending_counts_for_all_connected_models() {
        let pid = "sess_standby_pending_test";
        assert_eq!(pending_subagent_count(pid), 0);

        let g1 = register_subagent_pending(pid);
        let g2 = register_subagent_pending(pid);
        assert_eq!(pending_subagent_count(pid), 2);

        assert_eq!(g1.release_now(), 1);
        assert_eq!(pending_subagent_count(pid), 1);

        drop(g2);
        assert_eq!(pending_subagent_count(pid), 0);
    }

    #[tokio::test]
    async fn serializes_concurrent_subagents_via_standby_lock_for_any_model() {
        let p1 = acquire_subagent_turn_standby(
            "p_lock_1",
            "c_lock_1",
            ".",
            "audio-director",
            "gpt-5.4",
            1,
        )
        .await
        .expect("acquire first")
        .expect("permit 1");

        // Second subagent cannot acquire immediately while first is still working, regardless of model
        assert!(turn_semaphore().try_acquire_owned().is_err());

        // Depth 2 nested call bypasses lock so child wait cannot deadlock parent subagent
        let nested = acquire_subagent_turn_standby(
            "c_lock_1",
            "gc_lock_2",
            ".",
            "explore",
            "opencode/big-pickle",
            2,
        )
        .await
        .expect("depth 2 allowed");
        assert!(nested.is_none());

        drop(p1);
        assert!(turn_semaphore().try_acquire_owned().is_ok());
    }
}
