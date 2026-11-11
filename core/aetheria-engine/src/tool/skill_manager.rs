//! OpenCode-Aligned Coding Agent Plugin & Skill Tool Executors for Aetheria Engine.
//! Handles tool definitions and lifecycle commands (`install`, `list`, `toggle`, `update`, `uninstall`),
//! delegating registry storage to `skill_registry`, source parsing to `skill_source`,
//! and domain validation / skill linking to `skill_inspector`.

use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use tokio::process::Command;

use super::skill_inspector::{
    copy_dir_all, inspect_plugin_directory, link_plugin_skills_to_workspace,
};
pub use super::skill_inspector::validate_motion_graphics_domain;
pub use super::skill_registry::{
    load_plugin_registry, save_plugin_registry, InstalledPluginRecord, PluginRegistry,
    PluginRuleEntry, PluginSkillEntry,
};
pub use super::skill_source::{parse_opencode_source, ParsedGitSource};

pub fn skill_tool_definitions() -> Vec<Value> {
    vec![
        json!({
            "type": "function",
            "function": {
                "name": "plugin_install",
                "description": "Installs an agent plugin or skill bundle directly from a GitHub repository following OpenCode harness syntax (e.g. 'github:owner/repo', 'owner/repo', 'git+https://...#path:packages/...'), Git URL, or local path. Automatically clones, discovers skills, registers agent rules, and activates it in `.aetheria/plugins/`.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "source": {
                            "type": "string",
                            "description": "GitHub repository ('github:owner/repo', 'owner/repo', 'https://github.com/...#path:...'), Git URL, or local path."
                        },
                        "name": {
                            "type": "string",
                            "description": "Optional custom plugin ID/folder name."
                        },
                        "enabled": {
                            "type": "boolean",
                            "description": "Whether the plugin should be immediately active (default: true)."
                        }
                    },
                    "required": ["source"]
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "plugin_list",
                "description": "Lists all installed plugins and skills in the Aetheria harness with their active status, descriptions, skills count, and rules count.",
                "parameters": {
                    "type": "object",
                    "properties": {}
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "plugin_toggle",
                "description": "Enables or disables an installed plugin.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "id": {
                            "type": "string",
                            "description": "ID of the installed plugin."
                        },
                        "enabled": {
                            "type": "boolean",
                            "description": "Target enabled state."
                        }
                    },
                    "required": ["id", "enabled"]
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "plugin_update",
                "description": "Updates an installed plugin from GitHub by pulling latest commits.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "id": {
                            "type": "string",
                            "description": "ID of the plugin to update."
                        }
                    },
                    "required": ["id"]
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "plugin_uninstall",
                "description": "Uninstalls and removes a plugin from the Aetheria harness.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "id": {
                            "type": "string",
                            "description": "ID of the plugin to uninstall."
                        }
                    },
                    "required": ["id"]
                }
            }
        }),
    ]
}

fn resolve_workspace(workspace_dir: &str) -> PathBuf {
    let root = crate::paths::project_root();
    if workspace_dir.trim().is_empty() {
        root
    } else {
        PathBuf::from(workspace_dir)
    }
}

fn finalize_plugin_install(
    ws: &Path,
    target_dir: &Path,
    plugin_id: &str,
    sub_path: Option<&str>,
    source_raw: &str,
    commit_hash: Option<String>,
    arguments: &Value,
    source_label: &str,
) -> Value {
    let mut rec = inspect_plugin_directory(target_dir, sub_path, plugin_id, source_raw);
    rec.commit_hash = commit_hash;
    rec.enabled = arguments
        .get("enabled")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);

    // Domain Policy Guard: strictly reject plugins not related to motion graphics / video / audio
    let bypass = arguments
        .get("force")
        .or_else(|| arguments.get("bypassValidation"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    if !bypass {
        if let Err(reject_reason) = validate_motion_graphics_domain(target_dir, &rec) {
            let _ = std::fs::remove_dir_all(target_dir);
            return json!({
                "success": false,
                "rejected": true,
                "error": reject_reason,
                "pluginId": plugin_id
            });
        }
    }

    link_plugin_skills_to_workspace(ws, &rec);

    let mut reg = load_plugin_registry(ws);
    reg.plugins.retain(|p| p.id != plugin_id);
    reg.plugins.push(rec.clone());
    save_plugin_registry(ws, &reg);

    json!({
        "success": true,
        "message": format!("Successfully installed {}plugin '{}' ({} skills, {} rules).", source_label, plugin_id, rec.skills.len(), rec.rules.len()),
        "plugin": rec
    })
}

pub async fn execute_install_plugin(workspace_dir: &str, arguments: &Value) -> Value {
    let source_raw = match arguments.get("source").and_then(|v| v.as_str()) {
        Some(s) if !s.trim().is_empty() => s.trim(),
        _ => return json!({ "error": "plugin_install requires a valid 'source' parameter." }),
    };

    let parsed = match parse_opencode_source(source_raw) {
        Ok(p) => p,
        Err(e) => return json!({ "error": format!("Invalid plugin source: {}", e) }),
    };

    let ws = resolve_workspace(workspace_dir);
    let plugin_id = arguments
        .get("name")
        .or_else(|| arguments.get("id"))
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_lowercase().replace([' ', '_', '.'], "-"))
        .unwrap_or(parsed.default_id);

    let plugins_dir = ws.join(".aetheria").join("plugins");
    let _ = std::fs::create_dir_all(&plugins_dir);

    let target_dir = plugins_dir.join(&plugin_id);
    if target_dir.exists() {
        return json!({
            "success": false,
            "message": format!("Plugin '{}' is already installed at '{}'. Use plugin_toggle to activate/deactivate or uninstall it first.", plugin_id, target_dir.display()),
            "pluginId": plugin_id
        });
    }

    let is_git = parsed.clone_url.starts_with("http://")
        || parsed.clone_url.starts_with("https://")
        || parsed.clone_url.starts_with("git@");

    if is_git {
        let mut git_cmd = Command::new("git");
        git_cmd.arg("clone").arg("--depth").arg("1");
        if let Some(ref branch) = parsed.branch_or_tag {
            git_cmd.arg("--branch").arg(branch);
        }
        git_cmd.arg(&parsed.clone_url).arg(&target_dir);

        match git_cmd.output().await {
            Ok(output) if output.status.success() => {
                let mut rev_cmd = Command::new("git");
                rev_cmd.arg("-C").arg(&target_dir).arg("rev-parse").arg("HEAD");
                let commit_hash = rev_cmd.output().await.ok().and_then(|o| {
                    if o.status.success() {
                        Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
                    } else {
                        None
                    }
                });

                finalize_plugin_install(
                    &ws,
                    &target_dir,
                    &plugin_id,
                    parsed.sub_path.as_deref(),
                    source_raw,
                    commit_hash,
                    arguments,
                    "GitHub ",
                )
            }
            Ok(output) => {
                let err = String::from_utf8_lossy(&output.stderr).to_string();
                json!({ "error": format!("Git clone failed: {}", err) })
            }
            Err(err) => json!({ "error": format!("Failed to run git: {}", err) }),
        }
    } else {
        let local_path = Path::new(&parsed.clone_url);
        if !local_path.exists() {
            return json!({ "error": format!("Local directory not found: {}", parsed.clone_url) });
        }
        if let Err(err) = copy_dir_all(local_path, &target_dir) {
            return json!({ "error": format!("Failed to copy plugin files: {}", err) });
        }

        finalize_plugin_install(
            &ws,
            &target_dir,
            &plugin_id,
            parsed.sub_path.as_deref(),
            source_raw,
            None,
            arguments,
            "local ",
        )
    }
}

