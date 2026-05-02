import {
  queueEpisodeImageTasks,
  queueEpisodeVideoTasks,
} from "../domain/project-task-model.js";

export function buildStudioTextPlanAction({
  episodeId = "",
  textPackage = {},
  bootstrapResult = {},
} = {}) {
  if (!textPackage?.ok) {
    return {
      ok: false,
      storeAction: null,
      nodeTargetIds: {},
      result: {
        title: "文本生产失败",
        summary: textPackage?.error || "文本生产失败。",
      },
    };
  }
  const nodeTargetIds = {
    novelNodeId: bootstrapResult.novelNodeId || "",
    assetNodeId: bootstrapResult.assetNodeId || "",
    shotNodeId: bootstrapResult.shotNodeId || "",
  };
  return {
    ok: true,
    storeAction: {
      type: "applyTextPackage",
      episodeId,
      packageResult: textPackage,
      sourceNodeIds: {
        novel: nodeTargetIds.novelNodeId ? [nodeTargetIds.novelNodeId] : [],
        asset: nodeTargetIds.assetNodeId ? [nodeTargetIds.assetNodeId] : [],
        shot: nodeTargetIds.shotNodeId ? [nodeTargetIds.shotNodeId] : [],
      },
    },
    nodeTargetIds,
    result: {
      title: "文本生产完成",
      summary: textPackage.summary,
      metrics: [
        { label: "新增节点", value: bootstrapResult.created || 0 },
        ...(Array.isArray(textPackage.metrics) ? textPackage.metrics : []),
      ],
    },
  };
}

export function buildEpisodeImageQueueAction(episode = {}, options = {}) {
  const shots = Array.isArray(episode.shots) ? episode.shots : [];
  const pendingShots = shots.filter((shot) => !String(shot.imageResultUrl || shot.imageResult || "").trim());
  const jobs = queueEpisodeImageTasks(episode, options).filter((job) => !options.requireSourceNode || job.sourceNodeId);
  if (!jobs.length) {
    return {
      ok: false,
      jobs: [],
      message: pendingShots.length ? "当前镜头还没有可用图片提示词。" : "当前集没有待生成图片的镜头。",
      result: { title: "没有图片任务", summary: "当前集没有可入队的图片生成任务。" },
    };
  }
  return {
    ok: true,
    jobs,
    message: `已加入图片生成队列：${jobs.length} 个镜头`,
    result: {
      title: "图片生成已入队",
      summary: `已加入 ${jobs.length} 个图片生成任务，系统会自动回填到镜头表。`,
      metrics: [{ label: "图片任务", value: jobs.length }],
    },
  };
}

export function buildEpisodeVideoQueueAction(episode = {}, options = {}) {
  const shots = Array.isArray(episode.shots) ? episode.shots : [];
  const pendingShots = shots.filter((shot) => !String(shot.videoResultUrl || shot.videoResult || "").trim());
  const jobs = queueEpisodeVideoTasks(episode, options).filter((job) => !options.requireSourceNode || job.sourceNodeId);
  if (!jobs.length) {
    return {
      ok: false,
      jobs: [],
      message: pendingShots.length ? "当前镜头还没有可用视频提示词。" : "当前集没有待生成视频的镜头。",
      result: { title: "没有视频任务", summary: "当前集没有可入队的视频生成任务。" },
    };
  }
  return {
    ok: true,
    jobs,
    message: `已加入视频生成队列：${jobs.length} 个镜头`,
    result: {
      title: "视频生成已入队",
      summary: `已加入 ${jobs.length} 个视频生成任务，系统会自动回填到镜头表和时间线。`,
      metrics: [{ label: "视频任务", value: jobs.length }],
    },
  };
}
