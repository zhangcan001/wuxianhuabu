export function buildProjectIndexPayload(project, mediaCacheReport = {}, options = {}) {
  return {
    schemaVersion: 1,
    indexedAt: options.indexedAt || new Date().toISOString(),
    projectPath: options.projectPath || "",
    activeEpisodeId: project?.activeEpisodeId || "",
    nodes: buildNodeIndexItems(project?.nodes || []),
    shots: buildShotIndexItems(project?.nodes || [], project?.activeEpisodeId || ""),
    timelineClips: buildTimelineClipIndexItems(project?.timeline || {}),
    resources: buildResourceIndexItems(project?.resources || []),
    tasks: buildTaskIndexItems(project?.generationQueue || []),
    mediaFiles: buildMediaIndexItems(mediaCacheReport),
    deletionAudit: Array.isArray(options.deletionAudit) ? options.deletionAudit : [],
  };
}

export function buildNodeIndexItems(nodes) {
  return (Array.isArray(nodes) ? nodes : []).map((node) => ({
    id: stringValue(node.id),
    type: stringValue(node.type),
    title: stringValue(node.data?.displayName || node.type),
    episodeId: stringValue(node.data?.episodeId),
    x: numberValue(node.x),
    y: numberValue(node.y),
    text: summarizeNodeText(node),
  })).filter((item) => item.id);
}

export function buildShotIndexItems(nodes, fallbackEpisodeId = "") {
  return (Array.isArray(nodes) ? nodes : [])
    .filter((node) => node?.type === "shotList")
    .flatMap((node) => (Array.isArray(node.data?.shots) ? node.data.shots : []).map((shot, index) => ({
      id: stringValue(shot.id || `shot-${index + 1}`),
      sourceNodeId: stringValue(node.id),
      episodeId: stringValue(node.data?.episodeId || fallbackEpisodeId),
      scene: stringValue(shot.scene),
      title: stringValue(shot.title || shot.scene || shot.id),
      status: stringValue(shot.status),
      action: stringValue(shot.action),
      imagePrompt: stringValue(shot.imagePrompt),
      videoPrompt: stringValue(shot.videoPrompt),
    })));
}

export function buildTimelineClipIndexItems(timeline) {
  const byEpisode = timeline?.byEpisode && typeof timeline.byEpisode === "object" ? timeline.byEpisode : {};
  const nested = Object.entries(byEpisode).flatMap(([episodeId, episodeTimeline]) => (
    (Array.isArray(episodeTimeline?.clips) ? episodeTimeline.clips : []).map((clip, index) => serializeTimelineClip(clip, episodeId, index))
  ));
  const root = (Array.isArray(timeline?.clips) ? timeline.clips : []).map((clip, index) => serializeTimelineClip(clip, "", index));
  return [...nested, ...root].filter((item) => item.id);
}

export function buildResourceIndexItems(resources) {
  return (Array.isArray(resources) ? resources : []).map((resource) => ({
    id: stringValue(resource.id),
    name: stringValue(resource.name),
    kind: stringValue(resource.kind || resource.type),
    token: stringValue(resource.token),
    episodeId: stringValue(resource.episodeId),
    filePath: stringValue(resource.filePath || resource.imagePath || resource.videoPath),
    thumbnailPath: stringValue(resource.thumbnailPath || resource.imageThumbnailPath),
    updatedAt: numberValue(resource.updatedAt),
  })).filter((item) => item.id);
}

export function buildTaskIndexItems(queue) {
  return (Array.isArray(queue) ? queue : []).map((job) => ({
    id: stringValue(job.id),
    kind: stringValue(job.kind || job.type),
    status: stringValue(job.status),
    episodeId: stringValue(job.episodeId),
    nodeId: stringValue(job.nodeId || job.sourceNodeId || job.targetNodeId),
    updatedAt: numberValue(job.updatedAt || job.completedAt || job.createdAt),
  })).filter((item) => item.id);
}

export function buildMediaIndexItems(mediaCacheReport = {}) {
  const referenced = (mediaCacheReport.referencedFiles || []).map((file) => serializeMediaFile(file, true));
  const orphan = (mediaCacheReport.orphanFiles || []).map((file) => serializeMediaFile(file, false));
  return [...referenced, ...orphan].filter((item) => item.path);
}

function serializeTimelineClip(clip, episodeId, index) {
  return {
    id: stringValue(clip.id || `clip-${index + 1}`),
    episodeId: stringValue(episodeId),
    sourceNodeId: stringValue(clip.sourceNodeId),
    shotId: stringValue(clip.shotId),
    title: stringValue(clip.title || clip.shotId),
    scene: stringValue(clip.scene),
    duration: stringValue(clip.duration),
    approvalStatus: stringValue(clip.approvalStatus),
    mediaUrl: stringValue(clip.mediaUrl),
    subtitle: stringValue(clip.note || clip.scene),
  };
}

function summarizeNodeText(node) {
  if (node?.type === "text") return stringValue(node.data?.text).slice(0, 500);
  if (node?.type === "imageEdit") return stringValue(node.data?.prompt).slice(0, 500);
  if (node?.type === "shotList") return `${Array.isArray(node.data?.shots) ? node.data.shots.length : 0} shots`;
  return stringValue(node.data?.note || node.data?.description || node.data?.prompt).slice(0, 500);
}

function serializeMediaFile(file, referenced) {
  return {
    path: stringValue(file.path),
    fileName: stringValue(file.fileName || file.file_name),
    size: numberValue(file.size),
    isThumbnail: Boolean(file.isThumbnail ?? file.is_thumbnail),
    referenced,
    reviewDecision: stringValue(file.reviewDecision || "pending"),
    references: (Array.isArray(file.references) ? file.references : []).map((reference) => ({
      path: stringValue(reference.path),
      value: stringValue(reference.value),
    })),
  };
}

function stringValue(value) {
  return typeof value === "string" ? value : "";
}

function numberValue(value) {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? next : 0;
}
