export function buildMediaIntegrityRepairPlan(project = {}) {
  const episode = project.activeEpisode || project.episodes?.find((item) => item.id === project.activeEpisodeId) || project.episodes?.[0] || {};
  const resources = Array.isArray(episode.resources) ? episode.resources : [];
  const repairs = [];
  const resourceByToken = new Map(resources.map((item) => [item.token || item.id || item.name, item]).filter(([key]) => key));

  (episode.shots || []).forEach((shot) => {
    const imagePath = shot.imagePath || pathFromAssetUrl(shot.imageUrl || shot.imageResultUrl);
    const videoPath = shot.videoPath || pathFromAssetUrl(shot.videoUrl || shot.videoResultUrl);
    const resource = (shot.assetRefs || []).map((token) => resourceByToken.get(token)).find(Boolean);
    const patch = {};
    if (!shot.imagePath && imagePath) patch.imagePath = imagePath;
    if (!shot.videoPath && videoPath) patch.videoPath = videoPath;
    if (!shot.imageThumbnailUrl && (shot.imageUrl || shot.imageResultUrl)) patch.imageThumbnailUrl = shot.imageUrl || shot.imageResultUrl;
    if (!shot.imageUrl && resource?.previewUrl && resource.kind === "image") patch.imageUrl = resource.previewUrl;
    if (Object.keys(patch).length) repairs.push({ type: "shot", id: shot.id, patch });
  });

  (episode.assets || []).forEach((asset) => {
    const imagePath = asset.imagePath || pathFromAssetUrl(asset.imageUrl || asset.image?.url || asset.image);
    const patch = {};
    if (!asset.imagePath && imagePath) patch.imagePath = imagePath;
    if (!asset.thumbnailUrl && (asset.imageUrl || asset.image?.url)) patch.thumbnailUrl = asset.imageUrl || asset.image?.url;
    if (Object.keys(patch).length) repairs.push({ type: "asset", id: asset.id || asset.token, patch });
  });

  (episode.timeline?.clips || []).forEach((clip) => {
    const mediaPath = clip.mediaPath || pathFromAssetUrl(clip.mediaUrl || clip.videoUrl);
    if (!clip.mediaPath && mediaPath) repairs.push({ type: "clip", id: clip.id || clip.shotId, patch: { mediaPath } });
  });

  return { ok: repairs.length === 0, repairCount: repairs.length, repairs };
}

export function applyMediaIntegrityRepairPlan(project = {}, plan = buildMediaIntegrityRepairPlan(project)) {
  const repairKey = (type, id) => `${type}:${id || ""}`;
  const repairs = new Map((plan.repairs || []).map((item) => [repairKey(item.type, item.id), item.patch || {}]));
  const patchItems = (type, items = [], getId = (item) => item.id) => items.map((item) => ({
    ...item,
    ...(repairs.get(repairKey(type, getId(item))) || {}),
  }));
  const patchEpisode = (episode = {}) => ({
    ...episode,
    shots: patchItems("shot", episode.shots || []),
    assets: patchItems("asset", episode.assets || [], (item) => item.id || item.token),
    timeline: {
      ...(episode.timeline || {}),
      clips: patchItems("clip", episode.timeline?.clips || [], (item) => item.id || item.shotId),
    },
  });
  return {
    ...project,
    episodes: (project.episodes || []).map((episode) => episode.id === (project.activeEpisodeId || project.activeEpisode?.id) ? patchEpisode(episode) : episode),
    activeEpisode: patchEpisode(project.activeEpisode || project.episodes?.[0] || {}),
  };
}

function pathFromAssetUrl(value = "") {
  const text = String(value || "").trim();
  if (!text.startsWith("asset://")) return "";
  try {
    return decodeURIComponent(text.replace(/^asset:\/\//, ""));
  } catch {
    return text.replace(/^asset:\/\//, "");
  }
}
