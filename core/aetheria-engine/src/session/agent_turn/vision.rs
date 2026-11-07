//! Multimodal vision & media processing:
//! - File attachment ingestion (images, audio, video)
//! - Frame extraction via FFmpeg for Vision LLMs
//! - TikTok & YouTube link preview and keyframe extraction

use base64::prelude::*;
use serde_json::Value;
use std::path::{Path, PathBuf};

/// Finds the bundled Remotion compositor FFmpeg binary across platforms
pub fn find_ffmpeg_bin() -> Option<PathBuf> {
    let root_dir = crate::paths::project_root();
    [
        root_dir.join("node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe"),
        root_dir.join("node_modules/@remotion/compositor-linux-x64-gnu/ffmpeg"),
        root_dir.join("node_modules/@remotion/compositor-darwin-arm64/ffmpeg"),
        root_dir.join("node_modules/@remotion/compositor-darwin-x64/ffmpeg"),
    ]
    .into_iter()
    .find(|p| p.is_file())
}

/// Ingests attached files from chat payload (images, videos, audio)
pub fn process_attached_files(
    workspace_dir: &str,
    files: Option<&Value>,
    ffmpeg_bin: Option<&Path>,
) -> (Vec<String>, Vec<String>) {
    let mut ocr_transcriptions = Vec::new();
    let mut image_urls = Vec::new();
    let root_dir = crate::paths::project_root();

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
                    let pub_dir = root_dir.join("workspace").join("public");
                    let _ = std::fs::create_dir_all(&pub_dir);
                    let clean_name = file_name
                        .replace(|c: char| !c.is_alphanumeric() && c != '.' && c != '_', "_");
                    let img_path = pub_dir.join(format!("ref_{}", clean_name));
                    if std::fs::write(&img_path, &bytes).is_ok() {
                        ocr_transcriptions.push(format!(
                            "[Reference Image Style Asset: '{}' saved at workspace/public/ref_{} (use staticFile(\"ref_{}\") in Remotion or match its color palette, typography, and layout style)]",
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
                    let pub_dir = root_dir.join("workspace").join("public");
                    let _ = std::fs::create_dir_all(&pub_dir);
                    let clean_name = file_name
                        .replace(|c: char| !c.is_alphanumeric() && c != '.' && c != '_', "_");
                    let vid_path = pub_dir.join(format!("ref_{}", clean_name));
                    let ref_wav = pub_dir.join("ref_voice.wav");
                    if std::fs::write(&vid_path, &bytes).is_ok() {
                        if let Some(ff) = ffmpeg_bin {
                            // Extract reference voice audio track (24kHz mono WAV)
                            let _ = std::process::Command::new(ff)
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

                            // Extract 3 visual style keyframes (1s, 3s, 6s) for Vision LLM
                            for (idx, ts) in ["00:00:01", "00:00:03", "00:00:06"].iter().enumerate() {
                                let frame_jpg = pub_dir.join(format!("ref_frame_{}.jpg", idx + 1));
                                if std::process::Command::new(ff)
                                    .args([
                                        "-y",
                                        "-hide_banner",
                                        "-loglevel",
                                        "error",
                                        "-ss",
                                        ts,
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
                            "[Reference Video Style & Voice Asset: '{}' saved at workspace/public/ref_{}. Visual keyframes have been attached for style matching, and its voice track is extracted at 'workspace/public/ref_voice.wav'. Only clone it (refAudio + cloneVoice: true) if it is the user's own voice or they confirmed permission; otherwise describe its tone in voiceDesign.]",
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
                    let pub_dir = root_dir.join("workspace").join("public");
                    let _ = std::fs::create_dir_all(&pub_dir);
                    let clean_name = file_name
                        .replace(|c: char| !c.is_alphanumeric() && c != '.' && c != '_', "_");
                    let raw_audio = pub_dir.join(format!("ref_{}", clean_name));
                    let ref_wav = pub_dir.join("ref_voice.wav");
                    if std::fs::write(&raw_audio, &bytes).is_ok() {
                        if let Some(ff) = ffmpeg_bin {
                            let _ = std::process::Command::new(ff)
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
                            "[Reference Voice Audio Asset: '{}' normalized to 'workspace/public/ref_voice.wav'. If this is the user's own recording (or they confirmed permission), pass refAudio: \"workspace/public/ref_voice.wav\" with cloneVoice: true to voicebox_speak; otherwise describe its tone in voiceDesign.]",
                            file_name
                        ));
                    }
                }
            }
        } else if !uri.is_empty() {
            let candidate = Path::new(workspace_dir).join(uri);
            if candidate.exists() {
                ocr_transcriptions.push(format!(
                    "[Attached Media Asset: {} at {}]",
                    file_name,
                    candidate.display()
                ));
            }
        }
    }

    (ocr_transcriptions, image_urls)
}

/// Automatically extracts visual keyframes & metadata if prompt contains TikTok or YouTube links
pub async fn process_social_links(
    workspace_dir: &str,
    prompt_text: &str,
    ffmpeg_bin: Option<&Path>,
) -> (Vec<String>, Vec<String>) {
    let mut ocr_transcriptions = Vec::new();
    let mut image_urls = Vec::new();

    for word in prompt_text.split_whitespace() {
        let clean_url = word.trim_matches(|c: char| c == '(' || c == ')' || c == '<' || c == '>' || c == '"' || c == '\'');
        if clean_url.contains("tiktok.com/") {
            if let Ok(resp) = reqwest::Client::new()
                .get("https://www.tikwm.com/api/")
                .query(&[("url", clean_url)])
                .send()
                .await
            {
                if let Ok(json_val) = resp.json::<Value>().await {
                    let data = json_val.get("data").cloned().unwrap_or(Value::Null);
                    let title = data.get("title").and_then(|v| v.as_str()).unwrap_or("");
                    let duration = data.get("duration").and_then(|v| v.as_u64()).unwrap_or(30);
                    let author = data
                        .get("author")
                        .and_then(|a| a.get("unique_id"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("creator");
                    let play_url = data.get("play").and_then(|v| v.as_str()).unwrap_or("");

                    let pub_dir = Path::new(workspace_dir)
                        .join("workspace")
                        .join("public");
                    let _ = std::fs::create_dir_all(&pub_dir);
                    let mp4_path = pub_dir.join("ref_tiktok.mp4");
                    let wav_path = pub_dir.join("ref_voice.wav");

                    if !play_url.is_empty() {
                        if let Ok(vid_resp) = reqwest::get(play_url).await {
                            if let Ok(vid_bytes) = vid_resp.bytes().await {
                                if !vid_bytes.is_empty() {
                                    let _ = std::fs::write(&mp4_path, &vid_bytes);
                                    let ff_cmd = ffmpeg_bin
                                        .unwrap_or_else(|| Path::new("ffmpeg"));
                                    let _ = std::process::Command::new(ff_cmd)
                                        .args([
                                            "-y",
                                            "-i",
                                            &mp4_path.to_string_lossy(),
                                            "-vn",
                                            "-acodec",
                                            "pcm_s16le",
                                            "-ar",
                                            "24000",
                                            "-ac",
                                            "1",
                                            &wav_path.to_string_lossy(),
                                        ])
                                        .output();

                                    for (idx, ts) in ["00:00:01", "00:00:04", "00:00:14"].iter().enumerate() {
                                        let frame_jpg = std::env::temp_dir()
                                            .join(format!("aetheria_tiktok_ref_{}.jpg", idx));
                                        let _ = std::process::Command::new(ff_cmd)
                                            .args([
                                                "-y",
                                                "-ss",
                                                ts,
                                                "-i",
                                                &mp4_path.to_string_lossy(),
                                                "-frames:v",
                                                "1",
                                                "-q:v",
                                                "4",
                                                &frame_jpg.to_string_lossy(),
                                            ])
                                            .output();
                                        if let Ok(jpg_bytes) = std::fs::read(&frame_jpg) {
                                            let b64 = BASE64_STANDARD.encode(&jpg_bytes);
                                            image_urls.push(format!("data:image/jpeg;base64,{}", b64));
                                        }
                                    }
                                }
                            }
                        }
                    }

                    ocr_transcriptions.push(format!(
                        "[TikTok Reference Video Extracted (@{}, duration: {}s, title: \"{}\"):\n\
                        - Reference Video Saved: workspace/public/ref_tiktok.mp4\n\
                        - Reference Voice Track Extracted: workspace/public/ref_voice.wav. When the user requests matching or using this voice sample, pass `refAudio: \"workspace/public/ref_voice.wav\"` and `cloneVoice: true` to `voicebox_speak` so Voicebox clones the speaker's exact vocal timbre and intonation!\n\
                        - Keyframes attached to vision context: study the reference's motion language (entrance/exit choreography, camera moves, layout zones, typography hierarchy, palette) and translate it into this video's own style per the Visual Style System — inspired by, never a pixel copy.]",
                        author, duration, title
                    ));
                }
            }
            continue;
        }

        let yt_id = if let Some(idx) = clean_url.find("youtube.com/watch?v=") {
            clean_url[idx + 20..].split(&['&', '#', '?'][..]).next()
        } else if let Some(idx) = clean_url.find("youtu.be/") {
            clean_url[idx + 9..].split(&['&', '#', '?'][..]).next()
        } else if let Some(idx) = clean_url.find("youtube.com/shorts/") {
            clean_url[idx + 19..].split(&['&', '#', '?'][..]).next()
        } else {
            None
        };
        if let Some(vid_id) = yt_id.filter(|id| id.len() >= 8) {
            let thumb_url = format!("https://i.ytimg.com/vi/{}/hqdefault.jpg", vid_id);
            if let Ok(resp) = reqwest::get(&thumb_url).await {
                if let Ok(bytes) = resp.bytes().await {
                    if !bytes.is_empty() {
                        let b64 = BASE64_STANDARD.encode(&bytes);
                        image_urls.push(format!("data:image/jpeg;base64,{}", b64));
                        ocr_transcriptions.push(format!(
                            "[Reference Video Link Detected (YouTube ID: {}): Visual reference frame attached to vision context — match its aesthetic, color palette, typography, and motion pacing!]",
                            vid_id
                        ));
                    }
                }
            }
        }
    }

    (ocr_transcriptions, image_urls)
}

