import {
  buildBatchGenerationPreview,
  buildDeliveryPreflightChecklist,
  buildSyncStatusReport,
} from "../../domain/production-optimization-helpers.js";

export function normalizeShotRows(shots = [], options = {}) {
  const resolveMediaUrl = options.resolveMediaUrl || resolveStudioMediaUrl;
  return (Array.isArray(shots) ? shots : []).map((shot, index) => {
    const id = shot.id || `S${String(index + 1).padStart(2, "0")}`;
    const primaryImageRef = pickPrimaryMediaRef(shot.mediaRefs, "image");
    const primaryVideoRef = pickPrimaryMediaRef(shot.mediaRefs, "video");
    const imageUrl = resolveMediaUrl(primaryImageRef?.url || shot.image?.url || shot.imageUrl || shot.imageResultUrl || shot.imageResult || "", primaryImageRef?.localPath || shot.imagePath);
    const videoUrl = resolveMediaUrl(primaryVideoRef?.url || shot.video?.url || shot.videoUrl || shot.videoResultUrl || shot.videoResult || "", primaryVideoRef?.localPath || shot.videoPath);
    const rawImagePreviewUrl = shot.image?.thumbnailUrl
      || shot.image?.thumbnail
      || shot.imageThumbnailUrl
      || shot.thumbnailUrl
      || "";
    const imagePreviewUrl = rawImagePreviewUrl ? resolveMediaUrl(rawImagePreviewUrl, shot.imageThumbnailPath) : imageUrl;
    const rawVideoPreviewUrl = shot.video?.thumbnailUrl
      || shot.video?.posterUrl
      || shot.video?.coverUrl
      || shot.videoThumbnailUrl
      || shot.videoPosterUrl
      || shot.videoCoverUrl
      || "";
    const videoPreviewUrl = rawVideoPreviewUrl ? resolveMediaUrl(rawVideoPreviewUrl, shot.videoThumbnailPath) : "";
    return {
      id,
      title: shot.title || shot.titleBar || shot.scene || "",
      scene: shot.scene || shot.sceneName || "",
      imagePrompt: shot.prompt?.image || shot.imagePrompt || "",
      videoPrompt: shot.prompt?.video || shot.videoPrompt || "",
      imageUrl,
      videoUrl,
      imageCandidates: normalizeShotMediaCandidates(shot, "image", imageUrl, resolveMediaUrl),
      videoCandidates: normalizeShotMediaCandidates(shot, "video", videoUrl, resolveMediaUrl),
      previewUrl: imagePreviewUrl || videoPreviewUrl || "",
      reviewStatus: shot.reviewStatus || "未审",
      reviewComment: shot.reviewComment || shot.reviewNote || "",
      reviewHistory: Array.isArray(shot.reviewHistory) ? shot.reviewHistory : [],
      reviewRepairSuggestion: shot.reviewRepairSuggestion || null,
      sourceNodeId: shot.sourceNodeId || "",
      mainCharacterToken: shot.mainCharacterToken || "",
      mainSceneToken: shot.mainSceneToken || "",
      keyPropTokens: Array.isArray(shot.keyPropTokens) ? shot.keyPropTokens.filter(Boolean) : [],
      assetRefs: Array.isArray(shot.assetRefs) ? shot.assetRefs.filter(Boolean) : [],
      referenceResources: String(shot.referenceResources || ""),
      imageProviderMode: shot.imageProviderMode || shot.imageCallMode || shot.imageProvider || "",
      videoProviderMode: shot.videoProviderMode || shot.videoCallMode || shot.videoProvider || "",
      imageRuntimeModel: shot.imageRuntimeModel || "",
      videoRuntimeModel: shot.videoRuntimeModel || "",
      hasImage: Boolean(imageUrl),
      hasVideo: Boolean(videoUrl),
    };
  });
}

export function normalizeAssetRows(assets = [], options = {}) {
  const resolveMediaUrl = options.resolveMediaUrl || resolveStudioMediaUrl;
  const labels = {
    character: "角色",
    scene: "场景",
    prop: "道具",
  };
  return (Array.isArray(assets) ? assets : []).map((asset) => {
    const primaryImageRef = pickPrimaryMediaRef(asset.mediaRefs, "image");
    const imageUrl = resolveMediaUrl(primaryImageRef?.url || asset.image?.url || asset.imageUrl || asset.image || "", primaryImageRef?.localPath || asset.imagePath);
    const candidates = normalizeAssetCandidates(asset, imageUrl, resolveMediaUrl);
    return {
      ...asset,
      typeLabel: labels[asset.type] || asset.category || asset.type || "资产",
      imageUrl,
      imageCandidates: candidates,
      hasImage: Boolean(imageUrl),
    };
  });
}

