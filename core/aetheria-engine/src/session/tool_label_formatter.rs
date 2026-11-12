//! Human-Readable UI Tool Step Label Formatter.
//!
//! Converts raw tool names and arguments into clean status strings
//! (`"Explored script.txt"`, `"Rendering video: \"...\""`, etc.).

use serde_json::Value;

/// Clean Antigravity-style label formatter for tool invocations.
pub fn format_tool_step_label(tool_name: &str, args_or_target: &Value, is_finished: bool) -> String {
    let t = tool_name.to_lowercase();

    let mut target = String::new();
    let mut query_text = String::new();
    let mut batch_count = 0usize;
    let mut invoice_no = String::new();
    let mut item_code = String::new();

    if let Some(s) = args_or_target.as_str() {
        let trimmed = s.trim();
        if !trimmed.starts_with("completed")
            && !trimmed.starts_with("failed")
            && !trimmed.starts_with("executing")
        {
            target = trimmed.to_string();
        }
    } else if let Some(obj) = args_or_target.as_object() {
        target = obj
            .get("TargetFile")
            .or_else(|| obj.get("targetFile"))
            .or_else(|| obj.get("path"))
            .or_else(|| obj.get("filePath"))
            .or_else(|| obj.get("file"))
            .or_else(|| obj.get("pattern"))
            .or_else(|| obj.get("CommandLine"))
            .or_else(|| obj.get("commandLine"))
            .or_else(|| obj.get("command"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        if let Some(q) = obj
            .get("query")
            .or_else(|| obj.get("q"))
            .or_else(|| obj.get("search"))
            .and_then(|v| v.as_str())
        {
            query_text = q.trim().to_string();
        }

        if let Some(queries) = obj.get("queries").and_then(|v| v.as_array()) {
            batch_count = queries.len();
            if let Some(first) = queries.first().and_then(|v| v.as_str()) {
                query_text = first.trim().to_string();
            }
        }

        if let Some(items) = obj.get("items").and_then(|v| v.as_array()) {
            batch_count = items.len();
        }

        if let Some(inv) = obj.get("invoice").and_then(|v| v.as_str()) {
            invoice_no = inv.trim().to_string();
        }
        if let Some(code) = obj.get("item_code").and_then(|v| v.as_str()) {
            item_code = code.trim().to_string();
        }
    }

    let normalized_target = target.replace('\\', "/");
    let raw_file_name = normalized_target
        .split('/')
        .filter(|s| !s.is_empty())
        .last()
        .unwrap_or(&target)
        .to_string();

    let is_internal = raw_file_name.starts_with('.')
        || raw_file_name.eq_ignore_ascii_case("aetheria.md")
        || normalized_target.contains(".aetheria")
        || normalized_target.contains(".git");

    let file_name = if is_internal { "" } else { &raw_file_name };

    if t.contains("voicebox") || t.contains("speak") || t.contains("tts") {
        return if is_finished {
            "Synthesized voiceover audio (Voicebox)".to_string()
        } else {
            "Synthesizing voiceover audio (Voicebox)...".to_string()
        };
    }

    if t.contains("render") || t.contains("video") || t.contains("remotion") {
        let hook = args_or_target
            .get("hook_text")
            .or_else(|| args_or_target.get("title"))
            .and_then(|v| v.as_str())
            .unwrap_or("");
        if !hook.is_empty() {
            let truncated_hook: String = hook.chars().take(30).collect();
            return if is_finished {
                format!("Rendered video: \"{}\"", truncated_hook)
            } else {
                format!("Rendering video: \"{}\"", truncated_hook)
            };
        }
        return if is_finished {
            "Rendered video MP4".to_string()
        } else {
            "Rendering video MP4".to_string()
        };
    }

    if t.contains("pos") || t.contains("aetheriazen") {
        if t.contains("search") || t.contains("product") || t.contains("katalog") || t.contains("catalog") {
            if batch_count > 1 {
                return if is_finished { format!("Searched catalog ({} items)", batch_count) } else { format!("Searching catalog ({} items)", batch_count) };
            }
            if !query_text.is_empty() {
                return if is_finished { format!("Searched catalog: {}", query_text) } else { format!("Searching catalog: {}", query_text) };
            }
            return if is_finished { "Searched product catalog".to_string() } else { "Searching product catalog".to_string() };
        }
        if t.contains("void") || t.contains("cancel") || t.contains("batal") {
            if !invoice_no.is_empty() {
                return if is_finished { format!("Voided sales order: {}", invoice_no) } else { format!("Voiding sales order: {}", invoice_no) };
            }
            return if is_finished { "Voided sales order".to_string() } else { "Voiding sales order".to_string() };
        }
        if t.contains("order") || t.contains("sale") || t.contains("transaksi") {
            if t.contains("edit") || t.contains("ubah") {
                if !invoice_no.is_empty() {
                    return if is_finished { format!("Edited sales order: {}", invoice_no) } else { format!("Editing sales order: {}", invoice_no) };
                }
                return if is_finished { "Edited sales order".to_string() } else { "Editing sales order".to_string() };
            }
            if batch_count > 0 {
                return if is_finished { format!("Created sales order ({} items)", batch_count) } else { format!("Creating sales order ({} items)", batch_count) };
            }
            return if is_finished { "Created sales order".to_string() } else { "Creating sales order".to_string() };
        }
        if t.contains("print") || t.contains("receipt") || t.contains("struk") {
            if !invoice_no.is_empty() {
                return if is_finished { format!("Printed receipt: {}", invoice_no) } else { format!("Printing receipt: {}", invoice_no) };
            }
            return if is_finished { "Printed customer receipt".to_string() } else { "Printing customer receipt".to_string() };
        }
        if t.contains("drawer") || t.contains("laci") {
            return if is_finished { "Opened cash drawer".to_string() } else { "Opening cash drawer".to_string() };
        }
        if t.contains("stock") || t.contains("stok") {
            if !item_code.is_empty() {
                return if is_finished { format!("Adjusted stock: {}", item_code) } else { format!("Adjusting stock: {}", item_code) };
            }
            return if is_finished { "Adjusted inventory stock".to_string() } else { "Adjusting inventory stock".to_string() };
        }
    }

    if t == "open_document_app" || t == "open_app" || t == "launch_app" {
        let raw_app = args_or_target
            .get("app")
            .or_else(|| args_or_target.get("name"))
            .and_then(|v| v.as_str())
            .unwrap_or(&target);
        let app_lower = raw_app.to_lowercase();
        let app_name = if app_lower.contains("word") {
            "WordCraft"
        } else if app_lower.contains("grid") || app_lower.contains("excel") {
            "GridCraft"
        } else if app_lower.contains("pdf") {
            "PdfCraft"
        } else if app_lower.contains("deck") || app_lower.contains("slide") {
            "DeckCraft"
        } else {
            "Document App"
        };
        return if is_finished { format!("Opened {}", app_name) } else { format!("Opening {}", app_name) };
    }

    if t == "question" || t.contains("ask_question") {
        return if is_finished { "Asked clarification question".to_string() } else { "Asking clarification question".to_string() };
    }

    if t == "read" || t == "read_file" || t == "view_file" {
        if !file_name.is_empty() {
            return if is_finished { format!("Explored {}", file_name) } else { format!("Reading {}", file_name) };
        }
        return if is_finished { "Explored workspace".to_string() } else { "Exploring workspace".to_string() };
    }
    if t == "list_dir" || t == "glob" {
        if !file_name.is_empty() {
            return if is_finished { format!("Explored folder {}", file_name) } else { format!("Exploring folder {}", file_name) };
        }
        return if is_finished { "Explored workspace".to_string() } else { "Exploring workspace".to_string() };
    }

    if t.contains("replace") || t == "edit" || t == "edit_file" {
        let name = if file_name.is_empty() { "file" } else { file_name };
        return if is_finished { format!("Edited {}", name) } else { format!("Editing {}", name) };
    }
    if t.contains("write") || t == "create_file" {
        let name = if file_name.is_empty() { "file" } else { file_name };
        return if is_finished { format!("Created {}", name) } else { format!("Writing {}", name) };
    }

    if t.contains("excel") {
        let name = if file_name.is_empty() { "" } else { file_name };
        if t.contains("batch") {
            return if is_finished { format!("Batch updated Excel {}", name).trim().to_string() } else { format!("Batch updating Excel {}", name).trim().to_string() };
        }
        if t.contains("read") || t.contains("view") {
            return if is_finished { format!("Read Excel {}", name).trim().to_string() } else { format!("Reading Excel {}", name).trim().to_string() };
        }
        return if is_finished { format!("Updated Excel {}", name).trim().to_string() } else { format!("Updating Excel {}", name).trim().to_string() };
    }

    if t.contains("word") || t.contains("docx") {
        let name = if file_name.is_empty() { "" } else { file_name };
        if t.contains("read") || t.contains("view") {
            return if is_finished { format!("Read Word {}", name).trim().to_string() } else { format!("Reading Word {}", name).trim().to_string() };
        }
        return if is_finished { format!("Updated Word {}", name).trim().to_string() } else { format!("Updating Word {}", name).trim().to_string() };
    }

    if t == "run_command" || t == "bash" || t == "powershell" {
        let preview: String = target.chars().take(30).collect();
        let cmd = if preview.is_empty() { "command" } else { &preview };
        return if is_finished { format!("Ran {}", cmd) } else { format!("Running {}", cmd) };
    }

    if t.contains("knowledge") || t.contains("memory") {
        if !query_text.is_empty() {
            return if is_finished { format!("Searched knowledge: {}", query_text) } else { format!("Searching knowledge: {}", query_text) };
        }
        return if is_finished { "Searched knowledge base".to_string() } else { "Searching knowledge base".to_string() };
    }
    if t.contains("search") || t.contains("grep") {
        let q = if !query_text.is_empty() { &query_text } else { &target };
        if !q.is_empty() {
            return if is_finished { format!("Searched for {}", q) } else { format!("Searching for {}", q) };
        }
        return if is_finished { "Searched workspace".to_string() } else { "Searching workspace".to_string() };
    }

    if t == "task" || t.contains("subagent") || t.contains("delegate") {
        let role_val = args_or_target
            .get("subagent_type")
            .or_else(|| args_or_target.get("role"))
            .or_else(|| args_or_target.get("type"))
            .and_then(|v| v.as_str())
            .unwrap_or("specialist");
        let desc_val = args_or_target
            .get("description")
            .and_then(|v| v.as_str())
            .map(str::trim)
            .unwrap_or("");
        let display_role = match role_val {
            "audio" | "audio-director" => "Audio Producer",
            "assets" => "Asset Curator",
            "motion" | "motion-designer" => "Motion Engineer",
            "qa-verifier" => "QA Verifier",
            "explore" => "Research Assistant",
            other if !other.is_empty() && other != "specialist" => other,
            _ => "Specialist",
        };
        if !desc_val.is_empty() {
            return if is_finished {
                format!("[{}] {}", display_role, desc_val)
            } else {
                format!("[{}] {}...", display_role, desc_val)
            };
        }
        return if is_finished {
            format!("Subtask [{}] completed", display_role)
        } else {
            format!("Delegated to [{}]...", display_role)
        };
    }

    let disp = if tool_name.is_empty() { "action" } else { tool_name };
    if !file_name.is_empty() {
        if is_finished { format!("{}: {}", disp, file_name) } else { format!("Running {}: {}", disp, file_name) }
    } else {
        if is_finished { format!("Executed {}", disp) } else { format!("Executing {}", disp) }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn formats_antigravity_step_labels() {
        let label1 = format_tool_step_label(
            "read_file",
            &json!({ "filePath": "docs/script.txt" }),
            true,
        );
        assert_eq!(label1, "Explored script.txt");

        let label2 = format_tool_step_label(
            "render_video",
            &json!({ "hook_text": "3 Wealth Habits" }),
            false,
        );
        assert_eq!(label2, "Rendering video: \"3 Wealth Habits\"");

        let label3 = format_tool_step_label(
            "render_video",
            &json!({ "hook_text": "3 Wealth Habits" }),
            true,
        );
        assert_eq!(label3, "Rendered video: \"3 Wealth Habits\"");

        let label4 = format_tool_step_label(
            "task",
            &json!({ "subagent_type": "audio-director", "description": "Generate scene audio" }),
            false,
        );
        assert_eq!(label4, "[Audio Producer] Generate scene audio...");

        let label5 = format_tool_step_label(
            "task",
            &json!({ "subagent_type": "motion-designer", "description": "Build 3D scene scripts" }),
            true,
        );
        assert_eq!(label5, "[Motion Engineer] Build 3D scene scripts");
    }
}

