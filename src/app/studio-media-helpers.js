export function resolveUploadFilePath(file = null) {
  return String(file?.path || file?.filepath || file?.webkitRelativePath || "").trim();
}

export function readFileAsDataUrlFallback(file, errorMessage = "文件读取失败") {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error(errorMessage));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error(errorMessage));
    reader.readAsDataURL(file);
  });
}

export function buildStudioDeliveryOutputSpec(options = {}) {
  const platform = options.platform || "douyin";
  const aspectRatio = platform === "bilibili" ? "16:9" : "9:16";
  return {
    platform,
    aspectRatio,
    resolution: aspectRatio === "16:9" ? "1920x1080" : "1080x1920",
    fps: 24,
    container: options.format === "package" ? "zip" : "mp4",
  };
}

export function shouldWarnBrowserLargeVideoUpload(file = null, options = {}) {
  const limitBytes = Number(options.limitBytes || 200 * 1024 * 1024);
  return Boolean(file?.type?.startsWith("video/") && Number(file.size || 0) > limitBytes && !resolveUploadFilePath(file));
}

export function businessTimelineClipsToLegacyEpisodeTimeline(clips = []) {
  return {
    clips: (Array.isArray(clips) ? clips : []).map((clip, index) => ({
      id: clip.id || clip.shotId || `clip-${index + 1}`,
      shotId: clip.shotId || "",
      sourceNodeId: clip.sourceNodeId || "",
      title: clip.title || clip.shotId || `片段${index + 1}`,
      scene: clip.scene || "",
      duration: clip.duration || "4秒",
      transition: clip.transition || "直切",
      mediaUrl: clip.mediaUrl || clip.videoUrl || clip.imageUrl || "",
      mediaType: clip.mediaType || (/\.(mp4|webm|mov)$/i.test(clip.mediaUrl || clip.videoUrl || "") ? "video" : "image"),
      approvalStatus: clip.approvalStatus || clip.reviewStatus || "待验收",
      approvalNote: clip.approvalNote || "",
      note: clip.note || "",
    })),
  };
}

export function buildTimelineClipMediaPatchFromShot(shot = {}) {
  const mediaUrl = shot.videoUrl || shot.videoResultUrl || shot.videoResult || shot.imageUrl || shot.imageResultUrl || "";
  if (!mediaUrl) return null;
  return {
    mediaUrl,
    mediaType: /\.(mp4|webm|mov)$/i.test(mediaUrl) || Boolean(shot.videoUrl || shot.videoResultUrl || shot.videoResult) ? "video" : "image",
  };
}

export function buildStudioPackageHistoryEntry(input = {}) {
  const episode = input.episode || {};
  const deliveryPackage = input.deliveryPackage || {};
  return {
    requestId: input.requestId || `package-${Date.now()}`,
    type: "package",
    status: "queued",
    title: `${episode.title || episode.name || "当前集"} 工程包`,
    detail: `manifest ${deliveryPackage.manifest?.fileCount || 0} 个文件`,
    episodeId: episode.id || "",
    episodeName: episode.title || episode.name || "当前集",
    manifest: deliveryPackage.manifest || null,
  };
}

export function buildStudioDeliveryPackageContent(input = {}) {
  const project = input.businessProject || {};
  const episode = input.episode || project.activeEpisode || {};
  const deliveryPackage = input.deliveryPackage || {};
  return JSON.stringify({
    packageVersion: 1,
    exportedAt: new Date().toISOString(),
    project: {
      id: project.id || "",
      name: project.name || "",
    },
    episode: {
      id: episode.id || "",
      title: episode.title || episode.name || "",
    },
    manifest: deliveryPackage.manifest || {},
    outputSpec: input.outputSpec || deliveryPackage.outputSpec || {},
    timeline: episode.timeline || { clips: [] },
    shots: episode.shots || [],
    assets: episode.assets || [],
    mediaReferences: collectStudioPackageMediaReferences(episode),
  }, null, 2);
}

export function collectStudioPackageMediaReferences(episode = {}) {
  const refs = [];
  (episode.shots || []).forEach((shot) => {
    if (shot.imagePath || shot.imageUrl) refs.push(buildPackageMediaReference({ owner: "shot", id: shot.id || "", kind: "image", path: shot.imagePath || "", url: shot.imageUrl || "" }, refs.length));
    if (shot.videoPath || shot.videoUrl) refs.push(buildPackageMediaReference({ owner: "shot", id: shot.id || "", kind: "video", path: shot.videoPath || "", url: shot.videoUrl || "" }, refs.length));
  });
  (episode.assets || []).forEach((asset) => {
    if (asset.imagePath || asset.imageUrl) refs.push(buildPackageMediaReference({ owner: "asset", id: asset.id || asset.token || asset.name || "", kind: "image", path: asset.imagePath || "", url: asset.imageUrl || "" }, refs.length));
  });
  (episode.timeline?.clips || []).forEach((clip) => {
    if (clip.mediaUrl) refs.push(buildPackageMediaReference({ owner: "timeline", id: clip.id || clip.shotId || "", kind: clip.mediaType || "media", path: "", url: clip.mediaUrl || "" }, refs.length));
  });
  return refs;
}

