import { convertFileSrc } from "./app/tauri-runtime-bridge.js";
import {
  cacheMediaAsset,
  diagnoseImageCustomApi,
  callNovelFactoryApi,
  generateImageCustomApi,
  getAiConfig,
  getNovelApiConfig,
  getRecentProjects,
  runComfyWorkflow,
  saveAiConfig,
  saveNovelApiConfig,
  splitImageGrid,
  testComfyConnection as invokeTestComfyConnection,
} from "./tauri-bridge-helpers.js";
import {
  buildNovelChatCompletionsUrl,
  detectComfyPromptNodeId,
  detectComfyWorkflowFormat,
  formatCustomImageApiError,
  isTauriRuntime,
  normalizeCustomImageApiKind,
  normalizeCustomImageResultMode,
  summarizeCustomImageApiDiagnostic,
  validateCustomImageApiSettings,
} from "./app/runtime-helpers.js";

export {
  buildNovelChatCompletionsUrl,
  detectComfyPromptNodeId,
  detectComfyWorkflowFormat,
  formatCustomImageApiError,
  isTauriRuntime,
  normalizeCustomImageApiKind,
  normalizeCustomImageResultMode,
  summarizeCustomImageApiDiagnostic,
  validateCustomImageApiSettings,
} from "./app/runtime-helpers.js";

export async function loadNovelApiSettingsFromBackend(deps = {}) {
  const {
    loadNovelApiSettings,
    applyNovelApiKeyVault,
    normalizeNovelBodyTemplate,
    novelApiProviders,
    getNovelApiConfigImpl = getNovelApiConfig,
    tauriRuntime = isTauriRuntime(),
  } = deps;
  if (!tauriRuntime) return loadNovelApiSettings();
  try {
    const settings = await getNovelApiConfigImpl();
    const local = loadNovelApiSettings();
    const merged = { ...local, ...settings, apiKey: local.apiKey || settings.apiKey || "" };
    const preset = novelApiProviders[merged.apiProvider] || novelApiProviders.openai;
    const applied = applyNovelApiKeyVault({
      ...merged,
      bodyTemplate: normalizeNovelBodyTemplate(merged.bodyTemplate, preset),
    });
    return {
      ...applied,
      apiKeySaved: Boolean(applied.apiKeySaved || applied.apiKey || settings.apiKeySaved),
    };
  } catch {
    return loadNovelApiSettings();
  }
}

export function saveNovelApiSettings(settings, deps = {}) {
  const {
    forgetApiKey,
    rememberApiKey,
    hasSavedApiKey,
    loadApiKeyVault,
    normalizeNovelBodyTemplate,
    novelApiProviders,
    novelFactorySchema,
    storage = typeof localStorage !== "undefined" ? localStorage : null,
    storageKey = "",
    saveNovelApiConfigImpl = saveNovelApiConfig,
    tauriRuntime = isTauriRuntime(),
  } = deps;
  if (settings.apiKeyClear) forgetApiKey("text");
  else if (String(settings.apiKey || "").trim()) rememberApiKey("text", settings.apiKey);
  const apiKeySaved = hasSavedApiKey(settings, loadApiKeyVault(), "text");
  const request = {
    factoryMode: settings.factoryMode || "api",
    apiProvider: settings.apiProvider || "openai",
    apiBaseUrl: settings.apiBaseUrl || "",
    apiUrl: settings.apiUrl || "",
    apiKey: settings.apiKey || "",
    apiKeyClear: Boolean(settings.apiKeyClear),
    authType: settings.authType || "bearer",
    headersJson: settings.headersJson || "",
    apiModel: settings.apiModel || "",
    bodyTemplate: normalizeNovelBodyTemplate(settings.bodyTemplate, novelApiProviders[settings.apiProvider] || novelApiProviders.openai),
    responsePath: settings.responsePath || "choices.0.message.content",
    schema: settings.schema || novelFactorySchema,
  };
  if (tauriRuntime) {
    saveNovelApiConfigImpl(request).catch(() => {});
    try {
      storage?.setItem(storageKey, JSON.stringify({ ...request, apiKey: "", apiKeyClear: false, apiKeySaved }));
    } catch {}
    return;
  }
  try {
    storage?.setItem(storageKey, JSON.stringify({ ...request, apiKeySaved }));
  } catch {
    // Storage can fail in private windows or when quota is full; node data still keeps the current values.
  }
}

