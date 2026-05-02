export function buildGenerationTaskFingerprint(job = {}) {
  const source = [
    job.kind || job.type || "",
    job.episodeId || "",
    job.shotId || job.targetId || job.sourceAssetToken || "",
    job.providerMode || job.imageProviderMode || job.videoProviderMode || "",
    job.workflowId || job.comfyWorkflowId || "",
    job.seed || "",
    stableHash(job.prompt || ""),
    stableHash((job.assetRefs || []).join("|")),
    stableHash([job.mainCharacterToken, job.mainSceneToken, ...(job.keyPropTokens || [])].filter(Boolean).join("|")),
  ].join("::");
  return `gen-${stableHash(source)}`;
}

export const FRONTEND_OPTIMIZATION_CHECKLIST = [
  { key: "main-composition", title: "继续拆 src/main.jsx", owner: "src/app hooks/actions" },
  { key: "queue-result-coordinator", title: "收敛媒体队列结果回写", owner: "project command layer" },
  { key: "bundle-release-gate", title: "发布检查纳入 bundle 回归门槛", owner: "scripts" },
  { key: "preview-smoke", title: "固定预览端口并自动跑 Playwright 冒烟", owner: "scripts" },
  { key: "legacy-canvas-isolation", title: "继续剥离兼容画布依赖", owner: "src/app legacy canvas" },
  { key: "media-field-boundary", title: "梳理媒体字段命名边界", owner: "src/domain media refs" },
  { key: "production-e2e-fixture", title: "补生产链路端到端 fixture", owner: "src/domain mini e2e" },
  { key: "css-budget", title: "优化首屏 CSS 体积", owner: "styles/bundle budget" },
  { key: "panel-style-scope", title: "拆分产品面板样式边界", owner: "product studio styles" },
  { key: "provider-preflight", title: "前移 provider 配置校验", owner: "production preflight" },
  { key: "local-path-preview-tests", title: "加强本地路径与预览 URL 边界测试", owner: "media selectors" },
  { key: "migration-board", title: "建立迁移任务看板", owner: "docs/tests" },
];

export function buildOptimizationMigrationBoard(completedKeys = [], options = {}) {
  const completed = new Set(Array.isArray(completedKeys) ? completedKeys : []);
  const items = FRONTEND_OPTIMIZATION_CHECKLIST.map((item, index) => ({
    ...item,
    index: index + 1,
    status: completed.has(item.key) ? "done" : "pending",
  }));
  const done = items.filter((item) => item.status === "done").length;
  return {
    ok: done === items.length,
    total: items.length,
    done,
    pending: items.length - done,
    next: items.find((item) => item.status !== "done")?.key || "",
    generatedAt: options.generatedAt || "",
    items,
  };
}

export function auditMediaReferenceBoundaries(project = {}) {
  const issues = [];
  const episode = project.activeEpisode || project.episodes?.find((item) => item.id === project.activeEpisodeId) || project.episodes?.[0] || {};
  (episode.assets || []).forEach((asset, index) => {
    auditDisplayAndPath(issues, `assets[${asset.id || asset.token || index}]`, "image", asset.imageUrl, asset.imagePath);
    (asset.imageItems || []).forEach((item, itemIndex) => {
      auditDisplayAndPath(issues, `assets[${asset.id || asset.token || index}].imageItems[${itemIndex}]`, "image", item.imageUrl || item.url, item.imagePath || item.path);
    });
  });
  (episode.shots || []).forEach((shot, index) => {
    const label = `shots[${shot.id || index}]`;
    auditDisplayAndPath(issues, label, "image", shot.imageUrl || shot.imageResultUrl, shot.imagePath);
    auditDisplayAndPath(issues, label, "video", shot.videoUrl || shot.videoResultUrl, shot.videoPath);
    (shot.imageItems || []).forEach((item, itemIndex) => {
      auditDisplayAndPath(issues, `${label}.imageItems[${itemIndex}]`, "image", item.imageUrl || item.url, item.imagePath || item.path);
    });
    (shot.videoItems || []).forEach((item, itemIndex) => {
      auditDisplayAndPath(issues, `${label}.videoItems[${itemIndex}]`, "video", item.videoUrl || item.url, item.videoPath || item.path);
    });
  });
  (episode.timeline?.clips || []).forEach((clip, index) => {
    auditDisplayAndPath(issues, `timeline.clips[${clip.id || index}]`, "media", clip.mediaUrl || clip.videoUrl || clip.imageUrl, clip.mediaPath || clip.videoPath || clip.imagePath);
  });
  return {
    ok: issues.length === 0,
    issues,
    totals: {
      issues: issues.length,
      assets: (episode.assets || []).length,
      shots: (episode.shots || []).length,
      clips: (episode.timeline?.clips || []).length,
    },
  };
}

