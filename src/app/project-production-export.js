export function buildAssetsStoryboardExportPackage({
  project = {},
  episode = null,
  timeline = {},
  resources = [],
  exportedAt = new Date().toISOString(),
} = {}) {
  const activeEpisode = episode || project.activeEpisode || {};
  const assets = Array.isArray(activeEpisode.assets) ? activeEpisode.assets : [];
  const shots = Array.isArray(activeEpisode.shots) ? activeEpisode.shots : [];
  const clips = Array.isArray(activeEpisode.timeline?.clips)
    ? activeEpisode.timeline.clips
    : Array.isArray(timeline?.clips) ? timeline.clips : [];
  const assetRegistry = buildAssetRegistry(assets);
  const storyboardPackage = buildStoryboardPackage(shots, assets, clips);
  return {
    packageType: "wuxianhuabu.assets_storyboard_export",
    schemaVersion: "1.0.0",
    exportedAt,
    project: {
      id: project.id || project.projectId || "",
      name: project.name || project.projectName || "",
    },
    episode: {
      id: activeEpisode.id || "",
      name: activeEpisode.name || activeEpisode.title || "当前集",
    },
    assetRegistry,
    storyboardPackage,
    resources: (Array.isArray(resources) ? resources : []).map(normalizeResourceExportItem),
    markdown: buildAssetsStoryboardMarkdown({
      project,
      episode: activeEpisode,
      assetRegistry,
      storyboardPackage,
      exportedAt,
    }),
  };
}

export function stringifyAssetsStoryboardExportPackage(input = {}) {
  return JSON.stringify(buildAssetsStoryboardExportPackage(input), null, 2);
}

export function buildAssetsStoryboardExportFileName(episode = {}, safeFileName = defaultSafeFileName) {
  const title = episode?.name || episode?.title || episode?.id || "episode";
  return `${safeFileName(`${title}-assets-storyboard`)}.json`;
}

export async function exportAssetsAndStoryboardAction({
  commercialProject = {},
  activeEpisodeId = "",
  timeline = {},
  resources = [],
  getEpisodeTimeline,
  defaultEpisodeTimeline,
  safeFileName = defaultSafeFileName,
  saveExportArtifact,
  setProjectMessage,
  openProductionStudioView,
} = {}) {
  const episode = commercialProject?.activeEpisode || {};
  const hasAssets = Array.isArray(episode.assets) && episode.assets.length;
  const hasShots = Array.isArray(episode.shots) && episode.shots.length;
  if (!hasAssets && !hasShots) {
    setProjectMessage?.("当前集还没有可导出的资产或分镜。");
    return null;
  }
  const fileName = buildAssetsStoryboardExportFileName(episode, safeFileName);
  const content = stringifyAssetsStoryboardExportPackage({
    project: commercialProject,
    episode,
    timeline: getEpisodeTimeline(timeline, episode.id || activeEpisodeId, { defaultEpisodeTimeline }),
    resources,
  });
  const result = await saveExportArtifact(fileName, "json", content);
  if (result?.path) openProductionStudioView?.("delivery", `资产与分镜已导出：${result.path}`);
  return result;
}

