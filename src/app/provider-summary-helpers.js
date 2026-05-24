import { currentProviderMode } from "./media-provider-runtime.js";

export function summarizeHudTextSettings(settings = {}) {
  const mode = settings.factoryMode === "api" ? "API" : "本地";
  return `${mode} · ${settings.apiProvider || "openai"} · ${settings.apiModel || "未填模型"}`;
}

export function summarizeHudMediaSettings(settings = {}) {
  const mode = currentProviderMode(settings);
  if (mode === "comfy") {
    return `ComfyUI · ${settings.comfyBaseUrl || "未填地址"}`;
  }
  if (mode === "custom") {
    return `HTTP API · ${settings.customModel || settings.customApiKind || "未填模型"}`;
  }
  return "本地模拟";
}

export function providerLabel(settings) {
  const mode = currentProviderMode(settings);
  if (mode === "custom") return settings.customModel || "自定义 API";
  if (mode === "comfy") return "ComfyUI";
  return "Nano Banana 2";
}
