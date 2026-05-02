import {
  applyAssetConsistencyPlan,
  buildAssetConsistencyPlan,
} from "../domain/asset-consistency.js";
import {
  applyMediaIntegrityRepairPlan,
  buildMediaIntegrityRepairPlan,
} from "../domain/media-integrity-repair.js";
import {
  syncTimelineFromShotsInProject,
} from "../domain/project-timeline-model.js";
import {
  buildMissingMediaBatchSummary,
  runBatchTimelineRepairs,
  summarizeTimelineRepairBatch,
} from "../delivery-workflow-helpers.js";

export function repairLegacyTimelineFromBusinessAction({
  commercialProject = {},
  activeEpisodeId = "",
  pushHistory = () => {},
  syncLegacyTimelineFromBusinessProject = () => {},
  setProjectMessage = () => {},
} = {}) {
  pushHistory();
  syncLegacyTimelineFromBusinessProject(commercialProject, commercialProject?.activeEpisode?.id || activeEpisodeId);
  const summary = "旧时间线已同步。";
  setProjectMessage("已用商业模型修复高级时间线投影。");
  return { summary };
}

export function repairBusinessTimelineFromLegacyAction({
  commercialProject = {},
  activeEpisodeId = "",
  timeline = {},
  defaultEpisodeTimeline,
  getEpisodeTimeline,
  pushHistory = () => {},
  projectCommandService,
  setProjectMessage = () => {},
} = {}) {
  pushHistory();
  const episodeId = commercialProject?.activeEpisode?.id || activeEpisodeId;
  const legacyTimeline = getEpisodeTimeline(timeline, episodeId, { defaultEpisodeTimeline });
  const result = projectCommandService.replaceEpisodeTimeline({
    episodeId,
    timeline: legacyTimeline,
  });
  setProjectMessage(`已用高级时间线修复商业模型：${legacyTimeline?.clips?.length || 0} 个片段。`);
  return result;
}

export function relocateMediaRootAction({
  commercialProject = {},
  oldRoot = "",
  newRoot = "",
  buildMediaRelocationPlan,
  projectCommandService,
  pushHistory = () => {},
  syncLegacyTimelineFromBusinessProject = () => {},
  activeEpisodeId = "",
  setProjectMessage = () => {},
} = {}) {
  const plan = buildMediaRelocationPlan(commercialProject, oldRoot, newRoot);
  if (!plan.changed) {
    setProjectMessage("没有找到可重定位的媒体路径，请检查旧根目录。");
    return plan;
  }
  pushHistory();
  const result = projectCommandService.commitStoreAction({
    type: "hydrate",
    project: plan.project,
    source: "media-relocation",
  }, {
    materializeCanvas: true,
    eventType: "production.media.relocated",
    detail: `${plan.replacements || 0} paths`,
  });
  syncLegacyTimelineFromBusinessProject(result.project, result.project?.activeEpisode?.id || activeEpisodeId);
  setProjectMessage(`已重定位 ${plan.replacements || 0} 个媒体路径。`);
  return plan;
}

export function repairAssetConsistencyAction({
  commercialProject = {},
  activeEpisodeId = "",
  projectCommandService,
  setProjectMessage = () => {},
} = {}) {
  const episodeId = commercialProject?.activeEpisode?.id || activeEpisodeId;
  const assets = commercialProject?.activeEpisode?.assets || [];
  const plan = buildAssetConsistencyPlan(commercialProject?.activeEpisode || {});
  const result = projectCommandService.commitStoreAction({
    type: "updateEpisode",
    episodeId,
    updater: (episode) => applyAssetConsistencyPlan(episode, plan),
  }, {
    materializeCanvas: true,
    eventType: "production.asset.consistency_repaired",
    detail: `${plan.lockedCount} locked, ${plan.enrichedCount} enriched, ${plan.shotPatchCount} shots`,
  });
  const summary = `锁定 ${plan.lockedCount} 个资产，补充 ${plan.enrichedCount} 条连续性规则，回填 ${plan.shotPatchCount} 个镜头。`;
  setProjectMessage(assets.length
    ? `资产一致性修复完成：${summary}`
    : "当前没有资产可锁定，请先生成文本方案。");
  return {
    ...result,
    summary,
    plan,
  };
}

