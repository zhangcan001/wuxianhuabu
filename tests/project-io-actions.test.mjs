import assert from "node:assert/strict";
import test from "node:test";
import {
  applyLoadedProjectAction,
  importProjectContentAction,
  openProjectFileAction,
  openRecentProjectAction,
  saveProjectAction,
} from "../src/app/project-io-actions.js";

test("save project action reports consistency warning then saved path", async () => {
  const messages = [];
  const traces = [];
  const recent = [];
  let currentPath = "";

  const result = await saveProjectAction({
    project: { id: "p1" },
    consistency: { ok: false, issues: ["资产缺失", "时间线未闭合", "忽略"] },
    projectRepository: {
      save: async () => ({ path: "C:/demo/project.json" }),
    },
    setCurrentProjectPath: (path) => {
      currentPath = path;
    },
    setProjectMessage: (message) => messages.push(message),
    traceAppEvent: (...args) => traces.push(args),
    refreshRecentProjects: () => recent.push("refresh"),
    nodeCount: 2,
    episodeCount: 1,
  });

  assert.equal(result.ok, true);
  assert.equal(currentPath, "C:/demo/project.json");
  assert.deepEqual(messages, [
    "保存前一致性提示：资产缺失；时间线未闭合",
    "已保存工程：C:/demo/project.json",
  ]);
  assert.deepEqual(traces, [[
    "project.save.done",
    { path: "C:/demo/project.json", nodeCount: 2, episodeCount: 1 },
  ]]);
  assert.deepEqual(recent, ["refresh"]);
});

test("apply loaded project action migrates media and applies normalized editor state", async () => {
  const traces = [];
  const messages = [];
  const applied = [];
  let historyCount = 0;

  const result = await applyLoadedProjectAction({
    project: { nodes: [{ id: "n1" }], episodes: [{ id: "ep1" }], timeline: { clips: [{ id: "c1" }] } },
    path: "C:/demo/project.json",
    pushHistory: () => {
      historyCount += 1;
    },
    migrateLoadedProjectMedia: async (project, source) => ({
      project: { ...project, migratedSource: source },
      migratedCount: 2,
    }),
    applyEditorProjectState: (state) => applied.push(state),
    appliedProjectOptions: {
      inferNextNodeId: () => 10,
      defaultTimelineState: () => ({ clips: [] }),
      defaultPromptFactoryState: () => ({}),
      defaultTemplateCenterState: () => ({}),
      defaultStylePresetCenterState: () => ({}),
      defaultModelParamCenterState: () => ({}),
      defaultExportPresetCenterState: () => ({}),
      defaultCollaborationState: () => ({}),
      defaultArchiveState: () => ({}),
      defaultPerformanceSettings: () => ({}),
    },
    traceAppEvent: (...args) => traces.push(args),
    setProjectMessage: (message) => messages.push(message),
  });

  assert.equal(result.migratedCount, 2);
  assert.equal(historyCount, 1);
  assert.equal(applied[0].nodes.length, 1);
  assert.equal(applied[0].currentProjectPath, "C:/demo/project.json");
  assert.equal(messages[0], "已迁移 2 张旧工程内嵌图片到本地缓存");
  assert.deepEqual(traces[0], [
    "project.apply",
    {
      path: "C:/demo/project.json",
      nodeCount: 1,
      episodeCount: 1,
      clipCount: 1,
      migratedMediaCount: 2,
    },
  ]);
});

test("open project file action loads dialog content and refreshes recent projects", async () => {
  const messages = [];
  const traces = [];
  const recent = [];
  const loadedInputs = [];

  const result = await openProjectFileAction({
    tauriRuntime: true,
    openProjectFileImpl: async () => ({ content: "{\"id\":\"p1\"}", path: "C:/demo/project.json" }),
    projectRepository: {
      load: async (input) => {
        loadedInputs.push(input);
        return { project: { id: "p1" } };
      },
    },
    applyProject: async (_project, path) => ({ migratedCount: path ? 1 : 0 }),
    setProjectMessage: (message) => messages.push(message),
    traceAppEvent: (...args) => traces.push(args),
    refreshRecentProjects: () => recent.push("refresh"),
  });

  assert.equal(result.ok, true);
  assert.equal(loadedInputs[0].source, "dialog");
  assert.equal(messages[0], "已打开工程：C:/demo/project.json，已迁移 1 张内嵌图片");
  assert.deepEqual(traces[0], ["project.open.done", { path: "C:/demo/project.json", source: "dialog" }]);
  assert.deepEqual(recent, ["refresh"]);
});

test("import project content action reports parse failure through injected error handler", async () => {
  const errors = [];
  const result = await importProjectContentAction({
    content: "{",
    projectRepository: {
      load: async () => {
        throw new Error("Unexpected token");
      },
    },
    applyProject: async () => {},
    onError: (message) => errors.push(message),
  });

  assert.equal(result.ok, false);
  assert.deepEqual(errors, ["导入失败：Unexpected token"]);
});

test("open recent project action reports failure and still refreshes recent list", async () => {
  const messages = [];
  const traces = [];
  const recent = [];

  const result = await openRecentProjectAction({
    path: "C:/missing/project.json",
    openProjectFileAtPathImpl: async () => {
      throw new Error("missing");
    },
    projectRepository: {},
    applyProject: async () => {},
    setProjectMessage: (message) => messages.push(message),
    traceAppEvent: (...args) => traces.push(args),
    refreshRecentProjects: () => recent.push("refresh"),
  });

  assert.equal(result.ok, false);
  assert.equal(messages[0], "打开最近工程失败：Error: missing");
  assert.deepEqual(traces[0], [
    "project.open.failed",
    { source: "recent", path: "C:/missing/project.json", error: "Error: missing" },
  ]);
  assert.deepEqual(recent, ["refresh"]);
});
