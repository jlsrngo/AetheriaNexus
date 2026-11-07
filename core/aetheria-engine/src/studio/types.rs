//! Studio models, payloads, and telemetry types.

use serde::{Deserialize, Serialize};
use serde_json::Value;

pub fn default_fps() -> u32 {
    30
}
pub fn default_width() -> u32 {
    1080
}
pub fn default_height() -> u32 {
    1920
}
pub fn default_wpm() -> u32 {
    200
}
pub fn default_words_per_chunk() -> usize {
    3
}
pub fn default_platform() -> String {
    "tiktok".to_string()
}

pub fn format_file_size(bytes: u64) -> String {
    if bytes >= 1024 * 1024 * 1024 {
        format!("{:.1} GB", bytes as f64 / (1024.0 * 1024.0 * 1024.0))
    } else if bytes >= 1024 * 1024 {
        format!("{:.1} MB", bytes as f64 / (1024.0 * 1024.0))
    } else if bytes >= 1024 {
        format!("{} KB", bytes / 1024)
    } else {
        format!("{} B", bytes)
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CompositionPreset {
    pub id: String,
    pub name: String,
    pub folder: String,
    pub ratio: String,
    pub duration: f64,
    #[serde(default = "default_fps")]
    pub fps: u32,
    #[serde(default = "default_width")]
    pub width: u32,
    #[serde(default = "default_height")]
    pub height: u32,
    pub props: Value,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct NexusStaticFile {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub file_type: String, // "video" | "audio" | "image" | "data"
    pub size: String,
    pub bytes: u64,
    pub path: String,
    pub relative_path: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RenderJob {
    pub render_id: String,
    pub composition_id: String,
    pub status: String, // "pending" | "rendering" | "done" | "error"
    pub percent: u32,
    pub rendered_frames: u32,
    pub total_frames: u32,
    pub output_path: Option<String>,
    pub error: Option<String>,
    pub created_at: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePropsPayload {
    pub composition_id: String,
    pub props: Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderMediaPayload {
    pub composition_id: Option<String>,
    pub input_props: Option<Value>,
    pub props: Option<Value>,
    pub output_name: Option<String>,
    pub ratio: Option<String>,
    pub codec: Option<String>,
    pub in_frame: Option<u32>,
    pub out_frame: Option<u32>,
}

#[derive(Deserialize)]
pub struct ProgressQuery {
    #[serde(rename = "renderId")]
    pub render_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteFilePayload {
    pub path: Option<String>,
    pub file_path: Option<String>,
    pub data: Option<String>,
    pub contents: Option<String>,
    pub base64_data: Option<String>,
    pub source_path: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteFilePayload {
    pub path: Option<String>,
    pub file_path: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GpuTelemetry {
    pub success: bool,
    pub encoder: String,
    pub gpu_vendor: String,
    pub gpu_name: String,
    pub hardware_accelerated: bool,
    pub supported_codecs: Vec<String>,
    pub memory_mb: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleCue {
    pub id: String,
    pub start_frame: u32,
    pub end_frame: u32,
    pub start_sec: f64,
    pub end_sec: f64,
    pub text: String,
    pub words: Vec<String>,
    pub highlight_keyword: Option<String>,
    pub color: String,
    pub scale: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateSubtitlesPayload {
    pub text: String,
    #[serde(default = "default_wpm")]
    pub wpm: u32,
    #[serde(default = "default_words_per_chunk")]
    pub words_per_chunk: usize,
    #[serde(default = "default_fps")]
    pub fps: u32,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormatCaptionsPayload {
    pub cues: Vec<SubtitleCue>,
    pub style: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanMediaPayload {
    pub path: Option<String>,
    pub file_types: Option<Vec<String>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledPost {
    pub id: String,
    pub title: String,
    pub video_path: String,
    pub caption: String,
    pub tags: Vec<String>,
    pub platform: String,
    pub scheduled_time: u64,
    pub status: String,
    pub error: Option<String>,
    pub created_at: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchedulePostPayload {
    pub title: String,
    pub video_path: String,
    pub caption: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default = "default_platform")]
    pub platform: String,
    pub scheduled_time: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CancelPostPayload {
    pub id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateScriptPayload {
    pub topic: String,
    pub niche: Option<String>,
    pub duration: Option<f64>,
    pub theme_color: Option<String>,
    pub auto_register: Option<bool>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RustVideoLayerSpec {
    pub id: String,
    pub track_code: String,
    pub label: String,
    pub kind: String,
    pub from: u32,
    pub duration_in_frames: u32,
    pub visible: bool,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ComputeLayersPayload {
    pub composition_id: Option<String>,
    pub props: Option<Value>,
    pub total_frames: Option<u32>,
}

