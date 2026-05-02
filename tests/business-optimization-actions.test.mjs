import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBusinessOptimizationExecutionPlan,
  businessOptimizationActionLabel,
  executeBusinessOptimizationAction,
  executeBusinessOptimizationPlan,
  summarizeBusinessOptimizationResults,
} from "../src/product/studio/business-optimization-actions.js";

test("business optimization plan picks unfinished top items in order", () => {
  const board = {
    topItems: [
      { key: "done", status: "done", actionKey: "dashboard", title: "完成项" },
      { key: "queue", status: "blocked", actionKey: "queue", title: "队列恢复", action: "打开队列" },
      { key: "assets", status: "blocked", actionKey: "assets", title: "资产定妆" },
      { key: "again", status: "blocked", actionKey: "queue", title: "另一个队列项" },
    ],
  };
  const plan = buildBusinessOptimizationExecutionPlan(board, { limit: 2 });

  assert.deepEqual(plan.map((item) => item.key), ["queue", "assets"]);
  assert.deepEqual(plan.map((item) => item.step), [1, 2]);
  assert.equal(plan[1].actionLabel, "进入资产库");
});

test("business optimization action dispatches view and command actions", async () => {
  const calls = [];
  await executeBusinessOptimizationAction(
    { actionKey: "assets" },
    {},
    { setActiveView: (view) => calls.push(["view", view]) },
  );
  await executeBusinessOptimizationAction(
    { actionKey: "syncTimeline" },
    { syncTimelineFromShots: () => calls.push(["sync"]) },
    {},
  );

  assert.deepEqual(calls, [["view", "assets"], ["sync"]]);
  assert.equal(businessOptimizationActionLabel({ actionKey: "generateImages" }), "补图/定妆");
});

test("business optimization plan execution summarizes partial failures", async () => {
  const board = {
    topItems: [
      { key: "queue", status: "blocked", actionKey: "queue", title: "队列恢复" },
      { key: "settings", status: "blocked", actionKey: "settings", title: "供应商设置" },
    ],
  };
  const result = await executeBusinessOptimizationPlan(board, {
    openQueue: () => "queue-opened",
    openSettings: () => {
      throw new Error("settings failed");
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.count, 2);
  assert.equal(result.summary, "已执行 1/2 项业务优化，1 项失败。");
  assert.equal(summarizeBusinessOptimizationResults([]), "没有可执行的业务优化项。");
});
