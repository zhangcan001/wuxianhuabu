import test from "node:test";
import assert from "node:assert/strict";
import {
  commitProductionPlanQueueJobs,
  queueEpisodeMediaAction,
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

test("queueEpisodeMediaAction commits production plan jobs before legacy fallback", async () => {
  const calls = [];
  const result = await queueEpisodeMediaAction({
    mediaKind: "video",
    providerMode: "api",
    options: { autoRun: false },
    checkPreflight: () => ({ ok: true }),
    ensureProviderReady: async () => true,
    planProductionJobs: () => ({ jobs: [{ id: "job-1" }] }),
    productionCommandContext: { id: "ctx" },
    commitPlannedQueueJobs: (context, plan, options) => calls.push(["commit", context.id, plan.jobs.length, options.autoRun]),
    setShowQueue: (value) => calls.push(["queue", value]),
    buildLegacyJobs: () => {
      calls.push(["legacy"]);
      return {};
    },
  });

  assert.equal(result.title, "视频任务已入队");
  assert.deepEqual(calls, [
    ["commit", "ctx", 1, false],
    ["queue", true],
  ]);
});

test("queueEpisodeMediaAction falls back to legacy command jobs", async () => {
  const calls = [];
  const result = await queueEpisodeMediaAction({
    mediaKind: "image",
    providerMode: "api",
    options: {},
    checkPreflight: () => ({ ok: true }),
    ensureProviderReady: async () => true,
    planProductionJobs: () => ({ jobs: [] }),
    buildLegacyJobs: () => ({ jobs: [{ id: "legacy-1" }], entries: [1] }),
    prepareCommand: ({ jobs }) => ({
      ok: true,
      jobs,
      message: "legacy ready",
      result: { title: "legacy queued" },
    }),
    addGenerationJobsAndMaybeRun: (jobs, options) => calls.push(["legacy", jobs.length, options.autoRun]),
    setShowQueue: (value) => calls.push(["queue", value]),
    setProjectMessage: (message) => calls.push(["message", message]),
  });

  assert.deepEqual(result, { title: "legacy queued" });
  assert.deepEqual(calls, [
    ["legacy", 1, true],
    ["queue", true],
    ["message", "legacy ready"],
  ]);
});

test("queueEpisodeMediaAction reports upload mode as manual work", async () => {
  const messages = [];
  const result = await queueEpisodeMediaAction({
    mediaKind: "image",
    providerMode: "upload",
    checkPreflight: () => ({ ok: true }),
    ensureProviderReady: async () => true,
    uploadSummary: "请选择本地图片。",
    setProjectMessage: (message) => messages.push(message),
  });

  assert.deepEqual(result, { title: "等待上传", summary: "请选择本地图片。" });
  assert.deepEqual(messages, ["请选择本地图片。"]);
});
