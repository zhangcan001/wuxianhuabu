import {
  buildImageSourcePolicy,
} from "../providers/image-source-policy.js";
import {
  buildVideoSourcePolicy,
} from "../providers/video-source-policy.js";
import {
  buildShotContinuityPrompt,
} from "../../domain/shot-continuity-prompt.js";

export function buildProductionTaskGraph(episode = {}, options = {}) {
  const tasks = [
    ...buildAssetTasks(episode, options),
    ...buildShotImageTasks(episode, options),
    ...buildShotVideoTasks(episode, options),
    ...buildTimelineTasks(episode, options),
    ...buildReviewTasks(episode, options),
    ...buildDeliveryTasks(episode, options),
  ];
  return {
    episodeId: episode.id || "",
    tasks,
    ready: tasks.filter((task) => canRunTask(task, tasks)),
    blocked: tasks.filter((task) => !canRunTask(task, tasks)),
  };
}

export function canRunTask(task = {}, allTasks = []) {
  if (task.status === "waiting-upload") return false;
  const done = new Set((Array.isArray(allTasks) ? allTasks : []).filter((item) => item.status === "done").map((item) => item.id));
  return (Array.isArray(task.dependencies) ? task.dependencies : []).every((id) => done.has(id));
}

export function markTaskGraphResult(graph = {}, taskId = "", result = {}) {
  const tasks = (Array.isArray(graph.tasks) ? graph.tasks : []).map((task) => (
    task.id === taskId
      ? { ...task, status: result.ok === false ? "failed" : "done", output: result.output || result, error: result.error || "" }
      : task
  ));
  return {
    ...graph,
    tasks,
    ready: tasks.filter((task) => canRunTask(task, tasks)),
    blocked: tasks.filter((task) => !canRunTask(task, tasks)),
  };
}

function buildAssetTasks(episode = {}, options = {}) {
  const imagePolicy = buildImageSourcePolicy({ mode: options.imageProvider, fallbackMode: "mock" });
  return (Array.isArray(episode.assets) ? episode.assets : [])
    .filter((asset) => !["locked", "approved"].includes(asset.lifecycle))
    .map((asset, index) => ({
      id: `asset-image:${episode.id}:${asset.id || index + 1}`,
      type: "asset.image",
      target: { type: "asset", id: asset.id || "", assetType: asset.type || "character" },
      status: "pending",
      priority: options.assetPriority || "normal",
      dependencies: [],
      provider: imagePolicy.providerMode || "",
      input: { prompt: asset.canonicalPrompt || asset.prompt || "", token: asset.token || "", sourceMode: imagePolicy.mode },
      output: {},
      cost: 0,
      logs: [],
    }))
    .filter((task) => task.input.prompt);
}

function buildShotImageTasks(episode = {}, options = {}) {
  const assetDependencies = buildAssetDependencies(episode);
  const defaultImagePolicy = buildImageSourcePolicy({ mode: options.imageProvider, fallbackMode: "mock" });
  return (Array.isArray(episode.shots) ? episode.shots : [])
    .filter((shot) => !Boolean(shot.image?.url || shot.imageResultUrl))
    .map((shot, index) => {
      const imagePolicy = buildImageSourcePolicy({
        mode: shot.imageProviderMode || shot.imageCallMode || shot.imageProvider || defaultImagePolicy.mode,
        fallbackMode: defaultImagePolicy.mode,
      });
      return {
        id: `shot-image:${episode.id}:${shot.id || index + 1}`,
        type: "shot.image",
        target: { type: "shot", id: shot.id || "" },
        status: imagePolicy.requiresUpload ? "waiting-upload" : "pending",
        priority: options.shotPriority || "normal",
        dependencies: assetDependencies,
        provider: imagePolicy.providerMode || "",
        input: {
          prompt: buildShotContinuityPrompt(shot, episode.assets || [], {
            basePrompt: shot.prompt?.image || shot.imagePrompt || "",
            kind: "image",
            enabled: options.continuityPrompt !== false,
          }),
          assetRefs: shot.assetRefs || [],
          mainCharacterToken: shot.mainCharacterToken || "",
          mainSceneToken: shot.mainSceneToken || "",
          keyPropTokens: Array.isArray(shot.keyPropTokens) ? shot.keyPropTokens.filter(Boolean) : [],
          sourceMode: imagePolicy.mode,
        },
        output: {},
        cost: 0,
        logs: [],
      };
    })
    .filter((task) => task.input.prompt);
}

