import {
  buildMediaSourcePolicy,
  canQueueMediaSource,
  mediaSourceModeLabel,
  MEDIA_SOURCE_MODES,
  normalizeMediaSourceMode,
  resolveMediaSourceMode,
} from "./media-source-policy.js";

export const VIDEO_SOURCE_MODES = MEDIA_SOURCE_MODES;

export function normalizeVideoSourceMode(value = "") {
  return normalizeMediaSourceMode(value);
}

export function resolveVideoSourceMode(preferred = "", fallback = "mock") {
  return resolveMediaSourceMode(preferred, fallback);
}

export function videoSourceModeLabel(mode = "") {
  return mediaSourceModeLabel(mode, "video");
}

export function canQueueVideoSource(mode = "") {
  return canQueueMediaSource(mode);
}

export function buildVideoSourcePolicy(input = {}) {
  return buildMediaSourcePolicy({
    ...input,
    kind: "video",
    mode: input.mode || input.providerMode || input.videoProviderMode,
  });
}
