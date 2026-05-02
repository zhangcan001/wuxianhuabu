export function productionTasksToLegacyGenerationJobs(tasks = [], options = {}) {
  return (Array.isArray(tasks) ? tasks : [])
    .map((task) => productionTaskToLegacyGenerationJob(task, options))
    .filter(Boolean);
}

export function productionTaskToLegacyGenerationJob(task = {}, options = {}) {
  const episodeId = task.episodeId || options.episodeId || inferEpisodeId(task.id);
  if (task.type === "asset.image") {
    if (isManualUploadTask(task)) return null;
    const token = task.input?.token || task.target?.id || "";
    return {
      type: "asset.image",
      kind: "image",
      episodeId,
      targetType: "asset",
      targetId: task.target?.id || token,
      productionTaskId: task.id || "",
      sourceNodeId: options.assetNodeId || `episode-${episodeId}-assets`,
      sourceAssetToken: token,
      assetCategory: assetCategoryLabel(task.target?.assetType),
      title: `${token || task.target?.id || "资产"}-定妆图`,
      prompt: String(task.input?.prompt || "").trim(),
      providerMode: task.provider || options.providerMode || "mock",
      imageProviderMode: task.provider || options.providerMode || "mock",
      priority: priorityLabel(task.priority),
      queueStage: "asset-image",
    };
  }
  if (task.type === "shot.image") {
    if (isManualUploadTask(task)) return null;
    return {
      type: "shot.image",
      kind: "image",
      episodeId,
      shotId: task.target?.id || "",
      targetType: "shot",
      targetId: task.target?.id || "",
      productionTaskId: task.id || "",
      sourceNodeId: options.shotNodeId || `episode-${episodeId}-shots`,
      title: `${task.target?.id || "镜头"}-图片`,
      prompt: String(task.input?.prompt || "").trim(),
      providerMode: task.provider || options.providerMode || "mock",
      imageProviderMode: task.provider || options.providerMode || "mock",
      priority: priorityLabel(task.priority),
      queueStage: "shot-image",
      assetRefs: Array.isArray(task.input?.assetRefs) ? task.input.assetRefs : [],
    };
  }
  if (task.type === "shot.video") {
    if (isManualUploadTask(task)) return null;
    return {
      type: "shot.video",
      kind: "video",
      episodeId,
      shotId: task.target?.id || "",
      targetType: "shot",
      targetId: task.target?.id || "",
      productionTaskId: task.id || "",
      sourceNodeId: options.shotNodeId || `episode-${episodeId}-shots`,
      title: `${task.target?.id || "镜头"}-视频`,
      prompt: String(task.input?.prompt || "").trim(),
      videoRuntimeModel: task.provider || options.videoProvider || "",
      videoProviderMode: task.provider || options.videoProvider || "mock",
      providerMode: task.provider === "custom" ? "api" : (task.provider || options.videoProvider || "mock"),
      priority: priorityLabel(task.priority),
      queueStage: "shot-video",
      assetRefs: Array.isArray(task.input?.assetRefs) ? task.input.assetRefs : [],
      mainCharacterToken: task.input?.mainCharacterToken || "",
      mainSceneToken: task.input?.mainSceneToken || "",
      keyPropTokens: Array.isArray(task.input?.keyPropTokens) ? task.input.keyPropTokens : [],
    };
  }
  return null;
}

function isManualUploadTask(task = {}) {
  return task.provider === "upload" || task.input?.sourceMode === "upload" || task.status === "waiting-upload";
}

function inferEpisodeId(taskId = "") {
  const parts = String(taskId || "").split(":");
  return parts.length >= 3 ? parts[1] : "";
}

function assetCategoryLabel(type = "") {
  if (type === "scene") return "场景";
  if (type === "prop") return "道具";
  return "角色";
}

function priorityLabel(priority = "") {
  if (priority === "high") return "高";
  if (priority === "low") return "低";
  return priority || "中";
}
