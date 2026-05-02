use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ComfyWorkflowRequest {
    pub(crate) base_url: String,
    pub(crate) workflow_json: String,
    pub(crate) positive_node_id: String,
    pub(crate) prompt: String,
    pub(crate) kind: String,
    pub(crate) timeout_seconds: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ComfyConnectionRequest {
    pub(crate) base_url: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ComfyWorkflowResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) image_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) image_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) image_thumbnail_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) image_thumbnail_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) video_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) video_path: Option<String>,
    pub(crate) note: String,
    #[serde(skip_serializing)]
    pub(crate) prompt_id: Option<String>,
}

pub(crate) async fn test_connection(request: ComfyConnectionRequest) -> Result<String, String> {
    let base_url = request.base_url.trim().trim_end_matches('/').to_string();
    if base_url.is_empty() {
        return Err("请填写 ComfyUI 地址".to_string());
    }
    let client = reqwest::Client::new();
    let mut last_error = String::new();
    for endpoint in ["system_stats", "object_info", "queue", ""] {
        let url = if endpoint.is_empty() {
            base_url.clone()
        } else {
            format!("{base_url}/{endpoint}")
        };
        match client.get(&url).send().await {
            Ok(response) if response.status().is_success() => {
                return Ok(format!(
                    "{} 可用 · {}",
                    base_url,
                    if endpoint.is_empty() { "首页" } else { endpoint }
                ));
            }
            Ok(response) => {
                last_error = format!("{} 返回 HTTP {}", url, response.status());
            }
            Err(error) => {
                last_error = format!("{} 无法访问：{}", url, error);
            }
        }
    }
    Err(format!(
        "ComfyUI 连接失败：{last_error}。请确认 ComfyUI 已启动，地址类似 http://127.0.0.1:8188。"
    ))
}

pub(crate) async fn run_workflow(
    request: ComfyWorkflowRequest,
) -> Result<ComfyWorkflowResponse, String> {
    if request.workflow_json.trim().is_empty() {
        return Err("请先粘贴 ComfyUI workflow JSON".to_string());
    }
    if request.positive_node_id.trim().is_empty() {
        return Err("请填写 ComfyUI 正向提示词节点 ID".to_string());
    }
    let mut workflow: Value = serde_json::from_str(&request.workflow_json)
        .map_err(|err| format!("ComfyUI workflow JSON 无效：{err}"))?;
    inject_prompt(&mut workflow, &request.positive_node_id, &request.prompt)?;
    let base_url = request.base_url.trim().trim_end_matches('/').to_string();
    let client_id = format!(
        "huoshan-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|err| err.to_string())?
            .as_millis()
    );
    let client = reqwest::Client::new();
    let submit = client
        .post(format!("{base_url}/prompt"))
        .json(&serde_json::json!({ "prompt": workflow, "client_id": client_id }))
        .send()
        .await
        .map_err(|err| format!("ComfyUI 提交失败：{err}"))?;
    let status = submit.status();
    if !status.is_success() {
        let text = submit.text().await.unwrap_or_default();
        return Err(format!(
            "ComfyUI 提交失败：HTTP {status} {}",
            text.chars().take(240).collect::<String>()
        ));
    }
    let submitted: Value = submit
        .json()
        .await
        .map_err(|err| format!("ComfyUI 提交响应无效：{err}"))?;
    let prompt_id = submitted
        .get("prompt_id")
        .and_then(Value::as_str)
        .ok_or_else(|| "ComfyUI 未返回 prompt_id".to_string())?
        .to_string();
    let timeout = request.timeout_seconds.clamp(30, 3600);
    let result = async {
        for _ in 0..timeout {
            tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            let history = client.get(format!("{base_url}/history/{prompt_id}")).send().await;
            let Ok(history) = history else {
                continue;
            };
            if !history.status().is_success() {
                continue;
            }
            let json: Value = match history.json().await {
                Ok(value) => value,
                Err(_) => continue,
            };
            let Some(item) = json.get(&prompt_id) else {
                continue;
            };
            if let Some(error) = extract_error(item) {
                return Err(error);
            }
            let (images, videos) = extract_media(&base_url, item);
            let short_id = prompt_id.chars().take(8).collect::<String>();
            if request.kind == "video" {
                if let Some(video_url) = videos.first() {
                    return Ok(ComfyWorkflowResponse {
                        image_url: None,
                        image_path: None,
                        image_thumbnail_url: None,
                        image_thumbnail_path: None,
                        video_url: Some(video_url.clone()),
                        video_path: None,
                        note: format!("ComfyUI 视频 · prompt {short_id}"),
                        prompt_id: Some(prompt_id.clone()),
                    });
                }
                if let Some(image_url) = images.first() {
                    return Ok(ComfyWorkflowResponse {
                        image_url: Some(image_url.clone()),
                        image_path: None,
                        image_thumbnail_url: None,
                        image_thumbnail_path: None,
                        video_url: None,
                        video_path: None,
                        note: format!("ComfyUI 视频工作流返回了图片 · prompt {short_id}"),
                        prompt_id: Some(prompt_id.clone()),
                    });
                }
            } else if let Some(image_url) = images.first() {
                return Ok(ComfyWorkflowResponse {
                    image_url: Some(image_url.clone()),
                    image_path: None,
                    image_thumbnail_url: None,
                    image_thumbnail_path: None,
                    video_url: None,
                    video_path: None,
                    note: format!("ComfyUI 生图 · prompt {short_id}"),
                    prompt_id: Some(prompt_id.clone()),
                });
            }
        }
        Err(format!(
            "ComfyUI 任务超时或没有输出{}",
            if request.kind == "video" { "视频" } else { "图片" }
        ))
    }
    .await;
    result
}