export function normalizeTimelineRows(timeline = {}, shots = []) {
  const shotIndex = new Map((Array.isArray(shots) ? shots : []).map((shot) => [String(shot.id || ""), shot]));
  return (Array.isArray(timeline?.clips) ? timeline.clips : []).map((clip, index) => {
    const shot = shotIndex.get(String(clip.shotId || ""));
    const mediaUrl = clip.mediaUrl || clip.videoUrl || clip.imageUrl || "";
    return {
      id: clip.id || clip.shotId || `clip-${index + 1}`,
      index,
      shotId: clip.shotId || "",
      title: clip.title || shot?.title || shot?.scene || clip.shotId || `片段${index + 1}`,
      ready: Boolean(mediaUrl),
      partial: Boolean(!mediaUrl && (shot?.hasVideo || shot?.hasImage)),
      mediaUrl,
      duration: clip.duration || "",
      inPoint: clip.inPoint || clip.trimIn || "",
      outPoint: clip.outPoint || clip.trimOut || "",
      transition: clip.transition || "直切",
      reviewStatus: clip.reviewStatus || "待验收",
      status: `${mediaUrl ? "素材已挂载" : shot?.hasVideo ? "镜头视频可同步" : shot?.hasImage ? "等待视频素材" : "缺少时间线素材"} · ${clip.reviewStatus || clip.approvalStatus || "待验收"}`,
    };
  });
}

export function summarizeMedia(shots = []) {
  return {
    total: shots.length,
    imagesReady: shots.filter((shot) => shot.hasImage).length,
    videosReady: shots.filter((shot) => shot.hasVideo).length,
  };
}

