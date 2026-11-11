//! Robust JSON Tool Argument Repair & Syntax Recovery.
//!
//! Models occasionally output malformed JSON in tool call arguments (e.g. unescaped newlines
//! in multiline text, trailing commas, markdown code blocks, or truncated brackets).
//! Instead of silently collapsing malformed arguments to `{}` (which breaks tools with misleading errors),
//! this module repairs recoverable syntax errors and returns descriptive errors for unrecoverable ones.

use serde_json::{json, Value};

use super::json_syntax_helpers::{
    auto_close_json_brackets, escape_control_chars_in_strings, remove_trailing_commas,
    repair_single_quotes, strip_markdown_fences,
};
pub use super::tool_input_repair::{canonicalize_tool_name, normalize_tool_input_types};

/// Attempts to parse a tool argument string into a `serde_json::Value`.
///
/// 1. Fast path: native `serde_json::from_str`.
/// 2. If it's a double-stringified JSON string, unwrap and parse the inner string.
/// 3. Strip markdown code fences (```json ... ```).
/// 4. Repair unescaped control characters (literal newlines/tabs inside quotes).
/// 5. Strip trailing commas before closing braces/brackets.
/// 6. Auto-close truncated strings/braces/brackets.
///
/// Returns `Ok(Value)` on success or repair, or `Err(String)` with an actionable diagnostic.
pub fn parse_or_repair_tool_args(raw: &str) -> Result<Value, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(json!({}));
    }

    // 1. Fast path
    if let Ok(val) = serde_json::from_str::<Value>(trimmed) {
        // If the LLM returned a JSON-encoded string containing JSON, unwrap it
        if let Some(inner_str) = val.as_str() {
            let inner_trimmed = inner_str.trim();
            if (inner_trimmed.starts_with('{') && inner_trimmed.ends_with('}'))
                || (inner_trimmed.starts_with('[') && inner_trimmed.ends_with(']'))
            {
                if let Ok(inner_val) = serde_json::from_str::<Value>(inner_trimmed) {
                    return Ok(normalize_tool_input_types(inner_val));
                }
            }
        }
        return Ok(normalize_tool_input_types(val));
    }

    // 2. Strip markdown fences
    let mut candidate = strip_markdown_fences(trimmed).to_string();

    if let Ok(val) = serde_json::from_str::<Value>(&candidate) {
        return Ok(normalize_tool_input_types(val));
    }

    // 3. Repair unescaped newlines and tabs inside string literals
    candidate = escape_control_chars_in_strings(&candidate);
    if let Ok(val) = serde_json::from_str::<Value>(&candidate) {
        return Ok(normalize_tool_input_types(val));
    }

    // 4. Remove trailing commas before } or ]
    candidate = remove_trailing_commas(&candidate);
    if let Ok(val) = serde_json::from_str::<Value>(&candidate) {
        return Ok(normalize_tool_input_types(val));
    }

    // 5. Auto-close unclosed quotes and brackets
    candidate = auto_close_json_brackets(&candidate);
    if let Ok(val) = serde_json::from_str::<Value>(&candidate) {
        return Ok(normalize_tool_input_types(val));
    }

    // 6. Attempt single quote to double quote conversion if single quotes are present
    if candidate.contains('\'') {
        let single_quote_repaired = repair_single_quotes(&candidate);
        if let Ok(val) = serde_json::from_str::<Value>(&single_quote_repaired) {
            return Ok(normalize_tool_input_types(val));
        }
    }

    // Final failure with diagnostic
    let preview: String = raw.chars().take(120).collect();
    Err(format!(
        "Failed to parse tool call arguments as JSON: '{}'. Please provide well-formed JSON object syntax.",
        preview
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_json_passes_untouched() {
        let raw = r#"{"filePath": "document.docx", "limit": 100}"#;
        let res = parse_or_repair_tool_args(raw).expect("should parse");
        assert_eq!(res["filePath"], "document.docx");
        assert_eq!(res["limit"], 100);
    }

    #[test]
    fn test_empty_string_gives_empty_object() {
        let res = parse_or_repair_tool_args("").expect("should succeed");
        assert_eq!(res, json!({}));
    }

    #[test]
    fn test_markdown_fence_stripped() {
        let raw = "```json\n{\"filePath\": \"notes.txt\"}\n```";
        let res = parse_or_repair_tool_args(raw).expect("should parse markdown fence");
        assert_eq!(res["filePath"], "notes.txt");
    }

    #[test]
    fn test_trailing_comma_repaired() {
        let raw = r#"{"filePath": "laporan.xlsx", "offset": 50, }"#;
        let res = parse_or_repair_tool_args(raw).expect("should repair trailing comma");
        assert_eq!(res["filePath"], "laporan.xlsx");
        assert_eq!(res["offset"], 50);
    }

    #[test]
    fn test_unescaped_newlines_in_string_repaired() {
        let raw = "{\n  \"filePath\": \"summary.md\",\n  \"content\": \"Line 1\nLine 2\nLine 3\"\n}";
        let res = parse_or_repair_tool_args(raw).expect("should repair literal newlines");
        assert_eq!(res["filePath"], "summary.md");
        assert!(res["content"].as_str().unwrap().contains("Line 2"));
    }

    #[test]
    fn test_double_stringified_json_unwrapped() {
        let raw = r#""{\"filePath\": \"inner.csv\", \"limit\": 5}""#;
        let res = parse_or_repair_tool_args(raw).expect("should unwrap double-stringified json");
        assert_eq!(res["filePath"], "inner.csv");
        assert_eq!(res["limit"], 5);
    }

    #[test]
    fn test_unclosed_brace_auto_closed() {
        let raw = r#"{"filePath": "cut_off.txt", "limit": 20"#;
        let res = parse_or_repair_tool_args(raw).expect("should close bracket");
        assert_eq!(res["filePath"], "cut_off.txt");
        assert_eq!(res["limit"], 20);
    }

    #[test]
    fn test_unclosed_string_and_brace_auto_closed() {
        let raw = r#"{"filePath": "draft.txt", "notes": "still writing"#;
        let res = parse_or_repair_tool_args(raw).expect("should close quote and bracket");
        assert_eq!(res["filePath"], "draft.txt");
        assert_eq!(res["notes"], "still writing");
    }

    #[test]
    fn test_single_quotes_repaired() {
        let raw = "{'filePath': 'single.json', 'action': 'read'}";
        let res = parse_or_repair_tool_args(raw).expect("should repair single quotes");
        assert_eq!(res["filePath"], "single.json");
        assert_eq!(res["action"], "read");
    }

    #[test]
    fn test_unrecoverable_garbage_returns_clear_error() {
        let raw = "This is definitely not a JSON object";
        let err = parse_or_repair_tool_args(raw).expect_err("should return error");
        assert!(err.contains("Failed to parse tool call arguments as JSON"));
    }

    #[test]
    fn test_type_coercion_and_null_stripping() {
        let raw = r#"{
            "filePath": "data.json",
            "limit": "20",
            "overwrite": "false",
            "offset": null,
            "todos": "[{\"id\":\"1\",\"content\":\"Fix bug\"}]"
        }"#;
        let res = parse_or_repair_tool_args(raw).expect("should parse and coerce");
        assert_eq!(res["filePath"], "data.json");
        assert_eq!(res["limit"], 20);
        assert_eq!(res["overwrite"], false);
        assert!(res.get("offset").is_none());
        assert!(res["todos"].is_array());
        assert_eq!(res["todos"][0]["id"], "1");
    }
}
