import {
  createProjectResourceFromFile,
  normalizeProjectResource,
} from "../project-resource-helpers.js";

export async function importProjectResourcesAction({
  files = [],
  activeEpisodeId = "",
  summarizeText,
  persistMediaAsset,
  createResourceFromFile = createProjectResourceFromFile,
  pushHistory = () => {},
  setResources = () => {},
  setShowResources = () => {},
  openResourceWorkbench = null,
  setProjectMessage = () => {},
} = {}) {
  if (!files.length) return { ok: true, skipped: true, resources: [] };
  try {
    const imported = await Promise.all(files.map((file) => createResourceFromFile(file, activeEpisodeId, {
      summarizeText,
      persistMediaAsset,
    })));
    const normalized = imported
      .filter(Boolean)
      .map((resource, index) => normalizeProjectResource(resource, activeEpisodeId, index));
    if (!normalized.length) return { ok: true, skipped: true, resources: [] };
    pushHistory();
    setResources((current) => [...current, ...normalized]);
    if (typeof openResourceWorkbench === "function") {
      openResourceWorkbench(normalized);
    } else {
      setShowResources(true);
    }
    const metadataOnly = normalized.filter((item) => item.storageMode === "metadata").length;
    setProjectMessage(metadataOnly
      ? `已导入 ${normalized.length} 个资源，其中 ${metadataOnly} 个大文件仅保存元信息`
      : `已导入 ${normalized.length} 个项目资源`);
    return { ok: true, resources: normalized, metadataOnly };
  } catch (error) {
    setProjectMessage(`导入资源失败：${String(error)}`);
    return { ok: false, error };
  }
}

export function updateProjectResourceList(resources = [], resourceId, patch = {}) {
  return resources.map((item) => (
    item.id === resourceId ? normalizeProjectResource({ ...item, ...patch }, item.episodeId) : item
  ));
}

export function deleteProjectResourceList(resources = [], resourceId) {
  return resources.filter((item) => item.id !== resourceId);
}

export function updateProjectResourceAction({
  resourceId,
  patch,
  setResources = () => {},
} = {}) {
  setResources((current) => updateProjectResourceList(current, resourceId, patch));
}

export function deleteProjectResourceAction({
  resourceId,
  pushHistory = () => {},
  setResources = () => {},
} = {}) {
  pushHistory();
  setResources((current) => deleteProjectResourceList(current, resourceId));
}
