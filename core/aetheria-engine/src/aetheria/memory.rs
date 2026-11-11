#![allow(dead_code, unused_imports)]
//! Aetheria Living Workspace Memory — Cartographer & Workspace Rules Loader.
//! Mirrors OpenCode `Instruction.Service` + workspace catalog synthesis for `.aetheria/AETHERIA.md`.

use std::collections::HashSet;
use std::path::Path;

use crate::files::collect_files_recursive;
use crate::paths::{aetheria_dot_dir, now_iso};

pub const AETHERIA_MD_NAME: &str = "AETHERIA.md";
pub const CORRECTIONS_FILE_NAME: &str = "user-corrections.jsonl";

/// Infers domain dynamically based on scanned file extensions.
pub fn infer_domain(extensions: &[&str]) -> String {
    let mut types = Vec::new();
    let has_html_motion = extensions
        .iter()
        .any(|&e| e == ".html" || e == ".htm" || e == ".js" || e == ".mjs" || e == ".css");
    let has_media = extensions
        .iter()
        .any(|&e| e == ".mp4" || e == ".webm" || e == ".mov" || e == ".mp3" || e == ".wav");
    let has_graphics = extensions
        .iter()
        .any(|&e| e == ".svg" || e == ".png" || e == ".jpg" || e == ".webp");

    if has_html_motion {
        types.push("HTML5 + JavaScript Deterministic Motion Films (.html / .js)");
    }
    if has_media {
        types.push("Video & Audio Render Assets (.mp4 / .mp3 / .wav)");
    }
    if has_graphics {
        types.push("Visual Layers & Graphic Assets (.svg / .png)");
    }

    if types.is_empty() {
        "HTML5 Motion Studio Project Workspace".to_string()
    } else {
        types.join(" | ")
    }
}

/// Derives universal syntax invariants based on file types.
pub fn derive_syntax_invariants(extensions: &[&str]) -> Vec<String> {
    let mut inv = Vec::new();
    let has_html_motion = extensions.iter().any(|&e| e == ".html" || e == ".js");

    if has_html_motion {
        inv.push("- Modular HTML Motion Architecture: Author films directly inside the opened project folder (`index.html`, `script/scene1..N.js`, `audio/*.wav`) with deterministic `window.renderAt(t)` and `window.__ready = true`.".to_string());
        inv.push("- Zero Node/Remotion Dependencies: Pure browser Canvas 2D / SVG / CSS + Vanilla JS (`window.AM`) with frame-accurate seeking and headless Chrome/Edge CDP MP4 export.".to_string());
    }
    inv.push("- Active Folder Isolation: Only inspect and operate on files within the currently opened active project folder.".to_string());

    inv
}

/// Reads the active workspace living memory from `.aetheria/AETHERIA.md`.
/// If it doesn't exist yet, automatically synthesizes it on the fly.
pub fn get_living_memory_for_workspace(workspace_dir: &str) -> String {
    let ws_path = Path::new(workspace_dir);
    let aetheria_md = ws_path.join(".aetheria").join(AETHERIA_MD_NAME);

    if aetheria_md.exists() {
        if let Ok(content) = std::fs::read_to_string(&aetheria_md) {
            let trimmed = content.trim();
            let has_legacy_doc_rules = trimmed.contains("Spreadsheets & Tabular Data")
                || trimmed.contains("General Document Workspace")
                || trimmed.contains("Workbook Integrity:");
            if !trimmed.is_empty() && !has_legacy_doc_rules {
                return content;
            }
        }
    }

    // Auto-synthesize on first run or when upgrading legacy document rules
    synthesize_living_memory(workspace_dir)
}

/// Scans active folder and synthesizes `.aetheria/AETHERIA.md`.
pub fn synthesize_living_memory(workspace_dir: &str) -> String {
    let ws_path = Path::new(workspace_dir);
    let folder_name = ws_path
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "Active Folder".to_string());

    let mut all_files = Vec::new();
    collect_files_recursive(ws_path, ws_path, &mut all_files, 200);

    let mut extensions = HashSet::new();
    let mut clean_files = Vec::new();

    for f in &all_files {
        let p_str = f.to_string_lossy().to_string();
        if p_str.starts_with(".aetheria") || p_str.starts_with(".git") || p_str.starts_with("node_modules") {
            continue;
        }
        if let Some(ext) = f.extension().and_then(|s| s.to_str()) {
            extensions.insert(format!(".{}", ext.to_lowercase()));
        }
        clean_files.push(p_str);
    }

    let ext_slices: Vec<&str> = extensions.iter().map(|s| s.as_str()).collect();
    let domain = infer_domain(&ext_slices);
    let invariants = derive_syntax_invariants(&ext_slices);

    let file_catalog = if clean_files.is_empty() {
        "_No document files detected in the active folder yet._".to_string()
    } else {
        clean_files
            .iter()
            .take(40)
            .map(|f| format!("- {}", f))
            .collect::<Vec<_>>()
            .join("\n")
    };

    let aetheria_dir = ws_path.join(".aetheria");
    let _ = std::fs::create_dir_all(&aetheria_dir);
    let aetheria_md = aetheria_dir.join(AETHERIA_MD_NAME);

    let existing_doc = std::fs::read_to_string(&aetheria_md).unwrap_or_default();
    let existing_corrections = extract_existing_corrections(&existing_doc);
    let learned_section = if existing_corrections.is_empty() {
        "_No learned preferences yet._".to_string()
    } else {
        existing_corrections.join("\n")
    };

    let doc = format!(
        "# LOCAL WORKSPACE OPERATING RULES ({})\n\n\
        <!-- AUTO-GENERATED BY AETHERIA CARTOGRAPHER. DO NOT DELETE. -->\n\n\
        ## Domain Profile\n{}\n\n\
        ## Workspace Catalog\n{}\n\n\
        ## Operating Invariants\n{}\n\n\
        ## User Preferences & Learned Corrections\n### Learned by the Sentinel\n{}\n",
        folder_name, domain, file_catalog, invariants.join("\n"), learned_section
    );

    let _ = std::fs::write(&aetheria_md, &doc);
    doc
}

fn extract_existing_corrections(doc: &str) -> Vec<String> {
    if doc.is_empty() {
        return Vec::new();
    }
    let mut out = Vec::new();
    let mut in_section = false;

    for line in doc.lines() {
        if line.starts_with("## User Preferences") {
            in_section = true;
            continue;
        }
        if in_section {
            if line.starts_with("## ") || line.starts_with("---") {
                break;
            }
            let trimmed = line.trim();
            if trimmed.starts_with("- ") && !trimmed.contains("No learned preferences yet") {
                out.push(trimmed.to_string());
            }
        }
    }
    out
}
