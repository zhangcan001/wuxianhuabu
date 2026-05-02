import assert from "node:assert/strict";
import test from "node:test";
import {
  deleteProjectResourceAction,
  deleteProjectResourceList,
  importProjectResourcesAction,
  updateProjectResourceAction,
  updateProjectResourceList,
} from "../src/app/project-resource-actions.js";

test("import project resources appends normalized resources and opens panel", async () => {
  let resources = [];
  const messages = [];
  let historyCount = 0;
  let showResources = false;

  const result = await importProjectResourcesAction({
    files: [{ name: "brief.txt" }],
    activeEpisodeId: "ep-1",
    createResourceFromFile: async (file, episodeId) => ({
      name: file.name,
      episodeId,
      kind: "text",
      textContent: "角色资料",
    }),
    pushHistory: () => {
      historyCount += 1;
    },
    setResources: (updater) => {
      resources = updater(resources);
    },
    setShowResources: (value) => {
      showResources = value;
    },
    setProjectMessage: (message) => messages.push(message),
  });

  assert.equal(result.ok, true);
  assert.equal(historyCount, 1);
  assert.equal(showResources, true);
  assert.equal(resources.length, 1);
  assert.equal(resources[0].episodeId, "ep-1");
  assert.equal(resources[0].name, "brief.txt");
  assert.equal(messages[0], "已导入 1 个项目资源");
});

test("import project resources can route to the production workbench", async () => {
  let resources = [];
  let showResources = false;
  const routed = [];

  const result = await importProjectResourcesAction({
    files: [{ name: "look.png" }],
    activeEpisodeId: "ep-1",
    createResourceFromFile: async (file, episodeId) => ({
      name: file.name,
      episodeId,
      kind: "image",
      url: "asset://look.png",
    }),
    setResources: (updater) => {
      resources = updater(resources);
    },
    setShowResources: (value) => {
      showResources = value;
    },
    openResourceWorkbench: (items) => routed.push(items.map((item) => item.name)),
  });

  assert.equal(result.ok, true);
  assert.equal(resources.length, 1);
  assert.equal(showResources, false);
  assert.deepEqual(routed, [["look.png"]]);
});

test("import project resources skips empty selections", async () => {
  let historyCount = 0;
  const result = await importProjectResourcesAction({
    files: [],
    pushHistory: () => {
      historyCount += 1;
    },
  });

  assert.equal(result.skipped, true);
  assert.equal(historyCount, 0);
});

test("import project resources reports conversion failure", async () => {
  const messages = [];
  const file = {
    name: "bad.txt",
  };

  const result = await importProjectResourcesAction({
    files: [file],
    createResourceFromFile: async () => {
      throw new Error("read failed");
    },
    setProjectMessage: (message) => messages.push(message),
  });

  assert.equal(result.ok, false);
  assert.equal(messages[0], "导入资源失败：Error: read failed");
});

test("resource list update normalizes the patched resource", () => {
  const updated = updateProjectResourceList([
    { id: "r1", episodeId: "ep-1", name: "旧名称", kind: "text", content: "a" },
    { id: "r2", episodeId: "ep-1", name: "保留", kind: "text" },
  ], "r1", { name: "新名称" });

  assert.equal(updated[0].name, "新名称");
  assert.equal(updated[0].episodeId, "ep-1");
  assert.equal(updated[0].token.startsWith("@资源_"), true);
  assert.equal(updated[1].name, "保留");
});

test("resource action wrappers update state and record delete history", () => {
  let resources = [
    { id: "r1", episodeId: "ep-1", name: "A", kind: "text" },
    { id: "r2", episodeId: "ep-1", name: "B", kind: "text" },
  ];
  let historyCount = 0;
  const setResources = (updater) => {
    resources = updater(resources);
  };

  updateProjectResourceAction({ resourceId: "r1", patch: { name: "AA" }, setResources });
  assert.equal(resources[0].name, "AA");

  deleteProjectResourceAction({
    resourceId: "r2",
    pushHistory: () => {
      historyCount += 1;
    },
    setResources,
  });

  assert.deepEqual(resources.map((item) => item.id), ["r1"]);
  assert.equal(historyCount, 1);
  assert.deepEqual(deleteProjectResourceList(resources, "r1"), []);
});
