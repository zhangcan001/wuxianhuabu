import {
  buildExportQueueHistoryEntry,
  buildQueueResultNodePayload,
  buildQueueResultSummary,
  buildQueueShotSuccessPatch,
  buildTimelineShotPatchFromQueue,
} from "../canvas/canvas-queue-helpers.js";
import {
  createGenerationJobs,
  markNextPendingJobRunning,
  markQueueJobDone,
  markQueueJobFailed,
} from "../queue-state-helpers.js";

const EXPORT_JOB_KINDS = new Set(["exportVideo", "exportPackage"]);

export async function runProjectGenerationQueue({
  queueRunningRef,
  queueStopRef,
  generationQueue = [],
  setGenerationQueue = () => {},
  setQueueRunning = () => {},
  setShowQueue = () => {},
  setProjectMessage = () => {},
  traceAppEvent = () => {},
  compareQueueJobs = () => 0,
  autoRetryLimit = 2,
  delay = defaultDelay,
  settings = {},
  episodes = [],
  activeEpisodeId = "",
  safeFileName = defaultSafeFileName,
  isDesktopRuntime = () => true,
  appendExportHistory = () => {},
  buildRenderHistoryOptions = () => null,
  invokeRenderTimelineVideo = async () => ({}),
  saveDeliveryPackageArtifact = async () => ({}),
  runImageGeneration = async () => ({}),
  runVideoGeneration = async () => ({}),
  resolveImageJobSettings = (baseSettings) => baseSettings,
  resolveVideoJobSettings = (baseSettings) => baseSettings,
  createOutputNear = () => {},
  markAssetProgressFromQueue = () => false,
  markShotProgressFromQueue = () => {},
  buildBusinessQueueResultPatch = () => null,
  getSourceNode = () => null,
  normalizeShotRecord = (shot) => shot,
  upsertTimelineClipFromShot = () => {},
  buildCascadedVideoJobsAfterImage = () => [],
  shortTitle = (value) => String(value || ""),
} = {}) {
  if (queueRunningRef?.current) return { started: false, processed: 0 };
  if (queueRunningRef) queueRunningRef.current = true;
  if (queueStopRef) queueStopRef.current = false;
  setQueueRunning(true);
  setShowQueue(true);
  traceAppEvent("queue.run.start", {
    total: Array.isArray(generationQueue) ? generationQueue.length : 0,
  });

  let processed = 0;
  let stopped = false;
  try {
    while (true) {
      if (queueStopRef?.current) {
        stopped = true;
        setProjectMessage("批量生成已停止，未开始的任务保留在队列。");
        traceAppEvent("queue.run.stopped", { processed });
        break;
      }
      let nextJob = null;
      setGenerationQueue((current) => {
        const result = markNextPendingJobRunning(current, compareQueueJobs);
        nextJob = result.job;
        return result.queue;
      });
      await delay(30);
      if (!nextJob) break;
      processed += 1;

      traceQueueJobStart(traceAppEvent, nextJob);
      if (!isExportJob(nextJob)) {
        markShotProgressFromQueue(nextJob, { status: nextJob.kind === "video" ? "待生视频" : "待生图" });
      }

      try {
        const result = await runQueueJob(nextJob, {
          settings,
          episodes,
          activeEpisodeId,
          safeFileName,
          isDesktopRuntime,
          appendExportHistory,
          buildRenderHistoryOptions,
          invokeRenderTimelineVideo,
          saveDeliveryPackageArtifact,
          runImageGeneration,
          runVideoGeneration,
          resolveImageJobSettings,
          resolveVideoJobSettings,
          createOutputNear,
          markAssetProgressFromQueue,
          markShotProgressFromQueue,
          buildBusinessQueueResultPatch,
          getSourceNode,
          normalizeShotRecord,
          upsertTimelineClipFromShot,
          buildCascadedVideoJobsAfterImage,
          setGenerationQueue,
          shortTitle,
          setProjectMessage,
        });
        setGenerationQueue((current) => markQueueJobDone(current, nextJob.id, buildQueueResultSummary(result, shortTitle)));
        traceAppEvent("queue.job.done", {
          jobId: nextJob.id,
          kind: nextJob.kind,
        });
      } catch (error) {
        const didRetry = await handleQueueJobFailure(nextJob, error, {
          autoRetryLimit,
          canRetry: !queueStopRef?.current,
          setGenerationQueue,
          setProjectMessage,
          traceAppEvent,
          delay,
        });
        if (didRetry) continue;

        handleTerminalQueueFailure(nextJob, error, {
          episodes,
          activeEpisodeId,
          appendExportHistory,
          buildRenderHistoryOptions,
          markShotProgressFromQueue,
        });
        setGenerationQueue((current) => markQueueJobFailed(current, nextJob.id, error));
        traceAppEvent("queue.job.failed", {
          jobId: nextJob.id,
          kind: nextJob.kind,
          error: error?.message || String(error),
        });
      }
    }
  } finally {
    if (queueRunningRef) queueRunningRef.current = false;
    if (queueStopRef) queueStopRef.current = false;
    setQueueRunning(false);
    traceAppEvent("queue.run.done", { stopped });
  }
  return { started: true, processed, stopped };
}

