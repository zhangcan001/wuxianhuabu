export function buildBusinessOptimizationExecutionPlan(board = {}, options = {}) {
  const limit = Math.max(1, Number(options.limit || 5));
  const source = Array.isArray(board.topItems) && board.topItems.length
    ? board.topItems
    : (Array.isArray(board.items) ? board.items : []).filter((item) => item.status !== "done");
  const used = new Set();
  return source
    .filter((item) => item?.actionKey && item.status !== "done")
    .filter((item) => {
      const key = `${item.actionKey}:${item.key || ""}`;
      if (used.has(key)) return false;
      used.add(key);
      return true;
    })
    .slice(0, limit)
    .map((item, index) => ({
      ...item,
      step: index + 1,
      actionLabel: item.action || businessOptimizationActionLabel(item),
    }));
}

export async function executeBusinessOptimizationAction(item = {}, actions = {}, context = {}) {
  const setActiveView = context.setActiveView || (() => {});
  const actionMap = {
    script: () => setActiveView("script"),
    text: () => setActiveView("script"),
    shots: () => setActiveView("shots"),
    assets: () => setActiveView("assets"),
    media: () => setActiveView("media"),
    timeline: () => setActiveView("timeline"),
    review: () => setActiveView("review"),
    delivery: () => setActiveView("delivery"),
    queue: () => actions.openQueue?.(),
    dashboard: () => actions.openDashboard?.(),
    settings: () => actions.openSettings?.(),
    promptFactory: () => actions.openPromptFactory?.(),
    advancedCanvas: () => actions.openAdvancedCanvas?.(),
    generateText: () => setActiveView("script"),
    generateImages: () => actions.generateImages?.(),
    generateVideos: () => actions.generateVideos?.(),
    runReview: () => actions.runReview?.(),
    syncTimeline: () => actions.syncTimelineFromShots?.() || actions.openTimeline?.(),
    openExport: () => actions.openExport?.(),
  };
  const fn = actionMap[item.actionKey] || actionMap.dashboard;
  return fn?.();
}

export async function executeBusinessOptimizationPlan(board = {}, actions = {}, context = {}) {
  const plan = buildBusinessOptimizationExecutionPlan(board, context);
  const results = [];
  for (const item of plan) {
    try {
      const result = await executeBusinessOptimizationAction(item, actions, context);
      results.push({ key: item.key, actionKey: item.actionKey, title: item.title, ok: true, result });
    } catch (error) {
      results.push({ key: item.key, actionKey: item.actionKey, title: item.title, ok: false, error: error?.message || String(error) });
    }
  }
  return {
    ok: results.every((item) => item.ok),
    count: results.length,
    results,
    summary: summarizeBusinessOptimizationResults(results),
  };
}

export function summarizeBusinessOptimizationResults(results = []) {
  const items = Array.isArray(results) ? results : [];
  if (!items.length) return "没有可执行的业务优化项。";
  const okCount = items.filter((item) => item.ok).length;
  const failedCount = items.length - okCount;
  return failedCount
    ? `已执行 ${okCount}/${items.length} 项业务优化，${failedCount} 项失败。`
    : `已按顺序执行 ${okCount} 项业务优化。`;
}

export function businessOptimizationActionLabel(item = {}) {
  const labels = {
    script: "进入剧本",
    shots: "进入镜头表",
    assets: "进入资产库",
    media: "进入媒体生产",
    timeline: "同步时间线",
    review: "执行审片",
    delivery: "进入交付",
    queue: "打开队列",
    dashboard: "打开总控台",
    settings: "打开设置",
    promptFactory: "进入 Prompt 工厂",
    advancedCanvas: "打开兼容画布",
    generateText: "生成文本方案",
    generateImages: "补图/定妆",
    generateVideos: "补视频",
    runReview: "执行审片",
    syncTimeline: "同步时间线",
    openExport: "进入交付",
  };
  return labels[item.actionKey] || item.action || "处理";
}
