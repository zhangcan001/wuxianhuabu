use crate::config::{
    default_auth_type, default_text_model, normalize_novel_body_template, read_novel_api_config,
    AiConfig,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GenerateImageRequest {
    pub(crate) prompt: String,
    #[serde(default)]
    pub(crate) custom_model: String,
    #[serde(default)]
    pub(crate) custom_image_path: String,
    #[serde(default)]
    pub(crate) image_size: String,
    #[serde(default)]
    pub(crate) aspect_ratio: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GenerateImageResponse {
    pub(crate) image_url: String,
    pub(crate) note: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CustomImageApiDiagnosticResponse {
    pub(crate) success: bool,
    pub(crate) normalized_api_kind: String,
    pub(crate) normalized_result_mode: String,
    pub(crate) looks_like_draw_url: bool,
    pub(crate) first_response_content_type: String,
    pub(crate) first_response_key_summary: String,
    pub(crate) first_response_top_level_keys: Vec<String>,
    pub(crate) first_response_nested_keys: Vec<String>,
    pub(crate) detected_image_field: String,
    pub(crate) detected_task_id: String,
    pub(crate) has_image_field: bool,
    pub(crate) has_task_id: bool,
    pub(crate) will_poll: bool,
    pub(crate) image_preview: String,
    pub(crate) note: String,
    pub(crate) error: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NovelFactoryRequest {
    pub(crate) api_url: String,
    #[serde(default)]
    pub(crate) api_key: String,
    #[serde(default = "default_auth_type")]
    pub(crate) auth_type: String,
    #[serde(default)]
    pub(crate) headers_json: String,
    #[serde(default = "default_text_model")]
    pub(crate) model: String,
    pub(crate) body_template: String,
    pub(crate) response_path: String,
    pub(crate) novel: String,
    #[serde(default)]
    pub(crate) input: String,
    pub(crate) template: String,
    pub(crate) schema: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NovelFactoryResponse {
    pub(crate) text: String,
    pub(crate) note: String,
}

pub(crate) async fn run_custom_api_generation(
    config: &AiConfig,
    request: &GenerateImageRequest,
) -> Result<GenerateImageResponse, String> {
    if config.custom_api_url.trim().is_empty() {
        return Err("请先填写自定义 API URL".to_string());
    }

    let headers = build_headers(config)?;
    let prompt = request.prompt.trim();
    let model = if request.custom_model.trim().is_empty() {
        config.custom_model.as_str()
    } else {
        request.custom_model.trim()
    };
    let image_size = if request.image_size.trim().is_empty() {
        "1024x1024"
    } else {
        request.image_size.trim()
    };
    let aspect_ratio = if request.aspect_ratio.trim().is_empty() {
        "auto"
    } else {
        request.aspect_ratio.trim()
    };
    let image_path = if request.custom_image_path.trim().is_empty() {
        config.custom_image_path.as_str()
    } else {
        request.custom_image_path.trim()
    };
    validate_custom_image_api_config(
        config.custom_api_url.trim(),
        &config.custom_api_kind,
        &config.custom_result_mode,
        image_path,
    )?;
    let body = build_body(config, prompt, model, image_size, aspect_ratio)?;
    let client = reqwest::Client::new();
    let response = client
        .post(config.custom_api_url.trim())
        .headers(headers.clone())
        .json(&body)
        .send()
        .await
        .map_err(|err| format!("自定义 API 请求失败：{err}"))?;

    let status = response.status();
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_string();

    if !status.is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(format!(
            "自定义 API 请求失败：HTTP {status} {}",
            text.chars().take(240).collect::<String>()
        ));
    }

    if content_type.starts_with("image/") {
        use base64::Engine;
        let bytes = response.bytes().await.map_err(|err| err.to_string())?;
        let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
        return Ok(GenerateImageResponse {
            image_url: format!("data:{content_type};base64,{encoded}"),
            note: "自定义 API · image response".to_string(),
        });
    }

    let response_text = response
        .text()
        .await
        .map_err(|err| format!("自定义 API 响应读取失败：{err}"))?;
    let json: Value = if response_text.trim_start().starts_with("data:") {
        extract_final_json_from_sse(&response_text)?
    } else {
        serde_json::from_str(&response_text).map_err(|err| format!("响应不是有效 JSON：{err}"))?
    };
    if let Some(error) = api_error_from_json(&json) {
        return Err(error);
    }
    let json = if let Some(task_id) = extract_draw_task_id(
        &config.custom_api_url,
        &config.custom_api_kind,
        &json,
    ) {
        poll_draw_result(config, &client, headers.clone(), &task_id).await?
    } else {
        json
    };
    let image_value = extract_image_from_response(&json, image_path)?;
    Ok(GenerateImageResponse {
        image_url: normalize_image_result(&image_value),
        note: format!("自定义 API · {}", model),
    })
}

pub(crate) async fn diagnose_custom_api_generation(
    config: &AiConfig,
    request: &GenerateImageRequest,
) -> CustomImageApiDiagnosticResponse {
    let normalized_api_kind = normalize_custom_api_kind(&config.custom_api_kind).to_string();
    let normalized_result_mode = normalize_custom_result_mode(&config.custom_result_mode).to_string();
    let looks_like_draw_url = is_drawish_url(config.custom_api_url.trim());
    let model = if request.custom_model.trim().is_empty() {
        config.custom_model.trim().to_string()
    } else {
        request.custom_model.trim().to_string()
    };
    let image_size = if request.image_size.trim().is_empty() {
        "1024x1024".to_string()
    } else {
        request.image_size.trim().to_string()
    };
    let aspect_ratio = if request.aspect_ratio.trim().is_empty() {
        "auto".to_string()
    } else {
        request.aspect_ratio.trim().to_string()
    };
    let image_path = if request.custom_image_path.trim().is_empty() {
        config.custom_image_path.trim().to_string()
    } else {
        request.custom_image_path.trim().to_string()
    };
    let mut report = CustomImageApiDiagnosticResponse {
        success: false,
        normalized_api_kind,
        normalized_result_mode,
        looks_like_draw_url,
        first_response_content_type: String::new(),
        first_response_key_summary: String::new(),
        first_response_top_level_keys: Vec::new(),
        first_response_nested_keys: Vec::new(),
        detected_image_field: String::new(),
        detected_task_id: String::new(),
        has_image_field: false,
        has_task_id: false,
        will_poll: false,
        image_preview: String::new(),
        note: if model.is_empty() {
            "自定义图片 API 诊断".to_string()
        } else {
            format!("自定义图片 API 诊断 · {}", model)
        },
        error: String::new(),
    };

    if config.custom_api_url.trim().is_empty() {
        report.error = "请先填写自定义 API URL".to_string();
        return report;
    }

    if let Err(error) = validate_custom_image_api_config(
        config.custom_api_url.trim(),
        &config.custom_api_kind,
        &config.custom_result_mode,
        &image_path,
    ) {
        report.error = error;
        return report;
    }

    let headers = match build_headers(config) {
        Ok(value) => value,
        Err(error) => {
            report.error = error;
            return report;
        }
    };
    let body = match build_body(config, request.prompt.trim(), &model, &image_size, &aspect_ratio) {
        Ok(value) => value,
        Err(error) => {
            report.error = error;
            return report;
        }
    };

    let client = reqwest::Client::new();
    let response = match client
        .post(config.custom_api_url.trim())
        .headers(headers.clone())
        .json(&body)
        .send()
        .await
    {
        Ok(value) => value,
        Err(error) => {
            report.error = format!("自定义 API 请求失败：{error}");
            return report;
        }
    };

    let status = response.status();
    report.first_response_content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_string();

    if !status.is_success() {
        let text = response.text().await.unwrap_or_default();
        report.error = format!(
            "自定义 API 请求失败：HTTP {status} {}",
            text.chars().take(240).collect::<String>()
        );
        return report;
    }

    if report.first_response_content_type.starts_with("image/") {
        report.success = true;
        report.has_image_field = true;
        report.detected_image_field = "binary-image-response".to_string();
        report.first_response_key_summary = "二进制图片响应".to_string();
        report.image_preview = format!("data:{};base64,...", report.first_response_content_type);
        return report;
    }

    let response_text = match response.text().await {
        Ok(value) => value,
        Err(error) => {
            report.error = format!("自定义 API 响应读取失败：{error}");
            return report;
        }
    };
    let first_json: Value = if response_text.trim_start().starts_with("data:") {
        match extract_final_json_from_sse(&response_text) {
            Ok(value) => value,
            Err(error) => {
                report.error = error;
                return report;
            }
        }
    } else {
        match serde_json::from_str(&response_text) {
            Ok(value) => value,
            Err(error) => {
                report.error = format!("响应不是有效 JSON：{error}");
                return report;
            }
        }
    };

    report.first_response_top_level_keys = top_level_keys(&first_json);
    report.first_response_nested_keys = collect_nested_keys(&first_json, 20);
    report.first_response_key_summary = summarize_top_level_keys(&first_json);
    if let Some((_, field)) = extract_image_from_response_with_source(&first_json, &image_path) {
        report.has_image_field = true;
        report.detected_image_field = field;
    }
    if let Some(task_id) = extract_draw_task_id(
        &config.custom_api_url,
        &config.custom_api_kind,
        &first_json,
    ) {
        report.has_task_id = true;
        report.detected_task_id = task_id.clone();
        report.will_poll = true;
        match poll_draw_result(config, &client, headers.clone(), &task_id).await {
            Ok(polled_json) => {
                if !report.has_image_field {
                    if let Some((_, field)) = extract_image_from_response_with_source(&polled_json, &image_path) {
                        report.has_image_field = true;
                        report.detected_image_field = field;
                    }
                }
                if let Ok(image) = extract_image_from_response(&polled_json, &image_path) {
                    report.success = true;
                    report.image_preview = truncate_media_preview(&normalize_image_result(&image));
                } else if let Some(error) = api_error_from_json(&polled_json) {
                    report.error = error;
                }
            }
            Err(error) => {
                report.error = error;
            }
        }
        return report;
    }

    match extract_image_from_response(&first_json, &image_path) {
        Ok(image) => {
            report.success = true;
            report.image_preview = truncate_media_preview(&normalize_image_result(&image));
        }
        Err(error) => {
            report.error = error;
        }
    }
    report
}

pub(crate) async fn run_novel_factory_api(
    request: NovelFactoryRequest,
) -> Result<NovelFactoryResponse, String> {
    let saved = read_novel_api_config().unwrap_or_default();
    let raw_api_url = if request.api_url.trim().is_empty() {
        if saved.api_url.trim().is_empty() {
            saved.api_base_url.clone()
        } else {
            saved.api_url.clone()
        }
    } else {
        request.api_url.clone()
    };
    let api_url = normalize_chat_completions_url(&raw_api_url);
    if api_url.trim().is_empty() {
        return Err("请填写小说工厂 API URL".to_string());
    }
    if request.novel.trim().is_empty() {
        return Err("请填写小说内容".to_string());
    }
    let api_key = if request.api_key.trim().is_empty() {
        saved.api_key.clone()
    } else {
        request.api_key.clone()
    };
    let auth_type = if request.auth_type.trim().is_empty() {
        saved.auth_type.clone()
    } else {
        request.auth_type.clone()
    };
    let headers_json = if request.headers_json.trim().is_empty() {
        saved.headers_json.clone()
    } else {
        request.headers_json.clone()
    };
    let mut effective_request = request;
    if effective_request.model.trim().is_empty() {
        effective_request.model = saved.api_model.clone();
    }
    if effective_request.body_template.trim().is_empty() {
        effective_request.body_template = saved.body_template.clone();
    }
    effective_request.body_template = normalize_novel_body_template(&effective_request.body_template);
    if effective_request.response_path.trim().is_empty() {
        effective_request.response_path = saved.response_path.clone();
    }
    effective_request.auth_type = auth_type.clone();
    effective_request.headers_json = headers_json.clone();
    let headers = build_generic_headers(&api_key, &auth_type, &headers_json)?;
    let body = build_novel_factory_body(&effective_request)?;
    let response = reqwest::Client::new()
        .post(&api_url)
        .headers(headers)
        .json(&body)
        .send()
        .await
        .map_err(|err| format!("小说工厂 API 请求失败：{err}"))?;
    let status = response.status();
    if !status.is_success() {
        let text = response.text().await.unwrap_or_default();
        if status.as_u16() == 405 {
            return Err(format!("小说工厂 API 请求失败：HTTP 405。请确认完整接口地址为 {api_url}，不要只填写到 /compatible-mode/v1。{}", text.chars().take(260).collect::<String>()));
        }
        return Err(format!(
            "小说工厂 API 请求失败：HTTP {status} {}",
            text.chars().take(260).collect::<String>()
        ));
    }
    let response_text = response
        .text()
        .await
        .map_err(|err| format!("小说工厂 API 响应读取失败：{err}"))?;
    let text = if response_text.trim_start().starts_with("data:") {
        extract_text_from_sse_response(&response_text, &effective_request.response_path)?
    } else {
        let json: Value = serde_json::from_str(&response_text)
            .map_err(|err| format!("小说工厂 API 响应不是有效 JSON：{err}"))?;
        extract_text_from_response(&json, &effective_request.response_path)?
    };
    Ok(NovelFactoryResponse {
        text,
        note: format!("小说工厂 API · {}", effective_request.model),
    })
}

fn build_headers(config: &AiConfig) -> Result<reqwest::header::HeaderMap, String> {
    build_generic_headers(
        &config.custom_api_key,
        &config.custom_auth_type,
        &config.custom_headers_json,
    )
}

fn build_generic_headers(
    api_key: &str,
    auth_type: &str,
    headers_json: &str,
) -> Result<reqwest::header::HeaderMap, String> {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(reqwest::header::CONTENT_TYPE, "application/json".parse().unwrap());

    if !headers_json.trim().is_empty() {
        let values: HashMap<String, String> = serde_json::from_str(headers_json)
            .map_err(|err| format!("额外请求头 JSON 无效：{err}"))?;
        for (key, value) in values {
            let name =
                reqwest::header::HeaderName::from_bytes(key.as_bytes()).map_err(|err| err.to_string())?;
            let value =
                reqwest::header::HeaderValue::from_str(&value).map_err(|err| err.to_string())?;
            headers.insert(name, value);
        }
    }

    let api_key = api_key.trim();
    if !api_key.is_empty() {
        match auth_type {
            "bearer" | "authorization" => {
                let value = format!("Bearer {api_key}");
                headers.insert(
                    reqwest::header::AUTHORIZATION,
                    value.parse().map_err(|err| format!("{err}"))?,
                );
            }
            "x-api-key" => {
                headers.insert("x-api-key", api_key.parse().map_err(|err| format!("{err}"))?);
            }
            _ => {}
        }
    }
    Ok(headers)
}

fn build_body(
    config: &AiConfig,
    prompt: &str,
    model: &str,
    image_size: &str,
    aspect_ratio: &str,
) -> Result<Value, String> {
    let replaced = config
        .custom_body_template
        .replace("{{prompt}}", &escape_json_string(prompt.trim()))
        .replace("{{model}}", &escape_json_string(model))
        .replace("{{size}}", image_size)
        .replace("{{aspectRatio}}", aspect_ratio);
    serde_json::from_str(&replaced).map_err(|err| format!("请求体模板不是有效 JSON：{err}"))
}

fn build_novel_factory_body(request: &NovelFactoryRequest) -> Result<Value, String> {
    let input = if request.input.trim().is_empty() {
        request.novel.as_str()
    } else {
        request.input.as_str()
    };
    let replaced = request
        .body_template
        .replace("{{novel}}", &escape_json_string(&request.novel))
        .replace("{{input}}", &escape_json_string(input))
        .replace("{{template}}", &escape_json_string(&request.template))
        .replace("{{model}}", &escape_json_string(&request.model))
        .replace("{{schema}}", &escape_json_string(&request.schema));
    serde_json::from_str(&replaced).map_err(|err| format!("小说工厂请求体模板不是有效 JSON：{err}"))
}

fn normalize_chat_completions_url(value: &str) -> String {
    let base = value.trim().trim_end_matches('/');
    if base.is_empty() {
        return String::new();
    }
    if base.ends_with("/chat/completions") || base.ends_with("/responses") || base.ends_with("/messages")
    {
        return base.to_string();
    }
    format!("{base}/chat/completions")
}

fn extract_image_from_response(json: &Value, image_path: &str) -> Result<String, String> {
    let candidates = [
        image_path,
        "data.0.url",
        "data.0.b64_json",
        "results.0.url",
        "data.results.0.url",
        "result.0.url",
        "data.result.0.url",
        "data.images.0.url",
        "data.imageUrl",
        "data.image_url",
        "imageUrl",
        "image_url",
        "images.0.url",
        "images.0",
        "image",
        "url",
        "b64_json",
    ];
    for candidate in candidates.iter().filter(|value| !value.is_empty()) {
        if let Some(value) = get_by_path(json, candidate).and_then(Value::as_str) {
            if !value.trim().is_empty() {
                return Ok(value.trim().to_string());
            }
        }
    }
    if let Some(value) = find_first_image_field(json) {
        return Ok(value);
    }
    let keys = json
        .as_object()
        .map(|object| object.keys().cloned().collect::<Vec<_>>().join(", "))
        .unwrap_or_default();
    Err(format!("响应里没有找到图片字段，请检查结果图片路径。响应键：{keys}"))
}

fn find_first_image_field(value: &Value) -> Option<String> {
    match value {
        Value::Array(items) => items.iter().find_map(find_first_image_field),
        Value::Object(object) => {
            for key in ["url", "imageUrl", "image_url", "b64_json", "base64", "image"] {
                if let Some(text) = object.get(key).and_then(Value::as_str) {
                    let text = text.trim();
                    if !text.is_empty() && looks_like_image_value(text) {
                        return Some(text.to_string());
                    }
                }
            }
            for key in ["results", "result", "images", "data", "output"] {
                if let Some(image) = object.get(key).and_then(find_first_image_field) {
                    return Some(image);
                }
            }
            object.values().find_map(find_first_image_field)
        }
        Value::String(text) => {
            let text = text.trim();
            if looks_like_image_value(text) {
                Some(text.to_string())
            } else {
                None
            }
        }
        _ => None,
    }
}

fn looks_like_image_value(text: &str) -> bool {
    text.starts_with("http://")
        || text.starts_with("https://")
        || text.starts_with("data:image/")
        || text.starts_with("blob:")
        || text.len() > 300
}

fn truncate_media_preview(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.len() <= 120 {
        trimmed.to_string()
    } else {
        format!("{}...", trimmed.chars().take(120).collect::<String>())
    }
}

fn normalize_custom_api_kind(value: &str) -> &str {
    match value.trim() {
        "openai-compatible" | "draw-poll" | "direct-image" => value.trim(),
        _ => "direct-image",
    }
}

fn normalize_custom_result_mode(value: &str) -> &str {
    match value.trim() {
        "url" | "base64" | "task-id" | "auto" => value.trim(),
        _ => "auto",
    }
}

fn validate_custom_image_api_config(
    api_url: &str,
    api_kind: &str,
    result_mode: &str,
    image_path: &str,
) -> Result<(), String> {
    let normalized_kind = normalize_custom_api_kind(api_kind);
    let normalized_result_mode = normalize_custom_result_mode(result_mode);
    let lowered = api_url.trim().to_lowercase();
    let looks_like_draw_url =
        lowered.contains("/draw/") || lowered.ends_with("/draw") || lowered.contains("/v1/draw");
    if normalized_kind == "openai-compatible" && lowered.contains("/images/generations") {
        return Err("当前接口类型选择为 OpenAI 兼容聊天接口，但 URL 更像图片生成端点 `/images/generations`。请改成“直返图片接口”，或换成真正的聊天接口。".to_string());
    }
    if normalized_kind == "openai-compatible"
        && (lowered.contains("/chat/completions") || lowered.ends_with("/v1"))
        && normalized_result_mode == "task-id"
    {
        return Err("OpenAI 兼容聊天接口不会使用 `/v1/draw/result` 轮询。请把结果模式改成 `url/base64/auto`，或把接口类型切到火山 Draw 轮询。".to_string());
    }
    if normalized_kind == "draw-poll" && !looks_like_draw_url {
        return Err("当前接口类型选择为火山 Draw 轮询，但 URL 不像 draw 提交接口。请确认它类似 `/draw/...`，否则会在轮询阶段失败。".to_string());
    }
    if normalized_kind == "draw-poll" && normalized_result_mode != "task-id" {
        return Err("火山 Draw 轮询接口必须把结果模式设为 `task-id`，因为首轮返回的是任务 ID，不是图片本身。".to_string());
    }
    if normalized_kind == "direct-image" && normalized_result_mode == "task-id" {
        return Err("直返图片接口不应该使用 `task-id` 结果模式。请改成 `url`、`base64` 或 `auto`。".to_string());
    }
    if matches!(normalized_result_mode, "url" | "base64") && image_path.trim().is_empty() {
        return Err("当前结果模式需要明确结果图片路径，请填写例如 `data.0.url` 或 `data.0.b64_json`。".to_string());
    }
    Ok(())
}

fn is_drawish_url(api_url: &str) -> bool {
    let lowered = api_url.trim().trim_end_matches('/').to_lowercase();
    lowered.contains("/draw/") || lowered.ends_with("/draw") || lowered.contains("/v1/draw")
}

fn is_draw_submission_url(api_url: &str, api_kind: &str) -> bool {
    if normalize_custom_api_kind(api_kind) == "draw-poll" {
        return true;
    }
    let normalized = api_url.trim().trim_end_matches('/').to_lowercase();
    is_drawish_url(&normalized) || normalized.ends_with("/images/generations")
}

fn extract_draw_task_id(api_url: &str, api_kind: &str, json: &Value) -> Option<String> {
    if !is_draw_submission_url(api_url, api_kind) {
        return None;
    }
    if extract_image_from_response(json, "data.results.0.url").is_ok() {
        return None;
    }
    let id = get_by_path(json, "data.id")
        .or_else(|| get_by_path(json, "id"))
        .and_then(Value::as_str)?
        .trim()
        .to_string();
    if id.is_empty() { None } else { Some(id) }
}

fn api_error_from_json(json: &Value) -> Option<String> {
    let code = json.get("code").and_then(Value::as_i64);
    if matches!(code, Some(0)) || code.is_none() {
        return None;
    }
    let message = json
        .get("msg")
        .and_then(Value::as_str)
        .or_else(|| json.get("message").and_then(Value::as_str))
        .or_else(|| json.get("error").and_then(Value::as_str))
        .unwrap_or("接口返回业务错误");
    Some(format!(
        "自定义 API 返回错误：code={}，msg={}",
        code.unwrap_or_default(),
        message
    ))
}

fn draw_result_url(api_url: &str) -> String {
    let trimmed = api_url.trim().trim_end_matches('/');
    if trimmed.ends_with("/v1/draw/nano-banana") {
        trimmed.replace("/v1/draw/nano-banana", "/v1/draw/result")
    } else {
        format!("{}/v1/draw/result", trimmed.trim_end_matches("/v1/draw/nano-banana"))
    }
}

async fn poll_draw_result(
    config: &AiConfig,
    client: &reqwest::Client,
    headers: reqwest::header::HeaderMap,
    task_id: &str,
) -> Result<Value, String> {
    let result_url = draw_result_url(&config.custom_api_url);
    for _ in 0..90 {
        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        let response = client
            .post(&result_url)
            .headers(headers.clone())
            .json(&serde_json::json!({ "id": task_id }))
            .send()
            .await
            .map_err(|err| format!("绘画结果轮询失败：{err}"))?;
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        if !status.is_success() {
            return Err(format!(
                "绘画结果轮询失败：HTTP {status} {}",
                text.chars().take(240).collect::<String>()
            ));
        }
        let json: Value =
            serde_json::from_str(&text).map_err(|err| format!("绘画结果不是有效 JSON：{err}"))?;
        if let Some(error) = api_error_from_json(&json) {
            return Err(error);
        }
        let data = json.get("data").unwrap_or(&json);
        let status_text = data.get("status").and_then(Value::as_str).unwrap_or("");
        if status_text == "failed" {
            let error = data
                .get("error")
                .and_then(Value::as_str)
                .or_else(|| data.get("failure_reason").and_then(Value::as_str))
                .unwrap_or("未知错误");
            return Err(format!("绘画任务失败：{error}"));
        }
        if extract_image_from_response(&json, "data.results.0.url").is_ok() {
            return Ok(json);
        }
        if status_text == "succeeded" {
            return Err(format!("绘画任务成功但响应里没有图片 URL，请检查 GrsAI 返回结构。响应预览：{}", text.chars().take(360).collect::<String>()));
        }
    }
    Err("绘画任务超时：已等待 180 秒仍未返回图片".to_string())
}

fn extract_final_json_from_sse(text: &str) -> Result<Value, String> {
    let mut latest: Option<Value> = None;
    for line in text.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with("data:") {
            continue;
        }
        let payload = trimmed.trim_start_matches("data:").trim();
        if payload.is_empty() || payload == "[DONE]" {
            continue;
        }
        if let Ok(value) = serde_json::from_str::<Value>(payload) {
            latest = Some(value);
        }
    }
    latest.ok_or_else(|| "流式响应里没有找到有效 JSON".to_string())
}

fn extract_text_from_response(json: &Value, response_path: &str) -> Result<String, String> {
    let candidates = [
        response_path,
        "choices.0.message.content",
        "choices.0.message.reasoning_content",
        "choices.0.delta.content",
        "choices.0.text",
        "output.choices.0.message.content",
        "output_text",
        "text",
        "content",
        "data.text",
        "message.content",
    ];
    for candidate in candidates.iter().filter(|value| !value.is_empty()) {
        if let Some(text) = get_by_path(json, candidate).and_then(text_from_api_value) {
            return Ok(text);
        }
    }
    if let Some(text) = extract_text_from_choices(json.get("choices")) {
        return Ok(text);
    }
    if let Some(text) = find_first_text_field(json) {
        return Ok(text);
    }
    let keys = json
        .as_object()
        .map(|object| object.keys().cloned().collect::<Vec<_>>().join(", "))
        .unwrap_or_default();
    Err(format!("响应里没有找到文本字段，请检查结果路径。响应键：{keys}"))
}

fn extract_text_from_sse_response(text: &str, response_path: &str) -> Result<String, String> {
    let mut parts = Vec::new();
    for line in text.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with("data:") {
            continue;
        }
        let payload = trimmed.trim_start_matches("data:").trim();
        if payload.is_empty() || payload == "[DONE]" {
            continue;
        }
        if let Ok(json) = serde_json::from_str::<Value>(payload) {
            if let Ok(chunk) = extract_text_from_response(&json, response_path) {
                parts.push(chunk);
            }
        }
    }
    let joined = parts.join("");
    if joined.trim().is_empty() {
        Err("流式响应里没有找到文本字段".to_string())
    } else {
        Ok(joined.trim().to_string())
    }
}

fn extract_text_from_choices(value: Option<&Value>) -> Option<String> {
    let choices = value?.as_array()?;
    let mut parts = Vec::new();
    for choice in choices {
        let candidates = [
            choice.get("message").and_then(|message| message.get("content")),
            choice.get("message").and_then(|message| message.get("reasoning_content")),
            choice.get("delta").and_then(|delta| delta.get("content")),
            choice.get("text"),
            choice.get("content"),
        ];
        for candidate in candidates.into_iter().flatten() {
            if let Some(text) = text_from_api_value(candidate) {
                parts.push(text);
            }
        }
    }
    let joined = parts.join("");
    if joined.trim().is_empty() { None } else { Some(joined.trim().to_string()) }
}

fn text_from_api_value(value: &Value) -> Option<String> {
    match value {
        Value::String(text) => {
            let text = text.trim();
            if text.is_empty() { None } else { Some(text.to_string()) }
        }
        Value::Array(items) => {
            let parts = items.iter().filter_map(text_from_api_value).collect::<Vec<_>>();
            let joined = parts.join("\n");
            if joined.trim().is_empty() { None } else { Some(joined.trim().to_string()) }
        }
        Value::Object(object) => {
            for key in ["text", "content", "output_text", "reasoning_content"] {
                if let Some(text) = object.get(key).and_then(text_from_api_value) {
                    return Some(text);
                }
            }
            None
        }
        _ => None,
    }
}

fn find_first_text_field(value: &Value) -> Option<String> {
    match value {
        Value::Array(items) => items.iter().find_map(find_first_text_field),
        Value::Object(object) => {
            for key in ["content", "text", "output_text", "reasoning_content"] {
                if let Some(text) = object.get(key).and_then(text_from_api_value) {
                    return Some(text);
                }
            }
            object.values().find_map(find_first_text_field)
        }
        _ => None,
    }
}

fn get_by_path<'a>(value: &'a Value, path: &str) -> Option<&'a Value> {
    let mut current = value;
    for key in path.split('.').filter(|part| !part.is_empty()) {
        if let Ok(index) = key.parse::<usize>() {
            current = current.as_array()?.get(index)?;
        } else {
            current = current.as_object()?.get(key)?;
        }
    }
    Some(current)
}

