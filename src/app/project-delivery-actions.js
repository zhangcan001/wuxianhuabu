import {
  buildDeliveryPackagePendingHistory,
  buildDeliveryPackageQueueJob,
} from "./delivery-package-service.js";
import {
  buildBatchDeliveryPackagePlans,
} from "./studio-delivery-scheduler.js";
import {
  buildEpisodeRenderRequest,
  buildRenderDetailLabel,
  buildRenderHistoryOptions,
  buildRenderVariantLabel,
  buildTimelineRenderReadinessReport,
} from "../project-timeline-helpers.js";

export function buildTimelineRenderBlockMessage(episodeTimeline, options = {}) {
  const report = buildTimelineRenderReadinessReport(episodeTimeline, {
    ...options,
    parseDurationSeconds: options.parseDurationSeconds,
  });
  if (report.canRender) return "";
  return `导出前检查未通过：${report.issues.join("；")}`;
}

export function buildQueuedEpisodeRender(input = {}) {
  const {
    episode = {},
    episodeTimeline = {},
    resourceIndex = {},
    options = {},
    activeEpisodeId = "",
    parseDurationSeconds,
    createRenderRequestId,
  } = input;
  const blockMessage = buildTimelineRenderBlockMessage(episodeTimeline, {
    ...options,
    parseDurationSeconds,
  });
  if (blockMessage) return { ok: false, reason: "blocked", message: blockMessage };

  const requestId = options.requestId || createRenderRequestId(`render-${episode?.id || activeEpisodeId}`);
  const request = buildEpisodeRenderRequest(episode, episodeTimeline, resourceIndex, {
    ...options,
    requestId,
    parseDurationSeconds,
    createRenderRequestId,
  });
  if (!request.clips.length) {
    return { ok: false, reason: "empty", message: "当前时间线没有可用素材，暂时不能加入导出队列。" };
  }

  const aspectLabel = options.aspectRatio === "9:16" ? "竖版" : "横版";
  const deliveryLabel = "成片";
  const episodeName = episode?.name || "当前集";
  const title = `${episodeName} ${aspectLabel}${deliveryLabel}`;
  return {
    ok: true,
    request,
    requestId,
    job: {
      kind: "exportVideo",
      title,
      prompt: `${episodeName} · ${aspectLabel} · 视频导出`,
      priority: "高",
      episodeId: episode?.id || activeEpisodeId,
      requestId,
      exportRequest: request,
      renderLabel: `${aspectLabel}${deliveryLabel}`,
      progress: 0,
    },
    history: {
      requestId,
      type: "mp4",
      status: "queued",
      title,
      detail: buildRenderDetailLabel(options, "已加入导出队列"),
      episodeId: episode?.id || activeEpisodeId,
      episodeName,
      renderOptions: buildRenderHistoryOptions(options, request),
    },
    message: `已加入队列：${title}`,
  };
}

export function queueEpisodeRenderAction(input = {}) {
  const {
    addGenerationJobs = () => {},
    appendExportHistory = () => {},
    setProjectMessage = () => {},
  } = input;
  const queued = buildQueuedEpisodeRender(input);
  if (!queued.ok) {
    setProjectMessage(queued.message);
    return { queued: 0, skipped: 1, message: queued.message, reason: queued.reason };
  }
  addGenerationJobs([queued.job]);
  appendExportHistory(queued.history);
  setProjectMessage(queued.message);
  return { queued: 1, skipped: 0, job: queued.job, history: queued.history, message: queued.message };
}

