use crate::{config::app_data_dir, media_utils};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::PathBuf,
    process::{Command, Stdio},
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::Emitter;
use tauri_plugin_dialog::DialogExt;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RenderTimelineVideoRequest {
    #[serde(default)]
    pub(crate) request_id: String,
    #[allow(dead_code)]
    #[serde(default)]
    pub(crate) preset_id: String,
    #[allow(dead_code)]
    #[serde(default)]
    pub(crate) preset_name: String,
    #[serde(default)]
    pub(crate) episode_name: String,
    #[serde(default)]
    pub(crate) width: u32,
    #[serde(default)]
    pub(crate) height: u32,
    #[serde(default)]
    pub(crate) fps: u32,
    #[serde(default = "default_render_encode_preset")]
    pub(crate) encode_preset: String,
    #[serde(default = "default_render_crf")]
    pub(crate) crf: u32,
    pub(crate) clips: Vec<RenderTimelineClip>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RenderTimelineClip {
    #[allow(dead_code)]
    #[serde(default)]
    pub(crate) title: String,
    pub(crate) media_url: String,
    #[serde(default)]
    pub(crate) media_type: String,
    pub(crate) duration_seconds: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RenderTimelineVideoResponse {
    pub(crate) path: String,
    pub(crate) note: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct TimelineRenderProgressPayload {
    request_id: String,
    phase: String,
    progress: u8,
    message: String,
}

pub(crate) async fn render_video(
    app: tauri::AppHandle,
    request: RenderTimelineVideoRequest,
) -> Result<RenderTimelineVideoResponse, String> {
    if request.clips.is_empty() {
        return Err("当前时间线没有可导出的片段".to_string());
    }
    ensure_ffmpeg_available()?;
    let width = normalize_render_dimension(request.width);
    let height = normalize_render_dimension(request.height);
    let fps = request.fps.clamp(12, 60).max(12);
    let encode_preset = normalize_render_encode_preset(&request.encode_preset);
    let crf = request.crf.clamp(12, 35);
    let safe_name = sanitize_file_name(if request.episode_name.trim().is_empty() {
        "episode"
    } else {
        request.episode_name.trim()
    });
    let Some(target) = app
        .dialog()
        .file()
        .add_filter("MP4 视频", &["mp4"])
        .set_file_name(format!("{safe_name}.mp4"))
        .blocking_save_file()
    else {
        return Err("已取消导出".to_string());
    };
    let target_path = target
        .as_path()
        .ok_or_else(|| "无法解析导出路径".to_string())?
        .to_path_buf();
    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    emit_progress(&app, &request.request_id, "prepare", 5, "已确认导出路径，开始准备素材");

    let temp_root = app_data_dir()?.join("render-jobs").join(format!(
        "{}-{}",
        safe_name,
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|err| err.to_string())?
            .as_millis()
    ));
    fs::create_dir_all(&temp_root).map_err(|err| err.to_string())?;

    let render_result = async {
        let is_portrait = height > width;
        let mut segment_paths = Vec::new();
        emit_progress(
            &app,
            &request.request_id,
            "segments",
            8,
            format!("开始渲染 {} 个片段", request.clips.len()),
        );
        for (index, clip) in request.clips.iter().enumerate() {
            if clip.media_url.trim().is_empty() {
                return Err(format!("片段 {} 缺少素材地址", index + 1));
            }
            let duration = clip.duration_seconds.max(0.3);
            let source_ext = media_utils::infer_media_extension(&clip.media_url, &clip.media_type);
            let source_path = temp_root.join(format!("source-{:03}.{}", index + 1, source_ext));
            let source_bytes = media_utils::load_media_bytes(&clip.media_url).await?;
            fs::write(&source_path, source_bytes).map_err(|err| err.to_string())?;
            let segment_path = temp_root.join(format!("segment-{:03}.mp4", index + 1));
            render_clip_segment(
                &source_path,
                &segment_path,
                clip,
                duration,
                width,
                height,
                fps,
                is_portrait,
                &encode_preset,
                crf,
            )?;
            segment_paths.push(segment_path);
            let progress = 10 + (((index + 1) as f64 / request.clips.len() as f64) * 50.0).round() as u8;
            emit_progress(
                &app,
                &request.request_id,
                "segments",
                progress.min(60),
                format!("片段渲染完成 {}/{}", index + 1, request.clips.len()),
            );
        }

        let concat_list_path = temp_root.join("concat.txt");
        let concat_text = segment_paths
            .iter()
            .map(|path| format!("file '{}'", path.to_string_lossy().replace('\'', "''")))
            .collect::<Vec<_>>()
            .join("\n");
        fs::write(&concat_list_path, concat_text).map_err(|err| err.to_string())?;

        let stitched_path = temp_root.join("stitched.mp4");
        run_ffmpeg([
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            concat_list_path.to_string_lossy().as_ref(),
            "-c",
            "copy",
            stitched_path.to_string_lossy().as_ref(),
        ])?;
        emit_progress(&app, &request.request_id, "concat", 74, "片段已拼接，正在整理成片");

        fs::copy(&stitched_path, &target_path).map_err(|err| err.to_string())?;
        emit_progress(&app, &request.request_id, "finalize", 100, "导出完成");

        Ok(RenderTimelineVideoResponse {
            path: target_path.to_string_lossy().to_string(),
            note: format!("已导出 {} 个片段", request.clips.len()),
        })
    }
    .await;

    let _ = fs::remove_dir_all(&temp_root);
    render_result
}

fn emit_progress(app: &tauri::AppHandle, request_id: &str, phase: &str, progress: u8, message: impl Into<String>) {
    if request_id.trim().is_empty() {
        return;
    }
    let _ = app.emit(
        "timeline-render-progress",
        TimelineRenderProgressPayload {
            request_id: request_id.to_string(),
            phase: phase.to_string(),
            progress,
            message: message.into(),
        },
    );
}

fn ensure_ffmpeg_available() -> Result<(), String> {
    let status = Command::new("ffmpeg")
        .arg("-version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map_err(|_| "未找到 ffmpeg。请先安装 ffmpeg 并加入系统 PATH。".to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err("ffmpeg 无法正常启动，请检查本机安装。".to_string())
    }
}

fn run_ffmpeg<I, S>(args: I) -> Result<(), String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<std::ffi::OsStr>,
{
    let output = Command::new("ffmpeg")
        .args(args)
        .output()
        .map_err(|err| format!("ffmpeg 执行失败：{err}"))?;
    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let trimmed = stderr
            .lines()
            .rev()
            .take(8)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect::<Vec<_>>()
            .join("\n");
        Err(format!("ffmpeg 导出失败：{}", trimmed.trim()))
    }
}

fn render_clip_segment(
    source_path: &PathBuf,
    segment_path: &PathBuf,
    clip: &RenderTimelineClip,
    duration: f64,
    width: u32,
    height: u32,
    fps: u32,
    is_portrait: bool,
    encode_preset: &str,
    crf: u32,
) -> Result<(), String> {
    let filter = if is_portrait {
        format!(
            "scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},fps={fps},format=yuv420p"
        )
    } else {
        format!(
            "scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:black,fps={fps},format=yuv420p"
        )
    };
    let duration_text = format!("{duration:.3}");
    let source = source_path.to_string_lossy().to_string();
    let target = segment_path.to_string_lossy().to_string();
    let media_type = clip.media_type.to_lowercase();
    if media_type == "video" {
        run_ffmpeg([
            "-y",
            "-i",
            source.as_str(),
            "-f",
            "lavfi",
            "-t",
            duration_text.as_str(),
            "-i",
            "anullsrc=channel_layout=stereo:sample_rate=48000",
            "-t",
            duration_text.as_str(),
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            "-vf",
            filter.as_str(),
            "-c:v",
            "libx264",
            "-preset",
            encode_preset,
            "-crf",
            crf.to_string().as_str(),
            "-pix_fmt",
            "yuv420p",
            "-r",
            fps.to_string().as_str(),
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-shortest",
            target.as_str(),
        ])
    } else {
        run_ffmpeg([
            "-y",
            "-loop",
            "1",
            "-framerate",
            fps.to_string().as_str(),
            "-t",
            duration_text.as_str(),
            "-i",
            source.as_str(),
            "-f",
            "lavfi",
            "-t",
            duration_text.as_str(),
            "-i",
            "anullsrc=channel_layout=stereo:sample_rate=48000",
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            "-vf",
            filter.as_str(),
            "-c:v",
            "libx264",
            "-preset",
            encode_preset,
            "-crf",
            crf.to_string().as_str(),
            "-pix_fmt",
            "yuv420p",
            "-r",
            fps.to_string().as_str(),
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-shortest",
            target.as_str(),
        ])
    }
}

fn default_render_encode_preset() -> String {
    "veryfast".to_string()
}

fn default_render_crf() -> u32 {
    18
}

fn normalize_render_dimension(value: u32) -> u32 {
    let clamped = value.clamp(320, 3840);
    if clamped % 2 == 0 {
        clamped
    } else {
        clamped - 1
    }
}

fn normalize_render_encode_preset(value: &str) -> String {
    match value.trim().to_lowercase().as_str() {
        "ultrafast" | "superfast" | "veryfast" | "faster" | "fast" | "medium" | "slow" | "slower"
        | "veryslow" => value.trim().to_lowercase(),
        _ => default_render_encode_preset(),
    }
}

fn sanitize_file_name(value: &str) -> String {
    let sanitized: String = value
        .chars()
        .map(|ch| if "\\/:*?\"<>|".contains(ch) { '_' } else { ch })
        .take(60)
        .collect();
    if sanitized.trim().is_empty() {
        "result".to_string()
    } else {
        sanitized
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_render_encode_presets() {
        assert_eq!(normalize_render_encode_preset("FAST"), "fast");
        assert_eq!(normalize_render_encode_preset(" veryslow "), "veryslow");
        assert_eq!(
            normalize_render_encode_preset("unsupported-preset"),
            default_render_encode_preset()
        );
    }

    #[test]
    fn sanitizes_file_names_for_windows() {
        assert_eq!(sanitize_file_name("episode:01?.mp4"), "episode_01_.mp4");
        assert_eq!(sanitize_file_name("   "), "result");
        assert_eq!(sanitize_file_name(""), "result");
        assert_eq!(sanitize_file_name("a".repeat(80).as_str()).len(), 60);
    }

    #[test]
    fn default_values_are_stable() {
        assert_eq!(default_render_crf(), 18);
        assert_eq!(default_render_encode_preset(), "veryfast");
    }

    #[test]
    fn normalizes_render_dimensions_for_h264() {
        assert_eq!(normalize_render_dimension(0), 320);
        assert_eq!(normalize_render_dimension(321), 320);
        assert_eq!(normalize_render_dimension(1081), 1080);
        assert_eq!(normalize_render_dimension(5000), 3840);
    }
}
