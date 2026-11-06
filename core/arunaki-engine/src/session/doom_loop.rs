//! Anti-Doom-Loop and Repeated Invocations Breaker.
//!
//! Prevents models from getting trapped in endless identical tool call loops
//! (e.g. failing to edit a document and retrying with the exact same arguments 25 times),
//! preserving user tokens, API budget, and system responsiveness.

use std::collections::HashMap;

/// Tracks tool calls within an agent turn and detects doom loops.
#[derive(Debug, Clone)]
pub struct DoomLoopDetector {
    call_counts: HashMap<(String, String), usize>,
    consecutive_call: Option<(String, String)>,
    consecutive_count: usize,
    shell_read_count: usize,
    file_read_counts: HashMap<String, usize>,
    threshold: usize,
}

impl Default for DoomLoopDetector {
    fn default() -> Self {
        Self::new(3)
    }
}

impl DoomLoopDetector {
    /// Creates a new detector with a given repetition threshold (default 3).
    pub fn new(threshold: usize) -> Self {
        Self {
            call_counts: HashMap::new(),
            consecutive_call: None,
            consecutive_count: 0,
            shell_read_count: 0,
            file_read_counts: HashMap::new(),
            threshold: threshold.max(2),
        }
    }

    /// Checks if a tool call constitutes a doom loop.
    ///
    /// If repetition exceeds the threshold, returns `Some(warning_message)`.
    /// Otherwise returns `None` and records the invocation.
    pub fn check_and_record(&mut self, tool_name: &str, args_canonical: &str) -> Option<String> {
        let t_norm = tool_name.trim().to_lowercase();

        // 1. Guard against LLM shell file-inspection loops on Windows
        if t_norm == "bash" || t_norm == "shell" || t_norm == "terminal" {
            let lower_args = args_canonical.to_lowercase();
            if lower_args.contains("cat ")
                || lower_args.contains("head ")
                || lower_args.contains("more ")
                || lower_args.contains("type ")
                || lower_args.contains("get-content")
                || lower_args.contains("readfilesync")
            {
                self.shell_read_count += 1;
                if self.shell_read_count >= 2 {
                    return Some(
                        "Tool execution blocked: Shell file inspection loop detected. Do NOT use shell commands (cat, type, more, node, Get-Content) to inspect files. Use the 'read' tool directly, or if files are already written, proceed immediately to calling 'render_video' to export the MP4.".to_string(),
                    );
                }
            }
        }

        // 2. Guard against LLM repetitive file-read pagination loops
        if t_norm == "read" || t_norm == "read_file" {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(args_canonical) {
                let fp = v.get("filePath")
                    .or_else(|| v.get("path"))
                    .or_else(|| v.get("file"))
                    .and_then(|s| s.as_str())
                    .unwrap_or("")
                    .to_lowercase()
                    .replace('/', "\\");
                if !fp.is_empty() {
                    let c = self.file_read_counts.entry(fp.clone()).or_insert(0);
                    *c += 1;
                    if *c >= 3 {
                        return Some(format!(
                            "Tool execution blocked: File '{}' has already been read {} times in this turn. You already have this file in context. Do NOT read it again. Proceed directly to editing/writing files or calling 'render_video' to produce the output MP4.",
                            fp, *c
                        ));
                    }
                }
            }
        }

        let key = (
            t_norm.clone(),
            args_canonical.trim().to_string(),
        );

        // 1. Total count of this exact invocation in the entire turn
        let total = self.call_counts.entry(key.clone()).or_insert(0);
        *total += 1;

        // 2. Consecutive identical invocations
        if let Some(ref prev) = self.consecutive_call {
            if prev == &key {
                self.consecutive_count += 1;
            } else {
                self.consecutive_call = Some(key.clone());
                self.consecutive_count = 1;
            }
        } else {
            self.consecutive_call = Some(key.clone());
            self.consecutive_count = 1;
        }

        if self.consecutive_count >= self.threshold || *total >= (self.threshold + 1) {
            let count = self.consecutive_count.max(*total);
            Some(format!(
                "Tool execution blocked: Repeated identical invocation of tool '{}' detected ({} times). You appear stuck in an execution loop. Do not call this tool with the same arguments again. Analyze the failure, try a different strategy, verify file names, or ask the user for clarification.",
                tool_name, count
            ))
        } else {
            None
        }
    }

    /// Resets detector counters between turns.
    pub fn reset(&mut self) {
        self.call_counts.clear();
        self.consecutive_call = None;
        self.consecutive_count = 0;
        self.shell_read_count = 0;
        self.file_read_counts.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_allows_normal_calls_and_varying_args() {
        let mut detector = DoomLoopDetector::new(3);

        assert!(detector.check_and_record("read_file", r#"{"path":"a.txt"}"#).is_none());
        assert!(detector.check_and_record("read_file", r#"{"path":"b.txt"}"#).is_none());
        assert!(detector.check_and_record("read_file", r#"{"path":"c.txt"}"#).is_none());
    }

    #[test]
    fn test_blocks_consecutive_identical_calls_at_threshold() {
        let mut detector = DoomLoopDetector::new(3);

        assert!(detector.check_and_record("edit", r#"{"path":"doc.docx"}"#).is_none());
        assert!(detector.check_and_record("edit", r#"{"path":"doc.docx"}"#).is_none());

        // 3rd consecutive call triggers the breaker
        let blocked = detector.check_and_record("edit", r#"{"path":"doc.docx"}"#);
        assert!(blocked.is_some());
        let msg = blocked.unwrap();
        assert!(msg.contains("Repeated identical invocation"));
        assert!(msg.contains("edit"));
    }

    #[test]
    fn test_blocks_alternating_repeated_calls() {
        let mut detector = DoomLoopDetector::new(3);

        // A, B, A, B, A, B (threshold+1 = 4 total)
        assert!(detector.check_and_record("tool_a", "{}").is_none());
        assert!(detector.check_and_record("tool_b", "{}").is_none());
        assert!(detector.check_and_record("tool_a", "{}").is_none());
        assert!(detector.check_and_record("tool_b", "{}").is_none());
        assert!(detector.check_and_record("tool_a", "{}").is_none());
        assert!(detector.check_and_record("tool_b", "{}").is_none());

        // 4th total invocation of tool_a triggers total count breaker
        let blocked = detector.check_and_record("tool_a", "{}");
        assert!(blocked.is_some());
    }
}

