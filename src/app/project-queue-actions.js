import {
  clearQueueState,
  removeQueueJobState,
  reprioritizeQueueJobState,
  retryFailedJobsState,
  retryQueueJobState,
} from "../queue-state-helpers.js";

export function clearFinishedQueueJobs(queue = []) {
  return (Array.isArray(queue) ? queue : []).filter((job) => job.status === "pending" || job.status === "running");
}

export function clearGenerationQueueAction({
  setGenerationQueue = () => {},
  queueRunning = false,
} = {}) {
  setGenerationQueue((current) => clearQueueState(current, { keepRunning: queueRunning }));
}

export function removeQueueJobAction({
  jobId,
  setGenerationQueue = () => {},
} = {}) {
  setGenerationQueue((current) => removeQueueJobState(current, jobId));
}

export function clearFinishedJobsAction({
  setGenerationQueue = () => {},
} = {}) {
  setGenerationQueue((current) => clearFinishedQueueJobs(current));
}

export function retryQueueJobAction({
  jobId,
  setGenerationQueue = () => {},
} = {}) {
  setGenerationQueue((current) => retryQueueJobState(current, jobId));
}

export function retryQueueJobsAction({
  jobIds = [],
  setGenerationQueue = () => {},
  setProjectMessage = () => {},
} = {}) {
  const ids = Array.from(new Set((Array.isArray(jobIds) ? jobIds : [jobIds]).filter(Boolean)));
  if (!ids.length) {
    setProjectMessage("没有可重试的任务。");
    return { matched: 0 };
  }
  setGenerationQueue((current) => ids.reduce((queue, jobId) => retryQueueJobState(queue, jobId), current));
  setProjectMessage(`已重试 ${ids.length} 个失败任务`);
  return { matched: ids.length };
}

export function retryFailedShotJobsAction({
  setGenerationQueue = () => {},
  setShowQueue = () => {},
  setProjectMessage = () => {},
} = {}) {
  let matched = 0;
  setGenerationQueue((current) => {
    const result = retryFailedJobsState(current, {
      predicate: (job) => job.kind !== "exportVideo" && job.status === "failed",
    });
    matched = result.matched;
    return result.queue;
  });
  if (!matched) {
    setProjectMessage("当前没有失败的镜头生成任务可重试。");
    return { matched };
  }
  setShowQueue(true);
  setProjectMessage(`已重试 ${matched} 个失败镜头任务`);
  return { matched };
}

export function retryFailedJobsAction({
  setGenerationQueue = () => {},
  setProjectMessage = () => {},
} = {}) {
  let matched = 0;
  setGenerationQueue((current) => {
    const result = retryFailedJobsState(current);
    matched = result.matched;
    return result.queue;
  });
  setProjectMessage(matched ? `已重试 ${matched} 个失败任务` : "当前没有失败任务可重试。");
  return { matched };
}

export function reprioritizeJobAction({
  jobId,
  priority,
  setGenerationQueue = () => {},
} = {}) {
  setGenerationQueue((current) => reprioritizeQueueJobState(current, jobId, priority));
}

export function retryExportJobsAction({
  scope = "all",
  setGenerationQueue = () => {},
  setShowQueue = () => {},
  setProjectMessage = () => {},
} = {}) {
  let matched = 0;
  setGenerationQueue((current) => {
    const result = retryFailedJobsState(current, {
      predicate: (job) => job.kind === "exportVideo" && (scope !== "failed" || job.status === "failed"),
      patch: () => ({ resultSummary: scope === "failed" ? "已重新排队，等待导出" : "已批量重跑，等待导出" }),
    });
    matched = result.matched;
    return result.queue;
  });
  if (!matched) {
    setProjectMessage(scope === "failed" ? "当前没有失败的导出任务可重跑。" : "当前没有可重跑的导出任务。");
    return { matched };
  }
  setShowQueue(true);
  setProjectMessage(scope === "failed" ? `已重跑 ${matched} 个失败导出任务` : `已批量重跑 ${matched} 个导出任务`);
  return { matched };
}
