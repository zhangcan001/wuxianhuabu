export function runFullChainCheckAction({
  syncTimelineFromShots,
  productionAppService,
  projectStoreStateRef = null,
  commercialProject = null,
  productionEvents = [],
  productionState = {},
  buildStudioDeliveryOutputSpec,
  setProductionEvents,
  openProductionStudioView,
  now = () => new Date().toISOString(),
} = {}) {
  const timelineResult = syncTimelineFromShots?.();
  const project = projectStoreStateRef?.current?.project || commercialProject;
  const reviewResult = productionAppService?.runReview?.({
    commercialProject: project,
    events: productionEvents,
    reviewOptions: {
      outputSpec: productionState.project?.productionBible?.outputSpec || { aspectRatio: "9:16" },
      reviewer: "chain-check",
      reviewedAt: now(),
    },
  }) || {};
  const deliveryResult = productionAppService?.planDelivery?.({
    commercialProject: project,
    events: reviewResult.events || productionEvents,
    deliveryOptions: {
      outputSpec: buildStudioDeliveryOutputSpec?.({ format: "mp4", platform: "douyin" }) || { format: "mp4", platform: "douyin" },
    },
  }) || {};
  setProductionEvents?.(deliveryResult.events || productionEvents);
  const blockers = deliveryResult.delivery?.readiness?.blockers || [];
  openProductionStudioView?.(blockers.length ? "review" : "delivery", blockers.length
    ? `全链路验证完成：还有 ${blockers.length} 个交付阻塞。`
    : "全链路验证完成：审片与交付事件已归档，当前集可进入导出。");
  return {
    timeline: timelineResult,
    review: reviewResult,
    delivery: deliveryResult.delivery,
    summary: blockers.length ? `还有 ${blockers.length} 个交付阻塞。` : "全链路验证通过。",
  };
}
