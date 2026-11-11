//! FFmpeg MP4 video + multi-track scene audio muxing command builder (pure Rust CLI pipe).

use super::film_inspector::FilmMeta;
use crate::paths::contains_path;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tokio::io::AsyncReadExt;

fn find_scene_audio_file(film_root: &Path, ws_root: &Path, raw_audio: &str) -> Option<PathBuf> {
    let clean = raw_audio.trim().trim_start_matches('/').replace('\\', "/");
    if clean.is_empty() || clean.contains("..") {
        return None;
    }
    for root in [film_root, &film_root.join("public"), ws_root] {
        let candidate = root.join(&clean);
        if contains_path(root, &candidate) && candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

/// Constructs an FFmpeg `image2pipe` MP4 encoding command with synchronized scene audio mixing.
pub fn build_ffmpeg_command(
    ffmpeg_bin: &Path,
    meta: &FilmMeta,
    film_root: &Path,
    ws_root: &Path,
    start_sec: f64,
    end_sec: f64,
    codec: &str,
    output_path: &Path,
) -> tokio::process::Command {
    let mut cmd = tokio::process::Command::new(ffmpeg_bin);
    cmd.args(["-y", "-f", "image2pipe", "-vcodec", "mjpeg", "-framerate"])
        .arg(meta.fps.max(1).to_string())
        .args(["-i", "pipe:0"]);

    let mut active_audios: Vec<(PathBuf, u64, f64, f64)> = Vec::new();
    for scene in &meta.scenes {
        let Some(ref audio_rel) = scene.audio else {
            continue;
        };
        let Some(audio_path) = find_scene_audio_file(film_root, ws_root, audio_rel) else {
            continue;
        };
        let sc_start = scene.start.max(0.0);
        let sc_end = sc_start + scene.duration.max(0.0);
        if sc_end <= start_sec || sc_start >= end_sec {
            continue;
        }
        let trim_start = (start_sec - sc_start).max(0.0);
        let max_dur = (end_sec - sc_start.max(start_sec)).max(0.05);
        let delay_ms = ((sc_start - start_sec).max(0.0) * 1000.0).round() as u64;
        active_audios.push((audio_path, delay_ms, trim_start, max_dur));
    }

    for (audio_path, _, _, _) in &active_audios {
        cmd.arg("-i").arg(audio_path);
    }

    if !active_audios.is_empty() {
        let mut filter_parts = Vec::with_capacity(active_audios.len() + 1);
        let mut mix_labels = Vec::with_capacity(active_audios.len());
        for (idx, (_, delay_ms, trim_start, max_dur)) in active_audios.iter().enumerate() {
            let input_idx = idx + 1;
            let label = format!("[a{}]", idx);
            filter_parts.push(format!(
                "[{}:a]atrim=start={:.4}:duration={:.4},asetpts=PTS-STARTPTS,adelay={}|{}{}",
                input_idx, trim_start, max_dur, delay_ms, delay_ms, label
            ));
            mix_labels.push(label);
        }
        filter_parts.push(format!(
            "{}amix=inputs={}:duration=longest:normalize=0[aout]",
            mix_labels.join(""),
            active_audios.len()
        ));
        cmd.args(["-filter_complex", &filter_parts.join(";")])
            .args(["-map", "0:v", "-map", "[aout]", "-c:a", "aac", "-b:a", "192k"]);
    } else {
        cmd.args(["-map", "0:v", "-an"]);
    }

    match codec.to_lowercase().as_str() {
        "h265" | "hevc" => {
            cmd.args(["-c:v", "libx265", "-pix_fmt", "yuv420p", "-preset", "fast"]);
        }
        "vp9" => {
            cmd.args(["-c:v", "libvpx-vp9", "-pix_fmt", "yuv420p"]);
        }
        "prores" => {
            cmd.args(["-c:v", "prores_ks", "-profile:v", "3"]);
        }
        _ => {
            cmd.args([
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-preset",
                "fast",
                "-crf",
                "18",
                "-movflags",
                "+faststart",
            ]);
        }
    }

    cmd.arg("-shortest")
        .arg(output_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd
}

pub async fn format_ffmpeg_failure(
    status: std::process::ExitStatus,
    ff_stderr: Option<tokio::process::ChildStderr>,
) -> String {
    let mut err_txt = String::new();
    if let Some(mut se) = ff_stderr {
        let _ = se.read_to_string(&mut err_txt).await;
    }
    let tail: Vec<&str> = err_txt.lines().rev().take(12).collect();
    let summary: String = tail.into_iter().rev().collect::<Vec<_>>().join("\n");
    format!("FFmpeg exited with {:?}:\n{}", status.code(), summary)
}