export function isExportJob(job = {}) {
  return EXPORT_JOB_KINDS.has(job.kind);
}

async function runQueueJob(nextJob, deps) {
  if (nextJob.kind === "exportVideo") return runExportVideoJob(nextJob, deps);
  if (nextJob.kind === "exportPackage") return runExportPackageJob(nextJob, deps);
  return runMediaGenerationJob(nextJob, deps);
}

async function runExportVideoJob(nextJob, {
  episodes,
  isDesktopRuntime,
  appendExportHistory,
  buildRenderHistoryOptions,
  invokeRenderTimelineVideo,
  setProjectMessage,
}) {
  if (!isDesktopRuntime()) throw new Error("导出任务需要桌面版运行");
  appendExportHistory(buildExportQueueHistoryEntry({
    job: nextJob,
    status: "running",
    detail: "队列执行中",
    episodes,
    buildRenderHistoryOptions,
  }));
  const result = await invokeRenderTimelineVideo(nextJob.exportRequest);
  appendExportHistory(buildExportQueueHistoryEntry({
    job: nextJob,
    status: "done",
    detail: "队列导出完成",
    path: result.path || "",
    episodes,
    buildRenderHistoryOptions,
  }));
  setProjectMessage(`队列导出完成：${result.path || nextJob.title}`);
  return result;
}

async function runExportPackageJob(nextJob, {
  activeEpisodeId,
  safeFileName,
  appendExportHistory,
  saveDeliveryPackageArtifact,
  setProjectMessage,
}) {
  const entry = buildPackageHistoryEntry(nextJob, "running", "队列执行中", { activeEpisodeId });
  appendExportHistory(entry);
  const result = await saveDeliveryPackageArtifact(
    nextJob.packageFileName || safeFileName(`${nextJob.episodeName || "episode"}-delivery-package`),
    nextJob.packageContent || "",
    { requestId: nextJob.requestId || nextJob.id, skipHistory: true },
  );
  appendExportHistory(buildPackageHistoryEntry(nextJob, "done", "队列导出完成", {
    activeEpisodeId,
    path: result?.path || "",
  }));
  setProjectMessage(`工程包队列导出完成：${result?.path || nextJob.title}`);
  return result;
}

async function runMediaGenerationJob(nextJob, {
  settings,
  runImageGeneration,
  runVideoGeneration,
  resolveImageJobSettings,
  resolveVideoJobSettings,
  createOutputNear,
  markAssetProgressFromQueue,
  markShotProgressFromQueue,
  buildBusinessQueueResultPatch,
  getSourceNode,
  normalizeShotRecord,
  upsertTimelineClipFromShot,
  buildCascadedVideoJobsAfterImage,
  setGenerationQueue,
  shortTitle,
}) {
  const result = nextJob.kind === "video"
    ? await runVideoGeneration(resolveVideoJobSettings(settings, nextJob), nextJob.prompt || "AI Video")
    : await runImageGeneration(resolveImageJobSettings(settings, nextJob), nextJob.prompt || "AI Image");
  createOutputNear(
    nextJob.sourceNodeId,
    "result",
    nextJob.title || "队列生成结果",
    buildQueueResultNodePayload(nextJob, result),
  );
  markAssetProgressFromQueue(nextJob, result);
  const businessPatch = buildBusinessQueueResultPatch(nextJob, result);
  markShotProgressFromQueue(nextJob, businessPatch || buildQueueShotSuccessPatch(nextJob, result));
  syncTimelineShotFromQueue(nextJob, result, {
    getSourceNode,
    normalizeShotRecord,
    upsertTimelineClipFromShot,
  });
  enqueueCascadedVideoJob(nextJob, {
    buildCascadedVideoJobsAfterImage,
    setGenerationQueue,
    shortTitle,
  });
  return result;
}

