import {
  buildProductionTaskGraph,
} from "../task-graph/production-task-graph.js";
import {
  createNovelToVideoWorkflow,
  evaluateWorkflow,
} from "../workflow/production-workflow.js";
import {
  buildProductionCostSummary,
} from "../cost/cost-ledger.js";
import {
  buildProductionAuditReport,
} from "../events/production-audit-report.js";

export function buildProductionDashboard(project = {}, options = {}) {
  const episode = options.episode || project.activeEpisode || project.episodes?.find((item) => item.id === project.activeEpisodeId) || project.episodes?.[0] || {};
  const workflowState = options.workflowState || evaluateWorkflow(project, options.workflow || createNovelToVideoWorkflow(), {
    events: options.events || [],
    allowDefaultBible: options.allowDefaultBible,
  });
  const taskGraph = options.taskGraph || buildProductionTaskGraph(episode, options.taskOptions || {});
  const tasks = Array.isArray(taskGraph.tasks) ? taskGraph.tasks : [];
  const costSummary = buildProductionCostSummary({
    projectId: project.id || "",
    episodeId: episode.id || "",
    tasks,
    events: options.events || [],
  }, options.costOptions || {});
  const audit = buildProductionAuditReport(options.events || [], {
    projectId: project.id || "",
    episodeId: episode.id || "",
    ...(options.auditOptions || {}),
  });
  const riskReport = buildProductionRiskReport(project, {
    ...options,
    episode,
    workflowState,
    taskGraph,
    audit,
  });
  return {
    projectId: project.id || "",
    projectName: project.name || "",
    episodeId: episode.id || "",
    episodeTitle: episode.title || "",
    currentStage: workflowState.currentStage || "",
    blockers: workflowState.blockers || [],
    progressPercent: Math.round(Number(workflowState.progress || 0) * 100),
    readyForDelivery: Boolean(workflowState.readyForDelivery),
    totals: {
      shots: Array.isArray(episode.shots) ? episode.shots.length : 0,
      assets: Array.isArray(episode.assets) ? episode.assets.length : 0,
      tasks: tasks.length,
      readyTasks: taskGraph.ready?.length || 0,
      blockedTasks: taskGraph.blocked?.length || 0,
    },
    taskTypes: countBy(tasks, "type"),
    costs: costSummary,
    audit,
    riskReport,
    nextActions: buildNextActions(workflowState, taskGraph),
  };
}

