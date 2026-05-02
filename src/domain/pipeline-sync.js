import {
  buildPipelineSyncPlan,
} from "../node-link-helpers.js";

export function buildPipelineSyncExecutionPlan({
  assetTarget = null,
  assetPatch = null,
  hasAssets = false,
  shotTarget = null,
  shotPatch = null,
  hasShots = false,
  options = {},
} = {}) {
  const syncPlan = buildPipelineSyncPlan({
    assetTarget,
    assetPatch,
    hasAssets,
    shotTarget,
    shotPatch,
    hasShots,
  });
  return {
    asset: syncPlan.asset
      ? {
        ...syncPlan.asset,
        shouldQueueImages: Boolean(options.autoQueueAssets),
      }
      : null,
    shot: syncPlan.shot && !options.assetOnly
      ? {
        ...syncPlan.shot,
        shouldSyncTimeline: Boolean(options.syncTimeline),
        shouldQueueImages: Boolean(options.autoQueueShots),
      }
      : null,
  };
}

export function buildPipelineSyncTracePayload(sourceId = "", executionPlan = {}, actions = [], options = {}) {
  return {
    sourceId,
    actions: Array.isArray(actions) ? actions : [],
    syncTimeline: Boolean(options.syncTimeline),
    assetMode: executionPlan.asset?.mode || "",
    shotMode: executionPlan.shot?.mode || "",
  };
}

export function buildPipelineSyncQueueMessage(kind = "shot", count = 0) {
  const amount = Number(count || 0);
  if (amount <= 0) return "";
  return kind === "asset"
    ? `资产图片队列已入队 ${amount}`
    : `图片队列已入队 ${amount}`;
}

export function appendPipelineSyncAction(actions = [], message = "") {
  const text = String(message || "").trim();
  return text ? [...actions, text] : actions;
}
