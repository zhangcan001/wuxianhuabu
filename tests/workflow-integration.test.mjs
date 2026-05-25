import assert from "node:assert/strict";
import test from "node:test";
import { emitDebugTrace } from "../src/debug-trace-helpers.js";
import {
  computeUndoState,
  createEditorSnapshot,
  pushHistoryState,
} from "../src/history-helpers.js";
import {
  buildLinkedTimelineShots,
  buildPipelineSyncPlan,
} from "../src/node-link-helpers.js";
import {
  openRecentProjectPath,
  parseProjectContent,
} from "../src/storage/project-file-helpers.js";
import { buildAppliedProjectState } from "../src/project-state-helpers.js";

test("recent project open flow composes file parsing, state apply, history, and trace", async () => {
  const sink = {};
  const opened = await openRecentProjectPath("C:/demo/project.json", {
    openProjectFileAtPathImpl: async ({ path }) => ({
      path,
      content: JSON.stringify({
        nodes: [{ id: "node-3" }],
        edges: [],
        view: { x: 12, y: 34, scale: 1 },
        settings: { mode: "demo" },
        resources: [],
        timeline: { clips: [{ id: "clip-1" }] },
        episodes: [{ id: "episode-2" }],
        activeEpisodeId: "episode-2",
      }),
    }),
  });
  const project = parseProjectContent(opened.content, (value) => value);
  const applied = buildAppliedProjectState(project, opened.path, {
    inferNextNodeId: () => 4,
    defaultTimelineState: () => ({ clips: [] }),
    defaultPromptFactoryState: () => ({}),
    defaultTemplateCenterState: () => ({}),
    defaultStylePresetCenterState: () => ({}),
    defaultModelParamCenterState: () => ({}),
    defaultExportPresetCenterState: () => ({}),
    defaultCollaborationState: () => ({}),
    defaultArchiveState: () => ({}),
    defaultPerformanceSettings: () => ({ mode: "auto" }),
  });
  const snapshot = createEditorSnapshot({
    nodes: applied.nodes,
    edges: applied.edges,
    view: applied.view,
    resources: applied.resources,
    timeline: applied.timeline,
    promptFactory: applied.promptFactory,
    templateCenter: applied.templateCenter,
    stylePresetCenter: applied.stylePresetCenter,
    modelParamCenter: applied.modelParamCenter,
    collaborationState: applied.collaborationState,
    archiveState: applied.archiveState,
    performanceSettings: applied.performanceSettings,
    episodes: applied.episodes,
    activeEpisodeId: applied.activeEpisodeId,
  });
  const history = pushHistoryState({ past: [], future: [] }, snapshot);
  const trace = emitDebugTrace({
    enabled: true,
    event: "project.open.done",
    payload: { path: applied.currentProjectPath, nodeCount: applied.nodes.length },
    sink,
    now: () => "2026-04-23T12:00:00.000Z",
    logger: () => {},
  });

  assert.equal(applied.currentProjectPath, "C:/demo/project.json");
  assert.equal(applied.nextNodeId, 4);
  assert.equal(history.past.length, 1);
  assert.equal(trace.event, "project.open.done");
  assert.equal(sink.__WUXIAN_TRACE__[0].payload.nodeCount, 1);
});

test("pipeline sync flow composes node-link planning and linked timeline conversion", () => {
  const syncPlan = buildPipelineSyncPlan({
    assetTarget: null,
    assetPatch: { characters: [{ token: "@角-主角" }] },
    hasAssets: true,
    shotTarget: { id: "shot-node-1" },
    shotPatch: {
      shots: [
        { id: "S01", imagePrompt: "第一镜" },
        { id: "S02", imagePrompt: "第二镜" },
      ],
    },
    hasShots: true,
  });
  const timelineShots = buildLinkedTimelineShots({
    shots: syncPlan.shot.patch.shots,
    shotNodeId: syncPlan.shot.targetId,
    sourceEpisodeId: "episode-1",
    nodes: [{ id: "shot-node-1" }],
    resources: [{ id: "res-1" }],
    episodes: [{ id: "episode-1" }],
    normalizeShotRecord: (shot, index) => ({ ...shot, order: index + 1 }),
    buildTimelineSourceFromShotRecord: ({ shot }) => ({
      id: `clip-${shot.id}`,
      title: shot.imagePrompt,
      order: shot.order,
    }),
    buildProjectResourceIndex: () => ({ items: [{ id: "res-1" }] }),
    pickTimelineResultUrl: () => "",
    expandResourceReferences: () => "",
  });

  assert.equal(syncPlan.asset.mode, "created");
  assert.equal(syncPlan.shot.mode, "updated");
  assert.deepEqual(timelineShots, [
    { id: "clip-S01", title: "第一镜", order: 1, sourceNodeId: "shot-node-1" },
    { id: "clip-S02", title: "第二镜", order: 2, sourceNodeId: "shot-node-1" },
  ]);
});

test("history undo can roll back from applied project snapshot to prior workspace", () => {
  const previous = createEditorSnapshot({
    nodes: [{ id: "node-1" }],
    edges: [],
    view: { x: 0, y: 0, scale: 1 },
    resources: [],
    timeline: { clips: [] },
    promptFactory: {},
    templateCenter: {},
    stylePresetCenter: {},
    modelParamCenter: {},
    collaborationState: {},
    archiveState: {},
    performanceSettings: { mode: "auto" },
    episodes: [{ id: "episode-1" }],
    activeEpisodeId: "episode-1",
  });
  const loaded = createEditorSnapshot({
    nodes: [{ id: "node-9" }, { id: "node-10" }],
    edges: [{ id: "edge-1" }],
    view: { x: 20, y: 40, scale: 0.8 },
    resources: [{ id: "res-1" }],
    timeline: { clips: [{ id: "clip-1" }] },
    promptFactory: { active: true },
    templateCenter: {},
    stylePresetCenter: {},
    modelParamCenter: {},
    collaborationState: {},
    archiveState: {},
    performanceSettings: { mode: "quality" },
    episodes: [{ id: "episode-2" }],
    activeEpisodeId: "episode-2",
  });
  const history = pushHistoryState({ past: [previous], future: [] }, loaded);
  const undo = computeUndoState(history, loaded);

  assert.equal(undo.snapshotToRestore.nodes[0].id, "node-9");
  assert.equal(undo.history.past.length, 1);
  assert.equal(undo.history.future.length, 1);
  assert.equal(undo.history.future[0].nodes.length, 2);
});