export function buildBusinessOptimizationBoard(input = {}) {
  const sourceText = String(input.sourceText || "").trim();
  const shots = Array.isArray(input.shots) ? input.shots : [];
  const assets = Array.isArray(input.assets) ? input.assets : [];
  const queue = Array.isArray(input.queue) ? input.queue : [];
  const timelineClips = Array.isArray(input.timeline?.clips) ? input.timeline.clips : [];
  const exportHistory = Array.isArray(input.exportHistory) ? input.exportHistory : [];
  const providerHealthReport = input.providerHealthReport || null;
  const riskReport = input.riskReport || null;
  const media = summarizeMedia(shots);
  const assetImages = assets.filter((asset) => asset.hasImage).length;
  const assetCandidates = assets.reduce((sum, asset) => sum + Math.max(0, (asset.imageCandidates?.length || 0) - 1), 0);
  const imageCandidates = shots.reduce((sum, shot) => sum + Math.max(0, (shot.imageCandidates?.length || 0) - 1), 0);
  const videoCandidates = shots.reduce((sum, shot) => sum + Math.max(0, (shot.videoCandidates?.length || 0) - 1), 0);
  const promptReady = shots.filter((shot) => String(shot.imagePrompt || "").trim() && String(shot.videoPrompt || "").trim()).length;
  const reviewed = shots.filter((shot) => ["已通过", "approved"].includes(shot.reviewStatus)).length;
  const failedQueue = queue.filter((job) => job.status === "failed").length;
  const pendingQueue = queue.filter((job) => job.status === "pending" || job.status === "running").length;
  const timelineReady = timelineClips.length > 0 && timelineClips.every((clip) => clip.mediaUrl || clip.videoUrl);
  const exportReady = Boolean(riskReport?.ok) || (media.total > 0 && media.videosReady >= media.total && reviewed >= media.total && timelineReady);
  const providerOk = providerHealthReport ? Boolean(providerHealthReport.ok) : true;
  const doneExports = exportHistory.filter((item) => item.status === "done").length;
  const missingImages = Math.max(0, media.total - media.imagesReady);
  const missingVideos = Math.max(0, media.total - media.videosReady);
  const missingAssetImages = assets.filter((asset) => !asset.hasImage).length;
  const baseEstimate = buildBoardEstimate({ missingImages, missingVideos, missingAssetImages, queue });
  const virtualEpisode = {
    id: input.episodeId || "",
    shots,
    assets,
    timeline: { clips: timelineClips },
  };
  const syncStatus = buildSyncStatusReport({ activeEpisode: virtualEpisode }, { queue });
  const imagePreview = buildBatchGenerationPreview(virtualEpisode, { kind: "image", providerMode: input.imageProviderMode || "inherit" });
  const videoPreview = buildBatchGenerationPreview(virtualEpisode, { kind: "video", providerMode: input.videoProviderMode || "inherit" });
  const deliveryPreflight = buildDeliveryPreflightChecklist({ activeEpisode: virtualEpisode });

  const items = [
    boardItem("flow", "新手主流程", sourceText && shots.length, sourceText ? `${shots.length} 个镜头进入生产线` : "等待小说或剧情梗概", "粘贴小说并生成文本方案", sourceText ? "generateText" : "script", {
      progress: shots.length ? 100 : sourceText ? 35 : 0,
      blockers: sourceText ? [] : ["缺少小说或剧情梗概"],
      maturity: shots.length ? "闭环" : "在建",
      nextSteps: sourceText ? ["生成文本方案", "检查资产和镜头表"] : ["粘贴小说、梗概或已有剧本", "点击生成文本方案"],
      estimate: { tasks: shots.length ? 0 : 1, minutes: sourceText ? 2 : 5, costLevel: "低" },
    }),
    boardItem("editableText", "文本生产结果可编辑", shots.length > 0, shots.length ? "镜头表已生成，可逐条修订提示词" : "需要先生成剧本、资产和镜头表", "生成文本方案", "generateText", {
      progress: shots.length ? 75 : 0,
      blockers: shots.length ? [] : ["尚未生成文本方案"],
      maturity: "在建",
      nextSteps: shots.length ? ["进入镜头表逐条改提示词", "只重生受影响镜头"] : ["先生成文本方案"],
      estimate: { tasks: shots.length || 1, minutes: Math.max(3, shots.length), costLevel: "低" },
    }),
    boardItem("characterContinuity", "角色一致性闭环", assets.length > 0 && assetImages >= assets.filter((asset) => asset.type === "character").length, `${assetImages}/${assets.length} 个资产有定妆图`, "补齐或锁定资产图", "assets", {
      progress: percent(assetImages, Math.max(assets.length, 1)),
      blockers: assets.length ? missingAssetImageLabels(assets).slice(0, 3) : ["缺少角色/场景/道具资产"],
      maturity: assetImages >= assets.length && assets.length ? "闭环" : "在建",
      nextSteps: ["补齐缺失资产定妆图", "把满意候选设为主图", "返查镜头角色引用"],
      estimate: { tasks: missingAssetImages, minutes: missingAssetImages * 3, costLevel: missingAssetImages > 6 ? "中" : "低" },
    }),
    boardItem("shotHealth", "镜头表质量检查", shots.length > 0 && promptReady >= shots.length, `${promptReady}/${shots.length} 条镜头提示词完整`, "补齐图片和视频提示词", "shots", {
      progress: percent(promptReady, Math.max(shots.length, 1)),
      blockers: missingShotPromptLabels(shots).slice(0, 3),
      maturity: promptReady >= shots.length && shots.length ? "闭环" : "在建",
      nextSteps: ["筛出缺提示词镜头", "补齐图片/视频提示词", "重新生成受影响镜头"],
      estimate: { tasks: Math.max(0, shots.length - promptReady), minutes: Math.max(1, shots.length - promptReady), costLevel: "低" },
    }),
    boardItem("imageCandidates", "图片候选管理", assetCandidates + imageCandidates > 0, `${assetCandidates + imageCandidates} 个候选可对比`, "生成更多候选并设为主图", "generateImages", {
      progress: assetCandidates + imageCandidates ? 70 : media.imagesReady ? 45 : 0,
      blockers: assetCandidates + imageCandidates ? [] : ["还没有可对比候选图"],
      maturity: "在建",
      nextSteps: ["为关键角色和主镜头生成第二候选", "对比候选图", "锁定主图"],
      estimate: { tasks: Math.max(1, Math.min(6, missingImages + missingAssetImages)), minutes: Math.max(2, Math.min(18, (missingImages + missingAssetImages) * 3)), costLevel: "中" },
    }),
    boardItem("imageVideoBridge", "图片到视频衔接", media.imagesReady > 0 && shots.every((shot) => !shot.videoPrompt || shot.hasImage || shot.hasVideo), `${media.imagesReady}/${media.total} 条首帧可用于视频`, "先补齐镜头首帧图", "generateImages", {
      progress: percent(media.imagesReady, Math.max(media.total, 1)),
      blockers: shots.filter((shot) => shot.videoPrompt && !shot.hasImage && !shot.hasVideo).map((shot) => `${shot.id} 缺首帧`).slice(0, 3),
      maturity: media.imagesReady >= media.total && media.total ? "闭环" : "在建",
      nextSteps: ["先生成或上传首帧图", "确认视频提示词", "再批量生成视频"],
      estimate: { tasks: missingImages, minutes: missingImages * 3, costLevel: missingImages > 8 ? "中" : "低" },
    }),
    boardItem("queueExplain", "队列可解释性", queue.length > 0, queue.length ? `${pendingQueue} 个待处理，${failedQueue} 个失败` : "暂无队列任务", "打开队列查看依赖和失败原因", "queue", {
      progress: queue.length ? 75 : 20,
      blockers: queue.length ? [] : ["还没有可解释的生产任务"],
      maturity: "在建",
      nextSteps: ["规划图片或视频队列", "查看任务依赖、Provider 和失败原因"],
      estimate: { tasks: queue.length, minutes: pendingQueue * 2, costLevel: pendingQueue > 10 ? "中" : "低" },
    }),
    boardItem("failureRecovery", "失败恢复体验", failedQueue === 0, failedQueue ? `${failedQueue} 个任务需要恢复` : "当前没有失败任务", "重试、换模型或改为上传", "queue", {
      progress: failedQueue ? 30 : 100,
      blockers: failedQueue ? [`${failedQueue} 个失败队列任务`] : [],
      severity: failedQueue ? "critical" : "normal",
      maturity: failedQueue ? "在建" : "闭环",
      nextSteps: failedQueue ? ["打开队列定位失败任务", "优先重试", "必要时换模型或改为上传"] : ["保持队列失败数为 0"],
      estimate: { tasks: failedQueue, minutes: failedQueue * 2, costLevel: failedQueue > 3 ? "中" : "低" },
    }),
    boardItem("dashboard", "项目级进度仪表盘", media.total > 0, `${media.imagesReady}/${media.total} 图 · ${media.videosReady}/${media.total} 视频`, "打开总控台查看进度", "dashboard", {
      progress: media.total ? Math.round((percent(media.imagesReady, media.total) + percent(media.videosReady, media.total)) / 2) : 0,
      blockers: media.total ? [] : ["项目还没有镜头数据"],
      maturity: "闭环",
      nextSteps: ["查看总控台", "按缺图、缺视频、待审片排序处理"],
      estimate: baseEstimate,
    }),
    boardItem("review", "审片流程明确", media.videosReady > 0 && reviewed >= media.videosReady, `${reviewed}/${media.total} 条镜头已通过`, "执行审片并生成返修任务", "runReview", {
      progress: percent(reviewed, Math.max(media.total, 1)),
      blockers: media.videosReady ? unreviewedShotLabels(shots).slice(0, 3) : ["需要先完成视频素材"],
      maturity: reviewed >= media.total && media.total ? "闭环" : "在建",
      nextSteps: ["执行自动审片", "按问题分类退回", "生成返修任务"],
      estimate: { tasks: Math.max(0, media.videosReady - reviewed), minutes: Math.max(2, media.videosReady - reviewed), costLevel: "低" },
    }),
    boardItem("timeline", "时间线自动装配", timelineReady, `${timelineClips.length} 个时间线片段`, "同步镜头视频到时间线", "syncTimeline", {
      progress: timelineReady ? 100 : percent(timelineClips.length, Math.max(media.videosReady, 1)),
      blockers: timelineReady ? [] : (syncStatus.issues.slice(0, 3).length ? syncStatus.issues.slice(0, 3) : ["视频素材尚未全部进入时间线"]),
      maturity: timelineReady ? "闭环" : "在建",
      nextSteps: ["同步镜头视频到时间线", "检查缺素材片段", "确认片段顺序和时长"],
      estimate: { tasks: Math.max(0, media.videosReady - timelineClips.length), minutes: Math.max(1, media.videosReady), costLevel: "低" },
    }),
    boardItem("deliveryGate", "导出前检查", exportReady, exportReady ? "交付门槛已满足或风险已清零" : "仍有素材、审片或时间线阻塞", "运行交付检查", "openExport", {
      progress: exportReady ? 100 : Math.round((percent(media.videosReady, Math.max(media.total, 1)) + percent(reviewed, Math.max(media.total, 1)) + (timelineReady ? 100 : 0)) / 3),
      blockers: exportReady ? [] : (deliveryPreflight.blockers.slice(0, 3).length ? deliveryPreflight.blockers.slice(0, 3) : ["导出前仍有生产门禁未通过"]),
      severity: exportReady ? "normal" : "high",
      maturity: exportReady ? "闭环" : "在建",
      nextSteps: ["运行交付检查", "清理素材、审片和时间线阻塞", "生成交付包"],
      estimate: { tasks: Math.max(0, missingImages + missingVideos + (media.total - reviewed)), minutes: Math.max(3, missingImages * 2 + missingVideos * 4), costLevel: missingVideos > 6 ? "高" : "中" },
    }),
    boardItem("resourceBinding", "资源库与项目素材绑定", assets.some((asset) => asset.hasImage) || shots.some((shot) => shot.hasImage || shot.hasVideo), "素材已按资产/镜头归属展示", "导入或生成项目素材", "assets", {
      progress: assets.some((asset) => asset.hasImage) || shots.some((shot) => shot.hasImage || shot.hasVideo) ? 70 : 0,
      blockers: assets.some((asset) => asset.hasImage) || shots.some((shot) => shot.hasImage || shot.hasVideo) ? [] : ["暂无可索引素材"],
      maturity: "在建",
      nextSteps: ["生成或上传素材", "确认素材归属到角色/镜头", "导出前检查路径"],
      estimate: { tasks: missingAssetImages + missingImages + missingVideos, minutes: Math.max(2, missingAssetImages + missingImages + missingVideos), costLevel: "低" },
    }),
    boardItem("providerGuide", "Provider 配置引导", providerOk, providerOk ? "模型服务未报告阻塞" : `${providerHealthReport.blockers?.length || 0} 项配置阻塞`, "打开 API 设置并测试连接", "settings", {
      progress: providerOk ? 100 : 35,
      blockers: providerHealthReport?.blockers?.slice?.(0, 3) || [],
      severity: providerOk ? "normal" : "high",
      maturity: providerOk ? "闭环" : "在建",
      nextSteps: providerOk ? ["保持 Provider 可用", "生成前做连接测试"] : ["打开 API 设置", "补齐 Key、地址或 ComfyUI 配置", "重新测试连接"],
      estimate: { tasks: providerOk ? 0 : 1, minutes: providerOk ? 0 : 5, costLevel: "低" },
    }),
    boardItem("costEstimate", "成本和耗时预估", pendingQueue + queue.filter((job) => job.status === "done").length > 0, `${queue.length} 个任务可用于估算`, "批量生成前查看任务数", "dashboard", {
      progress: queue.length ? 60 : 20,
      blockers: queue.length ? [] : ["需要先规划一批生产任务"],
      maturity: "在建",
      nextSteps: ["先生成一批队列任务", "查看任务数量和 Provider", "再批量执行"],
      estimate: buildQueueEstimate(queue),
    }),
    boardItem("templates", "模板体系产品化", true, "Prompt 工厂可承载题材模板", "进入 Prompt 工厂", "promptFactory", {
      progress: 65,
      maturity: "在建",
      nextSteps: ["进入 Prompt 工厂", "选择题材模板", "同步到文本生产方案"],
      estimate: { tasks: 1, minutes: 4, costLevel: "低" },
    }),
    boardItem("multiEpisode", "多集项目管理", Boolean(input.multiEpisodeDeliverySummary) || false, input.multiEpisodeDeliverySummary ? "已有多集交付摘要" : "当前以单集生产为主", "规划多集交付", "delivery", {
      progress: input.multiEpisodeDeliverySummary ? 70 : 20,
      blockers: input.multiEpisodeDeliverySummary ? [] : ["尚未形成多集交付计划"],
      maturity: "在建",
      nextSteps: ["复用角色资产", "规划多集交付", "批量检查阻塞集数"],
      estimate: { tasks: input.multiEpisodeDeliverySummary?.blocked || 1, minutes: input.multiEpisodeDeliverySummary ? 5 : 10, costLevel: "中" },
    }),
    boardItem("versions", "历史版本与回滚", assetCandidates + imageCandidates + videoCandidates > 0, `${assetCandidates + imageCandidates + videoCandidates} 个媒体版本`, "保留候选并按需恢复主版本", "media", {
      progress: assetCandidates + imageCandidates + videoCandidates ? 70 : 25,
      blockers: assetCandidates + imageCandidates + videoCandidates ? [] : ["缺少可回滚的候选版本"],
      maturity: "在建",
      nextSteps: ["保留候选图和候选视频", "标记主版本", "废弃不合格版本"],
      estimate: { tasks: assetCandidates + imageCandidates + videoCandidates, minutes: Math.max(2, assetCandidates + imageCandidates + videoCandidates), costLevel: "低" },
    }),
    boardItem("advancedCanvas", "兼容画布入口降噪", true, "默认以生产工作台为主入口", "需要时打开兼容画布", "advancedCanvas", {
      progress: 100,
      maturity: "闭环",
      nextSteps: ["默认留在生产工作台", "仅在高级编辑时打开兼容画布"],
      estimate: { tasks: 0, minutes: 0, costLevel: "低" },
    }),
    boardItem("deliveryPackage", "真实交付包标准化", doneExports > 0 || exportReady, doneExports ? `${doneExports} 个交付记录` : "通过交付检查后可导出工程包", "导出成片或工程包", "openExport", {
      progress: doneExports ? 100 : exportReady ? 80 : 35,
      blockers: doneExports || exportReady ? [] : ["需要先通过交付检查"],
      maturity: doneExports ? "闭环" : "在建",
      nextSteps: ["通过交付检查", "选择 MP4 或工程包", "归档素材清单和审片记录"],
      estimate: { tasks: exportReady ? 1 : missingVideos + missingImages, minutes: exportReady ? 3 : Math.max(5, missingVideos * 4 + missingImages * 2), costLevel: exportReady ? "低" : "中" },
    }),
    boardItem("desktopRelease", "桌面发布护栏", true, "发布前检查、版本同步和 NSIS 安装包已进入固定流程", "运行发布检查", "release", {
      progress: 100,
      maturity: "闭环",
      nextSteps: ["运行 test:release", "确认安装包配置", "正式发布前接入签名和自动更新"],
      estimate: { tasks: 0, minutes: 0, costLevel: "低" },
    }),
  ];
  const open = items.filter((item) => item.status !== "done").length;
  return {
    items,
    open,
    done: items.length - open,
    score: items.length ? Math.round(((items.length - open) / items.length) * 100) : 0,
    syncStatus,
    previews: {
      image: imagePreview,
      video: videoPreview,
    },
    deliveryPreflight,
    topItems: items.filter((item) => item.status !== "done").sort(compareBoardItems).slice(0, 5),
  };
}

