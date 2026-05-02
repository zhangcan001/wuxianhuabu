import test from "node:test";
import assert from "node:assert/strict";
import {
  commitProductionPlanQueueJobs,
} from "../src/app/production-media-queue-actions.js";

test("commitProductionPlanQueueJobs commits image jobs and opens queue", () => {
  const calls = [];
  const result = commitProductionPlanQueueJobs({
    productionCommandContext: { id: "ctx" },
    productionPlan: { events: ["planned"] },
    jobs: [{ id: "job-1" }, { id: "job-2" }],
    options: { autoRun: true },
    commitPlannedQueueJobs: (context, plan, options) => calls.push(["commit", context.id, plan.jobs.length, options.message, options.autoRun]),
    setShowQueue: (value) => calls.push(["queue", value]),
    mediaKind: "image",
  });

  assert.deepEqual(result, {
    title: "图片任务已入队",
    summary: "已按 Production OS 任务图加入 2 个图片任务。",
    metrics: [{ label: "图片任务", value: 2 }],
  });
  assert.deepEqual(calls, [
    ["commit", "ctx", 2, "Production OS 已加入图片队列：2 个任务", true],
    ["queue", true],
  ]);
});

test("commitProductionPlanQueueJobs returns null for empty jobs", () => {
  assert.equal(commitProductionPlanQueueJobs({ jobs: [] }), null);
});
