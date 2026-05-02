export function queueStatusLabel(status) {
  return {
    pending: "等待中",
    running: "生成中",
    done: "已完成",
    failed: "失败",
  }[status] || status;
}

export function queuePriorityRank(priority) {
  return { "高": 0, "中": 1, "低": 2 }[priority] ?? 1;
}

export function queueKindLabel(kind) {
  return {
    image: "图片",
    video: "视频",
    exportVideo: "导出",
    exportPackage: "工程包",
  }[kind] || kind || "任务";
}

export function compareQueueJobs(a, b) {
  const priorityGap = queuePriorityRank(a.priority) - queuePriorityRank(b.priority);
  if (priorityGap !== 0) return priorityGap;
  return (a.createdAt || 0) - (b.createdAt || 0);
}

export function summarizeQueue(queue) {
  return (Array.isArray(queue) ? queue : []).reduce((acc, job) => {
    acc.total += 1;
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, { total: 0, pending: 0, running: 0, done: 0, failed: 0 });
}

export function summarizeEpisodeTotals(episodeSummaries) {
  return (Array.isArray(episodeSummaries) ? episodeSummaries : []).reduce((acc, episode) => ({
    nodes: acc.nodes + (episode.nodes || 0),
    edges: acc.edges + (episode.edges || 0),
    shots: acc.shots + (episode.shots || 0),
    completedShots: acc.completedShots + (episode.completedShots || 0),
    characters: acc.characters + (episode.characters || 0),
    scenes: acc.scenes + (episode.scenes || 0),
    props: acc.props + (episode.props || 0),
    resources: acc.resources + (episode.resources || 0),
    timelineClips: acc.timelineClips + (episode.timelineClips || 0),
    pendingReview: acc.pendingReview + (episode.pendingReview || 0),
    autoFixPending: acc.autoFixPending + (episode.autoFixPending || 0),
    refreshPlanPending: acc.refreshPlanPending + (episode.refreshPlanPending || 0),
    timelineBackfillPending: acc.timelineBackfillPending + (episode.timelineBackfillPending || 0),
    snapshots: acc.snapshots + (episode.snapshots || 0),
    milestones: acc.milestones + (episode.milestones || 0),
    failedExports: acc.failedExports + (episode.failedExports || 0),
  }), {
    nodes: 0,
    edges: 0,
    shots: 0,
    completedShots: 0,
    characters: 0,
    scenes: 0,
    props: 0,
    resources: 0,
    timelineClips: 0,
    pendingReview: 0,
    autoFixPending: 0,
    refreshPlanPending: 0,
    timelineBackfillPending: 0,
    snapshots: 0,
    milestones: 0,
    failedExports: 0,
  });
}

export function buildArchiveReportFromState(state, episodes, activeEpisodeId) {
  const episodeName = episodes.find((item) => item.id === activeEpisodeId)?.name || "当前集";
  const snapshots = (state.snapshots || []).filter((item) => !item.episodeId || item.episodeId === activeEpisodeId);
  const milestones = new Set(state.milestoneIds || []);
  const latestMilestone = snapshots.find((item) => milestones.has(item.id));
  return {
    episodeName,
    summary: {
      snapshots: snapshots.length,
      milestones: snapshots.filter((item) => milestones.has(item.id)).length,
      lastStage: snapshots[0]?.stage || "未建立",
      deliveryReady: Boolean(String(state.deliveryNote || "").trim()),
      latestMilestone: latestMilestone?.label || "",
    },
    archiveIndex: {
      episodeName,
      deliveryNote: state.deliveryNote || "",
      snapshots: snapshots.map((item) => buildArchiveSnapshotSummary(item, milestones)),
    },
    blockers: [
      { key: "deliveryNote", label: "交付备注", ready: Boolean(String(state.deliveryNote || "").trim()), detail: state.deliveryNote ? "已填写交付说明" : "建议补充交付说明、版本差异和对接备注。" },
      { key: "milestone", label: "里程碑快照", ready: Boolean(latestMilestone), detail: latestMilestone ? `最新里程碑：${latestMilestone.label}` : "建议至少标记一个交付版或归档版快照。" },
      { key: "snapshot", label: "项目快照", ready: snapshots.length > 0, detail: snapshots.length ? `当前集已有 ${snapshots.length} 个快照` : "当前还没有可回滚快照。" },
    ],
    milestoneIds: [...milestones],
    deliveryNote: state.deliveryNote || "",
    snapshots: snapshots.map((item) => buildArchiveSnapshotSummary(item, milestones)),
  };
}

export function makeHealthFinding(level, category, text, episode, nodeId = "", detail = "") {
  return {
    level,
    category,
    text,
    detail,
    nodeId,
    episodeId: episode?.id || "",
    episodeName: episode?.name || "全项目",
  };
}

export function makeFixableHealthFinding(level, category, text, episode, nodeId = "", detail = "", fix = null) {
  return {
    ...makeHealthFinding(level, category, text, episode, nodeId, detail),
    fix,
  };
}

function buildArchiveSnapshotSummary(item, milestones) {
  return {
    id: item.id,
    label: item.label,
    stage: item.stage,
    createdAt: item.createdAt,
    summary: item.summary,
    metrics: item.metrics,
    isMilestone: milestones.has(item.id),
  };
}