function boardItem(key, title, ok, detail, action, actionKey = "", options = {}) {
  const blockers = Array.isArray(options.blockers) ? options.blockers.filter(Boolean) : [];
  const status = ok ? "done" : blockers.length ? "blocked" : "todo";
  return {
    key,
    title,
    detail,
    action,
    actionKey,
    status,
    progress: Math.max(0, Math.min(100, Number(options.progress || (ok ? 100 : 0)))),
    blockers,
    severity: options.severity || (status === "blocked" ? "medium" : "normal"),
    maturity: options.maturity || (ok ? "闭环" : "在建"),
    nextSteps: Array.isArray(options.nextSteps) ? options.nextSteps.filter(Boolean) : [],
    estimate: normalizeBoardEstimate(options.estimate),
  };
}

function compareBoardItems(left = {}, right = {}) {
  const rank = { critical: 0, high: 1, medium: 2, normal: 3 };
  return (rank[left.severity] ?? 3) - (rank[right.severity] ?? 3)
    || Number(left.progress || 0) - Number(right.progress || 0);
}

function percent(done = 0, total = 1) {
  const count = Number(done || 0);
  const base = Math.max(1, Number(total || 1));
  return Math.round(Math.max(0, Math.min(1, count / base)) * 100);
}

function missingAssetImageLabels(assets = []) {
  return (Array.isArray(assets) ? assets : [])
    .filter((asset) => !asset.hasImage)
    .map((asset) => `${asset.typeLabel || asset.type || "资产"} ${asset.name || asset.token || asset.id || ""} 缺定妆图`.trim());
}

