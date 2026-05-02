import test from "node:test";
import assert from "node:assert/strict";
import {
  MAIN_CHAIN_AUXILIARY_PANEL_SETTERS,
  focusMainChainNavigation,
  openAdvancedCanvasNavigation,
  openNodeTargetInProductionStudioNavigation,
  openProductionStudioNavigation,
  openProductionStudioViewNavigation,
  openSettingsPanelNavigation,
  openWorkflowActionNavigation,
  resolveProductionStudioTargetView,
} from "../src/app/workspace-navigation.js";

test("workspace navigation resolves production studio target views", () => {
  assert.equal(resolveProductionStudioTargetView({ node: { type: "novelPipeline" } }), "script");
  assert.equal(resolveProductionStudioTargetView({ node: { type: "assetLibrary" } }), "assets");
  assert.equal(resolveProductionStudioTargetView({ node: { type: "shotList" } }), "shots");
  assert.equal(resolveProductionStudioTargetView({ actionKey: "timeline" }), "timeline");
  assert.equal(resolveProductionStudioTargetView({ actionKey: "export" }), "delivery");
  assert.equal(resolveProductionStudioTargetView({ node: { type: "unknown" }, actionKey: "unknown" }), "");
});

test("workspace navigation opens node targets in production studio", () => {
  const calls = [];
  const ok = openNodeTargetInProductionStudioNavigation({
    nodeId: "node-1",
    actionKey: "",
    nodes: [{ id: "node-1", type: "assetLibrary" }],
    openProductionStudioView: (view, message) => calls.push([view, message]),
  });

  assert.equal(ok, true);
  assert.deepEqual(calls, [["assets", "已在生产工作台定位相关业务内容。"]]);
  assert.equal(openNodeTargetInProductionStudioNavigation({ nodeId: "missing", nodes: [] }), false);
});

test("workspace navigation opens compatibility canvas with projected episode", () => {
  const calls = [];
  openAdvancedCanvasNavigation({
    commercialProject: { activeEpisode: { id: "episode-1" } },
    nodes: [{ id: "old" }],
    edges: [{ id: "edge-old" }],
    viewportCenter: { x: 1000, y: 600 },
    mergeAdvancedCanvasProjection: (input) => {
      calls.push(["merge", input.origin, input.nodes.length, input.edges.length]);
      return { nodes: [{ id: "projected" }], edges: [{ id: "edge-projected" }] };
    },
    setNodes: (nodes) => calls.push(["nodes", nodes]),
    setEdges: (edges) => calls.push(["edges", edges]),
    setShowCompatibilityCanvas: (value) => calls.push(["compat", value]),
    setShowProjectStudio: (value) => calls.push(["studio", value]),
    setProjectMessage: (message) => calls.push(["message", message]),
  });

  assert.deepEqual(calls.slice(0, 3), [
    ["merge", { x: 240, y: 320 }, 1, 1],
    ["nodes", [{ id: "projected" }]],
    ["edges", [{ id: "edge-projected" }]],
  ]);
  assert.deepEqual(calls.slice(3, 5), [["compat", true], ["studio", false]]);
  assert.match(calls[5][1], /兼容画布/);
});

test("workspace navigation returns to production studio and syncs legacy projection", () => {
  const calls = [];
  openProductionStudioNavigation({
    projectStoreStateRef: { current: { project: { id: "project-1" } } },
    syncLegacyCanvasFromBusinessProject: (project) => calls.push(["sync", project.id]),
    setShowCompatibilityCanvas: (value) => calls.push(["compat", value]),
    setShowProjectStudio: (value) => calls.push(["studio", value]),
    setProjectMessage: (message) => calls.push(["message", message]),
    message: "回来",
  });

  assert.deepEqual(calls, [
    ["sync", "project-1"],
    ["compat", false],
    ["studio", true],
    ["message", "回来"],
  ]);
});

test("workspace navigation requests a concrete production studio view", () => {
  const calls = [];
  const result = openProductionStudioViewNavigation({
    view: "timeline",
    message: "打开时间线",
    now: () => 123,
    setStudioViewRequest: (request) => calls.push(["request", request]),
    openProductionStudio: (message) => calls.push(["open", message]),
  });

  assert.deepEqual(result, { view: "timeline", token: 123 });
  assert.deepEqual(calls, [
    ["request", { view: "timeline", token: 123 }],
    ["open", "打开时间线"],
  ]);
});

