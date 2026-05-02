import { normalizeExportHistoryState } from "../project-storage-helpers.js";
import { normalizeTimelineState } from "../project-timeline-helpers.js";

export function buildCommercialProjectModel(input = {}) {
  const {
    projectId = "local-project",
    projectName = "未命名项目",
    episodes = [],
    activeEpisodeId = "",
    nodes = [],
    generationQueue = [],
    resources = [],
    timeline = {},
    exportHistory = [],
  } = input;
  const fallbackEpisodeId = episodes[0]?.id || activeEpisodeId || "episode-1";
  const timelineState = normalizeTimelineState(timeline, fallbackEpisodeId);
  const normalizedExportHistory = normalizeExportHistoryState(exportHistory);
  const episodeModels = (Array.isArray(episodes) && episodes.length ? episodes : [{ id: fallbackEpisodeId, name: "第1集" }])
    .map((episode) => buildCommercialEpisodeModel({
      episode,
      nodes,
      generationQueue,
      resources,
      timelineState,
      exportHistory: normalizedExportHistory,
      fallbackEpisodeId,
    }));
  const activeEpisode = episodeModels.find((episode) => episode.id === activeEpisodeId) || episodeModels[0] || null;
  return {
    id: projectId,
    name: projectName,
    activeEpisodeId: activeEpisode?.id || "",
    episodes: episodeModels,
    activeEpisode,
    totals: {
      episodes: episodeModels.length,
      shots: episodeModels.reduce((sum, episode) => sum + episode.shots.length, 0),
      assets: episodeModels.reduce((sum, episode) => sum + episode.assets.length, 0),
      tasks: generationQueue.length,
    },
  };
}

export function buildCommercialEpisodeModel({
  episode = {},
  nodes = [],
  generationQueue = [],
  resources = [],
  timelineState = {},
  exportHistory = [],
  fallbackEpisodeId = "",
} = {}) {
  const episodeId = episode.id || fallbackEpisodeId || "episode-1";
  const episodeNodes = (Array.isArray(nodes) ? nodes : []).filter((node) => (node.data?.episodeId || fallbackEpisodeId) === episodeId);
  const novelNodes = episodeNodes.filter((node) => node.type === "novelPipeline");
  const assetNodes = episodeNodes.filter((node) => node.type === "assetLibrary");
  const shotNodes = episodeNodes.filter((node) => node.type === "shotList");
  const assets = assetNodes.flatMap((node) => extractCommercialAssetsFromNode(node));
  const shots = shotNodes.flatMap((node) => extractCommercialShotsFromNode(node));
  const episodeTimeline = timelineState?.byEpisode?.[episodeId] || { clips: [] };
  const timelineClips = Array.isArray(episodeTimeline.clips) ? episodeTimeline.clips : [];
  const failedExports = (Array.isArray(exportHistory) ? exportHistory : [])
    .filter((item) => item.status === "failed" && (!item.episodeId || item.episodeId === episodeId))
    .length;
  const tasks = (Array.isArray(generationQueue) ? generationQueue : [])
    .filter((task) => isTaskForEpisode(task, episodeId, shotNodes))
    .map(normalizeCommercialTask);
  const episodeResources = (Array.isArray(resources) ? resources : []).filter((resource) => !resource.episodeId || resource.episodeId === episodeId);
  const script = novelNodes.map((node) => node.data?.pipeline?.script || node.data?.script || "").find(Boolean) || "";
  const sourceText = novelNodes.map((node) => node.data?.novel || "").find(Boolean) || "";
  return {
    id: episodeId,
    title: episode.name || episode.title || "当前集",
    sourceText,
    script,
    assets,
    assetCounts: summarizeCommercialAssetCounts(assets),
    shots,
    tasks,
    timeline: {
      clips: timelineClips.map((clip) => ({
        id: clip.id,
        shotId: clip.shotId,
        sourceNodeId: clip.sourceNodeId || "",
        title: clip.title || clip.shotId || "",
        mediaUrl: clip.mediaUrl || "",
        mediaType: clip.mediaType || "",
        approvalStatus: clip.approvalStatus || "待验收",
      })),
    },
    resources: episodeResources.map((resource) => ({
      id: resource.id,
      name: resource.name,
      token: resource.token,
      kind: resource.kind,
      episodeId: resource.episodeId || "",
    })),
    status: summarizeEpisodeProductionStatus({ script, assets, shots, tasks, timelineClips, failedExports }),
    sourceNodeIds: {
      novel: novelNodes.map((node) => node.id),
      asset: assetNodes.map((node) => node.id),
      shot: shotNodes.map((node) => node.id),
    },
  };
}

