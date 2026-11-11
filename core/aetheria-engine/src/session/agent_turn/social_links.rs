//! Social Video Reference Link Extraction (TikTok & YouTube).
//!
//! Fetches reference video metadata, downloads TikTok reference audio/keyframes via FFmpeg,
//! and attaches YouTube thumbnail frames to vision context.

use base64::prelude::*;
use serde_json::Value;
use std::path::Path;

/// Automatically extracts visual keyframes & metadata if prompt contains TikTok or YouTube links.
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

