export function createProductionCommandContext(deps = {}) {
  return {
    commercialProject: deps.commercialProject || null,
    productionAppService: deps.productionAppService || null,
    projectCommandService: deps.projectCommandService || null,
    productionEvents: deps.productionEvents || [],
    setProductionEvents: typeof deps.setProductionEvents === "function" ? deps.setProductionEvents : () => {},
    addGenerationJobs: typeof deps.addGenerationJobs === "function" ? deps.addGenerationJobs : () => {},
    setProjectMessage: typeof deps.setProjectMessage === "function" ? deps.setProjectMessage : () => {},
  };
}

export function commitPlannedQueueJobs(context = {}, plan = {}, options = {}) {
  const jobs = Array.isArray(plan.jobs) ? plan.jobs : [];
  if (!jobs.length) {
    return {
      ok: false,
      jobCount: 0,
      message: options.emptyMessage || "没有可执行任务。",
    };
  }
  context.setProductionEvents?.(plan.events || context.productionEvents || []);
  context.addGenerationJobs?.(jobs, { autoRun: options.autoRun !== false });
  const message = options.message || `已加入队列：${jobs.length} 个任务`;
  context.setProjectMessage?.(message);
  return {
    ok: true,
    jobCount: jobs.length,
    jobs,
    message,
  };
}
