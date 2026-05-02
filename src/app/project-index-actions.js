export async function refreshProjectIndexSummaryAction({
  readProjectIndexSummary = async () => null,
  setProjectIndexSummary = () => {},
  logger = console,
} = {}) {
  try {
    const summary = await readProjectIndexSummary();
    setProjectIndexSummary(summary || null);
    return summary || null;
  } catch (error) {
    logger?.warn?.("Failed to read project SQLite index summary", error);
    return null;
  }
}

export async function syncProjectIndexToSqliteAction({
  buildProjectIndexPayload,
  projectState = {},
  mediaCacheReport = {},
  currentProjectPath = "",
  deletionAudit = [],
  syncProjectIndex = async () => null,
  setProjectIndexSummary = () => {},
} = {}) {
  const payload = buildProjectIndexPayload(projectState, mediaCacheReport, {
    projectPath: currentProjectPath,
    deletionAudit,
  });
  const summary = await syncProjectIndex({
    projectPath: currentProjectPath,
    payload,
  });
  setProjectIndexSummary(summary || null);
  return summary || null;
}

export async function rebuildProjectIndexAction({
  isRuntimeAvailable = () => false,
  syncProjectIndexToSqlite = async () => null,
  setProjectMessage = () => {},
  deletionAudit = [],
} = {}) {
  if (!isRuntimeAvailable()) return null;
  const summary = await syncProjectIndexToSqlite(deletionAudit);
  setProjectMessage("SQLite 项目索引已重建。");
  return summary;
}

export async function searchProjectIndexAction({
  isRuntimeAvailable = () => false,
  searchProjectIndex = async () => ({ items: [] }),
  query = "",
  limit = 40,
} = {}) {
  if (!isRuntimeAvailable()) return { items: [] };
  return searchProjectIndex({ query, limit });
}

export function openProjectIndexSearchResultAction({
  item,
  setActiveEpisodeId = () => {},
  setTimelineFocusClipId = () => {},
  setShowTimeline = () => {},
  setProjectMessage = () => {},
  locateNode = () => {},
  clipboard,
} = {}) {
  const raw = parseIndexResultJson(item?.rawJson || "");
  if (item?.kind === "timelineClip") {
    if (raw.episodeId) setActiveEpisodeId(raw.episodeId);
    setTimelineFocusClipId(raw.id || item.id || "");
    setShowTimeline(true);
    setProjectMessage(`已定位到时间线片段 ${raw.title || raw.shotId || item.title || ""}`);
    return { type: "timelineClip", raw };
  }
  const nodeId = raw.sourceNodeId || raw.nodeId || (item?.kind === "node" || item?.kind === "task" ? item.path : "");
  if (nodeId) {
    locateNode(nodeId);
    if (item?.kind === "shot") setProjectMessage(`已定位到镜头 ${raw.id || item.title || ""}`);
    return { type: "node", nodeId, raw };
  }
  if (item?.path) {
    clipboard?.writeText?.(item.path)?.catch?.(() => {});
    setProjectMessage("索引结果没有可定位节点，已尝试复制路径。");
    return { type: "path", path: item.path, raw };
  }
  return { type: "none", raw };
}

export function parseIndexResultJson(rawJson) {
  try {
    return rawJson ? JSON.parse(rawJson) : {};
  } catch {
    return {};
  }
}
