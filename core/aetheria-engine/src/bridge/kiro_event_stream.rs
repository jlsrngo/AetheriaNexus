//! AWS CodeWhisperer Binary EventStream Frame Decoder for Kiro Bridge.

use serde_json::{json, Value};
use std::collections::HashMap;

pub(crate) fn parse_kiro_event_stream(buf: &[u8]) -> (String, Vec<Value>) {
    let mut full_text = String::new();
    let mut tool_order: Vec<String> = Vec::new();
    let mut tool_map: HashMap<String, (String, String)> = HashMap::new(); // id -> (name, input_acc)

    let mut offset = 0usize;
    while offset + 16 <= buf.len() {
        let total_len = u32::from_be_bytes([
            buf[offset],
            buf[offset + 1],
            buf[offset + 2],
            buf[offset + 3],
        ]) as usize;
        let headers_len = u32::from_be_bytes([
            buf[offset + 4],
            buf[offset + 5],
            buf[offset + 6],
            buf[offset + 7],
        ]) as usize;

        if total_len < 16 || offset + total_len > buf.len() {
            break;
        }

        let headers_start = offset + 12;
        let payload_start = headers_start + headers_len;
        let payload_end = offset + total_len - 4;

        if payload_start <= payload_end && payload_end <= buf.len() {
            let mut h_off = headers_start;
            let mut event_type = String::new();
            while h_off < payload_start {
                let name_len = buf[h_off] as usize;
                h_off += 1;
                if h_off + name_len >= payload_start {
                    break;
                }
                let h_name = String::from_utf8_lossy(&buf[h_off..h_off + name_len]).to_string();
                h_off += name_len;
                let h_type = buf[h_off];
                h_off += 1;
                if h_type == 7 {
                    if h_off + 2 > payload_start {
                        break;
                    }
                    let val_len = u16::from_be_bytes([buf[h_off], buf[h_off + 1]]) as usize;
                    h_off += 2;
                    if h_off + val_len > payload_start {
                        break;
                    }
                    let h_val = String::from_utf8_lossy(&buf[h_off..h_off + val_len]).to_string();
                    h_off += val_len;
                    if h_name == ":event-type" {
                        event_type = h_val;
                    }
                } else {
                    break;
                }
            }

            if let Ok(evt) = serde_json::from_slice::<Value>(&buf[payload_start..payload_end]) {
                let content_opt = evt
                    .pointer("/assistantResponseEvent/content")
                    .or_else(|| {
                        if event_type == "assistantResponseEvent" {
                            evt.get("content")
                        } else {
                            None
                        }
                    })
                    .and_then(|v| v.as_str());
                if let Some(c) = content_opt {
                    full_text.push_str(c);
                }

                let tu_opt = evt.get("toolUseEvent").or_else(|| {
                    if event_type == "toolUseEvent" || evt.get("toolUseId").is_some() {
                        Some(&evt)
                    } else {
                        None
                    }
                });
                if let Some(tu) = tu_opt {
                    if let (Some(id), Some(name)) = (
                        tu.get("toolUseId").and_then(|v| v.as_str()),
                        tu.get("name").and_then(|v| v.as_str()),
                    ) {
                        if !tool_map.contains_key(id) {
                            tool_order.push(id.to_string());
                            tool_map.insert(id.to_string(), (name.to_string(), String::new()));
                        }
                        if let Some(entry) = tool_map.get_mut(id) {
                            if let Some(inp_str) = tu.get("input").and_then(|v| v.as_str()) {
                                entry.1.push_str(inp_str);
                            } else if let Some(inp_obj) = tu.get("input").filter(|v| v.is_object())
                            {
                                entry.1 = serde_json::to_string(inp_obj).unwrap_or_default();
                            }
                        }
                    }
                }
            }
        }

        offset += total_len;
    }

    let mut tool_calls = Vec::new();
    for id in tool_order {
        if let Some((name, raw_args)) = tool_map.remove(&id) {
            let clean_args = if serde_json::from_str::<Value>(&raw_args).is_ok() {
                raw_args
            } else {
                "{}".to_string()
            };
            tool_calls.push(json!({
                "id": id,
                "type": "function",
                "function": {
                    "name": name,
                    "arguments": clean_args
                }
            }));
        }
    }

    (full_text, tool_calls)
}

