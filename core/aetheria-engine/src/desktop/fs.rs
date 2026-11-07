//! Desktop file system operations (pick folder, tree, read, write, backup, delete, rename).

use super::workspace::{check_allowed_path, get_active_workspace_root, set_active_workspace_root};
use crate::paths::now_ms;
use axum::{
    response::{IntoResponse, Response},
    Json,
};
use base64::Engine as _;
use serde_json::{json, Value};
use std::path::Path;

pub async fn handle_pick_folder() -> Response {
    let picked = tokio::task::spawn_blocking(|| -> Option<String> {
        #[cfg(windows)]
        {
            let ps_script = r#"
Add-Type -AssemblyName System.Windows.Forms
$f = New-Object System.Windows.Forms.FolderBrowserDialog
$f.Description = 'Pilih Folder Proyek Aetheria'
$f.ShowNewFolderButton = $true
if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
    [Console]::Out.Write($f.SelectedPath)
}
"#;
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            if let Ok(out) = std::process::Command::new("powershell")
                .args(["-NoProfile", "-STA", "-Command", ps_script])
                .creation_flags(CREATE_NO_WINDOW)
                .output()
            {
                let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !s.is_empty() {
                    return Some(s);
                }
            }
        }
        None
    })
    .await
    .ok()
    .flatten();

    if let Some(ref p) = picked {
        set_active_workspace_root(p);
    }
    Json(json!({ "path": picked })).into_response()
}

pub fn build_tree_recursive(dir: &Path, depth: usize) -> Vec<Value> {
    if depth > 6 {
        return Vec::new();
    }
    let Ok(entries) = std::fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut dirs = Vec::new();
    let mut files = Vec::new();

    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.')
            || name.starts_with("~$")
            || matches!(
                name.as_str(),
                "node_modules" | "dist" | "build" | "__pycache__" | ".git" | "target"
            )
        {
            continue;
        }
        let full_path = entry.path();
        let full_str = full_path.to_string_lossy().to_string();
        if let Ok(ft) = entry.file_type() {
            if ft.is_dir() {
                let children = build_tree_recursive(&full_path, depth + 1);
                dirs.push((
                    name.to_lowercase(),
                    json!({
                        "name": name,
                        "path": full_str,
                        "type": "directory",
                        "children": children
                    }),
                ));
            } else if ft.is_file() {
                let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                let ext = full_path
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|e| format!(".{}", e.to_lowercase()))
                    .unwrap_or_default();
                files.push((
                    name.to_lowercase(),
                    json!({
                        "name": name,
                        "path": full_str,
                        "type": "file",
                        "size": size,
                        "ext": ext
                    }),
                ));
            }
        }
    }

    dirs.sort_by(|a, b| a.0.cmp(&b.0));
    files.sort_by(|a, b| a.0.cmp(&b.0));

    dirs.into_iter()
        .map(|(_, v)| v)
        .chain(files.into_iter().map(|(_, v)| v))
        .collect()
}

pub async fn handle_folder_tree(Json(body): Json<Value>) -> Response {
    let folder_path = body
        .get("folderPath")
        .or_else(|| body.get("path"))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    if folder_path.trim().is_empty() {
        return Json(json!({ "error": "folderPath is required" })).into_response();
    }
    set_active_workspace_root(folder_path);
    let path = Path::new(folder_path);
    let folder_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(folder_path);
    let tree = build_tree_recursive(path, 0);
    Json(json!({
        "tree": tree,
        "folderName": folder_name,
        "folderPath": folder_path
    }))
    .into_response()
}