pub(crate) async fn cleanup_prompt_resources(client: &reqwest::Client, base_url: &str, prompt_id: &str) {
    let history_url = format!("{base_url}/history");
    let free_url = format!("{base_url}/free");
    let history_payload = serde_json::json!({ "delete": [prompt_id] });
    let free_payload = serde_json::json!({ "unload_models": true, "free_memory": true });

    let _ = client.post(history_url).json(&history_payload).send().await;
    let _ = client.post(free_url).json(&free_payload).send().await;
}

fn extract_error(item: &Value) -> Option<String> {
    let status = item.get("status")?;
    if status.get("completed").and_then(Value::as_bool) != Some(false) {
        return None;
    }
    let messages = status.get("messages")?.as_array()?;
    for message in messages {
        if let Some(parts) = message.as_array() {
            for part in parts {
                let Some(exception_message) =
                    part.get("exception_message").and_then(Value::as_str)
                else {
                    continue;
                };
                let trimmed = exception_message.trim();
                if !trimmed.is_empty() {
                    return Some(format!("ComfyUI 执行失败：{trimmed}"));
                }
            }
        }
    }
    None
}

fn inject_prompt(workflow: &mut Value, node_id: &str, prompt: &str) -> Result<(), String> {
    let inputs = workflow
        .get_mut(node_id)
        .and_then(|node| node.get_mut("inputs"))
        .and_then(Value::as_object_mut)
        .ok_or_else(|| format!("workflow 中找不到节点 {node_id}"))?;
    let key = ["text", "prompt", "positive", "caption", "string", "value"]
        .iter()
        .find(|key| inputs.contains_key(**key))
        .copied()
        .unwrap_or("text");
    inputs.insert(
        key.to_string(),
        Value::String(prompt.replace("@图", "图").trim().to_string()),
    );
    randomize_seeds(workflow);
    Ok(())
}

fn randomize_seeds(workflow: &mut Value) {
    let Some(nodes) = workflow.as_object_mut() else {
        return;
    };
    let now = current_seed_base();
    for (index, node) in nodes.values_mut().enumerate() {
        let Some(inputs) = node.get_mut("inputs").and_then(Value::as_object_mut) else {
            continue;
        };
        for key in ["seed", "noise_seed"] {
            if inputs.contains_key(key) {
                let seed = ((now + (index as u64 * 104_729)) % 2_147_483_647) as i64;
                inputs.insert(key.to_string(), Value::Number(seed.into()));
            }
        }
    }
}

fn current_seed_base() -> u64 {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos() as u64)
        .unwrap_or(1);
    nanos ^ nanos.rotate_left(17)
}

fn extract_media(base_url: &str, item: &Value) -> (Vec<String>, Vec<String>) {
    let mut images = Vec::new();
    let mut videos = Vec::new();
    let Some(outputs) = item.get("outputs").and_then(Value::as_object) else {
        return (images, videos);
    };
    for output in outputs.values() {
        for key in ["images"] {
            collect_files(base_url, output.get(key), &mut images, false);
        }
        for key in ["gifs", "videos", "animated"] {
            collect_files(base_url, output.get(key), &mut videos, true);
        }
        collect_nested_video_files(base_url, output, &mut videos);
    }
    images.sort();
    images.dedup();
    videos.sort();
    videos.dedup();
    (images, videos)
}

fn collect_files(base_url: &str, value: Option<&Value>, target: &mut Vec<String>, video_only: bool) {
    let Some(files) = value.and_then(Value::as_array) else {
        return;
    };
    for file in files {
        if let Some(url) = file_url(base_url, file, video_only) {
            target.push(url);
        }
    }
}

fn collect_nested_video_files(base_url: &str, value: &Value, target: &mut Vec<String>) {
    match value {
        Value::Array(items) => {
            for item in items {
                collect_nested_video_files(base_url, item, target);
            }
        }
        Value::Object(object) => {
            if let Some(url) = file_url(base_url, value, true) {
                target.push(url);
            }
            for child in object.values() {
                collect_nested_video_files(base_url, child, target);
            }
        }
        _ => {}
    }
}

fn file_url(base_url: &str, file: &Value, video_only: bool) -> Option<String> {
    let filename = file.get("filename").and_then(Value::as_str)?;
    if filename.trim().is_empty() {
        return None;
    }
    let lower = filename.to_ascii_lowercase();
    if video_only
        && !lower.ends_with(".mp4")
        && !lower.ends_with(".webm")
        && !lower.ends_with(".mov")
        && !lower.ends_with(".gif")
    {
        return None;
    }
    let subfolder = file.get("subfolder").and_then(Value::as_str).unwrap_or("");
    let file_type = file.get("type").and_then(Value::as_str).unwrap_or("output");
    Some(format!(
        "{base_url}/view?filename={}&subfolder={}&type={}",
        url_encode_component(filename),
        url_encode_component(subfolder),
        url_encode_component(file_type)
    ))
}

fn url_encode_component(value: &str) -> String {
    value
        .bytes()
        .flat_map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                vec![byte as char]
            }
            _ => format!("%{byte:02X}").chars().collect(),
        })
        .collect()
}