export function summarizeEpisodeProductionStatus({ script = "", assets = [], shots = [], tasks = [], timelineClips = [], failedExports = 0 } = {}) {
  const shotCount = shots.length;
  const promptReady = shots.filter((shot) => shot.imagePrompt && shot.videoPrompt).length;
  const imagesReady = shots.filter((shot) => shot.imageResult || ["待生视频", "已生成", "已确认", "完成"].includes(shot.status || "")).length;
  const videosReady = shots.filter((shot) => shot.videoResult || ["已生成", "已确认", "完成"].includes(shot.status || "")).length;
  const reviewPassed = shots.filter((shot) => ["已通过", "搁置"].includes(shot.reviewStatus || "未审")).length;
  const timelineReady = timelineClips.filter((clip) => String(clip.mediaUrl || "").trim()).length;
  const failedTasks = tasks.filter((task) => task.status === "failed").length;
  const runningTasks = tasks.filter((task) => task.status === "running" || task.status === "pending").length;
  const scriptReady = Boolean(String(script || "").trim());
  const assetReady = assets.some((asset) => asset.type === "character") && assets.some((asset) => asset.type === "scene");
  const shotReady = shotCount > 0 && promptReady >= shotCount;
  const exportReady = timelineClips.length > 0
    && timelineReady >= timelineClips.length
    && reviewPassed >= shotCount
    && shotReady
    && shotCount > 0
    && failedExports === 0;
  return {
    scriptReady,
    assetReady,
    textReady: scriptReady && assetReady && shotReady,
    shotReady,
    imageReady: shotCount > 0 && imagesReady >= shotCount,
    videoReady: shotCount > 0 && videosReady >= shotCount,
    exportReady,
    shotCount,
    promptReady,
    imagesReady,
    videosReady,
    timelineClips: timelineClips.length,
    timelineReady,
    reviewPassed,
    failedTasks,
    runningTasks,
    failedExports,
  };
}

export function applyTextPackageToEpisode(episode = {}, packageResult = {}) {
  if (!packageResult?.ok) return normalizeCommercialEpisodeDraft(episode);
  const assetSourceNodeId = episode.sourceNodeIds?.asset?.[0] || "";
  const shotSourceNodeId = episode.sourceNodeIds?.shot?.[0] || "";
  const assets = [
    ...normalizeAssetsFromPatch(packageResult.assetPatch?.characters, "character", assetSourceNodeId),
    ...normalizeAssetsFromPatch(packageResult.assetPatch?.scenes, "scene", assetSourceNodeId),
    ...normalizeAssetsFromPatch(packageResult.assetPatch?.props, "prop", assetSourceNodeId),
  ];
  const shots = (Array.isArray(packageResult.shotPatch?.shots) ? packageResult.shotPatch.shots : [])
    .map((shot, index) => normalizeCommercialShotDraft(shot, index, shotSourceNodeId));
  return normalizeCommercialEpisodeDraft({
    ...episode,
    sourceText: packageResult.novelText || episode.sourceText || "",
    script: packageResult.pipeline?.script || episode.script || "",
    assets,
    assetCounts: summarizeCommercialAssetCounts(assets),
    shots,
  });
}

export function applyImageResultToShot(episode = {}, shotId = "", result = {}) {
  return applyResultToEpisodeShot(episode, shotId, result, "image");
}

