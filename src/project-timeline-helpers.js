export function defaultTimelineState() {
  return { byEpisode: {} };
}

export function normalizeTimelineClip(clip, index = 0) {
  return {
    id: clip?.id || `clip-${Date.now()}-${index}`,
    shotId: clip?.shotId || `S${String(index + 1).padStart(2, "0")}`,
    sourceNodeId: clip?.sourceNodeId || "",
    title: clip?.title || clip?.shotId || `镜头${index + 1}`,
    scene: clip?.scene || "",
    duration: clip?.duration || "4秒",
    transition: clip?.transition || "直切",
    mediaUrl: clip?.mediaUrl || "",
    mediaType: clip?.mediaType || "image",
    approvalStatus: clip?.approvalStatus || "待验收",
    approvalNote: clip?.approvalNote || "",
    note: clip?.note || "",
  };
}

export function normalizeTimelineState(timeline, fallbackEpisodeId, options = {}) {
  const defaultEpisodeTimeline = options.defaultEpisodeTimeline || (() => ({ clips: [] }));
  const source = timeline && typeof timeline === "object" ? timeline : defaultTimelineState();
  const byEpisode = { ...(source.byEpisode || {}) };
  if (fallbackEpisodeId && !byEpisode[fallbackEpisodeId]) byEpisode[fallbackEpisodeId] = defaultEpisodeTimeline();
  Object.keys(byEpisode).forEach((episodeId) => {
    const episode = byEpisode[episodeId] || defaultEpisodeTimeline();
    byEpisode[episodeId] = {
      clips: Array.isArray(episode.clips) ? episode.clips.map((clip, index) => normalizeTimelineClip(clip, index)) : [],
    };
  });
  return { byEpisode };
}

export function timelineForStorage(timeline, options = {}) {
  const normalized = normalizeTimelineState(timeline, undefined, options);
  return {
    byEpisode: Object.fromEntries(Object.entries(normalized.byEpisode).map(([episodeId, episode]) => [
      episodeId,
      {
        clips: episode.clips.map((clip) => ({ ...clip })),
      },
    ])),
  };
}

export function getEpisodeTimeline(timeline, episodeId, options = {}) {
  const defaultEpisodeTimeline = options.defaultEpisodeTimeline || (() => ({ clips: [] }));
  return normalizeTimelineState(timeline, episodeId, options).byEpisode[episodeId] || defaultEpisodeTimeline();
}

export function buildEpisodeTimelineSources(nodes, activeEpisodeId, resourceIndex, options = {}) {
  const normalizeShotRecord = options.normalizeShotRecord || ((shot) => shot);
  const pickTimelineResultUrl = options.pickTimelineResultUrl || (() => "");
  const expandResourceReferences = options.expandResourceReferences || ((text) => String(text || ""));
  const sources = [];
  (nodes || [])
    .filter((node) => node.type === "shotList" && (node.data?.episodeId || activeEpisodeId) === activeEpisodeId)
    .forEach((node) => {
      (node.data.shots || []).forEach((shot, index) => {
        const normalized = normalizeShotRecord(shot, index);
        const mediaUrl = normalized.videoResultUrl
          || normalized.imageResultUrl
          || pickTimelineResultUrl(nodes, node.id, normalized.id)
          || "";
        const mediaPath = normalized.videoPath
          || normalized.imagePath
          || (isLocalTimelinePath(normalized.lastQueueResult) ? normalized.lastQueueResult : "")
          || "";
        const mediaTypeProbe = mediaPath || mediaUrl;
        sources.push({
          shotId: normalized.id,
          sourceNodeId: node.id,
          title: normalized.id,
          scene: normalized.scene || "",
          duration: normalized.duration || "4秒",
          transition: "直切",
          mediaUrl,
          mediaPath,
          mediaType: /\.(mp4|webm|mov)$/i.test(mediaTypeProbe || "") ? "video" : "image",
          note: normalized.referenceResources ? expandResourceReferences(normalized.referenceResources, resourceIndex) : "",
        });
      });
    });
  return sources;
}

function isLocalTimelinePath(value = "") {
  return /^[a-zA-Z]:[\\/]/.test(String(value || "")) || String(value || "").startsWith("\\\\") || String(value || "").startsWith("/");
}

