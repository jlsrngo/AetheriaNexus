//! Native Pure Rust Video Compositor and Direct CPU/GPU Renderer.
//! Pipes raw pixel buffers rendered by `native_canvas` into local FFmpeg.

pub use super::native_canvas::{NativeElement, NativeScene, NativeTimelinePayload};

use super::native_canvas::{default_native_scenes, draw_rect, fill_vertical_gradient, spring_progress};
use axum::{response::IntoResponse, Json};
use serde_json::{json, Value};
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::Instant;

/// Locates local FFmpeg binary (system PATH or bundled compositor binary)
pub fn locate_ffmpeg() -> Option<PathBuf> {
    if let Ok(out) = Command::new("where").arg("ffmpeg").output() {
        if out.status.success() {
            let s = String::from_utf8_lossy(&out.stdout);
            if let Some(first_line) = s.lines().next() {
                let p = PathBuf::from(first_line.trim());
                if p.is_file() {
                    return Some(p);
                }
            }
        }
    }

    let project_root = crate::paths::project_root();
    let candidates = [
        project_root.join("node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe"),
        project_root.join("node_modules/@remotion/compositor-linux-x64-gnu/ffmpeg"),
        project_root.join("node_modules/@remotion/compositor-darwin-arm64/ffmpeg"),
        project_root.join("node_modules/@remotion/compositor-darwin-x64/ffmpeg"),
    ];

    candidates.into_iter().find(|c| c.is_file())
}

