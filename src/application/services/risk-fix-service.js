export function planRiskFixes(riskReport = {}) {
  const source = riskReport.topRisks?.length ? riskReport.topRisks : (riskReport.items || []).filter((item) => !item.ok);
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
  const used = new Set();
  return source
    .filter((item) => item.actionKind)
    .sort((a, b) => (priority[a.actionKind] ?? 99) - (priority[b.actionKind] ?? 99))
    .filter((item) => {
      const key = `${item.actionKind}:${(item.targetIds || []).join(",")}`;
      if (used.has(key)) return false;
      used.add(key);
      return true;
    })
    .slice(0, 3);
}

export async function executeRiskFixPlan(plan = [], executor = {}) {
  const results = [];
  for (const item of plan) {
    const fn = executor[item.actionKind] || executor.default;
    try {
      results.push({ key: item.key, actionKind: item.actionKind, ok: true, result: await fn?.(item) });
    } catch (error) {
      results.push({ key: item.key, actionKind: item.actionKind, ok: false, error: error?.message || String(error) });
    }
  }
  return { ok: results.every((item) => item.ok), count: results.length, results };
}

export function summarizeRiskScoreChange(before = {}, after = {}) {
  const beforeScore = Number(before.score || 0);
  const afterScore = Number(after.score || beforeScore);
  const remaining = Number(after.openCount ?? before.openCount ?? 0);
  return {
    beforeScore,
    afterScore,
    delta: afterScore - beforeScore,
    remaining,
    label: `${beforeScore}% -> ${afterScore}%${remaining ? ` · 剩余 ${remaining} 项` : " · 已清理"}`,
  };
}