function missingShotPromptLabels(shots = []) {
  return (Array.isArray(shots) ? shots : [])
    .filter((shot) => !String(shot.imagePrompt || "").trim() || !String(shot.videoPrompt || "").trim())
    .map((shot) => `${shot.id || "镜头"} 缺${!shot.imagePrompt ? "图片" : ""}${!shot.imagePrompt && !shot.videoPrompt ? "/" : ""}${!shot.videoPrompt ? "视频" : ""}提示词`);
}

function unreviewedShotLabels(shots = []) {
  return (Array.isArray(shots) ? shots : [])
    .filter((shot) => shot.hasVideo && !["已通过", "approved"].includes(shot.reviewStatus))
    .map((shot) => `${shot.id || "镜头"} 待审片`);
}

function buildBoardEstimate({ missingImages = 0, missingVideos = 0, missingAssetImages = 0, queue = [] } = {}) {
  const queued = buildQueueEstimate(queue);
  const generatedTasks = missingImages + missingVideos + missingAssetImages;
  if (queued.tasks) return queued;
  return {
    tasks: generatedTasks,
    minutes: Math.max(0, missingAssetImages * 3 + missingImages * 3 + missingVideos * 5),
    costLevel: missingVideos > 8 || generatedTasks > 18 ? "高" : generatedTasks > 6 ? "中" : "低",
  };
}

