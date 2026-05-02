import {
  normalizeCommercialProject,
  updateEpisode,
} from "./project-model.js";

export function applyCanvasNodeToProject(project = {}, node = {}) {
  const normalized = normalizeCommercialProject(project);
  const episodeId = node.data?.episodeId || normalized.activeEpisodeId || "";
  if (!episodeId || !["novelPipeline", "assetLibrary", "shotList"].includes(node.type)) return normalized;
  return updateEpisode(normalized, episodeId, (episode) => applyCanvasNodeToEpisode(episode, node));
}

export function applyCanvasNodeToEpisode(episode = {}, node = {}) {
  if (node.type === "novelPipeline") {
    return {
      ...episode,
      sourceText: node.data?.novel || episode.sourceText || "",
      script: node.data?.pipeline?.script || node.data?.script || episode.script || "",
      sourceNodeIds: mergeSourceNodeId(episode.sourceNodeIds, "novel", node.id),
    };
  }
  if (node.type === "assetLibrary") {
    const assets = [
      ...legacyAssetsToBusiness(node.data?.characters, "character", node.id),
      ...legacyAssetsToBusiness(node.data?.scenes, "scene", node.id),
      ...legacyAssetsToBusiness(node.data?.props, "prop", node.id),
    ];
    return {
      ...episode,
      assets,
      sourceNodeIds: mergeSourceNodeId(episode.sourceNodeIds, "asset", node.id),
    };
  }
  if (node.type === "shotList") {
    return {
      ...episode,
      shots: legacyShotsToBusiness(node.data?.shots, node.id),
      sourceNodeIds: mergeSourceNodeId(episode.sourceNodeIds, "shot", node.id),
    };
  }
  return episode;
}

function mergeSourceNodeId(sourceNodeIds = {}, key = "", nodeId = "") {
  const current = Array.isArray(sourceNodeIds[key]) ? sourceNodeIds[key] : [];
  return {
    ...sourceNodeIds,
    [key]: nodeId && !current.includes(nodeId) ? [nodeId, ...current] : current,
  };
}

function legacyAssetsToBusiness(items = [], type = "character", sourceNodeId = "") {
  return (Array.isArray(items) ? items : []).map((asset, index) => ({
    id: asset.id || asset.token || `${sourceNodeId}-${type}-${index + 1}`,
    type,
    name: asset.name || asset.token || `${type}-${index + 1}`,
    token: asset.token || "",
    prompt: asset.prompt || "",
    visualLock: asset.visualLock || asset.visualAnchor || "",
    image: asset.imagePath || asset.imageUrl || "",
    imageUrl: asset.imageUrl || "",
    imagePath: asset.imagePath || "",
    originalImageUrl: asset.originalImageUrl || "",
    imageThumbnailUrl: asset.imageThumbnailUrl || asset.thumbnailUrl || "",
    imageThumbnailPath: asset.imageThumbnailPath || asset.thumbnailPath || "",
    mediaRefs: Array.isArray(asset.mediaRefs) ? asset.mediaRefs : [],
    imageItems: normalizeLegacyAssetImageItems(asset),
    rejectedImageItems: Array.isArray(asset.rejectedImageItems) ? asset.rejectedImageItems : [],
    discardedImageKeys: Array.isArray(asset.discardedImageKeys) ? asset.discardedImageKeys : [],
    images: normalizeLegacyAssetImages(asset),
    sourceNodeId,
  }));
}

function legacyShotsToBusiness(items = [], sourceNodeId = "") {
  return (Array.isArray(items) ? items : []).map((shot, index) => ({
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
    imageUrl: shot.imageUrl || shot.imageResultUrl || shot.imageResult || "",
    imagePath: shot.imagePath || "",
    imageThumbnailUrl: shot.imageThumbnailUrl || shot.thumbnailUrl || "",
    imageThumbnailPath: shot.imageThumbnailPath || shot.thumbnailPath || "",
    videoUrl: shot.videoUrl || shot.videoResultUrl || shot.videoResult || "",
    videoPath: shot.videoPath || "",
    videoThumbnailUrl: shot.videoThumbnailUrl || shot.videoPosterUrl || shot.videoCoverUrl || "",
    videoThumbnailPath: shot.videoThumbnailPath || "",
    mediaRefs: Array.isArray(shot.mediaRefs) ? shot.mediaRefs : [],
    imageItems: normalizeLegacyShotMediaItems(shot, "image"),
    videoItems: normalizeLegacyShotMediaItems(shot, "video"),
    lastQueueResult: shot.lastQueueResult || "",
    imageProviderMode: shot.imageProviderMode || shot.imageCallMode || shot.imageProvider || "",
    videoProviderMode: shot.videoProviderMode || shot.videoCallMode || shot.videoProvider || "",
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
    reviewComment: shot.reviewComment || shot.reviewNote || "",
    reviewReason: shot.reviewReason || "",
    reviewer: shot.reviewer || "",
    reviewedAt: shot.reviewedAt || "",
    resultDecision: shot.resultDecision || "",
    resultDecisionAt: Number(shot.resultDecisionAt) || 0,
    reworkReason: shot.reworkReason || "",
    status: shot.status || "待写",
    sourceNodeId,
  }));
}

function normalizeLegacyAssetImages(asset = {}) {
  return Array.from(new Set([
    ...(Array.isArray(asset.images) ? asset.images : []),
    ...(Array.isArray(asset.imageItems) ? asset.imageItems.map((item) => item?.imageUrl || item?.url || item?.imagePath || item?.path || "") : []),
    asset.imageUrl || asset.imagePath || asset.image || "",
  ].filter(Boolean)));
}

