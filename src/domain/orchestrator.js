import {
  PIPELINE_COMMANDS,
  PIPELINE_EVENTS,
  PIPELINE_STAGE_KEYS,
  PRODUCTION_MODES,
  commandAllowedInMode,
  createPipelineCommand,
  createPipelineEvent,
} from "./pipeline-contracts.js";

export function buildTextOnlyCommand({ projectId = "", episodeId = "", novelText = "" } = {}, options = {}) {
  return createPipelineCommand(
    PIPELINE_COMMANDS.runTextOnly,
    {
      projectId,
      episodeId,
      novelText: String(novelText || ""),
      stopAfter: PIPELINE_STAGE_KEYS.shot,
    },
    {
      ...options,
      mode: PRODUCTION_MODES.textOnly,
    },
  );
}

export function buildFullProductionCommand({ projectId = "", episodeId = "", shotIds = [] } = {}, options = {}) {
  return createPipelineCommand(
    PIPELINE_COMMANDS.runFullProduction,
    {
      projectId,
      episodeId,
      shotIds: Array.isArray(shotIds) ? shotIds.filter(Boolean) : [],
      stopAfter: PIPELINE_STAGE_KEYS.export,
    },
    {
      ...options,
      mode: PRODUCTION_MODES.full,
    },
  );
}

export function buildTextPackageCompletedEvent(command, result = {}, options = {}) {
  return createPipelineEvent(
    PIPELINE_EVENTS.textCompleted,
    {
      projectId: command?.payload?.projectId || "",
      episodeId: command?.payload?.episodeId || "",
      scriptReady: Boolean(result.script),
      assets: {
        characters: result.characters || result.characterAssets || [],
        scenes: result.scenes || result.sceneAssets || [],
        props: result.props || result.propAssets || [],
      },
      shots: result.shots || [],
      promptReady: countPromptReady(result.shots || []),
    },
    {
      ...options,
      commandId: command?.id || "",
    },
  );
}

export function planCommandsForMode(commands = [], mode = PRODUCTION_MODES.full) {
  const source = Array.isArray(commands) ? commands : [];
  const allowed = [];
  const blocked = [];
  source.forEach((command) => {
    if (commandAllowedInMode(command, mode)) allowed.push(command);
    else blocked.push(command);
  });
  return { allowed, blocked };
}

export function resolveProductionMode(options = {}) {
  return options?.mode === PRODUCTION_MODES.textOnly ? PRODUCTION_MODES.textOnly : PRODUCTION_MODES.full;
}

export function isTextProductionMode(mode = PRODUCTION_MODES.full) {
  return mode === PRODUCTION_MODES.textOnly;
}

export function isTextProductionReady(summary = {}) {
  const shots = Number(summary.shots || 0);
  return Boolean(summary.scripts || 0)
    && Boolean(summary.characters || 0)
    && Boolean(summary.scenes || 0)
    && shots > 0
    && Number(summary.promptReady || 0) >= shots;
}

export function summarizePipelineSnapshot(snapshot = {}, mode = PRODUCTION_MODES.full) {
  const shots = Number(snapshot.shots || 0);
  const promptReady = Number(snapshot.promptReady || 0);
  const textReady = isTextProductionReady({ ...snapshot, shots, promptReady });
  const imageReady = shots > 0 && Number(snapshot.imagesReady || snapshot.imageReady || 0) >= shots;
  const videoReady = shots > 0 && Number(snapshot.videosReady || snapshot.videoReady || 0) >= shots;
  const exportReady = Boolean(snapshot.exportReady);
  const stages = [
    { key: PIPELINE_STAGE_KEYS.novel, label: "小说/剧本", done: Boolean(snapshot.scripts || 0) },
    { key: PIPELINE_STAGE_KEYS.asset, label: "资产", done: Boolean(snapshot.characters || 0) && Boolean(snapshot.scenes || 0) },
    { key: PIPELINE_STAGE_KEYS.shot, label: "镜头表", done: shots > 0 && promptReady >= shots },
  ];
  if (mode !== PRODUCTION_MODES.textOnly) {
    stages.push(
      { key: PIPELINE_STAGE_KEYS.image, label: "图片", done: imageReady },
      { key: PIPELINE_STAGE_KEYS.video, label: "视频", done: videoReady },
      { key: PIPELINE_STAGE_KEYS.export, label: "导出", done: exportReady },
    );
  }
  const doneCount = stages.filter((stage) => stage.done).length;
  return {
    mode,
    textReady,
    mediaReady: imageReady && videoReady,
    exportReady,
    stages,
    nextStage: stages.find((stage) => !stage.done) || stages[stages.length - 1] || null,
    progress: stages.length ? Math.round((doneCount / stages.length) * 100) : 0,
    shouldStop: mode === PRODUCTION_MODES.textOnly && textReady,
  };
}

