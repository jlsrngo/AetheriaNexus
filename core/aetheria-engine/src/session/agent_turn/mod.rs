//! Agent Turn Execution Engine — modularized into context, history, vision, and runner.
//!
//! Submodules:
//! - `context`: System prompt assembly, skills, plugin rules, reference reports, mentioned files.
//! - `history`: OpenCode / OpenAI session history formatting, tool call serialization.
//! - `vision`: Multimodal attachments, base64 decoding, FFmpeg keyframe & voice extraction.
//! - `runner`: Core 35-step execution loop, SSE streaming, failover, compaction, persistence.

pub mod context;
pub mod history;
pub mod runner;
pub mod vision;

pub use context::{discover_workspace_plugin_rules, discover_workspace_skills};
pub use runner::run_agent_turn;