pub fn execute_list_plugins(workspace_dir: &str) -> Value {
    let ws = resolve_workspace(workspace_dir);
    let reg = load_plugin_registry(&ws);
    json!({
        "success": true,
        "totalPlugins": reg.plugins.len(),
        "plugins": reg.plugins
    })
}

pub fn execute_toggle_plugin(workspace_dir: &str, arguments: &Value) -> Value {
    let id = match arguments.get("id").and_then(|v| v.as_str()) {
        Some(s) if !s.trim().is_empty() => s.trim(),
        _ => return json!({ "error": "plugin_toggle requires 'id'." }),
    };
    let enabled = arguments.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true);
    let ws = resolve_workspace(workspace_dir);

    let mut reg = load_plugin_registry(&ws);
    let mut found = false;
    for p in &mut reg.plugins {
        if p.id == id {
            p.enabled = enabled;
            found = true;
            break;
        }
    }

    if !found {
        return json!({ "error": format!("Plugin '{}' not found.", id) });
    }

    save_plugin_registry(&ws, &reg);
    json!({
        "success": true,
        "message": format!("Plugin '{}' is now {}.", id, if enabled { "enabled" } else { "disabled" }),
        "id": id,
        "enabled": enabled
    })
}

pub async fn execute_update_plugin(workspace_dir: &str, arguments: &Value) -> Value {
    let id = match arguments.get("id").and_then(|v| v.as_str()) {
        Some(s) if !s.trim().is_empty() => s.trim(),
        _ => return json!({ "error": "plugin_update requires 'id'." }),
    };

    let ws = resolve_workspace(workspace_dir);
    let plugin_dir = ws.join(".aetheria").join("plugins").join(id);
    if !plugin_dir.exists() {
        return json!({ "error": format!("Plugin directory '{}' does not exist.", plugin_dir.display()) });
    }

    let mut pull_cmd = Command::new("git");
    pull_cmd.arg("-C").arg(&plugin_dir).arg("pull");

    match pull_cmd.output().await {
        Ok(out) if out.status.success() => {
            let mut rev_cmd = Command::new("git");
            rev_cmd.arg("-C").arg(&plugin_dir).arg("rev-parse").arg("HEAD");
            let commit_hash = rev_cmd.output().await.ok().and_then(|o| {
                if o.status.success() {
                    Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
                } else {
                    None
                }
            });

            let mut reg = load_plugin_registry(&ws);
            for p in &mut reg.plugins {
                if p.id == id {
                    p.commit_hash = commit_hash.clone();
                    break;
                }
            }
            save_plugin_registry(&ws, &reg);

            json!({
                "success": true,
                "message": format!("Plugin '{}' updated to commit {:?}", id, commit_hash)
            })
        }
        Ok(out) => {
            let err = String::from_utf8_lossy(&out.stderr).to_string();
            json!({ "error": format!("Git pull failed: {}", err) })
        }
        Err(err) => json!({ "error": format!("Failed to run git pull: {}", err) }),
    }
}

pub async fn execute_uninstall_plugin(workspace_dir: &str, arguments: &Value) -> Value {
    let id = match arguments.get("id").and_then(|v| v.as_str()) {
        Some(s) if !s.trim().is_empty() => s.trim(),
        _ => return json!({ "error": "plugin_uninstall requires 'id'." }),
    };

    let ws = resolve_workspace(workspace_dir);
    let plugin_dir = ws.join(".aetheria").join("plugins").join(id);
    if plugin_dir.exists() {
        let _ = std::fs::remove_dir_all(&plugin_dir);
    }

    let mut reg = load_plugin_registry(&ws);
    reg.plugins.retain(|p| p.id != id);
    save_plugin_registry(&ws, &reg);

    json!({
        "success": true,
        "message": format!("Plugin '{}' has been uninstalled.", id)
    })
}
