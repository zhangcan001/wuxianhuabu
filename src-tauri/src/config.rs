use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AiConfig {
    #[serde(default = "default_provider_mode")]
    pub(crate) provider_mode: String,
    #[serde(default)]
    pub(crate) custom_api_url: String,
    #[serde(default)]
    pub(crate) custom_api_key: String,
    #[serde(default = "default_auth_type")]
    pub(crate) custom_auth_type: String,
    #[serde(default)]
    pub(crate) custom_headers_json: String,
    #[serde(default = "default_model")]
    pub(crate) custom_model: String,
    #[serde(default = "default_custom_api_kind")]
    pub(crate) custom_api_kind: String,
    #[serde(default = "default_custom_result_mode")]
    pub(crate) custom_result_mode: String,
    #[serde(default = "default_image_path")]
    pub(crate) custom_image_path: String,
    #[serde(default = "default_body_template")]
    pub(crate) custom_body_template: String,
    #[serde(default)]
    pub(crate) comfy_enabled: bool,
    #[serde(default = "default_comfy_base_url")]
    pub(crate) comfy_base_url: String,
    #[serde(default)]
    pub(crate) positive_node_id: String,
    #[serde(default)]
    pub(crate) workflow_json: String,
    #[serde(default)]
    pub(crate) comfy_image_positive_node_id: String,
    #[serde(default)]
    pub(crate) comfy_image_workflow_json: String,
    #[serde(default)]
    pub(crate) comfy_video_positive_node_id: String,
    #[serde(default)]
    pub(crate) comfy_video_workflow_json: String,
    #[serde(default = "default_comfy_timeout_seconds")]
    pub(crate) comfy_timeout_seconds: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PublicAiConfig {
    pub(crate) provider_mode: String,
    pub(crate) custom_api_url: String,
    pub(crate) custom_api_key: String,
    pub(crate) custom_api_key_saved: bool,
    pub(crate) custom_auth_type: String,
    pub(crate) custom_headers_json: String,
    pub(crate) custom_model: String,
    pub(crate) custom_api_kind: String,
    pub(crate) custom_result_mode: String,
    pub(crate) custom_image_path: String,
    pub(crate) custom_body_template: String,
    pub(crate) comfy_enabled: bool,
    pub(crate) comfy_base_url: String,
    pub(crate) positive_node_id: String,
    pub(crate) workflow_json: String,
    pub(crate) comfy_image_positive_node_id: String,
    pub(crate) comfy_image_workflow_json: String,
    pub(crate) comfy_video_positive_node_id: String,
    pub(crate) comfy_video_workflow_json: String,
    pub(crate) comfy_timeout_seconds: String,
    pub(crate) config_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SaveAiConfigRequest {
    pub(crate) provider_mode: Option<String>,
    pub(crate) custom_api_url: Option<String>,
    pub(crate) custom_api_key: Option<String>,
    pub(crate) custom_api_key_clear: Option<bool>,
    pub(crate) custom_auth_type: Option<String>,
    pub(crate) custom_headers_json: Option<String>,
    pub(crate) custom_model: Option<String>,
    pub(crate) custom_api_kind: Option<String>,
    pub(crate) custom_result_mode: Option<String>,
    pub(crate) custom_image_path: Option<String>,
    pub(crate) custom_body_template: Option<String>,
    pub(crate) comfy_enabled: Option<bool>,
    pub(crate) comfy_base_url: Option<String>,
    pub(crate) positive_node_id: Option<String>,
    pub(crate) workflow_json: Option<String>,
    pub(crate) comfy_image_positive_node_id: Option<String>,
    pub(crate) comfy_image_workflow_json: Option<String>,
    pub(crate) comfy_video_positive_node_id: Option<String>,
    pub(crate) comfy_video_workflow_json: Option<String>,
    pub(crate) comfy_timeout_seconds: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NovelApiConfig {
    #[serde(default)]
    pub(crate) factory_mode: String,
    #[serde(default)]
    pub(crate) api_provider: String,
    #[serde(default)]
    pub(crate) api_base_url: String,
    #[serde(default)]
    pub(crate) api_url: String,
    #[serde(default)]
    pub(crate) api_key: String,
    #[serde(default = "default_auth_type")]
    pub(crate) auth_type: String,
    #[serde(default)]
    pub(crate) headers_json: String,
    #[serde(default = "default_text_model")]
    pub(crate) api_model: String,
    #[serde(default = "default_novel_body_template")]
    pub(crate) body_template: String,
    #[serde(default = "default_novel_response_path")]
    pub(crate) response_path: String,
    #[serde(default)]
    pub(crate) schema: String,
}

impl Default for NovelApiConfig {
    fn default() -> Self {
        Self {
            factory_mode: "local".to_string(),
            api_provider: "openai".to_string(),
            api_base_url: String::new(),
            api_url: String::new(),
            api_key: String::new(),
            auth_type: default_auth_type(),
            headers_json: String::new(),
            api_model: default_text_model(),
            body_template: default_novel_body_template(),
            response_path: default_novel_response_path(),
            schema: String::new(),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PublicNovelApiConfig {
    pub(crate) factory_mode: String,
    pub(crate) api_provider: String,
    pub(crate) api_base_url: String,
    pub(crate) api_url: String,
    pub(crate) api_key: String,
    pub(crate) api_key_saved: bool,
    pub(crate) auth_type: String,
    pub(crate) headers_json: String,
    pub(crate) api_model: String,
    pub(crate) body_template: String,
    pub(crate) response_path: String,
    pub(crate) schema: String,
    pub(crate) config_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SaveNovelApiConfigRequest {
    pub(crate) factory_mode: Option<String>,
    pub(crate) api_provider: Option<String>,
    pub(crate) api_base_url: Option<String>,
    pub(crate) api_url: Option<String>,
    pub(crate) api_key: Option<String>,
    pub(crate) api_key_clear: Option<bool>,
    pub(crate) auth_type: Option<String>,
    pub(crate) headers_json: Option<String>,
    pub(crate) api_model: Option<String>,
    pub(crate) body_template: Option<String>,
    pub(crate) response_path: Option<String>,
    pub(crate) schema: Option<String>,
}

pub(crate) fn read_config() -> Result<AiConfig, String> {
    let path = config_path()?;
    if !path.exists() {
        let config = AiConfig::default();
        write_config(&config)?;
        return Ok(config);
    }
    let raw = fs::read_to_string(path).map_err(|err| err.to_string())?;
    serde_json::from_str(&raw).map_err(|err| err.to_string())
}

pub(crate) fn write_config(config: &AiConfig) -> Result<(), String> {
    let path = config_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    let raw = serde_json::to_string_pretty(config).map_err(|err| err.to_string())?;
    fs::write(path, raw).map_err(|err| err.to_string())
}

pub(crate) fn remember_project_path(path: &PathBuf) -> Result<(), String> {
    let canonical = path
        .canonicalize()
        .unwrap_or_else(|_| path.to_path_buf())
        .to_string_lossy()
        .to_string();
    let mut paths = read_recent_projects()?;
    paths.retain(|item| item != &canonical && PathBuf::from(item).exists());
    paths.insert(0, canonical);
    paths.truncate(10);
    write_recent_projects(&paths)
}

pub(crate) fn read_recent_projects() -> Result<Vec<String>, String> {
    let path = recent_projects_path()?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(path).map_err(|err| err.to_string())?;
    let paths: Vec<String> = serde_json::from_str(&raw).unwrap_or_default();
    Ok(paths
        .into_iter()
        .filter(|item| PathBuf::from(item).exists())
        .collect())
}

fn write_recent_projects(paths: &[String]) -> Result<(), String> {
    let path = recent_projects_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    let raw = serde_json::to_string_pretty(paths).map_err(|err| err.to_string())?;
    fs::write(path, raw).map_err(|err| err.to_string())
}

pub(crate) fn app_data_dir() -> Result<PathBuf, String> {
    let home = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .ok_or_else(|| "无法定位用户目录".to_string())?;
    Ok(PathBuf::from(home).join(".wuxianhuabu"))
}

fn config_path() -> Result<PathBuf, String> {
    Ok(app_data_dir()?.join("ai-config.json"))
}

fn recent_projects_path() -> Result<PathBuf, String> {
    Ok(app_data_dir()?.join("recent-projects.json"))
}

fn novel_api_config_path() -> Result<PathBuf, String> {
    Ok(app_data_dir()?.join("novel-api-config.json"))
}

pub(crate) fn gemini_cancel_path(request_id: &str) -> Result<PathBuf, String> {
    Ok(app_data_dir()?.join(format!("gemini-cancel-{}.flag", sanitize_file_name(request_id))))
}

fn sanitize_file_name(value: &str) -> String {
    value
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' { ch } else { '_' })
        .collect()
}

pub(crate) fn read_novel_api_config() -> Result<NovelApiConfig, String> {
    let path = novel_api_config_path()?;
    if !path.exists() {
        return Ok(NovelApiConfig::default());
    }
    let raw = fs::read_to_string(path).map_err(|err| err.to_string())?;
    serde_json::from_str(&raw).map_err(|err| err.to_string())
}

pub(crate) fn write_novel_api_config(config: &NovelApiConfig) -> Result<(), String> {
    let path = novel_api_config_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    let raw = serde_json::to_string_pretty(config).map_err(|err| err.to_string())?;
    fs::write(path, raw).map_err(|err| err.to_string())
}

pub(crate) fn public_config(config: AiConfig) -> PublicAiConfig {
    let path = config_path()
        .map(|path| path.to_string_lossy().to_string())
        .unwrap_or_default();
    let custom_api_key_saved = !config.custom_api_key.is_empty();
    PublicAiConfig {
        provider_mode: config.provider_mode,
        custom_api_url: config.custom_api_url,
        custom_api_key: config.custom_api_key,
        custom_api_key_saved,
        custom_auth_type: config.custom_auth_type,
        custom_headers_json: config.custom_headers_json,
        custom_model: config.custom_model,
        custom_api_kind: config.custom_api_kind,
        custom_result_mode: config.custom_result_mode,
        custom_image_path: config.custom_image_path,
        custom_body_template: config.custom_body_template,
        comfy_enabled: config.comfy_enabled,
        comfy_base_url: config.comfy_base_url,
        positive_node_id: config.positive_node_id,
        workflow_json: config.workflow_json,
        comfy_image_positive_node_id: config.comfy_image_positive_node_id,
        comfy_image_workflow_json: config.comfy_image_workflow_json,
        comfy_video_positive_node_id: config.comfy_video_positive_node_id,
        comfy_video_workflow_json: config.comfy_video_workflow_json,
        comfy_timeout_seconds: config.comfy_timeout_seconds,
        config_path: path,
    }
}

pub(crate) fn public_novel_api_config(config: NovelApiConfig) -> PublicNovelApiConfig {
    let path = novel_api_config_path()
        .map(|path| path.to_string_lossy().to_string())
        .unwrap_or_default();
    let api_key_saved = !config.api_key.is_empty();
    PublicNovelApiConfig {
        factory_mode: config.factory_mode,
        api_provider: config.api_provider,
        api_base_url: config.api_base_url,
        api_url: config.api_url,
        api_key: config.api_key,
        api_key_saved,
        auth_type: config.auth_type,
        headers_json: config.headers_json,
        api_model: config.api_model,
        body_template: config.body_template,
        response_path: config.response_path,
        schema: config.schema,
        config_path: path,
    }
}

fn default_provider_mode() -> String {
    "mock".to_string()
}

pub(crate) fn default_auth_type() -> String {
    "bearer".to_string()
}

fn default_model() -> String {
    "gpt-image-1".to_string()
}

fn default_custom_api_kind() -> String {
    "direct-image".to_string()
}

fn default_custom_result_mode() -> String {
    "auto".to_string()
}

pub(crate) fn default_text_model() -> String {
    "gpt-4o-mini".to_string()
}

pub(crate) fn default_qwen_model() -> String {
    "qwen-plus".to_string()
}

pub(crate) fn default_novel_body_template() -> String {
    serde_json::json!({
        "model": "{{model}}",
        "messages": [
            {
                "role": "system",
                "content": "你是成熟的漫剧编剧、剧本审稿人和AI提示词导演。按照用户模板处理当前步骤。"
            },
            {
                "role": "user",
                "content": "步骤模板：\n{{template}}\n\n输出结构：\n{{schema}}\n\n当前步骤输入：\n{{input}}"
            }
        ],
        "temperature": 0.4
    })
    .to_string()
}

pub(crate) fn normalize_novel_body_template(template: &str) -> String {
    let raw = template.trim();
    let looks_like_old_factory_template = raw.contains("转换模板")
        || raw.contains("小说内容")
        || raw.contains("把小说转成可生产的漫剧资产")
        || raw.contains("人物3视图及面部特写提示词");
    let has_step_input = raw.contains("{{input}}") && raw.contains("当前步骤输入");
    let has_required_slots =
        raw.contains("{{template}}") && raw.contains("{{schema}}") && raw.contains("{{model}}");
    if raw.is_empty() || looks_like_old_factory_template || !has_step_input || !has_required_slots {
        default_novel_body_template()
    } else {
        raw.to_string()
    }
}

pub(crate) fn default_qwen_body_template() -> String {
    serde_json::json!({
        "model": "{{model}}",
        "input": {
            "messages": [
                {
                    "role": "system",
                    "content": "{{template}}\n\n请严格输出符合以下 schema 的 JSON：\n{{schema}}"
                },
                {
                    "role": "user",
                    "content": "{{novel}}"
                }
            ]
        },
        "parameters": {
            "temperature": 0.7,
            "result_format": "message"
        }
    })
    .to_string()
}

pub(crate) fn default_qwen_compatible_body_template() -> String {
    serde_json::json!({
        "model": "{{model}}",
        "messages": [
            {
                "role": "system",
                "content": "{{template}}\n\n请严格输出符合以下 schema 的 JSON：\n{{schema}}"
            },
            {
                "role": "user",
                "content": "{{novel}}"
            }
        ],
        "temperature": 0.7
    })
    .to_string()
}

pub(crate) fn default_modelscope_minimax_body_template() -> String {
    serde_json::json!({
        "model": "{{model}}",
        "messages": [
            {
                "role": "system",
                "content": "{{template}}\n\n请严格输出符合以下 schema 的 JSON：\n{{schema}}"
            },
            {
                "role": "user",
                "content": "{{input}}"
            }
        ],
        "temperature": 0.4,
        "stream": true
    })
    .to_string()
}

pub(crate) fn default_novel_response_path() -> String {
    "choices.0.message.content".to_string()
}

pub(crate) fn default_qwen_response_path() -> String {
    "output.choices.0.message.content".to_string()
}

pub(crate) fn default_qwen_base_url() -> String {
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation".to_string()
}

pub(crate) fn default_qwen_compatible_base_url() -> String {
    "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions".to_string()
}

fn default_image_path() -> String {
    "data.0.url".to_string()
}

pub(crate) fn default_gemini_url() -> String {
    "https://gemini.google.com/app".to_string()
}

pub(crate) fn default_gemini_timeout_seconds() -> u64 {
    240
}

pub(crate) fn default_gemini_login_timeout_seconds() -> u64 {
    180
}

pub(crate) fn default_gemini_parallel_count() -> u64 {
    1
}

pub(crate) fn default_gemini_split_mode() -> String {
    "paragraph".to_string()
}

fn default_comfy_base_url() -> String {
    "http://127.0.0.1:8188".to_string()
}

fn default_comfy_timeout_seconds() -> String {
    "600".to_string()
}

fn default_body_template() -> String {
    serde_json::json!({
        "model": "{{model}}",
        "prompt": "{{prompt}}",
        "size": "{{size}}"
    })
    .to_string()
}

impl Default for AiConfig {
    fn default() -> Self {
        Self {
            provider_mode: default_provider_mode(),
            custom_api_url: String::new(),
            custom_api_key: String::new(),
            custom_auth_type: default_auth_type(),
            custom_headers_json: String::new(),
            custom_model: default_model(),
            custom_api_kind: default_custom_api_kind(),
            custom_result_mode: default_custom_result_mode(),
            custom_image_path: default_image_path(),
            comfy_enabled: false,
            comfy_base_url: default_comfy_base_url(),
            positive_node_id: String::new(),
            workflow_json: String::new(),
            comfy_image_positive_node_id: String::new(),
            comfy_image_workflow_json: String::new(),
            comfy_video_positive_node_id: String::new(),
            comfy_video_workflow_json: String::new(),
            comfy_timeout_seconds: default_comfy_timeout_seconds(),
            custom_body_template: serde_json::to_string_pretty(&serde_json::json!({
                "model": "{{model}}",
                "prompt": "{{prompt}}",
                "size": "{{size}}"
            }))
            .unwrap(),
        }
    }
}
