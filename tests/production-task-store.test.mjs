import assert from "node:assert/strict";
import test from "node:test";
import {
  createProductionTaskStore,
  normalizeProductionTask,
  productionTasksToQueueJobs,
  summarizeProductionTasks,
} from "../src/app/production-task-store.js";

test("production task store normalizes legacy jobs into business-addressed tasks", () => {
  const task = normalizeProductionTask({
    kind: "image",
    episodeId: "e1",
    shotId: "S01",
    prompt: "雨夜车站",
    status: "queued",
  });

  assert.equal(task.type, "shot.image");
  assert.equal(task.targetType, "shot");
  assert.equal(task.targetId, "S01");
  assert.equal(task.status, "pending");
  assert.equal(task.id, "shot.image:e1:shot:S01");
});

test("production task store indexes tasks by target and summarizes states", () => {
  const store = createProductionTaskStore({
    tasks: [
      { type: "shot.image", episodeId: "e1", targetType: "shot", targetId: "S01", status: "running" },
      { type: "shot.video", episodeId: "e1", targetType: "shot", targetId: "S01", status: "failed" },
      { type: "asset.image", episodeId: "e1", targetType: "asset", targetId: "@角色_林舟", status: "success" },
    ],
  });

  assert.equal(store.summary.total, 3);
  assert.equal(store.summary.running, 1);
  assert.equal(store.summary.failed, 1);
  assert.equal(store.summary.done, 1);
  assert.equal(store.byTarget.get("e1:shot:S01").length, 2);
});

test("production tasks still materialize to queue jobs for the legacy runner", () => {
  const jobs = productionTasksToQueueJobs([
    {
      id: "shot-video:e1:S01",
      type: "shot.video",
      target: { type: "shot", id: "S01" },
      provider: "comfy",
      input: { prompt: "推进", assetRefs: ["@角色_林舟"], mainCharacterToken: "@角色_林舟" },
    },
  ], { videoProvider: "comfy" });
  const summary = summarizeProductionTasks(jobs);

  assert.equal(jobs[0].kind, "video");
  assert.equal(jobs[0].episodeId, "e1");
  assert.equal(jobs[0].shotId, "S01");
  assert.equal(jobs[0].targetId, "S01");
  assert.equal(jobs[0].sourceNodeId, "episode-e1-shots");
  assert.equal(jobs[0].prompt, "推进");
  assert.deepEqual(jobs[0].assetRefs, ["@角色_林舟"]);
  assert.equal(jobs[0].mainCharacterToken, "@角色_林舟");
  assert.equal(jobs[0].videoProviderMode, "comfy");
  assert.equal(jobs[0].status, "pending");
  assert.equal(summary.byType["shot.video"], 1);
});

test("production image tasks keep prompt and business address for queue result writeback", () => {
  const [job] = productionTasksToQueueJobs([
    {
      id: "shot-image:ep-1:S02",
      type: "shot.image",
      target: { type: "shot", id: "S02" },
      provider: "custom",
      input: { prompt: "镜头 S02 的独立提示词" },
    },
  ], { providerMode: "custom" });

  assert.equal(job.kind, "image");
  assert.equal(job.episodeId, "ep-1");
  assert.equal(job.shotId, "S02");
  assert.equal(job.prompt, "镜头 S02 的独立提示词");
  assert.equal(job.imageProviderMode, "custom");
  assert.equal(job.sourceNodeId, "episode-ep-1-shots");
});
