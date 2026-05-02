export function createProductionTaskStore(input = {}) {
  const tasks = normalizeProductionTasks(input.tasks || input.jobs || []);
  return {
    tasks,
    byId: new Map(tasks.map((task) => [task.id, task])),
    byTarget: indexTasksByTarget(tasks),
    summary: summarizeProductionTasks(tasks),
  };
}

export function normalizeProductionTasks(tasks = []) {
  return (Array.isArray(tasks) ? tasks : [])
    .map(normalizeProductionTask)
    .filter((task) => task.id && task.type);
}

export function normalizeProductionTask(task = {}) {
  const target = task.target && typeof task.target === "object" ? task.target : {};
  const targetType = task.targetType || target.type || inferTaskTargetType(task);
  const targetId = task.targetId || task.shotId || task.assetId || task.sourceAssetToken || target.id || "";
  const type = task.type || legacyKindToTaskType(task.kind, targetType);
  const episodeId = task.episodeId || target.episodeId || inferEpisodeIdFromTaskId(task.id);
  const providerMode = task.providerMode || task.provider || "";
  const prompt = task.prompt || task.input?.prompt || "";
  const id = task.id || [
    type,
    episodeId,
    targetType,
    targetId,
    providerMode || task.imageProviderMode || task.videoProviderMode || "",
  ].filter(Boolean).join(":");
  return {
    ...task,
    id,
    type,
    kind: task.kind || taskTypeToLegacyKind(type),
    episodeId,
    targetType,
    targetId,
    providerMode,
    prompt,
    status: normalizeTaskStatus(task.status),
    queueStage: task.queueStage || type.replace(".", "-"),
    priority: task.priority || "中",
    createdAt: task.createdAt || "",
    updatedAt: task.updatedAt || "",
  };
}

export function productionTasksToQueueJobs(tasks = [], options = {}) {
  return normalizeProductionTasks(tasks).map((task, index) => {
    const kind = task.kind || taskTypeToLegacyKind(task.type);
    const providerMode = task.providerMode || task.provider || options.providerMode || options.videoProvider || "";
    const shotId = task.shotId || (task.targetType === "shot" ? task.targetId : "");
    const sourceNodeId = task.sourceNodeId || options.sourceNodeId || defaultSourceNodeId(task, options);
    return {
      ...task,
      id: task.id || `task-${index + 1}`,
      kind,
      sourceNodeId,
      shotId,
      targetId: task.targetId || shotId,
      sourceAssetToken: task.sourceAssetToken || (task.targetType === "asset" ? task.targetId : ""),
      prompt: task.prompt || task.input?.prompt || "",
      providerMode,
      imageProviderMode: task.imageProviderMode || (kind === "image" ? providerMode : ""),
      videoProviderMode: task.videoProviderMode || (kind === "video" ? options.videoProvider || providerMode : ""),
      mainCharacterToken: task.mainCharacterToken || task.input?.mainCharacterToken || "",
      mainSceneToken: task.mainSceneToken || task.input?.mainSceneToken || "",
      keyPropTokens: Array.isArray(task.keyPropTokens) ? task.keyPropTokens : Array.isArray(task.input?.keyPropTokens) ? task.input.keyPropTokens : [],
      assetRefs: Array.isArray(task.assetRefs) ? task.assetRefs : Array.isArray(task.input?.assetRefs) ? task.input.assetRefs : [],
      status: task.status || "pending",
    };
  });
}

export function summarizeProductionTasks(tasks = []) {
  const normalized = normalizeProductionTasks(tasks);
  return {
    total: normalized.length,
    pending: normalized.filter((task) => task.status === "pending").length,
    running: normalized.filter((task) => task.status === "running").length,
    done: normalized.filter((task) => task.status === "done").length,
    failed: normalized.filter((task) => task.status === "failed").length,
    byType: countBy(normalized, (task) => task.type),
    byTargetType: countBy(normalized, (task) => task.targetType || "unknown"),
  };
}

function indexTasksByTarget(tasks = []) {
  return tasks.reduce((index, task) => {
    const key = `${task.episodeId || ""}:${task.targetType || ""}:${task.targetId || ""}`;
    if (!index.has(key)) index.set(key, []);
    index.get(key).push(task);
    return index;
  }, new Map());
}

function normalizeTaskStatus(status = "") {
  if (["queued", "waiting"].includes(status)) return "pending";
  if (["success", "completed"].includes(status)) return "done";
  if (["error"].includes(status)) return "failed";
  return status || "pending";
}

function inferTaskTargetType(task = {}) {
  if (task.targetType) return task.targetType;
  if (task.target?.type) return task.target.type;
  if (task.assetId || task.sourceAssetToken || task.type === "asset.image") return "asset";
  if (task.shotId || task.kind === "image" || task.kind === "video" || /^shot\./.test(task.type || "")) return "shot";
  if (task.type === "delivery.export") return "delivery";
  return "";
}

function inferEpisodeIdFromTaskId(taskId = "") {
  const parts = String(taskId || "").split(":");
  return parts.length >= 3 ? parts[1] : "";
}

function defaultSourceNodeId(task = {}, options = {}) {
  if (task.targetType === "asset") return options.assetNodeId || (task.episodeId ? `episode-${task.episodeId}-assets` : "");
  if (task.targetType === "shot") return options.shotNodeId || (task.episodeId ? `episode-${task.episodeId}-shots` : "");
  return "";
}

function legacyKindToTaskType(kind = "", targetType = "") {
  if (kind === "image" && targetType === "asset") return "asset.image";
  if (kind === "image") return "shot.image";
  if (kind === "video") return "shot.video";
  return "";
}

function taskTypeToLegacyKind(type = "") {
  if (type === "asset.image" || type === "shot.image") return "image";
  if (type === "shot.video") return "video";
  if (type === "delivery.export") return "delivery";
  return "";
}

function countBy(items = [], getKey = () => "") {
  return items.reduce((counts, item) => {
    const key = getKey(item) || "unknown";
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}
