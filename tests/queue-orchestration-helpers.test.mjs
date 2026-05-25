import assert from "node:assert/strict";
import test from "node:test";
import {
  switchQueueProvider,
  skipQueueJobs,
} from "../src/queue-state-helpers.js";

test("switchQueueProvider returns matched 0 when ids or provider are empty", () => {
  const queue = [{ id: "j1", status: "failed" }];
  assert.deepEqual(switchQueueProvider(queue, [], "comfy"), { queue, matched: 0 });
  assert.deepEqual(switchQueueProvider(queue, ["j1"], ""), { queue, matched: 0 });
});

test("switchQueueProvider resets matched jobs and routes provider by job kind", () => {
  const queue = [
    { id: "j1", status: "failed", kind: "image", imageProviderMode: "old", videoProviderMode: "x" },
    { id: "j2", status: "failed", type: "shot.video", videoProviderMode: "old", imageProviderMode: "y" },
    { id: "j3", status: "done", kind: "image" },
  ];
  const result = switchQueueProvider(queue, ["j1", "j2"], "comfy", { now: () => 5000 });
  assert.equal(result.matched, 2);
  assert.equal(result.provider, "comfy");
  assert.equal(result.queue[0].providerMode, "comfy");
  assert.equal(result.queue[0].imageProviderMode, "comfy");
  assert.equal(result.queue[0].videoProviderMode, "x");
  assert.equal(result.queue[0].status, "pending");
  assert.equal(result.queue[0].updatedAt, 5000);
  assert.equal(result.queue[1].videoProviderMode, "comfy");
  assert.equal(result.queue[1].imageProviderMode, "y");
  assert.equal(result.queue[2].status, "done");
});

test("switchQueueProvider maps 'custom' provider to 'api' providerMode but keeps label", () => {
  const queue = [{ id: "j1", status: "failed", kind: "image" }];
  const result = switchQueueProvider(queue, ["j1"], "custom");
  assert.equal(result.queue[0].providerMode, "api");
  assert.equal(result.provider, "custom");
  assert.ok(result.queue[0].resultSummary.includes("custom"));
});

test("switchQueueProvider returns the original queue reference when nothing matches", () => {
  const queue = [{ id: "j1", status: "failed", kind: "image" }];
  const result = switchQueueProvider(queue, ["missing"], "comfy");
  assert.equal(result.queue, queue);
  assert.equal(result.matched, 0);
});

test("skipQueueJobs returns matched 0 when ids is empty", () => {
  const queue = [{ id: "j1" }];
  assert.deepEqual(skipQueueJobs(queue, []), { queue, matched: 0 });
});

test("skipQueueJobs marks matched jobs as cancelled and clears progress", () => {
  const queue = [
    { id: "j1", status: "failed", progress: 50, error: "boom" },
    { id: "j2", status: "running", progress: 80, error: "" },
  ];
  const result = skipQueueJobs(queue, ["j1", "j2"], { now: () => 7000 });
  assert.equal(result.matched, 2);
  assert.deepEqual(result.queue.map((job) => job.status), ["cancelled", "cancelled"]);
  assert.deepEqual(result.queue.map((job) => job.progress), [null, null]);
  assert.deepEqual(result.queue.map((job) => job.error), ["", ""]);
  assert.equal(result.queue[0].updatedAt, 7000);
  assert.ok(result.queue[0].resultSummary.includes("已跳过"));
});

test("skipQueueJobs returns the original queue reference when no ids match", () => {
  const queue = [{ id: "j1", status: "running" }];
  const result = skipQueueJobs(queue, ["other"]);
  assert.equal(result.queue, queue);
  assert.equal(result.matched, 0);
});
