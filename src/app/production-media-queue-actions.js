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

export async function queueEpisodeMediaAction({
  mediaKind = "image",
  providerMode = "",
  options = {},
  checkPreflight,
  notifyTaskBlocked,
  ensureProviderReady,
  uploadSummary = "",
  setProjectMessage,
  planProductionJobs,
  productionCommandContext,
  commitPlannedQueueJobs,
  setShowQueue,
  buildLegacyJobs,
  prepareCommand,
  addGenerationJobsAndMaybeRun,
} = {}) {
  const label = mediaKind === "video" ? "视频" : "图片";
  const preflight = checkPreflight?.();
  if (!preflight?.ok) {
    const message = preflight?.message || `${label}任务未通过预检。`;
    notifyTaskBlocked?.(message);
    return { title: `${label}任务未入队`, summary: message };
  }
  if (!(await ensureProviderReady?.(mediaKind, providerMode))) {
    return { title: `${label}任务未入队`, summary: `${label}供应商连接或配置未通过体检。` };
  }
  if (uploadSummary) {
    setProjectMessage?.(uploadSummary);
    return { title: "等待上传", summary: uploadSummary };
  }

  const productionPlan = planProductionJobs?.() || {};
  const productionJobs = productionPlan.jobs || [];
  if (productionJobs.length) {
    return commitProductionPlanQueueJobs({
      productionCommandContext,
      productionPlan,
      jobs: productionJobs,
      options,
      commitPlannedQueueJobs,
      setShowQueue,
      mediaKind,
    });
  }

  const legacy = buildLegacyJobs?.() || {};
  const command = prepareCommand?.(legacy) || {};
  if (!command.ok) {
    setProjectMessage?.(command.message);
    return command.result;
  }
  addGenerationJobsAndMaybeRun?.(command.jobs, { autoRun: options.autoRun !== false });
  setShowQueue?.(true);
  setProjectMessage?.(command.message);
  return command.result;
}
