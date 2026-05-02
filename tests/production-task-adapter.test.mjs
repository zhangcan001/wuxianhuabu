import assert from "node:assert/strict";
import test from "node:test";
import {
  productionTasksToLegacyGenerationJobs,
} from "../src/adapters/legacy-canvas/production-task-adapter.js";

test("production task adapter maps asset and shot tasks to legacy queue jobs", () => {
  const jobs = productionTasksToLegacyGenerationJobs([
    {
      id: "asset-image:ep-1:asset-1",
      type: "asset.image",
      target: { type: "asset", id: "asset-1", assetType: "character" },
      priority: "high",
      provider: "custom",
      input: { prompt: "红衣角色定妆", token: "@角色_林舟" },
    },
    {
      id: "shot-image:ep-1:S01",
      type: "shot.image",
      target: { type: "shot", id: "S01" },
      input: { prompt: "雨夜车站首帧", assetRefs: ["@角色_林舟"] },
    },
    {
      id: "shot-video:ep-1:S01",
      type: "shot.video",
      target: { type: "shot", id: "S01" },
      input: { prompt: "镜头推进", assetRefs: ["@角色_林舟"], mainCharacterToken: "@角色_林舟" },
    },
  ]);

  assert.equal(jobs.length, 3);
  assert.equal(jobs[0].kind, "image");
  assert.equal(jobs[0].assetCategory, "角色");
  assert.equal(jobs[0].sourceAssetToken, "@角色_林舟");
  assert.equal(jobs[0].priority, "高");
  assert.equal(jobs[1].shotId, "S01");
  assert.deepEqual(jobs[1].assetRefs, ["@角色_林舟"]);
  assert.equal(jobs[2].kind, "video");
  assert.equal(jobs[2].sourceNodeId, "episode-ep-1-shots");
  assert.deepEqual(jobs[2].assetRefs, ["@角色_林舟"]);
  assert.equal(jobs[2].mainCharacterToken, "@角色_林舟");
});

test("production task adapter does not queue manual upload image tasks", () => {
  const jobs = productionTasksToLegacyGenerationJobs([{
    id: "shot-image:ep-1:S01",
    type: "shot.image",
    provider: "upload",
    status: "waiting-upload",
    target: { type: "shot", id: "S01" },
    input: { prompt: "manual", sourceMode: "upload" },
  }]);

  assert.deepEqual(jobs, []);
});

test("production task adapter does not queue manual upload video tasks", () => {
  const jobs = productionTasksToLegacyGenerationJobs([{
    id: "shot-video:ep-1:S01",
    type: "shot.video",
    provider: "upload",
    status: "waiting-upload",
    target: { type: "shot", id: "S01" },
    input: { prompt: "manual", sourceMode: "upload" },
  }]);

  assert.deepEqual(jobs, []);
});
