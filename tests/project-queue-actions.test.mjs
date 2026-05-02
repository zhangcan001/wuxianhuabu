import assert from "node:assert/strict";
import test from "node:test";
import {
  clearFinishedJobsAction,
  clearFinishedQueueJobs,
  clearGenerationQueueAction,
  removeQueueJobAction,
  reprioritizeJobAction,
  retryExportJobsAction,
  retryFailedJobsAction,
  retryFailedShotJobsAction,
  retryQueueJobsAction,
} from "../src/app/project-queue-actions.js";

function applyState(initial) {
  let state = initial;
  return {
    get state() {
      return state;
    },
    setState(updater) {
      state = typeof updater === "function" ? updater(state) : updater;
    },
  };
}

test("queue clear actions preserve running jobs when requested", () => {
  const queue = [
    { id: "pending", status: "pending" },
    { id: "running", status: "running" },
    { id: "done", status: "done" },
    { id: "failed", status: "failed" },
  ];

  assert.deepEqual(clearFinishedQueueJobs(queue).map((job) => job.id), ["pending", "running"]);

  const store = applyState(queue);
  clearGenerationQueueAction({ setGenerationQueue: store.setState, queueRunning: true });
  assert.deepEqual(store.state.map((job) => job.id), ["running"]);

  clearFinishedJobsAction({ setGenerationQueue: store.setState });
  assert.deepEqual(store.state.map((job) => job.id), ["running"]);
});

test("remove queue job keeps running jobs", () => {
  const store = applyState([
    { id: "a", status: "pending" },
    { id: "b", status: "running" },
  ]);

  removeQueueJobAction({ jobId: "b", setGenerationQueue: store.setState });
  assert.deepEqual(store.state.map((job) => job.id), ["a", "b"]);

  removeQueueJobAction({ jobId: "a", setGenerationQueue: store.setState });
  assert.deepEqual(store.state.map((job) => job.id), ["b"]);
});

test("retry queue jobs dedupes ids and reports empty selection", () => {
  const messages = [];
  const store = applyState([
    { id: "a", status: "failed", error: "x", resultSummary: "bad" },
    { id: "b", status: "done" },
  ]);

  const empty = retryQueueJobsAction({
    jobIds: [],
    setGenerationQueue: store.setState,
    setProjectMessage: (message) => messages.push(message),
  });
  assert.equal(empty.matched, 0);
  assert.equal(messages[0], "没有可重试的任务。");

  const result = retryQueueJobsAction({
    jobIds: ["a", "a"],
    setGenerationQueue: store.setState,
    setProjectMessage: (message) => messages.push(message),
  });
  assert.equal(result.matched, 1);
  assert.equal(store.state[0].status, "pending");
  assert.equal(store.state[0].error, "");
  assert.equal(messages.at(-1), "已重试 1 个失败任务");
});

test("retry failed shot jobs excludes export video jobs", () => {
  const messages = [];
  let showQueue = false;
  const store = applyState([
    { id: "image", kind: "image", status: "failed", error: "x" },
    { id: "export", kind: "exportVideo", status: "failed", error: "x" },
  ]);

  const result = retryFailedShotJobsAction({
    setGenerationQueue: store.setState,
    setShowQueue: (value) => {
      showQueue = value;
    },
    setProjectMessage: (message) => messages.push(message),
  });

  assert.equal(result.matched, 1);
  assert.equal(showQueue, true);
  assert.equal(store.state[0].status, "pending");
  assert.equal(store.state[1].status, "failed");
  assert.equal(messages[0], "已重试 1 个失败镜头任务");
});

test("retry failed jobs and reprioritize job update queue state", () => {
  const messages = [];
  const store = applyState([
    { id: "a", status: "failed", error: "x", priority: "低" },
    { id: "b", status: "done", priority: "低" },
  ]);

  retryFailedJobsAction({
    setGenerationQueue: store.setState,
    setProjectMessage: (message) => messages.push(message),
  });
  reprioritizeJobAction({
    jobId: "b",
    priority: "高",
    setGenerationQueue: store.setState,
  });

  assert.equal(store.state[0].status, "pending");
  assert.equal(store.state[1].priority, "高");
  assert.equal(messages[0], "已重试 1 个失败任务");
});

test("retry export jobs supports failed-only and all scopes", () => {
  const messages = [];
  let showQueue = false;
  const store = applyState([
    { id: "export-a", kind: "exportVideo", status: "failed", resultSummary: "bad" },
    { id: "export-b", kind: "exportVideo", status: "done", resultSummary: "done" },
    { id: "image", kind: "image", status: "failed" },
  ]);

  const failed = retryExportJobsAction({
    scope: "failed",
    setGenerationQueue: store.setState,
    setShowQueue: (value) => {
      showQueue = value;
    },
    setProjectMessage: (message) => messages.push(message),
  });
  assert.equal(failed.matched, 1);
  assert.equal(store.state[0].status, "pending");
  assert.equal(store.state[0].resultSummary, "已重新排队，等待导出");
  assert.equal(showQueue, true);

  const all = retryExportJobsAction({
    scope: "all",
    setGenerationQueue: store.setState,
    setShowQueue: () => {},
    setProjectMessage: (message) => messages.push(message),
  });
  assert.equal(all.matched, 2);
  assert.equal(store.state[1].status, "pending");
  assert.equal(store.state[1].resultSummary, "已批量重跑，等待导出");
});