export function recoverInterruptedQueue(queue = [], options = {}) {
  const now = options.now ? options.now() : Date.now();
  let recovered = 0;
  const nextQueue = (Array.isArray(queue) ? queue : []).map((job) => {
    if (job.status !== "running" && job.status !== "queued") return job;
    recovered += 1;
    return {
      ...job,
      status: "pending",
      progress: job.kind === "exportVideo" ? 0 : null,
      resultSummary: "上次运行被中断，已恢复为可重试",
      recoveryNotified: true,
      recoveredAt: now,
      updatedAt: now,
    };
  });
  return { queue: nextQueue, recovered };
}

export function buildBatchGenerationPreview(episode = {}, options = {}) {
  const kind = options.kind === "video" ? "video" : "image";
  const providerMode = options.providerMode || "inherit";
  const shots = Array.isArray(episode.shots) ? episode.shots : [];
  const rows = shots.map((shot) => {
    const hasMedia = kind === "video"
      ? Boolean(shot.videoUrl || shot.videoResultUrl || shot.videoResult || shot.videoPath)
      : Boolean(shot.imageUrl || shot.imageResultUrl || shot.imageResult || shot.imagePath);
    const prompt = kind === "video" ? shot.videoPrompt || shot.prompt?.video || "" : shot.imagePrompt || shot.prompt?.image || "";
    const blockers = [];
    if (!String(prompt || "").trim()) blockers.push(kind === "video" ? "缺视频提示词" : "缺图片提示词");
    if (kind === "video" && !(shot.imageUrl || shot.imageResultUrl || shot.imageResult || shot.imagePath)) blockers.push("缺首帧图");
    return {
      shotId: shot.id || "",
      title: shot.title || shot.scene || shot.id || "",
      kind,
      providerMode: shot[`${kind}ProviderMode`] || providerMode,
      prompt,
      assetRefs: Array.isArray(shot.assetRefs) ? shot.assetRefs.filter(Boolean) : [],
      skip: hasMedia || blockers.length > 0,
      reason: hasMedia ? "已有结果" : blockers.join("、"),
      fingerprint: buildGenerationTaskFingerprint({
        kind,
        episodeId: episode.id || "",
        shotId: shot.id || "",
        providerMode,
        prompt,
        assetRefs: shot.assetRefs || [],
        mainCharacterToken: shot.mainCharacterToken || "",
        mainSceneToken: shot.mainSceneToken || "",
        keyPropTokens: shot.keyPropTokens || [],
      }),
    };
  });
  return {
    kind,
    total: rows.length,
    runnable: rows.filter((row) => !row.skip).length,
    skipped: rows.filter((row) => row.skip).length,
    rows,
  };
}

