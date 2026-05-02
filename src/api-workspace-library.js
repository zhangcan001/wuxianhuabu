export const API_WORKSPACE_LIBRARY_KEY = "wuxianhuabu.apiWorkspaceLibrary.v1";

export function normalizeApiWorkspaceLibrary(raw) {
  const library = raw && typeof raw === "object" ? raw : {};
  return {
    workspaces: Array.isArray(library.workspaces) ? library.workspaces : [],
    activeWorkspaceId: String(library.activeWorkspaceId || ""),
  };
}

export function loadApiWorkspaceLibrary({
  storage = globalThis.localStorage,
  storageKey = API_WORKSPACE_LIBRARY_KEY,
} = {}) {
  try {
    const raw = storage?.getItem?.(storageKey);
    return normalizeApiWorkspaceLibrary(raw ? JSON.parse(raw) : {});
  } catch {
    return normalizeApiWorkspaceLibrary({});
  }
}

export function saveApiWorkspaceLibrary(library, {
  storage = globalThis.localStorage,
  storageKey = API_WORKSPACE_LIBRARY_KEY,
} = {}) {
  try {
    storage?.setItem?.(storageKey, JSON.stringify(normalizeApiWorkspaceLibrary(library)));
  } catch {
    // Workspace presets are a convenience layer and should not block settings editing.
  }
}
