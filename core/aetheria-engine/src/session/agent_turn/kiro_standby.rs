/// Per-lane concurrent subagent limit & standby queue across connected providers/models.
/// Cloud APIs & Antigravity allow parallel slots (`DEFAULT_CLOUD_SUBAGENT_CONCURRENCY = 4`)
/// while `local-cli` (Kiro bridge) remains strictly serialized (`1`) to respect strict upstream limits,
/// keeping the main agent responsive in background mode.

use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;
use tokio::sync::{Notify, OwnedSemaphorePermit, Semaphore};

use crate::paths::now_ms;
use crate::session::message::emit_event;

pub(crate) const DEFAULT_CLOUD_SUBAGENT_CONCURRENCY: usize = 4;

static SUBAGENT_LANE_LOCKS: OnceLock<Mutex<HashMap<String, Arc<Semaphore>>>> = OnceLock::new();
static PENDING_SUBAGENTS: OnceLock<Mutex<HashMap<String, usize>>> = OnceLock::new();
static PENDING_NOTIFIERS: OnceLock<Mutex<HashMap<String, Arc<Notify>>>> = OnceLock::new();

pub(crate) fn lane_concurrency_limit(lane: &str) -> usize {
    if lane.trim() == "local-cli" {
        1
    } else {
        DEFAULT_CLOUD_SUBAGENT_CONCURRENCY
    }
}

fn turn_semaphore_for_lane(lane: &str) -> Arc<Semaphore> {
    let locks = SUBAGENT_LANE_LOCKS.get_or_init(|| Mutex::new(HashMap::new()));
    let mut guard = locks.lock().unwrap_or_else(|e| e.into_inner());
    guard
        .entry(lane.to_string())
        .or_insert_with(|| Arc::new(Semaphore::new(lane_concurrency_limit(lane))))
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

/// Acquires a concurrency slot for `lane` (`1` for `local-cli`, `4` for cloud/antigravity lanes).
/// Siblings beyond lane capacity enter standby cleanly without hitting upstream until a slot frees up.
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

    let lane = if _model_id.trim().is_empty() {
        "default"
    } else {
        _model_id.trim()
    };
    let sem = turn_semaphore_for_lane(lane);
    if let Ok(permit) = sem.clone().try_acquire_owned() {
        return Ok(Some(permit));
    }

    crate::paths::log_engine(
        "ai",
        &format!(
            "⏸️ Subagent '{}' ({}) entering STANDBY on lane '{}' (limit {}) — waiting for a free slot",
            subagent_type,
            child_session_id,
            lane,
            lane_concurrency_limit(lane)
        ),
    );
    crate::session::job_registry::set_job_standby(child_session_id, true);
    emit_event(
        workspace_dir,
        "subagent.tool.called",
        serde_json::json!({
            "parentSessionId": parent_session_id,
            "subagentSessionId": child_session_id,
            "subagentType": subagent_type,
            "callID": "subagent_standby",
            "tool": "standby",
            "label": "Standby: waiting for provider slot to free up...",
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
                    Err(_) => {
                        crate::session::job_registry::set_job_standby(child_session_id, false);
                        return Err("Subagent standby queue closed unexpectedly".to_string());
                    }
                }
            }
            _ = tokio::time::sleep(Duration::from_millis(250)) => {
                if let Some(reason) = crate::session::coordinator::is_session_interrupted(parent_session_id)
                    .or_else(|| crate::session::coordinator::is_session_interrupted(child_session_id))
                {
                    crate::session::job_registry::set_job_standby(child_session_id, false);
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

    crate::session::job_registry::set_job_standby(child_session_id, false);
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
    async fn enforces_parallel_cloud_slots_and_serial_local_cli_lane() {
        // Cloud lane allows up to 4 concurrent sibling subagents on the exact same model/provider
        let mut permits = Vec::new();
        for idx in 1..=DEFAULT_CLOUD_SUBAGENT_CONCURRENCY {
            let p = acquire_subagent_turn_standby(
                "p_cloud_1",
                &format!("c_cloud_{idx}"),
                ".",
                "audio-director",
                "kenari::gpt-5.4",
                1,
            )
            .await
            .expect("acquire cloud slot")
            .expect("cloud permit");
            permits.push(p);
        }

        // 5th concurrent subagent on the same cloud lane enters standby until one completes
        assert!(turn_semaphore_for_lane("kenari::gpt-5.4")
            .try_acquire_owned()
            .is_err());

        // Antigravity gets its own 4-slot lane independent from local-cli
        let agy_p1 = acquire_subagent_turn_standby(
            "p_agy_1",
            "c_agy_1",
            ".",
            "explore",
            "antigravity::gemini-2.5-pro",
            1,
        )
        .await
        .expect("acquire antigravity slot 1")
        .expect("antigravity permit 1");
        let agy_p2 = acquire_subagent_turn_standby(
            "p_agy_1",
            "c_agy_2",
            ".",
            "audio-director",
            "antigravity::gemini-2.5-pro",
            1,
        )
        .await
        .expect("acquire antigravity slot 2")
        .expect("antigravity permit 2");

        // Local-CLI (Kiro bridge) remains strictly 1-at-a-time
        let local_p1 = acquire_subagent_turn_standby(
            "p_local_1",
            "c_local_1",
            ".",
            "explore",
            "local-cli",
            1,
        )
        .await
        .expect("acquire local-cli slot")
        .expect("local-cli permit");
        assert!(turn_semaphore_for_lane("local-cli")
            .try_acquire_owned()
            .is_err());

        // Depth 2 nested call bypasses lock so child wait cannot deadlock parent subagent
        let nested = acquire_subagent_turn_standby(
            "c_local_1",
            "gc_lock_2",
            ".",
            "explore",
            "local-cli",
            2,
        )
        .await
        .expect("depth 2 allowed");
        assert!(nested.is_none());

        drop(permits.pop());
        assert!(turn_semaphore_for_lane("kenari::gpt-5.4")
            .try_acquire_owned()
            .is_ok());

        drop(local_p1);
        assert!(turn_semaphore_for_lane("local-cli")
            .try_acquire_owned()
            .is_ok());

        drop(agy_p1);
        drop(agy_p2);
    }
}