pub async fn handle_read_file(Json(body): Json<Value>) -> Response {
    if let Some(dir) = body
        .get("directory")
        .or_else(|| body.get("workspacePath"))
        .and_then(|v| v.as_str())
    {
        if !dir.trim().is_empty() {
            set_active_workspace_root(dir);
        }
    }
    let fp = body
        .get("filePath")
        .or_else(|| body.get("path"))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let path = match check_allowed_path(Path::new(fp)) {
        Ok(p) => p,
        Err(e) => return Json(json!({ "error": e })).into_response(),
    };
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();
    let is_binary = matches!(
        ext.as_str(),
        "pdf" | "png" | "jpg" | "jpeg" | "gif" | "webp" | "xlsx" | "xls" | "docx" | "doc" | "pptx" | "ppt" | "zip"
    );
    if is_binary {
        match std::fs::read(&path) {
            Ok(bytes) => {
                let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
                Json(json!({ "content": b64, "encoding": "base64" })).into_response()
            }
            Err(e) => Json(json!({ "error": e.to_string() })).into_response(),
        }
    } else {
        match std::fs::read_to_string(&path) {
            Ok(txt) => Json(json!({ "content": txt, "encoding": "utf-8" })).into_response(),
            Err(e) => Json(json!({ "error": e.to_string() })).into_response(),
        }
    }
}

pub async fn handle_write_file(Json(body): Json<Value>) -> Response {
    if let Some(dir) = body
        .get("directory")
        .or_else(|| body.get("workspacePath"))
        .and_then(|v| v.as_str())
    {
        if !dir.trim().is_empty() {
            set_active_workspace_root(dir);
        }
    }
    let fp = body
        .get("filePath")
        .or_else(|| body.get("path"))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let content = body.get("content").and_then(|v| v.as_str()).unwrap_or("");
    let path = match check_allowed_path(Path::new(fp)) {
        Ok(p) => p,
        Err(e) => return Json(json!({ "error": e })).into_response(),
    };
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            let _ = std::fs::create_dir_all(parent);
        }
    }
    let ws_root = get_active_workspace_root().unwrap_or_else(|| {
        path.parent()
            .filter(|p| !p.as_os_str().is_empty())
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| {
                std::env::current_dir()
                    .map(|c| c.to_string_lossy().to_string())
                    .unwrap_or_default()
            })
    });
    crate::files::capture_baseline_before_write(&ws_root, &path.to_string_lossy());

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();
    let is_binary = matches!(
        ext.as_str(),
        "pdf" | "png" | "jpg" | "jpeg" | "gif" | "webp" | "xlsx" | "xls" | "docx" | "doc" | "pptx" | "ppt" | "zip"
    );

    let write_res = if content.starts_with("data:") && content.contains(";base64,") {
        if let Some((_, b64)) = content.split_once(";base64,") {
            if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(b64.trim()) {
                Some(std::fs::write(&path, bytes))
            } else {
                None
            }
        } else {
            None
        }
    } else if is_binary || content.starts_with("UEsDB") || content.starts_with("JVBER") {
        if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(content.trim()) {
            Some(std::fs::write(&path, bytes))
        } else {
            None
        }
    } else {
        None
    };

    let final_res = if let Some(res) = write_res {
        res
    } else {
        std::fs::write(&path, content)
    };

    match final_res {
        Ok(_) => {
            crate::session::message::emit_event(
                &ws_root,
                "file.edited",
                json!({ "file": path.to_string_lossy() }),
            );
            Json(json!({ "success": true })).into_response()
        }
        Err(e) => Json(json!({ "error": e.to_string() })).into_response(),
    }
}

pub async fn handle_create_folder(Json(body): Json<Value>) -> Response {
    let fp = body
        .get("folderPath")
        .or_else(|| body.get("path"))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let path = match check_allowed_path(Path::new(fp)) {
        Ok(p) => p,
        Err(e) => return Json(json!({ "error": e })).into_response(),
    };
    match std::fs::create_dir_all(&path) {
        Ok(_) => Json(json!({ "success": true })).into_response(),
        Err(e) => Json(json!({ "error": e.to_string() })).into_response(),
    }
}

pub fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_recursive(&entry.path(), &dst.join(entry.file_name()))?;
        } else {
            std::fs::copy(entry.path(), dst.join(entry.file_name()))?;
        }
    }
    Ok(())
}

