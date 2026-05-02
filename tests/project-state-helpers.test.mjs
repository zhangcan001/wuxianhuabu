import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAppliedProjectState,
  buildClearedProjectState,
} from "../src/project-state-helpers.js";

test("cleared project state resets editor data to defaults", () => {
  const state = buildClearedProjectState({
    defaultTimelineState: () => ({ timeline: true }),
    defaultPromptFactoryState: () => ({ promptFactory: true }),
    defaultTemplateCenterState: () => ({ templateCenter: true }),
    defaultStylePresetCenterState: () => ({ stylePresetCenter: true }),
    defaultModelParamCenterState: () => ({ modelParamCenter: true }),
    defaultExportPresetCenterState: () => ({ exportPresetCenter: true }),
    defaultCollaborationState: () => ({ collaborationState: true }),
    defaultArchiveState: () => ({ archiveState: true }),
    defaultPerformanceSettings: () => ({ performanceSettings: true }),
    defaultEpisodes: () => [{ id: "episode-1" }],
  });
  assert.equal(state.nextNodeId, 1);
  assert.deepEqual(state.nodes, []);
  assert.deepEqual(state.timeline, { timeline: true });
  assert.deepEqual(state.episodes, [{ id: "episode-1" }]);
  assert.equal(state.activeEpisodeId, "episode-1");
  assert.equal(state.businessProject, null);
  assert.deepEqual(state.productionEvents, []);
  assert.equal(state.currentProjectPath, "");
});

test("applied project state keeps project payload and fills missing defaults", () => {
  const state = buildAppliedProjectState({
    nodes: [{ id: "node-3" }],
    edges: [{ id: "edge-1" }],
    view: { x: 1, y: 2, scale: 1 },
    settings: { a: 1 },
    resources: null,
    timeline: null,
    promptFactory: null,
    templateCenter: null,
    stylePresetCenter: null,
    modelParamCenter: null,
    exportPresetCenter: null,
    collaborationState: null,
    archiveState: null,
    exportHistory: null,
    performanceSettings: null,
    generationQueue: null,
    productionEvents: [{ id: "evt-1", type: "production.started" }],
    episodes: [{ id: "episode-2" }],
    activeEpisodeId: "episode-2",
    businessProject: { id: "business-project", activeEpisodeId: "episode-2" },
  }, "C:/demo/project.json", {
    inferNextNodeId: () => 4,
    defaultTimelineState: () => ({ timeline: true }),
    defaultPromptFactoryState: () => ({ promptFactory: true }),
    defaultTemplateCenterState: () => ({ templateCenter: true }),
    defaultStylePresetCenterState: () => ({ stylePresetCenter: true }),
    defaultModelParamCenterState: () => ({ modelParamCenter: true }),
    defaultExportPresetCenterState: () => ({ exportPresetCenter: true }),
    defaultCollaborationState: () => ({ collaborationState: true }),
    defaultArchiveState: () => ({ archiveState: true }),
    defaultPerformanceSettings: () => ({ performanceSettings: true }),
  });
  assert.equal(state.nextNodeId, 4);
  assert.deepEqual(state.nodes, [{ id: "node-3" }]);
  assert.deepEqual(state.timeline, { timeline: true });
  assert.deepEqual(state.promptFactory, { promptFactory: true });
  assert.deepEqual(state.generationQueue, []);
  assert.equal(state.productionEvents[0].id, "evt-1");
  assert.equal(state.businessProject.id, "business-project");
  assert.equal(state.currentProjectPath, "C:/demo/project.json");
  assert.equal(state.activeEpisodeId, "episode-2");
});
