export function collectShotTouchedTokens(shot, options = {}) {
  const dedupeOrderedStrings = options.dedupeOrderedStrings || ((values) => [...new Set((values || []).filter(Boolean))]);
  return dedupeOrderedStrings([
    ...((shot?.assetRefs || []).filter(Boolean)),
    shot?.mainCharacterToken,
    shot?.mainSceneToken,
    ...(((shot?.keyPropTokens || []).filter(Boolean))),
  ]).filter(Boolean);
}

export function buildShotRefreshExecutionPlan(shot, target, options = {}) {
  const inferShotRefreshPlanFromPatch = options.inferShotRefreshPlanFromPatch || ((currentShot) => currentShot?.autoRevisionReport?.assetRefreshPlan || []);
  const collectTouchedTokens = options.collectShotTouchedTokens || collectShotTouchedTokens;
  const refreshPlan = Array.isArray(shot?.autoRevisionReport?.assetRefreshPlan) && shot.autoRevisionReport.assetRefreshPlan.length
    ? shot.autoRevisionReport.assetRefreshPlan
    : inferShotRefreshPlanFromPatch(shot, shot);
  const planText = refreshPlan.join(" ");
  const touchedTokens = collectTouchedTokens(shot, options);
  return {
    refreshPlan,
    planText,
    touchedTokens,
    needsPromptRefresh: /提示词|prompt|生图|视频提示词|镜头提示/i.test(planText) || Boolean(options.forcePrompt),
    needsTimelineRefresh: /时间线|timeline|片段|素材|视频|画面/i.test(planText) || Boolean(options.forceTimeline),
    needsAssetRefresh: /资产|角色|场景|道具|定妆|设定/i.test(planText) || Boolean(options.forceAssets) || touchedTokens.length > 0,
    targetShotLabel: target?.shotId || shot?.id || "",
  };
}

export function buildAssetRefreshEvidence(shot, target, options = {}) {
  const dedupeOrderedStrings = options.dedupeOrderedStrings || ((values) => [...new Set((values || []).filter(Boolean))]);
  return dedupeOrderedStrings([
    ...(Array.isArray(shot?.autoRevisionReport?.fixedIssues) ? shot.autoRevisionReport.fixedIssues.slice(0, 3) : []),
    `刷新于 ${target?.shotId || shot?.id || "当前镜头"}`,
  ]);
}

export function buildRefreshPlanCompletionPatch(shot, refreshPlan, counters = {}, latestQuality = {}, options = {}) {
  const dedupeOrderedStrings = options.dedupeOrderedStrings || ((values) => [...new Set((values || []).filter(Boolean))]);
  return {
    reviewStatus: latestQuality.score >= 88 ? "已通过" : (shot?.reviewStatus || "待修改"),
    autoRevisionReport: {
      ...(shot?.autoRevisionReport || {}),
      assetRefreshPlan: [],
      executedRefreshPlan: dedupeOrderedStrings([
        ...(Array.isArray(shot?.autoRevisionReport?.executedRefreshPlan) ? shot.autoRevisionReport.executedRefreshPlan : []),
        ...(refreshPlan || []),
      ]),
      refreshSummary: `已执行刷新计划：资产 ${counters.assetCount || 0} · 提示词 ${counters.promptUpdated || 0} · 时间线 ${counters.timelineUpdated || 0}`,
      refreshCompletedAt: options.now ? options.now() : Date.now(),
      updatedAt: options.now ? options.now() : Date.now(),
    },
  };
}

export function buildAutoRevisionReportPayload(revision, refreshPlan, options = {}) {
  return {
    summary: revision?.summary || "",
    changeLog: Array.isArray(revision?.changeLog) ? revision.changeLog : [],
    fixedIssues: Array.isArray(revision?.fixedIssues) ? revision.fixedIssues : [],
    assetRefreshPlan: refreshPlan || [],
    executedRefreshPlan: [],
    refreshSummary: "",
    refreshCompletedAt: 0,
    updatedAt: options.now ? options.now() : Date.now(),
  };
}