export function buildEpisodeExportBundle(episode, timeline, shots, resourceIndex, options = {}) {
  const defaultEpisodeTimeline = options.defaultEpisodeTimeline || (() => ({ clips: [] }));
  const formatTimelineText = options.formatTimelineText || (() => "");
  const buildPublishingPlan = options.buildPublishingPlan || (() => ({}));
  const normalizeShotRecord = options.normalizeShotRecord || ((shot) => shot);
  const buildShotQualityReport = options.buildShotQualityReport || (() => ({ score: 0, summary: "" }));
  const extractAssetTokens = options.extractAssetTokens || (() => []);
  const buildProjectArchiveBundle = options.buildProjectArchiveBundle || (() => ({}));
  const parseDurationSeconds = options.parseDurationSeconds || ((value) => Number(value || 0));

  const clips = timeline?.clips || [];
  const markdown = formatTimelineText(episode?.name || "当前集", timeline || defaultEpisodeTimeline());
  const landscapePlan = buildPublishingPlan(clips, shots, "16:9");
  const portraitPlan = buildPublishingPlan(clips, shots, "9:16");
  const shotQuality = (shots || []).map((shot) => ({ shot: normalizeShotRecord(shot), report: buildShotQualityReport(shot) }));
  const weakShotReports = shotQuality.filter((item) => item.report.score < 72);
  const unreviewedShots = shotQuality.filter((item) => !["已通过", "搁置"].includes(item.shot.reviewStatus || "未审"));
  const missingMediaClips = clips.filter((clip) => !String(clip.mediaUrl || "").trim());
  const pendingApprovalClips = clips.filter((clip) => String(clip.approvalStatus || "待验收") !== "已通过");
  const qualityCheck = {
    averageShotScore: shotQuality.length ? Math.round(shotQuality.reduce((sum, item) => sum + item.report.score, 0) / shotQuality.length) : 0,
    weakShots: weakShotReports.map((item) => ({ id: item.shot.id, score: item.report.score, summary: item.report.summary })),
    unreviewedShots: unreviewedShots.map((item) => ({ id: item.shot.id, reviewStatus: item.shot.reviewStatus || "未审" })),
    missingSubtitleClips: [],
    missingMediaClips: missingMediaClips.map((clip) => clip.title || clip.shotId || "未命名片段"),
    pendingApprovalClips: pendingApprovalClips.map((clip) => `${clip.title || clip.shotId || "未命名片段"}(${clip.approvalStatus || "待验收"})`),
    readyToRender: clips.length > 0 && !missingMediaClips.length && !pendingApprovalClips.length && !weakShotReports.length && !unreviewedShots.length,
  };
  const manifestObject = {
    episode: {
      id: episode?.id || "",
      name: episode?.name || "当前集",
    },
    timeline: {
      totalClips: clips.length,
      totalSeconds: clips.reduce((sum, clip) => sum + parseDurationSeconds(clip.duration), 0),
    },
    clips: clips.map((clip) => {
      const shot = (shots || []).find((item) => item.id === clip.shotId);
      return {
        ...clip,
        assetRefs: shot?.assetRefs || extractAssetTokens(`${shot?.imagePrompt || ""} ${shot?.videoPrompt || ""}`),
        referenceResources: shot?.referenceResources || "",
      };
    }),
    qualityCheck,
  };
  const archiveObject = buildProjectArchiveBundle(episode, timeline || defaultEpisodeTimeline(), shots, resourceIndex, manifestObject, markdown, options);
  return {
    markdown,
    manifest: JSON.stringify(manifestObject, null, 2),
    landscapeManifest: JSON.stringify(landscapePlan, null, 2),
    portraitManifest: JSON.stringify(portraitPlan, null, 2),
    archiveBundle: JSON.stringify(archiveObject, null, 2),
    durationText: `${clips.reduce((sum, clip) => sum + parseDurationSeconds(clip.duration), 0)} 秒`,
    coverImage: clips.find((clip) => clip.mediaUrl)?.mediaUrl || "",
    aspectTargets: ["16:9", "9:16"],
    archiveCount: archiveObject.entries.length,
    qualityCheck,
  };
}

export function createRenderRequestId(prefix = "render") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildRenderVariantLabel(options = {}) {
  if (options.presetName) return options.presetName;
  const aspectLabel = options.aspectRatio === "9:16" ? "竖版" : "横版";
  return `${aspectLabel}成片`;
}

