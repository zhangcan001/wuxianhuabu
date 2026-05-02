export async function refreshMediaCacheIndexAction({
  listMediaCache = async () => ({}),
  setMediaCacheFiles = () => {},
  logger = console,
} = {}) {
  try {
    const result = await listMediaCache();
    const files = Array.isArray(result?.files) ? result.files : [];
    setMediaCacheFiles(files);
    return { ok: true, files };
  } catch (error) {
    logger?.warn?.("Failed to list media cache", error);
    return { ok: false, files: [], error };
  }
}

export async function exportMediaCacheCleanupReportAction({
  buildMediaCacheCleanupReport,
  reportInput = {},
  mediaCacheFiles = [],
  reviewDecisions = {},
  deletionAudit = [],
  saveExportArtifact = async () => {},
  fileName = "project-media-cache-report.json",
} = {}) {
  const cleanupReport = buildMediaCacheCleanupReport(reportInput, mediaCacheFiles, { reviewDecisions, deletionAudit });
  await saveExportArtifact(fileName, "json", JSON.stringify(cleanupReport, null, 2));
  return cleanupReport;
}

export async function deleteSelectedMediaCacheFilesAction({
  paths = [],
  deleteMediaCacheFiles = async () => ({}),
  refreshMediaCacheIndex = async () => {},
} = {}) {
  const result = await deleteMediaCacheFiles({ paths });
  await refreshMediaCacheIndex();
  return result;
}
