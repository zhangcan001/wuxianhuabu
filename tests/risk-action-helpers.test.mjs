import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRiskAutoFixPlan,
  executeRiskAction,
  executeRiskAutoFixPlan,
  riskActionLabel,
  summarizeRiskAutoFixResults,
} from "../src/product/studio/risk-action-helpers.js";

test("risk action helper dispatches targeted queue retries", () => {
  const calls = [];
  const result = executeRiskAction(
    { actionKind: "retryFailedQueue", targetIds: ["job-1", "job-2"] },
    { retryQueueJobs: (ids) => calls.push(["retry", ids]) },
  );

  assert.equal(result, 1);
  assert.deepEqual(calls, [["retry", ["job-1", "job-2"]]]);
  assert.equal(riskActionLabel({ actionKind: "syncTimeline" }), "同步时间线");
  assert.equal(riskActionLabel({ actionKind: "runFullChainCheck" }), "验证全链路");
  assert.equal(riskActionLabel({ actionKind: "repairMedia" }), "修复素材");
});

test("risk auto fix plan dedupes safe actions and limits the batch", async () => {
  const report = {
    topRisks: [
      { key: "video", actionKind: "generateVideos" },
      { key: "provider", actionKind: "retryFailedQueue", targetIds: ["job-1"] },
      { key: "failure", actionKind: "retryFailedQueue", targetIds: ["job-1"] },
      { key: "state", actionKind: "repairStateAuthority" },
      { key: "timeline", actionKind: "syncTimeline" },
      { key: "settings", actionKind: "openSettings" },
      { key: "asset", actionKind: "repairAssetConsistency" },
    ],
  };
  const plan = buildRiskAutoFixPlan(report);
  const calls = [];
  const result = await executeRiskAutoFixPlan(report, {
    retryQueueJobs: (ids) => calls.push(["retry", ids]),
    repairLegacyTimelineFromBusiness: () => calls.push(["repair"]),
    repairAssetConsistency: () => calls.push(["assets"]),
    syncTimelineFromShots: () => calls.push(["timeline"]),
  });

  assert.deepEqual(plan.map((item) => item.key), ["state", "provider", "asset"]);
  assert.equal(result.count, 3);
  assert.equal(result.ok, true);
  assert.equal(result.summary, "已处理 3 项最高风险。");
  assert.deepEqual(calls, [
    ["repair"],
    ["retry", ["job-1"]],
    ["assets"],
  ]);
});

test("risk auto fix summary reports partial failures", () => {
  assert.equal(summarizeRiskAutoFixResults([]), "没有可自动处理的风险。");
  assert.equal(summarizeRiskAutoFixResults([{ ok: true }, { ok: false }]), "已处理 1/2 项，1 项失败。");
});
