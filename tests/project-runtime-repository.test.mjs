import assert from "node:assert/strict";
import test from "node:test";
import {
  createRuntimeProjectRepository,
} from "../src/app/project-runtime-repository.js";

test("runtime project repository writes browser cache through injected storage", async () => {
  const writes = [];
  const repository = createRuntimeProjectRepository({
    parseProject: (content, normalizeProject) => normalizeProject(JSON.parse(content)),
    normalizeProject: (project) => ({ ...project, normalized: true }),
    cacheProjectPayload: (project, options) => ({ ...project, compact: Boolean(options.compact) }),
    stringifyProjectStoragePayload: (project) => JSON.stringify(project),
    projectSerializers: {},
    storage: {
      setItem: (key, value) => writes.push([key, value]),
    },
    storageKey: "project-cache",
    tauriRuntime: false,
  });

  const loaded = await repository.load({ content: '{"id":"p1"}' });
  const cached = await repository.cache({ id: "p1" }, { storage: "cache" });

  assert.equal(loaded.project.normalized, true);
  assert.equal(cached.cached, true);
  assert.deepEqual(writes, [["project-cache", '{"id":"p1","compact":true}']]);
});

test("runtime project repository delegates save and cache to tauri ports", async () => {
  const calls = [];
  const repository = createRuntimeProjectRepository({
    parseProject: (content) => JSON.parse(content),
    normalizeProject: (project) => project,
    cacheProjectPayload: (project) => project,
    stringifyProjectStoragePayload: (project) => JSON.stringify(project),
    projectSerializers: {},
    tauriRuntime: () => true,
    saveProjectFileImpl: async ({ content }) => {
      calls.push(["save", content]);
      return { path: "project.wxhb" };
    },
    saveProjectCacheImpl: async ({ content, projectPath }) => {
      calls.push(["cache", content, projectPath]);
      return { cached: true };
    },
  });

  const saved = await repository.save({ id: "p1" });
  const cached = await repository.cache({ id: "p1" }, { storage: "cache", projectPath: "draft.wxhb" });

  assert.equal(saved.path, "project.wxhb");
  assert.equal(cached.cached, true);
  assert.deepEqual(calls, [
    ["save", '{"id":"p1"}'],
    ["cache", '{"id":"p1"}', "draft.wxhb"],
  ]);
});