export function buildDeliveryPreflightChecklist(project = {}, options = {}) {
  const episode = options.episode || project.activeEpisode || project.episodes?.find((item) => item.id === project.activeEpisodeId) || project.episodes?.[0] || {};
  const shots = Array.isArray(episode.shots) ? episode.shots : [];
  const clips = Array.isArray(episode.timeline?.clips) ? episode.timeline.clips : [];
  const blockers = [];
  const warnings = [];
  if (!shots.length) blockers.push("缺少镜头表");
  const missingVideos = shots.filter((shot) => !String(shot.videoUrl || shot.videoResultUrl || shot.videoResult || shot.videoPath || "").trim());
  if (missingVideos.length) blockers.push(`缺视频素材 ${missingVideos.length} 条`);
  if (clips.length < shots.length) blockers.push(`时间线片段不足 ${clips.length}/${shots.length}`);
  const missingClipMedia = clips.filter((clip) => !String(clip.mediaUrl || clip.videoUrl || clip.mediaPath || "").trim());
  if (missingClipMedia.length) blockers.push(`时间线缺素材 ${missingClipMedia.length} 条`);
  const unreviewed = shots.filter((shot) => !["已通过", "approved"].includes(shot.reviewStatus));
  if (unreviewed.length) warnings.push(`未通过审片 ${unreviewed.length} 条`);
  const localPaths = collectLocalMediaPaths(episode);
  if (localPaths.length) warnings.push(`本机路径 ${localPaths.length} 条，外发前需确认可访问`);
  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
    totals: {
      shots: shots.length,
      videos: shots.length - missingVideos.length,
      clips: clips.length,
      readyClips: clips.length - missingClipMedia.length,
      localPaths: localPaths.length,
    },
  };
}

export function buildSyncStatusReport(project = {}, options = {}) {
  const episode = options.episode || project.activeEpisode || project.episodes?.find((item) => item.id === project.activeEpisodeId) || project.episodes?.[0] || {};
  const shots = Array.isArray(episode.shots) ? episode.shots : [];
  const clips = Array.isArray(episode.timeline?.clips) ? episode.timeline.clips : [];
  const clipShotIds = new Set(clips.map((clip) => String(clip.shotId || "")).filter(Boolean));
  const videoShotIds = shots.filter((shot) => shot.videoUrl || shot.videoResultUrl || shot.videoResult || shot.videoPath).map((shot) => String(shot.id || ""));
  const missingTimeline = videoShotIds.filter((shotId) => !clipShotIds.has(shotId));
  const duplicateTimeline = findDuplicates(clips.map((clip) => String(clip.shotId || "")).filter(Boolean));
  const queue = Array.isArray(options.queue) ? options.queue : [];
  const unaddressedJobs = queue.filter((job) => ["image", "video"].includes(job.kind) && !(job.episodeId && (job.shotId || job.targetId)));
  const issues = [
    ...missingTimeline.map((shotId) => `${shotId} 已有视频但未进时间线`),
    ...duplicateTimeline.map((shotId) => `${shotId} 时间线重复`),
    ...(unaddressedJobs.length ? [`${unaddressedJobs.length} 个队列任务缺业务地址`] : []),
  ];
  return {
    ok: issues.length === 0,
    issues,
    metrics: {
      shots: shots.length,
      clips: clips.length,
      videoShots: videoShotIds.length,
      queue: queue.length,
    },
  };
}

function collectLocalMediaPaths(episode = {}) {
  const values = [];
  (episode.shots || []).forEach((shot) => values.push(shot.imagePath, shot.videoPath));
  (episode.assets || []).forEach((asset) => values.push(asset.imagePath));
  (episode.timeline?.clips || []).forEach((clip) => values.push(clip.mediaPath, clip.videoPath));
  return values.filter((value) => /^[a-zA-Z]:[\\/]/.test(String(value || "")) || /^\\\\/.test(String(value || "")));
}

function auditDisplayAndPath(issues, target, kind, displayUrl = "", localPath = "") {
  const url = String(displayUrl || "").trim();
  const path = String(localPath || "").trim();
  if (url && isLocalPath(url)) {
    issues.push({ target, kind, field: "url", reason: "display url contains a local file path" });
  }
  if (path && !isLocalPath(path)) {
    issues.push({ target, kind, field: "path", reason: "local path field contains a display url" });
  }
}

function isLocalPath(value = "") {
  const text = String(value || "");
  return /^[a-zA-Z]:[\\/]/.test(text) || /^\\\\/.test(text) || text.startsWith("/");
}

function findDuplicates(values = []) {
  const seen = new Set();
  const duplicate = new Set();
  values.forEach((value) => {
    if (seen.has(value)) duplicate.add(value);
    seen.add(value);
  });
  return Array.from(duplicate);
}

function stableHash(value = "") {
  const text = String(value || "");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
