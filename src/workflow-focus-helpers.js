export function findWorkflowReviewTarget(report, ...statuses) {
  return (report?.targets || []).find((item) => item.shotId && statuses.includes(item.reviewStatus || "未审")) || null;
}

export function buildWorkflowFocusContext(stepKey, summary = {}, report = {}, episodeTimeline = { clips: [] }) {
  const targets = report?.targets || [];
  const clips = episodeTimeline?.clips || [];
  const findReviewTarget = (...statuses) => findWorkflowReviewTarget(report, ...statuses);

  if (stepKey === "review") {
    const target = findReviewTarget("未审")
      || findReviewTarget("待修改")
      || targets.find((item) => item.shotId && item.autoRevisionReport?.assetRefreshPlan?.length)
      || targets.find((item) => item.shotId)
      || null;
    return {
      reviewTargetId: target?.id || "",
      shotNodeId: target?.nodeId || summary.shotNodeId || "",
      shotId: target?.shotId || "",
      clipId: "",
    };
  }

  if (stepKey === "timeline" || stepKey === "export") {
    const missingMedia = clips.find((clip) => !String(clip.mediaUrl || "").trim()) || null;
    const pendingApproval = clips.find((clip) => String(clip.approvalStatus || "待验收") === "待验收") || null;
    const focusClip = missingMedia || pendingApproval || clips[0] || null;
    const reviewTarget = findReviewTarget("未审") || findReviewTarget("待修改") || null;
    return {
      reviewTargetId: reviewTarget?.id || "",
      shotNodeId: focusClip?.sourceNodeId || summary.shotNodeId || "",
      shotId: focusClip?.shotId || "",
      clipId: focusClip?.id || "",
    };
  }

  if (stepKey === "shot" || stepKey === "prompt") {
    const target = findReviewTarget("未审") || findReviewTarget("待修改") || targets.find((item) => item.shotId) || null;
    return {
      reviewTargetId: "",
      shotNodeId: target?.nodeId || summary.shotNodeId || "",
      shotId: target?.shotId || "",
      clipId: "",
    };
  }

  return {
    reviewTargetId: "",
    shotNodeId: summary.shotNodeId || "",
    shotId: "",
    clipId: "",
  };
}

export function formatWorkflowReviewLabel(report, targetId) {
  const target = (report?.targets || []).find((item) => item.id === targetId);
  if (!target) return "";
  return target.shotId ? `${target.shotId} · ${target.reviewStatus || "未审"}` : (target.title || "");
}

export function formatWorkflowClipLabel(episodeTimeline = { clips: [] }, clipId) {
  const clip = (episodeTimeline?.clips || []).find((item) => item.id === clipId);
  if (!clip) return "";
  return `${clip.title || clip.shotId || clip.id}${clip.shotId ? ` · ${clip.shotId}` : ""}`;
}

export function buildDashboardWorkflowFocus(summary = {}, report = {}, episodeTimeline = { clips: [] }) {
  const reviewFocus = buildWorkflowFocusContext("review", summary, report, episodeTimeline);
  const timelineFocus = buildWorkflowFocusContext("timeline", summary, report, episodeTimeline);
  const exportFocus = buildWorkflowFocusContext("export", summary, report, episodeTimeline);
  const shotFocus = buildWorkflowFocusContext("shot", summary, report, episodeTimeline);

  return {
    shotLabel: shotFocus.shotId || "",
    reviewLabel: formatWorkflowReviewLabel(report, reviewFocus.reviewTargetId),
    timelineLabel: formatWorkflowClipLabel(episodeTimeline, timelineFocus.clipId),
    exportLabel: formatWorkflowClipLabel(episodeTimeline, exportFocus.clipId) || formatWorkflowReviewLabel(report, exportFocus.reviewTargetId),
  };
}
