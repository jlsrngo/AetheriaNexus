//! Smart Sound Effects (SFX) Tool for Aetheria Engine.
//! Intelligently computes context-aware sound effect cues (whoosh, pop, impact, chime, typewriter)
//! with a built-in density guard to ensure video audio stays clean, dynamic, and never cluttered.

use serde_json::{json, Value};
use tokio::process::Command;

pub fn sfx_tool_definition() -> Value {
    json!({
        "type": "function",
        "function": {
            "name": "generate_smart_sfx",
            "description": "Generates context-aware, studio-grade sound effect cues for video scenes. The engine automatically maps scene events (scene entrance -> whoosh, headline/card pop -> pop, key stat/proof -> chime, dramatic climax -> impact, CTA -> chime) and enforces an anti-clutter density guard so audio is dynamic yet clean and uncluttered. Returns cue placements ready for Remotion.",
            "parameters": {
                "type": "object",
                "properties": {
                    "scenes": {
                        "type": "array",
                        "description": "List of scenes with their durations and semantic types (e.g. 'hook', 'stat', 'climax', 'cta').",
                        "items": {
                            "type": "object",
                            "properties": {
                                "duration": { "type": "number", "description": "Scene duration in seconds" },
                                "type": { "type": "string", "description": "Semantic role: 'hook', 'stat', 'climax', 'cta', 'tutorial'" },
                                "headlineFrame": { "type": "number", "description": "Frame offset where headline appears (default: 6)" }
                            },
                            "required": ["duration"]
                        }
                    },
                    "fps": {
                        "type": "number",
                        "description": "Composition framerate (default: 30)"
                    }
                },
                "required": ["scenes"]
            }
        }
    })
}

pub async fn execute_smart_sfx(_workspace_dir: &str, arguments: &Value) -> Value {
    let scenes = match arguments.get("scenes").and_then(|v| v.as_array()) {
        Some(s) if !s.is_empty() => s,
        _ => return json!({ "error": "generate_smart_sfx requires a non-empty 'scenes' array." }),
    };

    let fps = arguments.get("fps").and_then(|v| v.as_u64()).unwrap_or(30) as usize;
    let root = crate::paths::project_root();

    let mut py_cmd = Command::new("python");
    crate::paths::configure_hidden_tokio_command(&mut py_cmd);
    py_cmd.arg("-c")
        .arg(format!(
            r#"
import sys, json
sys.path.insert(0, r"{}")
from sfx_engine import SmartSfxScheduler, ensure_soundbank
from pathlib import Path

root = Path(r"{}")
ensure_soundbank(root / "workspace" / "public" / "sfx")
ensure_soundbank(root / "public" / "sfx")
ensure_soundbank(root / "apps" / "public" / "sfx")

scenes = json.loads(r'{}')
fps = {}
cues = SmartSfxScheduler.generate_cues_for_scenes(scenes, fps=fps)
print(json.dumps({{"success": True, "cues": cues, "totalCues": len(cues)}}))
"#,
            root.join("core").join("voicebox").display(),
            root.display(),
            serde_json::to_string(scenes).unwrap_or_else(|_| "[]".to_string()),
            fps
        ));

    match py_cmd.output().await {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            if let Some(idx) = stdout.rfind('{') {
                if let Ok(parsed) = serde_json::from_str::<Value>(&stdout[idx..]) {
                    return parsed;
                }
            }
            json!({ "success": true, "raw": stdout.trim() })
        }
        Err(err) => json!({ "error": format!("Failed to run SFX engine: {}", err) }),
    }
}
