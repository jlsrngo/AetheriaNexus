//! Software RGBA rasterizer primitives, spring curves, and native timeline payload types.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NativeElement {
    pub element_type: String, // "text", "badge", "card", "progress_bar"
    pub text: Option<String>,
    pub category: Option<String>,
    pub x: f32,
    pub y: f32,
    pub width: Option<f32>,
    pub height: Option<f32>,
    pub color_rgba: Option<[u8; 4]>,
    pub bg_rgba: Option<[u8; 4]>,
    pub font_size: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NativeScene {
    pub id: String,
    pub duration_sec: f32,
    pub bg_color_top: [u8; 4],
    pub bg_color_bottom: [u8; 4],
    pub hook_title: String,
    pub subtitle: String,
    pub badge: String,
    pub elements: Option<Vec<NativeElement>>,
    pub audio_src: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NativeTimelinePayload {
    pub composition_id: Option<String>,
    pub output_name: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub fps: Option<u32>,
    pub scenes: Option<Vec<NativeScene>>,
    pub codec: Option<String>,
}

pub(crate) fn default_native_scenes() -> Vec<NativeScene> {
    vec![
        NativeScene {
            id: "s1".to_string(),
            duration_sec: 3.0,
            bg_color_top: [15, 23, 42, 255],
            bg_color_bottom: [2, 6, 23, 255],
            hook_title: "NATIVE RUST VIDEO ENGINE".to_string(),
            subtitle: "100% Direct CPU / GPU Pipeline — Rp 0 Cloud Fees".to_string(),
            badge: "// HIGH SPEED NATIVE".to_string(),
            elements: None,
            audio_src: None,
        },
        NativeScene {
            id: "s2".to_string(),
            duration_sec: 3.0,
            bg_color_top: [30, 27, 75, 255],
            bg_color_bottom: [15, 23, 42, 255],
            hook_title: "ZERO BROWSER OVERHEAD".to_string(),
            subtitle: "Pure Memory Frame Buffer Stream Direct To NVENC".to_string(),
            badge: "// MEMORY PIPELINE".to_string(),
            elements: None,
            audio_src: None,
        },
    ]
}

/// Fast software rasterizer: renders vertical gradient into RGBA buffer
pub(crate) fn fill_vertical_gradient(
    buffer: &mut [u8],
    width: u32,
    height: u32,
    top: [u8; 4],
    bottom: [u8; 4],
) {
    for y in 0..height {
        let t = y as f32 / height as f32;
        let r = (top[0] as f32 * (1.0 - t) + bottom[0] as f32 * t) as u8;
        let g = (top[1] as f32 * (1.0 - t) + bottom[1] as f32 * t) as u8;
        let b = (top[2] as f32 * (1.0 - t) + bottom[2] as f32 * t) as u8;
        let a = (top[3] as f32 * (1.0 - t) + bottom[3] as f32 * t) as u8;

        let row_start = (y * width * 4) as usize;
        let row_end = row_start + (width * 4) as usize;
        let row = &mut buffer[row_start..row_end];

        for px in row.chunks_exact_mut(4) {
            px[0] = r;
            px[1] = g;
            px[2] = b;
            px[3] = a;
        }
    }
}

/// Fast software rasterizer: draws a rectangle with alpha blending
pub(crate) fn draw_rect(
    buffer: &mut [u8],
    canvas_w: u32,
    canvas_h: u32,
    rx: i32,
    ry: i32,
    rw: u32,
    rh: u32,
    color: [u8; 4],
) {
    let x_start = rx.max(0) as u32;
    let x_end = (rx + rw as i32).max(0).min(canvas_w as i32) as u32;
    let y_start = ry.max(0) as u32;
    let y_end = (ry + rh as i32).max(0).min(canvas_h as i32) as u32;

    let src_a = color[3] as f32 / 255.0;
    let inv_a = 1.0 - src_a;

    for y in y_start..y_end {
        for x in x_start..x_end {
            let idx = ((y * canvas_w + x) * 4) as usize;
            if idx + 3 < buffer.len() {
                let dr = buffer[idx] as f32;
                let dg = buffer[idx + 1] as f32;
                let db = buffer[idx + 2] as f32;

                buffer[idx] = (color[0] as f32 * src_a + dr * inv_a) as u8;
                buffer[idx + 1] = (color[1] as f32 * src_a + dg * inv_a) as u8;
                buffer[idx + 2] = (color[2] as f32 * src_a + db * inv_a) as u8;
                buffer[idx + 3] = 255;
            }
        }
    }
}

/// Simple kinetic spring physics calculation (damping + frequency)
pub(crate) fn spring_progress(t: f32, duration: f32) -> f32 {
    let p = (t / duration).clamp(0.0, 1.0);
    1.0 - (-8.0 * p).exp() * (6.28 * p * 1.2).cos()
}