export function applyVideoResultToShot(episode = {}, shotId = "", result = {}) {
  return applyResultToEpisodeShot(episode, shotId, result, "video");
}

function applyResultToEpisodeShot(episode = {}, shotId = "", result = {}, kind = "image") {
  const targetId = String(shotId || result.shotId || result.targetShotId || "").trim();
  if (!targetId) return normalizeCommercialEpisodeDraft(episode);
  const resultUrl = pickCommercialResultUrl(result, kind);
  if (!resultUrl) return normalizeCommercialEpisodeDraft(episode);
  const shots = (Array.isArray(episode.shots) ? episode.shots : []).map((shot, index) => {
    const normalized = normalizeCommercialShotDraft(shot, index, shot.sourceNodeId || "");
    if (normalized.id !== targetId) return normalized;
    if (kind === "video") {
      const videoItem = normalizeShotMediaItem({
        videoUrl: result.videoUrl || resultUrl,
        videoPath: result.videoPath || "",
        url: result.videoUrl || resultUrl,
        path: result.videoPath || "",
      }, normalized.videoItems?.length || 0);
      return {
        ...normalized,
        videoResult: resultUrl,
        videoResultUrl: resultUrl,
        videoUrl: result.videoUrl || resultUrl,
        videoPath: result.videoPath || "",
        videoItems: appendShotMediaItem(normalized.videoItems, videoItem),
        lastQueueResult: resultUrl,
        status: "已生成",
      };
    }
    const imageItem = normalizeShotMediaItem({
      imageUrl: result.imageUrl || resultUrl,
      imagePath: result.imagePath || "",
      thumbnailUrl: result.imageThumbnailUrl || result.thumbnailUrl || "",
      thumbnailPath: result.imageThumbnailPath || result.thumbnailPath || "",
      url: result.imageUrl || resultUrl,
      path: result.imagePath || "",
    }, normalized.imageItems?.length || 0);
    return {
      ...normalized,
      imageResult: resultUrl,
      imageResultUrl: resultUrl,
      imageUrl: result.imageUrl || resultUrl,
      imagePath: result.imagePath || "",
      imageThumbnailUrl: result.imageThumbnailUrl || result.thumbnailUrl || "",
      imageThumbnailPath: result.imageThumbnailPath || result.thumbnailPath || "",
      imageItems: appendShotMediaItem(normalized.imageItems, imageItem),
      lastQueueResult: resultUrl,
      status: normalized.videoPrompt ? "待生视频" : "已生成",
    };
  });
  return normalizeCommercialEpisodeDraft({ ...episode, shots });
}

function normalizeShotMediaItem(item = {}, index = 0) {
  const url = item.imageUrl || item.videoUrl || item.url || item.path || "";
  const path = item.imagePath || item.videoPath || item.path || "";
  return {
    id: item.id || `shot-media-${Date.now()}-${index + 1}`,
    url,
    path,
    imageUrl: item.imageUrl || "",
    imagePath: item.imagePath || "",
    videoUrl: item.videoUrl || "",
    videoPath: item.videoPath || "",
    thumbnailUrl: item.thumbnailUrl || "",
    thumbnailPath: item.thumbnailPath || "",
    primary: index === 0,
    discarded: Boolean(item.discarded),
    createdAt: item.createdAt || new Date().toISOString(),
  };
}

function appendShotMediaItem(items = [], item = {}) {
  const source = item.url || item.path || item.imageUrl || item.videoUrl || "";
  const current = Array.isArray(items) ? items : [];
  if (!source) return current;
  const exists = current.some((candidate) => [candidate.url, candidate.path, candidate.imageUrl, candidate.videoUrl].includes(source));
  const next = exists ? current : [...current.map((candidate) => ({ ...candidate, primary: false })), { ...item, primary: true }];
  return next.slice(-12);
}

