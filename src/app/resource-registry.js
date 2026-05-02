export function buildProjectResourceRegistry(project = {}) {
  const resources = [];
  for (const episode of Array.isArray(project.episodes) ? project.episodes : []) {
    for (const resource of Array.isArray(episode.resources) ? episode.resources : []) {
      resources.push(normalizeProjectResourceRecord(resource, { projectId: project.id, episodeId: episode.id }));
    }
    for (const asset of Array.isArray(episode.assets) ? episode.assets : []) {
      collectAssetResources(resources, project, episode, asset);
    }
    for (const shot of Array.isArray(episode.shots) ? episode.shots : []) {
      collectShotResources(resources, project, episode, shot);
    }
  }
  return {
    resources: dedupeResources(resources),
    summary: summarizeResources(resources),
  };
}

export function normalizeProjectResourceRecord(resource = {}, defaults = {}) {
  const kind = resource.kind || inferResourceKind(resource);
  const url = resource.url || resource.imageUrl || resource.videoUrl || resource.thumbnailUrl || "";
  const path = resource.path || resource.imagePath || resource.videoPath || resource.thumbnailPath || "";
  const target = resource.target || {};
  const id = resource.id || [
    defaults.projectId || resource.projectId || "",
    defaults.episodeId || resource.episodeId || "",
    target.type || resource.targetType || "",
    target.id || resource.targetId || "",
    kind,
    url || path,
  ].filter(Boolean).join(":");
  return {
    ...resource,
    id,
    kind,
    projectId: resource.projectId || defaults.projectId || "",
    episodeId: resource.episodeId || defaults.episodeId || "",
    target: {
      type: target.type || resource.targetType || "",
      id: target.id || resource.targetId || "",
    },
    url,
    path,
    thumbnailUrl: resource.thumbnailUrl || resource.imageThumbnailUrl || resource.videoThumbnailUrl || "",
    thumbnailPath: resource.thumbnailPath || resource.imageThumbnailPath || resource.videoThumbnailPath || "",
    source: resource.source || resource.providerId || resource.sourceMode || "",
  };
}

export function appendMediaResource(resources = [], media = {}, defaults = {}) {
  return dedupeResources([
    ...(Array.isArray(resources) ? resources : []),
    normalizeProjectResourceRecord(media, defaults),
  ]);
}

function collectAssetResources(resources, project, episode, asset) {
  const target = { type: "asset", id: asset.id || asset.token || asset.name || "" };
  const candidates = [
    ...(Array.isArray(asset.imageItems) ? asset.imageItems : []),
    asset.imageUrl || asset.imagePath || asset.image ? {
      imageUrl: asset.imageUrl || asset.image || "",
      imagePath: asset.imagePath || asset.image || "",
      thumbnailUrl: asset.imageThumbnailUrl || "",
      thumbnailPath: asset.imageThumbnailPath || "",
      primary: true,
    } : null,
  ].filter(Boolean);
  candidates.forEach((item) => resources.push(normalizeProjectResourceRecord({
    ...item,
    kind: "image",
    target,
  }, { projectId: project.id, episodeId: episode.id })));
}

function collectShotResources(resources, project, episode, shot) {
  const target = { type: "shot", id: shot.id || "" };
  const candidates = [
    ...(Array.isArray(shot.imageItems) ? shot.imageItems.map((item) => ({ ...item, kind: "image" })) : []),
    ...(Array.isArray(shot.videoItems) ? shot.videoItems.map((item) => ({ ...item, kind: "video" })) : []),
    shot.imageUrl || shot.imageResultUrl || shot.imagePath ? {
      kind: "image",
      imageUrl: shot.imageUrl || shot.imageResultUrl || "",
      imagePath: shot.imagePath || shot.imageResult || "",
      thumbnailUrl: shot.imageThumbnailUrl || "",
      thumbnailPath: shot.imageThumbnailPath || "",
      primary: true,
    } : null,
    shot.videoUrl || shot.videoResultUrl || shot.videoPath ? {
      kind: "video",
      videoUrl: shot.videoUrl || shot.videoResultUrl || "",
      videoPath: shot.videoPath || shot.videoResult || "",
      primary: true,
    } : null,
  ].filter(Boolean);
  candidates.forEach((item) => resources.push(normalizeProjectResourceRecord({
    ...item,
    target,
  }, { projectId: project.id, episodeId: episode.id })));
}

function dedupeResources(resources = []) {
  const byKey = new Map();
  for (const resource of resources.map((item) => normalizeProjectResourceRecord(item))) {
    const key = resource.id || `${resource.episodeId}:${resource.target.type}:${resource.target.id}:${resource.kind}:${resource.url || resource.path}`;
    byKey.set(key, { ...(byKey.get(key) || {}), ...resource });
  }
  return [...byKey.values()].filter((resource) => resource.url || resource.path);
}

function summarizeResources(resources = []) {
  const normalized = dedupeResources(resources);
  return {
    total: normalized.length,
    images: normalized.filter((resource) => resource.kind === "image").length,
    videos: normalized.filter((resource) => resource.kind === "video").length,
    byTargetType: normalized.reduce((counts, resource) => {
      const key = resource.target?.type || "unknown";
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {}),
  };
}

function inferResourceKind(resource = {}) {
  if (resource.kind) return resource.kind;
  if (resource.videoUrl || resource.videoPath || /\.(mp4|mov|webm)$/i.test(resource.url || resource.path || "")) return "video";
  if (resource.imageUrl || resource.imagePath || /\.(png|jpe?g|webp|gif)$/i.test(resource.url || resource.path || "")) return "image";
  return "file";
}
