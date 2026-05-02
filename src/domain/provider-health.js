export function buildProviderHealthReport(settings = {}, options = {}) {
  const checks = [
    checkTextProvider(settings),
    checkImageProvider(settings),
    checkVideoProvider(settings),
    checkComfy(settings),
    checkGemini(options),
    checkCustomImage(settings),
  ];
  const blockers = checks.filter((item) => item.status === "fail");
  const warnings = checks.filter((item) => item.status === "warn");
  return {
    ok: blockers.length === 0,
    score: Math.max(0, Math.round(((checks.length - blockers.length - warnings.length * 0.5) / checks.length) * 100)),
    checks,
    blockers,
    warnings,
  };
}

function checkTextProvider(settings) {
  const localMode = settings.localTextMode || settings.factoryMode === "local";
  const ok = localMode || Boolean(settings.novelApiKey || settings.textApiKey || settings.apiKey || settings.apiKeySaved);
  return makeCheck("text", ok ? "ok" : "fail", ok ? "文本模型已配置" : "缺少文本模型 API Key 或本地文本模式");
}

function checkImageProvider(settings) {
  const mode = settings.imageProviderMode || settings.providerMode || "api";
  const ok = mode === "upload" || Boolean(settings.imageApiKey || settings.customApiKey || settings.customApiKeySaved || settings.customApiUrl || settings.comfyBaseUrl || settings.comfyUrl);
  return makeCheck("image", ok ? "ok" : "fail", ok ? "图片供应商可用" : "缺少图片 API、ComfyUI 或上传模式");
}

function checkVideoProvider(settings) {
  const mode = settings.videoProviderMode || settings.videoMode || "api";
  const ok = mode === "upload" || Boolean(settings.videoApiKey || settings.customApiKey || settings.customApiKeySaved || settings.customApiUrl || settings.comfyVideoUrl || settings.comfyBaseUrl || settings.comfyUrl);
  return makeCheck("video", ok ? "ok" : "warn", ok ? "视频供应商可用" : "视频供应商未完整配置，可先用上传模式");
}

function checkComfy(settings) {
  const comfyUrl = settings.comfyBaseUrl || settings.comfyUrl || "";
  if (!comfyUrl) return makeCheck("comfy", "warn", "ComfyUI 未配置");
  const mode = String(settings.imageProviderMode || settings.videoProviderMode || settings.providerMode || "").toLowerCase();
  const comfySelected = settings.comfyEnabled || mode === "comfy" || mode === "comfyui";
  const valid = /^https?:\/\//.test(comfyUrl);
  return makeCheck("comfy", valid ? "ok" : comfySelected ? "fail" : "warn", valid ? "ComfyUI 地址格式检查" : "ComfyUI 地址格式不正确");
}

function checkGemini(options) {
  if (!options.usesGemini) return makeCheck("gemini", "ok", "未启用 Gemini 网页自动化");
  return makeCheck("gemini", options.geminiProfileReady ? "ok" : "warn", options.geminiProfileReady ? "Gemini 登录配置可用" : "Gemini 登录状态需要确认");
}

function checkCustomImage(settings) {
  if (!settings.customApiUrl) return makeCheck("customImage", "ok", "未启用自定义图片 API");
  const hasPath = settings.customResultMode === "auto" || Boolean(settings.customImagePath);
  return makeCheck("customImage", hasPath ? "ok" : "fail", hasPath ? "自定义图片返回字段已配置" : "自定义图片 API 缺少结果字段路径");
}

function makeCheck(key, status, message) {
  return { key, status, message };
}