function normalizeCommercialEpisodeDraft(episode = {}) {
  const assets = Array.isArray(episode.assets) ? episode.assets : [];
  const shots = Array.isArray(episode.shots) ? episode.shots : [];
  const tasks = Array.isArray(episode.tasks) ? episode.tasks : [];
  const timelineClips = Array.isArray(episode.timeline?.clips) ? episode.timeline.clips : [];
  const failedExports = Number(episode.status?.failedExports || 0);
  return {
    ...episode,
    assets,
    assetCounts: summarizeCommercialAssetCounts(assets),
    shots,
    tasks,
    timeline: {
      ...(episode.timeline || {}),
      clips: timelineClips,
    },
    status: summarizeEpisodeProductionStatus({
      script: episode.script || "",
      assets,
      shots,
      tasks,
      timelineClips,
      failedExports,
    }),
  };
}

function summarizeCommercialAssetCounts(assets = []) {
  return {
    characters: assets.filter((asset) => asset.type === "character").length,
    scenes: assets.filter((asset) => asset.type === "scene").length,
    props: assets.filter((asset) => asset.type === "prop").length,
  };
}

function normalizeAssetsFromPatch(items = [], type = "character", sourceNodeId = "") {
  return (Array.isArray(items) ? items : []).map((asset, index) => ({
    id: asset.id || asset.token || `${type}-${index + 1}`,
    type,
    name: asset.name || asset.token || `${type}-${index + 1}`,
    token: asset.token || "",
    prompt: asset.prompt || asset.nanoBananaPrompt || asset.openSourcePrompt || asset.midjourneyPrompt || "",
    visualLock: asset.visualLock || asset.visualAnchor || "",
    image: asset.imagePath || asset.imageUrl || "",
    sourceNodeId,
  }));
}

function normalizeCommercialShotDraft(shot = {}, index = 0, sourceNodeId = "") {
  return {
    id: shot.id || `S${String(index + 1).padStart(2, "0")}`,
    title: shot.title || shot.scene || shot.id || `镜头${index + 1}`,
    order: shot.order || index + 1,
    scene: shot.scene || "",
    action: shot.action || "",
    cameraMove: shot.cameraMove || shot.camera || "",
    duration: shot.duration || "",
    imagePrompt: String(shot.imagePrompt || "").trim(),
    videoPrompt: String(shot.videoPrompt || "").trim(),
    imageResult: shot.imageResult || shot.imageResultUrl || shot.imagePath || shot.imageUrl || "",
    videoResult: shot.videoResult || shot.videoResultUrl || shot.videoPath || shot.videoUrl || "",
    imageResultUrl: shot.imageResultUrl || shot.imageResult || shot.imagePath || shot.imageUrl || "",
    videoResultUrl: shot.videoResultUrl || shot.videoResult || shot.videoPath || shot.videoUrl || "",
    imageUrl: shot.imageUrl || "",
    imagePath: shot.imagePath || "",
    imageThumbnailUrl: shot.imageThumbnailUrl || "",
    imageThumbnailPath: shot.imageThumbnailPath || "",
    videoUrl: shot.videoUrl || "",
    videoPath: shot.videoPath || "",
    imageItems: Array.isArray(shot.imageItems) ? shot.imageItems : [],
    videoItems: Array.isArray(shot.videoItems) ? shot.videoItems : [],
    imageProviderMode: shot.imageProviderMode || shot.imageCallMode || shot.imageProvider || "",
    imageRuntimeModel: shot.imageRuntimeModel || "",
    videoRuntimeModel: shot.videoRuntimeModel || "",
    videoModelPreset: shot.videoModelPreset || "",
    videoParamPreset: shot.videoParamPreset || "",
    videoAspectRatio: shot.videoAspectRatio || "",
    mainCharacterToken: shot.mainCharacterToken || "",
    mainSceneToken: shot.mainSceneToken || "",
    keyPropTokens: Array.isArray(shot.keyPropTokens) ? shot.keyPropTokens.filter(Boolean) : [],
    assetRefs: Array.isArray(shot.assetRefs) ? shot.assetRefs.filter(Boolean) : [],
    referenceResources: String(shot.referenceResources || ""),
    reviewStatus: shot.reviewStatus || "未审",
    reviewComment: shot.reviewComment || "",
    reviewReason: shot.reviewReason || "",
    reviewHistory: Array.isArray(shot.reviewHistory) ? shot.reviewHistory : [],
    reviewRepairSuggestion: shot.reviewRepairSuggestion || null,
    status: shot.status || "待写",
    sourceNodeId: shot.sourceNodeId || sourceNodeId,
  };
}

