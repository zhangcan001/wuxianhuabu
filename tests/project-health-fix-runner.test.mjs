import assert from "node:assert/strict";
import test from "node:test";
import {
  runShotBindingPatchHealthFix,
  runTimelineImportHealthFix,
} from "../src/app/project-health-fix-runner.js";

test("runTimelineImportHealthFix builds timeline sources and reconciles", async () => {
  const imported = [];
  const messages = [];
  let shown = false;
  let reconciled = false;

  const result = await runTimelineImportHealthFix({
    finding: { episodeId: "ep-1", text: "缺少时间线", fix: { kind: "episode_timeline_import" } },
    getEpisodeNodesForHealthFix: () => [{
      id: "shot-node",
      type: "shotList",
      data: { shots: [{ id: "s1", title: "镜头 1" }] },
    }],
    buildTimelineSourceFromShotRecord: ({ sourceNodeId, shot }) => ({ sourceNodeId, shotId: shot.id, title: shot.title }),
    normalizeShotRecord: (shot) => shot,
    importShotsToTimelineByEpisode: (episodeId, shots, options) => imported.push({ episodeId, shots, options }),
    waitForHealthRepairCommit: async () => {},
    reconcileHealthRepair: async () => {
      reconciled = true;
    },
    setShowTimeline: (value) => {
      shown = value;
    },
    setProjectMessage: (message) => messages.push(message),
    activeEpisodeId: "ep-1",
    nodes: [],
    resources: [],
    episodes: [],
    buildProjectResourceIndex: () => ({}),
  });

  assert.equal(result.imported, 1);
  assert.equal(imported[0].episodeId, "ep-1");
  assert.equal(imported[0].options.silent, true);
  assert.equal(shown, true);
  assert.equal(reconciled, true);
  assert.equal(messages[0], "已自动导入时间线并通过复检：缺少时间线");
});

test("runShotBindingPatchHealthFix patches inferred bindings", async () => {
  const patches = [];
  const messages = [];

  const result = await runShotBindingPatchHealthFix({
    finding: { text: "缺绑定", fix: { kind: "shot_binding_patch", sourceNodeId: "node-1", shotId: "s1" } },
    getNodeById: () => ({ data: { shots: [{ id: "s1", title: "镜头 1" }] } }),
    normalizeShotRecord: (shot) => shot,
    collectGlobalAssets: () => ({ items: [] }),
    suggestShotAssetBindingPatch: () => ({ mainCharacterToken: "@角色_主角" }),
    patchShotRecord: (sourceNodeId, shotId, patch) => patches.push({ sourceNodeId, shotId, patch }),
    waitForHealthRepairCommit: async () => {},
    reconcileHealthRepair: async () => {},
    setProjectMessage: (message) => messages.push(message),
  });

  assert.deepEqual(result.patch, { mainCharacterToken: "@角色_主角" });
  assert.deepEqual(patches[0], { sourceNodeId: "node-1", shotId: "s1", patch: { mainCharacterToken: "@角色_主角" } });
  assert.equal(messages[0], "已自动补齐并通过复检：缺绑定");
});

test("runShotBindingPatchHealthFix rejects empty inferred bindings", async () => {
  await assert.rejects(
    runShotBindingPatchHealthFix({
      finding: { text: "缺绑定", fix: { kind: "shot_binding_patch", sourceNodeId: "node-1", shotId: "s1" } },
      getNodeById: () => ({ data: { shots: [{ id: "s1" }] } }),
      normalizeShotRecord: (shot) => shot,
      collectGlobalAssets: () => ({ items: [] }),
      suggestShotAssetBindingPatch: () => ({}),
    }),
    /没有可自动推断/,
  );
});
