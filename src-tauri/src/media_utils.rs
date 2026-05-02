use base64::Engine;
use image::{DynamicImage, ImageFormat};
use std::{borrow::Cow, fs, io::Cursor, path::PathBuf};

pub(crate) async fn load_image_bytes(image_url: &str) -> Result<Vec<u8>, String> {
    if let Some((meta, data)) = image_url.split_once(',') {
        if meta.starts_with("data:") {
            return base64::engine::general_purpose::STANDARD
                .decode(data)
                .map_err(|err| format!("base64 图片解码失败：{err}"));
        }
    }
    if image_url.starts_with("http://") || image_url.starts_with("https://") {
        let response = reqwest::get(image_url)
            .await
            .map_err(|err| format!("图片下载失败：{err}"))?;
        if !response.status().is_success() {
            return Err(format!("图片下载失败：HTTP {}", response.status()));
        }
        return response
            .bytes()
            .await
            .map(|bytes| bytes.to_vec())
            .map_err(|err| err.to_string());
    }
    fs::read(image_url).map_err(|err| format!("读取图片失败：{err}"))
}

pub(crate) async fn load_media_bytes(media_url: &str) -> Result<Vec<u8>, String> {
    if let Some((meta, data)) = media_url.split_once(',') {
        if meta.starts_with("data:") {
            return base64::engine::general_purpose::STANDARD
                .decode(data)
                .map_err(|err| format!("base64 媒体解码失败：{err}"));
        }
    }
    if media_url.starts_with("http://") || media_url.starts_with("https://") {
        let response = reqwest::get(media_url)
            .await
            .map_err(|err| format!("媒体下载失败：{err}"))?;
        if !response.status().is_success() {
            return Err(format!("媒体下载失败：HTTP {}", response.status()));
        }
        return response
            .bytes()
            .await
            .map(|bytes| bytes.to_vec())
            .map_err(|err| err.to_string());
    }
    fs::read(media_url).map_err(|err| format!("读取媒体失败：{err}"))
}

pub(crate) fn encode_png_data_url(image: &DynamicImage) -> Result<String, String> {
    let mut bytes = Vec::new();
    image
        .write_to(&mut Cursor::new(&mut bytes), ImageFormat::Png)
        .map_err(|err| format!("图片编码失败：{err}"))?;
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    Ok(format!("data:image/png;base64,{encoded}"))
}

pub(crate) fn guess_extension(bytes: &[u8]) -> &'static str {
    match image::guess_format(bytes) {
        Ok(ImageFormat::Jpeg) => "jpg",
        Ok(ImageFormat::Png) => "png",
        Ok(ImageFormat::WebP) => "webp",
        _ => "png",
    }
}

pub(crate) async fn copy_image_to_clipboard(image_url: &str) -> Result<(), String> {
    let bytes = load_image_bytes(image_url).await?;
    let image = image::load_from_memory(&bytes)
        .map_err(|err| format!("图片解码失败：{err}"))?
        .to_rgba8();
    let (width, height) = image.dimensions();
    let mut clipboard =
        arboard::Clipboard::new().map_err(|err| format!("剪贴板初始化失败：{err}"))?;
    clipboard
        .set_image(arboard::ImageData {
            width: width as usize,
            height: height as usize,
            bytes: Cow::Owned(image.into_raw()),
        })
        .map_err(|err| format!("复制图片失败：{err}"))
}

pub(crate) async fn split_image_grid(
    image_url: &str,
    rows: u32,
    cols: u32,
) -> Result<Vec<String>, String> {
    if rows == 0 || cols == 0 || rows > 12 || cols > 12 {
        return Err("行列数必须在 1 到 12 之间".to_string());
    }
    let bytes = load_image_bytes(image_url).await?;
    let image = image::load_from_memory(&bytes).map_err(|err| format!("图片解码失败：{err}"))?;
    let frame_width = image.width() / cols;
    let frame_height = image.height() / rows;
    if frame_width == 0 || frame_height == 0 {
        return Err("图片尺寸太小，无法按当前行列拆分".to_string());
    }

    let mut frames = Vec::new();
    for row in 0..rows {
        for col in 0..cols {
            let frame = image.crop_imm(col * frame_width, row * frame_height, frame_width, frame_height);
            frames.push(encode_png_data_url(&frame)?);
        }
    }
    Ok(frames)
}

pub(crate) fn infer_media_extension(media_url: &str, media_type: &str) -> &'static str {
    if let Some((meta, _)) = media_url.split_once(',') {
        if meta.starts_with("data:video/") {
            if meta.contains("mp4") {
                return "mp4";
            }
            if meta.contains("webm") {
                return "webm";
            }
            if meta.contains("quicktime") {
                return "mov";
            }
            return "mp4";
        }
        if meta.starts_with("data:image/") {
            if meta.contains("jpeg") {
                return "jpg";
            }
            if meta.contains("webp") {
                return "webp";
            }
            return "png";
        }
    }
    let lowered = media_url.to_lowercase();
    for ext in [
        "mp4", "mov", "webm", "mkv", "jpg", "jpeg", "png",
        "webp",
    ] {
        if lowered.contains(&format!(".{ext}")) {
            return if ext == "jpeg" { "jpg" } else { ext };
        }
    }
    match media_type {
        "video" => "mp4",
        _ => "png",
    }
}

pub(crate) fn downloads_dir() -> Result<PathBuf, String> {
    let home = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .ok_or_else(|| "无法定位用户目录".to_string())?;
    Ok(PathBuf::from(home).join("Downloads"))
}
