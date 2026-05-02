let backendServiceHelpersPromise = null;

export function loadBackendServiceHelpers() {
  if (!backendServiceHelpersPromise) backendServiceHelpersPromise = import("../backend-service-helpers.js");
  return backendServiceHelpersPromise;
}

export function createBrowserTextDownload({ fileName, content }) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
  return url;
}

export function isTauriRuntime() {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
}

export function buildNovelChatCompletionsUrl(baseUrl) {
  const base = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (!base) return "";
  if (/\/(chat\/completions|responses|messages)$/i.test(base)) return base;
  return `${base}/chat/completions`;
}

export function normalizeCustomImageApiKind(value) {
  return ["openai-compatible", "draw-poll", "direct-image"].includes(value) ? value : "direct-image";
}

export function normalizeCustomImageResultMode(value) {
  return ["auto", "url", "base64", "task-id"].includes(value) ? value : "auto";
}

export function validateCustomImageApiSettings(settings = {}) {
  const apiUrl = String(settings.customApiUrl || "").trim();
  const apiKind = normalizeCustomImageApiKind(settings.customApiKind);
  const resultMode = normalizeCustomImageResultMode(settings.customResultMode);
  const imagePath = String(settings.customImagePath || "").trim();
  const lowered = apiUrl.toLowerCase();

  if (!apiUrl) return "请先填写自定义图片 API URL。";
  if (apiKind === "openai-compatible" && lowered.includes("/images/generations")) {
    return "当前接口类型选的是 OpenAI 兼容聊天接口，但 URL 更像 `/images/generations` 图片端点。请改成“直返图片接口”。";
  }
  if (apiKind === "openai-compatible" && (lowered.includes("/chat/completions") || lowered.endsWith("/v1")) && resultMode === "task-id") {
    return "OpenAI 兼容聊天接口不会走 `/v1/draw/result` 轮询；如果你用的是 LinAPI / OpenAI 兼容接口，请把结果模式改成 `url`、`base64` 或 `auto`。";
  }
  if (apiKind === "draw-poll" && !/\/draw(\/|$)/i.test(apiUrl)) {
    return "当前接口类型选的是火山 Draw 轮询，但 URL 不像 draw 提交接口。请确认它类似 `/draw/...`。";
  }
  if (apiKind === "draw-poll" && resultMode !== "task-id") {
    return "火山 Draw 轮询接口必须把结果模式设为 `task-id`。";
  }
  if (apiKind === "direct-image" && resultMode === "task-id") {
    return "直返图片接口不应该使用 `task-id` 结果模式。";
  }
  if ((resultMode === "url" || resultMode === "base64") && !imagePath) {
    return "当前结果模式需要填写结果图片路径，例如 `data.0.url` 或 `data.0.b64_json`。";
  }
  return "";
}

export function formatCustomImageApiError(error) {
  const message = String(error?.message || error || "").trim();
  if (!message) return "自定义图片 API 调用失败。";
  if (message.includes("/v1/draw/result") || message.includes("HTTP 404")) {
    return `自定义图片 API 失败：${message}\n这通常表示当前接口并不支持火山 Draw 轮询。若你使用 LinAPI / OpenAI 兼容接口，请把接口类型改成“OpenAI 兼容聊天接口”，并把结果模式改成 url、base64 或 auto。`;
  }
  return message;
}

export function summarizeCustomImageApiDiagnostic(report = {}) {
  const topLevelKeys = Array.isArray(report.firstResponseTopLevelKeys) ? report.firstResponseTopLevelKeys : [];
  const nestedKeys = Array.isArray(report.firstResponseNestedKeys) ? report.firstResponseNestedKeys : [];
  return {
    apiKind: normalizeCustomImageApiKind(report.normalizedApiKind),
    resultMode: normalizeCustomImageResultMode(report.normalizedResultMode),
    keySummary: report.firstResponseKeySummary || (topLevelKeys.length ? topLevelKeys.join(", ") : "暂无"),
    nestedKeySummary: nestedKeys.length ? nestedKeys.join("\n") : "暂无",
    imageFieldStatus: report.hasImageField
      ? `已检测到图片字段${report.detectedImageField ? `：${report.detectedImageField}` : ""}`
      : "未检测到图片字段",
    taskFieldStatus: report.hasTaskId
      ? `已检测到任务 ID${report.detectedTaskId ? `：${report.detectedTaskId}` : ""}`
      : "未检测到任务 ID",
    pollingStatus: report.willPoll ? "会进入轮询" : "不会进入轮询",
  };
}

export function detectComfyPromptNodeId(workflowJson) {
  try {
    const workflow = JSON.parse(workflowJson);
    if (Array.isArray(workflow?.nodes)) {
      const candidates = workflow.nodes
        .filter((node) => node && node.id != null)
        .map((node) => {
          const widgets = Array.isArray(node.widgets_values) ? node.widgets_values : [];
          const textValue = widgets.find((value) => typeof value === "string" && value.trim()) || "";
          const type = String(node.type || node.class_type || node.title || "");
          let score = 0;
          if (/CLIPTextEncode|Prompt|Text|Conditioning/i.test(type)) score += 4;
          if (typeof textValue === "string" && textValue.trim()) score += 2;
          if (/positive|正向|masterpiece|best quality|portrait|scene|image|prompt/i.test(textValue)) score += 2;
          if (/negative|负面|低质量|bad|worst|blurry|nsfw/i.test(`${type} ${textValue}`)) score -= 5;
          return { id: String(node.id), score, textLength: String(textValue).length };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || b.textLength - a.textLength);
      return candidates[0]?.id || "";
    }
    const entries = Object.entries(workflow || {}).filter(([, node]) => node?.inputs);
    const candidates = entries
      .map(([id, node]) => {
        const inputs = node.inputs || {};
        const classType = String(node.class_type || node.type || "");
        const textValue = String(inputs.text || inputs.prompt || inputs.positive || inputs.caption || inputs.string || inputs.value || "");
        let score = 0;
        if (/CLIPTextEncode|Prompt|Text|Conditioning/i.test(classType)) score += 4;
        if (Object.prototype.hasOwnProperty.call(inputs, "text")) score += 3;
        if (Object.prototype.hasOwnProperty.call(inputs, "prompt") || Object.prototype.hasOwnProperty.call(inputs, "positive")) score += 2;
        if (/positive|正向|masterpiece|best quality|portrait|scene|image|prompt/i.test(textValue)) score += 2;
        if (/negative|负面|低质量|bad|worst|blurry|nsfw/i.test(`${classType} ${textValue}`)) score -= 5;
        return { id, score, textLength: textValue.length };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || b.textLength - a.textLength);
    return candidates[0]?.id || "";
  } catch {
    return "";
  }
}

export function detectComfyWorkflowFormat(workflowJson) {
  try {
    const workflow = JSON.parse(workflowJson);
    if (Array.isArray(workflow?.nodes)) return "ui";
    if (workflow && typeof workflow === "object" && Object.values(workflow).some((node) => node?.inputs)) return "api";
    return "";
  } catch {
    return "";
  }
}
