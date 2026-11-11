//! External binary discovery helpers for headless Chromium (Edge/Chrome) and FFmpeg.

use crate::paths::{aetheria_dot_dir, home_dir, project_root};
use std::path::PathBuf;

/// Finds a Chromium build (Edge or Chrome) the headless CDP exporter can drive.
/// Edge ships with every Windows 10/11; Chrome is the fallback.
pub fn detect_browser_executable() -> Option<PathBuf> {
    let base = |key: &str| {
        std::env::var(key)
            .ok()
            .filter(|value| !value.trim().is_empty())
            .map(PathBuf::from)
    };

    let browsers = [
        ("Microsoft", "Edge", "msedge.exe"),
        ("Google", "Chrome", "chrome.exe"),
    ];

    let mut candidates = Vec::new();
    for root in ["PROGRAMFILES(X86)", "PROGRAMFILES", "LOCALAPPDATA"] {
        if let Some(root) = base(root) {
            for (vendor, product, exe) in browsers {
                candidates.push(root.join(vendor).join(product).join("Application").join(exe));
            }
        }
    }

    candidates.into_iter().find(|path| path.is_file())
}

/// Locates an `ffmpeg` executable without relying on Node.js.
/// Checks `AETHERIA_FFMPEG`, `PATH`, user `.aetheria/bin`, repo/app `bin/`, and common Windows installs.
pub fn locate_ffmpeg_binary() -> Option<PathBuf> {
    if let Ok(explicit) = std::env::var("AETHERIA_FFMPEG") {
        let trimmed = explicit.trim();
        if !trimmed.is_empty() {
            let p = PathBuf::from(trimmed);
            if p.is_file() {
                return Some(p);
            }
        }
    }

    let bin_name = if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" };
    if let Some(path_os) = std::env::var_os("PATH") {
        for dir in std::env::split_paths(&path_os) {
            let candidate = dir.join(bin_name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }

    let root = project_root();
    let mut fixed = vec![
        aetheria_dot_dir().join("bin").join(bin_name),
        root.join("bin").join(bin_name),
        root.join(bin_name),
    ];

    if cfg!(windows) {
        if let Ok(local_app) = std::env::var("LOCALAPPDATA") {
            let local = PathBuf::from(&local_app);
            fixed.push(local.join("Microsoft").join("WinGet").join("Links").join("ffmpeg.exe"));
            let winget_pkgs = local.join("Microsoft").join("WinGet").join("Packages");
            if let Ok(pkgs) = std::fs::read_dir(&winget_pkgs) {
                for pkg in pkgs.flatten() {
                    let pkg_name = pkg.file_name().to_string_lossy().to_lowercase();
                    if pkg_name.contains("ffmpeg") {
                        let direct = pkg.path().join("bin").join("ffmpeg.exe");
                        if direct.is_file() {
                            fixed.push(direct);
                        }
                        if let Ok(subs) = std::fs::read_dir(pkg.path()) {
                            for sub in subs.flatten() {
                                let nested = sub.path().join("bin").join("ffmpeg.exe");
                                if nested.is_file() {
                                    fixed.push(nested);
                                }
                            }
                        }
                    }
                }
            }
        }
        let user = home_dir();
        fixed.push(user.join("scoop").join("shims").join("ffmpeg.exe"));
        fixed.push(PathBuf::from("C:\\ffmpeg\\bin\\ffmpeg.exe"));
    }

    fixed.into_iter().find(|p| p.is_file())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_browser_returns_existing_file() {
        if let Some(path) = detect_browser_executable() {
            assert!(
                path.is_file(),
                "detected browser {} does not exist",
                path.display()
            );
        }
    }
}

