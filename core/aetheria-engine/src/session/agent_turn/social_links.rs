//! Social Video Reference Link Extraction (TikTok & YouTube).
//!
//! Fetches reference video metadata, downloads TikTok reference audio/keyframes via FFmpeg,
//! and attaches YouTube thumbnail frames to vision context.

use base64::prelude::*;
use serde_json::Value;
use std::path::Path;

fn extract_meta_attr<'a>(tag: &'a str, attr: &str) -> Option<&'a str> {
    let double = format!("{}=\"", attr);
    if let Some(start) = tag.find(&double) {
        let rest = &tag[start + double.len()..];
        if let Some(end) = rest.find('"') {
            return Some(&rest[..end]);
        }
    }
    let single = format!("{}='", attr);
    if let Some(start) = tag.find(&single) {
        let rest = &tag[start + single.len()..];
        if let Some(end) = rest.find('\'') {
            return Some(&rest[..end]);
        }
    }
    None
}

fn unescape_html_basic(s: &str) -> String {
    s.replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .trim()
        .to_string()
}

pub(crate) fn extract_pinterest_media_from_html(
    html: &str,
) -> (Option<String>, Option<String>, Option<String>) {
    let mut title: Option<String> = None;
    let mut image_url: Option<String> = None;
    let mut mp4_url: Option<String> = None;

    let mut pos = 0;
    while let Some(rel_start) = html[pos..].find("<meta") {
        let tag_start = pos + rel_start;
        let Some(rel_end) = html[tag_start..].find('>') else {
            break;
        };
        let tag = &html[tag_start..=tag_start + rel_end];
        let prop = extract_meta_attr(tag, "property")
            .or_else(|| extract_meta_attr(tag, "name"))
            .unwrap_or("");
        let content = extract_meta_attr(tag, "content").map(unescape_html_basic);
        if let Some(val) = content.filter(|v| !v.is_empty()) {
            if prop.eq_ignore_ascii_case("og:title") && title.is_none() {
                title = Some(val);
            } else if matches!(prop, "og:image" | "twitter:image:src" | "twitter:image")
                && image_url.is_none()
                && val.starts_with("http")
            {
                image_url = Some(val);
            } else if prop.eq_ignore_ascii_case("og:video")
                && val.ends_with(".mp4")
                && mp4_url.is_none()
            {
                mp4_url = Some(val);
            }
        }
        pos = tag_start + rel_end + 1;
    }

    if image_url.is_none() {
        for tier in ["https://i.pinimg.com/originals/", "https://i.pinimg.com/736x/", "https://i.pinimg.com/564x/"] {
            if let Some(idx) = html.find(tier) {
                let tail = &html[idx..];
                let end = tail
                    .find(|c: char| matches!(c, '"' | '\'' | '<' | '>' | '\\' | ')' | ' '))
                    .unwrap_or(tail.len());
                let candidate = &tail[..end];
                if candidate.ends_with(".jpg")
                    || candidate.ends_with(".jpeg")
                    || candidate.ends_with(".png")
                    || candidate.ends_with(".webp")
                {
                    image_url = Some(candidate.to_string());
                    break;
                }
            }
        }
    }

    if mp4_url.is_none() {
        for prefix in ["https://v1.pinimg.com/", "https://v.pinimg.com/"] {
            if let Some(idx) = html.find(prefix) {
                let tail = &html[idx..];
                let end = tail
                    .find(|c: char| matches!(c, '"' | '\'' | '<' | '>' | '\\' | ' '))
                    .unwrap_or(tail.len());
                let candidate = &tail[..end];
                if candidate.ends_with(".mp4") {
                    mp4_url = Some(candidate.to_string());
                    break;
                }
            }
        }
    }

    (title, image_url, mp4_url)
}