fn extract_image_from_response_with_source(json: &Value, image_path: &str) -> Option<(String, String)> {
    let candidates = [
        image_path,
        "data.0.url",
        "data.0.b64_json",
        "results.0.url",
        "data.results.0.url",
        "result.0.url",
        "data.result.0.url",
        "data.images.0.url",
        "data.imageUrl",
        "data.image_url",
        "imageUrl",
        "image_url",
        "images.0.url",
        "images.0",
        "image",
        "url",
        "b64_json",
    ];
    for candidate in candidates.iter().filter(|value| !value.is_empty()) {
        if let Some(value) = get_by_path(json, candidate).and_then(Value::as_str) {
            if !value.trim().is_empty() {
                return Some((value.trim().to_string(), (*candidate).to_string()));
            }
        }
    }
    find_first_image_field(json).map(|value| (value, "auto-detected".to_string()))
}

fn top_level_keys(json: &Value) -> Vec<String> {
    match json {
        Value::Object(object) => object.keys().take(12).cloned().collect(),
        Value::Array(items) => vec![format!("array({})", items.len())],
        Value::String(_) => vec!["string".to_string()],
        Value::Number(_) => vec!["number".to_string()],
        Value::Bool(_) => vec!["boolean".to_string()],
        Value::Null => vec!["null".to_string()],
    }
}

