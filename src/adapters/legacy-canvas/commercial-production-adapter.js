import {
  createCommercialProject,
} from "../../domain/project-model.js";
import {
  createProductionProject,
} from "../../core/model/production-model.js";

export function commercialProjectToProductionProject(commercialProject = {}, options = {}) {
  const source = createCommercialProject(commercialProject);
  return createProductionProject({
    id: source.id,
    name: source.name,
    workspaceId: options.workspaceId || "local-workspace",
    activeEpisodeId: source.activeEpisodeId,
    productionBible: inferProductionBible(source, options),
    episodes: source.episodes.map((episode) => commercialEpisodeToProductionEpisode(episode, options)),
  });
}

export function commercialEpisodeToProductionEpisode(episode = {}, options = {}) {
  const shots = Array.isArray(episode.shots) ? episode.shots : [];
  return {
    id: episode.id || "episode-1",
    title: episode.title || episode.name || "Episode",
    sourceText: episode.sourceText || "",
    script: episode.script || "",
    sequences: inferSequences(shots),
    assets: (Array.isArray(episode.assets) ? episode.assets : []).map((asset, index) => commercialAssetToProductionAsset(asset, index)),
    shots: shots.map((shot, index) => commercialShotToProductionShot(shot, index)),
    tasks: (Array.isArray(episode.tasks) ? episode.tasks : []).map((task, index) => commercialTaskToProductionTask(task, index)),
    reviews: inferReviews(episode, options),
    deliveries: inferDeliveries(episode, options),
    timeline: episode.timeline || { clips: [] },
  };
}

export function productionProjectToCommercialSeed(productionProject = {}) {
  const project = createProductionProject(productionProject);
  return {
    id: project.id,
    name: project.name,
    activeEpisodeId: project.activeEpisodeId,
    episodes: project.episodes.map((episode) => ({
      id: episode.id,
      title: episode.title,
      sourceText: episode.sourceText,
      script: episode.script,
      assets: episode.assets.map((asset) => ({
        id: asset.id,
        type: asset.type,
        name: asset.name,
        token: asset.token,
        prompt: asset.canonicalPrompt,
        visualLock: asset.visualFingerprint,
        status: asset.lifecycle,
      })),
      shots: episode.shots.map((shot) => ({
        id: shot.id,
        title: shot.title,
        scene: shot.scene,
        action: shot.action,
        cameraMove: shot.cameraMove,
        duration: shot.duration,
        imagePrompt: shot.prompt.image,
        videoPrompt: shot.prompt.video,
        imageResultUrl: shot.image.url,
        videoResultUrl: shot.video.url,
        assetRefs: shot.assetRefs,
        reviewStatus: shot.reviewStatus,
      })),
      tasks: episode.tasks.map((task) => ({
        id: task.id,
        type: task.type,
        status: task.status,
        targetType: task.target.type,
        targetId: task.target.id,
        priority: task.priority,
        prompt: task.input?.prompt || "",
        providerMode: task.provider,
      })),
      timeline: episode.timeline,
    })),
  };
}

function inferProductionBible(project = {}, options = {}) {
  const activeEpisode = project.activeEpisode || project.episodes?.[0] || {};
  const assets = activeEpisode.assets || [];
  const visualTokens = assets.map((asset) => asset.visualLock || asset.prompt || asset.name).filter(Boolean).slice(0, 8);
  return {
    storyWorld: options.storyWorld || activeEpisode.sourceText?.slice(0, 240) || "",
    characterContinuity: options.characterContinuity || assets.filter((asset) => asset.type === "character").map((asset) => asset.name || asset.token).join(" / "),
    visualStyle: options.visualStyle || visualTokens.join(" | "),
    cameraLanguage: options.cameraLanguage || inferCameraLanguage(activeEpisode.shots),
    namingRules: options.namingRules || "episode-shot-asset stable ids",
    outputSpec: options.outputSpec || {},
    qualityRules: options.qualityRules,
  };
}

