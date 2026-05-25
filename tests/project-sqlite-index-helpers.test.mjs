import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMediaIndexItems,
  buildNodeIndexItems,
  buildProjectIndexPayload,
  buildResourceIndexItems,
  buildShotIndexItems,
  buildTaskIndexItems,
  buildTimelineClipIndexItems,
} from "../src/storage/project-sqlite-index-helpers.js";

test("buildResourceIndexItems keeps stable resource fields", () => {
  const items = buildResourceIndexItems([
    { id: "res-1", name: "主角", kind: "image", token: "@hero", episodeId: "ep-1", filePath: "C:/media/hero.png", thumbnailPath: "C:/media/thumb.png", updatedAt: 10 },
    { name: "missing id" },
  ]);

  assert.deepEqual(items, [{
    id: "res-1",
    name: "主角",
    kind: "image",
    token: "@hero",
    episodeId: "ep-1",
    filePath: "C:/media/hero.png",
    thumbnailPath: "C:/media/thumb.png",
    updatedAt: 10,
  }]);
});

test("buildTaskIndexItems maps queue jobs into compact rows", () => {
  const items = buildTaskIndexItems([
    { id: "job-1", kind: "image", status: "done", episodeId: "ep-1", sourceNodeId: "node-1", createdAt: 20 },
  ]);

  assert.equal(items[0].id, "job-1");
  assert.equal(items[0].nodeId, "node-1");
  assert.equal(items[0].updatedAt, 20);
});

test("buildMediaIndexItems separates referenced and orphan media", () => {
  const items = buildMediaIndexItems({
    referencedFiles: [{ path: "C:/media/a.png", fileName: "a.png", size: 1, references: [{ path: "project.nodes[0].data.imagePath", value: "C:/media/a.png" }] }],
    orphanFiles: [{ path: "C:/media/b.png", fileName: "b.png", size: 2, reviewDecision: "keep" }],
  });

  assert.equal(items.length, 2);
  assert.equal(items[0].referenced, true);
  assert.equal(items[1].referenced, false);
  assert.equal(items[1].reviewDecision, "keep");
});

test("node shot and timeline clip index items preserve navigation keys", () => {
  const nodes = [
    { id: "node-1", type: "shotList", data: { episodeId: "ep-1", shots: [{ id: "A01", scene: "巷口", action: "奔跑", imagePrompt: "wide shot" }] } },
    { id: "node-2", type: "text", data: { displayName: "备注", text: "hello" }, x: 10, y: 20 },
  ];
  const timeline = { byEpisode: { "ep-1": { clips: [{ id: "clip-1", sourceNodeId: "node-1", shotId: "A01", title: "巷口奔跑", mediaUrl: "C:/media/a.mp4" }] } } };

  assert.equal(buildNodeIndexItems(nodes).length, 2);
  assert.equal(buildShotIndexItems(nodes, "ep-fallback")[0].sourceNodeId, "node-1");
  assert.equal(buildTimelineClipIndexItems(timeline)[0].shotId, "A01");
});

test("buildProjectIndexPayload packages resources tasks and media", () => {
  const payload = buildProjectIndexPayload({
    activeEpisodeId: "ep-1",
    nodes: [{ id: "node-1", type: "text", data: { text: "hello" } }],
    timeline: { byEpisode: { "ep-1": { clips: [{ id: "clip-1", title: "clip" }] } } },
    resources: [{ id: "res-1", kind: "image" }],
    generationQueue: [{ id: "job-1", status: "pending" }],
  }, {
    orphanFiles: [{ path: "C:/media/orphan.png", fileName: "orphan.png" }],
  }, {
    projectPath: "C:/project/demo.json",
    indexedAt: "2026-04-23T00:00:00.000Z",
    deletionAudit: [{ deletedAt: "2026-04-23T01:00:00.000Z" }],
  });

  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.nodes.length, 1);
  assert.equal(payload.timelineClips.length, 1);
  assert.equal(payload.resources.length, 1);
  assert.equal(payload.tasks.length, 1);
  assert.equal(payload.mediaFiles.length, 1);
  assert.equal(payload.deletionAudit.length, 1);
});
