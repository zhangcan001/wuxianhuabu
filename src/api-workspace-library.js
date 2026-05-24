export const API_WORKSPACE_LIBRARY_KEY = "wuxianhuabu.apiWorkspaceLibrary.v1";

export function normalizeApiWorkspaceLibrary(raw) {
  const library = raw && typeof raw === "object" ? raw : {};
  return {
    workspaces: Array.isArray(library.workspaces) ? library.workspaces : [],
    activeWorkspaceId: String(library.activeWorkspaceId || ""),
  };
}

export function createApiWorkspaceEntry({
  id = "",
  name = "",
  textSettings = {},
  mediaSettings = {},
  now = () => new Date().toISOString(),
} = {}) {
  return {
    id: String(id || ""),
    name: String(name || "").trim() || "新工作区",
    updatedAt: typeof now === "function" ? now() : new Date().toISOString(),
    textSettings: textSettings && typeof textSettings === "object" ? textSettings : {},
    mediaSettings: mediaSettings && typeof mediaSettings === "object" ? mediaSettings : {},
  };
}

export function addApiWorkspaceToLibrary(library, workspace) {
  const normalized = normalizeApiWorkspaceLibrary(library);
  const entry = createApiWorkspaceEntry(workspace);
  if (!entry.id) {
    return normalized;
  }
  return {
    ...normalized,
    activeWorkspaceId: entry.id,
    workspaces: [entry, ...normalized.workspaces.filter((item) => item?.id !== entry.id)],
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
