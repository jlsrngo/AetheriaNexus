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