function buildQueueEstimate(queue = []) {
  const tasks = Array.isArray(queue) ? queue.filter((job) => !["done", "cancelled"].includes(job.status)).length : 0;
  const imageJobs = (Array.isArray(queue) ? queue : []).filter((job) => job.kind === "image" || job.type === "asset.image" || job.type === "shot.image").length;
  const videoJobs = (Array.isArray(queue) ? queue : []).filter((job) => job.kind === "video" || job.type === "shot.video").length;
  const exportJobs = (Array.isArray(queue) ? queue : []).filter((job) => String(job.kind || job.type || "").includes("export")).length;
  const minutes = imageJobs * 3 + videoJobs * 6 + exportJobs * 4;
  return {
    tasks,
    minutes,
    costLevel: videoJobs > 8 || tasks > 20 ? "高" : videoJobs || tasks > 8 ? "中" : "低",
  };
}

function normalizeBoardEstimate(estimate = {}) {
  return {
    tasks: Math.max(0, Number(estimate.tasks || 0)),
    minutes: Math.max(0, Math.round(Number(estimate.minutes || 0))),
    costLevel: estimate.costLevel || "低",
  };
}

export function viewTitle(view = "overview") {
  const labels = {
    overview: "生产总览",
    script: "剧本方案",
    shots: "镜头表",
    assets: "资产库",
    media: "媒体生产",
    timeline: "时间线",
    review: "审片",
    delivery: "交付",
  };
  return labels[view] || "生产总览";
}

