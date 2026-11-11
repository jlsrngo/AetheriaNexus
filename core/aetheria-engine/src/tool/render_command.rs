//! Remotion Render Command & Bundle Sync Builder.
//! Computes bundle mtime cache stamps, optimal CPU concurrency, asset sync into the
//! cached Remotion bundle, and OS process command configuration for `scripts/render.mjs`.

use std::path::Path;
use std::process::Command;
use std::time::UNIX_EPOCH;

pub const DEFAULT_COMPOSITION: &str = "NexusEditorialVideo";

#[derive(Default, Clone, Debug)]
pub struct RenderOptions {
    pub codec: Option<String>,
    pub frame_range: Option<(u32, u32)>,
    pub concurrency: Option<usize>,
}

/// Fast native Rust directory mtime scanner for `workspace/src` and `apps/src/remotion` so Node.js
/// does not have to recursively stat files synchronously before every render.
pub fn compute_remotion_bundle_stamp(root: &Path) -> String {
    let remotion_dir = root.join("apps").join("src").join("remotion");
    let workspace_dir = root.join("workspace").join("src");
    let newest = newest_mtime_ms(&remotion_dir).max(newest_mtime_ms(&workspace_dir));
    format!("{}", newest)
}

fn newest_mtime_ms(dir: &Path) -> u128 {
    let mut newest: u128 = 0;
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                newest = newest.max(newest_mtime_ms(&path));
            } else if let Ok(meta) = entry.metadata() {
                if let Ok(modified) = meta.modified() {
                    if let Ok(dur) = modified.duration_since(UNIX_EPOCH) {
                        newest = newest.max(dur.as_millis());
                    }
                }
            }
        }
    }
    newest
}

/// Detects optimal multi-core thread count in Rust (`available_parallelism`).
pub fn optimal_render_concurrency() -> usize {
    std::thread::available_parallelism()
        .map(|n| n.get().clamp(4, 16))
        .unwrap_or(6)
}

/// Fast native Rust sync of `workspace/public` (including subdirectories like `sfx/`)
/// into the cached Remotion bundle's `public/` directory so `staticFile(...)` assets never 404.
pub fn sync_workspace_public_to_bundle(root: &Path) {
    let bundle_pub = crate::paths::render_cache_dir().join("public");
    let _ = std::fs::create_dir_all(&bundle_pub);

    // Also copy root/public/sfx into workspace/public/sfx if present
    let root_sfx = root.join("public").join("sfx");
    let ws_sfx = root.join("workspace").join("public").join("sfx");
    if root_sfx.is_dir() {
        let _ = copy_dir_recursive_if_newer(&root_sfx, &ws_sfx);
    }

    let ws_pub = root.join("workspace").join("public");
    if ws_pub.is_dir() {
        let _ = copy_dir_recursive_if_newer(&ws_pub, &bundle_pub);
    }
}

fn copy_dir_recursive_if_newer(src: &Path, dst: &Path) -> std::io::Result<()> {
    let _ = std::fs::create_dir_all(dst);
    for entry in std::fs::read_dir(src)?.flatten() {
        let path = entry.path();
        let Some(name) = path.file_name() else { continue };
        let dest = dst.join(name);
        if path.is_dir() {
            let _ = copy_dir_recursive_if_newer(&path, &dest);
        } else if path.is_file() {
            let should_copy = match (std::fs::metadata(&path), std::fs::metadata(&dest)) {
                (Ok(src_m), Ok(dst_m)) => {
                    src_m.len() != dst_m.len() || src_m.modified().ok() != dst_m.modified().ok()
                }
                (Ok(_), Err(_)) => true,
                _ => false,
            };
            if should_copy {
                let _ = std::fs::copy(&path, &dest);
            }
        }
    }
    Ok(())
}

/// Single place that builds the `node scripts/render.mjs` invocation with Rust-computed
/// bundle stamp, multi-core concurrency, codec, and hardware acceleration flags.
pub fn build_command(
    root: &Path,
    composition: &str,
    props: &str,
    output: Option<&Path>,
) -> Command {
    build_command_with_options(root, composition, props, output, &RenderOptions::default())
}

pub fn build_command_with_options(
    root: &Path,
    composition: &str,
    props: &str,
    output: Option<&Path>,
    opts: &RenderOptions,
) -> Command {
    let concurrency = opts.concurrency.unwrap_or_else(optimal_render_concurrency);
    let stamp = compute_remotion_bundle_stamp(root);
    let codec = opts.codec.as_deref().unwrap_or("h264");

    let mut cmd = Command::new("node");
    cmd.current_dir(root)
        .arg(root.join("scripts").join("render.mjs"))
        .arg("--composition")
        .arg(composition)
        .arg("--props")
        .arg(props)
        .arg("--bundle-dir")
        .arg(crate::paths::render_cache_dir())
        .arg("--bundle-stamp")
        .arg(stamp)
        .arg("--concurrency")
        .arg(concurrency.to_string())
        .arg("--codec")
        .arg(codec);

    if let Some((start_f, end_f)) = opts.frame_range {
        cmd.arg("--frames").arg(format!("{}-{}", start_f, end_f));
    }

    if let Some(browser) = crate::paths::detect_browser_executable() {
        cmd.arg("--browser-executable").arg(browser);
    }

    if let Some(output) = output {
        cmd.arg("--output").arg(output);
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        // 0x00004000 = BELOW_NORMAL_PRIORITY_CLASS: Render worker runs at lower OS priority
        // so foreground browser preview and UI remain 100% responsive without lagging.
        const BELOW_NORMAL_PRIORITY_CLASS: u32 = 0x00004000;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(BELOW_NORMAL_PRIORITY_CLASS | CREATE_NO_WINDOW);
    }

    cmd
}

