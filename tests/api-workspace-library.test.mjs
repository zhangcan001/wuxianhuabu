import assert from "node:assert/strict";
import test from "node:test";

import {
  API_WORKSPACE_LIBRARY_KEY,
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