export function buildRenderDetailLabel(options = {}, fallback = "") {
  const parts = [fallback, options.presetName || "", options.encodePreset ? `preset ${options.encodePreset}` : "", options.crf ? `CRF ${options.crf}` : "", options.fps ? `${options.fps}fps` : ""].filter(Boolean);
  return parts.join(" · ");
}

export function buildRenderHistoryOptions(options = {}, request = null) {
  const width = Number(options.width || request?.width || 1920);
  const height = Number(options.height || request?.height || 1080);
  return {
    presetId: options.presetId || request?.presetId || "",
    presetName: options.presetName || request?.presetName || "",
    aspectRatio: height > width ? "9:16" : "16:9",
    width,
    height,
    fps: Number(options.fps || request?.fps || 30),
    encodePreset: options.encodePreset || request?.encodePreset || "veryfast",
    crf: Number(options.crf || request?.crf || 18),
  };
}

function renderClipLabel(clip, index) {
  return clip?.title || clip?.shotId || clip?.id || `片段${index + 1}`;
}

function normalizeRenderDurationSeconds(value) {
  return Number.isFinite(value) && value > 0 ? Math.max(0.3, value) : 0.3;
}

export function buildTimelineRenderReadinessReport(timeline, options = {}) {
  const clips = Array.isArray(timeline?.clips) ? timeline.clips : [];
  const parseDurationSeconds = options.parseDurationSeconds || ((value) => Number(value || 0));
  const missingMediaClips = [];
  const invalidDurationClips = [];
  let renderableClips = 0;

  clips.forEach((clip, index) => {
    const label = renderClipLabel(clip, index);
    const missingMedia = !String(clip?.mediaUrl || "").trim();
    if (missingMedia) {
      missingMediaClips.push(label);
    }
    const duration = parseDurationSeconds(clip?.duration);
    const invalidDuration = !Number.isFinite(duration) || duration <= 0;
    if (invalidDuration) {
      invalidDurationClips.push(label);
    }
    if (!missingMedia && !invalidDuration) renderableClips += 1;
  });

  const issues = [];
  if (!clips.length) issues.push("当前时间线没有片段");
  if (missingMediaClips.length) issues.push(`缺少素材：${missingMediaClips.slice(0, 4).join("、")}`);
  if (invalidDurationClips.length) issues.push(`时长无效：${invalidDurationClips.slice(0, 4).join("、")}`);

  return {
    canRender: issues.length === 0,
    issues,
    totalClips: clips.length,
    renderableClips,
    missingMediaClips,
    invalidDurationClips,
  };
}

export function buildRenderOptionsFromExportPreset(preset) {
  if (!preset) return {};
  return {
    presetId: preset.id,
    presetName: preset.name,
    aspectRatio: preset.height > preset.width ? "9:16" : "16:9",
    width: preset.width,
    height: preset.height,
    fps: preset.fps,
    encodePreset: preset.encodePreset,
    crf: preset.crf,
  };
}

export function buildEpisodeRenderRequest(episode, timeline, resourceIndex, options = {}) {
  const parseDurationSeconds = options.parseDurationSeconds || ((value) => Number(value || 0));
  const createRequestId = options.createRenderRequestId || createRenderRequestId;
  const clips = (timeline?.clips || [])
    .filter((clip) => String(clip.mediaUrl || "").trim())
    .map((clip) => ({
      title: clip.title || clip.shotId || "片段",
      mediaUrl: clip.mediaPath || clip.mediaUrl,
      mediaType: clip.mediaType === "video" ? "video" : "image",
      durationSeconds: normalizeRenderDurationSeconds(parseDurationSeconds(clip.duration)),
    }));
  return {
    requestId: options.requestId || createRequestId(`render-${episode?.id || "episode"}`),
    presetId: options.presetId || "",
    presetName: options.presetName || "",
    episodeName: episode?.name || "当前集",
    width: Number(options.width || (options.aspectRatio === "9:16" ? 1080 : 1920)),
    height: Number(options.height || (options.aspectRatio === "9:16" ? 1920 : 1080)),
    fps: Number(options.fps || 30),
    encodePreset: options.encodePreset || "veryfast",
    crf: Number(options.crf || 18),
    clips,
  };
}