fn summarize_top_level_keys(json: &Value) -> String {
    let keys = top_level_keys(json);
    if keys.is_empty() {
        "无顶层键".to_string()
    } else {
        keys.join(", ")
    }
}

fn collect_nested_keys(json: &Value, limit: usize) -> Vec<String> {
    let mut result = Vec::new();
    collect_nested_keys_inner(json, "", limit, &mut result);
    result
}

fn collect_nested_keys_inner(value: &Value, path: &str, limit: usize, result: &mut Vec<String>) {
    if result.len() >= limit {
        return;
    }
    match value {
        Value::Object(object) => {
            for (key, child) in object {
                if result.len() >= limit {
                    return;
                }
                let next_path = if path.is_empty() {
                    key.to_string()
                } else {
                    format!("{path}.{key}")
                };
                result.push(next_path.clone());
                collect_nested_keys_inner(child, &next_path, limit, result);
            }
        }
        Value::Array(items) => {
            if let Some(first) = items.first() {
                let next_path = if path.is_empty() {
                    "0".to_string()
                } else {
                    format!("{path}.0")
                };
                result.push(next_path.clone());
                collect_nested_keys_inner(first, &next_path, limit, result);
            }
        }
        _ => {}
    }
}

fn normalize_image_result(value: &str) -> String {
    if value.starts_with("http://")
        || value.starts_with("https://")
        || value.starts_with("data:image/")
        || value.starts_with("blob:")
    {
        value.to_string()
    } else {
        format!("data:image/png;base64,{value}")
    }
}

