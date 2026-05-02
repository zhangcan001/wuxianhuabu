import {
  buildShotContinuityPrompt,
} from "./domain/shot-continuity-prompt.js";

function buildTimelineApprovalFromShot(shot) {
  if (shot?.resultDecision === "complete" || shot?.resultDecision === "confirm") return "已通过";
  if (shot?.resultDecision === "rework" || shot?.status === "待修改") return "退回修改";
  if (shot?.videoResultUrl || shot?.imageResultUrl || shot?.lastQueueResult) return "待验收";
  return "待验收";
}

export async function copyText(text) {
  await navigator.clipboard.writeText(String(text || ""));
}

export async function copyTextWithFeedback({ text, setMessage, successMessage, errorPrefix = "" }) {
  try {
    await copyText(text);
    if (successMessage) setMessage?.(successMessage);
    return true;
  } catch (error) {
    const detail = error?.message || String(error) || "复制失败";
    setMessage?.(errorPrefix ? `${errorPrefix}${detail}` : detail);
    return false;
  }
}

export function setNodeMessage(setMessage, text) {
  setMessage?.(String(text || ""));
}

export function setNodeError(setMessage, prefix, error) {
  const detail = error?.message || String(error) || "操作失败";
  setMessage?.(`${prefix}${detail}`);
}

export function describeGeminiProgressMessage(progress) {
  if (!progress) return "";
  if (progress.kind === "failed") {
    return `Gemini 已完成 ${progress.completed}/${progress.total} 张，其中任务 ${progress.index + 1} 未返回图片。`;
  }
  return `Gemini 已返回 ${progress.completed}/${progress.total} 张，正在继续生成剩余任务。`;
}

export function describeGeminiFinalMessage({ imagesLength = 0, total = 0, profileDir = "" }) {
  return `已自动获取 ${imagesLength}/${total} 张 Gemini 图片。Chrome 配置：${profileDir || "本地配置目录"}`;
}

export function patchNodeData(updateNode, nodeId, patch) {
  updateNode(nodeId, patch);
}

export function setNodeField(updateNode, nodeId, field, value, extraPatch = {}) {
  updateNode(nodeId, { [field]: value, ...extraPatch });
}

export function clearNodeField(updateNode, nodeId, field, extraPatch = {}) {
  updateNode(nodeId, { [field]: "", ...extraPatch });
}

export function applyNodeFieldTemplate(updateNode, nodeId, field, template, extraPatch = {}) {
  updateNode(nodeId, { [field]: template, ...extraPatch });
}

export function appendNodeFieldToken({ updateNode, nodeId, field, currentValue, token, appendToken, extraPatch = {} }) {
  updateNode(nodeId, {
    [field]: appendToken(currentValue || "", token),
    ...extraPatch,
  });
}

export function normalizeUploadNodeData(data = {}) {
  return {
    displayName: String(data.displayName || "上传图片"),
    imageUrl: String(data.imageUrl || ""),
    url: String(data.url || ""),
  };
}

export function normalizeImageEditNodeData(data = {}) {
  return {
    prompt: String(data.prompt || ""),
    targetShotId: String(data.targetShotId || ""),
    mainCharacterToken: String(data.mainCharacterToken || ""),
    mainSceneToken: String(data.mainSceneToken || ""),
    keyPropTokens: Array.isArray(data.keyPropTokens) ? data.keyPropTokens.filter(Boolean) : [],
    assetRefs: Array.isArray(data.assetRefs) ? data.assetRefs.filter(Boolean) : [],
    referenceResources: String(data.referenceResources || ""),
    sourceAssetToken: String(data.sourceAssetToken || ""),
    sourceAssetName: String(data.sourceAssetName || ""),
    sourceAssetVariant: String(data.sourceAssetVariant || ""),
    assetPromptSeed: String(data.assetPromptSeed || ""),
    autoStart: Boolean(data.autoStart),
    providerMode: String(data.providerMode || "inherit"),
    apiPresetId: String(data.apiPresetId || ""),
    apiModel: String(data.apiModel || ""),
    apiImagePath: String(data.apiImagePath || ""),
    apiImageSize: String(data.apiImageSize || ""),
    apiAspectRatio: String(data.apiAspectRatio || ""),
    comfyPositiveNodeId: String(data.comfyPositiveNodeId || ""),
    comfyTimeoutSeconds: String(data.comfyTimeoutSeconds || ""),
    lastCheckStatus: String(data.lastCheckStatus || ""),
    lastCheckMessage: String(data.lastCheckMessage || ""),
    lastResolvedSummary: String(data.lastResolvedSummary || ""),
  };
}

