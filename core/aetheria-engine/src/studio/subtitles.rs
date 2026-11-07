//! Studio high-retention subtitle and kinetic caption generation.

use super::types::{FormatCaptionsPayload, GenerateSubtitlesPayload, SubtitleCue};
use axum::{response::IntoResponse, Json};
use serde_json::json;

pub async fn handle_generate_subtitles(
    Json(payload): Json<GenerateSubtitlesPayload>,
) -> impl IntoResponse {
    let fps = if payload.fps == 0 { 30 } else { payload.fps };
    let words_per_chunk = if payload.words_per_chunk == 0 { 3 } else { payload.words_per_chunk };
    let sec_per_word = 60.0 / (if payload.wpm == 0 { 200.0 } else { payload.wpm as f64 });

    let words: Vec<&str> = payload.text.split_whitespace().collect();
    let mut cues: Vec<SubtitleCue> = Vec::new();
    let mut current_sec = 0.0;

    let high_impact_words = [
        "secret", "money", "fast", "never", "always", "stop", "rich", "millionaire",
        "hack", "truth", "viral", "proven", "dopamine", "fail", "win", "elite",
        "growth", "profit", "success", "critical", "essential", "trick", "tips", "warning",
    ];

    for (idx, chunk) in words.chunks(words_per_chunk).enumerate() {
        let chunk_text = chunk.join(" ");
        let chunk_word_count = chunk.len();
        let duration_sec = sec_per_word * (chunk_word_count as f64);
        let start_sec = current_sec;
        let end_sec = current_sec + duration_sec;
        current_sec = end_sec;

        let start_frame = (start_sec * (fps as f64)).round() as u32;
        let end_frame = (end_sec * (fps as f64)).round() as u32;

        let mut highlight = None;
        let mut color = "#FFFFFF".to_string();
        for w in chunk {
            let clean = w.trim_matches(|c: char| !c.is_alphanumeric()).to_lowercase();
            if high_impact_words.contains(&clean.as_str()) {
                highlight = Some(w.to_string());
                color = "#00FF66".to_string(); // TikTok viral neon green
                break;
            }
        }

        cues.push(SubtitleCue {
            id: format!("cue-{}", idx + 1),
            start_frame,
            end_frame,
            start_sec: (start_sec * 100.0).round() / 100.0,
            end_sec: (end_sec * 100.0).round() / 100.0,
            text: chunk_text,
            words: chunk.iter().map(|s| s.to_string()).collect(),
            highlight_keyword: highlight,
            color,
            scale: 1.05,
        });
    }

    Json(json!({
        "success": true,
        "totalCues": cues.len(),
        "totalDurationSec": (current_sec * 100.0).round() / 100.0,
        "cues": cues
    }))
}

pub async fn handle_format_captions(
    Json(payload): Json<FormatCaptionsPayload>,
) -> impl IntoResponse {
    let style = payload.style.unwrap_or_else(|| "#00F2FE".to_string());
    let highlight_color = if style.starts_with('#') {
        style.as_str()
    } else {
        match style.as_str() {
            "beast-yellow" => "#F59E0B",
            _ => "#00F2FE",
        }
    };
    let primary_color = "#FFFFFF";

    let formatted: Vec<SubtitleCue> = payload
        .cues
        .into_iter()
        .map(|mut c| {
            if c.highlight_keyword.is_some() {
                c.color = highlight_color.to_string();
                c.scale = 1.15;
            } else {
                c.color = primary_color.to_string();
                c.scale = 1.0;
            }
            c
        })
        .collect();

    Json(json!({
        "success": true,
        "style": style,
        "cues": formatted
    }))
}

