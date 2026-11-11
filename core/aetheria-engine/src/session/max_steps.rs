//! Maximum Step Budget Synthesis Prompt — mirrors `packages/core/src/session/runner/max-steps.ts`.
//! Injected when an agent or subagent exhausts its step budget so it outputs a clean summary instead of stopping abruptly.

pub const MAX_STEPS_PROMPT: &str = "You have reached the maximum number of tool execution steps for this turn. \
Do NOT call any more tools. Synthesize a clear, complete summary of: \
(1) what has been accomplished so far, \
(2) which files were created or modified, and \
(3) any remaining actions if applicable.";