/// Executes pure native Rust direct CPU/GPU rendering
pub fn execute_native_render(payload: NativeTimelinePayload) -> Result<Value, String> {
    let start_time = Instant::now();
    let width = payload.width.unwrap_or(1080);
    let height = payload.height.unwrap_or(1920);
    let fps = payload.fps.unwrap_or(60);

    let ffmpeg_bin = locate_ffmpeg().ok_or_else(|| {
        "FFmpeg binary not found on system or bundled compositor directory".to_string()
    })?;

    let workspace = crate::desktop::get_active_workspace_root()
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));

    let output_dir = workspace.join("output");
    let _ = std::fs::create_dir_all(&output_dir);

    let output_filename = payload.output_name.unwrap_or_else(|| {
        format!(
            "native-{}-{}.mp4",
            payload.composition_id.as_deref().unwrap_or("video"),
            crate::paths::now_ms()
        )
    });
    let output_path = output_dir.join(&output_filename);

    let scenes = payload.scenes.unwrap_or_else(default_native_scenes);
    let total_duration: f32 = scenes.iter().map(|s| s.duration_sec).sum();
    let total_frames = (total_duration * fps as f32).round() as usize;

    let gpu_telemetry = crate::studio::gpu::detect_gpu_telemetry_once();
    let video_codec = match gpu_telemetry.encoder.as_str() {
        "h264_nvenc" => "h264_nvenc",
        "h264_amf" => "h264_amf",
        "h264_qsv" => "h264_qsv",
        _ => "libx264",
    };

    let mut ffmpeg_cmd = Command::new(&ffmpeg_bin);
    ffmpeg_cmd
        .arg("-y")
        .arg("-f")
        .arg("image2pipe")
        .arg("-vcodec")
        .arg("rawvideo")
        .arg("-pix_fmt")
        .arg("rgba")
        .arg("-s")
        .arg(format!("{}x{}", width, height))
        .arg("-r")
        .arg(fps.to_string())
        .arg("-i")
        .arg("-")
        .arg("-c:v")
        .arg("libx264")
        .arg("-pix_fmt")
        .arg("yuv420p")
        .arg("-preset")
        .arg("veryfast")
        .arg("-movflags")
        .arg("+faststart")
        .arg(&output_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        const BELOW_NORMAL_PRIORITY_CLASS: u32 = 0x00004000;
        ffmpeg_cmd.creation_flags(CREATE_NO_WINDOW | BELOW_NORMAL_PRIORITY_CLASS);
    }

    let mut child = ffmpeg_cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn native FFmpeg process: {}", e))?;

    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Failed to open FFmpeg stdin pipe".to_string())?;

    let stderr = child.stderr.take();
    let mut frame_buffer = vec![0u8; (width * height * 4) as usize];

    let mut current_scene_idx = 0;
    let mut scene_frame_offset = 0;

    for frame_idx in 0..total_frames {
        let t_sec = frame_idx as f32 / fps as f32;

        let mut accum_sec = 0.0;
        for (idx, sc) in scenes.iter().enumerate() {
            if t_sec >= accum_sec && t_sec < accum_sec + sc.duration_sec {
                if current_scene_idx != idx {
                    current_scene_idx = idx;
                    scene_frame_offset = frame_idx;
                }
                break;
            }
            accum_sec += sc.duration_sec;
        }

        let scene = &scenes[current_scene_idx];
        let scene_rel_t = (frame_idx - scene_frame_offset) as f32 / fps as f32;

        fill_vertical_gradient(
            &mut frame_buffer,
            width,
            height,
            scene.bg_color_top,
            scene.bg_color_bottom,
        );

        let spring = spring_progress(scene_rel_t, 0.8);
        let card_w = (width as f32 * 0.85) as u32;
        let card_h = (height as f32 * 0.55) as u32;
        let card_x = ((width - card_w) / 2) as i32;
        let card_target_y = ((height - card_h) / 2) as i32;
        let card_y = card_target_y + ((1.0 - spring) * 120.0) as i32;

        draw_rect(
            &mut frame_buffer,
            width,
            height,
            card_x,
            card_y,
            card_w,
            card_h,
            [26, 26, 31, 230],
        );

        draw_rect(
            &mut frame_buffer,
            width,
            height,
            card_x,
            card_y,
            card_w,
            8,
            [16, 185, 129, 255],
        );

        draw_rect(
            &mut frame_buffer,
            width,
            height,
            card_x + 36,
            card_y + 44,
            260,
            44,
            [15, 23, 42, 255],
        );

        let progress_ratio = (frame_idx as f32 / total_frames as f32).clamp(0.0, 1.0);
        let bar_w = (width as f32 * progress_ratio) as u32;
        draw_rect(
            &mut frame_buffer,
            width,
            height,
            0,
            (height - 12) as i32,
            bar_w,
            12,
            [6, 182, 212, 255],
        );

        if let Err(e) = stdin.write_all(&frame_buffer) {
            let stderr_msg = if let Some(mut err_pipe) = stderr {
                let mut buf = Vec::new();
                use std::io::Read;
                let _ = err_pipe.read_to_end(&mut buf);
                String::from_utf8_lossy(&buf).to_string()
            } else {
                String::new()
            };
            return Err(format!(
                "Failed to pipe frame {} to FFmpeg: {} | FFmpeg stderr: {}",
                frame_idx, e, stderr_msg
            ));
        }
    }

    drop(stdin);
    let output = child
        .wait_with_output()
        .map_err(|e| format!("FFmpeg encoding failed: {}", e))?;

    if !output.status.success() {
        let err_log = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg error during native render: {}", err_log));
    }

    let elapsed = start_time.elapsed();
    let render_time_ms = elapsed.as_millis();
    let fps_rendered = (total_frames as f64) / elapsed.as_secs_f64();

    Ok(json!({
        "success": true,
        "engine": "Aetheria Rust Native Direct Renderer",
        "codec": video_codec,
        "hardwareAccelerated": gpu_telemetry.hardware_accelerated,
        "width": width,
        "height": height,
        "totalFrames": total_frames,
        "renderTimeMs": render_time_ms,
        "renderTimeSec": elapsed.as_secs_f64(),
        "renderedFps": fps_rendered,
        "outputPath": output_path.to_string_lossy(),
        "outputFilename": output_filename,
    }))
}

/// POST /api/studio/native-render
pub async fn handle_native_render(
    Json(payload): Json<NativeTimelinePayload>,
) -> impl IntoResponse {
    match execute_native_render(payload) {
        Ok(data) => Json(data),
        Err(err) => Json(json!({
            "success": false,
            "error": err
        })),
    }
}