fn escape_json_string(value: &str) -> String {
    serde_json::to_string(value)
        .unwrap_or_else(|_| "\"\"".to_string())
        .trim_matches('"')
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn normalizes_chat_completion_urls() {
        assert_eq!(
            normalize_chat_completions_url("https://api.example.com/v1"),
            "https://api.example.com/v1/chat/completions"
        );
        assert_eq!(
            normalize_chat_completions_url("https://api.example.com/v1/chat/completions"),
            "https://api.example.com/v1/chat/completions"
        );
        assert_eq!(normalize_chat_completions_url("   "), "");
    }

    #[test]
    fn extracts_latest_json_from_sse() {
        let text = "data: {\"step\":1}\n\ndata: {\"ok\":true,\"value\":2}\n\ndata: [DONE]\n";
        let json = extract_final_json_from_sse(text).expect("should parse final json");
        assert_eq!(json.get("ok").and_then(Value::as_bool), Some(true));
        assert_eq!(json.get("value").and_then(Value::as_i64), Some(2));
    }

    #[test]
    fn extracts_text_from_json_and_sse() {
        let json = json!({
            "choices": [
                {
                    "message": {
                        "content": "hello"
                    }
                }
            ]
        });
        assert_eq!(
            extract_text_from_response(&json, "choices.0.message.content").unwrap(),
            "hello"
        );

        let sse = "data: {\"choices\":[{\"delta\":{\"content\":\"hel\"}}]}\n\
data: {\"choices\":[{\"delta\":{\"content\":\"lo\"}}]}\n\
data: [DONE]\n";
        assert_eq!(
            extract_text_from_sse_response(sse, "choices.0.delta.content").unwrap(),
            "hello"
        );
    }

    #[test]
    fn extracts_image_from_response_and_normalizes_base64() {
        let json = json!({
            "data": {
                "results": [
                    { "url": "https://cdn.example.com/image.png" }
                ]
            }
        });
        assert_eq!(
            extract_image_from_response(&json, "data.results.0.url").unwrap(),
            "https://cdn.example.com/image.png"
        );
        assert_eq!(
            normalize_image_result("abc123"),
            "data:image/png;base64,abc123"
        );
    }

    #[test]
    fn builds_draw_result_url_and_detects_task_id() {
        assert_eq!(
            draw_result_url("https://api.example.com/v1/draw/nano-banana"),
            "https://api.example.com/v1/draw/result"
        );
        let pending = json!({ "data": { "id": "task-1", "status": "pending" } });
        assert_eq!(
            extract_draw_task_id("https://api.example.com/v1/draw/nano-banana", "draw-poll", &pending).as_deref(),
            Some("task-1")
        );

        let finished = json!({
            "data": {
                "results": [
                    { "url": "https://cdn.example.com/image.png" }
                ]
            }
        });
        assert!(extract_draw_task_id("https://api.example.com/v1/draw/nano-banana", "draw-poll", &finished).is_none());
    }

    #[test]
    fn does_not_treat_openai_compatible_chat_ids_as_draw_tasks() {
        let chat_response = json!({
            "id": "chatcmpl-abc123",
            "choices": [
                {
                    "message": {
                        "content": "not an image"
                    }
                }
            ]
        });
        assert!(extract_draw_task_id("https://api.linapi.com/v1/chat/completions", "openai-compatible", &chat_response).is_none());
        assert!(extract_draw_task_id("https://api.linapi.com/v1", "openai-compatible", &chat_response).is_none());
    }

    #[test]
    fn validates_custom_image_api_modes_before_request() {
        let error = validate_custom_image_api_config(
            "https://api.linapi.com/v1/chat/completions",
            "openai-compatible",
            "task-id",
            "data.0.url",
        )
        .expect_err("chat completions should not use task-id polling");
        assert!(error.contains("不会使用 `/v1/draw/result` 轮询"));

        let error = validate_custom_image_api_config(
            "https://api.linapi.com/v1/chat/completions",
            "draw-poll",
            "task-id",
            "data.results.0.url",
        )
        .expect_err("draw poll should require draw endpoint");
        assert!(error.contains("URL 不像 draw 提交接口"));

        assert!(validate_custom_image_api_config(
            "https://api.example.com/v1/images/generations",
            "direct-image",
            "base64",
            "data.0.b64_json",
        )
        .is_ok());
    }

    #[test]
    fn follows_paths_and_reports_api_errors() {
        let json = json!({
            "output": {
                "choices": [
                    { "message": { "content": "done" } }
                ]
            }
        });
        assert_eq!(
            get_by_path(&json, "output.choices.0.message.content").and_then(Value::as_str),
            Some("done")
        );

        let error = json!({ "code": 4001, "msg": "bad request" });
        let message = api_error_from_json(&error).expect("should detect api error");
        assert!(message.contains("4001"));
        assert!(message.contains("bad request"));
    }

    #[test]
    fn reports_image_field_source_and_key_summary() {
        let json = json!({
            "data": {
                "results": [
                    { "url": "https://cdn.example.com/demo.png" }
                ]
            },
            "id": "task-1"
        });
        let (_, source) = extract_image_from_response_with_source(&json, "data.results.0.url")
            .expect("should find image field");
        assert_eq!(source, "data.results.0.url");
        assert_eq!(summarize_top_level_keys(&json), "data, id");
        assert_eq!(
            collect_nested_keys(&json, 6),
            vec![
                "data".to_string(),
                "data.results".to_string(),
                "data.results.0".to_string(),
                "data.results.0.url".to_string(),
                "id".to_string(),
            ]
        );
    }
}
