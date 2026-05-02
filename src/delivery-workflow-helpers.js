function clipWorkflowLabel(clip) {
  if (!clip) return "";
  const base = clip.title || clip.shotId || clip.id || "未命名片段";
  return clip.shotId ? `${base} · ${clip.shotId}` : base;
}

function normalizeBackfillCount(value) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object") return Number(value.synced || 0);
  return 0;
}

export async function runBatchTimelineApprovals(targets, options = {}) {
  const onProgress = options.onProgress || (() => {});
  const runApproval = options.runApproval || (async () => null);
  const results = [];
  for (let index = 0; index < (targets || []).length; index += 1) {
    const clip = targets[index];
    onProgress({ index, total: targets.length, clip });
    // eslint-disable-next-line no-await-in-loop
    results.push(await runApproval(clip, index));
  }
  return results;
}

export function summarizeTimelineApprovalBatch(results = []) {
  const passed = results.filter((item) => item?.approvalStatus === "已通过").length;
  const rejected = results.filter((item) => item?.approvalStatus === "退回修改").length;
  const backfilled = results.reduce((sum, item) => sum + normalizeBackfillCount(item?.backfill), 0);
  return {
    reviewed: results.length,
    passed,
    rejected,
    backfilled,
    clips: results.slice(0, 8).map((item) => `${item?.title || item?.shotId || item?.clipId || "未命名片段"}${item?.shotId ? ` · ${item.shotId}` : ""}(${item?.approvalStatus || "待验收"})`),
  };
}

export async function runBatchTimelineRepairs(targets, options = {}) {
  const onProgress = options.onProgress || (() => {});
  const runRepair = options.runRepair || (async () => null);
  const results = [];
  for (let index = 0; index < (targets || []).length; index += 1) {
    const clip = targets[index];
    onProgress({ index, total: targets.length, clip });
    // eslint-disable-next-line no-await-in-loop
    results.push(await runRepair(clip, index));
  }
  return results;
}

export function summarizeTimelineRepairBatch(results = []) {
  return {
    repaired: results.length,
    queued: results.reduce((sum, item) => sum + Number(item?.queued || 0), 0),
    shot: results.reduce((sum, item) => sum + Number(item?.shot || 0), 0),
    backfilled: results.reduce((sum, item) => sum + normalizeBackfillCount(item?.backfill), 0),
    clips: results.slice(0, 8).map((item) => `${item?.title || item?.clipId || "未命名片段"}(${(item?.actions || []).join("/") || "无动作"})`),
  };
}

export function buildTimelineBackfillBatchSummary(clips = [], result = {}) {
  const syncedClipIds = Array.isArray(result?.syncedClipIds) ? result.syncedClipIds : [];
  return {
    ...result,
    clips: (clips || [])
      .filter((clip) => syncedClipIds.includes(clip.id))
      .map((clip) => clipWorkflowLabel(clip))
      .slice(0, 8),
  };
}

export function buildMissingMediaBatchSummary(clips = [], queued = 0) {
  return {
    queued,
    clips: (clips || []).map((clip) => clipWorkflowLabel(clip)).slice(0, 8),
  };
}

export function buildFailedExportRetrySummary(failed = [], episodeName = "当前集") {
  return {
    retried: (failed || []).length,
    target: episodeName || "当前集",
  };
}

export function buildTimelineClosureSummary(input = {}) {
  const {
    imported = 0,
    importedSources = [],
    episodeTimeline = {},
    prepare = {},
    backfill = {},
  } = input;
  return {
    imported,
    processed: prepare.processed || 0,
    synced: prepare.synced || 0,
    backfilled: backfill.synced || 0,
    backfillSkipped: backfill.skipped || 0,
    backfillMissingLink: backfill.missingLink || 0,
    queued: prepare.queued || 0,
    blocked: prepare.blocked || 0,
    remaining: prepare.remaining || {},
    importedShots: (importedSources || []).map((item) => item?.shotId || item?.id).filter(Boolean).slice(0, 8),
    processedClips: (episodeTimeline?.clips || []).map((clip) => clipWorkflowLabel(clip)).slice(0, 8),
  };
}

export function buildExportDeliverableResult(input = {}) {
  const {
    pipelineResult = {},
    approvalResult = {},
    exportReady = false,
    queuedRenders = 0,
    queuedRenderLabels = [],
  } = input;
  return {
    ...pipelineResult,
    reviewedApprovals: approvalResult.reviewed || 0,
    passedApprovals: approvalResult.passed || 0,
    rejectedApprovals: approvalResult.rejected || 0,
    queuedRenders,
    exportReady,
    queuedRenderLabels,
  };
}
