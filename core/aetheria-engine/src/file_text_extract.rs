//! Binary document detection and diffable UTF-8/digest extraction.

use std::path::Path;

pub fn is_binary_doc_ext(path: &Path) -> bool {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    matches!(
        ext.as_str(),
        "xlsx"
            | "xls"
            | "xlsm"
            | "xlsb"
            | "docx"
            | "doc"
            | "pptx"
            | "ppt"
            | "pdf"
            | "png"
            | "jpg"
            | "jpeg"
            | "gif"
            | "webp"
            | "zip"
    )
}

pub fn extract_diffable_text(file_path: &Path) -> String {
    let Ok(bytes) = std::fs::read(file_path) else {
        return String::new();
    };
    extract_diffable_text_from_bytes(file_path, &bytes)
}

pub fn extract_diffable_text_from_bytes(file_path: &Path, bytes: &[u8]) -> String {
    if bytes.is_empty() {
        return String::new();
    }
    let ext = file_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    let is_opaque_binary = matches!(
        ext.as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "zip" | "exe" | "dll" | "mp4" | "mov"
    ) || bytes.iter().take(512).any(|&b| b == 0);

    if is_opaque_binary {
        let mut hash: u64 = 0xcbf29ce484222325;
        for &b in bytes {
            hash ^= b as u64;
            hash = hash.wrapping_mul(0x100000001b3);
        }
        let fname = file_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("binary");
        return format!(
            "[Binary file: {} ({} bytes, fnv1a:{:016x})]",
            fname,
            bytes.len(),
            hash
        );
    }

    String::from_utf8_lossy(bytes).replace("\r\n", "\n")
}

