import {
  buildShotContinuityPrompt,
} from "./shot-continuity-prompt.js";

export function shouldPreferVideoForShot(shot = {}) {
  return String(shot.videoPrompt || "").trim().length > 0
    && !String(shot.imagePrompt || "").trim();
}

export function buildShotVideoJob(sourceNodeId, shot = {}, options = {}) {
  const {
    buildVideoShotPrompt = (item) => item.videoPrompt || "",
    resolveShotVideoProviderMode = () => options.providerMode || "mock",
    settings = {},
    offsetX = 1480,
    offsetY = 0,
  } = options;
  const basePrompt = String(buildVideoShotPrompt(shot) || "").trim();
  const prompt = buildShotContinuityPrompt(shot, options.assets || [], {
    basePrompt,
    kind: "video",
    enabled: options.continuityPrompt !== false,
  });
  if (!prompt) return null;
  const videoProviderMode = resolveShotVideoProviderMode(shot, settings);
  if (videoProviderMode === "upload") return null;
  return {
    sourceNodeId,
    shotId: shot.id,
    title: `${shot.id || "镜头"}-视频`,
    kind: "video",
    prompt,
    videoProviderMode,
    providerMode: videoProviderMode === "custom" ? "api" : videoProviderMode,
    videoRuntimeModel: shot.videoRuntimeModel || "",
    videoModelPreset: shot.videoModelPreset || "",
    videoParamPreset: shot.videoParamPreset || "",
    videoAspectRatio: shot.videoAspectRatio || "",
    mainCharacterToken: shot.mainCharacterToken || "",
    mainSceneToken: shot.mainSceneToken || "",
    keyPropTokens: Array.isArray(shot.keyPropTokens) ? shot.keyPropTokens.filter(Boolean) : [],
    assetRefs: Array.isArray(shot.assetRefs) ? shot.assetRefs.filter(Boolean) : [],
    referenceResources: String(shot.referenceResources || ""),
    offsetX,
    offsetY,
  };
}

export function buildCascadedVideoJobsAfterImage(imageJob = {}, queue = [], options = {}) {
  const {
    activeStatuses = ["pending", "running", "done"],
    shortTitle = defaultShortTitle,
  } = options;
  if (imageJob.kind !== "image") return [];
  if (!imageJob.autoCascadeVideo) return [];
  const prompt = String(imageJob.videoPrompt || "").trim();
  if (!prompt) return [];
  if (imageJob.videoProviderMode === "upload") return [];
  const exists = (Array.isArray(queue) ? queue : []).some((job) => (
    job.kind === "video"
    && job.sourceNodeId === imageJob.sourceNodeId
    && job.shotId === imageJob.shotId
    && activeStatuses.includes(job.status)
  ));
  if (exists) return [];
  return [{
    ...imageJob,
    id: undefined,
    kind: "video",
    title: `${imageJob.shotId || shortTitle(imageJob.title || "镜头")}-视频`,
    prompt,
    videoProviderMode: imageJob.videoProviderMode || imageJob.providerMode || "",
    offsetX: 1480,
    autoCascadeVideo: false,
  }];
}

function defaultShortTitle(value = "") {
  return String(value || "").trim().slice(0, 12);
}