export function viewSubtitle(view = "overview") {
  const labels = {
    overview: "按阶段查看当前集的生产完成度",
    script: "生成或修订文本生产方案",
    shots: "检查每个镜头的图片、视频和状态",
    assets: "管理角色、场景、道具和定妆图",
    media: "选择 API、ComfyUI 或本地上传补齐媒体",
    timeline: "检查镜头视频进入剪辑线的情况",
    review: "执行审片、返修和通过门禁",
    delivery: "检查阻塞并导出交付包",
  };
  return labels[view] || labels.overview;
}

function normalizeShotMediaCandidates(shot = {}, kind = "image", primaryUrl = "", resolveMediaUrl = resolveStudioMediaUrl) {
  const mediaRefSource = mediaRefsToCandidateItems(shot.mediaRefs, kind);
  const legacySource = Array.isArray(kind === "video" ? shot.videoItems : shot.imageItems) ? (kind === "video" ? shot.videoItems : shot.imageItems) : [];
  const source = [...mediaRefSource, ...legacySource];
  const fallbackUrl = primaryUrl || (kind === "video" ? shot.videoResultUrl || shot.videoResult || shot.videoPath : shot.imageResultUrl || shot.imageResult || shot.imagePath) || "";
  const fallback = fallbackUrl ? [{ url: fallbackUrl, path: kind === "video" ? shot.videoPath || "" : shot.imagePath || "", primary: true }] : [];
  return [...source, ...fallback]
    .filter((item) => item?.url || item?.path || item?.imageUrl || item?.imagePath || item?.videoUrl || item?.videoPath)
    .map((item, index) => {
      const rawUrl = item.url || item.imageUrl || item.videoUrl || "";
      const path = item.path || item.imagePath || item.videoPath || "";
      const url = resolveCandidateMediaUrl(rawUrl, path, resolveMediaUrl);
      const rawThumbnailUrl = item.thumbnailUrl || item.imageThumbnailUrl || item.videoThumbnailUrl || "";
      const thumbnailPath = item.thumbnailPath || item.imageThumbnailPath || item.videoThumbnailPath || "";
      return {
        id: item.id || `${kind}-${url || index}`,
        url,
        path,
        imageUrl: kind === "image" ? url : "",
        videoUrl: kind === "video" ? url : "",
        thumbnailUrl: rawThumbnailUrl || thumbnailPath ? resolveCandidateMediaUrl(rawThumbnailUrl, thumbnailPath, resolveMediaUrl) : (kind === "image" ? url : ""),
        primary: Boolean(item.primary || (primaryUrl && url === primaryUrl)),
        discarded: Boolean(item.discarded),
        locked: Boolean(item.locked),
      };
    })
    .reduce((items, item) => {
      const key = item.url || item.path || item.imageUrl || item.videoUrl || item.id;
      const index = items.findIndex((candidate) => (candidate.url || candidate.path || candidate.imageUrl || candidate.videoUrl || candidate.id) === key);
      if (index >= 0) {
        items[index] = {
          ...items[index],
          ...item,
          thumbnailUrl: pickRicherThumbnailUrl(items[index].thumbnailUrl, item.thumbnailUrl, items[index].url || item.url),
          primary: items[index].primary || item.primary,
          discarded: items[index].discarded || item.discarded,
        };
        return items;
      }
      return [...items, item];
    }, []);
}

function pickPrimaryMediaRef(mediaRefs = [], kind = "image") {
  const source = (Array.isArray(mediaRefs) ? mediaRefs : []).filter((ref) => ref?.kind === kind && !ref.discarded);
  return source.find((ref) => ref.primary) || source[source.length - 1] || null;
}

