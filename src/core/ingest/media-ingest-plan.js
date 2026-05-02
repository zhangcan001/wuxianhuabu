import {
  normalizeMediaKind,
  normalizeMediaSourceMode,
} from "../providers/media-source-policy.js";

export function buildMediaIngestPlan(input = {}) {
  const kind = normalizeMediaKind(input.kind || input.mediaKind);
  const target = normalizeMediaTarget(input.target || {
    type: input.targetType || "shot",
    id: input.targetId || input.shotId || input.assetId || "",
  });
  const sourceMode = normalizeMediaSourceMode(input.sourceMode || input.providerMode || "upload");
  const mediaUrl = String(input.mediaUrl || input.imageUrl || input.videoUrl || input.url || "").trim();
  const mediaPath = String(input.mediaPath || input.imagePath || input.videoPath || "").trim();
  const episodeId = input.episodeId || "";
  const projectId = input.projectId || "";
  const field = kind === "video" ? "videoResultUrl" : "imageResultUrl";
  const taskType = target.type === "asset" ? "asset.image" : `shot.${kind}`;
  const plan = {
    ok: Boolean(target.id && (mediaUrl || mediaPath)),
    projectId,
    episodeId,
    kind,
    sourceMode,
    providerId: sourceMode,
    target,
    taskType,
    taskId: input.taskId || `${sourceMode}-${kind}:${episodeId || "episode"}:${target.id || "target"}`,
    field,
    result: buildMediaResult({ kind, mediaUrl, mediaPath, input }),
    eventType: `production.${kind}.${sourceMode === "upload" ? "uploaded" : "ingested"}`,
    blockers: [],
  };
  return {
    ...plan,
    blockers: buildIngestBlockers(plan),
  };
}

export function buildShotPatchFromMediaIngest(plan = {}) {
  if (!plan.ok || plan.target?.type !== "shot") return null;
  const resultUrl = plan.kind === "video"
    ? plan.result.videoPath || plan.result.videoUrl
    : plan.result.imagePath || plan.result.imageUrl;
  return {
    lastQueueResult: resultUrl || "",
    ...(plan.kind === "video"
      ? { videoResultUrl: resultUrl || "", status: "已生成" }
      : { imageResultUrl: resultUrl || "", status: "待生视频" }),
    resultDecision: "",
    resultDecisionAt: 0,
    reworkReason: "",
  };
}

function buildMediaResult({ kind, mediaUrl, mediaPath, input }) {
  if (kind === "video") {
    return {
      videoUrl: mediaUrl || mediaPath,
      videoPath: mediaPath,
      originalVideoUrl: input.originalVideoUrl || mediaUrl,
      note: input.note || "",
      targetShotId: input.shotId || input.targetId || input.target?.id || "",
    };
  }
  return {
    imageUrl: mediaUrl || mediaPath,
    imagePath: mediaPath,
    originalImageUrl: input.originalImageUrl || mediaUrl,
    imageThumbnailUrl: input.imageThumbnailUrl || input.thumbnailUrl || "",
    imageThumbnailPath: input.imageThumbnailPath || input.thumbnailPath || "",
    note: input.note || "",
    targetShotId: input.shotId || input.targetId || input.target?.id || "",
  };
}

function buildIngestBlockers(plan = {}) {
  return [
    plan.target?.id ? "" : "target",
    (plan.result?.imageUrl || plan.result?.videoUrl) ? "" : "media",
  ].filter(Boolean);
}

function normalizeMediaTarget(target = {}) {
  return {
    type: target.type || "shot",
    id: target.id || "",
    assetType: target.assetType || "",
  };
}
