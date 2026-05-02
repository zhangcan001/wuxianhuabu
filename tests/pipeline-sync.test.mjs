import test from "node:test";
import assert from "node:assert/strict";
import {
  appendPipelineSyncAction,
  buildPipelineSyncExecutionPlan,
  buildPipelineSyncQueueMessage,
  buildPipelineSyncTracePayload,
} from "../src/domain/pipeline-sync.js";

test("pipeline sync execution plan carries queue and timeline flags", () => {
  const plan = buildPipelineSyncExecutionPlan({
    assetTarget: { id: "asset-node" },
    assetPatch: { characters: [{ name: "林舟" }] },
    hasAssets: true,
    shotTarget: null,
    shotPatch: { shots: [{ id: "S01" }] },
    hasShots: true,
    options: {
      autoQueueAssets: false,
      autoQueueShots: true,
      syncTimeline: true,
    },
  });

  assert.equal(plan.asset.mode, "updated");
  assert.equal(plan.asset.shouldQueueImages, false);
  assert.equal(plan.shot.mode, "created");
  assert.equal(plan.shot.shouldSyncTimeline, true);
  assert.equal(plan.shot.shouldQueueImages, true);
});

test("pipeline sync only queues asset images from explicit asset option", () => {
  const plan = buildPipelineSyncExecutionPlan({
    assetTarget: { id: "asset-node" },
    assetPatch: { characters: [{ name: "林舟" }] },
    hasAssets: true,
    options: {
      autoQueueAssets: true,
      autoQueueShots: false,
    },
  });

  assert.equal(plan.asset.shouldQueueImages, true);
});

test("pipeline sync execution plan can stop at assets", () => {
  const plan = buildPipelineSyncExecutionPlan({
    assetTarget: null,
    assetPatch: { props: [{ name: "钥匙" }] },
    hasAssets: true,
    shotTarget: { id: "shot-node" },
    shotPatch: { shots: [{ id: "S01" }] },
    hasShots: true,
    options: {
      assetOnly: true,
      autoQueueAssets: true,
      syncTimeline: true,
    },
  });

  assert.equal(plan.asset.mode, "created");
  assert.equal(plan.asset.shouldQueueImages, true);
  assert.equal(plan.shot, null);
});

test("pipeline sync messages and trace payload stay compact", () => {
  assert.equal(buildPipelineSyncQueueMessage("asset", 2), "资产图片队列已入队 2");
  assert.equal(buildPipelineSyncQueueMessage("shot", 3), "图片队列已入队 3");
  assert.equal(buildPipelineSyncQueueMessage("shot", 0), "");
  assert.deepEqual(appendPipelineSyncAction(["资产库已同步"], ""), ["资产库已同步"]);
  assert.deepEqual(appendPipelineSyncAction(["资产库已同步"], "时间线已同步"), ["资产库已同步", "时间线已同步"]);

  const trace = buildPipelineSyncTracePayload("source", {
    asset: { mode: "updated" },
    shot: { mode: "created" },
  }, ["资产库已同步"], {
    syncTimeline: true,
  });

  assert.deepEqual(trace, {
    sourceId: "source",
    actions: ["资产库已同步"],
    syncTimeline: true,
    assetMode: "updated",
    shotMode: "created",
  });
});
