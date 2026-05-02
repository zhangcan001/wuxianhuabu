import assert from "node:assert/strict";
import test from "node:test";
import {
  autoReviseShotFromReviewAction,
  buildAssetRefreshEvidence,
  buildAutoRevisionReportPayload,
  buildRefreshPlanCompletionPatch,
  buildShotRefreshExecutionPlan,
  buildTimelineRepairPlan,
  collectShotTouchedTokens,
  executeShotRefreshPlanAction,
  refreshAssetsFromRevision,
  repairRejectedTimelineClipAction,
} from "../src/review-action-helpers.js";

function dedupeOrderedStrings(values = []) {
  const seen = new Set();
  const result = [];
  values.forEach((value) => {
    const normalized = String(value || "").trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
}

test("collectShotTouchedTokens merges shot refs and primary tokens", () => {
  const tokens = collectShotTouchedTokens({
    assetRefs: ["@角色_主角", "@场景_街道"],
    mainCharacterToken: "@角色_主角",
    mainSceneToken: "@场景_街道",
    keyPropTokens: ["@道具_手机", ""],
  }, { dedupeOrderedStrings });

  assert.deepEqual(tokens, ["@角色_主角", "@场景_街道", "@道具_手机"]);
});

test("buildShotRefreshExecutionPlan infers refresh targets from plan text", () => {
  const plan = buildShotRefreshExecutionPlan({
    id: "S01",
    assetRefs: ["@角色_主角"],
    autoRevisionReport: {
      assetRefreshPlan: ["刷新提示词", "同步时间线", "检查角色资产"],
    },
  }, { shotId: "S01" }, {
    collectShotTouchedTokens: (shot) => collectShotTouchedTokens(shot, { dedupeOrderedStrings }),
  });

  assert.deepEqual(plan.refreshPlan, ["刷新提示词", "同步时间线", "检查角色资产"]);
  assert.equal(plan.needsPromptRefresh, true);
  assert.equal(plan.needsTimelineRefresh, true);
  assert.equal(plan.needsAssetRefresh, true);
  assert.deepEqual(plan.touchedTokens, ["@角色_主角"]);
});

test("refresh evidence and completion patch keep audit trail readable", () => {
  const evidence = buildAssetRefreshEvidence({
    autoRevisionReport: { fixedIssues: ["补充角色动作", "压缩描述"] },
  }, { shotId: "S02" }, { dedupeOrderedStrings });
  const patch = buildRefreshPlanCompletionPatch(
    {
      reviewStatus: "待修改",
      autoRevisionReport: { executedRefreshPlan: ["旧计划"] },
    },
    ["刷新提示词", "同步时间线"],
    { assetCount: 1, promptUpdated: 2, timelineUpdated: 3 },
    { score: 90 },
    { dedupeOrderedStrings, now: () => 123 },
  );

  assert.deepEqual(evidence, ["补充角色动作", "压缩描述", "刷新于 S02"]);
  assert.deepEqual(patch, {
    reviewStatus: "已通过",
    autoRevisionReport: {
      executedRefreshPlan: ["旧计划", "刷新提示词", "同步时间线"],
      assetRefreshPlan: [],
      refreshSummary: "已执行刷新计划：资产 1 · 提示词 2 · 时间线 3",
      refreshCompletedAt: 123,
      updatedAt: 123,
    },
  });
});

test("auto revision payload and timeline repair plan stay deterministic", () => {
  const payload = buildAutoRevisionReportPayload({
    summary: "修掉节奏问题",
    changeLog: ["删冗余动作"],
    fixedIssues: ["节奏拖慢"],
  }, ["刷新时间线"], { now: () => 456 });
  const repair = buildTimelineRepairPlan({
    approvalNote: "请重做素材和镜头提示词",
    mediaUrl: "",
  }, { dedupeOrderedStrings });

  assert.deepEqual(payload, {
    summary: "修掉节奏问题",
    changeLog: ["删冗余动作"],
    fixedIssues: ["节奏拖慢"],
    assetRefreshPlan: ["刷新时间线"],
    executedRefreshPlan: [],
    refreshSummary: "",
    refreshCompletedAt: 0,
    updatedAt: 456,
  });
  assert.deepEqual(repair, ["media", "shot"]);
});

test("refreshAssetsFromRevision patches every resolved token once", () => {
  const calls = [];
  const changed = refreshAssetsFromRevision(
    { shotId: "S03" },
    { assetRefs: ["@角色_主角", "@场景_街道"] },
    { fixedIssues: ["补动作"] },
    {
      dedupeOrderedStrings,
      collectShotTouchedTokens: (shot) => collectShotTouchedTokens(shot, { dedupeOrderedStrings }),
      parseAssetTokenCategory: (token) => token.includes("@角色_") ? "角色" : "场景",
      patchAssetRecord: (token, category, patch) => {
        calls.push([token, category, patch.evidenceSource]);
        return true;
      },
    },
  );

  assert.equal(changed, 2);
  assert.deepEqual(calls, [
    ["@角色_主角", "角色", ["补动作", "来自 S03 自动修订"]],
    ["@场景_街道", "场景", ["补动作", "来自 S03 自动修订"]],
  ]);
});

test("executeShotRefreshPlanAction orchestrates prompt, timeline and completion patch", () => {
  const shot = {
    id: "S01",
    reviewStatus: "待修改",
    assetRefs: ["@角色_主角"],
    autoRevisionReport: { assetRefreshPlan: ["刷新提示词", "同步时间线"] },
  };
  const patchCalls = [];
  const activity = [];
  const result = executeShotRefreshPlanAction({ nodeId: "node-1", shotId: "S01" }, {
    episodeId: "ep1",
    dedupeOrderedStrings,
    getShotByTarget: () => shot,
    collectShotTouchedTokens: (currentShot) => collectShotTouchedTokens(currentShot, { dedupeOrderedStrings }),
    patchAssetRecordForShotTokens: () => 1,
    rebuildShotPrompts: () => 1,
    buildShotQualityReport: () => ({ score: 90 }),
    syncTimelineFromShot: () => ({ timelineUpdated: 1 }),
    patchShotRecord: (...args) => patchCalls.push(args),
    appendCollaborationActivity: (entry) => activity.push(entry),
  });

  assert.deepEqual(result, {
    assetCount: 1,
    promptUpdated: 1,
    timelineUpdated: 1,
    refreshPlan: ["刷新提示词", "同步时间线"],
  });
  assert.equal(patchCalls.length, 1);
  assert.equal(activity[0].type, "review_refresh_plan");
});

test("autoReviseShotFromReviewAction applies revision and optionally reruns final review", async () => {
  const patchCalls = [];
  const upserts = [];
  const refreshed = [];
  const result = await autoReviseShotFromReviewAction(
    { nodeId: "node-1", shotId: "S02" },
    { status: "待修改" },
    {
      episodeId: "ep1",
      getShotByTarget: () => ({ id: "S02", reviewStatus: "待修改" }),
      runRevision: async () => ({ summary: "已修正", patch: { scene: "新场景" }, fixedIssues: ["补场景"] }),
      normalizeShotRevisionPatch: (_shot, patch) => patch,
      inferShotRefreshPlanFromPatch: () => ["同步时间线"],
      patchShotRecord: (...args) => patchCalls.push(args),
      normalizeShotRecord: (shot) => shot,
      upsertTimelineClipFromShot: (...args) => upserts.push(args),
      refreshAssetsFromRevision: (...args) => refreshed.push(args),
      appendCollaborationActivity: () => {},
      runFinalReview: async () => ({ status: "已通过" }),
    },
  );

  assert.equal(patchCalls.length, 1);
  assert.equal(upserts.length, 1);
  assert.equal(refreshed.length, 1);
  assert.deepEqual(result, {
    review: { status: "已通过" },
    revision: { summary: "已修正", patch: { scene: "新场景" }, fixedIssues: ["补场景"] },
  });
});

test("repairRejectedTimelineClipAction repairs clip and backfills linked shot", async () => {
  const clipState = {
    id: "clip-1",
    title: "开场",
    shotId: "S01",
    approvalNote: "请重做素材和镜头提示词",
    mediaUrl: "",
  };
  const timelinePatches = [];
  const shotPatches = [];
  const result = await repairRejectedTimelineClipAction("clip-1", {
    dedupeOrderedStrings,
    findTimelineClipById: () => clipState,
    patchTimelineClip: (_clipId, patch) => timelinePatches.push(patch),
    queueGenerationForTimelineClip: () => true,
    findShotByTimelineClip: () => ({ node: { id: "shot-node-1" }, shot: { id: "S01", reworkReason: "" } }),
    patchShotRecord: (...args) => {
      shotPatches.push(args);
      return true;
    },
    patchShotFromTimelineClip: () => ({ synced: 1 }),
  });

  assert.equal(result.queued, 1);
  assert.equal(result.shot, 1);
  assert.equal(result.backfill, 1);
  assert.equal(timelinePatches.length, 1);
  assert.equal(shotPatches.length, 1);
});