export function normalizeGeminiWebNodeData(data = {}) {
  return {
    prompt: String(data.prompt || ""),
    imageUrl: String(data.imageUrl || ""),
    displayName: String(data.displayName || "Gemini网页生图"),
    targetShotId: String(data.targetShotId || ""),
    mainCharacterToken: String(data.mainCharacterToken || ""),
    mainSceneToken: String(data.mainSceneToken || ""),
    keyPropTokens: Array.isArray(data.keyPropTokens) ? data.keyPropTokens.filter(Boolean) : [],
    assetRefs: Array.isArray(data.assetRefs) ? data.assetRefs.filter(Boolean) : [],
    referenceResources: String(data.referenceResources || ""),
    sourceAssetToken: String(data.sourceAssetToken || ""),
    sourceAssetName: String(data.sourceAssetName || ""),
    sourceAssetVariant: String(data.sourceAssetVariant || ""),
    autoStart: Boolean(data.autoStart),
    geminiUrl: String(data.geminiUrl || "https://gemini.google.com/app"),
    loginTimeoutSeconds: String(data.loginTimeoutSeconds || "180"),
    timeoutSeconds: String(data.timeoutSeconds || "240"),
    parallelCount: String(data.parallelCount || "1"),
    splitMode: String(data.splitMode || "paragraph"),
    geminiFailedIndexes: Array.isArray(data.geminiFailedIndexes) ? data.geminiFailedIndexes : [],
  };
}

export function normalizeTextNodeData(data = {}) {
  return {
    displayName: String(data.displayName || "文本注释"),
    text: String(data.text || ""),
  };
}

export function normalizeStoryboardNodeData(data = {}) {
  const rows = Math.max(1, Math.min(4, Number(data.rows) || 2));
  const cols = Math.max(1, Math.min(4, Number(data.cols) || 2));
  const count = rows * cols;
  const rawFrames = Array.isArray(data.frames) ? data.frames : [];
  const frames = Array.from({ length: count }, (_, index) => String(rawFrames[index] || ""));
  return {
    rows,
    cols,
    frames,
  };
}

export function normalizeSplitNodeData(data = {}) {
  return {
    rows: Math.max(1, Math.min(6, Number(data.rows) || 2)),
    cols: Math.max(1, Math.min(6, Number(data.cols) || 2)),
    imageUrl: String(data.imageUrl || ""),
    url: String(data.url || ""),
  };
}

export function normalizeNovelPipelineNodeData(data = {}, defaults = {}) {
  return {
    novel: String(data.novel || ""),
    scriptTemplate: String(data.scriptTemplate || data.template || defaults.scriptTemplate || ""),
    reviewTemplate: String(data.reviewTemplate || defaults.reviewTemplate || ""),
    assetTemplate: String(data.assetTemplate || defaults.assetTemplate || ""),
    promptTemplate: String(data.promptTemplate || defaults.promptTemplate || ""),
    taskMode: String(data.taskMode || defaults.taskMode || "plot"),
    genre: String(data.genre || defaults.genre || "漫剧"),
    stylePreset: String(data.stylePreset || defaults.stylePreset || "强钩子短剧"),
    imageStyle: String(data.imageStyle || defaults.imageStyle || "CG电影感"),
    duration: String(data.duration || defaults.duration || "60秒"),
    audience: String(data.audience || defaults.audience || "短视频用户"),
    tone: String(data.tone || defaults.tone || "高冲突、快节奏"),
    episodes: String(data.episodes || defaults.episodes || "1"),
    pipeline: data.pipeline && typeof data.pipeline === "object" ? data.pipeline : null,
    recentTasks: Array.isArray(data.recentTasks) ? data.recentTasks : [],
    templatePresetId: String(data.templatePresetId || ""),
    lastFactoryNote: String(data.lastFactoryNote || ""),
  };
}

