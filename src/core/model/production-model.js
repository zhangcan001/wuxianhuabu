export const PRODUCTION_VERSION = "production-os.v1";

export function createProductionProject(input = {}) {
  const episodes = normalizeEpisodes(input.episodes);
  const activeEpisodeId = input.activeEpisodeId || episodes[0]?.id || "episode-1";
  const activeEpisode = episodes.find((episode) => episode.id === activeEpisodeId) || episodes[0] || createEpisode({ id: activeEpisodeId });
  return {
    schemaVersion: input.schemaVersion || PRODUCTION_VERSION,
    id: input.id || input.projectId || "local-project",
    name: input.name || input.projectName || "Untitled Production",
    workspaceId: input.workspaceId || "local-workspace",
    productionBible: createProductionBible(input.productionBible || input.bible || {}),
    activeEpisodeId: activeEpisode.id,
    episodes,
    activeEpisode,
    totals: summarizeProductionTotals(episodes),
  };
}

export function createProductionBible(input = {}) {
  return {
    storyWorld: input.storyWorld || "",
    characterContinuity: input.characterContinuity || "",
    visualStyle: input.visualStyle || "",
    cameraLanguage: input.cameraLanguage || "",
    namingRules: input.namingRules || "",
    outputSpec: {
      aspectRatio: input.outputSpec?.aspectRatio || "9:16",
      resolution: input.outputSpec?.resolution || "1080x1920",
      fps: input.outputSpec?.fps || 24,
      platform: input.outputSpec?.platform || "short-video",
    },
    qualityRules: Array.isArray(input.qualityRules) ? input.qualityRules : defaultQualityRules(),
  };
}

export function createEpisode(input = {}) {
  const sequences = normalizeSequences(input.sequences);
  const shots = normalizeShots(input.shots);
  const assets = normalizeAssets(input.assets);
  const tasks = normalizeTasks(input.tasks);
  const reviews = normalizeReviews(input.reviews);
  const deliveries = normalizeDeliveries(input.deliveries);
  return {
    id: input.id || "episode-1",
    title: input.title || input.name || "Episode 1",
    sourceText: input.sourceText || "",
    script: input.script || "",
    sequences,
    shots,
    assets,
    tasks,
    reviews,
    deliveries,
    timeline: {
      clips: Array.isArray(input.timeline?.clips) ? input.timeline.clips : [],
    },
    status: summarizeEpisodeDeliveryState({ script: input.script || "", shots, assets, tasks, reviews, deliveries }),
  };
}

export function summarizeEpisodeDeliveryState(input = {}) {
  const shots = Array.isArray(input.shots) ? input.shots : [];
  const assets = Array.isArray(input.assets) ? input.assets : [];
  const tasks = Array.isArray(input.tasks) ? input.tasks : [];
  const reviews = Array.isArray(input.reviews) ? input.reviews : [];
  const deliveries = Array.isArray(input.deliveries) ? input.deliveries : [];
  const doneTasks = tasks.filter((task) => task.status === "done").length;
  return {
    textReady: Boolean(String(input.script || "").trim()) && shots.length > 0,
    assetsReady: assets.length > 0 && assets.every((asset) => asset.lifecycle === "approved" || asset.lifecycle === "locked"),
    imagesReady: shots.length > 0 && shots.every((shot) => Boolean(shot.image?.url || shot.imageResultUrl)),
    videosReady: shots.length > 0 && shots.every((shot) => Boolean(shot.video?.url || shot.videoResultUrl)),
    reviewReady: shots.length > 0 && reviews.some((review) => review.result === "approved"),
    deliveryReady: deliveries.some((delivery) => delivery.status === "done"),
    taskProgress: tasks.length ? doneTasks / tasks.length : 0,
  };
}

function normalizeEpisodes(episodes) {
  const source = Array.isArray(episodes) && episodes.length ? episodes : [createEpisode()];
  return source.map(createEpisode);
}

function normalizeSequences(sequences) {
  return (Array.isArray(sequences) ? sequences : []).map((sequence, index) => ({
    id: sequence.id || `seq-${index + 1}`,
    title: sequence.title || `Sequence ${index + 1}`,
    order: sequence.order || index + 1,
    shotIds: Array.isArray(sequence.shotIds) ? sequence.shotIds.filter(Boolean) : [],
  }));
}

