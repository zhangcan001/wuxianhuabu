import {
  buildMediaSourcePolicy,
  canQueueMediaSource,
  mediaSourceModeLabel,
  MEDIA_SOURCE_MODES,
  normalizeMediaSourceMode,
  resolveMediaSourceMode,
} from "./media-source-policy.js";

export const IMAGE_SOURCE_MODES = MEDIA_SOURCE_MODES;

export function normalizeImageSourceMode(value = "") {
  return normalizeMediaSourceMode(value);
}

export function resolveImageSourceMode(preferred = "", fallback = "mock") {
  return resolveMediaSourceMode(preferred, fallback);
}

export function imageSourceModeLabel(mode = "") {
  return mediaSourceModeLabel(mode, "image");
}

export function canQueueImageSource(mode = "") {
  return canQueueMediaSource(mode);
}

export function buildImageSourcePolicy(input = {}) {
  return buildMediaSourcePolicy({
    ...input,
    kind: "image",
    mode: input.mode || input.providerMode || input.imageProviderMode,
  });
}
