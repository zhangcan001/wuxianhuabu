export const NOVEL_TO_VIDEO_WORKFLOW_ID = "novel-to-short-video.v1";

export function createNovelToVideoWorkflow(input = {}) {
  return {
    id: input.id || NOVEL_TO_VIDEO_WORKFLOW_ID,
    name: input.name || "Novel to Short Video Delivery",
    stages: [
      stage("intake", "Novel Intake"),
      stage("bible", "Production Bible"),
      stage("textPlan", "Script Plan"),
      stage("assetRegistry", "Asset Registry"),
      stage("shotBreakdown", "Shot Breakdown"),
      stage("assetGeneration", "Asset Generation"),
      stage("shotImages", "Shot Image Generation"),
      stage("shotVideos", "Shot Video Generation"),
      stage("timeline", "Timeline Assembly"),
      stage("review", "Review Gate"),
      stage("delivery", "Delivery Export"),
      stage("archive", "Audit Archive"),
    ],
    gates: {
      intake: ["sourceText"],
      bible: ["productionBible"],
      textPlan: ["script"],
      assetRegistry: ["assets"],
      shotBreakdown: ["shots"],
      assetGeneration: ["approvedAssets"],
      shotImages: ["shotImages"],
      shotVideos: ["shotVideos"],
      timeline: ["timeline"],
      review: ["approvedReview"],
      delivery: ["delivery"],
      archive: ["eventLog"],
    },
  };
}

export function evaluateWorkflow(project = {}, workflow = createNovelToVideoWorkflow(), options = {}) {
  const episode = options.episode || project.activeEpisode || project.episodes?.find((item) => item.id === project.activeEpisodeId) || project.episodes?.[0] || {};
  const context = buildGateContext(project, episode, options);
  const stages = workflow.stages.map((item) => {
    const required = workflow.gates[item.key] || [];
    const missing = required.filter((gate) => !context[gate]);
    return {
      ...item,
      status: missing.length ? "blocked" : "ready",
      missing,
    };
  });
  const firstBlocked = stages.find((item) => item.status === "blocked") || null;
  const completed = stages.filter((item) => item.status === "ready").length;
  return {
    workflowId: workflow.id,
    episodeId: episode.id || "",
    stages,
    currentStage: firstBlocked?.key || stages.at(-1)?.key || "",
    blockers: firstBlocked?.missing || [],
    progress: stages.length ? completed / stages.length : 0,
    readyForDelivery: !firstBlocked,
  };
}

function stage(key, label) {
  return { key, label };
}

function buildGateContext(project = {}, episode = {}, options = {}) {
  const bible = project.productionBible || {};
  const shots = Array.isArray(episode.shots) ? episode.shots : [];
  const assets = Array.isArray(episode.assets) ? episode.assets : [];
  const timelineClips = Array.isArray(episode.timeline?.clips) ? episode.timeline.clips : [];
  const reviews = Array.isArray(episode.reviews) ? episode.reviews : [];
  const deliveries = Array.isArray(episode.deliveries) ? episode.deliveries : [];
  return {
    sourceText: Boolean(String(episode.sourceText || "").trim()),
    productionBible: Boolean(String(bible.visualStyle || bible.storyWorld || "").trim()) || Boolean(options.allowDefaultBible),
    script: Boolean(String(episode.script || "").trim()),
    assets: assets.length > 0,
    shots: shots.length > 0,
    approvedAssets: assets.length > 0 && assets.every((asset) => ["locked", "approved"].includes(asset.lifecycle)),
    shotImages: shots.length > 0 && shots.every((shot) => Boolean(shot.image?.url || shot.imageResultUrl)),
    shotVideos: shots.length > 0 && shots.every((shot) => Boolean(shot.video?.url || shot.videoResultUrl)),
    timeline: timelineClips.length >= shots.length && shots.length > 0,
    approvedReview: reviews.some((review) => review.result === "approved"),
    delivery: deliveries.some((delivery) => delivery.status === "done"),
    eventLog: Array.isArray(options.events) && options.events.length > 0,
  };
}
