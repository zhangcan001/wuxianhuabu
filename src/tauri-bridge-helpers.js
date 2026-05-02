import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export function listenTimelineRenderProgress(handler) {
  return listen("timeline-render-progress", handler);
}

export function listenGeminiWebImage(handler) {
  return listen("gemini-web-image", handler);
}

export function getAiConfig() {
  return invoke("get_ai_config");
}

export function saveAiConfig(request) {
  return invoke("save_ai_config", { request });
}

export function getNovelApiConfig() {
  return invoke("get_novel_api_config");
}

export function saveNovelApiConfig(request) {
  return invoke("save_novel_api_config", { request });
}

export function getRecentProjects() {
  return invoke("get_recent_projects");
}

export function generateImageCustomApi(request) {
  return invoke("generate_image_custom_api", { request });
}

export function diagnoseImageCustomApi(request) {
  return invoke("diagnose_image_custom_api", { request });
}

export function callNovelFactoryApi(request) {
  return invoke("call_novel_factory_api", { request });
}

export function testComfyConnection(request) {
  return invoke("test_comfy_connection", { request });
}

export function runComfyWorkflow(request) {
  return invoke("run_comfy_workflow", { request });
}

export function splitImageGrid(request) {
  return invoke("split_image_grid", { request });
}

export function saveProjectFile(request) {
  return invoke("save_project_file", { request });
}

export function openProjectFile() {
  return invoke("open_project_file");
}

export function saveProjectFileToPath(request) {
  return invoke("save_project_file_to_path", { request });
}

export function openProjectFileAtPath(request) {
  return invoke("open_project_file_at_path", { request });
}

export function saveProjectCache(request) {
  return invoke("save_project_cache", { request });
}

export function loadProjectCache() {
  return invoke("load_project_cache");
}

export function clearProjectCache() {
  return invoke("clear_project_cache");
}

export function cacheMediaAsset(request) {
  return invoke("cache_media_asset", { request });
}

export function pickMediaFile(request) {
  return invoke("pick_media_file", { request });
}

export function listMediaCache() {
  return invoke("list_media_cache");
}

export function deleteMediaCacheFiles(request) {
  return invoke("delete_media_cache_files", { request });
}

export function syncProjectIndex(request) {
  return invoke("sync_project_index", { request });
}

export function readProjectIndexSummary() {
  return invoke("read_project_index_summary");
}

export function searchProjectIndex(request) {
  return invoke("search_project_index", { request });
}

export function saveExportFile(request) {
  return invoke("save_export_file", { request });
}

export function saveDeliveryPackage(request) {
  return invoke("save_delivery_package", { request });
}

export function saveImageToDownloads(request) {
  return invoke("save_image_to_downloads", { request });
}

export function copyImageToClipboard(request) {
  return invoke("copy_image_to_clipboard", { request });
}

export function renderTimelineVideo(request) {
  return invoke("render_timeline_video", { request });
}

export function openGeminiChromeLogin(request) {
  return invoke("open_gemini_chrome_login", { request });
}

export function generateGeminiWebImage(request) {
  return invoke("generate_gemini_web_image", { request });
}

export function cancelGeminiWebImage(request) {
  return invoke("cancel_gemini_web_image", { request });
}
