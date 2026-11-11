//! Local pure-Rust HTML Motion Film rendering Tauri command.

/// Invokes the pure-Rust local HTML Motion Engine (Headless Chrome/Edge CDP + FFmpeg) to export MP4.
#[tauri::command]
pub async fn render_nexus_video(
    props_json: Option<String>,
    output_path: Option<String>,
) -> Result<serde_json::Value, String> {
    let parsed_props: serde_json::Value = props_json
        .as_deref()
        .and_then(|raw| serde_json::from_str(raw).ok())
        .unwrap_or_else(|| serde_json::json!({}));

    let workspace_dir = parsed_props
        .get("workspaceDir")
        .or_else(|| parsed_props.get("directory"))
        .and_then(serde_json::Value::as_str)
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .or_else(aetheria_engine::desktop::get_active_workspace_root);

    let effective_ws = workspace_dir
        .as_deref()
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| aetheria_engine::paths::aetheria_dot_dir().join("scratch"));

    let resolved_output = aetheria_engine::tool::render::resolve_render_output_path(
        &effective_ws,
        output_path.as_deref(),
    );

    let codec = parsed_props
        .get("codec")
        .and_then(serde_json::Value::as_str)
        .unwrap_or("h264")
        .to_string();

    let params = aetheria_engine::studio::html_renderer::HtmlRenderParams {
        workspace_dir,
        output_path: resolved_output.clone(),
        codec,
        frame_range: None,
    };

    let done = aetheria_engine::studio::html_renderer::render_active_html_film(
        params,
        |_, _| {},
        |_, _, _| {},
    )
    .await?;

    let final_path = done.output_path.to_string_lossy().to_string();
    Ok(serde_json::json!({
        "success": true,
        "stdout": format!(
            "Rendered {} frames ({}x{} @ {}fps) to {}",
            done.total_frames, done.width, done.height, done.fps, final_path
        ),
        "outputPath": final_path
    }))
}

