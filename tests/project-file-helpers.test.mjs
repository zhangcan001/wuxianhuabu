import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProjectOpenedMessage,
  buildProjectSavedMessage,
  clearProjectCacheThroughRuntime,
  loadProjectCacheThroughRuntime,
  openProjectThroughRuntime,
  openRecentProjectPath,
  parseProjectContent,
  persistProjectPath,
  saveProjectCacheThroughRuntime,
  saveProjectThroughRuntime,
} from "../src/project-file-helpers.js";

test("persist project path stores and clears local value", () => {
  const events = [];
  const storage = {
    setItem(key, value) {
      events.push(["set", key, value]);
    },
    removeItem(key) {
      events.push(["remove", key]);
    },
  };
  persistProjectPath(storage, "project-path", "C:/demo/a.json");
  persistProjectPath(storage, "project-path", "");
  assert.deepEqual(events, [
    ["set", "project-path", "C:/demo/a.json"],
    ["remove", "project-path"],
  ]);
});

test("save project helper uses browser download fallback", async () => {
  const link = {
    href: "",
    download: "",
    clicked: false,
    click() {
      this.clicked = true;
    },
  };
  const urls = [];
  const result = await saveProjectThroughRuntime({
    content: "{\"ok\":true}",
    tauriRuntime: false,
    documentImpl: {
      createElement(tag) {
        assert.equal(tag, "a");
        return link;
      },
    },
    blobImpl: Blob,
    urlImpl: {
      createObjectURL() {
        urls.push("create");
        return "blob:test";
      },
      revokeObjectURL(url) {
        urls.push(url);
      },
    },
    now: () => 123,
  });
  assert.equal(link.href, "blob:test");
  assert.equal(link.download, "wuxianhuabu-123.json");
  assert.equal(link.clicked, true);
  assert.deepEqual(urls, ["create", "blob:test"]);
  assert.equal(result.downloaded, true);
});

test("open project helper clicks browser input when not in tauri", async () => {
  let clicked = false;
  const result = await openProjectThroughRuntime({
    tauriRuntime: false,
    fileInputRef: {
      current: {
        click() {
          clicked = true;
        },
      },
    },
  });
  assert.equal(clicked, true);
  assert.equal(result.browserFallback, true);
});

test("recent project helper delegates to runtime loader", async () => {
  const result = await openRecentProjectPath("C:/demo/project.json", {
    openProjectFileAtPathImpl: async ({ path }) => ({ content: "{}", path }),
  });
  assert.equal(result.path, "C:/demo/project.json");
});

test("runtime project cache helpers delegate only in tauri mode", async () => {
  const saved = await saveProjectCacheThroughRuntime({
    content: "{\"nodes\":[]}",
    projectPath: "C:/demo/project.json",
    tauriRuntime: true,
    saveProjectCacheImpl: async (request) => ({ ...request, ok: true }),
  });
  const loaded = await loadProjectCacheThroughRuntime({
    tauriRuntime: true,
    loadProjectCacheImpl: async () => ({ content: "{}", projectPath: "C:/demo/project.json" }),
  });
  const cleared = await clearProjectCacheThroughRuntime({
    tauriRuntime: true,
    clearProjectCacheImpl: async () => ({ cachePath: "C:/cache/project-recovery.json" }),
  });
  const skipped = await loadProjectCacheThroughRuntime({
    tauriRuntime: false,
    loadProjectCacheImpl: async () => ({ content: "should-not-run" }),
  });

  assert.deepEqual(saved, {
    content: "{\"nodes\":[]}",
    projectPath: "C:/demo/project.json",
    ok: true,
  });
  assert.deepEqual(loaded, {
    content: "{}",
    projectPath: "C:/demo/project.json",
  });
  assert.deepEqual(cleared, {
    cachePath: "C:/cache/project-recovery.json",
  });
  assert.equal(skipped.skipped, true);
});

test("parse project content normalizes loaded payload", () => {
  const project = parseProjectContent("{\"nodes\":[]}", (value) => ({ ...value, normalized: true }));
  assert.deepEqual(project, { nodes: [], normalized: true });
  assert.equal(parseProjectContent("", (value) => value), null);
});

test("project status messages stay readable", () => {
  assert.equal(buildProjectOpenedMessage("C:/demo/a.json"), "已打开工程：C:/demo/a.json");
  assert.equal(buildProjectSavedMessage("C:/demo/a.json"), "已保存工程：C:/demo/a.json");
});
