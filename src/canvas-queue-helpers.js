function deriveShotQueueStatus(job, currentShot = {}, result = {}) {
  const hasVideoPrompt = Boolean(String(currentShot?.videoPrompt || job.videoPrompt || "").trim());
  if (job.kind === "video") return "已生成";
  return hasVideoPrompt ? "待生视频" : "已生成";
}

export function patchShotQueueState(nodes, job, patch, normalizeShotRecord) {
  if (!job?.sourceNodeId || !job?.shotId) return nodes;
  return nodes.map((node) => {
    if (node.id !== job.sourceNodeId || node.type !== "shotList") return node;
    const nextShots = (node.data?.shots || []).map((shot, index) => {
      const normalized = normalizeShotRecord(shot, index);
      if (normalized.id !== job.shotId) return shot;
      return { ...normalized, ...patch };
    });
    return { ...node, data: { ...node.data, shots: nextShots } };
  });
}

export function buildExportQueueHistoryEntry({
  job,
  status,
  detail = "",
  path = "",
  episodes,
  buildRenderHistoryOptions,
}) {
  return {
    requestId: job.requestId,
    type: "mp4",
    status,
    title: job.title || "导出任务",
    detail,
    path,
    episodeId: job.episodeId || "",
    episodeName: episodes.find((item) => item.id === job.episodeId)?.name || "当前集",
    renderOptions: job.exportRequest
      ? buildRenderHistoryOptions({
        presetId: job.exportRequest.presetId || "",
        presetName: job.exportRequest.presetName || "",
      }, job.exportRequest)
      : null,
  };
}

export function buildQueueResultNodePayload(job, result) {
  const imageProviderLabel = job.imageProviderMode === "custom"
    ? "API生图"
    : job.imageProviderMode === "comfy"
      ? "ComfyUI生图"
      : job.imageProviderMode === "upload"
        ? "本地上传"
        : "批量生图";
  return {
    ...result,
    displayName: job.kind === "video" ? "视频结果" : "图片结果",
    note: `${job.kind === "video" ? videoProviderLabel(job) : imageProviderLabel} · ${job.shotId || ""}`,
    sourcePrompt: job.prompt,
    targetShotId: job.shotId || "",
    sourceAssetToken: job.sourceAssetToken || "",
    sourceAssetName: job.sourceAssetName || "",
    sourceAssetCategory: job.assetCategory || "",
    mainCharacterToken: job.mainCharacterToken || "",
    mainSceneToken: job.mainSceneToken || "",
    keyPropTokens: Array.isArray(job.keyPropTokens) ? job.keyPropTokens.filter(Boolean) : [],
    assetRefs: Array.isArray(job.assetRefs) ? job.assetRefs.filter(Boolean) : [],
    referenceResources: String(job.referenceResources || ""),
    __offsetX: job.offsetX || 1080,
    __offsetY: job.offsetY || 0,
  };
}

function videoProviderLabel(job = {}) {
  if (job.videoProviderMode === "upload" || job.providerMode === "upload") return "本地上传视频";
  if (job.videoProviderMode === "custom" || job.providerMode === "api" || job.providerMode === "custom") return "API视频";
  if (job.videoProviderMode === "comfy" || job.providerMode === "comfy") return "ComfyUI视频";
  return "视频生成";
}

export function buildQueueShotSuccessPatch(job, result) {
  const resultPath = result.videoPath || result.imagePath || result.videoUrl || result.imageUrl || "";
  const imageDisplayUrl = result.imageUrl || result.imagePath || "";
  const videoDisplayUrl = result.videoUrl || result.videoPath || "";
  return {
    status: deriveShotQueueStatus(job, job, result),
    lastQueueResult: resultPath,
    imageResultUrl: imageDisplayUrl,
    videoResultUrl: videoDisplayUrl,
    imageUrl: imageDisplayUrl,
    videoUrl: videoDisplayUrl,
    imagePath: result.imagePath || "",
    videoPath: result.videoPath || "",
    imageThumbnailUrl: result.imageThumbnailUrl || result.thumbnailUrl || "",
    imageThumbnailPath: result.imageThumbnailPath || result.thumbnailPath || "",
    resultDecision: "",
    resultDecisionAt: 0,
    reworkReason: "",
  };
}

export function buildQueueAssetSuccessPatch(result = {}) {
  const imageDisplayUrl = result.imageUrl || result.imagePath || "";
  return {
    imageUrl: imageDisplayUrl,
    imagePath: result.imagePath || "",
    originalImageUrl: result.originalImageUrl || result.imageUrl || "",
    imageThumbnailUrl: result.imageThumbnailUrl || result.thumbnailUrl || "",
    imageThumbnailPath: result.imageThumbnailPath || result.thumbnailPath || "",
    lastImageSavedAt: Date.now(),
  };
}

export function buildTimelineShotPatchFromQueue(job, result, currentShot) {
  const nextStatus = deriveShotQueueStatus(job, currentShot, result);
  const resultPath = result.videoPath || result.imagePath || result.videoUrl || result.imageUrl || "";
  const imageDisplayUrl = result.imageUrl || result.imagePath || "";
  const videoDisplayUrl = result.videoUrl || result.videoPath || "";
  return {
    ...currentShot,
    lastQueueResult: resultPath || currentShot.lastQueueResult || "",
    imageResultUrl: imageDisplayUrl || currentShot.imageResultUrl || "",
    videoResultUrl: videoDisplayUrl || currentShot.videoResultUrl || "",
    imageUrl: imageDisplayUrl || currentShot.imageUrl || "",
    videoUrl: videoDisplayUrl || currentShot.videoUrl || "",
    imagePath: result.imagePath || currentShot.imagePath || "",
    videoPath: result.videoPath || currentShot.videoPath || "",
    imageThumbnailUrl: result.imageThumbnailUrl || result.thumbnailUrl || currentShot.imageThumbnailUrl || "",
    imageThumbnailPath: result.imageThumbnailPath || result.thumbnailPath || currentShot.imageThumbnailPath || "",
    status: nextStatus,
    resultDecision: "",
    resultDecisionAt: 0,
    reworkReason: "",
  };
}

export function buildQueueResultSummary(result, shortTitle) {
  return shortTitle(result.note || result.path || result.videoUrl || result.imageUrl || "已完成");
}