function pickCommercialResultUrl(result = {}, kind = "image") {
  if (kind === "video") return result.videoPath || result.videoUrl || result.path || result.url || "";
  return result.imagePath || result.imageUrl || result.path || result.url || "";
}

function extractCommercialAssetsFromNode(node = {}) {
  const groups = [
    ["characters", "character"],
    ["scenes", "scene"],
    ["props", "prop"],
  ];
  return groups.flatMap(([key, type]) => (
    (Array.isArray(node.data?.[key]) ? node.data[key] : []).map((asset, index) => ({
      id: asset.id || asset.token || `${node.id}-${type}-${index + 1}`,
      type,
      name: asset.name || asset.token || `${type}-${index + 1}`,
      token: asset.token || "",
      prompt: asset.prompt || "",
      visualLock: asset.visualLock || asset.visualAnchor || "",
      image: asset.imagePath || asset.imageUrl || "",
      sourceNodeId: node.id,
    }))
  ));
}

function extractCommercialShotsFromNode(node = {}) {
  return (Array.isArray(node.data?.shots) ? node.data.shots : []).map((shot, index) => ({
    id: shot.id || `S${String(index + 1).padStart(2, "0")}`,
    title: shot.title || shot.scene || shot.id || `镜头${index + 1}`,
    order: index + 1,
    scene: shot.scene || "",
    action: shot.action || "",
    cameraMove: shot.cameraMove || shot.camera || "",
    duration: shot.duration || "",
    imagePrompt: String(shot.imagePrompt || "").trim(),
    videoPrompt: String(shot.videoPrompt || "").trim(),
    imageResult: shot.imageResultUrl || shot.imagePath || shot.imageUrl || "",
    videoResult: shot.videoResultUrl || shot.videoPath || shot.videoUrl || "",
    imageResultUrl: shot.imageResultUrl || shot.imagePath || shot.imageUrl || "",
    videoResultUrl: shot.videoResultUrl || shot.videoPath || shot.videoUrl || "",
    imageProviderMode: shot.imageProviderMode || shot.imageCallMode || shot.imageProvider || "",
    imageRuntimeModel: shot.imageRuntimeModel || "",
    videoRuntimeModel: shot.videoRuntimeModel || "",
    videoModelPreset: shot.videoModelPreset || "",
    videoParamPreset: shot.videoParamPreset || "",
    videoAspectRatio: shot.videoAspectRatio || "",
    mainCharacterToken: shot.mainCharacterToken || "",
    mainSceneToken: shot.mainSceneToken || "",
    keyPropTokens: Array.isArray(shot.keyPropTokens) ? shot.keyPropTokens.filter(Boolean) : [],
    assetRefs: Array.isArray(shot.assetRefs) ? shot.assetRefs.filter(Boolean) : [],
    referenceResources: String(shot.referenceResources || ""),
    reviewStatus: shot.reviewStatus || "未审",
    status: shot.status || "待写",
    sourceNodeId: node.id,
  }));
}

function normalizeCommercialTask(task = {}) {
  return {
    id: task.id || "",
    type: task.kind || task.type || "task",
    status: task.status || "pending",
    progress: task.progress ?? null,
    targetId: task.shotId || task.sourceAssetToken || task.sourceNodeId || "",
    title: task.title || task.shotId || task.kind || "任务",
    error: task.error || "",
  };
}

function isTaskForEpisode(task = {}, episodeId = "", shotNodes = []) {
  if (task.episodeId) return task.episodeId === episodeId;
  if (!task.sourceNodeId) return true;
  return shotNodes.some((node) => node.id === task.sourceNodeId);
}
