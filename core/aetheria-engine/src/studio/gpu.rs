//! Studio GPU hardware acceleration and telemetry detection.

use super::types::GpuTelemetry;
use axum::{response::IntoResponse, Json};
use serde_json::json;
use std::sync::OnceLock;

static GPU_TELEMETRY_CACHE: OnceLock<GpuTelemetry> = OnceLock::new();

pub fn detect_gpu_telemetry_once() -> GpuTelemetry {
    let mut encoder = "libx264".to_string();
    let mut vendor = "CPU".to_string();
    let mut name = "Software Encoder (libx264)".to_string();
    let mut hw = false;
    let mut codecs = vec!["libx264".to_string(), "aac".to_string()];
    let vram = 8192;

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        let probe = std::process::Command::new("powershell")
            .creation_flags(CREATE_NO_WINDOW)
            .args([
                "-NoProfile",
                "-Command",
                "(Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name) -join ' / '",
            ])
            .output()
            .or_else(|_| {
                std::process::Command::new("wmic")
                    .creation_flags(CREATE_NO_WINDOW)
                    .args(["path", "win32_VideoController", "get", "name"])
                    .output()
            });

        if let Ok(out) = probe {
            let raw_text = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let text = raw_text.to_lowercase();
            let detected_label = if raw_text.is_empty() {
                None
            } else {
                Some(raw_text)
            };

            if text.contains("nvidia") || text.contains("geforce") || text.contains("rtx") || text.contains("gtx") {
                encoder = "h264_nvenc".to_string();
                vendor = "NVIDIA".to_string();
                name = match detected_label {
                    Some(lbl) => format!("{} (NVENC Accelerated)", lbl),
                    None => "NVIDIA GeForce / RTX Series (NVENC Accelerated)".to_string(),
                };
                hw = true;
                codecs.push("h264_nvenc".to_string());
                codecs.push("hevc_nvenc".to_string());
            } else if text.contains("amd") || text.contains("radeon") {
                encoder = "h264_amf".to_string();
                vendor = "AMD".to_string();
                name = match detected_label {
                    Some(lbl) => format!("{} (AMF Accelerated)", lbl),
                    None => "AMD Radeon Series (AMF Accelerated)".to_string(),
                };
                hw = true;
                codecs.push("h264_amf".to_string());
                codecs.push("hevc_amf".to_string());
            } else if text.contains("intel") || text.contains("iris") || text.contains("arc") {
                encoder = "h264_qsv".to_string();
                vendor = "Intel".to_string();
                name = match detected_label {
                    Some(lbl) => format!("{} (QSV Accelerated)", lbl),
                    None => "Intel QuickSync Video (QSV Accelerated)".to_string(),
                };
                hw = true;
                codecs.push("h264_qsv".to_string());
                codecs.push("hevc_qsv".to_string());
            }
        }
    }

    GpuTelemetry {
        success: true,
        encoder,
        gpu_vendor: vendor,
        gpu_name: name,
        hardware_accelerated: hw,
        supported_codecs: codecs,
        memory_mb: vram,
    }
}

pub async fn handle_gpu_telemetry() -> impl IntoResponse {
    if let Some(cached) = GPU_TELEMETRY_CACHE.get() {
        return Json(json!({
            "success": true,
            "data": cached,
            "encoder": cached.encoder,
            "gpuVendor": cached.gpu_vendor,
            "gpuName": cached.gpu_name,
            "hardwareAccelerated": cached.hardware_accelerated,
            "supportedCodecs": cached.supported_codecs,
            "memoryMb": cached.memory_mb
        }));
    }

    let telemetry = tokio::task::spawn_blocking(|| {
        GPU_TELEMETRY_CACHE.get_or_init(detect_gpu_telemetry_once).clone()
    })
    .await
    .unwrap_or_else(|_| detect_gpu_telemetry_once());

    Json(json!({
        "success": true,
        "data": telemetry,
        "encoder": telemetry.encoder,
        "gpuVendor": telemetry.gpu_vendor,
        "gpuName": telemetry.gpu_name,
        "hardwareAccelerated": telemetry.hardware_accelerated,
        "supportedCodecs": telemetry.supported_codecs,
        "memoryMb": telemetry.memory_mb
    }))
}

