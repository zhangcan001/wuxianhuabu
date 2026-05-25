export function persistProjectPath(storage, storageKey, path) {
  if (!storage) return;
  if (!path) {
    storage.removeItem(storageKey);
    return;
  }
  storage.setItem(storageKey, path);
}

export async function saveProjectThroughRuntime(options) {
  const {
    content,
    tauriRuntime,
    saveProjectFileImpl,
    documentImpl = typeof document !== "undefined" ? document : null,
    blobImpl = typeof Blob !== "undefined" ? Blob : null,
    urlImpl = typeof URL !== "undefined" ? URL : null,
    now = () => Date.now(),
  } = options;
  if (tauriRuntime) {
    return saveProjectFileImpl({ content });
  }
  const blob = new blobImpl([content], { type: "application/json" });
  const url = urlImpl.createObjectURL(blob);
  try {
    const link = documentImpl.createElement("a");
    link.href = url;
    link.download = `wuxianhuabu-${now()}.json`;
    link.click();
  } finally {
    urlImpl.revokeObjectURL(url);
  }
  return { path: "", downloaded: true };
}

export async function openProjectThroughRuntime(options) {
  const {
    tauriRuntime,
    openProjectFileImpl,
    fileInputRef,
  } = options;
  if (!tauriRuntime) {
    fileInputRef?.current?.click?.();
    return { content: "", path: "", browserFallback: true };
  }
  return openProjectFileImpl();
}

export async function openRecentProjectPath(path, options) {
  const { openProjectFileAtPathImpl } = options;
  return openProjectFileAtPathImpl({ path });
}

export async function saveProjectCacheThroughRuntime(options) {
  const {
    content,
    projectPath = "",
    tauriRuntime,
    saveProjectCacheImpl,
  } = options;
  if (!tauriRuntime) return { skipped: true };
  return saveProjectCacheImpl({
    content,
    projectPath,
  });
}

export async function loadProjectCacheThroughRuntime(options) {
  const {
    tauriRuntime,
    loadProjectCacheImpl,
  } = options;
  if (!tauriRuntime) return { content: "", projectPath: "", skipped: true };
  return loadProjectCacheImpl();
}

export async function clearProjectCacheThroughRuntime(options) {
  const {
    tauriRuntime,
    clearProjectCacheImpl,
  } = options;
  if (!tauriRuntime) return { cleared: false, skipped: true };
  return clearProjectCacheImpl();
}

export function parseProjectContent(content, normalizeProject) {
  if (!String(content || "").trim()) return null;
  return normalizeProject(JSON.parse(content));
}

export function buildProjectOpenedMessage(path) {
  return `已打开工程：${path}`;
}

export function buildProjectSavedMessage(path) {
  return `已保存工程：${path}`;
}
