use crate::config::{app_data_dir, remember_project_path};
use serde::{Deserialize, Serialize};
use std::{fs, io::{Read, Write}, path::{Path, PathBuf}, time::UNIX_EPOCH};
use tauri_plugin_dialog::DialogExt;
use zip::{write::SimpleFileOptions, ZipWriter};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectFileRequest {
    pub(crate) content: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectPathRequest {
    pub(crate) path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectPathSaveRequest {
    pub(crate) path: String,
    pub(crate) content: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ExportFileRequest {
    pub(crate) file_name: String,
    pub(crate) content: String,
    pub(crate) extension: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DeliveryPackageSaveRequest {
    pub(crate) file_name: String,
    pub(crate) package_json: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectCacheSaveRequest {
    pub(crate) content: String,
    #[serde(default)]
    pub(crate) project_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CacheMediaRequest {
    pub(crate) media_url: String,
    pub(crate) media_type: String,
    #[serde(default)]
    pub(crate) file_name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PickMediaFileRequest {
    #[serde(default)]
    pub(crate) media_type: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DeleteMediaCacheRequest {
    pub(crate) paths: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectFileResponse {
    pub(crate) content: Option<String>,
    pub(crate) path: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProjectCacheResponse {
    pub(crate) content: Option<String>,
    pub(crate) project_path: String,
    pub(crate) cache_path: String,
    pub(crate) updated_at: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CacheMediaResponse {
    pub(crate) path: String,
    pub(crate) file_name: String,
    pub(crate) thumbnail_path: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PickMediaFileResponse {
    pub(crate) path: Option<String>,
    pub(crate) file_name: Option<String>,
    pub(crate) size: u64,
    pub(crate) media_type: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MediaCacheFile {
    pub(crate) path: String,
    pub(crate) file_name: String,
    pub(crate) size: u64,
    pub(crate) modified_at: u64,
    pub(crate) is_thumbnail: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MediaCacheIndexResponse {
    pub(crate) files: Vec<MediaCacheFile>,
    pub(crate) total_size: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DeleteMediaCacheResponse {
    pub(crate) deleted: Vec<String>,
    pub(crate) skipped: Vec<String>,
    pub(crate) errors: Vec<String>,
}

pub(crate) fn save_project_file(
    app: tauri::AppHandle,
    request: ProjectFileRequest,
) -> Result<ProjectFileResponse, String> {
    let Some(path) = app
        .dialog()
        .file()
        .add_filter("无限画布工程", &["wuxianhuabu.json", "json"])
        .set_file_name("wuxianhuabu-project.wuxianhuabu.json")
        .blocking_save_file()
    else {
        return Ok(ProjectFileResponse {
            content: None,
            path: None,
        });
    };
    let path = path
        .as_path()
        .ok_or_else(|| "无法解析保存路径".to_string())?
        .to_path_buf();
    fs::write(&path, request.content).map_err(|err| err.to_string())?;
    remember_project_path(&path)?;
    Ok(ProjectFileResponse {
        content: None,
        path: Some(path.to_string_lossy().to_string()),
    })
}

pub(crate) fn open_project_file(app: tauri::AppHandle) -> Result<ProjectFileResponse, String> {
    let Some(path) = app
        .dialog()
        .file()
        .add_filter("无限画布工程", &["wuxianhuabu.json", "json"])
        .blocking_pick_file()
    else {
        return Ok(ProjectFileResponse {
            content: None,
            path: None,
        });
    };
    let path = path
        .as_path()
        .ok_or_else(|| "无法解析打开路径".to_string())?
        .to_path_buf();
    let content = fs::read_to_string(&path).map_err(|err| err.to_string())?;
    remember_project_path(&path)?;
    Ok(ProjectFileResponse {
        content: Some(content),
        path: Some(path.to_string_lossy().to_string()),
    })
}

pub(crate) fn pick_media_file(
    app: tauri::AppHandle,
    request: PickMediaFileRequest,
) -> Result<PickMediaFileResponse, String> {
    let media_type = if request.media_type.trim() == "video" { "video" } else { "image" };
    let mut dialog = app.dialog().file();
    dialog = if media_type == "video" {
        dialog.add_filter("视频素材", &["mp4", "mov", "webm", "m4v"])
    } else {
        dialog.add_filter("图片素材", &["png", "jpg", "jpeg", "webp"])
    };
    let Some(path) = dialog.blocking_pick_file() else {
        return Ok(PickMediaFileResponse {
            path: None,
            file_name: None,
            size: 0,
            media_type: media_type.to_string(),
        });
    };
    let path = path
        .as_path()
        .ok_or_else(|| "无法解析媒体文件路径".to_string())?
        .to_path_buf();
    let metadata = fs::metadata(&path).map_err(|err| err.to_string())?;
    Ok(PickMediaFileResponse {
        file_name: path.file_name().map(|value| value.to_string_lossy().to_string()),
        path: Some(path.to_string_lossy().to_string()),
        size: metadata.len(),
        media_type: media_type.to_string(),
    })
}

pub(crate) fn save_project_file_to_path(
    request: ProjectPathSaveRequest,
) -> Result<ProjectFileResponse, String> {
    let path = PathBuf::from(request.path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    fs::write(&path, request.content).map_err(|err| err.to_string())?;
    remember_project_path(&path)?;
    Ok(ProjectFileResponse {
        content: None,
        path: Some(path.to_string_lossy().to_string()),
    })
}

pub(crate) fn open_project_file_at_path(
    request: ProjectPathRequest,
) -> Result<ProjectFileResponse, String> {
    let path = PathBuf::from(request.path);
    let content = fs::read_to_string(&path).map_err(|err| err.to_string())?;
    remember_project_path(&path)?;
    Ok(ProjectFileResponse {
        content: Some(content),
        path: Some(path.to_string_lossy().to_string()),
    })
}

pub(crate) fn save_export_file(
    app: tauri::AppHandle,
    request: ExportFileRequest,
) -> Result<ProjectFileResponse, String> {
    let extension = request.extension.trim().trim_start_matches('.').to_lowercase();
    let extension = if extension.is_empty() {
        "txt".to_string()
    } else {
        extension
    };
    let filter_name = match extension.as_str() {
        "md" => "Markdown",
        "json" => "JSON 清单",
        _ => "文本文件",
    };
    let default_name = if request.file_name.trim().is_empty() {
        format!("export.{extension}")
    } else {
        request.file_name.trim().to_string()
    };
    let Some(path) = app
        .dialog()
        .file()
        .add_filter(filter_name, &[extension.as_str()])
        .set_file_name(&default_name)
        .blocking_save_file()
    else {
        return Ok(ProjectFileResponse {
            content: None,
            path: None,
        });
    };
    let path = path
        .as_path()
        .ok_or_else(|| "无法解析导出路径".to_string())?
        .to_path_buf();
    fs::write(&path, request.content).map_err(|err| err.to_string())?;
    Ok(ProjectFileResponse {
        content: None,
        path: Some(path.to_string_lossy().to_string()),
    })
}

pub(crate) fn save_delivery_package(
    app: tauri::AppHandle,
    request: DeliveryPackageSaveRequest,
) -> Result<ProjectFileResponse, String> {
    let Some(base_dir) = app.dialog().file().blocking_pick_folder() else {
        return Ok(ProjectFileResponse {
            content: None,
            path: None,
        });
    };
    let base_dir = base_dir
        .as_path()
        .ok_or_else(|| "无法解析工程包保存目录".to_string())?
        .to_path_buf();
    let folder_name = sanitize_package_folder_name(&request.file_name);
    let target_dir = base_dir.join(&folder_name);
    fs::create_dir_all(&target_dir).map_err(|err| err.to_string())?;
    fs::write(target_dir.join("package.json"), &request.package_json).map_err(|err| err.to_string())?;

    if let Ok(value) = serde_json::from_str::<serde_json::Value>(&request.package_json) {
        write_json_section(&target_dir, "manifest.json", value.get("manifest"))?;
        write_json_section(&target_dir, "timeline.json", value.get("timeline"))?;
        write_json_section(&target_dir, "shots.json", value.get("shots"))?;
        write_json_section(&target_dir, "assets.json", value.get("assets"))?;
        write_json_section(&target_dir, "media-references.json", value.get("mediaReferences"))?;
        write_json_section(&target_dir, "output-spec.json", value.get("outputSpec"))?;
        let media_manifest = copy_delivery_package_media(&target_dir, value.get("mediaReferences"))?;
        let media_manifest_content =
            serde_json::to_string_pretty(&media_manifest).map_err(|err| err.to_string())?;
        fs::write(target_dir.join("media-manifest.json"), media_manifest_content)
            .map_err(|err| err.to_string())?;
    }
    let zip_path = base_dir.join(format!("{folder_name}.zip"));
    write_delivery_package_zip(&target_dir, &zip_path)?;

    Ok(ProjectFileResponse {
        content: None,
        path: Some(zip_path.to_string_lossy().to_string()),
    })
}

fn write_delivery_package_zip(source_dir: &Path, zip_path: &Path) -> Result<(), String> {
    let file = fs::File::create(zip_path).map_err(|err| err.to_string())?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    append_directory_to_zip(&mut zip, source_dir, source_dir, options)?;
    zip.finish().map_err(|err| err.to_string())?;
    Ok(())
}

fn append_directory_to_zip(
    zip: &mut ZipWriter<fs::File>,
    base_dir: &Path,
    current_dir: &Path,
    options: SimpleFileOptions,
) -> Result<(), String> {
    for entry in fs::read_dir(current_dir).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let path = entry.path();
        let relative = path.strip_prefix(base_dir).map_err(|err| err.to_string())?;
        let name = relative.to_string_lossy().replace('\\', "/");
        if path.is_dir() {
            if !name.is_empty() {
                zip.add_directory(format!("{name}/"), options).map_err(|err| err.to_string())?;
            }
            append_directory_to_zip(zip, base_dir, &path, options)?;
        } else {
            zip.start_file(name, options).map_err(|err| err.to_string())?;
            let mut file = fs::File::open(&path).map_err(|err| err.to_string())?;
            let mut buffer = Vec::new();
            file.read_to_end(&mut buffer).map_err(|err| err.to_string())?;
            zip.write_all(&buffer).map_err(|err| err.to_string())?;
        }
    }
    Ok(())
}

fn copy_delivery_package_media(
    target_dir: &PathBuf,
    media_references: Option<&serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let mut copied = Vec::new();
    let mut missing = Vec::new();
    let mut skipped = Vec::new();
    let Some(items) = media_references.and_then(|value| value.as_array()) else {
        return Ok(serde_json::json!({
            "copied": copied,
            "missing": missing,
            "skipped": skipped,
        }));
    };
    for item in items {
        let source = item
            .get("path")
            .and_then(|value| value.as_str())
            .filter(|value| !value.trim().is_empty())
            .or_else(|| {
                item.get("url")
                    .and_then(|value| value.as_str())
                    .filter(|value| is_local_file_reference(value))
            })
            .unwrap_or("");
        let package_path = item
            .get("packagePath")
            .and_then(|value| value.as_str())
            .unwrap_or("");
        if source.trim().is_empty() || package_path.trim().is_empty() {
            skipped.push(media_manifest_item(item, source, package_path, "no_local_source"));
            continue;
        }
        let source_path = normalize_local_media_path(source);
        if !source_path.exists() {
            missing.push(media_manifest_item(item, source, package_path, "missing_source"));
            continue;
        }
        let relative_path = safe_relative_package_path(package_path);
        let destination = target_dir.join(relative_path);
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent).map_err(|err| err.to_string())?;
        }
        match fs::copy(&source_path, &destination) {
            Ok(size) => copied.push(serde_json::json!({
                "owner": item.get("owner").cloned().unwrap_or(serde_json::Value::Null),
                "id": item.get("id").cloned().unwrap_or(serde_json::Value::Null),
                "kind": item.get("kind").cloned().unwrap_or(serde_json::Value::Null),
                "source": source,
                "packagePath": package_path,
                "size": size,
            })),
            Err(err) => missing.push(serde_json::json!({
                "owner": item.get("owner").cloned().unwrap_or(serde_json::Value::Null),
                "id": item.get("id").cloned().unwrap_or(serde_json::Value::Null),
                "kind": item.get("kind").cloned().unwrap_or(serde_json::Value::Null),
                "source": source,
                "packagePath": package_path,
                "reason": err.to_string(),
            })),
        }
    }
    Ok(serde_json::json!({
        "copied": copied,
        "missing": missing,
        "skipped": skipped,
    }))
}

fn media_manifest_item(
    item: &serde_json::Value,
    source: &str,
    package_path: &str,
    reason: &str,
) -> serde_json::Value {
    serde_json::json!({
        "owner": item.get("owner").cloned().unwrap_or(serde_json::Value::Null),
        "id": item.get("id").cloned().unwrap_or(serde_json::Value::Null),
        "kind": item.get("kind").cloned().unwrap_or(serde_json::Value::Null),
        "source": source,
        "packagePath": package_path,
        "reason": reason,
    })
}

fn normalize_local_media_path(value: &str) -> PathBuf {
    let trimmed = value.trim();
    if let Some(path) = trimmed.strip_prefix("file://") {
        PathBuf::from(path.trim_start_matches('/'))
    } else {
        PathBuf::from(trimmed)
    }
}

fn is_local_file_reference(value: &str) -> bool {
    let text = value.trim();
    text.starts_with("file://")
        || text.starts_with("\\\\")
        || (text.len() > 2 && text.as_bytes()[1] == b':' && (text.as_bytes()[2] == b'\\' || text.as_bytes()[2] == b'/'))
}

fn safe_relative_package_path(value: &str) -> PathBuf {
    let mut path = PathBuf::new();
    for part in value.replace('\\', "/").split('/') {
        let clean = sanitize_package_folder_name(part);
        if !clean.is_empty() && clean != "." && clean != ".." {
            path.push(clean);
        }
    }
    if path.as_os_str().is_empty() {
        path.push("media");
        path.push("item.bin");
    }
    path
}

fn write_json_section(
    target_dir: &PathBuf,
    file_name: &str,
    value: Option<&serde_json::Value>,
) -> Result<(), String> {
    let Some(value) = value else {
        return Ok(());
    };
    let content = serde_json::to_string_pretty(value).map_err(|err| err.to_string())?;
    fs::write(target_dir.join(file_name), content).map_err(|err| err.to_string())
}

fn sanitize_package_folder_name(value: &str) -> String {
    let trimmed = value.trim().trim_end_matches(".json").trim_end_matches(".zip").trim();
    let cleaned: String = trimmed
        .chars()
        .map(|ch| match ch {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '-',
            _ if ch.is_control() => '-',
            _ => ch,
        })
        .collect();
    let cleaned = cleaned.trim_matches([' ', '.']).trim();
    if cleaned.is_empty() {
        "delivery-package".to_string()
    } else {
        cleaned.to_string()
    }
}

pub(crate) fn save_project_cache(
    request: ProjectCacheSaveRequest,
) -> Result<ProjectCacheResponse, String> {
    let path = project_cache_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    let payload = serde_json::json!({
        "content": request.content,
        "projectPath": request.project_path,
        "updatedAt": current_timestamp(),
    });
    let raw = serde_json::to_string_pretty(&payload).map_err(|err| err.to_string())?;
    fs::write(&path, raw).map_err(|err| err.to_string())?;
    Ok(ProjectCacheResponse {
        content: None,
        project_path: request.project_path,
        cache_path: path.to_string_lossy().to_string(),
        updated_at: current_timestamp(),
    })
}

pub(crate) fn load_project_cache() -> Result<ProjectCacheResponse, String> {
    let path = project_cache_path()?;
    if !path.exists() {
        return Ok(ProjectCacheResponse {
            content: None,
            project_path: String::new(),
            cache_path: path.to_string_lossy().to_string(),
            updated_at: 0,
        });
    }
    let raw = fs::read_to_string(&path).map_err(|err| err.to_string())?;
    let payload: serde_json::Value = serde_json::from_str(&raw).map_err(|err| err.to_string())?;
    let updated_at = fs::metadata(&path)
        .ok()
        .and_then(|meta| meta.modified().ok())
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs())
        .unwrap_or_else(current_timestamp);
    Ok(ProjectCacheResponse {
        content: payload
            .get("content")
            .and_then(|value| value.as_str())
            .map(|value| value.to_string()),
        project_path: payload
            .get("projectPath")
            .and_then(|value| value.as_str())
            .unwrap_or_default()
            .to_string(),
        cache_path: path.to_string_lossy().to_string(),
        updated_at,
    })
}

pub(crate) fn clear_project_cache() -> Result<ProjectCacheResponse, String> {
    let path = project_cache_path()?;
    if path.exists() {
        fs::remove_file(&path).map_err(|err| err.to_string())?;
    }
    Ok(ProjectCacheResponse {
        content: None,
        project_path: String::new(),
        cache_path: path.to_string_lossy().to_string(),
        updated_at: 0,
    })
}

pub(crate) async fn cache_media_asset(
    request: CacheMediaRequest,
) -> Result<CacheMediaResponse, String> {
    let bytes = crate::media_utils::load_media_bytes(&request.media_url).await?;
    let extension = crate::media_utils::infer_media_extension(&request.media_url, &request.media_type);
    let stem = sanitize_file_name(if request.file_name.trim().is_empty() {
        "media"
    } else {
        request.file_name.trim()
    });
    let file_name = format!("{stem}-{}.{}", current_timestamp_millis(), extension);
    let path = app_data_dir()?.join("media-cache").join(&file_name);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    fs::write(&path, bytes).map_err(|err| err.to_string())?;
    let thumbnail_path = if request.media_type == "image" {
        create_image_thumbnail(&path, &file_name).ok()
    } else {
        None
    };
    Ok(CacheMediaResponse {
        path: path.to_string_lossy().to_string(),
        file_name,
        thumbnail_path,
    })
}

pub(crate) fn list_media_cache() -> Result<MediaCacheIndexResponse, String> {
    let root = app_data_dir()?.join("media-cache");
    let mut files = Vec::new();
    if root.exists() {
        collect_media_cache_files(&root, &mut files)?;
    }
    let total_size = files.iter().map(|file| file.size).sum();
    Ok(MediaCacheIndexResponse { files, total_size })
}

pub(crate) fn delete_media_cache_files(
    request: DeleteMediaCacheRequest,
) -> Result<DeleteMediaCacheResponse, String> {
    let root = app_data_dir()?.join("media-cache");
    fs::create_dir_all(&root).map_err(|err| err.to_string())?;
    let root = root.canonicalize().map_err(|err| err.to_string())?;
    let mut deleted = Vec::new();
    let mut skipped = Vec::new();
    let mut errors = Vec::new();

    for raw_path in request.paths {
        let candidate = PathBuf::from(raw_path.trim());
        if raw_path.trim().is_empty() || !candidate.exists() {
            skipped.push(raw_path);
            continue;
        }
        let Ok(path) = candidate.canonicalize() else {
            skipped.push(raw_path);
            continue;
        };
        if !path.starts_with(&root) || !path.is_file() {
            skipped.push(raw_path);
            continue;
        }
        match fs::remove_file(&path) {
            Ok(()) => deleted.push(path.to_string_lossy().to_string()),
            Err(err) => errors.push(format!("{}: {err}", path.to_string_lossy())),
        }
    }

    Ok(DeleteMediaCacheResponse {
        deleted,
        skipped,
        errors,
    })
}

fn create_image_thumbnail(path: &PathBuf, file_name: &str) -> Result<String, String> {
    let image = image::open(path).map_err(|err| format!("缩略图解码失败：{err}"))?;
    let thumbnail = image.thumbnail(420, 420);
    let thumb_name = format!("{file_name}.thumb.png");
    let thumb_path = app_data_dir()?.join("media-cache").join("thumbs").join(thumb_name);
    if let Some(parent) = thumb_path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    thumbnail
        .save(&thumb_path)
        .map_err(|err| format!("缩略图保存失败：{err}"))?;
    Ok(thumb_path.to_string_lossy().to_string())
}

fn collect_media_cache_files(path: &PathBuf, files: &mut Vec<MediaCacheFile>) -> Result<(), String> {
    for entry in fs::read_dir(path).map_err(|err| err.to_string())? {
        let entry = entry.map_err(|err| err.to_string())?;
        let entry_path = entry.path();
        let metadata = entry.metadata().map_err(|err| err.to_string())?;
        if metadata.is_dir() {
            collect_media_cache_files(&entry_path, files)?;
            continue;
        }
        if !metadata.is_file() {
            continue;
        }
        let modified_at = metadata
            .modified()
            .ok()
            .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
            .map(|duration| duration.as_secs())
            .unwrap_or(0);
        let file_name = entry_path
            .file_name()
            .map(|value| value.to_string_lossy().to_string())
            .unwrap_or_default();
        let normalized = entry_path.to_string_lossy().replace('\\', "/");
        files.push(MediaCacheFile {
            path: entry_path.to_string_lossy().to_string(),
            file_name,
            size: metadata.len(),
            modified_at,
            is_thumbnail: normalized.contains("/thumbs/"),
        });
    }
    Ok(())
}

fn project_cache_path() -> Result<PathBuf, String> {
    Ok(app_data_dir()?.join("cache").join("project-recovery.json"))
}

fn current_timestamp() -> u64 {
    UNIX_EPOCH.elapsed().map(|duration| duration.as_secs()).unwrap_or(0)
}

fn current_timestamp_millis() -> u128 {
    UNIX_EPOCH.elapsed().map(|duration| duration.as_millis()).unwrap_or(0)
}

fn sanitize_file_name(value: &str) -> String {
    let sanitized: String = value
        .chars()
        .map(|ch| if "\\/:*?\"<>|".contains(ch) { '_' } else { ch })
        .take(60)
        .collect();
    if sanitized.trim().is_empty() {
        "media".to_string()
    } else {
        sanitized
    }
}