export function buildProductionRiskReport(project = {}, options = {}) {
  const episode = options.episode || project.activeEpisode || project.episodes?.find((item) => item.id === project.activeEpisodeId) || project.episodes?.[0] || {};
  const shots = Array.isArray(episode.shots) ? episode.shots : [];
  const assets = Array.isArray(episode.assets) ? episode.assets : [];
  const clips = Array.isArray(episode.timeline?.clips) ? episode.timeline.clips : [];
  const tasks = Array.isArray(options.taskGraph?.tasks) ? options.taskGraph.tasks : [];
  const queue = Array.isArray(options.queue) ? options.queue : [];
  const events = Array.isArray(options.events) ? options.events : [];
  const blockers = Array.isArray(options.workflowState?.blockers) ? options.workflowState.blockers : [];
  const promptReadyShots = shots.filter((shot) => hasText(shot.imagePrompt || shot.prompt?.image) && hasText(shot.videoPrompt || shot.prompt?.video));
  const imageReadyShots = shots.filter((shot) => hasMedia(shot.imageResultUrl || shot.imageUrl || shot.image?.url || shot.imagePath));
  const videoReadyShots = shots.filter((shot) => hasMedia(shot.videoResultUrl || shot.videoUrl || shot.video?.url || shot.videoPath));
  const lockedAssets = assets.filter((asset) => {
    const lifecycle = String(asset.lifecycle || asset.reviewStatus || "").toLowerCase();
    return lifecycle === "locked" || lifecycle === "approved" || asset.locked || asset.hasImage || hasMedia(asset.imageUrl || asset.imagePath || asset.image?.url);
  });
  const failedQueue = queue.filter((job) => String(job.status || "") === "failed");
  const runningQueue = queue.filter((job) => String(job.status || "") === "running");
  const mediaPathIssues = collectMediaPathIssues({ shots, assets, clips });
  const providerTasks = tasks.filter((task) => ["asset.image", "shot.image", "shot.video"].includes(task.type));
  const manualProviderTasks = providerTasks.filter((task) => String(task.input?.sourceMode || task.providerMode || "").includes("upload") || task.status === "waiting-upload");
  const readyProviderTasks = providerTasks.filter((task) => task.status === "ready");
  const eventTypes = new Set(events.map((event) => event.type).filter(Boolean));
  const hasReviewEvent = [...eventTypes].some((type) => type.includes("review"));
  const hasDeliveryEvent = [...eventTypes].some((type) => type.includes("delivery"));
  const timelineReady = clips.length > 0 && clips.every((clip) => hasMedia(clip.mediaUrl || clip.videoUrl || clip.imageUrl || clip.mediaPath));
  const deliveryManifest = options.deliveryManifestReport || null;
  const consistency = options.consistencyReport || null;
  const migration = options.migrationReport || null;
  const security = options.securityReport || {};

  const items = [
    makeRisk({
      key: "guided-flow",
      title: "主流程不够闭环",
      severity: shots.length && blockers.length <= 1 ? "medium" : "high",
      ok: shots.length > 0 && promptReadyShots.length === shots.length && blockers.length <= 1,
      detail: shots.length ? `${promptReadyShots.length}/${shots.length} 个镜头具备图片和视频提示词` : "还没有形成可执行镜头表",
      action: shots.length ? "继续按当前阶段推进，避免跳回零散节点修改生产状态" : "先生成文本方案和镜头表",
      actionKind: shots.length ? "openDashboard" : "generateText",
    }),
    makeRisk({
      key: "state-authority",
      title: "工程数据不同步",
      severity: consistency && consistency.ok === false ? "critical" : "medium",
      ok: consistency ? consistency.ok !== false : true,
      detail: consistency && consistency.ok === false ? summarizeList(consistency.issues, "检测到商业模型/画布/时间线不一致") : "未发现同步报告阻塞",
      action: "一键同步主工作台、画布和时间线数据",
      actionKind: "repairStateAuthority",
    }),
    makeRisk({
      key: "delivery-chain",
      title: "当前集还不能导出",
      severity: videoReadyShots.length === shots.length && shots.length && timelineReady ? "medium" : "critical",
      ok: shots.length > 0 && videoReadyShots.length === shots.length && timelineReady,
      detail: shots.length ? `${videoReadyShots.length}/${shots.length} 条视频，${clips.length} 条时间线片段` : "缺少镜头、视频和时间线",
      action: videoReadyShots.length < shots.length ? "补齐视频素材" : "同步镜头到时间线并执行交付检查",
      actionKind: videoReadyShots.length < shots.length ? "generateVideos" : "syncTimeline",
    }),
    makeRisk({
      key: "provider-reliability",
      title: "模型服务需要处理",
      severity: failedQueue.length ? "critical" : manualProviderTasks.length && !readyProviderTasks.length ? "high" : "medium",
      ok: failedQueue.length === 0 && (readyProviderTasks.length > 0 || providerTasks.length === 0),
      detail: failedQueue.length ? `${failedQueue.length} 个生成任务失败` : manualProviderTasks.length ? `${manualProviderTasks.length} 个任务等待本地上传` : `${readyProviderTasks.length} 个模型任务可执行`,
      action: failedQueue.length ? "先重试失败任务或切换供应商" : "为图片/视频准备 API、ComfyUI 或上传兜底",
      actionKind: failedQueue.length ? "retryFailedQueue" : "openSettings",
      targetIds: failedQueue.map((job) => job.id || job.requestId).filter(Boolean),
    }),
    makeRisk({
      key: "failure-recovery",
      title: "失败恢复不够自动化",
      severity: failedQueue.length || runningQueue.length > 3 ? "high" : "medium",
      ok: failedQueue.length === 0 && runningQueue.length <= 3,
      detail: failedQueue.length ? summarizeList(failedQueue.map((job) => job.error || job.resultSummary || job.title), "队列存在失败任务") : `${runningQueue.length} 个运行中任务`,
      action: "集中处理失败队列，保留错误、目标和重试入口",
      actionKind: failedQueue.length ? "retryFailedQueue" : "openQueue",
      targetIds: failedQueue.map((job) => job.id || job.requestId).filter(Boolean),
    }),
    makeRisk({
      key: "media-integrity",
      title: "素材路径可能失效",
      severity: mediaPathIssues.length || deliveryManifest?.ok === false || migration?.ok === false ? "critical" : "medium",
      ok: !mediaPathIssues.length && deliveryManifest?.ok !== false && migration?.ok !== false,
      detail: mediaPathIssues.length ? summarizeList(mediaPathIssues, "检测到媒体字段缺口") : deliveryManifest?.ok === false ? summarizeList(deliveryManifest.issues, "Manifest 未通过") : "媒体引用字段完整",
      action: "优先保留本地路径、预览 URL 和缩略图三类字段",
      actionKind: "repairMedia",
    }),
    makeRisk({
      key: "real-chain-coverage",
      title: "缺少真实全链路验证",
      severity: hasReviewEvent && hasDeliveryEvent ? "medium" : "high",
      ok: hasReviewEvent && hasDeliveryEvent,
      detail: `审片事件 ${hasReviewEvent ? "已记录" : "缺失"}，交付事件 ${hasDeliveryEvent ? "已记录" : "缺失"}`,
      action: "跑通一次小说到导出的样例工程并归档事件",
      actionKind: "runFullChainCheck",
    }),
    makeRisk({
      key: "desktop-security",
      title: "桌面端安全边界偏宽",
      severity: security.strict === true ? "medium" : "high",
      ok: security.strict === true,
      detail: security.strict === true ? "当前配置声明为严格模式" : "需要复核 CSP、远程资源和本地 asset scope",
      action: "发布版收紧 CSP，避免不必要的远程脚本和宽泛本地访问",
      actionKind: "openSettings",
    }),
    makeRisk({
      key: "asset-consistency",
      title: "角色/场景一致性压不住",
      severity: assets.length && lockedAssets.length === assets.length ? "medium" : "critical",
      ok: assets.length > 0 && lockedAssets.length === assets.length,
      detail: assets.length ? `${lockedAssets.length}/${assets.length} 个资产已锁定或有定妆图` : "资产库为空",
      action: "先锁定角色、场景、道具资产，再批量生成镜头",
      actionKind: assets.length ? "repairAssetConsistency" : "generateText",
    }),
    makeRisk({
      key: "scope-control",
      title: "界面需要回到主流程",
      severity: blockers.length > 3 || tasks.length > 20 ? "high" : "medium",
      ok: blockers.length <= 3 && tasks.length <= 20,
      detail: `${tasks.length} 个生产任务，${blockers.length} 个流程阻塞`,
      action: "优先收敛文本、图片、视频、时间线、交付五段主链",
      actionKind: "focusMainChain",
    }),
  ];
  const open = items.filter((item) => !item.ok);
  return {
    ok: open.length === 0,
    score: Math.max(0, Math.round(((items.length - open.length) / items.length) * 100)),
    criticalCount: open.filter((item) => item.severity === "critical").length,
    highCount: open.filter((item) => item.severity === "high").length,
    openCount: open.length,
    items,
    topRisks: open.sort(compareRiskSeverity).slice(0, 5),
  };
}