export function buildTimelineRepairPlan(clip, options = {}) {
  const dedupeOrderedStrings = options.dedupeOrderedStrings || ((values) => [...new Set((values || []).filter(Boolean))]);
  const note = `${clip?.approvalNote || ""}`.toLowerCase();
  const mediaUrl = String(clip?.mediaUrl || "").trim();
  const actions = [];
  if (!mediaUrl || /重生素材|重做素材|重生|素材|画面|镜头不对|构图|节奏|表演|连续性|出图|视频/.test(note)) actions.push("media");
  if (/镜头|分镜|提示词|资产|角色|场景|道具|连续性漂移|重写/.test(note)) actions.push("shot");
  return dedupeOrderedStrings(actions);
}

export function refreshAssetsFromRevision(target, shot, revision, options = {}) {
  const collectTouchedTokensImpl = options.collectShotTouchedTokens || collectShotTouchedTokens;
  const touchedTokens = collectTouchedTokensImpl(shot, options);
  if (!touchedTokens.length) return 0;
  let changedCount = 0;
  touchedTokens.forEach((token) => {
    const category = options.parseAssetTokenCategory ? options.parseAssetTokenCategory(token) : "";
    if (!category) return;
    const changed = options.patchAssetRecord
      ? options.patchAssetRecord(token, category, {
        evidenceSource: (options.dedupeOrderedStrings || ((values) => values))( [
          ...(Array.isArray(revision?.fixedIssues) ? revision.fixedIssues.slice(0, 2) : []),
          `来自 ${target?.shotId || shot?.id || "当前镜头"} 自动修订`,
        ]),
      })
      : false;
    if (changed) changedCount += 1;
  });
  return changedCount;
}

export function executeShotRefreshPlanAction(target, options = {}) {
  const shot = options.getShotByTarget ? options.getShotByTarget(target) : null;
  if (!shot) throw new Error("没有找到要刷新的镜头");
  const executionPlan = buildShotRefreshExecutionPlan(shot, target, options);
  const { refreshPlan, touchedTokens, needsPromptRefresh, needsTimelineRefresh, needsAssetRefresh } = executionPlan;
  let assetCount = 0;
  let promptUpdated = 0;
  let timelineUpdated = 0;

  if (needsAssetRefresh && touchedTokens.length && options.patchAssetRecordForShotTokens) {
    assetCount += options.patchAssetRecordForShotTokens(touchedTokens, shot, target) || 0;
  }

  if (needsPromptRefresh && options.rebuildShotPrompts) {
    promptUpdated += options.rebuildShotPrompts(shot, target) || 0;
  }

  const latestShotAfterPrompt = options.getShotByTarget ? (options.getShotByTarget(target) || shot) : shot;
  const latestQuality = options.buildShotQualityReport ? options.buildShotQualityReport(latestShotAfterPrompt) : {};

  if ((needsTimelineRefresh || promptUpdated) && options.syncTimelineFromShot) {
    const timelineResult = options.syncTimelineFromShot(target, latestShotAfterPrompt) || {};
    timelineUpdated += timelineResult.timelineUpdated || 0;
  }

  if (options.patchShotRecord) {
    options.patchShotRecord(target.nodeId, target.shotId, buildRefreshPlanCompletionPatch(
      latestShotAfterPrompt,
      refreshPlan,
      { assetCount, promptUpdated, timelineUpdated },
      latestQuality,
      options,
    ));
  }

  if (options.appendCollaborationActivity) {
    options.appendCollaborationActivity({
      type: "review_refresh_plan",
      title: `执行刷新计划 ${target.shotId}`,
      detail: `资产 ${assetCount} · 提示词 ${promptUpdated} · 时间线 ${timelineUpdated}`,
      nodeId: target.nodeId,
      shotId: target.shotId,
      episodeId: options.episodeId || "",
    });
  }

  return { assetCount, promptUpdated, timelineUpdated, refreshPlan };
}

