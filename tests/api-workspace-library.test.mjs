import assert from "node:assert/strict";
import test from "node:test";

import {
  API_WORKSPACE_LIBRARY_KEY,
  addApiWorkspaceToLibrary,
  createApiWorkspaceEntry,
  loadApiWorkspaceLibrary,
  normalizeApiWorkspaceLibrary,
  saveApiWorkspaceLibrary,
} from "../src/api-workspace-library.js";

test("api workspace library normalizes malformed payloads", () => {
  assert.deepEqual(normalizeApiWorkspaceLibrary(null), {
    workspaces: [],
    activeWorkspaceId: "",
  });
  assert.deepEqual(normalizeApiWorkspaceLibrary({
    workspaces: [{ id: "workspace-1" }],
    activeWorkspaceId: 12,
  }), {
    workspaces: [{ id: "workspace-1" }],
    activeWorkspaceId: "12",
  });
});

test("api workspace library loads and saves through injected storage", () => {
  const storage = createMemoryStorage();
  saveApiWorkspaceLibrary({
    workspaces: [{ id: "workspace-1", name: "Main" }],
    activeWorkspaceId: "workspace-1",
  }, { storage });

  assert.equal(storage.getItem(API_WORKSPACE_LIBRARY_KEY).includes("workspace-1"), true);
  assert.deepEqual(loadApiWorkspaceLibrary({ storage }), {
    workspaces: [{ id: "workspace-1", name: "Main" }],
    activeWorkspaceId: "workspace-1",
  });
});

test("api workspace library falls back to an empty library on bad storage content", () => {
  const storage = createMemoryStorage();
  storage.setItem(API_WORKSPACE_LIBRARY_KEY, "{bad json");

  assert.deepEqual(loadApiWorkspaceLibrary({ storage }), {
    workspaces: [],
    activeWorkspaceId: "",
  });
});

test("api workspace library creates a new active workspace entry", () => {
  const entry = createApiWorkspaceEntry({
    id: "workspace-2",
    name: "  新工作区  ",
    textSettings: { apiProvider: "openai" },
    mediaSettings: { providerMode: "custom" },
    now: () => "2026-05-06T00:00:00.000Z",
  });

  assert.deepEqual(entry, {
    id: "workspace-2",
    name: "新工作区",
    updatedAt: "2026-05-06T00:00:00.000Z",
    textSettings: { apiProvider: "openai" },
    mediaSettings: { providerMode: "custom" },
  });
});

test("api workspace library adds new workspace at the top and activates it", () => {
  const next = addApiWorkspaceToLibrary({
    activeWorkspaceId: "workspace-1",
    workspaces: [
      { id: "workspace-1", name: "旧工作区" },
      { id: "workspace-2", name: "旧副本" },
    ],
  }, {
    id: "workspace-2",
    name: "新工作区",
    now: () => "2026-05-06T00:00:00.000Z",
  });

  assert.equal(next.activeWorkspaceId, "workspace-2");
  assert.deepEqual(next.workspaces.map((item) => item.id), ["workspace-2", "workspace-1"]);
  assert.equal(next.workspaces[0].name, "新工作区");
});

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}