function normalizeLegacyAssetImageItems(asset = {}) {
  const primaryUrl = asset.imageUrl || asset.image || asset.imagePath || "";
  const fallback = primaryUrl ? [{
    imageUrl: asset.imageUrl || primaryUrl,
    imagePath: asset.imagePath || "",
    originalImageUrl: asset.originalImageUrl || "",
    thumbnailUrl: asset.imageThumbnailUrl || asset.thumbnailUrl || asset.imageUrl || "",
    thumbnailPath: asset.imageThumbnailPath || asset.thumbnailPath || "",
    primary: true,
  }] : [];
  return [...(Array.isArray(asset.imageItems) ? asset.imageItems : []), ...fallback]
    .map((item, index) => normalizeLegacyAssetImageItem(item, index, primaryUrl))
    .filter((item) => item.imageUrl || item.imagePath)
    .reduce(uniqueByCandidateKey(["imageUrl", "imagePath", "id"]), []);
}

function normalizeLegacyAssetImageItem(item = {}, index = 0, primaryUrl = "") {
  const imageUrl = item.imageUrl || item.url || item.image || "";
  const imagePath = item.imagePath || item.path || "";
  return {
    id: item.id || `${imageUrl || imagePath || "asset-image"}-${index}`,
    imageUrl,
    imagePath,
    originalImageUrl: item.originalImageUrl || "",
    thumbnailUrl: item.thumbnailUrl || item.imageThumbnailUrl || imageUrl,
    thumbnailPath: item.thumbnailPath || item.imageThumbnailPath || "",
    primary: Boolean(item.primary || (primaryUrl && (imageUrl === primaryUrl || imagePath === primaryUrl))),
    discarded: Boolean(item.discarded),
    locked: Boolean(item.locked),
    createdAt: item.createdAt || item.savedAt || Date.now(),
  };
}

function normalizeLegacyShotMediaItems(shot = {}, kind = "image") {
  const source = Array.isArray(kind === "video" ? shot.videoItems : shot.imageItems) ? (kind === "video" ? shot.videoItems : shot.imageItems) : [];
  const primaryUrl = kind === "video"
    ? shot.videoUrl || shot.videoResultUrl || shot.videoResult || shot.videoPath || ""
    : shot.imageUrl || shot.imageResultUrl || shot.imageResult || shot.imagePath || "";
  const fallback = primaryUrl ? [{
    url: primaryUrl,
    path: kind === "video" ? shot.videoPath || "" : shot.imagePath || "",
    imageUrl: kind === "image" ? shot.imageUrl || shot.imageResultUrl || primaryUrl : "",
    imagePath: kind === "image" ? shot.imagePath || "" : "",
    videoUrl: kind === "video" ? shot.videoUrl || shot.videoResultUrl || primaryUrl : "",
    videoPath: kind === "video" ? shot.videoPath || "" : "",
    thumbnailUrl: kind === "image" ? shot.imageThumbnailUrl || shot.thumbnailUrl || "" : shot.videoThumbnailUrl || "",
    thumbnailPath: kind === "image" ? shot.imageThumbnailPath || shot.thumbnailPath || "" : shot.videoThumbnailPath || "",
    primary: true,
  }] : [];
  return [...source, ...fallback]
    .map((item, index) => normalizeLegacyShotMediaItem(item, index, kind, primaryUrl))
    .filter((item) => item.url || item.path || item.imageUrl || item.videoUrl)
    .reduce(uniqueByCandidateKey(["url", "path", "imageUrl", "imagePath", "videoUrl", "videoPath", "id"]), []);
}

function normalizeLegacyShotMediaItem(item = {}, index = 0, kind = "image", primaryUrl = "") {
  const url = item.url || item.imageUrl || item.videoUrl || "";
  const path = item.path || item.imagePath || item.videoPath || "";
  return {
    id: item.id || `shot-${kind}-${url || path || "media"}-${index}`,
    url,
    path,
    imageUrl: item.imageUrl || (kind === "image" ? url : ""),
    imagePath: item.imagePath || (kind === "image" ? path : ""),
    videoUrl: item.videoUrl || (kind === "video" ? url : ""),
    videoPath: item.videoPath || (kind === "video" ? path : ""),
    thumbnailUrl: item.thumbnailUrl || item.imageThumbnailUrl || item.videoThumbnailUrl || (kind === "image" ? url : ""),
    thumbnailPath: item.thumbnailPath || item.imageThumbnailPath || item.videoThumbnailPath || "",
    primary: Boolean(item.primary || (primaryUrl && (url === primaryUrl || path === primaryUrl))),
    discarded: Boolean(item.discarded),
    locked: Boolean(item.locked),
    createdAt: item.createdAt || item.savedAt || Date.now(),
  };
}

function uniqueByCandidateKey(keys = []) {
  return (items, item) => {
    const key = keys.map((candidateKey) => item[candidateKey]).find(Boolean) || "";
    if (!key) return items;
    const index = items.findIndex((candidate) => keys.some((candidateKey) => (
      candidate[candidateKey] && item[candidateKey] && String(candidate[candidateKey]) === String(item[candidateKey])
    )));
    if (index >= 0) {
      items[index] = {
        ...items[index],
        ...item,
        primary: items[index].primary || item.primary,
        discarded: items[index].discarded || item.discarded,
      };
      return items;
    }
    return [...items, item];
  };
}