export function buildAutopilotStartMessage(mode = PRODUCTION_MODES.full) {
  return isTextProductionMode(mode)
    ? "文本生产已启动：会推进到资产输出和镜头表提示词，不会自动生成图片。"
    : "后台自动生产已启动：会自动推进流程、执行队列，并把结果回填到镜头表和时间线。";
}

export function buildTextProductionCompleteResult(summary = {}, receipts = [], options = {}) {
  return {
    title: "文本生产完成",
    summary: options.summary || "资产输出、镜头表和提示词已经就绪；图片生成未启动。",
    metrics: [
      { label: "角色", value: summary.characters || 0 },
      { label: "场景", value: summary.scenes || 0 },
      { label: "镜头", value: summary.shots || 0 },
      { label: "提示词", value: `${summary.promptReady || 0}/${summary.shots || 0}` },
    ],
    details: compactReceiptDetails(receipts, 6),
  };
}

export function describeAutopilotPauseReason(summary = {}, pending = 0, failed = 0) {
  if (failed > 0) return `还有 ${failed} 个任务多次失败，需要检查 API/ComfyUI 或打开队列定位失败镜头。`;
  if (pending > 0) return `还有 ${pending} 个任务待执行，队列可能仍在等待运行。`;
  if (!summary.novelNodeId) return "当前集还没有小说工厂节点，请先搭起步流程或导入小说。";
  if (!(summary.scripts || 0)) return "当前集还没有可生产剧本，通常需要补小说输入或文本 API。";
  if (!(summary.characters || 0) || !(summary.scenes || 0)) return "角色或场景资产还没锁定，后台已停在资产准备阶段。";
  if (!(summary.shots || 0)) return "还没有镜头表，后台已停在拆镜阶段。";
  if ((summary.promptReady || 0) < (summary.shots || 0)) return `还有 ${(summary.shots || 0) - (summary.promptReady || 0)} 条镜头提示词未补齐。`;
  if ((summary.pendingReview || 0) || (summary.autoFixPending || 0) || (summary.refreshPlanPending || 0)) return "审稿闭环还未清零，需要继续审稿、自动修改或执行刷新计划。";
  if ((summary.timelineStageBoard?.missingMedia || 0) > 0) return `时间线还有 ${summary.timelineStageBoard.missingMedia} 条片段缺素材。`;
  if ((summary.timelineStageBoard?.pendingApproval || 0) > 0) return `时间线还有 ${summary.timelineStageBoard.pendingApproval} 条片段待验收。`;
  if ((summary.timelineStageBoard?.rejected || 0) > 0) return `时间线还有 ${summary.timelineStageBoard.rejected} 条片段被退回修改。`;
  if (!summary.exportReady) return "导出门槛还未完全满足，但当前没有新的自动动作可执行。";
  return "当前已经推进到可自动处理的最后一步。";
}

export function buildAutopilotPauseResult({
  mode = PRODUCTION_MODES.full,
  summary = {},
  pending = 0,
  failed = 0,
  receipts = [],
  pauseReason = "",
} = {}) {
  const textMode = isTextProductionMode(mode);
  const reason = pauseReason || describeAutopilotPauseReason(summary, pending, failed);
  return {
    title: textMode ? "文本生产已暂停" : "后台自动生产已暂停",
    summary: reason,
    metrics: [
      { label: "执行步骤", value: Array.isArray(receipts) ? receipts.length : 0 },
      { label: "待队列", value: pending },
      { label: "失败", value: failed },
      { label: "待素材", value: summary.timelineStageBoard?.missingMedia || 0 },
    ],
    details: [
      ...compactReceiptDetails(receipts, 5),
      reason,
    ],
  };
}

function countPromptReady(shots = []) {
  return (Array.isArray(shots) ? shots : []).filter((shot) => (
    String(shot?.imagePrompt || "").trim() && String(shot?.videoPrompt || "").trim()
  )).length;
}

function compactReceiptDetails(receipts = [], limit = 6) {
  return (Array.isArray(receipts) ? receipts : [])
    .map((item) => item?.summary || item?.title)
    .filter(Boolean)
    .slice(-limit);
}