test("workspace workflow action router opens studio views", () => {
  const calls = [];
  const result = openWorkflowActionNavigation({
    actionKey: "prompt",
    openProductionStudioView: (view, message) => calls.push([view, message]),
  });

  assert.deepEqual(result, { handled: true, target: "shots" });
  assert.deepEqual(calls, [["shots", "已打开生产工作台镜头表。"]]);
});

test("workspace workflow action router opens queue health and dashboard panels", () => {
  const calls = [];

  assert.deepEqual(openWorkflowActionNavigation({
    actionKey: "queue",
    setShowQueue: (value) => calls.push(["queue", value]),
  }), { handled: true, target: "queue" });

  assert.deepEqual(openWorkflowActionNavigation({
    actionKey: "health",
    setShowHealth: (value) => calls.push(["health", value]),
  }), { handled: true, target: "health" });

  assert.deepEqual(openWorkflowActionNavigation({
    actionKey: "unknown",
    setShowDashboard: (value) => calls.push(["dashboard", value]),
  }), { handled: true, target: "dashboard" });

  assert.deepEqual(calls, [
    ["queue", true],
    ["health", true],
    ["dashboard", true],
  ]);
});

test("workspace workflow action router falls back to compatibility canvas for unresolved nodes", () => {
  const calls = [];
  const scheduled = [];
  const result = openWorkflowActionNavigation({
    actionKey: "timeline",
    nodeId: "node-1",
    openNodeTargetInProductionStudio: () => false,
    openAdvancedCanvas: () => calls.push(["canvas"]),
    locateNode: (nodeId) => calls.push(["locate", nodeId]),
    schedule: (callback) => scheduled.push(callback),
  });

  assert.deepEqual(result, { handled: true, target: "node" });
  assert.deepEqual(calls, [["canvas"]]);
  assert.equal(scheduled.length, 1);
  scheduled[0]();
  assert.deepEqual(calls, [["canvas"], ["locate", "node-1"]]);
});

test("workspace workflow action router does not open canvas when node resolves in studio", () => {
  const calls = [];
  const result = openWorkflowActionNavigation({
    actionKey: "review",
    nodeId: "node-1",
    openNodeTargetInProductionStudio: (nodeId, actionKey) => {
      calls.push(["studio-node", nodeId, actionKey]);
      return true;
    },
    openAdvancedCanvas: () => calls.push(["canvas"]),
  });

  assert.deepEqual(result, { handled: true, target: "node" });
  assert.deepEqual(calls, [["studio-node", "node-1", "review"]]);
});

test("workspace navigation focuses the main production chain", () => {
  const calls = [];
  const setters = Object.fromEntries(MAIN_CHAIN_AUXILIARY_PANEL_SETTERS.map((setterName) => [
    setterName,
    (value) => calls.push([setterName, value]),
  ]));

  const result = focusMainChainNavigation({
    ...setters,
    openProductionStudioView: (view, message) => calls.push(["studio", view, message]),
  });

  assert.deepEqual(result, { summary: "已关闭高级辅助面板，回到主生产链。" });
  assert.equal(calls.length, MAIN_CHAIN_AUXILIARY_PANEL_SETTERS.length + 1);
  assert.deepEqual(calls.slice(0, MAIN_CHAIN_AUXILIARY_PANEL_SETTERS.length), MAIN_CHAIN_AUXILIARY_PANEL_SETTERS.map((setterName) => [setterName, false]));
  assert.deepEqual(calls.at(-1), ["studio", "overview", "已收敛到主生产链：文本、图片、视频、时间线、交付。"]);
});

test("workspace navigation opens settings panel with focus and refresh", () => {
  const calls = [];
  const result = openSettingsPanelNavigation({
    focus: "video",
    setSettingsFocus: (focus) => calls.push(["focus", focus]),
    refreshGlobalApiConfigs: () => calls.push(["refresh"]),
    setShowSettings: (value) => calls.push(["settings", value]),
  });

  assert.deepEqual(result, { focus: "video" });
  assert.deepEqual(calls, [
    ["focus", "video"],
    ["refresh"],
    ["settings", true],
  ]);
});