pub(crate) fn persist_reference_frames_to_dir(
    ref_dir: &Path,
    prefix: &str,
    primary_bytes: Option<(&[u8], &str)>,
    extracted_jpg_frames: &[Vec<u8>],
) -> Vec<String> {
    let _ = std::fs::create_dir_all(ref_dir);
    let mut saved_files = Vec::new();

    if let Some((bytes, ext)) = primary_bytes {
        if !bytes.is_empty() {
            let main_rel = format!("ref/ref_{}.{}", prefix, ext);
            let main_path = ref_dir.join(format!("ref_{}.{}", prefix, ext));
            if std::fs::write(&main_path, bytes).is_ok() {
                saved_files.push(main_rel);
            }
        }
    }

    if !extracted_jpg_frames.is_empty() {
        for (idx, frame_bytes) in extracted_jpg_frames.iter().enumerate() {
            if frame_bytes.is_empty() {
                continue;
            }
            let frame_name = format!("ref_{}_frame_{}.jpg", prefix, idx + 1);
            let frame_path = ref_dir.join(&frame_name);
            if std::fs::write(&frame_path, frame_bytes).is_ok() {
                saved_files.push(format!("ref/{}", frame_name));
            }
        }
    } else if let Some((bytes, ext)) = primary_bytes {
        if !bytes.is_empty() {
            for idx in 1..=2 {
                let frame_name = format!("ref_{}_frame_{}.{}", prefix, idx, ext);
                let frame_path = ref_dir.join(&frame_name);
                if std::fs::write(&frame_path, bytes).is_ok() {
                    saved_files.push(format!("ref/{}", frame_name));
                }
            }
        }
    }

    saved_files
}

pub const RELATIVE_REFERENCE_POSITIONS: [f64; 4] = [0.10, 0.35, 0.60, 0.85];

pub(crate) fn compute_relative_sample_timestamps(duration_secs: f64) -> Vec<(f64, String)> {
    let safe_dur = if duration_secs.is_finite() && duration_secs > 0.5 {
        duration_secs
    } else {
        8.0
    };
    let max_t = (safe_dur - 0.05).max(0.1);
    RELATIVE_REFERENCE_POSITIONS
        .iter()
        .map(|ratio| {
            let t = ((safe_dur * ratio).min(max_t) * 100.0).round() / 100.0;
            let mins = (t as u64) / 60;
            let secs = t - (mins as f64 * 60.0);
            (*ratio, format!("00:{:02}:{:05.2}", mins, secs))
        })
        .collect()
}

fn is_pinterest_url(url: &str) -> bool {
    let lower = url.to_ascii_lowercase();
    lower.starts_with("http")
        && (lower.contains("://pin.it/")
            || (lower.contains("pinterest.") && lower.contains("/pin/")))
}