export function buildPackageMediaReference(ref = {}, index = 0) {
  const source = ref.path || ref.url || "";
  return {
    ...ref,
    packagePath: `media/${safePackageSegment(ref.owner || "media")}/${safePackageSegment(ref.id || `item-${index + 1}`)}-${String(index + 1).padStart(3, "0")}${mediaExtension(source, ref.kind)}`,
  };
}

export function buildProjectConsistencyReport(input = {}) {
  const project = input.businessProject || {};
  const legacyTimeline = input.timeline || {};
  const episode = project.activeEpisode || project.episodes?.find((item) => item.id === project.activeEpisodeId) || null;
  if (!episode) {
    return { ok: true, issues: [], fixes: [] };
  }
  const businessClips = Array.isArray(episode.timeline?.clips) ? episode.timeline.clips : [];
  const legacyClips = Array.isArray(legacyTimeline.byEpisode?.[episode.id]?.clips) ? legacyTimeline.byEpisode[episode.id].clips : [];
  const issues = [];
  const fixes = [];
  if (businessClips.length !== legacyClips.length) {
    issues.push(`时间线片段数不一致：商业 ${businessClips.length} / 旧时间线 ${legacyClips.length}`);
    fixes.push("从商业模型重新投影旧时间线");
  }
  const businessClipByShot = new Map();
  const duplicateClipShotIds = [];
  businessClips.forEach((clip) => {
    const shotId = String(clip.shotId || "");
    if (!shotId) return;
    if (businessClipByShot.has(shotId)) duplicateClipShotIds.push(shotId);
    else businessClipByShot.set(shotId, clip);
  });
  if (duplicateClipShotIds.length) {
    issues.push(`商业时间线存在重复镜头片段：${dedupeStrings(duplicateClipShotIds).slice(0, 4).join("、")}`);
    fixes.push("按镜头 ID 合并重复时间线片段");
  }
  const missingBusinessMedia = businessClips.filter((clip) => !String(clip.mediaUrl || clip.videoUrl || clip.imageUrl || "").trim()).length;
  if (missingBusinessMedia) {
    issues.push(`商业时间线还有 ${missingBusinessMedia} 条片段缺素材`);
  }
  const shotIds = new Set((episode.shots || []).map((shot) => String(shot.id || "")));
  const orphanClips = businessClips.filter((clip) => clip.shotId && !shotIds.has(String(clip.shotId))).length;
  if (orphanClips) {
    issues.push(`商业时间线有 ${orphanClips} 条片段找不到镜头`);
  }
  const videoReadyShots = (episode.shots || []).filter((shot) => String(shot.videoUrl || shot.videoResultUrl || shot.videoResult || shot.videoPath || "").trim());
  const missingTimelineShots = videoReadyShots.filter((shot) => !businessClipByShot.has(String(shot.id || "")));
  if (missingTimelineShots.length) {
    issues.push(`已有视频但未进入商业时间线：${missingTimelineShots.slice(0, 4).map((shot) => shot.id || "未编号").join("、")}`);
    fixes.push("执行镜头到时间线增量同步");
  }
  const mediaDrift = videoReadyShots.filter((shot) => {
    const clip = businessClipByShot.get(String(shot.id || ""));
    if (!clip) return false;
    const shotMedia = String(shot.videoUrl || shot.videoResultUrl || shot.videoResult || shot.videoPath || "").trim();
    const clipMedia = String(clip.mediaUrl || clip.videoUrl || clip.mediaPath || clip.videoPath || "").trim();
    return Boolean(shotMedia && clipMedia && shotMedia !== clipMedia);
  });
  if (mediaDrift.length) {
    issues.push(`镜头视频与商业时间线媒体不一致：${mediaDrift.slice(0, 4).map((shot) => shot.id || "未编号").join("、")}`);
    fixes.push("以镜头主素材刷新时间线媒体字段");
  }
  const legacyClipByShot = new Map(legacyClips.map((clip) => [String(clip.shotId || ""), clip]));
  const legacyDrift = businessClips.filter((clip) => {
    const legacy = legacyClipByShot.get(String(clip.shotId || ""));
    if (!legacy) return false;
    const businessMedia = String(clip.mediaUrl || clip.videoUrl || clip.imageUrl || "").trim();
    const legacyMedia = String(legacy.mediaUrl || legacy.videoUrl || legacy.imageUrl || "").trim();
    return Boolean(businessMedia && legacyMedia && businessMedia !== legacyMedia);
  });
  if (legacyDrift.length) {
    issues.push(`商业时间线与旧时间线媒体不一致：${legacyDrift.slice(0, 4).map((clip) => clip.shotId || clip.id || "未编号").join("、")}`);
    fixes.push("从商业模型重新投影旧时间线");
  }
  const suspiciousMedia = collectStudioPackageMediaReferences(episode).filter((item) => {
    const value = item.path || item.url || "";
    return /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith("\\\\");
  }).length;
  if (suspiciousMedia) {
    fixes.push("换机后可用素材目录重定位修复本地路径");
  }
  return {
    ok: issues.length === 0,
    issues: dedupeStrings(issues),
    fixes: dedupeStrings(fixes),
  };
}