export function repairMediaIntegrityAction({
  commercialProject = {},
  activeEpisodeId = "",
  projectCommandService,
  syncLegacyTimelineFromBusinessProject = () => {},
  setProjectMessage = () => {},
} = {}) {
  const plan = buildMediaIntegrityRepairPlan(commercialProject);
  if (!plan.repairCount) {
    const summary = "没有发现可自动修复的断链。";
    setProjectMessage("素材路径检查完成：没有发现可自动修复的断链。");
    return { summary, plan };
  }
  const nextProject = applyMediaIntegrityRepairPlan(commercialProject, plan);
  const result = projectCommandService.commitStoreAction({
    type: "hydrate",
    project: nextProject,
    source: "media-integrity-repair",
  }, {
    materializeCanvas: true,
    eventType: "production.media.integrity_repaired",
    detail: `${plan.repairCount} repairs`,
  });
  syncLegacyTimelineFromBusinessProject(result.project, result.project?.activeEpisode?.id || activeEpisodeId);
  const summary = `素材路径自动修复完成：${plan.repairCount} 项。`;
  setProjectMessage(summary);
  return { ...result, summary, plan };
}

export function repairStateAuthorityAction({
  commercialProject = {},
  activeEpisodeId = "",
  projectCommandService,
  syncLegacyTimelineFromBusinessProject = () => {},
  setProjectMessage = () => {},
} = {}) {
  const episodeId = commercialProject?.activeEpisode?.id || activeEpisodeId || commercialProject?.activeEpisodeId || "";
  const nextProject = syncTimelineFromShotsInProject(commercialProject, { episodeId });
  const result = projectCommandService.commitStoreAction({
    type: "hydrate",
    project: nextProject,
    source: "state-authority-repair",
  }, {
    materializeCanvas: true,
    eventType: "production.state_authority.repaired",
    detail: episodeId,
  });
  syncLegacyTimelineFromBusinessProject(result.project, result.project?.activeEpisode?.id || episodeId);
  const clips = result.project?.activeEpisode?.timeline?.clips?.length || 0;
  const summary = `已重建商业时间线并投影画布：${clips} 个片段。`;
  setProjectMessage(summary);
  return { ...result, summary };
}

export async function runRejectedTimelineRepairBatchAction({
  episodeTimeline = {},
  setProjectMessage = () => {},
  runRepair = async () => null,
} = {}) {
  const targets = (episodeTimeline.clips || []).filter((clip) => String(clip.approvalStatus || "") === "退回修改");
  if (!targets.length) {
    setProjectMessage("当前集没有退回修改的时间线片段");
    return { repaired: 0, queued: 0, shot: 0, backfilled: 0, clips: [] };
  }
  const results = await runBatchTimelineRepairs(targets, {
    onProgress: ({ index, total, clip }) => {
      setProjectMessage(`修复退回片段中 ${index + 1}/${total} · ${clip.title || clip.shotId || clip.id}`);
    },
    runRepair,
  });
  const summary = summarizeTimelineRepairBatch(results);
  setProjectMessage(`退回片段自动修复完成：${summary.repaired} 条，重入队 ${summary.queued}`);
  return summary;
}

export function runMissingMediaBatchAction({
  episodeTimeline = {},
  queueGenerationForTimelineClip = () => false,
  setShowQueue = () => {},
  setProjectMessage = () => {},
} = {}) {
  const missingMediaClips = (episodeTimeline.clips || []).filter((clip) => !String(clip.mediaUrl || "").trim());
  if (!missingMediaClips.length) {
    setProjectMessage("当前集没有待补素材的时间线片段");
    return { queued: 0, clips: [] };
  }
  let queued = 0;
  missingMediaClips.forEach((clip) => {
    if (queueGenerationForTimelineClip(clip, { silent: true })) queued += 1;
  });
  setShowQueue(true);
  setProjectMessage(`已为 ${queued} 条待补素材片段加入生成队列`);
  return buildMissingMediaBatchSummary(missingMediaClips, queued);
}

export function recoverTimelineGapsAction({
  episodeTimeline = {},
  episodeId = "",
  prepareTimelineClipsForExport = () => ({}),
  setProjectMessage = () => {},
} = {}) {
  const missingClipIds = (episodeTimeline.clips || [])
    .filter((clip) => !String(clip.mediaUrl || "").trim())
    .map((clip) => clip.id)
    .filter(Boolean);
  if (!missingClipIds.length) {
    setProjectMessage("当前集时间线没有待补素材片段。");
    return { processed: 0, synced: 0, queued: 0 };
  }
  const result = prepareTimelineClipsForExport(episodeId, missingClipIds, { silent: true });
  setProjectMessage(`已推进 ${missingClipIds.length} 条时间线缺口：同步 ${result.synced || 0} · 入队 ${result.queued || 0}`);
  return result;
}
