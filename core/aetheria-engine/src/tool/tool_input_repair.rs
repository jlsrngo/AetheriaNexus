//! Tool Name Canonicalization & Input Type Coercion — mirrors OpenCode
//! `packages/core/src/plugin/tool-input-repair.ts`.
//!
//! Normalizes aliased tool names emitted by LLMs, strips `null` optional keys,
//! coerces stringified numbers/booleans back to native JSON primitives,
//! and unwraps stringified nested JSON arrays/objects.

use serde_json::{json, Value};

pub use super::tool_alias::canonicalize_tool_name;

/// Recursively normalizes parsed tool arguments (mirrors OpenCode `tool-input-repair.ts`):
/// - Strips `null` values from optional fields so downstream `.get(key)` checks don't trip on `Value::Null`.
/// - Coerces numeric strings (`"20" -> 20`) on known numeric parameter keys.
/// - Coerces boolean strings (`"true" -> true`, `"false" -> false`) on known boolean parameter keys.
/// - Unwraps stringified JSON arrays/objects on structured fields (`todos`, `scenes`, `questions`, `cues`, etc.).
pub fn normalize_tool_input_types(val: Value) -> Value {
    const NUMERIC_KEYS: &[&str] = &[
        "limit",
        "offset",
        "timeout",
        "fps",
        "width",
        "height",
        "duration",
        "durationInFrames",
        "duration_in_frames",
        "startFrame",
        "endFrame",
        "step",
        "max_steps",
        "count",
        "port",
        "line",
        "start_line",
        "end_line",
        "max_results",
        "quality",
        "speed",
    ];
    const BOOLEAN_KEYS: &[&str] = &[
        "overwrite",
        "append",
        "recursive",
        "case_sensitive",
        "exact",
        "enabled",
        "background",
        "include_hidden",
        "ignore_case",
    ];
    const NESTED_JSON_KEYS: &[&str] = &[
        "todos",
        "scenes",
        "questions",
        "options",
        "cues",
        "items",
        "tasks",
        "files",
        "props",
    ];

    match val {
        Value::Object(map) => {
            let mut out = serde_json::Map::with_capacity(map.len());
            for (k, v) in map {
                if v.is_null() {
                    // Strip null placeholders on optional parameters
                    continue;
                }
                let normalized_v = match v {
                    Value::String(ref s) => {
                        let st = s.trim();
                        if NUMERIC_KEYS.contains(&k.as_str()) {
                            if let Ok(int_val) = st.parse::<i64>() {
                                json!(int_val)
                            } else if let Ok(float_val) = st.parse::<f64>() {
                                json!(float_val)
                            } else {
                                v
                            }
                        } else if BOOLEAN_KEYS.contains(&k.as_str()) {
                            if st.eq_ignore_ascii_case("true") {
                                json!(true)
                            } else if st.eq_ignore_ascii_case("false") {
                                json!(false)
                            } else {
                                v
                            }
                        } else if NESTED_JSON_KEYS.contains(&k.as_str())
                            && ((st.starts_with('[') && st.ends_with(']'))
                                || (st.starts_with('{') && st.ends_with('}')))
                        {
                            if let Ok(parsed_inner) = serde_json::from_str::<Value>(st) {
                                normalize_tool_input_types(parsed_inner)
                            } else {
                                v
                            }
                        } else {
                            v
                        }
                    }
                    Value::Object(_) | Value::Array(_) => normalize_tool_input_types(v),
                    other => other,
                };
                out.insert(k, normalized_v);
            }
            Value::Object(out)
        }
        Value::Array(arr) => {
            Value::Array(arr.into_iter().map(normalize_tool_input_types).collect())
        }
        other => other,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_tool_input_types_direct() {
        let raw = json!({
            "filePath": "data.json",
            "limit": "20",
            "overwrite": "false",
            "offset": null,
            "todos": "[{\"id\":\"1\",\"content\":\"Fix bug\"}]"
        });
        let res = normalize_tool_input_types(raw);
        assert_eq!(res["limit"], 20);
        assert_eq!(res["overwrite"], false);
        assert!(res.get("offset").is_none());
        assert!(res["todos"].is_array());
        assert_eq!(res["todos"][0]["id"], "1");
    }
}