function mediaRefsToCandidateItems(mediaRefs = [], kind = "image") {
  return (Array.isArray(mediaRefs) ? mediaRefs : [])
    .filter((ref) => ref?.kind === kind && !ref.discarded)
    .map((ref) => ({
      id: ref.id || "",
      url: ref.url || "",
      path: ref.localPath || "",
      imageUrl: kind === "image" ? ref.url || "" : "",
      imagePath: kind === "image" ? ref.localPath || "" : "",
      videoUrl: kind === "video" ? ref.url || "" : "",
      videoPath: kind === "video" ? ref.localPath || "" : "",
      thumbnailUrl: ref.thumbnailUrl || "",
      thumbnailPath: ref.thumbnailPath || "",
      primary: Boolean(ref.primary),
      discarded: Boolean(ref.discarded),
      locked: Boolean(ref.locked),
    }));
}

function normalizeAssetCandidates(asset = {}, primaryUrl = "", resolveMediaUrl = resolveStudioMediaUrl) {
  const mediaRefSource = mediaRefsToCandidateItems(asset.mediaRefs, "image");
  const source = [...mediaRefSource, ...(Array.isArray(asset.imageItems) ? asset.imageItems : [])];
  const fallbackUrl = primaryUrl || asset.image || "";
  const fallback = fallbackUrl ? [{ imageUrl: primaryUrl || fallbackUrl, imagePath: asset.imagePath || asset.image || "", primary: true }] : [];
  return [...source, ...fallback]
    .filter((item) => item?.imageUrl || item?.imagePath || item?.url || item?.path)
    .map((item, index) => {
      const rawImageUrl = item.imageUrl || item.url || "";
      const imagePath = item.imagePath || item.path || "";
      const imageUrl = resolveCandidateMediaUrl(rawImageUrl, imagePath, resolveMediaUrl);
      const rawThumbnailUrl = item.thumbnailUrl || item.imageThumbnailUrl || "";
      const thumbnailPath = item.thumbnailPath || item.imageThumbnailPath || "";
      return {
        id: item.id || `${imageUrl}-${index}`,
        imageUrl,
        imagePath,
        thumbnailUrl: rawThumbnailUrl || thumbnailPath ? resolveCandidateMediaUrl(rawThumbnailUrl, thumbnailPath, resolveMediaUrl) : imageUrl,
        primary: Boolean(item.primary || (primaryUrl && imageUrl === primaryUrl)),
        discarded: Boolean(item.discarded),
        locked: Boolean(item.locked),
      };
    })
    .reduce((items, item) => {
      const key = item.imageUrl || item.imagePath || item.id;
      const index = items.findIndex((candidate) => (candidate.imageUrl || candidate.imagePath || candidate.id) === key);
      if (index >= 0) {
        items[index] = {
          ...items[index],
          ...item,
          thumbnailUrl: pickRicherThumbnailUrl(items[index].thumbnailUrl, item.thumbnailUrl, items[index].imageUrl || item.imageUrl),
          primary: items[index].primary || item.primary,
          discarded: items[index].discarded || item.discarded,
        };
        return items;
      }
      return [...items, item];
    }, []);
}

export function resolveStudioMediaUrl(value = "", fallbackPath = "") {
  const raw = String(value || fallbackPath || "").trim();
  if (!raw) return "";
  if (isBrowserDisplayUrl(raw)) return raw;
  if (!isLikelyLocalFilePath(raw)) return raw;
  try {
    const internals = typeof window !== "undefined" ? window.__TAURI_INTERNALS__ : null;
    if (internals?.convertFileSrc) {
      return internals.convertFileSrc(raw, "asset");
    }
  } catch {
    return localPathToAssetUrl(raw);
  }
  return localPathToAssetUrl(raw);
}

function isBrowserDisplayUrl(value = "") {
  return /^(asset|https?|data|blob|file):/i.test(value) || value.startsWith("/assets/");
}

function isLikelyLocalFilePath(value = "") {
  return /^[a-zA-Z]:[\\/]/.test(value) || /^\\\\/.test(value) || value.startsWith("/");
}

function resolveCandidateMediaUrl(value = "", fallbackPath = "", resolveMediaUrl = resolveStudioMediaUrl) {
  const raw = String(value || "").trim();
  if (raw && isBrowserDisplayUrl(raw)) return raw;
  return resolveMediaUrl(raw, fallbackPath);
}

function localPathToAssetUrl(path = "") {
  const raw = String(path || "").trim();
  return raw ? `http://asset.localhost/${encodeURIComponent(raw)}` : "";
}

function pickRicherThumbnailUrl(current = "", next = "", mediaUrl = "") {
  if (current && current !== mediaUrl) return current;
  if (next && next !== mediaUrl) return next;
  return current || next || "";
}