export function queueProjectRenderBatchAction(input = {}) {
  const {
    episodes = [],
    timeline = {},
    defaultEpisodeTimeline,
    resourceIndex = {},
    options = {},
    getEpisodeTimeline,
    addGenerationJobs = () => {},
    appendExportHistory = () => {},
    setProjectMessage = () => {},
  } = input;
  const jobs = [];
  const histories = [];
  let skipped = 0;
  episodes.forEach((episode) => {
    const episodeTimeline = getEpisodeTimeline(timeline, episode.id, { defaultEpisodeTimeline });
    const queued = buildQueuedEpisodeRender({
      ...input,
      episode,
      episodeTimeline,
      resourceIndex,
      options,
    });
    if (!queued.ok) {
      skipped += 1;
      return;
    }
    jobs.push({
      ...queued.job,
      title: queued.job.title,
      prompt: queued.job.prompt,
    });
    histories.push({
      ...queued.history,
      detail: buildRenderDetailLabel(options, "批量连续导出已排队"),
    });
  });
  if (!jobs.length) {
    const message = "当前项目没有可批量导出的时间线素材。";
    setProjectMessage(message);
    return { queued: 0, skipped, jobs, histories, message };
  }
  addGenerationJobs(jobs);
  histories.forEach(appendExportHistory);
  const message = `已批量加入队列：${jobs.length} 集${skipped ? `，跳过 ${skipped} 集空时间线` : ""}`;
  setProjectMessage(message);
  return { queued: jobs.length, skipped, jobs, histories, message };
}

export function buildQueuedDeliveryPackageJobs(input = {}) {
  const {
    packagePlans = [],
    activeEpisodeId = "",
  } = input;
  const histories = [];
  const jobs = packagePlans.map((plan) => {
    histories.push(buildDeliveryPackagePendingHistory({
      packageEntry: plan.packageEntry,
      requestId: plan.requestId,
    }));
    return buildDeliveryPackageQueueJob({
      episode: plan.episode,
      activeEpisodeId,
      requestId: plan.requestId,
      packageContent: plan.packageContent,
      packageFileName: plan.packageFileName,
    });
  });
  return { jobs, histories };
}

export function queueDeliveryPackageJobsAction(input = {}) {
  const {
    packagePlans = [],
    addGenerationJobs = () => {},
    appendExportHistory = () => {},
    setShowQueue = () => {},
    scheduleRunQueue = () => {},
  } = input;
  const { jobs, histories } = buildQueuedDeliveryPackageJobs(input);
  histories.forEach(appendExportHistory);
  if (jobs.length) {
    addGenerationJobs(jobs);
    setShowQueue(true);
    scheduleRunQueue();
  }
  return { queued: jobs.length, jobs, histories };
}

export function queueMultiEpisodeDeliveryAction(input = {}) {
  const {
    commercialProject = {},
    options = {},
    resourceIndex = {},
    buildStudioDeliveryOutputSpec,
    queueProjectRenderBatch = () => ({ queued: 0 }),
    buildPackageEntry,
    buildPackageContent,
    safeFileName,
  } = input;
  const platformSpec = buildStudioDeliveryOutputSpec(options);
  const renderResult = queueProjectRenderBatch(resourceIndex, {
    platform: platformSpec.platform,
    aspectRatio: platformSpec.aspectRatio,
    resolution: platformSpec.resolution,
    fps: platformSpec.fps,
  });
  let packageResult = { queued: 0, jobs: [], histories: [] };
  if (["package", "both"].includes(options.format || "mp4")) {
    const packagePlans = buildBatchDeliveryPackagePlans({
      project: commercialProject,
      outputSpec: platformSpec,
      buildPackageEntry,
      buildPackageContent,
      safeFileName,
    });
    packageResult = queueDeliveryPackageJobsAction({
      ...input,
      packagePlans,
    });
  }
  return {
    platformSpec,
    renderResult,
    packageResult,
    queued: (renderResult.queued || 0) + (packageResult.queued || 0),
  };
}

