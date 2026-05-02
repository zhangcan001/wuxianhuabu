import assert from "node:assert/strict";
import test from "node:test";
import {
  applyTimelineRenderProgress,
  clearQueueState,
  createGenerationJobs,
  markNextPendingJobRunning,
  markQueueJobDone,
  markQueueJobFailed,
  removeQueueJobState,
  reprioritizeQueueJobState,
  recoverInterruptedQueueState,
  retryFailedJobsState,
  retryQueueJobState,
} from "../src/queue-state-helpers.js";

test("createGenerationJobs applies defaults and stable metadata", () => {
  const jobs = createGenerationJobs([
    { kind: "image", title: "A" },
    { kind: "exportVideo", progress: 10, priority: "高" },
  ], { now: () => 100, idSuffix: () => "abc" });

  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].id, "job-100-abc");
  assert.match(jobs[0].fingerprint, /^gen-/);
  assert.equal(jobs[0].status, "pending");
  assert.equal(jobs[0].priority, "中");
  assert.equal(jobs[0].progress, null);
  assert.equal(jobs[1].priority, "高");
  assert.equal(jobs[1].progress, 10);
});

test("recoverInterruptedQueueState restores running jobs after restart", () => {
  const result = recoverInterruptedQueueState([
    { id: "running", status: "running", kind: "video", progress: 60 },
    { id: "done", status: "done" },
  ], { now: () => 1200 });

  assert.equal(result.recovered, 1);
  assert.equal(result.queue[0].status, "pending");
  assert.equal(result.queue[0].resultSummary, "上次运行被中断，已恢复为可重试");
  assert.equal(result.queue[0].updatedAt, 1200);
});

test("clear and remove keep running jobs safe", () => {
  const queue = [
    { id: "a", status: "done" },
    { id: "b", status: "running" },
    { id: "c", status: "pending" },
  ];

  assert.deepEqual(clearQueueState(queue, { keepRunning: true }), [{ id: "b", status: "running" }]);
  assert.deepEqual(clearQueueState(queue), []);
  assert.deepEqual(removeQueueJobState(queue, "b"), queue);
  assert.deepEqual(removeQueueJobState(queue, "c"), queue.slice(0, 2));
});

test("retry helpers reset status and progress by job kind", () => {
  const queue = [
    { id: "img", status: "failed", kind: "image", error: "bad", resultSummary: "x", progress: 50 },
    { id: "vid", status: "failed", kind: "exportVideo", progress: 70 },
  ];

  const one = retryQueueJobState(queue, "vid", { now: () => 200 });
  assert.equal(one[1].status, "pending");
  assert.equal(one[1].progress, 0);
  assert.equal(one[1].updatedAt, 200);

  const all = retryFailedJobsState(queue, { now: () => 300 });
  assert.equal(all.matched, 2);
  assert.equal(all.queue[0].progress, null);
  assert.equal(all.queue[1].progress, 0);
});

test("retryFailedJobsState can target and patch export jobs", () => {
  const result = retryFailedJobsState([
    { id: "a", kind: "image", status: "failed" },
    { id: "b", kind: "exportVideo", status: "done" },
  ], {
    now: () => 400,
    predicate: (job) => job.kind === "exportVideo",
    patch: () => ({ resultSummary: "rerun" }),
  });

  assert.equal(result.matched, 1);
  assert.equal(result.queue[1].status, "pending");
  assert.equal(result.queue[1].resultSummary, "rerun");
});

test("reprioritize and progress updates only affect matching jobs", () => {
  const queue = [
    { id: "a", requestId: "r1", status: "running", priority: "低", progress: 0 },
    { id: "b", requestId: "r2", status: "pending", priority: "中", progress: 0 },
  ];

  assert.equal(reprioritizeQueueJobState(queue, "b", "高", { now: () => 500 })[1].priority, "高");

  const progress = applyTimelineRenderProgress(queue, { requestId: "r1", progress: 180, message: "rendering" }, { now: () => 600 });
  assert.equal(progress.changed, true);
  assert.equal(progress.queue[0].progress, 100);
  assert.equal(progress.queue[0].resultSummary, "rendering");
  assert.equal(progress.queue[1], queue[1]);

  assert.equal(applyTimelineRenderProgress(queue, { requestId: "" }).changed, false);
});

test("markNextPendingJobRunning selects by comparator and preserves selected payload", () => {
  const queue = [
    { id: "low", status: "pending", priority: "低", attempts: 0 },
    { id: "high", status: "pending", kind: "exportVideo", priority: "高", progress: null, attempts: 1 },
  ];
  const result = markNextPendingJobRunning(queue, (a, b) => (a.priority === "高" ? -1 : 1), { now: () => 700 });

  assert.equal(result.job.id, "high");
  assert.equal(result.queue[1].status, "running");
  assert.equal(result.queue[1].attempts, 2);
  assert.equal(result.queue[1].progress, 0);
  assert.equal(result.queue[1].resultSummary, "已进入导出队列");
});

test("done and failed markers update terminal job state", () => {
  const queue = [
    { id: "a", kind: "exportVideo", status: "running", progress: 40 },
    { id: "b", kind: "image", status: "running", progress: 20 },
  ];

  const done = markQueueJobDone(queue, "a", "ok", { now: () => 800 });
  assert.equal(done[0].status, "done");
  assert.equal(done[0].progress, 100);
  assert.equal(done[0].resultSummary, "ok");

  const failed = markQueueJobFailed(queue, "b", new Error("broken"), { now: () => 900 });
  assert.equal(failed[1].status, "failed");
  assert.equal(failed[1].resultSummary, "");
  assert.equal(failed[1].error, "broken");
});
