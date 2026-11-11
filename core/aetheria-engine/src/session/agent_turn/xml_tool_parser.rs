//! Pseudo-XML `<invoke name="..."><parameter name="...">` Tool Call Extractor.
//! Recovers structured OpenAI-style `tool_calls` when models emit XML-style tool invocations in plain text.

use serde_json::{json, Value};

pub(crate) fn extract_xml_tool_calls(msg_text: &mut String) -> Vec<Value> {
    let mut extracted = Vec::new();
    let mut cleaned_text = String::with_capacity(msg_text.len());
    let mut last_idx = 0;

    let text_bytes = msg_text.as_str();
    while let Some(start_rel) = text_bytes[last_idx..].find("<invoke ") {
        let tag_start = last_idx + start_rel;
        let Some(tag_end_rel) = text_bytes[tag_start..].find('>') else {
            break;
        };
        let open_tag = &text_bytes[tag_start..tag_start + tag_end_rel + 1];

        let fn_name = if let Some(n_start) = open_tag.find("name=\"") {
            let rest = &open_tag[n_start + 6..];
            let n_end = rest.find('"').unwrap_or(rest.len());
            rest[..n_end].trim().to_string()
        } else if let Some(n_start) = open_tag.find("name='") {
            let rest = &open_tag[n_start + 6..];
            let n_end = rest.find('\'').unwrap_or(rest.len());
            rest[..n_end].trim().to_string()
        } else {
            "tool".to_string()
        };

        let Some(close_rel) = text_bytes[tag_start..].find("</invoke>") else {
            break;
        };
        let tag_close = tag_start + close_rel + 9;
        let inner_xml = &text_bytes[tag_start + tag_end_rel + 1..tag_start + close_rel];

        let mut args_map = serde_json::Map::new();
        let mut p_search = 0;
        while let Some(p_start_rel) = inner_xml[p_search..].find("<parameter ") {
            let p_start = p_search + p_start_rel;
            let Some(p_tag_end_rel) = inner_xml[p_start..].find('>') else {
                break;
            };
            let p_open_tag = &inner_xml[p_start..p_start + p_tag_end_rel + 1];

            let p_name = if let Some(pn_start) = p_open_tag.find("name=\"") {
                let rest = &p_open_tag[pn_start + 6..];
                let pn_end = rest.find('"').unwrap_or(rest.len());
                rest[..pn_end].trim().to_string()
            } else if let Some(pn_start) = p_open_tag.find("name='") {
                let rest = &p_open_tag[pn_start + 6..];
                let pn_end = rest.find('\'').unwrap_or(rest.len());
                rest[..pn_end].trim().to_string()
            } else {
                "input".to_string()
            };

            let Some(p_close_rel) = inner_xml[p_start..].find("</parameter>") else {
                break;
            };
            let p_val_str = inner_xml[p_start + p_tag_end_rel + 1..p_start + p_close_rel].trim();

            let val: Value = if (p_val_str.starts_with('{') && p_val_str.ends_with('}'))
                || (p_val_str.starts_with('[') && p_val_str.ends_with(']'))
            {
                serde_json::from_str(p_val_str)
                    .unwrap_or_else(|_| Value::String(p_val_str.to_string()))
            } else if let Ok(n) = p_val_str.parse::<i64>() {
                Value::Number(n.into())
            } else if let Ok(b) = p_val_str.parse::<bool>() {
                Value::Bool(b)
            } else {
                Value::String(p_val_str.to_string())
            };

            args_map.insert(p_name, val);
            p_search = p_start + p_close_rel + 12;
        }

        let args_str =
            serde_json::to_string(&Value::Object(args_map)).unwrap_or_else(|_| "{}".to_string());
        extracted.push(json!({
            "id": crate::paths::gen_id("call_xml"),
            "type": "function",
            "function": {
                "name": fn_name,
                "arguments": args_str
            }
        }));

        cleaned_text.push_str(&text_bytes[last_idx..tag_start]);
        last_idx = tag_close;
    }

    if !extracted.is_empty() {
        cleaned_text.push_str(&text_bytes[last_idx..]);
        let mut final_clean = cleaned_text.replace("Calling tools.", "").trim().to_string();
        if final_clean.starts_with('\n') {
            final_clean = final_clean.trim_start().to_string();
        }
        *msg_text = final_clean;
    }

    extracted
}