export function buildAssetsStoryboardMarkdown({
  project = {},
  episode = {},
  assetRegistry = {},
  storyboardPackage = {},
  exportedAt = "",
} = {}) {
  const assets = assetRegistry.assets || [];
  const shots = storyboardPackage.shots || [];
  return [
    `# ${episode.name || episode.title || "当前集"} 资产与分镜导出`,
    "",
    `项目：${project.name || project.projectName || project.id || "未命名项目"}`,
    `导出时间：${exportedAt}`,
    "",
    `## 资产 ${assets.length}`,
    ...assets.flatMap((asset, index) => [
      "",
      `### ${index + 1}. ${asset.assetName || asset.token || asset.assetId}`,
      `- 类型：${asset.assetType || ""}`,
      `- Token：${asset.token || ""}`,
      `- 主图：${asset.imageUrl || asset.imagePath || ""}`,
      `- 完整提示词：`,
      codeBlock(formatPromptMap(asset.prompts)),
      `- 视觉锁定：${formatList(asset.visualLock)}`,
      `- 连续性：${formatContinuity(asset.continuityRule)}`,
    ]),
    "",
    `## 分镜 ${shots.length}`,
    ...shots.flatMap((shot, index) => [
      "",
      `### ${index + 1}. ${shot.shotId || shot.id}`,
      `- 标题：${shot.title || ""}`,
      `- 场景：${shot.sceneId || shot.scene || ""}`,
      `- 资产引用：${formatAssetRefs(shot.assetRefs)}`,
      `- 图片提示词：${shot.imagePrompt || ""}`,
      `- 视频提示词：${shot.videoPrompt || ""}`,
      `- 完整提示词：`,
      codeBlock(formatPromptMap(shot.prompts)),
      `- 图片：${shot.imageUrl || shot.imagePath || ""}`,
      `- 视频：${shot.videoUrl || shot.videoPath || ""}`,
    ]),
  ].join("\n");
}

function buildAssetRegistry(assets = []) {
  const normalized = assets.map((asset, index) => {
    const assetType = normalizeAssetType(asset.type || asset.category);
    const token = asset.token || asset.assetToken || "";
    const imageUrl = asset.imageUrl || asset.image?.url || asset.url || "";
    const imagePath = asset.imagePath || asset.image?.path || asset.path || "";
    return {
      assetId: asset.id || `${assetType || "asset"}-${index + 1}`,
      assetType,
      token,
      assetName: asset.name || asset.assetName || token || `资产${index + 1}`,
      prompt: asset.prompt || asset.description || "",
      prompts: collectAssetPrompts(asset),
      imageUrl,
      imagePath,
      thumbnailUrl: asset.thumbnailUrl || asset.imageThumbnailUrl || asset.image?.thumbnailUrl || "",
      visualLock: normalizeList(asset.visualLock || asset.visualLocks),
      continuityRule: normalizeContinuityRule(asset.continuityRule),
      referenceResources: normalizeList(asset.referenceResources),
      candidates: normalizeAssetCandidates(asset),
      raw: asset,
    };
  });
  return {
    schemaVersion: "cf_asset_export_v1.0",
    assets: normalized,
    assetIndex: {
      characters: normalized.filter((asset) => asset.assetType === "character").map((asset) => asset.token).filter(Boolean),
      scenes: normalized.filter((asset) => asset.assetType === "scene").map((asset) => asset.token).filter(Boolean),
      props: normalized.filter((asset) => asset.assetType === "prop").map((asset) => asset.token).filter(Boolean),
    },
  };
}

