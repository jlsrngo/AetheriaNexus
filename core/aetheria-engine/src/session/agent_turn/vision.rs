//! Multimodal vision & media processing:
//! - File attachment ingestion (images, audio, video)
//! - Frame extraction via FFmpeg for Vision LLMs
//! - TikTok & YouTube link preview and keyframe extraction

use base64::prelude::*;
use serde_json::Value;
use std::path::{Path, PathBuf};

/// Finds a local FFmpeg binary on PATH or standard engine locations.
pub fn find_ffmpeg_bin() -> Option<PathBuf> {
    crate::paths::locate_ffmpeg_binary()
}

/// Resolves the isolated `ref/` directory inside the currently open project folder.
fn resolve_workspace_ref_dir(workspace_dir: &str) -> PathBuf {
    let dir = crate::tool::path_guard::resolve_isolated_path(workspace_dir, "ref")
        .unwrap_or_else(|_| crate::paths::aetheria_dot_dir().join("scratch").join("ref"));
    let _ = std::fs::create_dir_all(&dir);
    dir
}

/// Ingests attached files from chat payload (images, videos, audio)
pub fn process_attached_files(
    workspace_dir: &str,
    files: Option<&Value>,
    ffmpeg_bin: Option<&Path>,
) -> (Vec<String>, Vec<String>) {
    let mut ocr_transcriptions = Vec::new();
    let mut image_urls = Vec::new();

    let files_arr = match files.and_then(|f| f.as_array()) {
        Some(arr) => arr,
        None => return (ocr_transcriptions, image_urls),
    };

    for file_item in files_arr {
        let file_name = file_item
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("attached_media");
        let uri = file_item
            .get("uri")
            .or_else(|| file_item.get("url"))
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let lower_name = file_name.to_lowercase();

        if uri.starts_with("data:image/") {
            image_urls.push(uri.to_string());
            if let Some(comma_pos) = uri.find(',') {
                let b64_data = &uri[comma_pos + 1..];
                if let Ok(bytes) = BASE64_STANDARD.decode(b64_data.trim()) {
                    let ref_dir = resolve_workspace_ref_dir(workspace_dir);
                    let clean_name = file_name
                        .replace(|c: char| !c.is_alphanumeric() && c != '.' && c != '_', "_");
                    let img_path = ref_dir.join(format!("ref_{}", clean_name));
                    if std::fs::write(&img_path, &bytes).is_ok() {
                        ocr_transcriptions.push(format!(
                            "[Reference Image Style Asset: '{}' saved at ref/ref_{} — translate its palette, composition, lighting, and typography into procedural Canvas/WebGL code; NEVER load or draw 'ref/ref_{}' directly as a canvas backdrop/image]",
                            file_name, clean_name, clean_name
                        ));
                    }
                }
            }
        } else if uri.starts_with("data:video/")
            || (uri.starts_with("data:")
                && (lower_name.ends_with(".mp4")
                    || lower_name.ends_with(".mov")
                    || lower_name.ends_with(".webm")
                    || lower_name.ends_with(".mkv")))
        {
            if let Some(comma_pos) = uri.find(',') {
                let b64_data = &uri[comma_pos + 1..];
                if let Ok(bytes) = BASE64_STANDARD.decode(b64_data.trim()) {
                    let ref_dir = resolve_workspace_ref_dir(workspace_dir);
                    let clean_name = file_name
                        .replace(|c: char| !c.is_alphanumeric() && c != '.' && c != '_', "_");
                    let vid_path = ref_dir.join(format!("ref_{}", clean_name));
                    let ref_wav = ref_dir.join("ref_voice.wav");
                    if std::fs::write(&vid_path, &bytes).is_ok() {
                        if let Some(ff) = ffmpeg_bin {
                            // Extract reference voice audio track (24kHz mono WAV)
                            let mut ff_audio = std::process::Command::new(ff);
                            crate::paths::configure_hidden_std_command(&mut ff_audio);
                            let _ = ff_audio
                                .args([
                                    "-y",
                                    "-hide_banner",
                                    "-loglevel",
                                    "error",
                                    "-i",
                                    &vid_path.to_string_lossy(),
                                    "-vn",
                                    "-ac",
                                    "1",
                                    "-ar",
                                    "24000",
                                    &ref_wav.to_string_lossy(),
                                ])
                                .output();

                            // Extract 4 visual style keyframes at normalized ratios [10%, 35%, 60%, 85%] (default 10s span) for Vision LLM
                            let sample_points = super::social_links::compute_relative_sample_timestamps(10.0);
                            for (idx, (_ratio, ts)) in sample_points.iter().enumerate() {
                                let frame_jpg = ref_dir.join(format!("ref_frame_{}.jpg", idx + 1));
                                let mut ff_frame = std::process::Command::new(ff);
                                crate::paths::configure_hidden_std_command(&mut ff_frame);
                                if ff_frame
                                    .args([
                                        "-y",
                                        "-hide_banner",
                                        "-loglevel",
                                        "error",
                                        "-ss",
                                        ts.as_str(),
                                        "-i",
                                        &vid_path.to_string_lossy(),
                                        "-frames:v",
                                        "1",
                                        "-q:v",
                                        "4",
                                        &frame_jpg.to_string_lossy(),
                                    ])
                                    .output()
                                    .map(|o| o.status.success())
                                    .unwrap_or(false)
                                {
                                    if let Ok(jpg_bytes) = std::fs::read(&frame_jpg) {
                                        if !jpg_bytes.is_empty() {
                                            let b64_jpg = BASE64_STANDARD.encode(&jpg_bytes);
                                            image_urls.push(format!("data:image/jpeg;base64,{}", b64_jpg));
                                        }
                                    }
                                }
                            }
                        }
                        ocr_transcriptions.push(format!(
                            "[Reference Video Style & Voice Asset: '{}' saved at ref/ref_{} with keyframes ref/ref_frame_1.jpg..ref/ref_frame_4.jpg at normalized ratios [10%, 35%, 60%, 85%]. Visual keyframes have been attached for style matching, and its voice track is extracted at 'ref/ref_voice.wav'. Only clone it (refAudio + cloneVoice: true) if it is the user's own voice or they confirmed permission; otherwise describe its tone in voiceDesign.]",
                            file_name, clean_name
                        ));
                    }
                }
            }
        } else if uri.starts_with("data:audio/")
            || (uri.starts_with("data:")
                && (lower_name.ends_with(".wav")
                    || lower_name.ends_with(".mp3")
                    || lower_name.ends_with(".m4a")
                    || lower_name.ends_with(".ogg")))
        {
            if let Some(comma_pos) = uri.find(',') {
                let b64_data = &uri[comma_pos + 1..];
                if let Ok(bytes) = BASE64_STANDARD.decode(b64_data.trim()) {
                    let ref_dir = resolve_workspace_ref_dir(workspace_dir);
                    let clean_name = file_name
                        .replace(|c: char| !c.is_alphanumeric() && c != '.' && c != '_', "_");
                    let raw_audio = ref_dir.join(format!("ref_{}", clean_name));
                    let ref_wav = ref_dir.join("ref_voice.wav");
                    if std::fs::write(&raw_audio, &bytes).is_ok() {
                        if let Some(ff) = ffmpeg_bin {
                            let mut ff_norm = std::process::Command::new(ff);
                            crate::paths::configure_hidden_std_command(&mut ff_norm);
                            let _ = ff_norm
                                .args([
                                    "-y",
                                    "-hide_banner",
                                    "-loglevel",
                                    "error",
                                    "-i",
                                    &raw_audio.to_string_lossy(),
                                    "-ac",
                                    "1",
                                    "-ar",
                                    "24000",
                                    &ref_wav.to_string_lossy(),
                                ])
                                .output();
                        } else {
                            let _ = std::fs::copy(&raw_audio, &ref_wav);
                        }
                        ocr_transcriptions.push(format!(
                            "[Reference Voice Audio Asset: '{}' normalized to 'ref/ref_voice.wav'. If this is the user's own recording (or they confirmed permission), pass refAudio: \"ref/ref_voice.wav\" with cloneVoice: true to voicebox_speak; otherwise describe its tone in voiceDesign.]",
                            file_name
                        ));
                    }
                }
            }
        } else if !uri.is_empty() {
            if let Ok(candidate) = crate::tool::path_guard::resolve_isolated_path(workspace_dir, uri) {
                if candidate.exists() {
                    ocr_transcriptions.push(format!(
                        "[Attached Media Asset: {} at {}]",
                        file_name,
                        candidate.display()
                    ));
                }
            }
        }
    }

    (ocr_transcriptions, image_urls)
}