export async function loadBackendAiConfig(deps = {}) {
  const {
    apiBase = "",
    applyImageApiKeyVault,
    getAiConfigImpl = getAiConfig,
    fetchImpl = fetch,
    tauriRuntime = isTauriRuntime(),
  } = deps;
  if (tauriRuntime) {
    try {
      const config = await getAiConfigImpl();
      return {
        ...applyImageApiKeyVault(config),
        customApiKeySaved: Boolean(config?.customApiKeySaved || config?.customApiKey),
      };
    } catch (error) {
      console.warn("Tauri get_ai_config failed, falling back to HTTP", error);
    }
  }
  try {
    const response = await fetchImpl(`${apiBase}/api/ai-config`);
    if (!response.ok) return null;
    return applyImageApiKeyVault(await response.json());
  } catch {
    return null;
  }
}

export async function saveBackendAiConfig(settings, deps = {}) {
  const {
    apiBase = "",
    forgetApiKey,
    rememberApiKey,
    saveAiConfigImpl = saveAiConfig,
    fetchImpl = fetch,
    tauriRuntime = isTauriRuntime(),
  } = deps;
  const payload = { ...settings };
  if (payload.customApiKeyClear) forgetApiKey("image");
  else if (String(payload.customApiKey || "").trim()) rememberApiKey("image", payload.customApiKey);
  if (!payload.customApiKey && !payload.customApiKeyClear) delete payload.customApiKey;
  if (tauriRuntime) {
    try {
      return await saveAiConfigImpl(payload);
    } catch (error) {
      console.warn("Tauri save_ai_config failed, falling back to HTTP", error);
    }
  }
  const response = await fetchImpl(`${apiBase}/api/ai-config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function loadRecentProjects(deps = {}) {
  const {
    getRecentProjectsImpl = getRecentProjects,
    tauriRuntime = isTauriRuntime(),
  } = deps;
  if (!tauriRuntime) return [];
  try {
    const result = await getRecentProjectsImpl();
    return Array.isArray(result.paths) ? result.paths : [];
  } catch {
    return [];
  }
}

export async function runCustomApiGeneration(settings, prompt, deps = {}) {
  const {
    apiBase = "",
    generateImageCustomApiImpl = generateImageCustomApi,
    fetchImpl = fetch,
    tauriRuntime = isTauriRuntime(),
  } = deps;
  const validationError = validateCustomImageApiSettings(settings);
  if (validationError) {
    throw new Error(validationError);
  }
  if (tauriRuntime) {
    try {
      const result = await generateImageCustomApiImpl({
        prompt,
        customModel: settings?.customModel || "",
        customImagePath: settings?.customImagePath || "",
        imageSize: settings?.customImageSize || "",
        aspectRatio: settings?.customAspectRatio || "",
      });
      return persistGeneratedMediaResult(result, {
        tauriRuntime,
        cacheMediaAssetImpl: deps.cacheMediaAssetImpl || cacheMediaAsset,
        convertFileSrcImpl: deps.convertFileSrcImpl || convertFileSrc,
        fileName: prompt,
      });
    } catch (error) {
      throw new Error(formatCustomImageApiError(error));
    }
  }
  const response = await fetchImpl(`${apiBase}/api/generate-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`本地后端生成失败：HTTP ${response.status}${errorText ? ` · ${errorText.slice(0, 180)}` : ""}`);
  }
  return response.json();
}

export async function diagnoseCustomImageApi(settings, prompt, deps = {}) {
  const {
    diagnoseImageCustomApiImpl = diagnoseImageCustomApi,
    tauriRuntime = isTauriRuntime(),
  } = deps;
  const validationError = validateCustomImageApiSettings(settings);
  if (validationError) {
    return {
      success: false,
      normalizedApiKind: normalizeCustomImageApiKind(settings?.customApiKind),
      normalizedResultMode: normalizeCustomImageResultMode(settings?.customResultMode),
      looksLikeDrawUrl: /\/draw(\/|$)/i.test(String(settings?.customApiUrl || "")),
      firstResponseContentType: "",
      firstResponseKeySummary: "",
      firstResponseTopLevelKeys: [],
      firstResponseNestedKeys: [],
      detectedImageField: "",
      detectedTaskId: "",
      hasImageField: false,
      hasTaskId: false,
      willPoll: false,
      imagePreview: "",
      note: "自定义图片 API 诊断",
      error: validationError,
    };
  }
  if (!tauriRuntime) {
    throw new Error("自定义图片 API 测试报告面板仅在 Tauri 桌面版可用。");
  }
  const result = await diagnoseImageCustomApiImpl({
    prompt,
    customModel: settings?.customModel || "",
    customImagePath: settings?.customImagePath || "",
    imageSize: settings?.customImageSize || "",
    aspectRatio: settings?.customAspectRatio || "",
  });
  return result || {};
}

