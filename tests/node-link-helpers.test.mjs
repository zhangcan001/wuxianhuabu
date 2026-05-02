import assert from "node:assert/strict";
import test from "node:test";
import {
  appendLinkedEdge,
  buildManyOutputPlans,
  buildLinkedTimelineShots,
  buildNodeSyncOutcome,
  buildPipelineSyncPlan,
  buildCreateOutputPayload,
  buildOutputNodePlacement,
  buildResultShotActionLabel,
  findResultNodeForShot,
  linkedNodeLabel,
  planPipelineNodeSync,
  planShotListAppend,
} from "../src/node-link-helpers.js";

test("output node placement follows source node or viewport center", () => {
  assert.deepEqual(
    buildOutputNodePlacement({ x: 10, y: 20, width: 200 }, { x: 1, y: 2 }, { offsetX: 5, offsetY: 8 }),
    { x: 345, y: 48 }
  );
  assert.deepEqual(
    buildOutputNodePlacement(null, { x: 50, y: 60 }),
    { x: 50, y: 60 }
  );
});

test("append linked edge skips duplicates and invalid pairs", () => {
  const edges = [{ id: "edge-a-b", source: "a", target: "b" }];
  assert.equal(appendLinkedEdge(edges, "a", "b"), edges);
  assert.deepEqual(
    appendLinkedEdge([], "a", "c", () => 123),
    [{ id: "edge-a-c-123", source: "a", target: "c" }]
  );
  assert.deepEqual(appendLinkedEdge([], "a", "a"), []);
});

test("create output payload keeps episode id and strips offset markers", () => {
  const result = buildCreateOutputPayload(
    { x: 0, y: 0, width: 100, data: { episodeId: "episode-2" } },
    { x: 9, y: 9 },
    "episode-1",
    "result",
    "结果节点",
    { imageUrl: "demo", __offsetX: 7 }
  );
  assert.equal(result.type, "result");
  assert.deepEqual(result.position, { x: 237, y: 20 });
  assert.deepEqual(result.payload, {
    displayName: "结果节点",
    imageUrl: "demo",
    episodeId: "episode-2",
  });
});

test("linked node label and shot append planner stay predictable", () => {
  assert.equal(linkedNodeLabel("upload"), "上传图片");
  assert.equal(linkedNodeLabel("vr360"), "VR360 全景场景");
  assert.equal(linkedNodeLabel("other"), "联动节点");

  const plan = planShotListAppend({ data: { shots: [{ id: "S01" }] } }, [null, { id: "S02" }]);
  assert.deepEqual(plan.currentShots, [{ id: "S01" }]);
  assert.deepEqual(plan.normalizedDrafts, [{ id: "S02" }]);
  assert.equal(planShotListAppend(null, []), null);
});

test("pipeline sync planning distinguishes update and create", () => {
  assert.deepEqual(
    planPipelineNodeSync({ id: "node-2" }, "assetLibrary", { a: 1 }, "资产库"),
    {
      mode: "updated",
      targetId: "node-2",
      targetType: "assetLibrary",
      patch: { a: 1 },
      message: "资产库已同步",
    }
  );
  assert.deepEqual(
    buildPipelineSyncPlan({
      assetTarget: null,
      assetPatch: { a: 1 },
      hasAssets: true,
      shotTarget: { id: "node-3" },
      shotPatch: { shots: [] },
      hasShots: true,
    }),
    {
      asset: {
        mode: "created",
        targetId: "",
        targetType: "assetLibrary",
        patch: { a: 1 },
        message: "已创建资产库",
      },
      shot: {
        mode: "updated",
        targetId: "node-3",
        targetType: "shotList",
        patch: { shots: [] },
        message: "镜头表已同步",
      },
    }
  );
});

test("linked timeline shots reuse one resource index and preserve source node id", () => {
  const calls = [];
  const result = buildLinkedTimelineShots({
    shots: [{ id: "S01" }, { id: "S02" }],
    shotNodeId: "node-shot",
    sourceEpisodeId: "episode-1",
    nodes: [{ id: "n1" }],
    resources: [{ id: "r1" }],
    episodes: [{ id: "episode-1" }],
    normalizeShotRecord: (shot, index) => ({ ...shot, normalized: index + 1 }),
    buildTimelineSourceFromShotRecord: (input) => {
      calls.push(input.resourceIndex);
      return { clipId: input.shot.id, mediaUrl: `media-${input.shot.normalized}` };
    },
    buildProjectResourceIndex: () => ({ built: true }),
    pickTimelineResultUrl: () => "",
    expandResourceReferences: () => "",
  });
  assert.deepEqual(result, [
    { clipId: "S01", mediaUrl: "media-1", sourceNodeId: "node-shot" },
    { clipId: "S02", mediaUrl: "media-2", sourceNodeId: "node-shot" },
  ]);
  assert.deepEqual(calls, [{ built: true }, { built: true }]);
});

test("node sync helpers build outcomes, labels, and locate result nodes", () => {
  assert.deepEqual(
    buildNodeSyncOutcome("updated", "node-1", { count: 2 }),
    { mode: "updated", targetId: "node-1", count: 2 }
  );
  assert.equal(buildResultShotActionLabel("confirm"), "已采用并确认");
  assert.equal(buildResultShotActionLabel("other"), "已更新");
  const target = findResultNodeForShot([
    { id: "a", type: "result", y: 10, data: { episodeId: "episode-1", targetShotId: "S01", adoptionUpdatedAt: 1 } },
    { id: "b", type: "result", y: 20, data: { episodeId: "episode-1", note: "镜头 S01", adoptionUpdatedAt: 3 } },
    { id: "c", type: "result", y: 30, data: { episodeId: "episode-2", targetShotId: "S01", adoptionUpdatedAt: 9 } },
  ], "S01", "episode-1");
  assert.equal(target.id, "b");
});

test("many output planner creates stable node and edge batches", () => {
  const plan = buildManyOutputPlans({
    sourceNode: { id: "source-1", x: 10, y: 20, width: 100, data: { episodeId: "episode-2" } },
    outputs: [{ imageUrl: "a" }, { imageUrl: "b" }],
    activeEpisodeId: "episode-1",
    nextNodeId: 5,
    createNode: (type, id, position, data) => ({ type, id, x: position.x, y: position.y, data }),
    now: () => 123,
  });
  assert.deepEqual(plan.ids, ["node-5", "node-6"]);
  assert.equal(plan.nextNodeId, 7);
  assert.deepEqual(plan.createdEdges, [
    { id: "edge-source-1-node-5-123-0", source: "source-1", target: "node-5" },
    { id: "edge-source-1-node-6-123-1", source: "source-1", target: "node-6" },
  ]);
  assert.deepEqual(plan.createdNodes.map((node) => node.data.episodeId), ["episode-2", "episode-2"]);
});
