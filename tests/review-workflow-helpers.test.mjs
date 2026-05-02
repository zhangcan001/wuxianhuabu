import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPendingReviewBatchSummary,
  buildReviewClosureSummary,
  collectReviewableTargets,
  runBatchRefreshPlans,
  runBatchReviewAndRevise,
} from "../src/review-workflow-helpers.js";

test("collectReviewableTargets filters passed and shelved shots", () => {
  const targets = collectReviewableTargets({
    targets: [
      { shotId: "S01", reviewStatus: "未审" },
      { shotId: "S02", reviewStatus: "待修改" },
      { shotId: "S03", reviewStatus: "已通过" },
      { shotId: "S04", reviewStatus: "搁置" },
      { shotId: "", reviewStatus: "未审" },
    ],
  });

  assert.deepEqual(targets.map((item) => item.shotId), ["S01", "S02"]);
});

test("runBatchReviewAndRevise aggregates reviewed, revised and passed counts", async () => {
  const progress = [];
  const reviewed = [];
  const revised = [];
  const result = await runBatchReviewAndRevise([
    { shotId: "S01" },
    { shotId: "S02" },
  ], {
    onProgress: ({ target }) => progress.push(target.shotId),
    runReview: async (target) => ({ shotId: target.shotId, status: target.shotId === "S01" ? "已通过" : "待修改" }),
    inferReviewStatus: (review) => review.status,
    runRevise: async (target) => { revised.push(target.shotId); },
    getRefreshedReport: () => ({ summary: { passed: 1, pendingFix: 2 } }),
  });

  assert.deepEqual(progress, ["S01", "S02"]);
  assert.deepEqual(revised, ["S02"]);
  assert.deepEqual(result, {
    reviewed: 2,
    revised: 1,
    passed: 1,
    pendingFix: 2,
    refreshed: { summary: { passed: 1, pendingFix: 2 } },
  });
  reviewed.push(result.reviewed);
});

test("runBatchRefreshPlans only handles shots with refresh plan", async () => {
  const progress = [];
  const executed = [];
  const result = await runBatchRefreshPlans([
    { shotId: "S01" },
    { shotId: "S02" },
  ], {
    getShotForTarget: (target) => (
      target.shotId === "S01"
        ? { id: "S01", autoRevisionReport: { assetRefreshPlan: ["刷新"] } }
        : { id: "S02", autoRevisionReport: { assetRefreshPlan: [] } }
    ),
    onProgress: ({ handled, target }) => progress.push(`${handled}:${target.shotId}`),
    executePlan: (target) => {
      executed.push(target.shotId);
      return { assetCount: 1, promptUpdated: 2, timelineUpdated: 3 };
    },
  });

  assert.deepEqual(progress, ["1:S01"]);
  assert.deepEqual(executed, ["S01"]);
  assert.deepEqual(result, {
    handled: 1,
    assetCount: 1,
    promptUpdated: 2,
    timelineUpdated: 3,
    handledShots: ["S01"],
  });
});

test("review summary helpers keep payload readable", () => {
  const closure = buildReviewClosureSummary(
    [{ shotId: "S01" }, { shotId: "S02" }],
    { reviewed: 2, revised: 1 },
    { handled: 1, handledShots: ["S02"] },
    { summary: { pendingFix: 3, unreviewed: 1, refreshPlans: 2 } },
  );
  const pending = buildPendingReviewBatchSummary([{ shotId: "S01" }], { reviewed: 1, pendingFix: 1 }, 4);

  assert.deepEqual(closure, {
    reviewed: 2,
    revised: 1,
    refreshHandled: 1,
    pendingFix: 3,
    unreviewed: 1,
    refreshPlans: 2,
    reviewedShots: ["S01", "S02"],
    refreshedShots: ["S02"],
  });
  assert.deepEqual(pending, {
    reviewed: 1,
    pendingFix: 1,
    passed: 4,
    reviewedShots: ["S01"],
  });
});