/// Removes `_vision_images` from a tool result before serialization and appends valid image data URLs.
pub(crate) fn extract_tool_vision_images(tool_out: &mut Value, collected: &mut Vec<String>) {
    let imgs = tool_out
        .as_object_mut()
        .and_then(|obj| obj.remove("_vision_images"))
        .and_then(|v| match v {
            Value::Array(arr) => Some(arr),
            _ => None,
        })
        .unwrap_or_default();
    for item in imgs {
        if let Some(url) = item.as_str() {
            if url.starts_with("data:image/") {
                collected.push(url.to_string());
            }
        }
    }
}

/// Appends a multimodal user inspection message containing images returned by tools (e.g. `capture_film_preview`)
/// only when `model_supports_vision` is true.
pub(crate) fn append_tool_vision_message(
    chat_messages: &mut Vec<Value>,
    model_supports_vision: bool,
    images: Vec<String>,
) {
    if !model_supports_vision || images.is_empty() {
        return;
    }
    let mut parts = vec![serde_json::json!({
        "type": "text",
        "text": "[Visual Inspection Images attached from tool execution. Examine composition, colors, lighting, typography, and layout, and compare against any user reference images/links before finalizing or making edits.]"
    })];
    for url in images {
        parts.push(serde_json::json!({
            "type": "image_url",
            "image_url": { "url": url }
        }));
    }
    chat_messages.push(serde_json::json!({
        "role": "user",
        "content": parts
    }));
}

pub use super::social_links::process_social_links;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_and_strips_tool_vision_images() {
        let mut tool_out = serde_json::json!({
            "ok": true,
            "output": "Captured preview",
            "_vision_images": ["data:image/jpeg;base64,AAAA"]
        });
        let mut collected = Vec::new();
        extract_tool_vision_images(&mut tool_out, &mut collected);
        assert!(tool_out.get("_vision_images").is_none());
        assert_eq!(collected, vec!["data:image/jpeg;base64,AAAA".to_string()]);

        let mut msgs = Vec::new();
        append_tool_vision_message(&mut msgs, true, collected.clone());
        assert_eq!(msgs.len(), 1);
        assert_eq!(msgs[0].get("role").and_then(|v| v.as_str()), Some("user"));
        assert_eq!(
            msgs[0].pointer("/content/1/image_url/url").and_then(|v| v.as_str()),
            Some("data:image/jpeg;base64,AAAA")
        );

        let mut text_only_msgs = Vec::new();
        append_tool_vision_message(&mut text_only_msgs, false, collected);
        assert!(text_only_msgs.is_empty());
    }
}

