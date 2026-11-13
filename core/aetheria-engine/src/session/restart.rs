//! Startup Crash Recovery & Orphaned Job Reconciliation — mirrors `packages/core/src/session/restart.ts`.
//! Isolated into its own file so server boot recovery logic is completely separated from job CRUD.

use serde_json::json;

use super::job_registry::{with_job_store, JobStatus};
use crate::paths::now_ms;
use crate::session::session::{save_store, with_store};

pub const DEFAULT_MAX_RESUME_ATTEMPTS: u32 = 10;

pub const CONTINUE_AFTER_SERVER_RESTART: &str =
    "The previous turn was interrupted because the application restarted. Continue from where you left off.";

pub const RESUME_EXHAUSTED_MESSAGE: &str =
    "Automatic recovery was stopped after repeated server restarts while this session was running.";

/// Reconciles any jobs that were left in `running` state when the engine last exited or crashed.
pub fn recover_orphaned_jobs_on_startup() -> usize {
    let now = now_ms();
    let mut recovered_count = 0usize;
    let mut exhausted_sessions: Vec<String> = Vec::new();

    with_job_store(|store| {
        for job in store.jobs.values_mut() {
            if job.status == JobStatus::Running {
                job.resume_attempts += 1;
                job.updated_at = now;
                job.settled_at = Some(now);
                recovered_count += 1;

                if job.resume_attempts > DEFAULT_MAX_RESUME_ATTEMPTS {
                    job.status = JobStatus::Error;
                    job.error = Some(RESUME_EXHAUSTED_MESSAGE.to_string());
                    exhausted_sessions.push(job.session_id.clone());
                } else {
                    job.status = JobStatus::Error;
                    job.error = Some(
                        "Interrupted by engine restart; settled cleanly on boot.".to_string(),
                    );
                }
            }
        }
    });

    if !exhausted_sessions.is_empty() {
        with_store(|s_store| {
            for sid in &exhausted_sessions {
                if let Some(msgs) = s_store.messages.get_mut(sid) {
                    msgs.push(json!({
                        "role": "assistant",
                        "content": RESUME_EXHAUSTED_MESSAGE
                    }));
                }
            }
            save_store(s_store);
        });
    }

    if recovered_count > 0 {
        crate::paths::log_engine(
            "session",
            &format!(
                "🔄 Startup crash recovery settled {} orphaned running job(s)",
                recovered_count
            ),
        );
    }

    recovered_count
}

#[derive(Debug, Clone)]
pub struct PendingCompactionRecovery {
    pub session_id: String,
    pub workspace_dir: String,
    pub reason: String,
    pub messages: Vec<serde_json::Value>,
}

/// Extracts and clears any interrupted mid-flight compaction checkpoints from `SESSION_STORE`
/// so `lib.rs` can emit `compaction.interrupted` and resume cleanly after engine restart (`K54`).
pub fn take_pending_compactions_on_startup() -> Vec<PendingCompactionRecovery> {
    let mut recovered = Vec::new();
    with_store(|store| {
        let mut modified = false;
        let session_ids: Vec<String> = store.sessions.keys().cloned().collect();
        for sid in session_ids {
            if let Some(sess) = store.sessions.get_mut(&sid) {
                if let Some(pending) = sess.as_object_mut().and_then(|o| o.remove("pendingCompaction")) {
                    if let Some(obj) = sess.as_object_mut() {
                        obj.remove("activeTurn");
                    }
                    modified = true;
                    let workspace_dir = pending
                        .get("workspaceDir")
                        .and_then(|v| v.as_str())
                        .or_else(|| sess.pointer("/location/directory").and_then(|v| v.as_str()))
                        .or_else(|| sess.get("directory").and_then(|v| v.as_str()))
                        .unwrap_or("")
                        .to_string();
                    let reason = pending
                        .get("reason")
                        .and_then(|v| v.as_str())
                        .unwrap_or("auto")
                        .to_string();
                    let messages = pending
                        .get("messages")
                        .and_then(|v| v.as_array())
                        .cloned()
                        .unwrap_or_default();
                    recovered.push(PendingCompactionRecovery {
                        session_id: sid,
                        workspace_dir,
                        reason,
                        messages,
                    });
                }
            }
        }
        if modified {
            save_store(store);
        }
    });
    recovered
}

#[derive(Debug, Clone)]
pub struct InterruptedTurnRecovery {
    pub session_id: String,
    pub workspace_dir: String,
}

/// Extracts and clears any `activeTurn` markers left behind when the engine exited mid-turn
/// or mid-tool (`K41`, `K55`) so `lib.rs` can settle and resume them cleanly on startup.
pub fn take_interrupted_turns_on_startup() -> Vec<InterruptedTurnRecovery> {
    let mut recovered = Vec::new();
    with_store(|store| {
        let mut modified = false;
        let session_ids: Vec<String> = store.sessions.keys().cloned().collect();
        for sid in session_ids {
            if let Some(sess) = store.sessions.get_mut(&sid) {
                if let Some(active) = sess.as_object_mut().and_then(|o| o.remove("activeTurn")) {
                    modified = true;
                    let workspace_dir = active
                        .get("workspaceDir")
                        .and_then(|v| v.as_str())
                        .or_else(|| sess.pointer("/location/directory").and_then(|v| v.as_str()))
                        .or_else(|| sess.get("directory").and_then(|v| v.as_str()))
                        .unwrap_or("")
                        .to_string();
                    recovered.push(InterruptedTurnRecovery {
                        session_id: sid,
                        workspace_dir,
                    });
                }
            }
        }
        if modified {
            save_store(store);
        }
    });
    recovered
}

