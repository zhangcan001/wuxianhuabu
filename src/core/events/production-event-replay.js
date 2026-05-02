export function replayProductionEvents(initialProject = {}, events = []) {
  return (Array.isArray(events) ? events : []).reduce((project, event) => applyEvent(project, event), initialProject);
}

function applyEvent(project = {}, event = {}) {
  const type = String(event.type || "");
  const episodeId = event.episodeId || event.payload?.episodeId || project.activeEpisodeId;
  const targetId = event.target?.id || event.targetId || event.payload?.target?.id || "";
  if (!episodeId || !targetId) return project;
  if (type.includes("image.completed")) return patchShot(project, episodeId, targetId, { imageResultUrl: event.payload?.url || event.payload?.imageUrl || "event:image" });
  if (type.includes("video.completed")) return patchShot(project, episodeId, targetId, { videoResultUrl: event.payload?.url || event.payload?.videoUrl || "event:video" });
  if (type.includes("review.completed")) return patchEpisode(project, episodeId, { reviews: [...(findEpisode(project, episodeId)?.reviews || []), event.payload || { result: "approved" }] });
  if (type.includes("delivery.planned")) return { ...project, lastDeliveryPlan: event.payload || {} };
  return project;
}

function patchShot(project, episodeId, shotId, patch) {
  return patchEpisode(project, episodeId, {
    shots: (findEpisode(project, episodeId)?.shots || []).map((shot) => shot.id === shotId ? { ...shot, ...patch } : shot),
  });
}

function patchEpisode(project, episodeId, patch) {
  const episodes = (project.episodes || []).map((episode) => episode.id === episodeId ? { ...episode, ...patch } : episode);
  return { ...project, episodes, activeEpisode: episodes.find((episode) => episode.id === (project.activeEpisodeId || episodeId)) || project.activeEpisode };
}

function findEpisode(project, episodeId) {
  return (project.episodes || []).find((episode) => episode.id === episodeId) || project.activeEpisode || {};
}