function syncTimelineShotFromQueue(nextJob, result, {
  getSourceNode,
  normalizeShotRecord,
  upsertTimelineClipFromShot,
}) {
  if (!nextJob.sourceNodeId || !nextJob.shotId) return;
  const sourceNode = getSourceNode(nextJob.sourceNodeId);
  const currentShot = (sourceNode?.data?.shots || [])
    .map((shot, index) => normalizeShotRecord(shot, index))
    .find((shot) => shot.id === nextJob.shotId);
  if (!currentShot) return;
  upsertTimelineClipFromShot(
    nextJob.sourceNodeId,
    buildTimelineShotPatchFromQueue(nextJob, result, currentShot),
    { silent: true },
  );
}

function enqueueCascadedVideoJob(nextJob, {
  buildCascadedVideoJobsAfterImage,
  setGenerationQueue,
  shortTitle,
}) {
  if (nextJob.kind !== "image" || !nextJob.autoCascadeVideo || !String(nextJob.videoPrompt || "").trim()) return;
  setGenerationQueue((current) => {
    const cascadedJobs = buildCascadedVideoJobsAfterImage(nextJob, current, { shortTitle });
    if (!cascadedJobs.length) return current;
    return [...current, ...createGenerationJobs(cascadedJobs)];
  });
}

async function handleQueueJobFailure(nextJob, error, {
  autoRetryLimit,
  canRetry = true,
  setGenerationQueue,
  setProjectMessage,
  traceAppEvent,
  delay,
}) {
  const attemptCount = Number(nextJob.attempts || 0) + 1;
  const canAutoRetry = canRetry && !isExportJob(nextJob) && attemptCount <= autoRetryLimit;
  if (!canAutoRetry) return false;

  const message = error?.message || String(error);
  setGenerationQueue((current) => current.map((job) => (
    job.id === nextJob.id
      ? {
        ...job,
        status: "pending",
        attempts: attemptCount,
        error: message,
        resultSummary: `自动重试 ${attemptCount}/${autoRetryLimit}`,
        progress: null,
        updatedAt: Date.now(),
      }
      : job
  )));
  setProjectMessage(`生成失败，已自动重试：${nextJob.title || nextJob.shotId || "任务"}（${attemptCount}/${autoRetryLimit}）`);
  traceAppEvent("queue.job.auto_retry", {
    jobId: nextJob.id,
    kind: nextJob.kind,
    attempts: attemptCount,
    error: message,
  });
  await delay(250);
  return true;
}

function handleTerminalQueueFailure(nextJob, error, {
  episodes,
  activeEpisodeId,
  appendExportHistory,
  buildRenderHistoryOptions,
  markShotProgressFromQueue,
}) {
  const message = error?.message || String(error);
  if (!isExportJob(nextJob)) {
    markShotProgressFromQueue(nextJob, { status: "待修改" });
    return;
  }
  if (nextJob.kind === "exportPackage") {
    appendExportHistory(buildPackageHistoryEntry(nextJob, "failed", message, { activeEpisodeId }));
    return;
  }
  appendExportHistory(buildExportQueueHistoryEntry({
    job: nextJob,
    status: "failed",
    detail: message,
    episodes,
    buildRenderHistoryOptions,
  }));
}

function traceQueueJobStart(traceAppEvent, nextJob) {
  traceAppEvent("queue.job.start", {
    jobId: nextJob.id,
    kind: nextJob.kind,
    sourceNodeId: nextJob.sourceNodeId || "",
    shotId: nextJob.shotId || "",
  });
}

function buildPackageHistoryEntry(job, status, detail, { activeEpisodeId, path = "" } = {}) {
  return {
    requestId: job.requestId || job.id,
    type: "package",
    status,
    title: job.title || "工程包导出",
    detail,
    path,
    episodeId: job.episodeId || activeEpisodeId,
    episodeName: job.episodeName || "当前集",
  };
}

function defaultSafeFileName(value) {
  return String(value || "delivery-package").replace(/[\\/:*?"<>|]+/g, "-");
}

function defaultDelay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
