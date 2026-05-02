import {
  buildGenerationTaskFingerprint,
  recoverInterruptedQueue,
} from "./domain/production-optimization-helpers.js";

export function createGenerationJobs(jobs, { now = () => Date.now(), idSuffix = () => Math.random().toString(36).slice(2, 8) } = {}) {
  const createdAt = now();
  return (Array.isArray(jobs) ? jobs : []).map((job) => ({
    ...job,
    id: `job-${createdAt}-${idSuffix()}`,
    fingerprint: job.fingerprint || buildGenerationTaskFingerprint(job),
    status: "pending",
    priority: job.priority || "中",
    error: "",
    attempts: 0,
    createdAt,
    updatedAt: createdAt,
    resultSummary: "",
    progress: job.progress ?? null,
  }));
}

export function recoverInterruptedQueueState(queue, options = {}) {
  return recoverInterruptedQueue(queue, options);
}

export function clearQueueState(queue, { keepRunning = false } = {}) {
  const source = Array.isArray(queue) ? queue : [];
  return keepRunning ? source.filter((job) => job.status === "running") : [];
}

export function removeQueueJobState(queue, jobId) {
  return (Array.isArray(queue) ? queue : []).filter((job) => job.id !== jobId || job.status === "running");
}

export function retryQueueJobState(queue, jobId, { now = () => Date.now() } = {}) {
  const updatedAt = now();
  return (Array.isArray(queue) ? queue : []).map((job) => (
    job.id === jobId ? resetJobForRetry(job, updatedAt) : job
  ));
}

export function retryFailedJobsState(queue, { now = () => Date.now(), predicate = (job) => job.status === "failed", patch = () => ({}) } = {}) {
  const updatedAt = now();
  let matched = 0;
  const queueNext = (Array.isArray(queue) ? queue : []).map((job) => {
    if (!predicate(job)) return job;
    matched += 1;
    return {
      ...resetJobForRetry(job, updatedAt),
      ...patch(job),
    };
  });
  return { queue: queueNext, matched };
}

export function reprioritizeQueueJobState(queue, jobId, priority, { now = () => Date.now() } = {}) {
  const updatedAt = now();
  return (Array.isArray(queue) ? queue : []).map((job) => (
    job.id === jobId ? { ...job, priority, updatedAt } : job
  ));
}

export function applyTimelineRenderProgress(queue, payload, { now = () => Date.now() } = {}) {
  const requestId = String(payload?.requestId || "");
  const progress = Number(payload?.progress);
  const message = String(payload?.message || "");
  if (!requestId) return { queue, changed: false, message, progress };

  let changed = false;
  const queueNext = (Array.isArray(queue) ? queue : []).map((job) => {
    if (job.requestId !== requestId) return job;
    changed = true;
    return {
      ...job,
      progress: Number.isFinite(progress) ? clamp(progress, 0, 100) : job.progress,
      resultSummary: message || job.resultSummary || "",
      updatedAt: now(),
    };
  });
  return { queue: changed ? queueNext : queue, changed, message, progress };
}

export function markNextPendingJobRunning(queue, compareQueueJobs, { now = () => Date.now() } = {}) {
  const source = Array.isArray(queue) ? queue : [];
  const pending = source
    .map((job, index) => ({ job, index }))
    .filter(({ job }) => job.status === "pending")
    .sort((a, b) => compareQueueJobs(a.job, b.job));
  const index = pending[0]?.index ?? -1;
  if (index < 0) return { queue: source, job: null };

  const updatedAt = now();
  const selected = source[index];
  const runningJob = {
    ...selected,
    status: "running",
    error: "",
    attempts: (selected.attempts || 0) + 1,
    progress: selected.kind === "exportVideo" ? Math.max(0, Number(selected.progress) || 0) : selected.progress,
    resultSummary: selected.kind === "exportVideo" ? "已进入导出队列" : selected.resultSummary,
    updatedAt,
  };

  return {
    queue: source.map((job, jobIndex) => (jobIndex === index ? runningJob : job)),
    job: selected,
  };
}

export function markQueueJobDone(queue, jobId, resultSummary, { now = () => Date.now() } = {}) {
  const updatedAt = now();
  return (Array.isArray(queue) ? queue : []).map((job) => (
    job.id === jobId ? {
      ...job,
      status: "done",
      progress: job.kind === "exportVideo" ? 100 : job.progress,
      updatedAt,
      resultSummary,
    } : job
  ));
}

export function markQueueJobFailed(queue, jobId, error, { now = () => Date.now() } = {}) {
  const updatedAt = now();
  const message = error?.message || String(error);
  return (Array.isArray(queue) ? queue : []).map((job) => (
    job.id === jobId ? {
      ...job,
      status: "failed",
      resultSummary: "",
      error: message,
      updatedAt,
    } : job
  ));
}

function resetJobForRetry(job, updatedAt) {
  return {
    ...job,
    status: "pending",
    error: "",
    resultSummary: "",
    progress: job.kind === "exportVideo" ? 0 : null,
    updatedAt,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