export async function autoReviseShotFromReviewAction(target, review, options = {}) {
  const shot = options.getShotByTarget ? options.getShotByTarget(target) : null;
  if (!shot) throw new Error("没有找到需要自动修改的镜头");
  const revision = await options.runRevision(target, review);
  const patch = options.normalizeShotRevisionPatch ? options.normalizeShotRevisionPatch(shot, revision.patch || {}) : (revision.patch || {});
  const refreshPlan = options.inferShotRefreshPlanFromPatch
    ? options.inferShotRefreshPlanFromPatch(shot, { ...shot, ...patch }, revision)
    : [];

  if (options.patchShotRecord) {
    options.patchShotRecord(target.nodeId, target.shotId, {
      ...patch,
      autoRevisionReport: buildAutoRevisionReportPayload(revision, refreshPlan, options),
    });
  }

  const revisedShot = options.normalizeShotRecord ? options.normalizeShotRecord({ ...shot, ...patch }) : { ...shot, ...patch };
  if (options.upsertTimelineClipFromShot) options.upsertTimelineClipFromShot(target.nodeId, revisedShot, { silent: true });
  if (options.refreshAssetsFromRevision) options.refreshAssetsFromRevision(target, revisedShot, revision);
  if (options.appendCollaborationActivity) {
    options.appendCollaborationActivity({
      type: "review_auto_fix",
      title: `按审稿自动修改 ${target.shotId}`,
      detail: `${revision.summary || revision.changeLog?.[0] || "已回写镜头并同步时间线"}`.slice(0, 120),
      nodeId: target.nodeId,
      shotId: target.shotId,
      episodeId: options.episodeId || "",
    });
  }

  if (!options.skipFinalReview && options.runFinalReview) {
    const finalReview = await options.runFinalReview(target);
    return { review: finalReview, revision };
  }
  return { review, revision };
}

export async function repairRejectedTimelineClipAction(clipId, options = {}) {
  const clip = options.findTimelineClipById ? options.findTimelineClipById(clipId) : null;
  if (!clip) throw new Error("没有找到要修复的时间线片段");
  const actions = buildTimelineRepairPlan(clip, options);
  let queued = 0;
  let shot = 0;

  const latestAfterText = (options.findTimelineClipById ? options.findTimelineClipById(clipId) : null) || clip;
  if (actions.includes("media") && !String(latestAfterText.mediaUrl || "").trim()) {
    if (options.queueGenerationForTimelineClip && options.queueGenerationForTimelineClip(latestAfterText, { silent: true })) queued += 1;
  }
  if (actions.includes("shot") && options.findShotByTimelineClip && options.patchShotRecord) {
    const linked = options.findShotByTimelineClip(latestAfterText);
    if (linked?.node?.id && linked?.shot?.id) {
      const nextPatch = {
        status: "待修改",
        reviewStatus: "待修改",
        reworkReason: String(latestAfterText.approvalNote || "").trim() || linked.shot.reworkReason || "时间线验收退回，需要回到镜头链路修复",
      };
      if (options.patchShotRecord(linked.node.id, linked.shot.id, nextPatch)) shot += 1;
    }
  }
  const repairSummary = [`自动修复：${actions.join(" / ") || "无动作"}`];
  if (queued) repairSummary.push(`重入队 ${queued}`);
  if (shot) repairSummary.push(`回送镜头 ${shot}`);
  if (options.patchTimelineClip) {
    options.patchTimelineClip(clipId, {
      approvalStatus: "待验收",
      approvalNote: `${repairSummary.join(" · ")}${clip.approvalNote ? `\n原退回：${clip.approvalNote}` : ""}`,
    });
  }
  const backfill = options.patchShotFromTimelineClip ? options.patchShotFromTimelineClip(clipId, { silent: true, approvalOnly: false }) : null;
  return {
    clipId,
    title: clip.title || clip.shotId || clip.id,
    actions,
    queued,
    shot,
    backfill: backfill?.synced || 0,
  };
}