export function describeLinkResult(result, label, options = {}) {
  if (!result) return "";
  const updatedPrefix = options.updatedPrefix || "已同步到最近";
  const createdPrefix = options.createdPrefix || "已创建";
  return result.mode === "updated" ? `${updatedPrefix}${label}节点` : `${createdPrefix}${label}节点`;
}

export function describePromptNodeResult(result, mode) {
  if (String(mode || "").includes("-run")) {
    const label = mode.includes("comfy")
      ? "Comfy 一键生成"
      : mode.includes("gemini")
        ? "Gemini 一键生成"
        : "API 一键生成";
    return describeLinkResult(result, label, { updatedPrefix: "已发送到最近", createdPrefix: "已创建并启动" });
  }
  const label = String(mode || "").startsWith("image") ? "图片提示词" : "视频提示词";
  return describeLinkResult(result, label);
}

export function describeShotDraftResult(result) {
  if (!result) return "";
  return result.mode === "updated"
    ? `已向最近镜头表追加 ${result.count} 条草稿`
    : `已创建镜头表草稿 ${result.count} 条`;
}

export function createGeneratingResultNode({ createOutputNear, sourceNodeId, title, note, extra = {} }) {
  return createOutputNear(sourceNodeId, "result", title, {
    isGenerating: true,
    note: note || "正在生成...",
    ...extra,
  });
}

export function applyGeneratedResult({ updateNode, outputId, result, sourcePrompt, extra = {} }) {
  updateNode(outputId, {
    ...result,
    isGenerating: false,
    sourcePrompt: sourcePrompt || "",
    ...extra,
  });
}

export function applyGeneratedFallback({
  updateNode,
  outputId,
  error,
  sourcePrompt,
  fallbackImageUrl,
  fallbackNote,
  extra = {},
}) {
  updateNode(outputId, {
    imageUrl: fallbackImageUrl || "",
    isGenerating: false,
    generationError: error?.message || String(error) || "生成失败",
    note: fallbackNote || "生成失败，已使用本地回退结果",
    sourcePrompt: sourcePrompt || "",
    ...extra,
  });
}

export function createImportedResultNode({
  createOutputNear,
  sourceNodeId,
  title,
  imageUrl,
  imagePath,
  originalImageUrl,
  imageThumbnailUrl,
  imageThumbnailPath,
  note,
  sourcePrompt,
  extra = {},
}) {
  return createOutputNear(sourceNodeId, "result", title, {
    imageUrl,
    imagePath: imagePath || "",
    originalImageUrl: originalImageUrl || "",
    imageThumbnailUrl: imageThumbnailUrl || "",
    imageThumbnailPath: imageThumbnailPath || "",
    note: note || "已导入结果",
    sourcePrompt: sourcePrompt || "",
    ...extra,
  });
}

export function openPromptPreviewCard({
  openPromptPreview,
  title,
  kind,
  original,
  negative,
  params,
}) {
  openPromptPreview({
    title,
    kind,
    original,
    negative,
    params,
  });
}

export function createGeminiBatchResultNodes({
  createOutputNear,
  sourceNodeId,
  jobPrompts,
  prompt,
  shortTitle,
}) {
  return jobPrompts.map((jobPrompt, index) => createGeneratingResultNode({
    createOutputNear,
    sourceNodeId,
    title: `${shortTitle(jobPrompt || prompt || "Gemini结果")}-${index + 1}`,
    note: `Gemini 批量任务 ${index + 1}/${jobPrompts.length} 生成中...`,
    extra: {
      sourcePrompt: jobPrompt,
      __offsetY: index * 290,
    },
  }));
}

