//! Desktop OS shell & UI integration operations (folder picker dialog, Explorer open, clipboard image, backup).

use super::workspace::check_allowed_path;
use super::workspace::set_active_workspace_root;
use crate::paths::now_ms;
use axum::{
    response::{IntoResponse, Response},
    Json,
};
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