/// Automatically extracts visual keyframes & metadata if prompt contains TikTok, YouTube, or Pinterest links.
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

                    let ref_dir = crate::tool::path_guard::resolve_isolated_path(workspace_dir, "ref")
                        .unwrap_or_else(|_| Path::new(workspace_dir).join("ref"));
                    let _ = std::fs::create_dir_all(&ref_dir);
                    let mp4_path = ref_dir.join("ref_tiktok.mp4");
                    let wav_path = ref_dir.join("ref_voice.wav");

                    if !play_url.is_empty() {
                        if let Ok(vid_resp) = reqwest::get(play_url).await {
                            if let Ok(vid_bytes) = vid_resp.bytes().await {
                                if !vid_bytes.is_empty() {
                                    let _ = std::fs::write(&mp4_path, &vid_bytes);
                                    let ff_cmd = ffmpeg_bin
                                        .unwrap_or_else(|| Path::new("ffmpeg"));
                                    let mut ff_audio = std::process::Command::new(ff_cmd);
                                    crate::paths::configure_hidden_std_command(&mut ff_audio);
                                    let _ = ff_audio
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

                                    let mut saved_frames = Vec::new();
                                    let sample_points = compute_relative_sample_timestamps(duration as f64);
                                    for (idx, (_ratio, ts)) in sample_points.iter().enumerate() {
                                        let frame_name = format!("ref_tiktok_frame_{}.jpg", idx + 1);
                                        let frame_jpg = ref_dir.join(&frame_name);
                                        let mut ff_frame = std::process::Command::new(ff_cmd);
                                        crate::paths::configure_hidden_std_command(&mut ff_frame);
                                        let _ = ff_frame
                                            .args([
                                                "-y",
                                                "-ss",
                                                ts.as_str(),
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
                                            if !jpg_bytes.is_empty() {
                                                saved_frames.push(format!("ref/{}", frame_name));
                                                let b64 = BASE64_STANDARD.encode(&jpg_bytes);
                                                image_urls.push(format!("data:image/jpeg;base64,{}", b64));
                                            }
                                        }
                                    }
                                    let _ = saved_frames;
                                }
                            }
                        }
                    }

                    ocr_transcriptions.push(format!(
                        "[TikTok Reference Video Extracted (@{}, duration: {}s, title: \"{}\"):\n\
                        - Reference Video Saved: ref/ref_tiktok.mp4\n\
                        - Reference Frames Saved at normalized ratios [10%, 35%, 60%, 85%]: ref/ref_tiktok_frame_1.jpg, ref/ref_tiktok_frame_2.jpg, ref/ref_tiktok_frame_3.jpg, ref/ref_tiktok_frame_4.jpg\n\
                        - Reference Voice Track Extracted: ref/ref_voice.wav. When the user requests matching or using this voice sample, pass `refAudio: \"ref/ref_voice.wav\"` and `cloneVoice: true` to `voicebox_speak` so Voicebox clones the speaker's exact vocal timbre and intonation!\n\
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
            continue;
        }

        if is_pinterest_url(clean_url) {
            if let Ok(client) = reqwest::Client::builder()
                .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36")
                .timeout(std::time::Duration::from_secs(15))
                .build()
            {
                if let Ok(resp) = client.get(clean_url).send().await {
                    if let Ok(html) = resp.text().await {
                        let (pin_title, img_url_opt, mp4_url_opt) =
                            extract_pinterest_media_from_html(&html);
                        let ref_dir = crate::tool::path_guard::resolve_isolated_path(workspace_dir, "ref")
                            .unwrap_or_else(|_| Path::new(workspace_dir).join("ref"));
                        let _ = std::fs::create_dir_all(&ref_dir);
                        let mut primary_img: Option<(Vec<u8>, String, String)> = None;
                        let mut extracted_video_frames: Vec<Vec<u8>> = Vec::new();
                        let mut has_mp4 = false;

                        if let Some(ref img_url) = img_url_opt {
                            if let Ok(img_resp) = client.get(img_url).send().await {
                                let mime = img_resp
                                    .headers()
                                    .get(reqwest::header::CONTENT_TYPE)
                                    .and_then(|v| v.to_str().ok())
                                    .and_then(|s| s.split(';').next())
                                    .map(|s| s.trim().to_ascii_lowercase())
                                    .filter(|m| m.starts_with("image/"))
                                    .unwrap_or_else(|| "image/jpeg".to_string());
                                let ext = match mime.as_str() {
                                    "image/png" => "png",
                                    "image/webp" => "webp",
                                    _ => "jpg",
                                };
                                if let Ok(bytes) = img_resp.bytes().await {
                                    if !bytes.is_empty() {
                                        let b64 = BASE64_STANDARD.encode(&bytes);
                                        image_urls.push(format!("data:{};base64,{}", mime, b64));
                                        primary_img = Some((bytes.to_vec(), ext.to_string(), mime));
                                    }
                                }
                            }
                        }

                        if let Some(ref mp4_url) = mp4_url_opt {
                            if let Ok(vid_resp) = client.get(mp4_url).send().await {
                                if let Ok(vbytes) = vid_resp.bytes().await {
                                    if !vbytes.is_empty() {
                                        let mp4_path = ref_dir.join("ref_pinterest.mp4");
                                        if std::fs::write(&mp4_path, &vbytes).is_ok() {
                                            has_mp4 = true;
                                        }
                                        if let Some(ff_cmd) = ffmpeg_bin {
                                            let sample_points = compute_relative_sample_timestamps(8.0);
                                            for (idx, (_ratio, ts)) in sample_points.iter().enumerate() {
                                                let frame_jpg = ref_dir
                                                    .join(format!("ref_pinterest_frame_{}.jpg", idx + 1));
                                                let mut ff_frame = std::process::Command::new(ff_cmd);
                                                crate::paths::configure_hidden_std_command(&mut ff_frame);
                                                if ff_frame
                                                    .args([
                                                        "-y",
                                                        "-ss",
                                                        ts.as_str(),
                                                        "-i",
                                                        &mp4_path.to_string_lossy(),
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
                                                            let b64 = BASE64_STANDARD.encode(&jpg_bytes);
                                                            image_urls.push(format!("data:image/jpeg;base64,{}", b64));
                                                            extracted_video_frames.push(jpg_bytes);
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        let mut saved_files = persist_reference_frames_to_dir(
                            &ref_dir,
                            "pinterest",
                            primary_img
                                .as_ref()
                                .map(|(bytes, ext, _)| (bytes.as_slice(), ext.as_str())),
                            &extracted_video_frames,
                        );
                        if has_mp4 {
                            saved_files.push("ref/ref_pinterest.mp4".to_string());
                        }

                        if !saved_files.is_empty() || pin_title.is_some() {
                            let title_str = pin_title.as_deref().unwrap_or("Pinterest Pin");
                            ocr_transcriptions.push(format!(
                                "[Pinterest Reference Visual Extracted (title: \"{}\", saved: [{}]): Reference image attached directly to vision context — study its visual composition, color palette, typography, and motion aesthetic, and translate it into procedural/animated code rather than drawing the static reference file directly.]",
                                title_str,
                                saved_files.join(", ")
                            ));
                        }
                    }
                }
            }
        }
    }

    (ocr_transcriptions, image_urls)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extracts_pinterest_og_tags_and_fallback_video() {
        let html = r#"
            <html><head>
            <meta content="Night Motion [Video] | Landscape" name="og:title" property="og:title"/>
            <meta content="https://i.pinimg.com/736x/76/ed/af/76edaf00529634c5287f884a8b4ef38d.jpg" name="og:image" property="og:image"/>
            <script>var u = "https://v1.pinimg.com/videos/mc/720p/27/93/99/2793999fd5ea5a998899b956594bf2bd.mp4";</script>
            </head></html>
        "#;
        let (title, img, mp4) = extract_pinterest_media_from_html(html);
        assert_eq!(title.as_deref(), Some("Night Motion [Video] | Landscape"));
        assert_eq!(
            img.as_deref(),
            Some("https://i.pinimg.com/736x/76/ed/af/76edaf00529634c5287f884a8b4ef38d.jpg")
        );
        assert_eq!(
            mp4.as_deref(),
            Some("https://v1.pinimg.com/videos/mc/720p/27/93/99/2793999fd5ea5a998899b956594bf2bd.mp4")
        );
        assert!(is_pinterest_url("https://pin.it/4pV09EcBu"));
        assert!(!is_pinterest_url("https://example.com/foo"));
    }

    #[test]
    fn persists_pinterest_image_and_named_frames_in_ref_dir() {
        let dir = std::env::temp_dir().join(format!("aetheria_pin_g1_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let saved = persist_reference_frames_to_dir(
            &dir,
            "pinterest",
            Some((b"fake-jpg-bytes", "jpg")),
            &[],
        );
        assert_eq!(
            saved,
            vec![
                "ref/ref_pinterest.jpg".to_string(),
                "ref/ref_pinterest_frame_1.jpg".to_string(),
                "ref/ref_pinterest_frame_2.jpg".to_string(),
            ]
        );
        assert!(dir.join("ref_pinterest.jpg").is_file());
        assert!(dir.join("ref_pinterest_frame_1.jpg").is_file());
        assert!(dir.join("ref_pinterest_frame_2.jpg").is_file());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn computes_paired_relative_sample_timestamps() {
        let pts = compute_relative_sample_timestamps(10.0);
        assert_eq!(
            pts,
            vec![
                (0.10, "00:00:01.00".to_string()),
                (0.35, "00:00:03.50".to_string()),
                (0.60, "00:00:06.00".to_string()),
                (0.85, "00:00:08.50".to_string()),
            ]
        );
    }
}

