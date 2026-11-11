//! Agent Turn Execution Engine — modularized into context, history, vision, and runner.
//!
//! Submodules:
//! - `context`: System prompt assembly, skills, plugin rules, reference reports, mentioned files.
//! - `history`: OpenCode / OpenAI session history formatting, tool call serialization.
//! - `vision`: Multimodal attachments, base64 decoding, FFmpeg keyframe & voice extraction.
//! - `runner`: Core 35-step execution loop, SSE streaming, failover, compaction, persistence.

pub mod command_resolvers;
pub mod context;
pub mod history;
pub mod resilience;
pub mod retry;
pub mod runner;
pub mod social_links;
pub mod stale_settlement;
pub mod step_http;
pub mod stream_parser;
pub mod subagent;
pub mod subagent_provider;
pub mod subagent_store;
pub mod subagent_tool_batch;
pub mod tool_batch;
pub mod turn_finalize;
pub mod vision;
pub mod xml_tool_parser;

pub use context::{discover_workspace_plugin_rules, discover_workspace_skills};
pub use runner::run_agent_turn;

