//! Skill & Plugin Installation and Management Tool for Aetheria Engine.
//! Allows installing agent skills and plugins from GitHub repositories, Git URLs,
//! or local folders directly into `.agents/skills/`.

use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use tokio::process::Command;

pub fn skill_tool_definitions() -> Vec<Value> {
    vec![
        json!({
            "type": "function",
            "function": {
                "name": "install_agent_skill",
                "description": "Installs an agent skill or plugin from a GitHub repository URL, git URL, or local path directly into `.agents/skills/` so Aetheria immediately gains new specialized capabilities (e.g. new animation styles, custom voice workflows, domain modeling).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "source": {
                            "type": "string",
                            "description": "GitHub repository URL (e.g. 'https://github.com/owner/skill-name'), git clone URL, or local folder path."
                        },
                        "name": {
                            "type": "string",
                            "description": "Optional custom name for the skill folder (defaults to repository name)."
                        },
                        "description": {
                            "type": "string",
                            "description": "Optional brief description of what the skill does if missing from the source."
                        }
                    },
                    "required": ["source"]
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "list_agent_skills",
                "description": "Lists all installed agent skills and plugins currently active in `.agents/skills/` with their descriptions and file paths.",
                "parameters": {
                    "type": "object",
                    "properties": {}
                }
            }
        }),
    ]
}

pub async fn execute_install_skill(workspace_dir: &str, arguments: &Value) -> Value {
    let source = match arguments.get("source").and_then(|v| v.as_str()) {
        Some(s) if !s.trim().is_empty() => s.trim(),
        _ => return json!({ "error": "install_agent_skill requires a valid 'source' URL or path." }),
    };

    let root = crate::paths::project_root();
    let ws = if workspace_dir.trim().is_empty() {
        root.clone()
    } else {
        PathBuf::from(workspace_dir)
    };

    let skills_dir = ws.join(".agents").join("skills");
    let _ = std::fs::create_dir_all(&skills_dir);

    // Derive skill folder name
    let skill_name = if let Some(n) = arguments.get("name").and_then(|v| v.as_str()).filter(|s| !s.trim().is_empty()) {
        n.trim().to_lowercase().replace(' ', "-")
    } else {
        // Derive from URL
        let clean = source.trim_end_matches('/').trim_end_matches(".git");
        clean.split('/').last().unwrap_or("custom-skill").to_lowercase().replace(' ', "-")
    };

    let target_dir = skills_dir.join(&skill_name);
    if target_dir.exists() {
        return json!({
            "success": false,
            "message": format!("Skill '{}' already exists at '{}'. To reinstall, remove it first.", skill_name, target_dir.display()),
            "path": target_dir.display().to_string()
        });
    }

    // Is it a Git URL?
    if source.starts_with("http://") || source.starts_with("https://") || source.starts_with("git@") {
        let mut git_cmd = Command::new("git");
        git_cmd.arg("clone")
            .arg("--depth")
            .arg("1")
            .arg(source)
            .arg(&target_dir);

        match git_cmd.output().await {
            Ok(output) if output.status.success() => {
                // Ensure SKILL.md exists
                let skill_md = target_dir.join("SKILL.md");
                if !skill_md.exists() {
                    let desc = arguments.get("description").and_then(|v| v.as_str()).unwrap_or("Custom installed agent skill.");
                    let default_md = format!(
                        "---\nname: {}\ndescription: {}\n---\n\n# {}\n\n{}\n",
                        skill_name, desc, skill_name, desc
                    );
                    let _ = std::fs::write(&skill_md, default_md);
                }

                json!({
                    "success": true,
                    "message": format!("Successfully installed skill '{}' from GitHub into '{}'", skill_name, target_dir.display()),
                    "skillName": skill_name,
                    "path": target_dir.display().to_string()
                })
            }
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                json!({
                    "error": format!("Git clone failed: {}", stderr)
                })
            }
            Err(err) => json!({
                "error": format!("Failed to run git: {}", err)
            }),
        }
    } else {
        // Local directory copy
        let local_src = Path::new(source);
        if !local_src.exists() {
            return json!({ "error": format!("Local skill folder not found: {}", source) });
        }

        // Copy directory recursively using python or shell
        let mut cp_cmd = Command::new("python");
        cp_cmd.arg("-c")
            .arg(format!(
                r#"
import shutil
shutil.copytree(r"{}", r"{}")
print("copied")
"#,
                local_src.display(),
                target_dir.display()
            ));

        match cp_cmd.output().await {
            Ok(out) if out.status.success() => {
                let skill_md = target_dir.join("SKILL.md");
                if !skill_md.exists() {
                    let desc = arguments.get("description").and_then(|v| v.as_str()).unwrap_or("Local custom skill.");
                    let default_md = format!(
                        "---\nname: {}\ndescription: {}\n---\n\n# {}\n\n{}\n",
                        skill_name, desc, skill_name, desc
                    );
                    let _ = std::fs::write(&skill_md, default_md);
                }

                json!({
                    "success": true,
                    "message": format!("Successfully installed local skill '{}' into '{}'", skill_name, target_dir.display()),
                    "skillName": skill_name,
                    "path": target_dir.display().to_string()
                })
            }
            Ok(out) => {
                let err = String::from_utf8_lossy(&out.stderr).to_string();
                json!({ "error": format!("Failed to copy local skill directory: {}", err) })
            }
            Err(err) => json!({ "error": format!("Failed to run copy script: {}", err) }),
        }
    }
}

pub fn execute_list_skills(workspace_dir: &str) -> Value {
    let root = crate::paths::project_root();
    let ws = if workspace_dir.trim().is_empty() {
        root.clone()
    } else {
        PathBuf::from(workspace_dir)
    };

    let skills_dir = ws.join(".agents").join("skills");
    let mut skills = Vec::new();

    if let Ok(entries) = std::fs::read_dir(&skills_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
                let skill_md = path.join("SKILL.md");
                let description = if skill_md.is_file() {
                    if let Ok(content) = std::fs::read_to_string(&skill_md) {
                        content.lines()
                            .find(|l| l.starts_with("description:"))
                            .map(|l| l.trim_start_matches("description:").trim().trim_matches('"').to_string())
                            .unwrap_or_else(|| "Installed agent skill.".to_string())
                    } else {
                        "Installed agent skill.".to_string()
                    }
                } else {
                    "No SKILL.md found.".to_string()
                };

                skills.push(json!({
                    "name": name,
                    "description": description,
                    "path": path.display().to_string(),
                    "active": true
                }));
            }
        }
    }

    json!({
        "success": true,
        "totalSkills": skills.len(),
        "skills": skills
    })
}
