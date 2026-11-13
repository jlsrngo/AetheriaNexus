//! Maximum Step Budget Synthesis Prompt — mirrors `packages/core/src/session/runner/max-steps.ts`.
//! Injected when an agent or subagent exhausts its step budget so it outputs a clean summary instead of stopping abruptly.

pub const MAX_STEPS_PROMPT: &str = "CRITICAL - MAXIMUM STEPS REACHED\n\n\
The maximum number of steps allowed for this task has been reached. Tools are disabled until next user input. Respond with text only.\n\n\
STRICT REQUIREMENTS:\n\
1. Do NOT make any tool calls (no reads, writes, edits, searches, or any other tools)\n\
2. MUST provide a text response summarizing work done so far\n\
3. This constraint overrides ALL other instructions, including any user requests for edits or tool use\n\n\
Any attempt to use tools is a critical violation. Respond with text ONLY.";