export async function runNovelFactoryApi(config, parser, deps = {}) {
  const {
    novelApiProviders,
    normalizeNovelBodyTemplate,
    novelTemplateDefault,
    novelFactorySchema,
    callNovelFactoryApiImpl = callNovelFactoryApi,
    fetchImpl = fetch,
    tauriRuntime = isTauriRuntime(),
  } = deps;
  const providerPreset = novelApiProviders[config.apiProvider] || novelApiProviders.openai;
  const rawApiUrl = String(config.apiUrl || config.apiBaseUrl || "").trim();
  const rawApiKey = String(config.apiKey || "").trim();
  const codingPlanDirectCall = providerPreset.unsupportedInApp
    || /coding\.dashscope\.aliyuncs\.com/i.test(rawApiUrl)
    || /^sk-sp-/i.test(rawApiKey);
  if (codingPlanDirectCall) {
    throw new Error("阿里百炼 Coding Plan 当前不适合直接接到本软件这类自定义应用里。根据阿里文档，它仅限编程工具使用，不支持自定义应用程序直连。建议改用“阿里百炼 / DashScope”供应商做文本 API。");
  }
  const apiUrl = buildNovelChatCompletionsUrl(config.apiUrl || config.apiBaseUrl);
  if (!apiUrl) throw new Error("请填写小说工厂 Base URL");
  const request = {
    apiUrl,
    apiKey: config.apiKey,
    authType: config.authType || "bearer",
    headersJson: config.headersJson || "",
    model: config.model || "gpt-4o-mini",
    bodyTemplate: normalizeNovelBodyTemplate(config.bodyTemplate, providerPreset),
    responsePath: config.responsePath || "choices.0.message.content",
    novel: config.novel,
    input: config.input || config.novel,
    template: config.template || novelTemplateDefault,
    schema: config.schema || novelFactorySchema,
  };
  if (tauriRuntime) {
    const result = await callNovelFactoryApiImpl(request);
    return parser(result.text, result.note);
  }
  const body = JSON.parse(fillNovelApiTemplate(request.bodyTemplate, request));
  const response = await fetchImpl(request.apiUrl, {
    method: "POST",
    headers: buildBrowserApiHeaders(request),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    if (response.status === 405) {
      throw new Error(`小说工厂 API 失败：HTTP 405。请确认正在使用桌面版软件，并且完整接口地址是 ${apiUrl}。浏览器预览页会被百炼 CORS/OPTIONS 预检拦截。${text ? ` · ${text.slice(0, 180)}` : ""}`);
    }
    throw new Error(`小说工厂 API 失败：HTTP ${response.status}${text ? ` · ${text.slice(0, 180)}` : ""}`);
  }
  const responseText = await response.text();
  let responseKeys = "";
  let text = "";
  if (responseText.trim().startsWith("data:")) {
    text = extractTextFromSseResponse(responseText, request.responsePath);
    responseKeys = "SSE data";
  } else {
    const json = JSON.parse(responseText);
    responseKeys = Object.keys(json || {}).join(", ");
    text = extractTextFromApiResponse(json, request.responsePath);
  }
  if (!text) throw new Error(`响应里没有找到文本字段，请检查结果文本路径。响应键：${responseKeys}`);
  return parser(text, `小说工厂 API · ${request.model}`);
}

export function fillNovelApiTemplate(template, request) {
  return String(template || "{}")
    .replaceAll("{{novel}}", escapeJsonString(request.novel || ""))
    .replaceAll("{{input}}", escapeJsonString(request.input || request.novel || ""))
    .replaceAll("{{template}}", escapeJsonString(request.template || ""))
    .replaceAll("{{model}}", escapeJsonString(request.model || ""))
    .replaceAll("{{schema}}", escapeJsonString(request.schema || ""));
}

export function buildBrowserApiHeaders(config) {
  let headers = { "Content-Type": "application/json" };
  if (config.headersJson?.trim()) headers = { ...headers, ...JSON.parse(config.headersJson) };
  const key = String(config.apiKey || "").trim();
  if (key && config.authType === "bearer") headers.Authorization = `Bearer ${key}`;
  if (key && config.authType === "x-api-key") headers["x-api-key"] = key;
  return headers;
}

function extractByPath(value, pathExpression) {
  return String(pathExpression || "")
    .split(".")
    .filter(Boolean)
    .reduce((current, key) => {
      if (current == null) return undefined;
      if (/^\d+$/.test(key)) return Array.isArray(current) ? current[Number(key)] : undefined;
      return current[key];
    }, value);
}

export function extractTextFromApiResponse(json, responsePath) {
  const candidates = [
    responsePath,
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
  for (const candidate of candidates.filter(Boolean)) {
    const text = textFromApiValue(extractByPath(json, candidate));
    if (text) return text;
  }
  const choiceText = extractTextFromChoices(json?.choices);
  if (choiceText) return choiceText;
  return findFirstTextField(json);
}

export function extractTextFromSseResponse(text, responsePath) {
  const parts = [];
  String(text || "").split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) return;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") return;
    try {
      const json = JSON.parse(payload);
      const chunkText = extractTextFromApiResponse(json, responsePath);
      if (chunkText) parts.push(chunkText);
    } catch {
      // Ignore keep-alive or non-JSON SSE lines.
    }
  });
  return parts.join("").trim();
}

