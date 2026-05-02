export function collectReviewableTargets(report) {
  return (report?.targets || []).filter((item) => item.shotId && !["已通过", "搁置"].includes(item.reviewStatus || "未审"));
}

export async function runBatchReviewAndRevise(targets, options = {}) {
  const onProgress = options.onProgress || (() => {});
  const runReview = options.runReview || (async () => null);
  const inferReviewStatus = options.inferReviewStatus || (() => "未审");
  const runRevise = options.runRevise || (async () => null);
  const getRefreshedReport = options.getRefreshedReport || (() => ({ summary: {} }));

  let reviewed = 0;
  let revised = 0;
  let passed = 0;

  for (let index = 0; index < (targets || []).length; index += 1) {
    const target = targets[index];
    onProgress({ index, total: targets.length, target });
    // eslint-disable-next-line no-await-in-loop
    const review = await runReview(target, index);
    reviewed += 1;
    if (inferReviewStatus(review) === "已通过") {
      passed += 1;
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    await runRevise(target, review, index);
    revised += 1;
  }

  const refreshed = getRefreshedReport();
  return {
    reviewed,
    revised,
    passed: refreshed.summary?.passed ?? passed,
    pendingFix: refreshed.summary?.pendingFix || 0,
    refreshed,
  };
}

export async function runBatchRefreshPlans(targets, options = {}) {
  const onProgress = options.onProgress || (() => {});
  const getShotForTarget = options.getShotForTarget || (() => null);
  const executePlan = options.executePlan || (() => ({}));

  let assetCount = 0;
  let promptUpdated = 0;
  let timelineUpdated = 0;
  let handled = 0;
  const handledShots = [];

  for (let index = 0; index < (targets || []).length; index += 1) {
    const target = targets[index];
    const shot = getShotForTarget(target, index);
    if (!shot?.autoRevisionReport?.assetRefreshPlan?.length) continue;
    handled += 1;
    handledShots.push(target.shotId);
    onProgress({ index, handled, target, shot });
    const result = executePlan(target, shot, index) || {};
    assetCount += result.assetCount || 0;
    promptUpdated += result.promptUpdated || 0;
    timelineUpdated += result.timelineUpdated || 0;
  }

  return {
    handled,
    assetCount,
    promptUpdated,
    timelineUpdated,
    handledShots: handledShots.slice(0, 8),
  };
}

export function buildReviewClosureSummary(pendingTargets, reviewResult, refreshResult, refreshedReport) {
  return {
    reviewed: reviewResult.reviewed || 0,
    revised: reviewResult.revised || 0,
    refreshHandled: refreshResult.handled || 0,
    pendingFix: refreshedReport?.summary?.pendingFix || 0,
    unreviewed: refreshedReport?.summary?.unreviewed || 0,
    refreshPlans: refreshedReport?.summary?.refreshPlans || 0,
    reviewedShots: (pendingTargets || []).map((item) => item.shotId).filter(Boolean).slice(0, 8),
    refreshedShots: refreshResult.handledShots || [],
  };
}

export function buildPendingReviewBatchSummary(targets, result, fallbackPassed = 0) {
  return {
    ...(result || {}),
    passed: result?.passed ?? fallbackPassed,
    reviewedShots: (targets || []).map((item) => item.shotId).filter(Boolean).slice(0, 8),
  };
}
