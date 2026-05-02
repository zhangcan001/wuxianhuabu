import assert from "node:assert/strict";
import test from "node:test";
import {
  computeRedoState,
  computeUndoState,
  createEditorSnapshot,
  normalizeRestoredSnapshot,
  pushHistoryState,
  structuredCloneSafe,
} from "../src/history-helpers.js";

test("structured clone helper copies nested values", () => {
  const source = { a: { b: 1 }, list: [1, 2] };
  const clone = structuredCloneSafe(source);
  clone.a.b = 9;
  clone.list.push(3);
  assert.equal(source.a.b, 1);
  assert.deepEqual(source.list, [1, 2]);
});

test("create editor snapshot clones state payload", () => {
  const source = {
    nodes: [{ id: "node-1" }],
    edges: [],
    view: { x: 1, y: 2, scale: 1 },
    resources: [{ id: "r1" }],
    timeline: { clips: [] },
    promptFactory: { a: 1 },
    templateCenter: { a: 1 },
    stylePresetCenter: { a: 1 },
    modelParamCenter: { a: 1 },
    collaborationState: { a: 1 },
    archiveState: { a: 1 },
    performanceSettings: { mode: "fast" },
    businessProject: { id: "p1" },
    productionEvents: [{ type: "x" }],
    episodes: [{ id: "episode-1" }],
    activeEpisodeId: "episode-1",
  };
  const snapshot = createEditorSnapshot(source);
  snapshot.nodes[0].id = "changed";
  snapshot.businessProject.id = "changed";
  assert.equal(source.nodes[0].id, "node-1");
  assert.equal(source.businessProject.id, "p1");
});

test("push history trims old snapshots and clears future", () => {
  const history = {
    past: Array.from({ length: 50 }, (_, index) => ({ id: index })),
    future: [{ id: "future" }],
  };
  const next = pushHistoryState(history, { id: "new" });
  assert.equal(next.past.length, 50);
  assert.equal(next.past[0].id, 1);
  assert.deepEqual(next.future, []);
});

test("undo and redo compute restored snapshot and updated stacks", () => {
  const history = {
    past: [{ id: "a" }, { id: "b" }],
    future: [{ id: "future-a" }],
  };
  const undo = computeUndoState(history, { id: "current" });
  assert.deepEqual(undo.snapshotToRestore, { id: "b" });
  assert.deepEqual(undo.history.past, [{ id: "a" }]);
  assert.deepEqual(undo.history.future, [{ id: "current" }, { id: "future-a" }]);

  const redo = computeRedoState(undo.history, { id: "after-undo" });
  assert.deepEqual(redo.snapshotToRestore, { id: "current" });
  assert.deepEqual(redo.history.past, [{ id: "a" }, { id: "after-undo" }]);
  assert.deepEqual(redo.history.future, [{ id: "future-a" }]);
});

test("normalize restored snapshot reapplies defaults and normalizers", () => {
  const result = normalizeRestoredSnapshot({
    nodes: [{ id: "node-3" }],
    edges: [],
    view: { x: 0, y: 0, scale: 1 },
    resources: null,
    timeline: { raw: true },
    promptFactory: null,
    templateCenter: null,
    stylePresetCenter: null,
    modelParamCenter: null,
    collaborationState: null,
    archiveState: null,
    performanceSettings: null,
    businessProject: { id: "p1" },
    productionEvents: [{ type: "production.event" }],
    episodes: null,
    activeEpisodeId: "",
  }, {
    normalizeTimelineState: (value, episodeId) => ({ value, episodeId }),
    normalizePromptFactoryState: (value) => ({ promptFactory: value ?? "default" }),
    normalizeTemplateCenterState: (value) => ({ templateCenter: value ?? "default" }),
    normalizeStylePresetCenterState: (value) => ({ stylePresetCenter: value ?? "default" }),
    normalizeModelParamCenterState: (value) => ({ modelParamCenter: value ?? "default" }),
    normalizeCollaborationState: (value) => ({ collaborationState: value ?? "default" }),
    normalizeArchiveState: (value) => ({ archiveState: value ?? "default" }),
    normalizePerformanceSettings: (value) => ({ performanceSettings: value ?? "default" }),
    defaultEpisodes: () => [{ id: "episode-1" }],
    inferNextNodeId: () => 4,
  });
  assert.deepEqual(result.resources, []);
  assert.deepEqual(result.episodes, [{ id: "episode-1" }]);
  assert.equal(result.activeEpisodeId, "episode-1");
  assert.equal(result.nextNodeId, 4);
  assert.equal(result.businessProject.id, "p1");
  assert.equal(result.productionEvents.length, 1);
  assert.deepEqual(result.timeline, { value: { raw: true }, episodeId: "episode-1" });
});
