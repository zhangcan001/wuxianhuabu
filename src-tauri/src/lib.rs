use base64::Engine;
use image::ImageFormat;
use serde::{Deserialize, Serialize};
use std::fs;

mod config;
mod api_clients;
mod comfy;
mod file_ops;
mod gemini_web;
mod media_utils;
mod render_timeline;
mod sqlite_index;

use config::{
    default_modelscope_minimax_body_template, default_novel_body_template,
    default_novel_response_path, default_qwen_base_url, default_qwen_body_template,
    default_qwen_compatible_base_url, default_qwen_compatible_body_template,
    default_qwen_model, default_qwen_response_path, gemini_cancel_path, public_config,
    public_novel_api_config, read_config, read_novel_api_config, read_recent_projects,
    write_config, write_novel_api_config, PublicAiConfig, PublicNovelApiConfig,
    SaveAiConfigRequest, SaveNovelApiConfigRequest,
};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BasicStatusResponse {
    note: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GeminiCancelRequest {
    request_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ImageSourceRequest {
    image_url: String,
    #[serde(default)]
    file_name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SplitImageRequest {
    image_url: String,
    rows: u32,
    cols: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SaveImageResponse {
    path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SplitImageResponse {
    frames: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NovelProviderPreset {
    provider_id: String,
    name: String,
    description: String,
    api_url: String,
    auth_type: String,
    default_model: String,
    body_template: String,
    response_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct NovelProviderPresetsResponse {
    presets: Vec<NovelProviderPreset>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RecentProjectsResponse {
    paths: Vec<String>,
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_ai_config,
            save_ai_config,
            generate_image_custom_api,
            diagnose_image_custom_api,
            get_novel_api_config,
            save_novel_api_config,
            call_novel_factory_api,
            get_novel_provider_presets,
            apply_novel_provider_preset,
            open_gemini_chrome_login,
            generate_gemini_web_image,
            cancel_gemini_web_image,
            test_comfy_connection,
            run_comfy_workflow,
            save_image_to_downloads,
            copy_image_to_clipboard,
            split_image_grid,
            save_project_file,
            open_project_file,
            save_project_file_to_path,
            open_project_file_at_path,
            save_project_cache,
            load_project_cache,
            clear_project_cache,
            cache_media_asset,
            pick_media_file,
            list_media_cache,
            delete_media_cache_files,
            sync_project_index,
            read_project_index_summary,
            search_project_index,
            save_export_file,
            save_delivery_package,
            render_timeline_video,
            get_recent_projects,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn get_ai_config() -> Result<PublicAiConfig, String> {
    let config = read_config()?;
    Ok(public_config(config))
}

#[tauri::command]
fn save_ai_config(request: SaveAiConfigRequest) -> Result<PublicAiConfig, String> {
    let mut config = read_config()?;
    if let Some(value) = request.provider_mode {
        config.provider_mode = value;
    }
    if let Some(value) = request.custom_api_url {
        config.custom_api_url = value;
    }
    if let Some(value) = request.custom_auth_type {
        config.custom_auth_type = value;
    }
    if let Some(value) = request.custom_headers_json {
        config.custom_headers_json = value;
    }
    if let Some(value) = request.custom_model {
        config.custom_model = value;
    }
    if let Some(value) = request.custom_api_kind {
        config.custom_api_kind = value;
    }
    if let Some(value) = request.custom_result_mode {
        config.custom_result_mode = value;
    }
    if let Some(value) = request.custom_image_path {
        config.custom_image_path = value;
    }
    if let Some(value) = request.custom_body_template {
        config.custom_body_template = value;
    }
    if let Some(value) = request.comfy_enabled {
        config.comfy_enabled = value;
    }
    if let Some(value) = request.comfy_base_url {
        config.comfy_base_url = value;
    }
    if let Some(value) = request.positive_node_id {
        config.positive_node_id = value;
    }
    if let Some(value) = request.workflow_json {
        config.workflow_json = value;
    }
    if let Some(value) = request.comfy_image_positive_node_id {
        config.comfy_image_positive_node_id = value;
    }
    if let Some(value) = request.comfy_image_workflow_json {
        config.comfy_image_workflow_json = value;
    }
    if let Some(value) = request.comfy_video_positive_node_id {
        config.comfy_video_positive_node_id = value;
    }
    if let Some(value) = request.comfy_video_workflow_json {
        config.comfy_video_workflow_json = value;
    }
    if let Some(value) = request.comfy_timeout_seconds {
        config.comfy_timeout_seconds = value;
    }
    if request.custom_api_key_clear.unwrap_or(false) {
        config.custom_api_key.clear();
    } else if let Some(value) = request.custom_api_key {
        if !value.is_empty() {
            config.custom_api_key = value;
        }
    }
    write_config(&config)?;
    Ok(public_config(config))
}

#[tauri::command]
async fn generate_image_custom_api(
    request: api_clients::GenerateImageRequest,
) -> Result<api_clients::GenerateImageResponse, String> {
    let config = read_config()?;
    api_clients::run_custom_api_generation(&config, &request).await
}

#[tauri::command]
async fn diagnose_image_custom_api(
    request: api_clients::GenerateImageRequest,
) -> Result<api_clients::CustomImageApiDiagnosticResponse, String> {
    let config = read_config()?;
    Ok(api_clients::diagnose_custom_api_generation(&config, &request).await)
}

#[tauri::command]
async fn call_novel_factory_api(
    request: api_clients::NovelFactoryRequest,
) -> Result<api_clients::NovelFactoryResponse, String> {
    api_clients::run_novel_factory_api(request).await
}

#[tauri::command]
fn get_novel_api_config() -> Result<PublicNovelApiConfig, String> {
    Ok(public_novel_api_config(read_novel_api_config()?))
}

#[tauri::command]
fn save_novel_api_config(request: SaveNovelApiConfigRequest) -> Result<PublicNovelApiConfig, String> {
    let mut config = read_novel_api_config()?;
    if let Some(value) = request.factory_mode {
        config.factory_mode = value;
    }
    if let Some(value) = request.api_provider {
        config.api_provider = value;
    }
    if let Some(value) = request.api_base_url {
        config.api_base_url = value;
    }
    if let Some(value) = request.api_url {
        config.api_url = value;
    }
    if request.api_key_clear.unwrap_or(false) {
        config.api_key.clear();
    } else if let Some(value) = request.api_key {
        if !value.is_empty() {
            config.api_key = value;
        }
    }
    if let Some(value) = request.auth_type {
        config.auth_type = value;
    }
    if let Some(value) = request.headers_json {
        config.headers_json = value;
    }
    if let Some(value) = request.api_model {
        config.api_model = value;
    }
    if let Some(value) = request.body_template {
        config.body_template = value;
    }
    if let Some(value) = request.response_path {
        config.response_path = value;
    }
    if let Some(value) = request.schema {
        config.schema = value;
    }
    write_novel_api_config(&config)?;
    Ok(public_novel_api_config(config))
}

#[tauri::command]
fn get_novel_provider_presets() -> Result<NovelProviderPresetsResponse, String> {
    let presets = vec![
        NovelProviderPreset {
            provider_id: "openai".to_string(),
            name: "OpenAI".to_string(),
            description: "OpenAI GPT 系列 API".to_string(),
            api_url: "https://api.openai.com/v1/chat/completions".to_string(),
            auth_type: "bearer".to_string(),
            default_model: "gpt-4o-mini".to_string(),
            body_template: default_novel_body_template(),
            response_path: default_novel_response_path(),
        },
        NovelProviderPreset {
            provider_id: "qwen".to_string(),
            name: "阿里百炼 (原生)".to_string(),
            description: "阿里云通义千问 DashScope 原生 API".to_string(),
            api_url: default_qwen_base_url(),
            auth_type: "authorization".to_string(),
            default_model: default_qwen_model(),
            body_template: default_qwen_body_template(),
            response_path: default_qwen_response_path(),
        },
        NovelProviderPreset {
            provider_id: "qwen-compatible".to_string(),
            name: "阿里百炼 (兼容)".to_string(),
            description: "阿里云通义千问 OpenAI 兼容 API".to_string(),
            api_url: default_qwen_compatible_base_url(),
            auth_type: "bearer".to_string(),
            default_model: default_qwen_model(),
            body_template: default_qwen_compatible_body_template(),
            response_path: default_novel_response_path(),
        },
        NovelProviderPreset {
            provider_id: "deepseek".to_string(),
            name: "DeepSeek".to_string(),
            description: "DeepSeek API (OpenAI 兼容)".to_string(),
            api_url: "https://api.deepseek.com/v1/chat/completions".to_string(),
            auth_type: "bearer".to_string(),
            default_model: "deepseek-chat".to_string(),
            body_template: default_novel_body_template(),
            response_path: default_novel_response_path(),
        },
        NovelProviderPreset {
            provider_id: "modelscope-minimax".to_string(),
            name: "ModelScope · MiniMax-M2.7".to_string(),
            description: "ModelScope OpenAI 兼容推理 API".to_string(),
            api_url: "https://api-inference.modelscope.cn/v1/chat/completions".to_string(),
            auth_type: "bearer".to_string(),
            default_model: "MiniMax/MiniMax-M2.7".to_string(),
            body_template: default_modelscope_minimax_body_template(),
            response_path: default_novel_response_path(),
        },
        NovelProviderPreset {
            provider_id: "moonshot".to_string(),
            name: "Moonshot (月之暗面)".to_string(),
            description: "Kimi API (OpenAI 兼容)".to_string(),
            api_url: "https://api.moonshot.cn/v1/chat/completions".to_string(),
            auth_type: "bearer".to_string(),
            default_model: "moonshot-v1-8k".to_string(),
            body_template: default_novel_body_template(),
            response_path: default_novel_response_path(),
        },
        NovelProviderPreset {
            provider_id: "zhipu".to_string(),
            name: "智谱 AI".to_string(),
            description: "智谱 GLM API (OpenAI 兼容)".to_string(),
            api_url: "https://open.bigmodel.cn/api/paas/v4/chat/completions".to_string(),
            auth_type: "bearer".to_string(),
            default_model: "glm-4-flash".to_string(),
            body_template: default_novel_body_template(),
            response_path: default_novel_response_path(),
        },
    ];
    Ok(NovelProviderPresetsResponse { presets })
}

#[tauri::command]
fn apply_novel_provider_preset(provider_id: String) -> Result<PublicNovelApiConfig, String> {
    let presets = get_novel_provider_presets()?;
    let preset = presets
        .presets
        .iter()
        .find(|p| p.provider_id == provider_id)
        .ok_or_else(|| format!("未找到 Provider: {provider_id}"))?;
    
    let mut config = read_novel_api_config()?;
    config.factory_mode = "api".to_string();
    config.api_provider = preset.provider_id.clone();
    config.api_url = preset.api_url.clone();
    config.api_base_url = preset.api_url.clone();
    config.auth_type = preset.auth_type.clone();
    config.api_model = preset.default_model.clone();
    config.body_template = preset.body_template.clone();
    config.response_path = preset.response_path.clone();
    
    write_novel_api_config(&config)?;
    Ok(public_novel_api_config(config))
}

#[tauri::command]
fn open_gemini_chrome_login(
    request: gemini_web::GeminiWebRequest,
) -> Result<gemini_web::GeminiWebResponse, String> {
    gemini_web::open_chrome_login(request)
}

#[tauri::command]
async fn generate_gemini_web_image(
    app: tauri::AppHandle,
    request: gemini_web::GeminiWebRequest,
) -> Result<gemini_web::GeminiWebResponse, String> {
    gemini_web::run_worker(app, request).await
}

#[tauri::command]
fn cancel_gemini_web_image(request: GeminiCancelRequest) -> Result<BasicStatusResponse, String> {
    let path = gemini_cancel_path(&request.request_id)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    fs::write(&path, b"cancel").map_err(|err| err.to_string())?;
    Ok(BasicStatusResponse {
        note: "已请求取消 Gemini 自动化任务".to_string(),
    })
}

#[tauri::command]
async fn run_comfy_workflow(
    request: comfy::ComfyWorkflowRequest,
) -> Result<comfy::ComfyWorkflowResponse, String> {
    let base_url = request.base_url.trim().trim_end_matches('/').to_string();
    let cache_file_name = if request.prompt.trim().is_empty() {
        "comfy-image".to_string()
    } else {
        format!("comfy-{}", request.prompt.trim())
    };
    let mut response = comfy::run_workflow(request).await?;
    if let Some(image_url) = response.image_url.clone() {
        if let Ok(saved) = file_ops::cache_media_asset(file_ops::CacheMediaRequest {
            media_url: image_url.clone(),
            media_type: "image".to_string(),
            file_name: sanitize_file_name(&cache_file_name),
        })
        .await
        {
            response.image_path = Some(saved.path.clone());
            response.image_thumbnail_path = saved.thumbnail_path.clone();
            if let Some(thumbnail_path) = saved.thumbnail_path.as_deref() {
                response.image_thumbnail_url = image_path_to_data_url(thumbnail_path).await.ok();
            }
        }
    }
    if let Some(prompt_id) = response.prompt_id.as_ref() {
        let client = reqwest::Client::new();
        comfy::cleanup_prompt_resources(&client, &base_url, prompt_id).await;
    }
    response.prompt_id = None;
    Ok(response)
}

#[tauri::command]
async fn test_comfy_connection(
    request: comfy::ComfyConnectionRequest,
) -> Result<BasicStatusResponse, String> {
    Ok(BasicStatusResponse {
        note: comfy::test_connection(request).await?,
    })
}

#[tauri::command]
async fn save_image_to_downloads(request: ImageSourceRequest) -> Result<SaveImageResponse, String> {
    let bytes = media_utils::load_image_bytes(&request.image_url).await?;
    let ext = media_utils::guess_extension(&bytes);
    let file_name = sanitize_file_name(request.file_name.as_deref().unwrap_or("result"));
    let path = media_utils::downloads_dir()?.join(format!("{file_name}.{ext}"));
    fs::write(&path, bytes).map_err(|err| err.to_string())?;
    Ok(SaveImageResponse {
        path: path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
async fn copy_image_to_clipboard(request: ImageSourceRequest) -> Result<(), String> {
    media_utils::copy_image_to_clipboard(&request.image_url).await
}

#[tauri::command]
async fn split_image_grid(request: SplitImageRequest) -> Result<SplitImageResponse, String> {
    Ok(SplitImageResponse {
        frames: media_utils::split_image_grid(&request.image_url, request.rows, request.cols).await?,
    })
}

#[tauri::command]
fn save_project_file(
    app: tauri::AppHandle,
    request: file_ops::ProjectFileRequest,
) -> Result<file_ops::ProjectFileResponse, String> {
    file_ops::save_project_file(app, request)
}

#[tauri::command]
fn open_project_file(app: tauri::AppHandle) -> Result<file_ops::ProjectFileResponse, String> {
    file_ops::open_project_file(app)
}

#[tauri::command]
fn save_project_file_to_path(
    request: file_ops::ProjectPathSaveRequest,
) -> Result<file_ops::ProjectFileResponse, String> {
    file_ops::save_project_file_to_path(request)
}

#[tauri::command]
fn save_export_file(
    app: tauri::AppHandle,
    request: file_ops::ExportFileRequest,
) -> Result<file_ops::ProjectFileResponse, String> {
    file_ops::save_export_file(app, request)
}

#[tauri::command]
fn save_delivery_package(
    app: tauri::AppHandle,
    request: file_ops::DeliveryPackageSaveRequest,
) -> Result<file_ops::ProjectFileResponse, String> {
    file_ops::save_delivery_package(app, request)
}

#[tauri::command]
async fn render_timeline_video(
    app: tauri::AppHandle,
    request: render_timeline::RenderTimelineVideoRequest,
) -> Result<render_timeline::RenderTimelineVideoResponse, String> {
    render_timeline::render_video(app, request).await
}

#[tauri::command]
fn open_project_file_at_path(
    request: file_ops::ProjectPathRequest,
) -> Result<file_ops::ProjectFileResponse, String> {
    file_ops::open_project_file_at_path(request)
}

#[tauri::command]
fn save_project_cache(
    request: file_ops::ProjectCacheSaveRequest,
) -> Result<file_ops::ProjectCacheResponse, String> {
    file_ops::save_project_cache(request)
}

#[tauri::command]
fn load_project_cache() -> Result<file_ops::ProjectCacheResponse, String> {
    file_ops::load_project_cache()
}

#[tauri::command]
fn clear_project_cache() -> Result<file_ops::ProjectCacheResponse, String> {
    file_ops::clear_project_cache()
}

#[tauri::command]
async fn cache_media_asset(
    request: file_ops::CacheMediaRequest,
) -> Result<file_ops::CacheMediaResponse, String> {
    file_ops::cache_media_asset(request).await
}

#[tauri::command]
fn pick_media_file(
    app: tauri::AppHandle,
    request: file_ops::PickMediaFileRequest,
) -> Result<file_ops::PickMediaFileResponse, String> {
    file_ops::pick_media_file(app, request)
}

#[tauri::command]
fn list_media_cache() -> Result<file_ops::MediaCacheIndexResponse, String> {
    file_ops::list_media_cache()
}

#[tauri::command]
fn delete_media_cache_files(
    request: file_ops::DeleteMediaCacheRequest,
) -> Result<file_ops::DeleteMediaCacheResponse, String> {
    file_ops::delete_media_cache_files(request)
}

#[tauri::command]
fn sync_project_index(
    request: sqlite_index::SyncProjectIndexRequest,
) -> Result<sqlite_index::ProjectIndexSummary, String> {
    sqlite_index::sync_project_index(request)
}

#[tauri::command]
fn read_project_index_summary() -> Result<sqlite_index::ProjectIndexSummary, String> {
    sqlite_index::read_project_index_summary()
}

#[tauri::command]
fn search_project_index(
    request: sqlite_index::SearchProjectIndexRequest,
) -> Result<sqlite_index::ProjectIndexSearchResponse, String> {
    sqlite_index::search_project_index(request)
}

#[tauri::command]
fn get_recent_projects() -> Result<RecentProjectsResponse, String> {
    Ok(RecentProjectsResponse {
        paths: read_recent_projects()?,
    })
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

async fn image_path_to_data_url(image_path: &str) -> Result<String, String> {
    let bytes = media_utils::load_image_bytes(image_path).await?;
    let mime = match image::guess_format(&bytes) {
        Ok(ImageFormat::Jpeg) => "image/jpeg",
        Ok(ImageFormat::Png) => "image/png",
        Ok(ImageFormat::WebP) => "image/webp",
        _ => "image/png",
    };
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(format!("data:{mime};base64,{encoded}"))
}