export function planProductionDeliveryAction(input = {}) {
  const {
    options = {},
    commercialProject = {},
    activeEpisodeId = "",
    productionEvents = [],
    productionAppService,
    projectCommandService,
    resourceIndex = {},
    buildStudioDeliveryOutputSpec,
    buildStudioPackageHistoryEntry,
    buildStudioDeliveryPackageContent,
    queueEpisodeRender,
    queueDeliveryPackageJobs = queueDeliveryPackageJobsAction,
    safeFileName = (value) => String(value || ""),
    setProductionEvents = () => {},
    setProjectMessage = () => {},
    openProductionStudioView = () => {},
    addGenerationJobs = () => {},
    appendExportHistory = () => {},
    setShowQueue = () => {},
    scheduleRunQueue = () => {},
    createPackageRequestId = () => `package-${Date.now()}`,
  } = input;
  const platformSpec = buildStudioDeliveryOutputSpec(options);
  const result = productionAppService.planDelivery({
    commercialProject,
    events: productionEvents,
    deliveryOptions: {
      outputSpec: platformSpec,
    },
  });
  setProductionEvents(result.events || productionEvents);
  projectCommandService.recordDeliveryPlanned({
    episodeId: commercialProject?.activeEpisode?.id || activeEpisodeId,
    packageId: result.delivery?.package?.id || "",
    detail: result.delivery?.ok ? "ready" : "blocked",
  });
  const blockers = result.delivery?.readiness?.blockers || [];
  if (result.delivery?.ok && (options.format || "mp4") !== "package") {
    const episode = commercialProject?.activeEpisode;
    queueEpisodeRender(episode, episode?.timeline || { clips: [] }, resourceIndex, {
      platform: platformSpec.platform,
      aspectRatio: platformSpec.aspectRatio,
      resolution: platformSpec.resolution,
      fps: platformSpec.fps,
    });
  }
  if (result.delivery?.ok && ["package", "both"].includes(options.format || "mp4")) {
    const episode = commercialProject?.activeEpisode || { id: activeEpisodeId, title: "episode" };
    const packageEntry = buildStudioPackageHistoryEntry({
      episode,
      deliveryPackage: result.delivery?.package || {},
    });
    const packageContent = buildStudioDeliveryPackageContent({
      businessProject: commercialProject,
      episode,
      deliveryPackage: result.delivery?.package || {},
      outputSpec: platformSpec,
    });
    queueDeliveryPackageJobs({
      packagePlans: [{
        episode,
        requestId: createPackageRequestId(),
        packageEntry,
        packageContent,
        packageFileName: safeFileName(`${episode.title || episode.name || "episode"}-delivery-package`),
      }],
      activeEpisodeId,
      addGenerationJobs,
      appendExportHistory,
      setShowQueue,
      scheduleRunQueue,
    });
  }
  openProductionStudioView(result.delivery?.ok ? "delivery" : "review", result.delivery?.ok
    ? "Production OS 交付规划完成，已打开生产工作台交付。"
    : `Production OS 交付规划完成：还有 ${blockers.length} 个交付阻塞。`);
  setProjectMessage(result.delivery?.ok
    ? "Production OS 交付规划完成：已加入真实导出队列。"
    : `Production OS 交付规划完成：还有 ${blockers.length} 个交付阻塞，已打开生产工作台。`);
  return {
    title: result.delivery?.ok ? "交付可导出" : "交付未就绪",
    summary: result.delivery?.ok ? "已生成交付导出任务规划。" : `仍有 ${blockers.length} 个阻塞项需要处理。`,
    metrics: [{ label: "阻塞", value: blockers.length }],
  };
}

export function buildDirectRenderHistoryEntry(input = {}) {
  const {
    requestId = "",
    episode = {},
    activeEpisodeId = "",
    options = {},
    request = {},
    status = "running",
    detailPrefix = "直接导出",
    path = "",
    error = "",
  } = input;
  const detail = buildRenderDetailLabel(options, detailPrefix);
  return {
    requestId,
    type: "mp4",
    status,
    title: `${episode?.name || "当前集"} ${buildRenderVariantLabel(options)}`,
    detail: error ? `${detail} · ${String(error)}` : detail,
    path,
    episodeId: episode?.id || activeEpisodeId,
    episodeName: episode?.name || "当前集",
    renderOptions: buildRenderHistoryOptions(options, request),
  };
}