function buildStoryboardPackage(shots = [], assets = [], clips = []) {
  const assetByToken = new Map((Array.isArray(assets) ? assets : []).map((asset) => [String(asset.token || ""), asset]));
  const clipByShotId = new Map((Array.isArray(clips) ? clips : []).map((clip) => [String(clip.shotId || ""), clip]));
  const normalizedShots = (Array.isArray(shots) ? shots : []).map((shot, index) => {
    const shotId = shot.id || shot.shotId || `S${String(index + 1).padStart(2, "0")}`;
    const assetRefs = normalizeShotAssetRefs(shot, assetByToken);
    const clip = clipByShotId.get(String(shotId)) || {};
    return {
      shotId,
      id: shotId,
      episodeId: shot.episodeId || "",
      sceneId: shot.sceneId || shot.scene || "",
      index: Number(shot.index || index + 1),
      title: shot.title || shot.titleBar || shot.scene || "",
      scriptContent: shot.scriptContent || shot.action || shot.description || "",
      storyFunction: shot.storyFunction || shot.sceneFunction || "",
      frameIntent: shot.frameIntent || "",
      assetRefs,
      continuityLocks: normalizeList(shot.continuityLocks || shot.continuityNote),
      shotType: shot.shotType || shot.shotSize || "",
      camera: shot.camera || "",
      openingFrame: shot.openingFrame || shot.openingState || "",
      action: shot.action || "",
      closingFrame: shot.closingFrame || shot.closingState || "",
      transition: shot.transition || "",
      imagePrompt: shot.imagePrompt || shot.prompt?.image || "",
      videoPrompt: shot.videoPrompt || shot.prompt?.video || "",
      prompts: collectShotPrompts(shot),
      imageUrl: shot.imageUrl || shot.imageResultUrl || shot.imageResult || "",
      imagePath: shot.imagePath || "",
      videoUrl: shot.videoUrl || shot.videoResultUrl || shot.videoResult || "",
      videoPath: shot.videoPath || "",
      timelineClip: clip,
      raw: shot,
    };
  });
  return {
    schemaVersion: "cf_storyboard_export_v1.0",
    totalShots: normalizedShots.length,
    shots: normalizedShots,
    linkageChecklist: {
      allShotsHaveShotId: normalizedShots.every((shot) => Boolean(shot.shotId)),
      allShotsHaveImagePrompt: normalizedShots.every((shot) => Boolean(String(shot.imagePrompt || "").trim())),
      allShotsHaveVideoPrompt: normalizedShots.every((shot) => Boolean(String(shot.videoPrompt || "").trim())),
      allShotsUseAssetRefs: normalizedShots.every((shot) => Object.values(shot.assetRefs).some((items) => items.length)),
    },
  };
}

function normalizeShotAssetRefs(shot = {}, assetByToken = new Map()) {
  const tokens = [
    shot.mainCharacterToken,
    shot.mainSceneToken,
    ...normalizeList(shot.keyPropTokens),
    ...normalizeList(shot.assetRefs),
  ].filter(Boolean);
  const grouped = { characters: [], scenes: [], props: [], other: [] };
  tokens.forEach((token) => {
    const asset = assetByToken.get(String(token));
    const type = normalizeAssetType(asset?.type || asset?.category);
    if (type === "character" || /^@角色/.test(token)) grouped.characters.push(token);
    else if (type === "scene" || /^@场景/.test(token)) grouped.scenes.push(token);
    else if (type === "prop" || /^@道具/.test(token)) grouped.props.push(token);
    else grouped.other.push(token);
  });
  return {
    characters: unique(grouped.characters),
    scenes: unique(grouped.scenes),
    props: unique(grouped.props),
    other: unique(grouped.other),
  };
}

function normalizeAssetCandidates(asset = {}) {
  const items = [
    ...(Array.isArray(asset.imageItems) ? asset.imageItems : []),
    ...(Array.isArray(asset.mediaRefs) ? asset.mediaRefs.filter((ref) => ref?.kind === "image") : []),
  ];
  if ((asset.imageUrl || asset.imagePath) && !items.length) items.push({ imageUrl: asset.imageUrl || "", imagePath: asset.imagePath || "", primary: true });
  return items.map((item, index) => ({
    id: item.id || `asset-image-${index + 1}`,
    imageUrl: item.imageUrl || item.url || "",
    imagePath: item.imagePath || item.path || item.localPath || "",
    thumbnailUrl: item.thumbnailUrl || item.imageThumbnailUrl || "",
    primary: Boolean(item.primary),
    locked: Boolean(item.locked),
  }));
}

function collectAssetPrompts(asset = {}) {
  return compactPromptMap({
    main: asset.prompt || asset.description || asset.aiPrompt || "",
    nano_gemini: asset.promptOutput?.nano_gemini || asset.nano_gemini || asset.nanoGeminiPrompt || asset.geminiPrompt || "",
    open_model: asset.promptOutput?.open_model || asset.open_model || asset.openModelPrompt || asset.sdPrompt || asset.fluxPrompt || "",
    chatgpt_image2: asset.promptOutput?.chatgpt_image2 || asset.chatgpt_image2 || asset.chatgptImagePrompt || "",
    midjourney: asset.promptOutput?.midjourney || asset.midjourney || asset.mjPrompt || "",
    negative: asset.negativePrompt || asset.promptOutput?.negative || "",
    visualLock: formatList(asset.visualLock || asset.visualLocks),
    referenceResources: formatList(asset.referenceResources),
  });
}

