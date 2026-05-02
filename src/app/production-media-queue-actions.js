export function commitProductionPlanQueueJobs({
  productionCommandContext,
  productionPlan = {},
  jobs = [],
  options = {},
  commitPlannedQueueJobs,
  setShowQueue,
  mediaKind = "image",
  message = "",
} = {}) {
  const count = Array.isArray(jobs) ? jobs.length : 0;
  if (!count) return null;
  const label = mediaKind === "video" ? "视频" : "图片";
  commitPlannedQueueJobs(productionCommandContext, {
    ...productionPlan,
    jobs,
  }, {
    autoRun: options.autoRun !== false,
    message: message || `Production OS 已加入${label}队列：${count} 个任务`,
  });
  setShowQueue?.(true);
  return {
    title: `${label}任务已入队`,
    summary: `已按 Production OS 任务图加入 ${count} 个${label}任务。`,
    metrics: [{ label: `${label}任务`, value: count }],
  };
}
