//! Persistent Job Registry — mirrors `packages/core/src/job/job.ts` and `packages/core/src/session/subagent-job.ts`.
//! Tracks running/settled jobs (`subagent`, `shell`, `render`, `turn`) on disk (`~/.aetheria/jobs-store.json`).

pub use super::restart::{
    recover_orphaned_jobs_on_startup, CONTINUE_AFTER_SERVER_RESTART, DEFAULT_MAX_RESUME_ATTEMPTS,
    RESUME_EXHAUSTED_MESSAGE,
};

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

use crate::paths::{aetheria_data_dir, now_ms};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum JobStatus {
    Running,
    Completed,
    Error,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobRecord {
    pub id: String,
    pub session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub child_session_id: Option<String>,
    pub kind: String,
    pub description: String,
    pub status: JobStatus,
    pub background: bool,
    pub resume_attempts: u32,
    pub created_at: u64,
    pub updated_at: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub settled_at: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct JobStoreData {
    #[serde(default)]
    pub jobs: HashMap<String, JobRecord>,
}

static JOB_STORE: OnceLock<Mutex<JobStoreData>> = OnceLock::new();

pub fn jobs_store_file_path() -> PathBuf {
    aetheria_data_dir().join("jobs-store.json")
}

fn load_job_store() -> JobStoreData {
    let p = jobs_store_file_path();
    if let Ok(raw) = std::fs::read_to_string(&p) {
        if let Ok(parsed) = serde_json::from_str::<JobStoreData>(&raw) {
            return parsed;
        }
    }
    JobStoreData::default()
}

fn save_job_store(store: &JobStoreData) {
    let p = jobs_store_file_path();
    if let Some(parent) = p.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(raw) = serde_json::to_string(store) {
        let _ = std::fs::write(p, raw);
    }
}

pub(crate) fn with_job_store<F, R>(f: F) -> R
where
    F: FnOnce(&mut JobStoreData) -> R,
{
    let m = JOB_STORE.get_or_init(|| Mutex::new(load_job_store()));
    let mut guard = m.lock().unwrap_or_else(|e| e.into_inner());
    let out = f(&mut guard);
    save_job_store(&guard);
    out
}

/// Registers a newly started job (`subagent`, `shell`, `render`, or `turn`).
pub fn start_job(
    job_id: &str,
    session_id: &str,
    child_session_id: Option<&str>,
    kind: &str,
    description: &str,
    background: bool,
) -> JobRecord {
    let now = now_ms();
    with_job_store(|store| {
        let prev_attempts = store
            .jobs
            .get(job_id)
            .map(|j| j.resume_attempts)
            .unwrap_or(0);
        let record = JobRecord {
            id: job_id.to_string(),
            session_id: session_id.to_string(),
            child_session_id: child_session_id.map(|s| s.to_string()),
            kind: kind.to_string(),
            description: description.to_string(),
            status: JobStatus::Running,
            background,
            resume_attempts: prev_attempts,
            created_at: now,
            updated_at: now,
            settled_at: None,
            output: None,
            error: None,
        };
        store.jobs.insert(job_id.to_string(), record.clone());
        record
    })
}

/// Marks a job as completed and persists its output summary.
pub fn settle_job_completed(job_id: &str, output: Option<String>) {
    let now = now_ms();
    with_job_store(|store| {
        if let Some(job) = store.jobs.get_mut(job_id) {
            job.status = JobStatus::Completed;
            job.updated_at = now;
            job.settled_at = Some(now);
            job.output = output;
            job.error = None;
        }
    });
}

/// Marks a job as failed with a diagnostic error message.
pub fn settle_job_error(job_id: &str, error_msg: &str) {
    let now = now_ms();
    with_job_store(|store| {
        if let Some(job) = store.jobs.get_mut(job_id) {
            job.status = JobStatus::Error;
            job.updated_at = now;
            job.settled_at = Some(now);
            job.error = Some(error_msg.to_string());
        }
    });
}

/// Cancels a single job by ID.
pub fn cancel_job(job_id: &str, reason: &str) -> bool {
    let now = now_ms();
    with_job_store(|store| {
        if let Some(job) = store.jobs.get_mut(job_id) {
            if job.status == JobStatus::Running {
                job.status = JobStatus::Cancelled;
                job.updated_at = now;
                job.settled_at = Some(now);
                job.error = Some(format!("Cancelled ({})", reason));
                return true;
            }
        }
        false
    })
}

/// Cancels all running jobs belonging to `session_id` (or its child subagent sessions).
pub fn cancel_session_jobs(session_id: &str, reason: &str) -> usize {
    let now = now_ms();
    with_job_store(|store| {
        let mut count = 0usize;
        for job in store.jobs.values_mut() {
            if job.status == JobStatus::Running
                && (job.session_id == session_id
                    || job.child_session_id.as_deref() == Some(session_id))
            {
                job.status = JobStatus::Cancelled;
                job.updated_at = now;
                job.settled_at = Some(now);
                job.error = Some(format!("Cancelled ({})", reason));
                count += 1;
            }
        }
        count
    })
}

/// Lists all jobs associated with a session.
pub fn list_session_jobs(session_id: &str) -> Vec<JobRecord> {
    let m = JOB_STORE.get_or_init(|| Mutex::new(load_job_store()));
    let guard = m.lock().unwrap_or_else(|e| e.into_inner());
    let mut out: Vec<JobRecord> = guard
        .jobs
        .values()
        .filter(|j| {
            j.session_id == session_id || j.child_session_id.as_deref() == Some(session_id)
        })
        .cloned()
        .collect();
    out.sort_by_key(|j| j.created_at);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_job_lifecycle_and_session_cancel() {
        let job_id = "job_test_sub_1";
        let parent_sid = "sess_parent_job_test";
        let rec = start_job(
            job_id,
            parent_sid,
            Some("sub_child_1"),
            "subagent",
            "Test subagent job",
            false,
        );
        assert_eq!(rec.status, JobStatus::Running);

        let cancelled = cancel_session_jobs(parent_sid, "user_abort");
        assert_eq!(cancelled, 1);

        let jobs = list_session_jobs(parent_sid);
        let found = jobs.iter().find(|j| j.id == job_id).expect("job exists");
        assert_eq!(found.status, JobStatus::Cancelled);
    }

    #[test]
    fn test_settle_job_completed_and_error() {
        let j1 = "job_test_complete_1";
        start_job(j1, "sess_p2", None, "turn", "Turn 1", false);
        settle_job_completed(j1, Some("Done".to_string()));
        let list = list_session_jobs("sess_p2");
        let r1 = list.iter().find(|j| j.id == j1).expect("job j1");
        assert_eq!(r1.status, JobStatus::Completed);
        assert_eq!(r1.output.as_deref(), Some("Done"));
    }
}
