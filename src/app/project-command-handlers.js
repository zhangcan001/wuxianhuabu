import {
  buildEpisodeImageQueueAction,
  buildEpisodeVideoQueueAction,
  buildStudioTextPlanAction,
} from "./project-actions.js";

export function prepareStudioTextCommand({
  sourceText = "",
  episodeId = "",
  bootstrapResult = {},
  createTextPackage = null,
} = {}) {
  const text = String(sourceText || "").trim();
  if (!text) {
    return {
      ok: false,
      shouldBootstrap: false,
      text: "",
      textPackage: null,
      action: null,
      message: "请先粘贴小说或剧情梗概。",
      result: {
        title: "缺少小说输入",
        summary: "请先粘贴小说、剧情梗概或已有剧本。",
      },
    };
  }
  const textPackage = typeof createTextPackage === "function" ? createTextPackage(text) : null;
  if (!textPackage?.ok) {
    return {
      ok: false,
      shouldBootstrap: true,
      text,
      textPackage,
      action: null,
      message: textPackage?.error || "文本生产失败。",
      result: {
        title: "文本生产失败",
        summary: textPackage?.error || "文本生产失败。",
      },
    };
  }
  const action = buildStudioTextPlanAction({
    episodeId,
    textPackage,
    bootstrapResult,
  });
  return {
    ok: true,
    shouldBootstrap: true,
    text,
    textPackage,
    action,
    message: "文本生产完成：已输出资产和镜头表提示词，未自动生成图片。",
    result: action.result,
  };
}

export function prepareImageQueueCommand({
  episode = null,
  businessOptions = {},
  legacyJobs = [],
  legacyEntryCount = 0,
} = {}) {
  if (hasBusinessShots(episode)) {
    return {
      source: "business",
      ...buildEpisodeImageQueueAction(episode, businessOptions),
    };
  }
  return buildLegacyQueueCommand("image", legacyJobs, legacyEntryCount);
}

export function prepareVideoQueueCommand({
  episode = null,
  businessOptions = {},
  legacyJobs = [],
  legacyEntryCount = 0,
} = {}) {
  if (hasBusinessShots(episode)) {
    return {
      source: "business",
      ...buildEpisodeVideoQueueAction(episode, businessOptions),
    };
  }
  return buildLegacyQueueCommand("video", legacyJobs, legacyEntryCount);
}

export function buildLegacyQueueCommand(kind = "image", jobs = [], entryCount = 0) {
  const normalizedJobs = Array.isArray(jobs) ? jobs : [];
  const isVideo = kind === "video";
  if (!normalizedJobs.length) {
    return {
      source: "legacy",
      ok: false,
      jobs: [],
      message: entryCount
        ? `当前镜头还没有可用${isVideo ? "视频" : "图片"}提示词。`
        : `当前集没有待生成${isVideo ? "视频" : "图片"}的镜头。`,
      result: {
        title: `没有${isVideo ? "视频" : "图片"}任务`,
        summary: `当前集没有可入队的${isVideo ? "视频" : "图片"}生成任务。`,
      },
    };
  }
  return {
    source: "legacy",
    ok: true,
    jobs: normalizedJobs,
    message: `已加入${isVideo ? "视频" : "图片"}生成队列：${normalizedJobs.length} 个镜头`,
    result: {
      title: `${isVideo ? "视频" : "图片"}生成已入队`,
      summary: isVideo
        ? `已加入 ${normalizedJobs.length} 个视频生成任务，系统会自动回填到镜头表和时间线。`
        : `已加入 ${normalizedJobs.length} 个图片生成任务，系统会自动回填到镜头表。`,
      metrics: [{ label: `${isVideo ? "视频" : "图片"}任务`, value: normalizedJobs.length }],
    },
  };
}

function hasBusinessShots(episode = null) {
  return (Array.isArray(episode?.shots) ? episode.shots : []).length > 0;
}