pub async fn handle_backup_folder(Json(body): Json<Value>) -> Response {
    let src = body
        .get("sourcePath")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let src_path = Path::new(src);
    if !src_path.exists() {
        return Json(json!({ "error": "Source folder does not exist" })).into_response();
    }
    let parent = src_path.parent().unwrap_or_else(|| Path::new("."));
    let base_name = src_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("folder");
    let backup_path = parent.join(format!("{}_backup_{}", base_name, now_ms()));
    match copy_dir_recursive(src_path, &backup_path) {
        Ok(_) => Json(json!({
            "success": true,
            "backupPath": backup_path.to_string_lossy()
        }))
        .into_response(),
        Err(e) => Json(json!({ "error": e.to_string() })).into_response(),
    }
}

pub async fn handle_delete_path(Json(body): Json<Value>) -> Response {
    let tp = body
        .get("targetPath")
        .or_else(|| body.get("path"))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let path = match check_allowed_path(Path::new(tp)) {
        Ok(p) => p,
        Err(e) => return Json(json!({ "error": e })).into_response(),
    };
    let res = if path.is_dir() {
        std::fs::remove_dir_all(&path)
    } else {
        std::fs::remove_file(&path)
    };
    match res {
        Ok(_) => {
            if let Some(ws_root) = get_active_workspace_root() {
                crate::files::remove_baseline_for_path(&ws_root, &path.to_string_lossy());
            }
            Json(json!({ "success": true })).into_response()
        }
        Err(e) => Json(json!({ "error": e.to_string() })).into_response(),
    }
}

pub async fn handle_rename_path(Json(body): Json<Value>) -> Response {
    let old_p = body.get("oldPath").and_then(|v| v.as_str()).unwrap_or("");
    let new_p = body.get("newPath").and_then(|v| v.as_str()).unwrap_or("");
    let old_path = match check_allowed_path(Path::new(old_p)) {
        Ok(p) => p,
        Err(e) => return Json(json!({ "error": e })).into_response(),
    };
    let new_path = match check_allowed_path(Path::new(new_p)) {
        Ok(p) => p,
        Err(e) => return Json(json!({ "error": e })).into_response(),
    };
    match std::fs::rename(&old_path, &new_path) {
        Ok(_) => Json(json!({ "success": true })).into_response(),
        Err(e) => Json(json!({ "error": e.to_string() })).into_response(),
    }
}

pub async fn handle_open_path(Json(body): Json<Value>) -> Response {
    let fp = body
        .get("filePath")
        .or_else(|| body.get("path"))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let path = match check_allowed_path(Path::new(fp)) {
        Ok(p) => p,
        Err(e) => return Json(json!({ "error": e })).into_response(),
    };
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("explorer.exe").arg(&path).spawn();
    }
    Json(json!({ "success": true })).into_response()
}

pub async fn handle_read_binary(Json(body): Json<Value>) -> Response {
    let fp = body
        .get("filePath")
        .or_else(|| body.get("path"))
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let path = match check_allowed_path(Path::new(fp)) {
        Ok(p) => p,
        Err(e) => return Json(json!({ "error": e })).into_response(),
    };
    match std::fs::read(&path) {
        Ok(bytes) => {
            let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
            Json(json!({ "success": true, "base64": b64 })).into_response()
        }
        Err(e) => Json(json!({ "error": e.to_string() })).into_response(),
    }
}

pub async fn handle_read_clipboard_image() -> Response {
    let data_url = tokio::task::spawn_blocking(|| -> Option<String> {
        #[cfg(windows)]
        {
            let ps_script = r#"
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$img = [System.Windows.Forms.Clipboard]::GetImage()
if ($img -ne $null) {
    $ms = New-Object System.IO.MemoryStream
    $img.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    [Console]::Out.Write('data:image/png;base64,' + [Convert]::ToBase64String($ms.ToArray()))
}
"#;
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            if let Ok(out) = std::process::Command::new("powershell")
                .args(["-NoProfile", "-STA", "-Command", ps_script])
                .creation_flags(CREATE_NO_WINDOW)
                .output()
            {
                let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if s.starts_with("data:image/") {
                    return Some(s);
                }
            }
        }
        None
    })
    .await
    .ok()
    .flatten();

    Json(json!({ "dataUrl": data_url })).into_response()
}