function buildNextActions(workflowState = {}, taskGraph = {}) {
  if (taskGraph.ready?.length) {
    return taskGraph.ready.slice(0, 5).map((task) => ({
      type: "run-task",
      taskId: task.id,
      label: actionLabel(task.type),
      target: task.target,
    }));
  }
  if (workflowState.blockers?.length) {
    return workflowState.blockers.map((blocker) => ({
      type: "resolve-blocker",
      blocker,
      label: blockerLabel(blocker),
    }));
  }
  return [{ type: "delivery-ready", label: "Delivery package is ready" }];
}

function countBy(items = [], key = "") {
  return (Array.isArray(items) ? items : []).reduce((acc, item) => {
    const value = item[key] || "unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function makeRisk(input = {}) {
  return {
    key: input.key || "",
    title: input.title || "",
    severity: input.ok ? "info" : input.severity || "medium",
    ok: Boolean(input.ok),
    detail: input.detail || "",
    action: input.action || "",
    actionKind: input.actionKind || "",
    targetIds: Array.isArray(input.targetIds) ? input.targetIds : [],
  };
}

function hasText(value) {
  return String(value || "").trim().length > 0;
}

function hasMedia(value) {
  return String(value || "").trim().length > 0;
}

function collectMediaPathIssues({ shots = [], assets = [], clips = [] } = {}) {
  const issues = [];
  shots.forEach((shot) => {
    if ((shot.imageUrl || shot.imageResultUrl) && !(shot.imagePath || shot.imageResultPath || shot.imageThumbnailUrl)) {
      issues.push(`${shot.id || "镜头"} 缺图片本地路径或缩略图`);
    }
    if ((shot.videoUrl || shot.videoResultUrl) && !(shot.videoPath || shot.videoResultPath)) {
      issues.push(`${shot.id || "镜头"} 缺视频本地路径`);
    }
  });
  assets.forEach((asset) => {
    if ((asset.imageUrl || asset.image?.url) && !(asset.imagePath || asset.image?.path || asset.thumbnailUrl || asset.imageThumbnailUrl)) {
      issues.push(`${asset.name || asset.token || "资产"} 缺资产图片路径或缩略图`);
    }
  });
  clips.forEach((clip) => {
    if ((clip.mediaUrl || clip.videoUrl) && !(clip.mediaPath || clip.videoPath || clip.sourcePath)) {
      issues.push(`${clip.title || clip.shotId || "时间线片段"} 缺时间线媒体路径`);
    }
  });
  return issues;
}

function summarizeList(items = [], fallback = "") {
  const list = (Array.isArray(items) ? items : []).filter(Boolean).map(String);
  if (!list.length) return fallback;
  const head = list.slice(0, 2).join("；");
  return list.length > 2 ? `${head}；另 ${list.length - 2} 项` : head;
}

function compareRiskSeverity(a, b) {
  const rank = { critical: 0, high: 1, medium: 2, info: 3 };
  return (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9);
}

function actionLabel(type = "") {
  const labels = {
    "asset.image": "Generate asset image",
    "shot.image": "Generate shot image",
    "shot.video": "Generate shot video",
    "timeline.assemble": "Assemble timeline",
    "review.quality-gate": "Run review gate",
    "delivery.export": "Export delivery",
  };
  return labels[type] || "Run task";
}

function blockerLabel(blocker = "") {
  const labels = {
    sourceText: "Add novel source text",
    productionBible: "Complete production bible",
    script: "Generate script plan",
    assets: "Create asset registry",
    shots: "Create shot breakdown",
    approvedAssets: "Approve or lock assets",
    shotImages: "Generate all shot images",
    shotVideos: "Generate all shot videos",
    timeline: "Assemble timeline",
    approvedReview: "Pass review gate",
    delivery: "Export delivery package",
    eventLog: "Archive audit events",
  };
  return labels[blocker] || `Resolve ${blocker}`;
}
