import { buildMediaIngestPlan } from "../core/ingest/media-ingest-plan.js";

export function selectUploadShotTarget(entries = [], {
  shotId = "",
  kind = "image",
} = {}) {
  const source = Array.isArray(entries) ? entries : [];
  if (shotId) return source.find(({ shot }) => shot?.id === shotId) || null;
  const resultFields = kind === "video"
    ? ["videoResultUrl", "videoResult"]
    : ["imageResultUrl", "imageResult"];
  return source.find(({ shot }) => resultFields.every((field) => !String(shot?.[field] || "").trim()))
    || source[0]
    || null;
}

export function buildShotImageUploadAction(input = {}) {
  const {
    projectId = "",
    episodeId = "",
    target = {},
    persisted = {},
    sourceUrl = "",
  } = input;
  const shotId = target?.shot?.id || "";
  const ingestPlan = buildMediaIngestPlan({
    projectId,
    episodeId,
    kind: "image",
    sourceMode: "upload",
    target: { type: "shot", id: shotId },
    mediaUrl: persisted.imageUrl || sourceUrl,
    mediaPath: persisted.imagePath || "",
    originalImageUrl: persisted.originalImageUrl || sourceUrl,
    imageThumbnailUrl: persisted.imageThumbnailUrl || "",
    imageThumbnailPath: persisted.imageThumbnailPath || "",
    note: `本地上传图片 · ${shotId}`,
  });
  if (!ingestPlan.ok) throw new Error("本地图片导入计划不完整，请重新选择图片。");
  const result = ingestPlan.result;
  const job = {
    type: "shot.image",
    kind: "image",
    episodeId: ingestPlan.episodeId,
    shotId,
    targetType: "shot",
    targetId: shotId,
    sourceNodeId: target.node?.id || "",
    title: `${shotId}-本地图片`,
    prompt: target.shot?.imagePrompt || "",
    imageProviderMode: "upload",
    providerMode: "upload",
    queueStage: "shot-image-upload",
  };
  return {
    ingestPlan,
    result,
    job,
    media: {
      kind: "image",
      sourceMode: "upload",
      target: ingestPlan.target,
      mediaUrl: persisted.imageUrl || sourceUrl,
      mediaPath: persisted.imagePath || "",
      originalImageUrl: persisted.originalImageUrl || sourceUrl,
      imageThumbnailUrl: persisted.imageThumbnailUrl || "",
      imageThumbnailPath: persisted.imageThumbnailPath || "",
      note: `本地上传图片 · ${shotId}`,
    },
  };
}

export function buildShotVideoUploadAction(input = {}) {
  const {
    projectId = "",
    episodeId = "",
    target = {},
    persisted = {},
    sourceUrl = "",
  } = input;
  const shotId = target?.shot?.id || "";
  const ingestPlan = buildMediaIngestPlan({
    projectId,
    episodeId,
    kind: "video",
    sourceMode: "upload",
    target: { type: "shot", id: shotId },
    mediaUrl: persisted.mediaUrl || sourceUrl,
    mediaPath: persisted.mediaPath || "",
    originalVideoUrl: persisted.originalMediaUrl || sourceUrl,
    note: `本地上传视频 · ${shotId}`,
  });
  if (!ingestPlan.ok) throw new Error("本地视频导入计划不完整，请重新选择视频。");
  const result = ingestPlan.result;
  const job = {
    type: "shot.video",
    kind: "video",
    episodeId: ingestPlan.episodeId,
    shotId,
    targetType: "shot",
    targetId: shotId,
    sourceNodeId: target.node?.id || "",
    title: `${shotId}-本地视频`,
    prompt: target.shot?.videoPrompt || "",
    videoProviderMode: "upload",
    providerMode: "upload",
    queueStage: "shot-video-upload",
  };
  return {
    ingestPlan,
    result,
    job,
    media: {
      kind: "video",
      sourceMode: "upload",
      target: ingestPlan.target,
      mediaUrl: persisted.mediaUrl || sourceUrl,
      mediaPath: persisted.mediaPath || "",
      originalVideoUrl: persisted.originalMediaUrl || sourceUrl,
      note: `本地上传视频 · ${shotId}`,
    },
  };
}

export function buildAssetImageUploadAction(input = {}) {
  const {
    projectId = "",
    episodeId = "",
    asset = {},
    targetId = "",
    persisted = {},
    sourceUrl = "",
  } = input;
  const assetLabel = asset.name || asset.token || targetId;
  const ingestPlan = buildMediaIngestPlan({
    projectId,
    episodeId,
    kind: "image",
    sourceMode: "upload",
    target: { type: "asset", id: targetId, assetType: asset.type || "" },
    mediaUrl: persisted.imageUrl || sourceUrl,
    mediaPath: persisted.imagePath || "",
    originalImageUrl: persisted.originalImageUrl || sourceUrl,
    imageThumbnailUrl: persisted.imageThumbnailUrl || "",
    imageThumbnailPath: persisted.imageThumbnailPath || "",
    note: `本地上传资产图 · ${assetLabel}`,
  });
  if (!ingestPlan.ok) throw new Error("本地资产图导入计划不完整，请重新选择图片。");
  const result = ingestPlan.result;
  const job = {
    type: "asset.image",
    kind: "image",
    episodeId: ingestPlan.episodeId,
    targetType: "asset",
    targetId,
    sourceNodeId: asset.sourceNodeId || "",
    sourceAssetToken: asset.token || targetId,
    sourceAssetName: asset.name || "",
    assetCategory: asset.typeLabel || asset.category || asset.type || "资产",
    title: `${assetLabel}-本地定妆图`,
    prompt: asset.prompt || asset.visualLock || "",
    imageProviderMode: "upload",
    providerMode: "upload",
    queueStage: "asset-image-upload",
  };
  return {
    ingestPlan,
    result,
    job,
    media: {
      kind: "image",
      sourceMode: "upload",
      target: ingestPlan.target,
      mediaUrl: persisted.imageUrl || sourceUrl,
      mediaPath: persisted.imagePath || "",
      originalImageUrl: persisted.originalImageUrl || sourceUrl,
      imageThumbnailUrl: persisted.imageThumbnailUrl || "",
      imageThumbnailPath: persisted.imageThumbnailPath || "",
      note: `本地上传资产图 · ${assetLabel}`,
    },
  };
}
