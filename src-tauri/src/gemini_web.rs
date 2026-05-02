use crate::config::{app_data_dir, default_gemini_url, gemini_cancel_path};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    fs,
    io::{BufRead, BufReader, Read},
    path::PathBuf,
    process::{Command, Stdio},
    sync::OnceLock,
};
use tauri::Emitter;

static GEMINI_WEB_LOCK: OnceLock<tokio::sync::Mutex<()>> = OnceLock::new();

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GeminiWebRequest {
    #[serde(default)]
    pub(crate) request_id: String,
    #[serde(default)]
    pub(crate) cancel_path: String,
    pub(crate) prompt: String,
    #[serde(default = "default_gemini_url")]
    pub(crate) gemini_url: String,
    #[serde(default = "crate::config::default_gemini_timeout_seconds")]
    pub(crate) timeout_seconds: u64,
    #[serde(default = "crate::config::default_gemini_login_timeout_seconds")]
    pub(crate) login_timeout_seconds: u64,
    #[serde(default = "crate::config::default_gemini_parallel_count")]
    pub(crate) parallel_count: u64,
    #[serde(default = "crate::config::default_gemini_split_mode")]
    pub(crate) split_mode: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GeminiWebResponse {
    pub(crate) image_url: String,
    #[serde(default)]
    pub(crate) images: Vec<GeminiWebImage>,
    pub(crate) note: String,
    pub(crate) profile_dir: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GeminiWebImage {
    pub(crate) image_url: String,
    pub(crate) note: String,
    #[serde(default)]
    pub(crate) index: u64,
    #[serde(default)]
    pub(crate) source_prompt: String,
}

pub(crate) fn open_chrome_login(request: GeminiWebRequest) -> Result<GeminiWebResponse, String> {
    let chrome = chrome_executable()?;
    let profile_dir = chrome_profile_dir()?;
    fs::create_dir_all(&profile_dir).map_err(|err| err.to_string())?;
    Command::new(chrome)
        .arg(format!("--user-data-dir={}", profile_dir.to_string_lossy()))
        .arg("--profile-directory=Default")
        .arg("--remote-debugging-port=9223")
        .arg("--no-first-run")
        .arg(if request.gemini_url.trim().is_empty() {
            default_gemini_url()
        } else {
            request.gemini_url
        })
        .spawn()
        .map_err(|err| format!("启动 Google Chrome 失败：{err}"))?;
    Ok(GeminiWebResponse {
        image_url: String::new(),
        images: Vec::new(),
        note: "已用普通 Google Chrome 打开 Gemini 登录窗口".to_string(),
        profile_dir: profile_dir.to_string_lossy().to_string(),
    })
}

pub(crate) async fn run_worker(
    app: tauri::AppHandle,
    request: GeminiWebRequest,
) -> Result<GeminiWebResponse, String> {
    if request.prompt.trim().is_empty() {
        return Err("提示词不能为空".to_string());
    }
    let _gemini_guard = GEMINI_WEB_LOCK
        .get_or_init(|| tokio::sync::Mutex::new(()))
        .try_lock()
        .map_err(|_| "已有 Gemini 网页自动化任务正在运行。请等待完成，或先取消当前任务后再提交。".to_string())?;
    let worker_path = worker_path()?;
    if !worker_path.exists() {
        return Err(format!("找不到 Gemini 网页自动化脚本：{}", worker_path.to_string_lossy()));
    }
    let mut request = request;
    let cancel_path = gemini_cancel_path(&request.request_id)?;
    let _ = fs::remove_file(&cancel_path);
    request.cancel_path = cancel_path.to_string_lossy().to_string();
    let data_dir = app_data_dir()?;
    let request_path = data_dir.join(format!(
        "gemini-web-request-{}.json",
        sanitize_file_name(&request.request_id)
    ));
    fs::create_dir_all(&data_dir).map_err(|err| err.to_string())?;
    let raw = serde_json::to_string_pretty(&request).map_err(|err| err.to_string())?;
    fs::write(&request_path, raw).map_err(|err| err.to_string())?;

    let output = tokio::task::spawn_blocking(move || run_worker_process(app, worker_path, request_path))
        .await
        .map_err(|err| err.to_string())??;

    parse_worker_output(output)
}

fn run_worker_process(
    app: tauri::AppHandle,
    worker_path: PathBuf,
    request_path: PathBuf,
) -> Result<(std::process::ExitStatus, Option<Value>, String, String), String> {
    let mut child = Command::new("node")
        .arg(worker_path)
        .arg(request_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|err| format!("启动 Node/Playwright 失败：{err}。请确认已安装 Node.js，并已执行 npm install。"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "无法读取 Gemini worker stdout".to_string())?;
    let mut stderr = child
        .stderr
        .take()
        .ok_or_else(|| "无法读取 Gemini worker stderr".to_string())?;

    let stderr_handle = std::thread::spawn(move || {
        let mut text = String::new();
        let _ = stderr.read_to_string(&mut text);
        text
    });

    let reader = BufReader::new(stdout);
    let mut final_value: Option<Value> = None;
    let mut stdout_preview = String::new();
    for line in reader.lines() {
        let line = line.map_err(|err| err.to_string())?;
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if stdout_preview.len() < 1200 {
            stdout_preview.push_str(trimmed);
            stdout_preview.push('\n');
        }
        if let Ok(value) = serde_json::from_str::<Value>(trimmed) {
            match value.get("type").and_then(Value::as_str) {
                Some("progress") => {
                    let _ = app.emit("gemini-web-image", value);
                }
                Some("final") => {
                    final_value = Some(value);
                }
                _ => {
                    final_value = Some(value);
                }
            }
        }
    }

    let status = child.wait().map_err(|err| err.to_string())?;
    let stderr_text = stderr_handle.join().unwrap_or_default();
    Ok((status, final_value, stdout_preview, stderr_text))
}

fn parse_worker_output(
    output: (std::process::ExitStatus, Option<Value>, String, String),
) -> Result<GeminiWebResponse, String> {
    let (status, final_value, stdout, stderr) = output;
    let value = final_value.ok_or_else(|| {
        format!(
            "Gemini 网页自动化没有返回最终结果\nstdout: {}\nstderr: {}",
            stdout.chars().take(800).collect::<String>(),
            stderr.chars().take(800).collect::<String>()
        )
    })?;
    if !status.success() || value.get("ok").and_then(Value::as_bool) == Some(false) {
        let message = value
            .get("error")
            .and_then(Value::as_str)
            .unwrap_or_else(|| stderr.trim());
        return Err(if message.is_empty() {
            "Gemini 网页自动化失败".to_string()
        } else {
            message.to_string()
        });
    }
    Ok(GeminiWebResponse {
        image_url: value.get("imageUrl").and_then(Value::as_str).unwrap_or_default().to_string(),
        images: serde_json::from_value(value.get("images").cloned().unwrap_or(Value::Array(Vec::new())))
            .unwrap_or_default(),
        note: value
            .get("note")
            .and_then(Value::as_str)
            .unwrap_or("Gemini 网页自动化生成")
            .to_string(),
        profile_dir: value.get("profileDir").and_then(Value::as_str).unwrap_or_default().to_string(),
    })
}

fn worker_path() -> Result<PathBuf, String> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    Ok(manifest_dir
        .parent()
        .ok_or_else(|| "无法定位项目目录".to_string())?
        .join("scripts")
        .join("gemini-web-worker.cjs"))
}

fn chrome_profile_dir() -> Result<PathBuf, String> {
    Ok(app_data_dir()?.join("gemini-chrome-profile"))
}

fn chrome_executable() -> Result<PathBuf, String> {
    let candidates = [
        std::env::var_os("PROGRAMFILES")
            .map(|base| PathBuf::from(base).join("Google\\Chrome\\Application\\chrome.exe")),
        std::env::var_os("PROGRAMFILES(X86)")
            .map(|base| PathBuf::from(base).join("Google\\Chrome\\Application\\chrome.exe")),
        std::env::var_os("LOCALAPPDATA")
            .map(|base| PathBuf::from(base).join("Google\\Chrome\\Application\\chrome.exe")),
    ];
    for candidate in candidates.into_iter().flatten() {
        if candidate.exists() {
            return Ok(candidate);
        }
    }
    Ok(PathBuf::from("chrome"))
}

fn sanitize_file_name(value: &str) -> String {
    value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '_'
            }
        })
        .collect()
}
