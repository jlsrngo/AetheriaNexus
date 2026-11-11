//! Session Run Coordinator — mirrors `packages/core/src/session/run-coordinator.ts`.
//! Handles cooperative per-session cancellation (`begin_session_turn`, `interrupt_session`, `is_session_interrupted`)
//! and re-exports `inbox`, `max_steps`, and `session_error` for seamless module access.

pub use super::inbox::{
    admit_inbox_item, drain_pending_steers, list_inbox_items, pop_next_queued_input, InboxDelivery,
    InboxItem,
};
pub use super::max_steps::MAX_STEPS_PROMPT;
pub use super::session_error::classify_session_error;

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

static INTERRUPT_FLAGS: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();

fn interrupt_map() -> &'static Mutex<HashMap<String, String>> {
    INTERRUPT_FLAGS.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Clears any stale interrupt flag at the start of a new turn.
pub fn begin_session_turn(session_id: &str) {
    let mut guard = interrupt_map().lock().unwrap_or_else(|e| e.into_inner());
    guard.remove(session_id);
}

/// Signals cooperative cancellation for `session_id` and cancels all running child subagent jobs.
pub fn interrupt_session(session_id: &str, reason: &str) -> usize {
    {
        let mut guard = interrupt_map().lock().unwrap_or_else(|e| e.into_inner());
        guard.insert(session_id.to_string(), reason.to_string());
    }
    crate::session::job_registry::cancel_session_jobs(session_id, reason)
}

/// Checks if a session has been cooperatively interrupted, returning the interrupt reason if so.
pub fn is_session_interrupted(session_id: &str) -> Option<String> {
    let guard = interrupt_map().lock().unwrap_or_else(|e| e.into_inner());
    guard.get(session_id).cloned()
}

/// Clears the interrupt flag when a turn finishes.
pub fn finish_session_turn(session_id: &str) {
    let mut guard = interrupt_map().lock().unwrap_or_else(|e| e.into_inner());
    guard.remove(session_id);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_interrupt_lifecycle() {
        let sid = "sess_coord_test_1";
        begin_session_turn(sid);
        assert!(is_session_interrupted(sid).is_none());

        interrupt_session(sid, "user");
        assert_eq!(is_session_interrupted(sid).as_deref(), Some("user"));

        finish_session_turn(sid);
        assert!(is_session_interrupted(sid).is_none());
    }

    #[test]
    fn test_inbox_steer_and_queue_priority() {
        let sid = "sess_inbox_test_1";
        admit_inbox_item(sid, "Queued prompt 1", InboxDelivery::Queue);
        admit_inbox_item(sid, "Urgent mid-turn steer", InboxDelivery::Steer);
        admit_inbox_item(sid, "Queued prompt 2", InboxDelivery::Queue);

        let steers = drain_pending_steers(sid);
        assert_eq!(steers.len(), 1);
        assert_eq!(steers[0].text, "Urgent mid-turn steer");

        let q1 = pop_next_queued_input(sid).expect("first queue item");
        assert_eq!(q1.text, "Queued prompt 1");
        let q2 = pop_next_queued_input(sid).expect("second queue item");
        assert_eq!(q2.text, "Queued prompt 2");
        assert!(pop_next_queued_input(sid).is_none());
    }

    #[test]
    fn test_classify_session_error() {
        let e1 = classify_session_error(Some(429), "Rate limit exceeded");
        assert_eq!(e1["type"], "provider.rate-limit");
        assert_eq!(e1["retryable"], true);

        let e2 = classify_session_error(Some(401), "Invalid API key");
        assert_eq!(e2["type"], "provider.auth");
        assert_eq!(e2["retryable"], false);
    }
}
