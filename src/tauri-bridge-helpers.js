import { invokeTauri, listenTauri } from "./app/tauri-runtime-bridge.js";

export function listenTimelineRenderProgress(handler) {
  return listenTauri("timeline-render-progress", handler);
}

export function listenGeminiWebImage(handler) {
  return listenTauri("gemini-web-image", handler);
}

export function getAiConfig() {
  return invokeTauri("get_ai_config");
}

export function saveAiConfig(request) {
  return invokeTauri("save_ai_config", { request });
}

export function getNovelApiConfig() {
  return invokeTauri("get_novel_api_config");
}

export function saveNovelApiConfig(request) {
  return invokeTauri("save_novel_api_config", { request });
}

export function getRecentProjects() {
  return invokeTauri("get_recent_projects");
}

export function generateImageCustomApi(request) {
  return invokeTauri("generate_image_custom_api", { request });
}

export function diagnoseImageCustomApi(request) {
  return invokeTauri("diagnose_image_custom_api", { request });
}

export function callNovelFactoryApi(request) {
  return invokeTauri("call_novel_factory_api", { request });
}

export function testComfyConnection(request) {
  return invokeTauri("test_comfy_connection", { request });
}

export function runComfyWorkflow(request) {
  return invokeTauri("run_comfy_workflow", { request });
}

export function splitImageGrid(request) {
  return invokeTauri("split_image_grid", { request });
}

export function saveProjectFile(request) {
  return invokeTauri("save_project_file", { request });
}

export function openProjectFile() {
  return invokeTauri("open_project_file");
}

export function saveProjectFileToPath(request) {
  return invokeTauri("save_project_file_to_path", { request });
}

export function openProjectFileAtPath(request) {
  return invokeTauri("open_project_file_at_path", { request });
}

export function saveProjectCache(request) {
  return invokeTauri("save_project_cache", { request });
}

export function loadProjectCache() {
  return invokeTauri("load_project_cache");
}

export function clearProjectCache() {
  return invokeTauri("clear_project_cache");
}

export function cacheMediaAsset(request) {
  return invokeTauri("cache_media_asset", { request });
}

export function pickMediaFile(request) {
  return invokeTauri("pick_media_file", { request });
}

export function listMediaCache() {
  return invokeTauri("list_media_cache");
}

export function deleteMediaCacheFiles(request) {
  return invokeTauri("delete_media_cache_files", { request });
}

export function syncProjectIndex(request) {
  return invokeTauri("sync_project_index", { request });
}

export function readProjectIndexSummary() {
  return invokeTauri("read_project_index_summary");
}

export function searchProjectIndex(request) {
  return invokeTauri("search_project_index", { request });
}

export function saveExportFile(request) {
  return invokeTauri("save_export_file", { request });
}

export function saveDeliveryPackage(request) {
  return invokeTauri("save_delivery_package", { request });
}

export function saveImageToDownloads(request) {
  return invokeTauri("save_image_to_downloads", { request });
}

export function copyImageToClipboard(request) {
  return invokeTauri("copy_image_to_clipboard", { request });
}

export function renderTimelineVideo(request) {
  return invokeTauri("render_timeline_video", { request });
}

export function openGeminiChromeLogin(request) {
  return invokeTauri("open_gemini_chrome_login", { request });
}

export function generateGeminiWebImage(request) {
  return invokeTauri("generate_gemini_web_image", { request });
}

export function cancelGeminiWebImage(request) {
  return invokeTauri("cancel_gemini_web_image", { request });
}