export function applyGeminiProgressUpdate({
  item,
  requestId,
  outputIds,
  completedIndexes,
  failedIndexes,
  jobPrompts,
  nodeId,
  updateNode,
}) {
  if ((item?.requestId || "") !== requestId) return null;
  const index = Number.isFinite(Number(item?.index)) ? Number(item.index) : -1;
  const outputId = outputIds[index];
  if (!outputId || completedIndexes.has(index)) return null;
  completedIndexes.add(index);
  if (!item?.imageUrl) {
    failedIndexes.add(index);
    updateNode(outputId, {
      isGenerating: false,
      generationError: item?.error || `Gemini 任务 ${index + 1} 未返回图片`,
      note: "Gemini 网页自动化未返回图片",
      sourcePrompt: item?.sourcePrompt || jobPrompts[index],
    });
    return {
      kind: "failed",
      index,
      completed: completedIndexes.size,
      total: jobPrompts.length,
    };
  }
  updateNode(nodeId, {
    imageUrl: item.imageUrl,
    imagePath: item.imagePath || "",
    originalImageUrl: item.originalImageUrl || "",
    imageThumbnailUrl: item.imageThumbnailUrl || "",
    imageThumbnailPath: item.imageThumbnailPath || "",
    displayName: "Gemini网页生图",
  }, { skipHistory: true });
  updateNode(outputId, {
    imageUrl: item.imageUrl,
    imagePath: item.imagePath || "",
    originalImageUrl: item.originalImageUrl || "",
    imageThumbnailUrl: item.imageThumbnailUrl || "",
    imageThumbnailPath: item.imageThumbnailPath || "",
    isGenerating: false,
    note: item.note || `Gemini 网页批量生成 #${index + 1}`,
    sourcePrompt: item.sourcePrompt || jobPrompts[index],
  });
  return {
    kind: "success",
    index,
    completed: completedIndexes.size,
    total: jobPrompts.length,
  };
}

export function finalizeGeminiBatchResults({
  result,
  outputIds,
  completedIndexes,
  failedIndexes,
  jobPrompts,
  nodeId,
  updateNode,
}) {
  const images = Array.isArray(result?.images) && result.images.length
    ? result.images
    : [{ imageUrl: result?.imageUrl, note: result?.note }];
  const firstImage = images.find((item) => item?.imageUrl);
  if (firstImage) updateNode(nodeId, {
    imageUrl: firstImage.imageUrl,
    imagePath: firstImage.imagePath || "",
    originalImageUrl: firstImage.originalImageUrl || "",
    imageThumbnailUrl: firstImage.imageThumbnailUrl || "",
    imageThumbnailPath: firstImage.imageThumbnailPath || "",
    displayName: "Gemini网页生图",
  }, { skipHistory: true });
  const imagesByIndex = new Map(images.map((item, fallbackIndex) => [Number.isFinite(Number(item?.index)) ? Number(item.index) : fallbackIndex, item]));
  outputIds.forEach((outputId, index) => {
    if (completedIndexes.has(index)) return;
    const item = imagesByIndex.get(index);
    if (!item?.imageUrl) {
      failedIndexes.add(index);
      updateNode(outputId, {
        isGenerating: false,
        generationError: `Gemini 任务 ${index + 1} 未返回图片`,
        note: "Gemini 网页自动化未返回图片",
        sourcePrompt: jobPrompts[index],
      });
      return;
    }
    updateNode(outputId, {
      imageUrl: item.imageUrl,
      imagePath: item.imagePath || "",
      originalImageUrl: item.originalImageUrl || "",
      imageThumbnailUrl: item.imageThumbnailUrl || "",
      imageThumbnailPath: item.imageThumbnailPath || "",
      isGenerating: false,
      note: item.note || `Gemini 网页批量生成 #${index + 1}`,
      sourcePrompt: item.sourcePrompt || jobPrompts[index],
    });
  });
  updateNode(nodeId, { geminiFailedIndexes: [...failedIndexes] }, { skipHistory: true });
  return {
    images,
    failedIndexes: [...failedIndexes],
  };
}

export function failGeminiBatchResults({
  error,
  outputIds,
  jobPrompts,
  nodeId,
  updateNode,
}) {
  outputIds.forEach((outputId, index) => updateNode(outputId, {
    isGenerating: false,
    generationError: String(error),
    note: "Gemini 网页自动化失败",
    sourcePrompt: jobPrompts[index],
  }));
  updateNode(nodeId, { geminiFailedIndexes: jobPrompts.map((_, index) => index) }, { skipHistory: true });
}

