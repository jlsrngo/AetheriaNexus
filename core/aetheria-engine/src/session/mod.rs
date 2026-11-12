//! Session module — module declarations, re-exports, and Axum router wiring.
pub mod agent_turn;
pub mod canvas_extractor;
pub mod compaction;
pub mod compaction_budget;
pub mod compaction_emergency;
pub mod compaction_summary;
pub mod coordinator;
pub mod doom_loop;
pub mod event_normalizer;
pub mod event_normalizer_route;
pub mod finish_reason;
pub mod inbox;
pub mod inbox_routes;
pub mod job_registry;
pub mod max_steps;
pub mod memory;
pub mod message;
pub mod model;
pub mod prompt;
pub mod prompt_sync;
pub mod provider_error;
pub mod reasoning_cleaner;
pub mod restart;
pub mod routes;
pub mod schema;
#[allow(clippy::module_inception)]
pub mod session;
pub mod session_error;
pub mod stats;
pub mod summary;
pub mod title;
pub mod tool_label_formatter;
pub mod tools;
pub mod ui_mapper;
pub mod usage;
pub mod watcher;
pub mod watcher_classifier;

#[allow(unused_imports)]
pub use memory::*;
pub use message::*;
pub use prompt::*;
pub use session::*;

use axum::{
    routing::{get, post},
    Router,
};

pub fn router() -> Router {
    Router::new()
        .route("/api/session", get(routes::handle_list).post(routes::handle_create))
        .route("/session", get(routes::handle_list).post(routes::handle_create))
        .route("/api/session/cleanup-empty", post(stats::handle_cleanup_empty))
        .route("/session/cleanup-empty", post(stats::handle_cleanup_empty))
        .route("/api/session/active", get(routes::handle_active))
        .route("/session/status", get(routes::handle_active))
        .route(
            "/api/session/:id",
            get(routes::handle_get)
                .patch(routes::handle_patch)
                .delete(routes::handle_delete),
        )
        .route(
            "/session/:id",
            get(routes::handle_get)
                .patch(routes::handle_patch)
                .delete(routes::handle_delete),
        )
        .route("/api/session/:id/abort", post(handle_abort))
        .route("/session/:id/abort", post(handle_abort))
        .route("/api/session/:id/interrupt", post(handle_abort))
        .route("/session/:id/interrupt", post(handle_abort))
        .route(
            "/api/session/:id/message",
            get(routes::handle_messages).post(inbox_routes::handle_prompt_route),
        )
        .route(
            "/session/:id/message",
            get(routes::handle_messages).post(inbox_routes::handle_prompt_route),
        )
        .route("/api/session/:id/prompt", post(inbox_routes::handle_prompt_route))
        .route("/session/:id/prompt", post(inbox_routes::handle_prompt_route))
        .route("/api/session/:id/prompt_async", post(inbox_routes::handle_prompt_route))
        .route("/api/session/:id/model", post(handle_switch_model))
        .route("/session/:id/model", post(handle_switch_model))
        .route("/api/session/:id/todo", get(routes::handle_empty_list))
        .route("/session/:id/todo", get(routes::handle_empty_list))
        .route("/api/session/:id/diff", get(routes::handle_empty_list))
        .route("/session/:id/diff", get(routes::handle_empty_list))
        .route("/api/session/:id/canvases", get(routes::handle_session_canvases))
        .route("/session/:id/canvases", get(routes::handle_session_canvases))
        .route(
            "/api/session/:id/normalize-event",
            post(event_normalizer::handle_normalize_session_event),
        )
        .route(
            "/session/:id/normalize-event",
            post(event_normalizer::handle_normalize_session_event),
        )
        .route("/api/session/:id/summarize", post(summary::handle_summarize))
        .route("/session/:id/summarize", post(summary::handle_summarize))
        .route(
            "/api/session/:id/inbox",
            get(inbox_routes::handle_get_inbox).post(inbox_routes::handle_post_inbox),
        )
        .route(
            "/session/:id/inbox",
            get(inbox_routes::handle_get_inbox).post(inbox_routes::handle_post_inbox),
        )
        .route("/api/session/:id/jobs", get(inbox_routes::handle_get_jobs))
        .route("/session/:id/jobs", get(inbox_routes::handle_get_jobs))
}