export function extractTextFromChoices(choices) {
  if (!Array.isArray(choices)) return "";
  const parts = [];
  choices.forEach((choice) => {
    [
      choice?.message?.content,
      choice?.message?.reasoning_content,
      choice?.delta?.content,
      choice?.text,
      choice?.content,
    ].forEach((value) => {
      const text = textFromApiValue(value);
      if (text) parts.push(text);
    });
  });
  return parts.join("").trim();
}

export function textFromApiValue(value) {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value.map((item) => textFromApiValue(item)).filter(Boolean).join("\n").trim();
  }
  if (value && typeof value === "object") {
    for (const key of ["text", "content", "output_text", "reasoning_content"]) {
      const text = textFromApiValue(value[key]);
      if (text) return text;
    }
  }
  return "";
}

export function findFirstTextField(value) {
  if (!value || typeof value !== "object") return "";
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = findFirstTextField(item);
      if (text) return text;
    }
    return "";
  }
  for (const key of ["content", "text", "output_text", "reasoning_content"]) {
    const text = textFromApiValue(value[key]);
    if (text) return text;
  }
  for (const child of Object.values(value)) {
    const text = findFirstTextField(child);
    if (text) return text;
  }
  return "";
}

export function escapeJsonString(value) {
  return JSON.stringify(String(value || "")).slice(1, -1);
}

export async function testComfyConnection(settings, deps = {}) {
  const {
    testComfyConnectionImpl = invokeTestComfyConnection,
    fetchImpl = fetch,
    tauriRuntime = isTauriRuntime(),
  } = deps;
  const baseUrl = normalizeComfyBaseUrl(settings.comfyBaseUrl);
  const requestBaseUrl = resolveComfyRequestBaseUrl(baseUrl, { tauriRuntime });
  if (tauriRuntime) {
    const result = await testComfyConnectionImpl({ baseUrl });
    return result.note || baseUrl;
  }
  let lastError = "";
  for (const endpoint of ["system_stats", "object_info", "queue", ""]) {
    const url = endpoint ? `${requestBaseUrl}/${endpoint}` : requestBaseUrl;
    try {
      const response = await fetchImpl(url);
      if (response.ok) return `${baseUrl} 可用 · ${endpoint || "首页"}`;
      lastError = `${url} HTTP ${response.status}`;
    } catch (error) {
      lastError = `${url} ${error.message}`;
    }
  }
  throw new Error(lastError || "无法连接");
}