export function buildShotTimelinePayload({ shots, nodeId, normalizeShotRecord }) {
  return shots.map((shot, index) => {
    const normalized = normalizeShotRecord(shot, index);
    const mediaUrl = normalized.videoResultUrl || normalized.imageResultUrl || "";
    const mediaPath = normalized.videoPath
      || normalized.imagePath
      || (isLocalFilePath(normalized.lastQueueResult) ? normalized.lastQueueResult : "")
      || "";
    const mediaTypeProbe = mediaPath || mediaUrl;
    const bindingSummary = [
      normalized.mainCharacterToken ? `主角色：${normalized.mainCharacterToken}` : "",
      normalized.mainSceneToken ? `主场景：${normalized.mainSceneToken}` : "",
      normalized.keyPropTokens?.length ? `关键道具：${normalized.keyPropTokens.join("、")}` : "",
    ].filter(Boolean).join(" · ");
    return {
      shotId: normalized.id,
      sourceNodeId: nodeId,
      title: normalized.id,
      scene: normalized.scene || "",
      duration: normalized.duration || "4秒",
      transition: "直切",
      mediaUrl,
      mediaPath,
      mediaType: /\.(mp4|webm|mov)$/i.test(mediaTypeProbe || "") ? "video" : "image",
      approvalStatus: buildTimelineApprovalFromShot(normalized),
      approvalNote: normalized.reworkReason || "",
      note: [bindingSummary, normalized.referenceResources || ""].filter(Boolean).join("\n"),
      mainCharacterToken: normalized.mainCharacterToken || "",
      mainSceneToken: normalized.mainSceneToken || "",
      keyPropTokens: normalized.keyPropTokens || [],
      assetRefs: normalized.assetRefs || [],
    };
  });
}

function isLocalFilePath(value = "") {
  return /^[a-zA-Z]:[\\/]/.test(String(value || "")) || String(value || "").startsWith("\\\\") || String(value || "").startsWith("/");
}

export function enqueueShotGenerationJobs({
  targetShots,
  nodeId,
  kind,
  buildImageShotPrompt,
  buildVideoShotPrompt,
  assetIndex,
  resourceIndex,
  addGenerationJobs,
  defaultImageProviderMode = "inherit",
}) {
  const jobs = targetShots.map((shot, index) => {
    const basePrompt = kind === "video"
      ? buildVideoShotPrompt(shot, assetIndex, resourceIndex)
      : buildImageShotPrompt(shot, assetIndex, resourceIndex);
    return {
      sourceNodeId: nodeId,
      shotId: shot.id,
      title: `${shot.id || `镜头${index + 1}`}-${kind === "video" ? "视频" : "图片"}`,
      kind,
      prompt: buildShotContinuityPrompt(shot, assetIndex, { basePrompt, kind }),
      mainCharacterToken: shot.mainCharacterToken || "",
      mainSceneToken: shot.mainSceneToken || "",
      keyPropTokens: Array.isArray(shot.keyPropTokens) ? shot.keyPropTokens.filter(Boolean) : [],
      assetRefs: Array.isArray(shot.assetRefs) ? shot.assetRefs.filter(Boolean) : [],
      referenceResources: String(shot.referenceResources || ""),
      videoPrompt: String(shot.videoPrompt || ""),
      imageProviderMode: resolveShotImageProviderMode(shot, defaultImageProviderMode),
      imageRuntimeModel: String(shot.imageRuntimeModel || ""),
      offsetX: kind === "video" ? 1480 : 1180,
      offsetY: index * 290,
    };
  }).filter((job) => job.prompt.trim());
  addGenerationJobs(jobs);
  return jobs;
}

function resolveShotImageProviderMode(shot = {}, defaultImageProviderMode = "inherit") {
  const shotMode = normalizeShotImageProviderMode(shot.imageProviderMode || shot.imageCallMode || shot.imageProvider);
  if (shotMode !== "inherit") return shotMode;
  return normalizeShotImageProviderMode(defaultImageProviderMode);
}

function normalizeShotImageProviderMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  if (mode === "api" || mode === "custom" || mode === "http") return "custom";
  if (mode === "comfy" || mode === "comfyui") return "comfy";
  return "inherit";
}