export function buildDeliveryManifestValidationReport(input = {}) {
  const project = input.businessProject || input.project || {};
  const episode = input.episode || project.activeEpisode || project.episodes?.find((item) => item.id === project.activeEpisodeId) || project.episodes?.[0] || {};
  const refs = collectStudioPackageMediaReferences(episode);
  const issues = [];
  const warnings = [];
  const localMedia = refs.filter((item) => isLocalPath(item.path || item.url));
  const embeddedMedia = refs.filter((item) => String(item.url || item.path || "").startsWith("data:"));
  const remoteMedia = refs.filter((item) => /^https?:\/\//i.test(item.url || item.path || ""));
  const missingPackagePath = refs.filter((item) => !String(item.packagePath || "").trim());
  const shots = Array.isArray(episode.shots) ? episode.shots : [];
  const missingShotVideos = shots.filter((shot) => !String(shot.videoPath || shot.videoUrl || shot.videoResultUrl || "").trim()).length;
  if (missingShotVideos) issues.push(`${missingShotVideos} 个镜头缺视频素材`);
  if (missingPackagePath.length) issues.push(`${missingPackagePath.length} 条媒体引用缺包内路径`);
  if (embeddedMedia.length) warnings.push(`${embeddedMedia.length} 个内嵌素材建议先缓存为文件`);
  if (remoteMedia.length) warnings.push(`${remoteMedia.length} 个远程素材不会被桌面端直接复制`);
  if (localMedia.length) warnings.push(`清单包含 ${localMedia.length} 条本机绝对路径，外发前请确认可见性`);
  return {
    ok: issues.length === 0,
    issues,
    warnings,
    totals: {
      references: refs.length,
      localMedia: localMedia.length,
      embeddedMedia: embeddedMedia.length,
      remoteMedia: remoteMedia.length,
      copyableMedia: localMedia.length,
    },
  };
}

export function buildMultiEpisodeDeliverySummary(project = {}) {
  const episodes = Array.isArray(project.episodes) ? project.episodes : [];
  const rows = episodes.map((episode) => {
    const shots = Array.isArray(episode.shots) ? episode.shots : [];
    const missingVideos = shots.filter((shot) => !String(shot.videoPath || shot.videoUrl || shot.videoResultUrl || "").trim()).length;
    const reviewBlocked = shots.filter((shot) => !["已通过", "搁置"].includes(shot.reviewStatus || "未审")).length;
    const timelineClips = Array.isArray(episode.timeline?.clips) ? episode.timeline.clips : [];
    const timelineBlocked = timelineClips.length ? timelineClips.filter((clip) => !String(clip.mediaUrl || clip.videoUrl || "").trim()).length : missingVideos;
    const blockers = missingVideos + reviewBlocked + timelineBlocked;
    return {
      episodeId: episode.id || "",
      title: episode.title || episode.name || episode.id || "未命名集",
      shots: shots.length,
      blockers,
      ready: shots.length > 0 && blockers === 0,
    };
  });
  return {
    total: rows.length,
    ready: rows.filter((row) => row.ready).length,
    blocked: rows.filter((row) => !row.ready).length,
    rows,
  };
}

export function buildDesktopUploadPersistenceChecklist(input = {}) {
  const refs = collectStudioPackageMediaReferences(input.episode || input.businessProject?.activeEpisode || {});
  const localRefs = refs.filter((item) => isLocalPath(item.path || item.url)).length;
  const exportHistory = Array.isArray(input.exportHistory) ? input.exportHistory : [];
  const hasSavedProject = Boolean(String(input.currentProjectPath || "").trim());
  const hasZipPackage = exportHistory.some((item) => /package|工程包/i.test(`${item.type || ""} ${item.title || ""}`) && /\.zip($|\?)/i.test(String(item.path || item.detail || "")));
  const hasPackageAttempt = hasZipPackage || exportHistory.some((item) => /package|工程包/i.test(`${item.type || ""} ${item.title || ""}`));
  return {
    total: 5,
    localRefs,
    items: [
      { key: "upload-image", label: "上传本地图片后保存工程", done: localRefs > 0 && hasSavedProject },
      { key: "upload-video", label: "上传本地视频后保存工程", done: refs.some((item) => item.kind === "video" && isLocalPath(item.path || item.url)) },
      { key: "reopen", label: "关闭重开后预览仍可用", done: hasSavedProject && refs.some((item) => item.url || item.path) },
      { key: "relocate", label: "移动工程目录后执行素材重定位", done: false },
      { key: "zip-package", label: "工程包 Zip 写出并记录历史", done: hasPackageAttempt },
    ],
  };
}

export function buildMediaRelocationPlan(project = {}, oldRoot = "", newRoot = "") {
  const from = normalizePathRoot(oldRoot);
  const to = normalizePathRoot(newRoot);
  if (!from || !to) return { replacements: 0, project };
  let replacements = 0;
  const replacePath = (value) => {
    const text = String(value || "");
    if (!text.toLowerCase().startsWith(from.toLowerCase())) return value;
    replacements += 1;
    return `${to}${text.slice(from.length)}`;
  };
  const episodes = (project.episodes || []).map((episode) => ({
    ...episode,
    shots: (episode.shots || []).map((shot) => ({
      ...shot,
      imagePath: replacePath(shot.imagePath),
      videoPath: replacePath(shot.videoPath),
    })),
    assets: (episode.assets || []).map((asset) => ({
      ...asset,
      imagePath: replacePath(asset.imagePath),
    })),
    timeline: {
      ...(episode.timeline || {}),
      clips: (episode.timeline?.clips || []).map((clip) => ({
        ...clip,
        mediaUrl: replacePath(clip.mediaUrl),
      })),
    },
  }));
  return {
    changed: replacements > 0,
    replacements,
    project: {
      ...project,
      episodes,
      activeEpisode: episodes.find((episode) => episode.id === project.activeEpisodeId) || episodes[0] || null,
    },
  };
}

export function buildProjectMigrationReport(input = {}) {
  const project = input.project || input.businessProject || {};
  const nodes = Array.isArray(input.nodes) ? input.nodes : [];
  const mediaRefs = collectStudioPackageMediaReferences(project.activeEpisode || project.episodes?.[0] || {});
  const embeddedRefs = mediaRefs.filter((item) => String(item.url || item.path || "").startsWith("data:")).length;
  const localRefs = mediaRefs.filter((item) => /^[a-zA-Z]:[\\/]/.test(item.path || item.url || "")).length;
  const legacyProductionNodes = nodes.filter((node) => node.data?.shots || node.data?.assets || node.data?.timeline).length;
  const hasCommercialModel = Boolean(project.activeEpisode || project.episodes?.length);
  return {
    ok: hasCommercialModel && embeddedRefs === 0 && localRefs === 0 && !(input.missingRefs || []).length,
    projectId: project.id || "",
    hasCommercialModel,
    legacyProductionNodes,
    migratedEmbeddedMedia: Number(input.migratedEmbeddedMedia || 0),
    embeddedRefs,
    localRefs,
    missingRefs: Array.isArray(input.missingRefs) ? input.missingRefs : [],
    notes: [
      embeddedRefs ? `${embeddedRefs} 个内嵌素材仍建议缓存化` : "",
      localRefs ? `${localRefs} 个本地素材路径可在换机后重定位` : "",
      !hasCommercialModel ? "缺少商业模型快照，已使用旧节点兼容投影" : "",
      legacyProductionNodes ? `${legacyProductionNodes} 个旧节点仍包含生产字段` : "",
    ].filter(Boolean),
  };
}

function normalizePathRoot(value = "") {
  return String(value || "").trim().replace(/[\\/]+$/, "");
}

function isLocalPath(value = "") {
  const text = String(value || "").trim();
  return text.startsWith("file://") || text.startsWith("\\\\") || /^[a-zA-Z]:[\\/]/.test(text);
}

function safePackageSegment(value = "") {
  const text = String(value || "").trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return text || "item";
}

function dedupeStrings(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean)));
}

function mediaExtension(source = "", kind = "media") {
  const clean = String(source || "").split(/[?#]/)[0];
  const match = clean.match(/\.([a-zA-Z0-9]{2,8})$/);
  if (match) return `.${match[1].toLowerCase()}`;
  if (kind === "image") return ".png";
  if (kind === "video") return ".mp4";
  return ".bin";
}
