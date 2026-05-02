export function executeRiskAction(item = {}, actions = {}) {
  const ids = Array.isArray(item.targetIds) ? item.targetIds : [];
  const actionMap = {
    generateText: () => actions.openPromptFactory?.(),
    openDashboard: () => actions.openDashboard?.(),
    repairStateAuthority: () => actions.repairLegacyTimelineFromBusiness?.() || actions.repairBusinessTimelineFromLegacy?.(),
    generateVideos: () => actions.generateVideos?.(),
    syncTimeline: () => actions.syncTimelineFromShots?.() || actions.openTimeline?.(),
    retryFailedQueue: () => ids.length ? actions.retryQueueJobs?.(ids) : actions.openQueue?.(),
    openSettings: () => actions.openSettings?.(),
    openQueue: () => actions.openQueue?.(),
    openDelivery: () => actions.openExport?.(),
    runReview: () => actions.runReview?.() || actions.openDashboard?.(),
    generateImages: () => actions.generateImages?.(),
    runFullChainCheck: () => actions.runFullChainCheck?.() || actions.openDashboard?.(),
    runSystemSelfCheck: () => actions.runSystemSelfCheck?.() || actions.openDashboard?.(),
    repairMedia: () => actions.repairMediaIntegrity?.() || actions.openExport?.(),
    repairAssetConsistency: () => actions.repairAssetConsistency?.() || actions.generateImages?.(),
    focusMainChain: () => actions.focusMainChain?.() || actions.openDashboard?.(),
  };
  return (actionMap[item.actionKind] || actionMap.openDashboard)?.();
}

export function riskActionLabel(item = {}) {
  const labels = {
    generateText: "生成方案",
    openDashboard: "看总控",
    repairStateAuthority: "执行修复",
    generateVideos: "补视频",
    syncTimeline: "同步时间线",
    retryFailedQueue: "重试失败",
    openSettings: "打开设置",
    openQueue: "处理队列",
    openDelivery: "交付检查",
    runReview: "执行审片",
    generateImages: "补图/定妆",
    runFullChainCheck: "验证全链路",
    runSystemSelfCheck: "系统自检",
    repairMedia: "修复素材",
    repairAssetConsistency: "锁定资产",
    focusMainChain: "收敛主链",
  };
  return labels[item.actionKind] || "处理";
}

export function buildRiskAutoFixPlan(riskReport = {}) {
  const source = riskReport.topRisks?.length
    ? riskReport.topRisks
    : (riskReport.items || []).filter((item) => !item.ok);
  const safeActionKinds = new Set([
    "retryFailedQueue",
    "repairStateAuthority",
    "syncTimeline",
    "generateImages",
    "generateVideos",
    "runReview",
    "openDelivery",
    "openSettings",
    "openDashboard",
    "runFullChainCheck",
    "runSystemSelfCheck",
    "repairMedia",
    "repairAssetConsistency",
    "focusMainChain",
  ]);
  const used = new Set();
  return source
    .filter((item) => item?.actionKind && safeActionKinds.has(item.actionKind))
    .sort(compareRiskActionPriority)
    .filter((item) => {
      const key = `${item.actionKind}:${(item.targetIds || []).join(",")}`;
      if (used.has(key)) return false;
      used.add(key);
      return true;
    })
    .slice(0, 3);
}

export async function executeRiskAutoFixPlan(riskReport = {}, actions = {}) {
  const plan = buildRiskAutoFixPlan(riskReport);
  const results = [];
  for (const item of plan) {
    try {
      const result = await executeRiskAction(item, actions);
      results.push({ key: item.key, actionKind: item.actionKind, ok: true, result });
    } catch (error) {
      results.push({ key: item.key, actionKind: item.actionKind, ok: false, error: error?.message || String(error) });
    }
  }
  return {
    ok: results.every((item) => item.ok),
    count: results.length,
    results,
    beforeScore: Number(riskReport.score || 0),
    afterScore: estimateAfterScore(riskReport, results),
    summary: summarizeRiskAutoFixResults(results),
  };
}

export function summarizeRiskAutoFixResults(results = []) {
  const items = Array.isArray(results) ? results : [];
  if (!items.length) return "没有可自动处理的风险。";
  const okCount = items.filter((item) => item.ok).length;
  const failedCount = items.length - okCount;
  return failedCount
    ? `已处理 ${okCount}/${items.length} 项，${failedCount} 项失败。`
    : `已处理 ${okCount} 项最高风险。`;
}

function compareRiskActionPriority(a = {}, b = {}) {
  const priority = {
    repairStateAuthority: 0,
    retryFailedQueue: 1,
    repairAssetConsistency: 2,
    repairMedia: 3,
    syncTimeline: 4,
    generateImages: 5,
    generateVideos: 6,
    runReview: 7,
    runFullChainCheck: 8,
    runSystemSelfCheck: 9,
    openDelivery: 10,
    openSettings: 11,
    focusMainChain: 12,
    openDashboard: 13,
  };
  const severity = { critical: 0, high: 1, medium: 2, info: 3 };
  const actionRank = (priority[a.actionKind] ?? 99) - (priority[b.actionKind] ?? 99);
  if (actionRank) return actionRank;
  return (severity[a.severity] ?? 9) - (severity[b.severity] ?? 9);
}

function estimateAfterScore(riskReport = {}, results = []) {
  const fixed = results.filter((item) => item.ok).length;
  const total = Math.max(1, (riskReport.items || []).length || 10);
  return Math.min(100, Math.round(Number(riskReport.score || 0) + (fixed / total) * 100));
}