function inferSequences(shots = []) {
  if (!shots.length) return [];
  const grouped = new Map();
  shots.forEach((shot, index) => {
    const key = shot.sequenceId || shot.scene || "sequence-1";
    if (!grouped.has(key)) {
      grouped.set(key, {
        id: safeId(key, grouped.size + 1),
        title: shot.scene || `Sequence ${grouped.size + 1}`,
        order: grouped.size + 1,
        shotIds: [],
      });
    }
    grouped.get(key).shotIds.push(shot.id || `S${String(index + 1).padStart(2, "0")}`);
  });
  return [...grouped.values()];
}

function commercialAssetToProductionAsset(asset = {}, index = 0) {
  const hasImage = Boolean(asset.image || asset.imageUrl || asset.imagePath);
  return {
    id: asset.id || asset.token || `asset-${index + 1}`,
    type: asset.type || "character",
    name: asset.name || asset.token || `Asset ${index + 1}`,
    token: asset.token || "",
    canonicalPrompt: asset.canonicalPrompt || asset.prompt || "",
    visualFingerprint: asset.visualFingerprint || asset.visualLock || "",
    lifecycle: asset.lifecycle || (hasImage ? "locked" : "draft"),
    references: asset.references || [],
    variants: asset.variants || [],
    reviewStatus: asset.reviewStatus || (hasImage ? "approved" : "pending"),
  };
}

function commercialShotToProductionShot(shot = {}, index = 0) {
  return {
    id: shot.id || `S${String(index + 1).padStart(2, "0")}`,
    title: shot.title || shot.scene || `Shot ${index + 1}`,
    order: shot.order || index + 1,
    scene: shot.scene || "",
    action: shot.action || "",
    cameraMove: shot.cameraMove || shot.camera || "",
    duration: shot.duration || "",
    prompt: {
      image: shot.imagePrompt || "",
      video: shot.videoPrompt || "",
    },
    assetRefs: Array.isArray(shot.assetRefs) ? shot.assetRefs.filter(Boolean) : [],
    image: { url: shot.imageUrl || shot.imageResultUrl || shot.imageResult || "" },
    video: { url: shot.videoUrl || shot.videoResultUrl || shot.videoResult || "" },
    reviewStatus: shot.reviewStatus === "已通过" ? "approved" : shot.reviewStatus || "pending",
  };
}

function commercialTaskToProductionTask(task = {}, index = 0) {
  return {
    id: task.id || `task-${index + 1}`,
    type: task.type || task.kind || "task",
    target: {
      type: task.targetType || (task.shotId ? "shot" : "unknown"),
      id: task.targetId || task.shotId || "",
    },
    status: normalizeTaskStatus(task.status),
    priority: task.priority || "normal",
    dependencies: task.dependencies || [],
    attempts: task.attempts || 0,
    provider: task.provider || task.providerMode || "",
    input: task.input || { prompt: task.prompt || "" },
    output: task.output || {},
    cost: task.cost || 0,
    logs: task.logs || [],
  };
}

function inferReviews(episode = {}, options = {}) {
  const shots = Array.isArray(episode.shots) ? episode.shots : [];
  const approved = shots.length > 0 && shots.every((shot) => shot.reviewStatus === "已通过" || shot.reviewStatus === "approved");
  if (!approved && !options.includePendingReview) return [];
  return [{
    id: `review:${episode.id || "episode"}`,
    target: { type: "episode", id: episode.id || "" },
    checklist: options.reviewChecklist || [],
    result: approved ? "approved" : "pending",
    issues: [],
    revisionPlan: "",
    approvedBy: "",
    approvedAt: "",
  }];
}

function inferDeliveries(episode = {}, options = {}) {
  const deliveries = Array.isArray(episode.deliveries) ? episode.deliveries : [];
  if (deliveries.length) return deliveries;
  if (!options.delivery) return [];
  return [options.delivery];
}

function inferCameraLanguage(shots = []) {
  return (Array.isArray(shots) ? shots : [])
    .map((shot) => shot.cameraMove || shot.camera)
    .filter(Boolean)
    .slice(0, 12)
    .join(" / ");
}

function normalizeTaskStatus(status = "") {
  if (["done", "failed", "running", "pending"].includes(status)) return status;
  if (status === "completed" || status === "已完成") return "done";
  if (status === "失败") return "failed";
  if (status === "运行中") return "running";
  return "pending";
}

function safeId(value = "", fallback = 1) {
  const text = String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return text || `sequence-${fallback}`;
}