function collectShotPrompts(shot = {}) {
  return compactPromptMap({
    mainPrompt: shot.mainPrompt || "",
    imagePrompt: shot.imagePrompt || shot.prompt?.image || "",
    videoPrompt: shot.videoPrompt || shot.prompt?.video || "",
    openingFrame: shot.openingFrame || shot.openingState || "",
    action: typeof shot.action === "object" ? JSON.stringify(shot.action, null, 2) : shot.action || "",
    closingFrame: shot.closingFrame || shot.closingState || "",
    camera: shot.camera || "",
    sound: typeof shot.sound === "object" ? JSON.stringify(shot.sound, null, 2) : shot.sound || "",
    compulsoryDeclaration: shot.compulsoryDeclaration || "",
    qualityBaseline: shot.qualityBaseline || "",
    continuityLocks: formatList(shot.continuityLocks || shot.continuityNote),
    negative: shot.negativePrompt || shot.prompt?.negative || "",
  });
}

function compactPromptMap(source = {}) {
  return Object.fromEntries(Object.entries(source)
    .map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])
    .filter(([, value]) => {
      if (Array.isArray(value)) return value.length;
      return value !== undefined && value !== null && String(value).trim();
    }));
}

function normalizeResourceExportItem(resource = {}) {
  return {
    id: resource.id || "",
    token: resource.token || "",
    name: resource.name || "",
    kind: resource.kind || "",
    path: resource.path || "",
    previewUrl: resource.previewUrl || resource.dataUrl || "",
    note: resource.note || "",
  };
}

function normalizeAssetType(value = "") {
  const text = String(value || "").toLowerCase();
  if (text.includes("character") || text.includes("角色") || text === "char") return "character";
  if (text.includes("scene") || text.includes("场景")) return "scene";
  if (text.includes("prop") || text.includes("道具")) return "prop";
  return text || "asset";
}

function normalizeContinuityRule(value) {
  if (value && typeof value === "object") return value;
  const text = String(value || "").trim();
  return text ? { immutable: [text], variable: [], stageVariants: [] } : { immutable: [], variable: [], stageVariants: [] };
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  return String(value || "")
    .split(/[,\n，、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(items = []) {
  return [...new Set(items.filter(Boolean))];
}

function formatList(items = []) {
  const normalized = normalizeList(items);
  return normalized.length ? normalized.join("；") : "无";
}

function formatContinuity(rule = {}) {
  if (!rule || typeof rule !== "object") return String(rule || "无");
  return [
    rule.immutable?.length ? `不可变：${rule.immutable.join("、")}` : "",
    rule.variable?.length ? `可变：${rule.variable.join("、")}` : "",
  ].filter(Boolean).join("；") || "无";
}

function formatAssetRefs(assetRefs = {}) {
  return [
    ...(assetRefs.characters || []),
    ...(assetRefs.scenes || []),
    ...(assetRefs.props || []),
    ...(assetRefs.other || []),
  ].join("、") || "无";
}

function formatPromptMap(prompts = {}) {
  const entries = Object.entries(prompts || {}).filter(([, value]) => String(value || "").trim());
  if (!entries.length) return "无";
  return entries.map(([key, value]) => `【${key}】\n${String(value).trim()}`).join("\n\n");
}

function codeBlock(value = "") {
  return ["```text", value || "无", "```"].join("\n");
}

function defaultSafeFileName(value = "") {
  return String(value || "episode-assets-storyboard").replace(/[\\/:*?"<>|]+/g, "-");
}