export async function runComfyGeneration(settings, prompt, kind = "image", deps = {}) {
  const {
    runComfyWorkflowImpl = runComfyWorkflow,
    fetchImpl = fetch,
    tauriRuntime = isTauriRuntime(),
  } = deps;
  const workflowJson = kind === "video"
    ? settings.comfyVideoWorkflowJson
    : (settings.comfyImageWorkflowJson || settings.workflowJson);
  const positiveNodeId = kind === "video"
    ? settings.comfyVideoPositiveNodeId
    : (settings.comfyImagePositiveNodeId || settings.positiveNodeId);
  if (!String(workflowJson || "").trim()) throw new Error(`请先在 AI 设置中粘贴 ComfyUI ${kind === "video" ? "视频" : "生图"}工作流 JSON`);
  if (!String(positiveNodeId || "").trim()) throw new Error(`请填写 ComfyUI ${kind === "video" ? "视频" : "生图"}正向提示词节点 ID`);
  if (detectComfyWorkflowFormat(workflowJson) === "ui") {
    throw new Error("当前导入的是普通 ComfyUI workflow，不能直接提交到 /prompt。请在 ComfyUI 中使用 Save (API Format) / Export API workflow 后再导入。");
  }
  const timeoutSeconds = clampNumber(Number(settings.comfyTimeoutSeconds) || (kind === "video" ? 900 : 180), 30, 3600);

  if (tauriRuntime) {
    const result = await runComfyWorkflowImpl({
      baseUrl: normalizeComfyBaseUrl(settings.comfyBaseUrl),
      workflowJson,
      positiveNodeId,
      prompt,
      kind,
      timeoutSeconds,
    });
    return persistGeneratedMediaResult(result, {
      tauriRuntime,
      cacheMediaAssetImpl: deps.cacheMediaAssetImpl || cacheMediaAsset,
      convertFileSrcImpl: deps.convertFileSrcImpl || convertFileSrc,
      fileName: prompt,
    });
  }

  const workflow = JSON.parse(workflowJson);
  injectComfyPrompt(workflow, positiveNodeId, prompt);
  const baseUrl = resolveComfyRequestBaseUrl(normalizeComfyBaseUrl(settings.comfyBaseUrl), { tauriRuntime });
  const clientId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `client-${Date.now()}`;
  const submit = await fetchImpl(`${baseUrl}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow, client_id: clientId }),
  });
  if (!submit.ok) throw new Error(`ComfyUI 提交失败：HTTP ${submit.status}`);
  const submitted = await submit.json();
  if (!submitted.prompt_id) throw new Error("ComfyUI 未返回 prompt_id");
  try {
    for (let i = 0; i < timeoutSeconds; i += 1) {
      await sleep(1000);
      const historyResponse = await fetchImpl(`${baseUrl}/history/${submitted.prompt_id}`);
      if (!historyResponse.ok) continue;
      const history = await historyResponse.json();
      const item = history[submitted.prompt_id];
      const error = extractComfyError(item);
      if (error) throw new Error(error);
      const media = extractComfyMedia(baseUrl, item);
      if (kind === "video" && media.videos.length) {
        return { videoUrl: media.videos[0], note: `ComfyUI 视频 · prompt ${submitted.prompt_id.slice(0, 8)}` };
      }
      if (kind === "image" && media.images.length) {
        return { imageUrl: media.images[0], note: `ComfyUI 生图 · prompt ${submitted.prompt_id.slice(0, 8)}` };
      }
      if (kind === "video" && media.images.length) {
        return { imageUrl: media.images[0], note: `ComfyUI 视频工作流返回了图片 · prompt ${submitted.prompt_id.slice(0, 8)}` };
      }
    }
    throw new Error(`ComfyUI 任务超时或没有输出${kind === "video" ? "视频" : "图片"}`);
  } finally {
    await cleanupComfyPromptResources(baseUrl, submitted.prompt_id, fetchImpl);
  }
}

async function cleanupComfyPromptResources(baseUrl, promptId, fetchImpl) {
  if (!String(baseUrl || "").trim() || !String(promptId || "").trim()) return;
  const requestOptions = [
    {
      url: `${baseUrl}/history`,
      body: { delete: [promptId] },
    },
    {
      url: `${baseUrl}/free`,
      body: { unload_models: true, free_memory: true },
    },
  ];
  for (const request of requestOptions) {
    try {
      await fetchImpl(request.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.body),
      });
    } catch {
      // Cleanup is best-effort; generation result should not be masked by cleanup failures.
    }
  }
}

export function injectComfyPrompt(workflow, positiveNodeId, prompt) {
  const node = workflow[String(positiveNodeId)];
  if (!node?.inputs) throw new Error(`workflow 中找不到节点 ${positiveNodeId}`);
  const cleanPrompt = String(prompt || "").replace(/@(?=图\d+)/g, "").trim();
  const textKeys = ["text", "prompt", "positive", "caption", "string", "value"];
  const key = textKeys.find((candidate) => Object.prototype.hasOwnProperty.call(node.inputs, candidate)) || "text";
  node.inputs[key] = cleanPrompt;
  randomizeComfySeeds(workflow);
}

export function randomizeComfySeeds(workflow) {
  const nodes = workflow && typeof workflow === "object" ? Object.values(workflow) : [];
  nodes.forEach((item, index) => {
    const inputs = item?.inputs;
    if (!inputs || typeof inputs !== "object") return;
    ["seed", "noise_seed"].forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(inputs, key)) return;
      inputs[key] = nextComfySeed(index);
    });
  });
}

function nextComfySeed(offset = 0) {
  const randomPart = Math.floor(Math.random() * 1_000_000_000);
  const timePart = Date.now() % 1_000_000_000;
  return (timePart * 997 + randomPart + offset) % 2_147_483_647;
}

export function normalizeComfyBaseUrl(value) {
  return String(value || "http://127.0.0.1:8188").replace(/\/+$/, "");
}

export function resolveComfyRequestBaseUrl(baseUrl = "", options = {}) {
  const normalized = normalizeComfyBaseUrl(baseUrl);
  if (options.tauriRuntime) return normalized;
  const proxyBaseUrl = String(options.proxyBaseUrl || "/comfy").replace(/\/+$/, "");
  if (options.forceProxy) return proxyBaseUrl;
  if (typeof window === "undefined" || !window.location) return normalized;
  try {
    const target = new URL(normalized);
    const page = new URL(window.location.href);
    const targetHost = target.hostname.toLowerCase();
    const pageHost = page.hostname.toLowerCase();
    const localTarget = ["127.0.0.1", "localhost", "::1"].includes(targetHost);
    const localPage = ["127.0.0.1", "localhost", "::1"].includes(pageHost);
    if (localTarget && localPage && target.port === "8188") return proxyBaseUrl;
  } catch {
    return normalized;
  }
  return normalized;
}

export function extractComfyMedia(baseUrl, item) {
  const media = { images: [], videos: [] };
  if (!item?.outputs) return media;
  Object.values(item.outputs).forEach((output) => {
    (output.images || []).forEach((file) => media.images.push(comfyFileUrl(baseUrl, file)));
    (output.gifs || []).forEach((file) => media.videos.push(comfyFileUrl(baseUrl, file)));
    (output.videos || []).forEach((file) => media.videos.push(comfyFileUrl(baseUrl, file)));
    (output.animated || []).forEach((file) => media.videos.push(comfyFileUrl(baseUrl, file)));
    Object.values(output).flat().forEach((file) => {
      if (!file?.filename || typeof file.filename !== "string") return;
      if (/\.(mp4|webm|mov|gif|avi)$/i.test(file.filename)) media.videos.push(comfyFileUrl(baseUrl, file));
    });
  });
  media.images = [...new Set(media.images)];
  media.videos = [...new Set(media.videos)];
  return media;
}

export function comfyFileUrl(baseUrl, file) {
  const params = new URLSearchParams({
    filename: file.filename,
    subfolder: file.subfolder || "",
    type: file.type || "output",
  });
  return `${baseUrl}/view?${params.toString()}`;
}

export function extractComfyError(item) {
  const status = item?.status;
  if (!status || status.completed !== false) return "";
  const messages = status.messages || [];
  const errorMessage = messages.flat().find((part) => typeof part === "object" && part?.exception_message);
  return errorMessage?.exception_message ? `ComfyUI 执行失败：${errorMessage.exception_message}` : "";
}

export async function splitImageToFrames(imageUrl, rows, cols, deps = {}) {
  const {
    loadImageImpl,
    splitImageGridImpl = splitImageGrid,
    tauriRuntime = isTauriRuntime(),
    documentImpl = typeof document !== "undefined" ? document : null,
  } = deps;
  if (tauriRuntime) {
    const result = await splitImageGridImpl({ imageUrl, rows, cols });
    return result.frames;
  }
  const imageLoader = loadImageImpl || (await import("./canvas/panorama-helpers.js")).loadImage;
  const image = await imageLoader(imageUrl);
  const frameWidth = Math.floor((image.naturalWidth || image.width) / cols);
  const frameHeight = Math.floor((image.naturalHeight || image.height) / rows);
  if (frameWidth < 1 || frameHeight < 1) throw new Error("图片尺寸太小，无法按当前行列拆分");
  const canvas = documentImpl.createElement("canvas");
  canvas.width = frameWidth;
  canvas.height = frameHeight;
  const ctx = canvas.getContext("2d");
  const frames = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      ctx.clearRect(0, 0, frameWidth, frameHeight);
      ctx.drawImage(image, col * frameWidth, row * frameHeight, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
      frames.push(canvas.toDataURL("image/png"));
    }
  }
  return frames;
}

export async function persistMediaAssetReference(request, deps = {}) {
  const {
    tauriRuntime = isTauriRuntime(),
    cacheMediaAssetImpl = cacheMediaAsset,
    convertFileSrcImpl = convertFileSrc,
  } = deps;
  const mediaUrl = String(request?.mediaUrl || "").trim();
  const mediaPath = String(request?.mediaPath || "").trim();
  if (mediaPath) {
    return {
      mediaUrl: mediaUrl || convertFileSrcImpl(mediaPath),
      mediaPath,
      originalMediaUrl: mediaUrl,
      thumbnailUrl: request?.thumbnailPath ? convertFileSrcImpl(request.thumbnailPath) : "",
      thumbnailPath: request?.thumbnailPath || "",
    };
  }
  if (!tauriRuntime || !mediaUrl) {
    return {
      mediaUrl,
      mediaPath: "",
      originalMediaUrl: "",
      thumbnailUrl: "",
      thumbnailPath: "",
    };
  }
  const saved = await cacheMediaAssetImpl({
    mediaUrl,
    mediaType: request?.mediaType || "image",
    fileName: request?.fileName || "media",
  });
  return {
    mediaUrl: convertFileSrcImpl(saved.path),
    mediaPath: saved.path,
    originalMediaUrl: mediaUrl,
    thumbnailUrl: saved.thumbnailPath ? convertFileSrcImpl(saved.thumbnailPath) : "",
    thumbnailPath: saved.thumbnailPath || "",
  };
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export async function persistGeneratedMediaResult(result, deps = {}) {
  const {
    tauriRuntime = isTauriRuntime(),
    fileName = "",
    convertFileSrcImpl = convertFileSrc,
  } = deps;
  if (!tauriRuntime || !result || typeof result !== "object") return result;
  let next = { ...result };
  if (String(result.imagePath || "").trim()) {
    const localImageUrl = convertFileSrcImpl(result.imagePath);
    const embeddedThumbnailUrl = String(result.imageThumbnailUrl || "").trim();
    const localThumbnailUrl = embeddedThumbnailUrl || (
      String(result.imageThumbnailPath || "").trim()
        ? convertFileSrcImpl(result.imageThumbnailPath)
        : localImageUrl
    );
    const originalImageUrl = String(result.originalImageUrl || result.imageUrl || "").trim();
    next = {
      ...next,
      imageUrl: localImageUrl,
      imageThumbnailUrl: localThumbnailUrl,
      originalImageUrl,
    };
  }
  if (String(result.imageUrl || "").trim() && !String(result.imagePath || "").trim()) {
    const saved = await persistMediaAssetReference({
      mediaUrl: result.imageUrl,
      mediaPath: result.imagePath,
      mediaType: "image",
      fileName: fileName || "image-result",
    }, deps);
    next = {
      ...next,
      imageUrl: saved.mediaUrl,
      imagePath: saved.mediaPath,
      originalImageUrl: saved.originalMediaUrl || result.imageUrl,
      imageThumbnailUrl: saved.thumbnailUrl,
      imageThumbnailPath: saved.thumbnailPath,
    };
  }
  if (String(result.videoPath || "").trim()) {
    next = {
      ...next,
      videoUrl: convertFileSrcImpl(result.videoPath),
    };
  }
  if (String(result.videoUrl || "").trim() && !String(result.videoPath || "").trim()) {
    const saved = await persistMediaAssetReference({
      mediaUrl: result.videoUrl,
      mediaPath: result.videoPath,
      mediaType: "video",
      fileName: fileName || "video-result",
    }, deps);
    next = {
      ...next,
      videoUrl: saved.mediaUrl,
      videoPath: saved.mediaPath,
      originalVideoUrl: saved.originalMediaUrl || result.videoUrl,
    };
  }
  return next;
}