export function buildProjectExportSummary(episodes, timeline, options = {}) {
  const getEpisodeTimeline = options.getEpisodeTimeline || ((value, episodeId) => value?.byEpisode?.[episodeId] || { clips: [] });
  const parseDurationSeconds = options.parseDurationSeconds || ((value) => Number(value || 0));
  return (episodes || []).map((episode) => {
    const episodeTimeline = getEpisodeTimeline(timeline, episode.id, options);
    const clips = episodeTimeline.clips || [];
    const readyClips = clips.filter((clip) => String(clip.mediaUrl || "").trim()).length;
    const approvedClips = clips.filter((clip) => String(clip.approvalStatus || "待验收") === "已通过").length;
    const deliveryIssues = [];
    if (!clips.length) deliveryIssues.push("无时间线片段");
    if (clips.length && readyClips < clips.length) deliveryIssues.push("片段素材未挂全");
    if (clips.length && approvedClips < clips.length) deliveryIssues.push("时间线片段未全部通过验收");
    return {
      id: episode.id,
      name: episode.name || "当前集",
      clipCount: clips.length,
      readyClips,
      approvedClips,
      durationText: `${clips.reduce((sum, clip) => sum + parseDurationSeconds(clip.duration), 0)} 秒`,
      ready: clips.length > 0 && readyClips === clips.length && approvedClips === clips.length,
      deliveryIssues,
    };
  });
}

export function buildPublishingPlan(clips, shots, aspectRatio) {
  return {
    aspectRatio,
    clips: (clips || []).map((clip, index) => {
      const shot = (shots || []).find((item) => item.id === clip.shotId);
      return {
        order: index + 1,
        shotId: clip.shotId,
        title: clip.title,
        scene: clip.scene || shot?.scene || "",
        duration: clip.duration,
        recommendedCrop: aspectRatio === "9:16" ? "主体居中，优先脸部和动作区" : "保留环境左右信息和镜头空间关系",
        mediaUrl: clip.mediaUrl || "",
      };
    }),
  };
}

export function buildProjectArchiveBundle(episode, timeline, shots, resourceIndex, manifestObject, markdown, options = {}) {
  const safeFileName = options.safeFileName || ((name) => String(name || "episode"));
  const entries = [
    { kind: "timeline_markdown", fileName: `${safeFileName(episode?.name || "episode")}.md`, content: markdown },
    { kind: "manifest", fileName: `${safeFileName(episode?.name || "episode")}.json`, content: JSON.stringify(manifestObject, null, 2) },
  ];
  return {
    episode: {
      id: episode?.id || "",
      name: episode?.name || "当前集",
    },
    timeline: {
      clips: (timeline?.clips || []).length,
    },
    shots: (shots || []).map((shot) => ({
      id: shot.id,
      scene: shot.scene || "",
      duration: shot.duration || "",
      status: shot.status || "",
      reviewStatus: shot.reviewStatus || "",
    })),
    resources: (resourceIndex?.items || []).map((item) => ({
      token: item.token,
      name: item.name,
      kind: item.kind,
      note: item.note || "",
    })),
    entries,
  };
}

export function pickTimelineResultUrl(nodes, sourceNodeId, shotId) {
  const candidates = (nodes || []).filter((node) => node.type === "result" && node.data?.note?.includes(shotId) && (!sourceNodeId || node.data?.sourceNodeId === sourceNodeId || true));
  const latest = candidates[candidates.length - 1];
  return latest?.data?.videoUrl || latest?.data?.imageUrl || "";
}

export function createTimelineClip(source, index = 0) {
  return normalizeTimelineClip({
    id: `clip-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    ...source,
  }, index);
}

export function formatTimelineText(episodeName, timeline) {
  const lines = [`# ${episodeName} 时间线`, ""];
  (timeline?.clips || []).forEach((clip, index) => {
    lines.push(`## ${index + 1}. ${clip.title}｜${clip.scene || "未填场景"}`);
    lines.push(`时长：${clip.duration}`);
    lines.push(`转场：${clip.transition}`);
    lines.push(`验收：${clip.approvalStatus || "待验收"}`);
    if (clip.note) lines.push(`备注：${clip.note}`);
    if (clip.mediaUrl) lines.push(`素材：${clip.mediaUrl}`);
    lines.push("");
  });
  return lines.join("\n");
}
