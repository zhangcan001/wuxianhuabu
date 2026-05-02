export function appendExportHistoryAction({
  entry,
  setExportHistory = () => {},
  upsertExportHistoryEntry = (current, next) => [...(current || []), next],
} = {}) {
  setExportHistory((current) => upsertExportHistoryEntry(current, entry));
  return entry;
}

export async function copyExportPresetSummaryAction({
  preset,
  clipboard,
} = {}) {
  if (!preset) return "";
  const summary = [
    `导出预设：${preset.name}`,
    `标签：${preset.stageTag || "自定义"}`,
    `分辨率：${preset.width}x${preset.height}`,
    `FPS：${preset.fps}`,
    `编码预设：${preset.encodePreset}`,
    `CRF：${preset.crf}`,
    `锁定：${preset.locked ? "是" : "否"}`,
    `说明：${preset.note || ""}`,
  ].join("\n");
  await clipboard?.writeText?.(summary);
  return summary;
}

export async function saveExportArtifactAction({
  fileName,
  extension,
  content,
  isRuntimeAvailable = () => false,
  saveExportFile = async () => ({}),
  createBrowserTextDownload = () => "",
  appendExportHistory = () => {},
  setProjectMessage = () => {},
  activeEpisodeId = "",
  episodeName = "当前集",
} = {}) {
  if (!content) {
    setProjectMessage("当前没有可导出的内容");
    return null;
  }

  if (isRuntimeAvailable()) {
    try {
      const result = await saveExportFile({ fileName, extension, content });
      if (result?.path) {
        appendExportHistory(buildArtifactHistoryEntry({ fileName, extension, path: result.path, activeEpisodeId, episodeName }));
        setProjectMessage(`已导出：${result.path}`);
      }
      return result || null;
    } catch (error) {
      setProjectMessage(`导出失败：${String(error)}`);
      return null;
    }
  }

  createBrowserTextDownload({ fileName, content });
  appendExportHistory(buildArtifactHistoryEntry({ fileName, extension, path: fileName, activeEpisodeId, episodeName }));
  setProjectMessage(`已导出：${fileName}`);
  return { path: fileName };
}

export async function saveDeliveryPackageArtifactAction({
  fileName,
  packageContent,
  options = {},
  isRuntimeAvailable = () => false,
  saveDeliveryPackage = async () => ({}),
  saveExportArtifact = async () => ({}),
  appendExportHistory = () => {},
  setProjectMessage = () => {},
  activeEpisodeId = "",
  episodeName = "当前集",
} = {}) {
  if (!packageContent) {
    setProjectMessage("当前没有可导出的工程包内容");
    return null;
  }
  if (isRuntimeAvailable()) {
    const result = await saveDeliveryPackage({
      fileName,
      packageJson: packageContent,
    });
    if (result?.path) {
      if (!options.skipHistory) {
        appendExportHistory({
          requestId: options.requestId || "",
          type: "package",
          status: "done",
          title: fileName,
          detail: "Zip 工程包",
          path: result.path,
          episodeId: activeEpisodeId,
          episodeName,
        });
      }
      setProjectMessage(`工程包已导出：${result.path}`);
    }
    return result || null;
  }
  await saveExportArtifact(`${fileName}.json`, "json", packageContent);
  return { path: `${fileName}.json` };
}

export async function exportEpisodeCoverAction({
  imageUrl = "",
  episodeName = "episode",
  saveImageToDownloads = async () => ({}),
  safeFileName = (value) => String(value || "episode"),
  appendExportHistory = () => {},
  setProjectMessage = () => {},
  activeEpisodeId = "",
} = {}) {
  if (!imageUrl) {
    setProjectMessage("当前时间线还没有可用封面图");
    return null;
  }
  try {
    const result = await saveImageToDownloads({
      imageUrl,
      fileName: safeFileName(`${episodeName || "episode"}-cover`),
    });
    appendExportHistory({
      type: "cover",
      status: "done",
      title: `${episodeName || "episode"} 封面图`,
      detail: "封面",
      path: result.path,
      episodeId: activeEpisodeId,
      episodeName: episodeName || "当前集",
    });
    setProjectMessage(`封面已保存：${result.path}`);
    return result;
  } catch (error) {
    setProjectMessage(`封面导出失败：${String(error)}`);
    return null;
  }
}

export function requeueExportHistoryItemAction({
  itemId = "",
  exportHistory = [],
  episodes = [],
  timeline = {},
  resourceIndex = {},
  getEpisodeTimeline,
  defaultEpisodeTimeline,
  queueEpisodeRender = () => {},
  setProjectMessage = () => {},
} = {}) {
  const item = exportHistory.find((entry) => entry.id === itemId);
  if (!item?.episodeId || !item.renderOptions) {
    setProjectMessage("这条导出历史暂时不能重新入队。");
    return { matched: 0 };
  }
  const episode = episodes.find((entry) => entry.id === item.episodeId);
  if (!episode) {
    setProjectMessage("对应的集信息不存在，无法重新入队。");
    return { matched: 0 };
  }
  const episodeTimeline = getEpisodeTimeline(timeline, item.episodeId, { defaultEpisodeTimeline });
  queueEpisodeRender(episode, episodeTimeline, resourceIndex, item.renderOptions);
  return { matched: 1, item };
}

export function requeueExportHistoryItemsAction({
  itemIds = [],
  exportHistory = [],
  episodes = [],
  timeline = {},
  resourceIndex = {},
  getEpisodeTimeline,
  defaultEpisodeTimeline,
  queueEpisodeRender = () => {},
  setProjectMessage = () => {},
} = {}) {
  const targets = new Set((Array.isArray(itemIds) ? itemIds : []).filter(Boolean));
  let matched = 0;
  (exportHistory || []).forEach((item) => {
    if (!targets.has(item.id)) return;
    if (!item?.episodeId || !item.renderOptions) return;
    const episode = episodes.find((entry) => entry.id === item.episodeId);
    if (!episode) return;
    const episodeTimeline = getEpisodeTimeline(timeline, item.episodeId, { defaultEpisodeTimeline });
    queueEpisodeRender(episode, episodeTimeline, resourceIndex, item.renderOptions);
    matched += 1;
  });
  setProjectMessage(matched ? `已重新入队 ${matched} 条导出历史` : "当前筛选没有可重新入队的导出历史");
  return { matched };
}

function buildArtifactHistoryEntry({ fileName, extension, path, activeEpisodeId, episodeName }) {
  return {
    type: "artifact",
    status: "done",
    title: fileName,
    detail: String(extension || "").toUpperCase(),
    path,
    episodeId: activeEpisodeId,
    episodeName,
  };
}