function normalizeShots(shots) {
  return (Array.isArray(shots) ? shots : []).map((shot, index) => ({
    id: shot.id || `S${String(index + 1).padStart(2, "0")}`,
    title: shot.title || shot.scene || `Shot ${index + 1}`,
    order: shot.order || index + 1,
    scene: shot.scene || "",
    action: shot.action || "",
    cameraMove: shot.cameraMove || shot.camera || "",
    duration: shot.duration || "",
    prompt: {
      image: String(shot.prompt?.image || shot.imagePrompt || "").trim(),
      video: String(shot.prompt?.video || shot.videoPrompt || "").trim(),
    },
    assetRefs: Array.isArray(shot.assetRefs) ? shot.assetRefs.filter(Boolean) : [],
    image: normalizeMediaResult(shot.image || { url: shot.imageResultUrl || shot.imageResult || "" }),
    video: normalizeMediaResult(shot.video || { url: shot.videoResultUrl || shot.videoResult || "" }),
    reviewStatus: shot.reviewStatus || "pending",
  }));
}

function normalizeAssets(assets) {
  return (Array.isArray(assets) ? assets : []).map((asset, index) => ({
    id: asset.id || asset.token || `asset-${index + 1}`,
    type: asset.type || "character",
    name: asset.name || asset.token || `Asset ${index + 1}`,
    token: asset.token || "",
    canonicalPrompt: asset.canonicalPrompt || asset.prompt || "",
    visualFingerprint: asset.visualFingerprint || asset.visualLock || "",
    lifecycle: asset.lifecycle || asset.status || "draft",
    references: Array.isArray(asset.references) ? asset.references : [],
    variants: Array.isArray(asset.variants) ? asset.variants : [],
    reviewStatus: asset.reviewStatus || "pending",
  }));
}

function normalizeTasks(tasks) {
  return (Array.isArray(tasks) ? tasks : []).map((task, index) => ({
    id: task.id || `task-${index + 1}`,
    type: task.type || task.kind || "task",
    target: task.target || {
      type: task.targetType || "unknown",
      id: task.targetId || task.shotId || task.sourceAssetToken || "",
    },
    status: task.status || "pending",
    priority: task.priority || "normal",
    dependencies: Array.isArray(task.dependencies) ? task.dependencies.filter(Boolean) : [],
    attempts: Number(task.attempts || 0),
    provider: task.provider || task.providerMode || "",
    input: task.input || { prompt: task.prompt || "" },
    output: task.output || {},
    cost: Number(task.cost || 0),
    logs: Array.isArray(task.logs) ? task.logs : [],
  }));
}

function normalizeReviews(reviews) {
  return (Array.isArray(reviews) ? reviews : []).map((review, index) => ({
    id: review.id || `review-${index + 1}`,
    target: review.target || { type: review.targetType || "episode", id: review.targetId || "" },
    checklist: Array.isArray(review.checklist) ? review.checklist : [],
    result: review.result || "pending",
    issues: Array.isArray(review.issues) ? review.issues : [],
    revisionPlan: review.revisionPlan || "",
    approvedBy: review.approvedBy || "",
    approvedAt: review.approvedAt || "",
  }));
}

function normalizeDeliveries(deliveries) {
  return (Array.isArray(deliveries) ? deliveries : []).map((delivery, index) => ({
    id: delivery.id || `delivery-${index + 1}`,
    platform: delivery.platform || "short-video",
    outputSpec: delivery.outputSpec || {},
    files: Array.isArray(delivery.files) ? delivery.files : [],
    manifest: delivery.manifest || {},
    checksum: delivery.checksum || "",
    status: delivery.status || "pending",
  }));
}

function normalizeMediaResult(media = {}) {
  return {
    url: media.url || media.path || "",
    provider: media.provider || "",
    promptId: media.promptId || "",
    generatedAt: media.generatedAt || "",
  };
}

function summarizeProductionTotals(episodes) {
  return {
    episodes: episodes.length,
    sequences: episodes.reduce((sum, episode) => sum + episode.sequences.length, 0),
    shots: episodes.reduce((sum, episode) => sum + episode.shots.length, 0),
    assets: episodes.reduce((sum, episode) => sum + episode.assets.length, 0),
    tasks: episodes.reduce((sum, episode) => sum + episode.tasks.length, 0),
    deliveries: episodes.reduce((sum, episode) => sum + episode.deliveries.length, 0),
  };
}

function defaultQualityRules() {
  return [
    "character-continuity",
    "visual-consistency",
    "shot-executability",
    "no-watermark",
    "delivery-format",
  ];
}
