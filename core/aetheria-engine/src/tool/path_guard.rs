//! Workspace Path Isolation Guard for all filesystem tools.
//!
//! Ensures every resolved relative/absolute path stays strictly inside the active workspace directory.

use crate::paths::contains_path;
use std::path::{Path, PathBuf};

pub fn resolve_isolated_path(workspace_dir: &str, raw_file: &str) -> Result<PathBuf, String> {
    let ws_buf = if workspace_dir.trim().is_empty() {
        crate::paths::project_root()
    } else {
        PathBuf::from(workspace_dir)
    };
    let base = ws_buf.as_path();
    let mut clean_raw = raw_file.trim();

    // Deduplicate redundant "workspace/" or "workspace\" prefix when base already ends in "workspace"
    let base_is_workspace = base
        .file_name()
        .and_then(|n| n.to_str())
        .map(|n| n.eq_ignore_ascii_case("workspace"))
        .unwrap_or(false);

    if base_is_workspace {
        while clean_raw.starts_with("workspace/") || clean_raw.starts_with("workspace\\") {
            clean_raw = &clean_raw["workspace/".len()..];
        }
        while clean_raw.starts_with("./workspace/") || clean_raw.starts_with(".\\workspace\\") {
            clean_raw = &clean_raw["./workspace/".len()..];
        }
    }

    let candidate = Path::new(clean_raw);
    let resolved = if candidate.is_absolute() {
        candidate.to_path_buf()
    } else {
        base.join(clean_raw)
    };
    if !contains_path(base, &resolved) {
        return Err(format!(
            "Project Folder Isolation Error: '{}' is outside the active project folder '{}'",
            raw_file, base.display()
        ));
    }
    Ok(resolved)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_isolated_path_deduplicates_workspace_prefix() {
        let ws = "E:\\JS\\ArunakiNexus\\workspace";

        let p1 = resolve_isolated_path(ws, "workspace/src/Root.tsx").unwrap();
        assert_eq!(p1, PathBuf::from("E:\\JS\\ArunakiNexus\\workspace\\src\\Root.tsx"));

        let p2 = resolve_isolated_path(ws, "workspace\\src\\Root.tsx").unwrap();
        assert_eq!(p2, PathBuf::from("E:\\JS\\ArunakiNexus\\workspace\\src\\Root.tsx"));

        let p3 = resolve_isolated_path(ws, "src/Root.tsx").unwrap();
        assert_eq!(p3, PathBuf::from("E:\\JS\\ArunakiNexus\\workspace\\src\\Root.tsx"));

        let p4 = resolve_isolated_path(ws, "./workspace/src/Root.tsx").unwrap();
        assert_eq!(p4, PathBuf::from("E:\\JS\\ArunakiNexus\\workspace\\src\\Root.tsx"));
    }
}