function buildShotVideoTasks(episode = {}, options = {}) {
  const defaultVideoPolicy = buildVideoSourcePolicy({ mode: options.videoProvider, fallbackMode: "mock" });
  return (Array.isArray(episode.shots) ? episode.shots : [])
    .filter((shot) => !Boolean(shot.video?.url || shot.videoResultUrl))
    .map((shot, index) => {
      const shotId = shot.id || `S${String(index + 1).padStart(2, "0")}`;
      const hasImage = Boolean(shot.image?.url || shot.imageResultUrl);
      const videoPolicy = buildVideoSourcePolicy({
        mode: shot.videoProviderMode || shot.videoCallMode || shot.videoProvider || defaultVideoPolicy.mode,
        fallbackMode: defaultVideoPolicy.mode,
      });
      return {
        id: `shot-video:${episode.id}:${shotId}`,
        type: "shot.video",
        target: { type: "shot", id: shotId },
        status: videoPolicy.requiresUpload ? "waiting-upload" : "pending",
        priority: options.videoPriority || "normal",
        dependencies: hasImage ? [] : [`shot-image:${episode.id}:${shotId}`],
        provider: videoPolicy.providerMode || "",
        input: {
          prompt: buildShotContinuityPrompt(shot, episode.assets || [], {
            basePrompt: shot.prompt?.video || shot.videoPrompt || "",
            kind: "video",
            enabled: options.continuityPrompt !== false,
          }),
          image: shot.image?.url || shot.imageResultUrl || "",
          assetRefs: shot.assetRefs || [],
          mainCharacterToken: shot.mainCharacterToken || "",
          mainSceneToken: shot.mainSceneToken || "",
          keyPropTokens: Array.isArray(shot.keyPropTokens) ? shot.keyPropTokens.filter(Boolean) : [],
          sourceMode: videoPolicy.mode,
        },
        output: {},
        cost: 0,
        logs: [],
      };
    })
    .filter((task) => task.input.prompt);
}

function buildTimelineTasks(episode = {}) {
  const videoTasks = (Array.isArray(episode.shots) ? episode.shots : [])
    .filter((shot) => !Boolean(shot.video?.url || shot.videoResultUrl))
    .map((shot, index) => (
      `shot-video:${episode.id}:${shot.id || `S${String(index + 1).padStart(2, "0")}`}`
    ));
  return (Array.isArray(episode.shots) && episode.shots.length) ? [{
    id: `timeline:${episode.id}`,
    type: "timeline.assemble",
    target: { type: "episode", id: episode.id || "" },
    status: "pending",
    priority: "normal",
    dependencies: videoTasks,
    provider: "local",
    input: {},
    output: {},
    cost: 0,
    logs: [],
  }] : [];
}

function buildReviewTasks(episode = {}) {
  return [{
    id: `review:${episode.id || "episode"}`,
    type: "review.quality-gate",
    target: { type: "episode", id: episode.id || "" },
    status: "pending",
    priority: "normal",
    dependencies: [`timeline:${episode.id || "episode"}`],
    provider: "local",
    input: {},
    output: {},
    cost: 0,
    logs: [],
  }];
}

function buildDeliveryTasks(episode = {}, options = {}) {
  return [{
    id: `delivery:${episode.id || "episode"}`,
    type: "delivery.export",
    target: { type: "episode", id: episode.id || "" },
    status: "pending",
    priority: "normal",
    dependencies: [`review:${episode.id || "episode"}`],
    provider: options.renderProvider || "tauri",
    input: { platform: options.platform || "short-video" },
    output: {},
    cost: 0,
    logs: [],
  }];
}

function buildAssetDependencies(episode = {}) {
  return (Array.isArray(episode.assets) ? episode.assets : [])
    .filter((asset) => !["locked", "approved"].includes(asset.lifecycle))
    .map((asset, index) => `asset-image:${episode.id}:${asset.id || index + 1}`);
}
