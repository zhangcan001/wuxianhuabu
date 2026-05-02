export const MEDIA_SOURCE_MODES = {
  inherit: "inherit",
  api: "api",
  comfy: "comfy",
  upload: "upload",
  mock: "mock",
};

export const MEDIA_KINDS = {
  image: "image",
  video: "video",
};

export function normalizeMediaKind(value = "image") {
  const kind = String(value || "").trim().toLowerCase();
  return kind === MEDIA_KINDS.video ? MEDIA_KINDS.video : MEDIA_KINDS.image;
}

export function normalizeMediaSourceMode(value = "") {
  const mode = String(value || "").trim().toLowerCase();
  if (["api", "custom", "http", "openai"].includes(mode)) return MEDIA_SOURCE_MODES.api;
  if (["comfy", "comfyui"].includes(mode)) return MEDIA_SOURCE_MODES.comfy;
  if (["upload", "local-upload", "local", "manual"].includes(mode)) return MEDIA_SOURCE_MODES.upload;
  if (["mock", "demo", "simulate"].includes(mode)) return MEDIA_SOURCE_MODES.mock;
  return MEDIA_SOURCE_MODES.inherit;
}

export function resolveMediaSourceMode(preferred = "", fallback = "mock") {
  const preferredMode = normalizeMediaSourceMode(preferred);
  if (preferredMode !== MEDIA_SOURCE_MODES.inherit) return preferredMode;
  const fallbackMode = normalizeMediaSourceMode(fallback);
  return fallbackMode === MEDIA_SOURCE_MODES.inherit ? MEDIA_SOURCE_MODES.mock : fallbackMode;
}

export function mediaSourceModeLabel(mode = "", kind = "image") {
  const normalizedMode = normalizeMediaSourceMode(mode);
  const normalizedKind = normalizeMediaKind(kind);
  const apiLabel = normalizedKind === MEDIA_KINDS.video ? "API 视频" : "API 生图";
  const comfyLabel = normalizedKind === MEDIA_KINDS.video ? "ComfyUI 视频" : "ComfyUI 生图";
  const labels = {
    [MEDIA_SOURCE_MODES.api]: apiLabel,
    [MEDIA_SOURCE_MODES.comfy]: comfyLabel,
    [MEDIA_SOURCE_MODES.upload]: "本地上传",
    [MEDIA_SOURCE_MODES.mock]: "本地模拟",
    [MEDIA_SOURCE_MODES.inherit]: "跟随全局",
  };
  return labels[normalizedMode] || labels.inherit;
}

export function canQueueMediaSource(mode = "") {
  const normalized = normalizeMediaSourceMode(mode);
  return normalized === MEDIA_SOURCE_MODES.api
    || normalized === MEDIA_SOURCE_MODES.comfy
    || normalized === MEDIA_SOURCE_MODES.mock;
}

export function buildMediaSourcePolicy(input = {}) {
  const kind = normalizeMediaKind(input.kind || input.mediaKind || input.type);
  const mode = resolveMediaSourceMode(input.mode || input.providerMode || input.sourceMode, input.fallbackMode || input.globalMode);
  return {
    kind,
    mode,
    label: mediaSourceModeLabel(mode, kind),
    queueable: canQueueMediaSource(mode),
    requiresUpload: mode === MEDIA_SOURCE_MODES.upload,
    providerMode: mode === MEDIA_SOURCE_MODES.api ? "custom" : mode,
  };
}
