import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { buildQueueFailureDetails } from "../domain/queue-diagnostics.js";

function buildDashboardRunHints(active, mode = "review") {
  const hints = [];
  if (!active?.shots) {
    hints.push({ label: "缺少镜头表", action: "prompt", detail: "先生成镜头表和提示词，后面的闭环才有东西可跑。" });
    return hints;
  }
  if (mode === "review" || mode === "timeline" || mode === "export") {
    if (active.pendingReview > 0) hints.push({ label: `还有 ${active.pendingReview} 个待审镜头`, action: "review", detail: "先打开审稿反馈，或直接继续跑审稿闭环。" });
    if (active.autoFixPending > 0) hints.push({ label: `还有 ${active.autoFixPending} 个待自动修改`, action: "review", detail: "这些镜头已有审稿意见，但还没自动改完。" });
    if (active.refreshPlanPending > 0) hints.push({ label: `还有 ${active.refreshPlanPending} 个待刷新计划`, action: "review", detail: "自动修改后还要把资产、提示词和时间线一起回刷。" });
  }
  if (mode === "timeline" || mode === "export") {
    if (!active.timelineClips) hints.push({ label: "当前还没时间线", action: "timeline", detail: "需要先把镜头导入时间线。" });
    else {
      const missingMedia = Math.max(0, (active.timelineClips || 0) - (active.timelineReady || 0));
      if (missingMedia > 0) hints.push({ label: `还有 ${missingMedia} 条时间线待素材`, action: "timeline", detail: "先补生成或同步已有素材。" });
      if ((active.timelineStageBoard?.pendingApproval || 0) > 0) hints.push({ label: `还有 ${active.timelineStageBoard?.pendingApproval || 0} 条待验收片段`, action: "timeline", detail: "先让 API 判断当前片段是否可直接进导出。" });
      if ((active.timelineStageBoard?.rejected || 0) > 0) hints.push({ label: `还有 ${active.timelineStageBoard?.rejected || 0} 条退回片段待修复`, action: "timeline", detail: "系统可以先按退回备注自动补文字轨、重生素材或回送镜头链路。" });
      if ((active.timelineBackfillPending || 0) > 0) hints.push({ label: `还有 ${active.timelineBackfillPending || 0} 条待回写镜头`, action: "timeline", detail: "时间线里的验收和素材结果还没同步回镜头表。" });
    }
  }
  if (mode === "export" && !active.exportReady) {
    hints.push({ label: "当前还没达到导出门槛", action: "export", detail: "把素材和审稿状态清到位后再入导出队列。" });
  }
  return hints.slice(0, 6);
}

function buildWorkflowBlockers(active, nextWorkflow, strictStatus) {
  if (!active || !nextWorkflow) return [];
  const blockers = [];
  const push = (tone, title, detail, action) => blockers.push({ tone, title, detail, action });
  if (nextWorkflow.key === "novel") {
    push(active?.scripts ? "warn" : "danger", "当前还没有稳定剧本产出", active?.scripts ? "已有小说工厂节点，但还需要继续推进到可生产剧本。" : "先搭起小说工厂，并把文本 API 配好。", active?.novelNodeId ? "novel" : "settings");
  }
  if (nextWorkflow.key === "asset") {
    if ((active?.characters || 0) === 0) push("danger", "人物资产还没锁定", "先把主角和关键人物抽出来，后面镜头和生图才不会一直变脸。", "asset");
    if ((active?.scenes || 0) === 0) push("danger", "场景资产还没锁定", "核心空间没建起来，镜头连续性会一直漂。", "asset");
    if ((active?.props || 0) === 0) push("warn", "关键道具还偏少", "道具不是绝对阻塞，但剧情关键物最好尽早抽资产。", "resources");
  }
  if (nextWorkflow.key === "shot") {
    if ((active?.shotLists || 0) === 0) push("danger", "当前还没有镜头表", "先生成镜头表，后面的审稿、时间线、导出都依赖它。", "shot");
    if ((active?.shots || 0) > 0 && strictStatus?.promptCoverage < 1) push("warn", "镜头提示词还没补满", `当前只完成 ${(strictStatus.promptCoverage * 100).toFixed(0)}% 的图片/视频提示词，先补满再往下走会更稳。`, "shot");
  }
  if (nextWorkflow.key === "review") {
    if ((active?.pendingReview || 0) > 0) push("danger", `还有 ${active.pendingReview || 0} 个镜头未审`, "先跑 API 审稿，系统才知道哪些镜头应该自动修改。", "review");
    if ((active?.autoFixPending || 0) > 0) push("warn", `还有 ${active.autoFixPending || 0} 个镜头待自动修改`, "这些镜头已经拿到审稿意见，下一步就是按意见自动修。", "review");
    if ((active?.refreshPlanPending || 0) > 0) push("warn", `还有 ${active.refreshPlanPending || 0} 个刷新计划未执行`, "自动修改之后还要回刷资产、提示词和时间线，闭环才算真正完成。", "review");
  }
  if (nextWorkflow.key === "timeline") {
    if ((active?.timelineClips || 0) === 0) push("danger", "镜头还没导入时间线", "先把镜头排进时间线，后面才谈得上挂素材和调节奏。", "timeline");
    if ((active?.timelineClips || 0) > (active?.timelineReady || 0)) push("warn", `还有 ${(active?.timelineClips || 0) - (active?.timelineReady || 0)} 条片段待挂素材`, "优先同步已有结果或继续生成缺失素材。", "timeline");
    if ((active?.timelineStageBoard?.rejected || 0) > 0) push("danger", `还有 ${active?.timelineStageBoard?.rejected || 0} 条片段退回修改`, "先修复被退回的片段，再继续验收或导出。", "timeline");
    if ((active?.timelineBackfillPending || 0) > 0) push("warn", `还有 ${active?.timelineBackfillPending || 0} 条时间线结果待回写`, "先把时间线里的验收和素材结果回写到镜头表，避免两边状态脱节。", "timeline");
  }
  if (nextWorkflow.key === "export") {
    if (!active?.exportReady) push("danger", "当前还没达到导出门槛", "素材或审稿状态还有缺口，先顺推到可导出。", "export");
    if ((active?.timelineStageBoard?.pendingApproval || 0) > 0) push("warn", `还有 ${active?.timelineStageBoard?.pendingApproval || 0} 条时间线片段待验收`, "先让 API 审掉这些片段，再决定是直接导出还是退回修改。", "timeline");
    if ((active?.failedExports || 0) > 0) push("warn", `还有 ${active.failedExports || 0} 条失败导出`, "这些失败记录最好先恢复，不然最终交付会被卡住。", "export");
  }
  return blockers.slice(0, 4);
}

function buildWorkflowDirectActions(nextWorkflow, handlers = {}) {
  if (!nextWorkflow) return [];
  if (nextWorkflow.key === "review") {
    return [
      { label: "一键审稿闭环", action: handlers.onReviewClosure, tone: "primary" },
      { label: "打开审稿反馈", action: handlers.onOpenReview },
      { label: "去镜头表", action: handlers.onOpenShot },
    ];
  }
  if (nextWorkflow.key === "timeline") {
    return [
      { label: "一键推进到时间线可交付", action: handlers.onTimelineClosure, tone: "primary" },
      { label: "打开时间线", action: handlers.onOpenTimeline },
      { label: "打开队列", action: handlers.onOpenQueue },
    ];
  }
  if (nextWorkflow.key === "export") {
    return [
      { label: "一键推进到可导出", action: handlers.onExportClosure, tone: "primary" },
      { label: "打开成片导出", action: handlers.onOpenExport },
      { label: "打开时间线", action: handlers.onOpenTimeline },
    ];
  }
  return [
    { label: "执行当前下一步", action: handlers.onContinue, tone: "primary" },
    { label: "定位当前工位", action: handlers.onLocateStep },
  ];
}

function buildFailureRecoveryActions(kind, detail = "", handlers = {}) {
  const text = String(detail || "");
  const actions = [];
  const push = (label, action, tone = "") => {
    if (!action) return;
    if (actions.some((item) => item.label === label)) return;
    actions.push({ label, action, tone });
  };

  push(kind.includes("智能继续") ? "重试智能继续" : kind.includes("审稿") ? "重试审稿闭环" : kind.includes("时间线") ? "重试时间线顺推" : "重试导出推进", handlers.retry, "primary");

  if (/API|apiKey|文本 API|小说工厂 API|HTTP 401|HTTP 403|HTTP 405|接口/i.test(text)) {
    push("去文本 API 设置", handlers.openSettings);
  }
  if (/审稿|待修改|刷新计划|review/i.test(text) || kind.includes("审稿")) {
    push("打开审稿反馈", handlers.openReview);
    push("去镜头表", handlers.openShot);
  }
  if (/时间线|素材|timeline/i.test(text) || kind.includes("时间线")) {
    push("打开时间线", handlers.openTimeline);
    push("打开生成队列", handlers.openQueue);
  }
  if (/导出|render|ffmpeg|失败导出|可导出/i.test(text) || kind.includes("导出")) {
    push("打开成片导出", handlers.openExport);
    push("打开时间线", handlers.openTimeline);
  }
  if (/资源|资产|锁定|reference/i.test(text)) {
    push("打开资源中心", handlers.openResources);
  }
  push("项目体检", handlers.openHealth);

  return actions.slice(0, 4);
}

function buildEpisodeStageBoard(active) {
  const shotBoard = active?.shotStageBoard || {};
  const timelineBoard = active?.timelineStageBoard || {};
  return {
    shotBuckets: [
      { key: "draft", label: "待写", count: shotBoard.draft || 0, tone: (shotBoard.draft || 0) ? "warn" : "ok", action: "shot" },
      { key: "pendingImage", label: "待生图", count: shotBoard.pendingImage || 0, tone: (shotBoard.pendingImage || 0) ? "warn" : "ok", action: "shot" },
      { key: "pendingVideo", label: "待生视频", count: shotBoard.pendingVideo || 0, tone: (shotBoard.pendingVideo || 0) ? "warn" : "ok", action: "shot" },
      { key: "pendingFix", label: "待修改", count: shotBoard.pendingFix || 0, tone: (shotBoard.pendingFix || 0) ? "danger" : "ok", action: "review" },
      { key: "generated", label: "已生成", count: shotBoard.generated || 0, tone: "ok", action: "timeline" },
      { key: "confirmed", label: "已确认", count: shotBoard.confirmed || 0, tone: "ok", action: "timeline" },
      { key: "completed", label: "已完成", count: shotBoard.completed || 0, tone: "ok", action: "export" },
    ],
    timelineBuckets: [
      { key: "missingMedia", label: "缺素材", count: timelineBoard.missingMedia || 0, tone: (timelineBoard.missingMedia || 0) ? "danger" : "ok", action: "timeline" },
      { key: "backfillPending", label: "待回写", count: active?.timelineBackfillPending || 0, tone: (active?.timelineBackfillPending || 0) ? "warn" : "ok", action: "timeline" },
      { key: "pendingApproval", label: "待验收", count: timelineBoard.pendingApproval || 0, tone: (timelineBoard.pendingApproval || 0) ? "warn" : "ok", action: "timeline" },
      { key: "rejected", label: "退回修改", count: timelineBoard.rejected || 0, tone: (timelineBoard.rejected || 0) ? "danger" : "ok", action: "timeline" },
      { key: "approved", label: "已通过", count: timelineBoard.approved || 0, tone: "ok", action: "export" },
    ],
  };
}

function buildContinuePreview(active, nextWorkflow) {
  if (!active || !nextWorkflow) return null;
  const shotBoard = active.shotStageBoard || {};
  const timelineBoard = active.timelineStageBoard || {};
  if (nextWorkflow.key === "novel") {
    return { label: "准备动作", detail: active.scripts ? "先回到小说工厂继续补完整剧本。" : "先搭起小说工厂并进入剧本生成。" };
  }
  if (nextWorkflow.key === "asset") {
    if ((active.characters || 0) === 0) return { label: "准备动作", detail: "先补角色资产，避免后面镜头持续漂脸。" };
    if ((active.scenes || 0) === 0) return { label: "准备动作", detail: "先补场景资产，把空间连续性锁住。" };
    return { label: "准备动作", detail: "先回到资产工位，把当前集资产补齐到可生产状态。" };
  }
  if (nextWorkflow.key === "shot") {
    return { label: "准备动作", detail: `先补镜头表缺口，当前还差 ${Math.max(0, (active.shots || 0) - (active.promptReady || 0))} 条镜头提示词。` };
  }
  if ((active.failedExports || 0) > 0 && nextWorkflow.key === "export") {
    return { label: "准备动作", detail: `先恢复 ${active.failedExports || 0} 条失败导出，再继续推进最终交付。` };
  }
  if ((shotBoard.pendingFix || 0) > 0) {
    return { label: "准备动作", detail: `先处理 ${shotBoard.pendingFix || 0} 个待修改镜头，把明显阻塞清掉。` };
  }
  if ((active.pendingReview || 0) > 0) {
    return { label: "准备动作", detail: `先清 ${active.pendingReview || 0} 个未审镜头，让系统知道后面该修哪里。` };
  }
  if ((active.refreshPlanPending || 0) > 0) {
    return { label: "准备动作", detail: `先执行 ${active.refreshPlanPending || 0} 个刷新计划，把资产、提示词和时间线回刷完整。` };
  }
  if ((active.timelineBackfillPending || 0) > 0) {
    return { label: "准备动作", detail: `先把 ${active.timelineBackfillPending || 0} 条时间线结果回写到镜头表，保证验收和素材状态一致。` };
  }
  if ((timelineBoard.pendingApproval || 0) > 0) {
    return { label: "准备动作", detail: `先验收 ${timelineBoard.pendingApproval || 0} 条时间线片段，让系统判断哪些可直接导出、哪些该退回修改。` };
  }
  if ((timelineBoard.rejected || 0) > 0) {
    return { label: "准备动作", detail: `先修复 ${timelineBoard.rejected || 0} 条退回片段，把该重生的素材补上，再回到待验收。` };
  }
  if ((timelineBoard.missingMedia || 0) > 0) {
    return { label: "准备动作", detail: `先补 ${timelineBoard.missingMedia || 0} 条时间线缺素材片段。` };
  }
  return { label: "准备动作", detail: "当前没有明显局部阻塞，会直接把流程顺推到下一交付阶段。" };
}
export function ProjectDashboardPanel({ summary, workflowFocus, activeEpisodeId, textApiReady, imageApiReady, onSelectEpisode, onUpdateEpisode, onCreateEpisode, onDuplicateEpisode, onBootstrapNovelFlow, onBootstrapShotFlow, onGuideWorkflowStep, onContinueWorkflow, onRunAutopilot, onLocate, onOpenSettings, onOpenQueue, onOpenResources, onOpenTimeline, onOpenHealth, onOpenCollaboration, onOpenArchive, onOpenExport, onOpenPromptFactory, onOpenReviewCenter, onRunReviewClosure, onRunTimelineClosure, onRunExportClosure, onRunPendingReviewBatch, onRunPendingRefreshBatch, onRunPendingTimelineApprovalBatch, onRunRejectedTimelineRepairBatch, onRunTimelineBackfillBatch, onRunMissingMediaBatch, onRunFailedExportBatch, onClose }) {
  const active = summary.episodes.find((episode) => episode.id === activeEpisodeId) || summary.episodes[0];
  const [reviewClosureRunning, setReviewClosureRunning] = useState(false);
  const [reviewClosureMessage, setReviewClosureMessage] = useState("");
  const [timelineClosureRunning, setTimelineClosureRunning] = useState(false);
  const [exportClosureRunning, setExportClosureRunning] = useState(false);
  const [continueRunning, setContinueRunning] = useState(false);
  const [autopilotRunning, setAutopilotRunning] = useState(false);
  const [batchRunning, setBatchRunning] = useState("");
  const [runHints, setRunHints] = useState([]);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [actionLog, setActionLog] = useState([]);
  const [retryCard, setRetryCard] = useState(null);
  const runGuide = (stepKey, fallback) => () => (onGuideWorkflowStep ? onGuideWorkflowStep(stepKey) : fallback?.());
  const formatReceipt = (title, summaryText, metrics = [], details = []) => ({
    title,
    summary: summaryText,
    metrics: metrics.filter((item) => item && (item.value !== undefined && item.value !== null && item.value !== "")),
    details: details.filter(Boolean).slice(0, 6),
    at: new Date().toLocaleTimeString(),
  });
  const pushActionLog = (entry) => {
    setActionLog((current) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        at: new Date().toLocaleTimeString(),
        ...entry,
      },
      ...current,
    ].slice(0, 8));
  };
  const setReceiptWithLog = (receipt, logEntry = null) => {
    setLastReceipt(receipt);
    if (logEntry) pushActionLog(logEntry);
  };
  const handleBootstrapNovel = () => {
    const result = onBootstrapNovelFlow?.();
    if (result) {
      const receipt = formatReceipt("起步流程已搭好", `已补齐 ${result.created || 0} 个起步节点。`, [
        { label: "新增节点", value: result.created || 0 },
        { label: "剧本节点", value: result.novelNodeId ? "已就位" : "未创建" },
        { label: "资产节点", value: result.assetNodeId ? "已就位" : "未创建" },
        { label: "镜头节点", value: result.shotNodeId ? "已就位" : "未创建" },
      ]);
      setReceiptWithLog(receipt, {
        kind: "success",
        title: "起步流程已搭好",
        summary: receipt.summary,
      });
    }
    return result;
  };
  const handleBootstrapShot = () => {
    const result = onBootstrapShotFlow?.();
    if (result) {
      const receipt = formatReceipt("镜头生产节点已补齐", `已补齐 ${result.created || 0} 个节点，镜头生产线可以继续。`, [
        { label: "新增节点", value: result.created || 0 },
        { label: "资产节点", value: result.assetNodeId ? "已就位" : "未创建" },
        { label: "镜头节点", value: result.shotNodeId ? "已就位" : "未创建" },
      ]);
      setReceiptWithLog(receipt, {
        kind: "success",
        title: "镜头生产节点已补齐",
        summary: receipt.summary,
      });
    }
    return result;
  };
  const strictStatus = useMemo(() => {
    const shots = active?.shots || 0;
    const timelineClips = active?.timelineClips || 0;
    const promptCoverage = shots ? ((active?.promptReady || 0) / shots) : 0;
    const timelineMediaCoverage = timelineClips ? ((active?.timelineReady || 0) / timelineClips) : 0;
    return {
      novelReady: (active?.scripts || 0) > 0,
      assetReady: (active?.characters || 0) > 0 && (active?.scenes || 0) > 0,
      shotReady: shots > 0 && promptCoverage === 1,
      reviewReady: shots > 0 && (active?.pendingReview || 0) === 0 && (active?.autoFixPending || 0) === 0 && (active?.refreshPlanPending || 0) === 0,
      timelineReady: shots > 0 && timelineClips >= shots && timelineMediaCoverage === 1 && (active?.timelineBackfillPending || 0) === 0,
      exportReady: Boolean(active?.exportReady) && (active?.failedExports || 0) === 0,
      promptCoverage,
      timelineMediaCoverage,
    };
  }, [active]);
  const workflowSteps = active ? [
    {
      key: "novel",
      title: "1. 小说转剧本",
      description: active.scripts ? "当前集已经建立小说工厂节点，先确认剧本与改编方向。" : "先建立小说工厂节点，把原小说转成剧本和规划。",
      done: strictStatus.novelReady,
      completionRule: strictStatus.novelReady ? "已拿到当前集剧本节点。" : "至少要有 1 个小说转剧本节点并产出当前集剧本。",
      actionLabel: active.novelNodeId ? "定位剧本节点" : "打开项目体检",
      action: runGuide("novel", () => active.novelNodeId ? onLocate(active.novelNodeId) : onOpenHealth?.()),
    },
    {
      key: "asset",
      title: "2. 提取角色/场景/道具资产",
      description: active.characters || active.scenes || active.props ? `当前已有 ${active.characters || 0} 个人物、${active.scenes || 0} 个场景、${active.props || 0} 个道具。` : "把剧本里的核心角色、场景、道具抽成稳定资产。",
      done: strictStatus.assetReady,
      completionRule: strictStatus.assetReady ? "人物和场景资产都已就位。" : "至少要有人物资产和场景资产，道具可按剧情继续补。",
      actionLabel: active.assetNodeId ? "定位资产节点" : "打开资源中心",
      action: runGuide("asset", () => active.assetNodeId ? onLocate(active.assetNodeId) : onOpenResources?.()),
    },
    {
      key: "shot",
      title: "3. 生成镜头表与提示词",
      description: active.shots ? `当前有 ${active.shots} 个镜头，提示词完成 ${active.promptReady || 0}/${active.shots}。` : "生成镜头表，并把图片/视频提示词补齐。",
      done: strictStatus.shotReady,
      completionRule: active.shots ? `图片/视频提示词覆盖率 ${(strictStatus.promptCoverage * 100).toFixed(0)}%。` : "至少要有镜头表，并让全部镜头拿到图片/视频提示词。",
      actionLabel: "打开 Prompt 工厂",
      action: runGuide("shot", () => onOpenPromptFactory?.()),
    },
    {
      key: "review",
      title: "4. 审稿并修镜头",
      description: active.shots ? `当前待审 ${active.pendingReview || 0} 个镜头，待自动修改 ${active.autoFixPending || 0} 个，待刷新计划 ${active.refreshPlanPending || 0} 个。` : "镜头生成后，先过审稿，把弱镜头、自动修改和刷新计划这条线清掉。",
      done: strictStatus.reviewReady,
      completionRule: strictStatus.reviewReady ? "待审、待自动修改、待刷新计划都已清空。" : "这一环必须同时清空待审、待自动修改、待刷新计划。",
      actionLabel: "打开审稿反馈",
      action: runGuide("review", () => onOpenReviewCenter?.()),
    },
    {
      key: "timeline",
      title: "5. 排时间线并补素材",
      description: active.timelineClips ? `当前时间线 ${active.timelineClips} 条，素材已挂 ${active.timelineReady || 0}/${active.timelineClips}，待回写 ${active.timelineBackfillPending || 0} 条。` : "把镜头导入时间线，并把素材挂齐。",
      done: strictStatus.timelineReady,
      completionRule: active.timelineClips ? `时间线素材覆盖率 ${(strictStatus.timelineMediaCoverage * 100).toFixed(0)}%，待回写 ${active.timelineBackfillPending || 0} 条。` : "要把镜头带进时间线、让素材挂齐，并把时间线结果回写到镜头表。",
      actionLabel: "打开时间线",
      action: runGuide("timeline", () => onOpenTimeline?.()),
    },
    {
      key: "export",
      title: "6. 导出视频",
      description: active.exportReady ? "当前集已经达到导出门槛，可以直接输出视频。" : "最后在成片导出里打包横版或竖版视频。",
      done: strictStatus.exportReady,
      completionRule: strictStatus.exportReady ? "已达到导出门槛，且当前没有失败导出阻塞。" : "不仅要达到导出门槛，还要把失败导出清掉，才算真正完成。",
      actionLabel: "打开成片导出",
      action: runGuide("export", () => onOpenExport?.()),
    },
  ] : [];
  const nextWorkflow = workflowSteps.find((step) => !step.done) || workflowSteps[workflowSteps.length - 1] || null;
  const workflowDoneCount = workflowSteps.filter((step) => step.done).length;
  const workflowProgress = workflowSteps.length ? Math.round((workflowDoneCount / workflowSteps.length) * 100) : 0;
  const workflowBlockers = useMemo(() => buildWorkflowBlockers(active, nextWorkflow, strictStatus), [active, nextWorkflow, strictStatus]);
  const stageBoard = useMemo(() => buildEpisodeStageBoard(active), [active]);
  const continuePreview = useMemo(() => buildContinuePreview(active, nextWorkflow), [active, nextWorkflow]);
  const launchpadLead = !active?.nodes
    ? "现在还是空白画布，先一键搭起小说工厂、资产库和镜头表，后面所有总控动作才有落点。"
    : !active?.scripts
      ? "画布已经有节点了，下一步优先把小说转剧本跑起来，先拿到可生产的剧本。"
      : !active?.shots
        ? "剧本已经有了，继续把资产和镜头表补齐，后面审稿、时间线、导出才会顺。"
        : "当前集已经有生产骨架了，直接按下面的执行顺序总流程推进就行。";
  const currentStepActions = useMemo(() => {
    if (!active || !nextWorkflow) return [];
    if (nextWorkflow.key === "novel") {
      return [
        { label: "一键后台自动生产", tone: "primary", action: handleRunAutopilot },
        { label: "智能继续当前流程", action: handleContinueWorkflow },
        { label: "一键搭起步流程", action: handleBootstrapNovel },
        { label: "先配文本 API", action: onOpenSettings },
      ];
    }
    if (nextWorkflow.key === "asset") {
      return [
        { label: "一键后台自动生产", tone: "primary", action: handleRunAutopilot },
        { label: "智能继续当前流程", action: handleContinueWorkflow },
        { label: "去资产节点", action: nextWorkflow.action },
        { label: "打开资源中心", action: onOpenResources },
        { label: "补齐镜头生产节点", action: handleBootstrapShot },
      ];
    }
    if (nextWorkflow.key === "shot") {
      return [
        { label: "一键后台自动生产", tone: "primary", action: handleRunAutopilot },
        { label: "智能继续当前流程", action: handleContinueWorkflow },
        { label: "去镜头表与 Prompt", action: nextWorkflow.action },
        { label: "补齐镜头生产节点", action: handleBootstrapShot },
        { label: "打开资源中心", action: onOpenResources },
      ];
    }
    if (nextWorkflow.key === "review") {
      return [
        { label: "一键后台自动生产", tone: "primary", action: handleRunAutopilot },
        { label: "智能继续当前流程", action: handleContinueWorkflow },
        { label: "一键审稿闭环当前集", action: handleReviewClosure },
        { label: "打开审稿反馈", action: nextWorkflow.action },
        { label: "去镜头表", action: runGuide("shot", () => onOpenPromptFactory?.()) },
      ];
    }
    if (nextWorkflow.key === "timeline") {
      return [
        { label: "一键后台自动生产", tone: "primary", action: handleRunAutopilot },
        { label: "智能继续当前流程", action: handleContinueWorkflow },
        { label: "一键推进到时间线可交付", action: handleTimelineClosure },
        { label: "打开时间线", action: nextWorkflow.action },
        { label: "打开生成队列", action: onOpenQueue },
      ];
    }
    if (nextWorkflow.key === "export") {
      return [
        { label: "一键后台自动生产", tone: "primary", action: handleRunAutopilot },
        { label: "智能继续当前流程", action: handleContinueWorkflow },
        { label: "一键推进当前集到可导出", action: handleExportClosure },
        { label: "打开成片导出", action: nextWorkflow.action },
        { label: "打开时间线", action: runGuide("timeline", () => onOpenTimeline?.()) },
      ];
    }
    return [{ label: "一键后台自动生产", tone: "primary", action: handleRunAutopilot }, { label: "智能继续当前流程", action: handleContinueWorkflow }];
  }, [active, nextWorkflow, onOpenPromptFactory, onOpenQueue, onOpenResources, onOpenSettings, onOpenTimeline, continueRunning, autopilotRunning]);
  const currentStepHint = useMemo(() => {
    if (!active || !nextWorkflow) return "";
    if (nextWorkflow.key === "novel") return textApiReady ? "先把小说转成可生产剧本，再继续往资产和镜头表走。" : "这一环最容易卡在文本 API，先把文本接口配好会顺很多。";
    if (nextWorkflow.key === "asset") return "先把角色、场景、道具锁稳，后面镜头和生图才不容易漂。";
    if (nextWorkflow.key === "shot") return workflowFocus?.shotLabel ? `现在最关键的是补齐镜头 ${workflowFocus.shotLabel} 的提示词和生产骨架，后面的审稿与时间线都依赖它。` : "现在最关键的是把镜头表和图像/视频提示词补齐，后面的审稿与时间线都依赖它。";
    if (nextWorkflow.key === "review") return workflowFocus?.reviewLabel ? `先把 ${workflowFocus.reviewLabel} 这条审稿问题清掉，再继续批量往下推。` : "先把待审、待自动修改、待刷新计划清掉，这一步清完后面会明显顺。";
    if (nextWorkflow.key === "timeline") return (active?.timelineBackfillPending || 0) > 0
      ? `当前重点是先回写 ${active?.timelineBackfillPending || 0} 条时间线结果，让镜头表和时间线重新对齐。`
      : workflowFocus?.timelineLabel
        ? `当前重点是先处理时间线片段 ${workflowFocus.timelineLabel}，把它推到可交付状态。`
        : "当前重点是把镜头导入时间线并把素材挂齐，缺素材的片段可以直接继续入队。";
    if (nextWorkflow.key === "export") return workflowFocus?.exportLabel ? `现在就差最后的导出门槛，优先清掉 ${workflowFocus.exportLabel} 相关缺口就能更快进入成片导出。` : "现在就差最后的导出门槛，清完剩余素材就能入成片导出。";
    return "";
  }, [active, nextWorkflow, textApiReady, workflowFocus]);
  const directActionButtons = useMemo(() => buildWorkflowDirectActions(nextWorkflow, {
    onReviewClosure: handleReviewClosure,
    onTimelineClosure: handleTimelineClosure,
    onExportClosure: handleExportClosure,
    onOpenReview: () => onOpenReviewCenter?.(),
    onOpenShot: () => onOpenPromptFactory?.(),
    onOpenTimeline: () => onOpenTimeline?.(),
    onOpenQueue: () => onOpenQueue?.(),
    onOpenExport: () => onOpenExport?.(),
    onContinue: handleContinueWorkflow,
    onLocateStep: nextWorkflow?.action,
  }), [nextWorkflow, onOpenReviewCenter, onOpenPromptFactory, onOpenTimeline, onOpenQueue, onOpenExport]);
  const directActionButtonsWithFocus = useMemo(() => directActionButtons.map((item) => {
    if (nextWorkflow?.key === "review" && item.label === "打开审稿反馈" && workflowFocus?.reviewLabel) {
      return { ...item, label: `打开审稿反馈 · ${workflowFocus.reviewLabel}` };
    }
    if (nextWorkflow?.key === "review" && item.label === "去镜头表" && workflowFocus?.shotLabel) {
      return { ...item, label: `去镜头表 · ${workflowFocus.shotLabel}` };
    }
    if (nextWorkflow?.key === "timeline" && item.label === "打开时间线" && workflowFocus?.timelineLabel) {
      return { ...item, label: `打开时间线 · ${workflowFocus.timelineLabel}` };
    }
    if (nextWorkflow?.key === "export" && item.label === "打开时间线" && workflowFocus?.exportLabel) {
      return { ...item, label: `打开时间线 · ${workflowFocus.exportLabel}` };
    }
    return item;
  }), [directActionButtons, nextWorkflow, workflowFocus]);

  async function handleContinueWorkflow() {
    if (!onContinueWorkflow) {
      nextWorkflow?.action?.();
      return;
    }
    setContinueRunning(true);
    setRunHints([]);
    setRetryCard(null);
    setReviewClosureMessage(`正在继续 ${nextWorkflow?.title || "当前流程"}...`);
    try {
      const result = await onContinueWorkflow();
      if (result) {
        setReviewClosureMessage(result.summary || "已继续推进当前流程。");
        const receipt = formatReceipt(
          result.title || "已继续当前流程",
          result.summary || "当前流程已往下一步推进。",
          result.metrics || [],
          result.details || [],
        );
        setReceiptWithLog(receipt, {
          kind: "success",
          title: result.title || "已继续当前流程",
          summary: result.summary || "当前流程已往下一步推进。",
        });
      } else {
        setReviewClosureMessage("已继续推进当前流程。");
      }
    } catch (error) {
      const detail = error.message || String(error);
      setReviewClosureMessage(`继续当前流程失败：${detail}`);
      setRetryCard({
        title: "智能继续当前流程失败",
        summary: detail,
        actionLabel: "重试智能继续",
        action: handleContinueWorkflow,
        recoveryActions: buildFailureRecoveryActions("智能继续当前流程失败", detail, {
          retry: handleContinueWorkflow,
          openSettings: onOpenSettings,
          openReview: onOpenReviewCenter,
          openShot: onOpenPromptFactory,
          openTimeline: onOpenTimeline,
          openQueue: onOpenQueue,
          openExport: onOpenExport,
          openResources: onOpenResources,
          openHealth: onOpenHealth,
        }),
      });
      pushActionLog({
        kind: "failed",
        title: "智能继续当前流程失败",
        summary: detail,
      });
    } finally {
      setContinueRunning(false);
    }
  }

  async function handleRunAutopilot() {
    if (!onRunAutopilot) return handleContinueWorkflow();
    setAutopilotRunning(true);
    setContinueRunning(true);
    setRunHints([]);
    setRetryCard(null);
    setReviewClosureMessage("后台自动生产已启动，正在连续推进流程...");
    try {
      const result = await onRunAutopilot();
      if (result) {
        setReviewClosureMessage(result.summary || "后台自动生产已完成一轮。");
        const receipt = formatReceipt(
          result.title || "后台自动生产完成",
          result.summary || "后台已自动推进当前流程。",
          result.metrics || [],
          result.details || [],
        );
        setReceiptWithLog(receipt, {
          kind: "success",
          title: receipt.title,
          summary: receipt.summary,
        });
      }
    } catch (error) {
      const detail = error.message || String(error);
      setReviewClosureMessage(`后台自动生产失败：${detail}`);
      setRetryCard({
        title: "后台自动生产失败",
        summary: detail,
        actionLabel: "重试后台自动生产",
        action: handleRunAutopilot,
        recoveryActions: buildFailureRecoveryActions("后台自动生产失败", detail, {
          retry: handleRunAutopilot,
          openSettings: onOpenSettings,
          openReview: onOpenReviewCenter,
          openShot: onOpenPromptFactory,
          openTimeline: onOpenTimeline,
          openQueue: onOpenQueue,
          openExport: onOpenExport,
          openResources: onOpenResources,
          openHealth: onOpenHealth,
        }),
      });
      pushActionLog({
        kind: "failed",
        title: "后台自动生产失败",
        summary: detail,
      });
    } finally {
      setAutopilotRunning(false);
      setContinueRunning(false);
    }
  }

  async function handleReviewClosure() {
    if (!onRunReviewClosure) return;
    setReviewClosureRunning(true);
    setRunHints([]);
    setRetryCard(null);
    setReviewClosureMessage("正在执行当前集审稿闭环...");
    try {
      const result = await onRunReviewClosure();
      setReviewClosureMessage(`审稿闭环完成：已审 ${result.reviewed || 0} 个，已改 ${result.revised || 0} 个，已刷 ${result.refreshHandled || 0} 个，剩余待修改 ${result.pendingFix || 0} 个。`);
      const receipt = formatReceipt("审稿闭环完成", "这一轮审稿、自动修改和刷新计划已经跑完。", [
        { label: "已审", value: result.reviewed || 0 },
        { label: "已改", value: result.revised || 0 },
        { label: "已刷新", value: result.refreshHandled || 0 },
        { label: "待修改", value: result.pendingFix || 0 },
      ], [
        result.reviewedShots?.length ? `本轮审稿：${result.reviewedShots.join("、")}` : "",
        result.refreshedShots?.length ? `本轮刷新：${result.refreshedShots.join("、")}` : "",
      ]);
      setReceiptWithLog(receipt, {
        kind: "success",
        title: "审稿闭环完成",
        summary: receipt.summary,
      });
      setRunHints(buildDashboardRunHints(active, "review"));
    } catch (error) {
      const detail = error.message || String(error);
      setReviewClosureMessage(`审稿闭环失败：${detail}`);
      setRunHints(buildDashboardRunHints(active, "review"));
      setRetryCard({
        title: "审稿闭环失败",
        summary: detail,
        actionLabel: "重试审稿闭环",
        action: handleReviewClosure,
        recoveryActions: buildFailureRecoveryActions("审稿闭环失败", detail, {
          retry: handleReviewClosure,
          openSettings: onOpenSettings,
          openReview: onOpenReviewCenter,
          openShot: onOpenPromptFactory,
          openTimeline: onOpenTimeline,
          openQueue: onOpenQueue,
          openExport: onOpenExport,
          openResources: onOpenResources,
          openHealth: onOpenHealth,
        }),
      });
      pushActionLog({
        kind: "failed",
        title: "审稿闭环失败",
        summary: detail,
      });
    } finally {
      setReviewClosureRunning(false);
    }
  }

  async function handleTimelineClosure() {
    if (!onRunTimelineClosure) return;
    setTimelineClosureRunning(true);
    setRunHints([]);
    setRetryCard(null);
    setReviewClosureMessage("正在顺推当前集到时间线可交付...");
    try {
      const result = await onRunTimelineClosure();
      setReviewClosureMessage(`顺推完成：导入 ${result.imported || 0} 条，同步 ${result.synced || 0} 条，回写 ${result.backfilled || 0} 条，入队 ${result.queued || 0} 条，剩余待素材 ${result.remaining?.media || 0}。`);
      const receipt = formatReceipt("时间线顺推完成", "镜头已继续往时间线交付方向推进。", [
        { label: "导入", value: result.imported || 0 },
        { label: "同步", value: result.synced || 0 },
        { label: "回写镜头", value: result.backfilled || 0 },
        { label: "入队", value: result.queued || 0 },
        { label: "待素材", value: result.remaining?.media || 0 },
      ], [
        result.importedShots?.length ? `新导入镜头：${result.importedShots.join("、")}` : "",
        result.processedClips?.length ? `处理片段：${result.processedClips.join("、")}` : "",
      ]);
      setReceiptWithLog(receipt, {
        kind: "success",
        title: "时间线顺推完成",
        summary: receipt.summary,
      });
      setRunHints(buildDashboardRunHints(active, "timeline"));
    } catch (error) {
      const detail = error.message || String(error);
      setReviewClosureMessage(`顺推失败：${detail}`);
      setRunHints(buildDashboardRunHints(active, "timeline"));
      setRetryCard({
        title: "时间线顺推失败",
        summary: detail,
        actionLabel: "重试时间线顺推",
        action: handleTimelineClosure,
        recoveryActions: buildFailureRecoveryActions("时间线顺推失败", detail, {
          retry: handleTimelineClosure,
          openSettings: onOpenSettings,
          openReview: onOpenReviewCenter,
          openShot: onOpenPromptFactory,
          openTimeline: onOpenTimeline,
          openQueue: onOpenQueue,
          openExport: onOpenExport,
          openResources: onOpenResources,
          openHealth: onOpenHealth,
        }),
      });
      pushActionLog({
        kind: "failed",
        title: "时间线顺推失败",
        summary: detail,
      });
    } finally {
      setTimelineClosureRunning(false);
    }
  }

  async function handleExportClosure() {
    if (!onRunExportClosure) return;
    setExportClosureRunning(true);
    setRunHints([]);
    setRetryCard(null);
    setReviewClosureMessage("正在推进当前集到可导出...");
    try {
      const result = await onRunExportClosure();
      setReviewClosureMessage(
        result.exportReady
          ? `已推进到可导出：验收 ${result.reviewedApprovals || 0} 条，入队 ${result.queuedRenders || 0} 个成片版本。`
          : `推进已完成，但当前还没过导出门槛：待素材 ${result.remaining?.media || 0}。`,
      );
      const receipt = formatReceipt(
        result.exportReady ? "当前集已推进到可导出" : "导出推进已完成",
        result.exportReady ? "成片版本已经入导出队列。" : "已经顺推到导出前的最后缺口。",
        [
          { label: "验收片段", value: result.reviewedApprovals || 0 },
          { label: "通过验收", value: result.passedApprovals || 0 },
          { label: "退回修改", value: result.rejectedApprovals || 0 },
          { label: "入队版本", value: result.queuedRenders || 0 },
          { label: "待素材", value: result.remaining?.media || 0 },
        ],
        [
          result.processedClips?.length ? `本轮推进片段：${result.processedClips.join("、")}` : "",
          result.queuedRenderLabels?.length ? `已入队版本：${result.queuedRenderLabels.join("、")}` : "",
        ],
      );
      setReceiptWithLog(receipt, {
        kind: "success",
        title: receipt.title,
        summary: receipt.summary,
      });
      setRunHints(buildDashboardRunHints(active, "export"));
    } catch (error) {
      const detail = error.message || String(error);
      setReviewClosureMessage(`推进到可导出失败：${detail}`);
      setRunHints(buildDashboardRunHints(active, "export"));
      setRetryCard({
        title: "导出推进失败",
        summary: detail,
        actionLabel: "重试导出推进",
        action: handleExportClosure,
        recoveryActions: buildFailureRecoveryActions("导出推进失败", detail, {
          retry: handleExportClosure,
          openSettings: onOpenSettings,
          openReview: onOpenReviewCenter,
          openShot: onOpenPromptFactory,
          openTimeline: onOpenTimeline,
          openQueue: onOpenQueue,
          openExport: onOpenExport,
          openResources: onOpenResources,
          openHealth: onOpenHealth,
        }),
      });
      pushActionLog({
        kind: "failed",
        title: "导出推进失败",
        summary: detail,
      });
    } finally {
      setExportClosureRunning(false);
    }
  }

  async function handleScopedBatch(kind) {
    const actionMap = {
      pendingReview: {
        runner: onRunPendingReviewBatch,
        start: "正在处理当前集未审镜头...",
        success: (result) => ({
          message: `未审镜头处理完成：已审 ${result.reviewed || 0} 个，待修改 ${result.pendingFix || 0} 个，已通过 ${result.passed || 0} 个。`,
          receipt: formatReceipt("未审镜头批处理完成", "当前集待审镜头已经集中处理完一轮。", [
            { label: "已审", value: result.reviewed || 0 },
            { label: "待修改", value: result.pendingFix || 0 },
            { label: "已通过", value: result.passed || 0 },
          ], [
            result.reviewedShots?.length ? `本轮镜头：${result.reviewedShots.join("、")}` : "",
          ]),
          log: {
            kind: "success",
            title: "未审镜头批处理完成",
            summary: `已审 ${result.reviewed || 0} 个镜头`,
          },
          hints: buildDashboardRunHints(active, "review"),
        }),
        failureTitle: "未审镜头批处理失败",
      },
      pendingRefresh: {
        runner: onRunPendingRefreshBatch,
        start: "正在执行当前集待刷新镜头...",
        success: (result) => ({
          message: `待刷新镜头处理完成：已处理 ${result.handled || 0} 个镜头，更新资产 ${result.assetCount || 0} 项，提示词 ${result.promptUpdated || 0} 条，时间线 ${result.timelineUpdated || 0} 条。`,
          receipt: formatReceipt("刷新计划批处理完成", "当前集待刷新镜头已经按计划同步更新。", [
            { label: "处理镜头", value: result.handled || 0 },
            { label: "资产更新", value: result.assetCount || 0 },
            { label: "提示词", value: result.promptUpdated || 0 },
            { label: "时间线", value: result.timelineUpdated || 0 },
          ], [
            result.handledShots?.length ? `本轮刷新：${result.handledShots.join("、")}` : "",
          ]),
          log: {
            kind: "success",
            title: "刷新计划批处理完成",
            summary: `已处理 ${result.handled || 0} 个待刷新镜头`,
          },
          hints: buildDashboardRunHints(active, "review"),
        }),
        failureTitle: "刷新计划批处理失败",
      },
      pendingTimelineApproval: {
        runner: onRunPendingTimelineApprovalBatch,
        start: "正在执行当前集时间线待验收片段...",
        success: (result) => ({
          message: `时间线验收完成：已审 ${result.reviewed || 0} 条，已通过 ${result.passed || 0} 条，退回 ${result.rejected || 0} 条。`,
          receipt: formatReceipt("时间线待验收批处理完成", "当前集待验收时间线片段已经按统一标准完成一轮 API 验收。", [
            { label: "已验收", value: result.reviewed || 0 },
            { label: "已通过", value: result.passed || 0 },
            { label: "退回修改", value: result.rejected || 0 },
            { label: "回写镜头", value: result.backfilled || 0 },
          ], [
            result.clips?.length ? `片段：${result.clips.join("、")}` : "",
          ]),
          log: {
            kind: "success",
            title: "时间线待验收批处理完成",
            summary: `已验收 ${result.reviewed || 0} 条时间线片段`,
          },
          hints: buildDashboardRunHints(active, "timeline"),
        }),
        failureTitle: "时间线待验收批处理失败",
      },
      rejectedTimelineRepair: {
        runner: onRunRejectedTimelineRepairBatch,
        start: "正在自动修复当前集退回修改片段...",
        success: (result) => ({
          message: `退回片段修复完成：已处理 ${result.repaired || 0} 条，重入队 ${result.queued || 0}。`,
          receipt: formatReceipt("退回片段自动修复完成", "当前集被退回的时间线片段已经按备注完成一轮自动修复。", [
            { label: "已修复", value: result.repaired || 0 },
            { label: "重入队", value: result.queued || 0 },
            { label: "回送镜头", value: result.shot || 0 },
          ], [
            result.clips?.length ? `片段：${result.clips.join("、")}` : "",
          ]),
          log: {
            kind: "success",
            title: "退回片段自动修复完成",
            summary: `已修复 ${result.repaired || 0} 条退回片段`,
          },
          hints: buildDashboardRunHints(active, "timeline"),
        }),
        failureTitle: "退回片段自动修复失败",
      },
      timelineBackfill: {
        runner: onRunTimelineBackfillBatch,
        start: "正在把当前集时间线结果回写到镜头表...",
        success: (result) => ({
          message: `时间线回写完成：已回写 ${result.synced || 0} 条，跳过 ${result.skipped || 0} 条无变化片段。`,
          receipt: formatReceipt("时间线结果回写完成", "当前集时间线里的验收、素材和表演线索已经同步回镜头表。", [
            { label: "已回写", value: result.synced || 0 },
            { label: "无变化", value: result.skipped || 0 },
            { label: "未关联", value: result.missingLink || 0 },
            { label: "新增记录", value: result.comments || 0 },
          ], [
            result.clips?.length ? `片段：${result.clips.join("、")}` : "",
          ]),
          log: {
            kind: "success",
            title: "时间线结果回写完成",
            summary: `已回写 ${result.synced || 0} 条时间线结果`,
          },
          hints: buildDashboardRunHints(active, "timeline"),
        }),
        failureTitle: "时间线结果回写失败",
      },
      missingMedia: {
        runner: onRunMissingMediaBatch,
        start: "正在补齐当前集缺素材片段...",
        success: (result) => ({
          message: `缺素材片段已加入队列：共 ${result.queued || 0} 条。`,
          receipt: formatReceipt("缺素材片段已入队", "当前集缺素材片段已经单独加入生成队列。", [
            { label: "入队片段", value: result.queued || 0 },
          ], [
            result.clips?.length ? `片段：${result.clips.join("、")}` : "",
          ]),
          log: {
            kind: "success",
            title: "缺素材片段已入队",
            summary: `已入队 ${result.queued || 0} 条片段`,
          },
          hints: buildDashboardRunHints(active, "timeline"),
        }),
        failureTitle: "缺素材片段入队失败",
      },
      failedExport: {
        runner: onRunFailedExportBatch,
        start: "正在重跑当前集失败导出...",
        success: (result) => ({
          message: `失败导出重跑完成：${result.target || "当前集"} 共重试 ${result.retried || 0} 条。`,
          receipt: formatReceipt("失败导出已重跑", "当前集失败导出已经重新送回队列。", [
            { label: "重试导出", value: result.retried || 0 },
            { label: "目标", value: result.target || "当前集" },
          ]),
          log: {
            kind: "success",
            title: "失败导出已重跑",
            summary: `${result.target || "当前集"} 重试 ${result.retried || 0} 条失败导出`,
          },
          hints: buildDashboardRunHints(active, "export"),
        }),
        failureTitle: "失败导出重跑失败",
      },
    };
    const config = actionMap[kind];
    if (!config?.runner) return;
    setBatchRunning(kind);
    setRunHints([]);
    setRetryCard(null);
    setReviewClosureMessage(config.start);
    try {
      const result = await config.runner();
      const outcome = config.success(result || {});
      setReviewClosureMessage(outcome.message);
      setReceiptWithLog(outcome.receipt, outcome.log);
      setRunHints(outcome.hints || []);
    } catch (error) {
      const detail = error.message || String(error);
      setReviewClosureMessage(`${config.failureTitle}：${detail}`);
      setRunHints([]);
      setRetryCard({
        title: config.failureTitle,
        summary: detail,
        actionLabel: "重试这一步",
        action: () => handleScopedBatch(kind),
        recoveryActions: buildFailureRecoveryActions(config.failureTitle, detail, {
          retry: () => handleScopedBatch(kind),
          openSettings: onOpenSettings,
          openReview: onOpenReviewCenter,
          openShot: onOpenPromptFactory,
          openTimeline: onOpenTimeline,
          openQueue: onOpenQueue,
          openExport: onOpenExport,
          openResources: onOpenResources,
          openHealth: onOpenHealth,
        }),
      });
      pushActionLog({
        kind: "failed",
        title: config.failureTitle,
        summary: detail,
      });
    } finally {
      setBatchRunning("");
    }
  }

  return createPortal((
    <aside className="dashboard-panel">
      <header>
        <div>
          <strong>项目总控台</strong>
          <span>{summary.episodes.length} 集 · {summary.totals.nodes} 节点 · {summary.totals.shots} 镜头 · 队列 {summary.queue.total}</span>
        </div>
        <button onClick={onClose}>关闭</button>
      </header>
      <div className="dashboard-stats">
        <section><b>{summary.totals.characters}</b><span>人物资产</span></section>
        <section><b>{summary.totals.scenes}</b><span>场景资产</span></section>
        <section><b>{summary.totals.props}</b><span>道具资产</span></section>
        <section><b>{summary.totals.resources}</b><span>项目资源</span></section>
        <section><b>{summary.totals.completedShots}/{summary.totals.shots}</b><span>镜头完成</span></section>
        <section><b>{summary.queue.pending}</b><span>待生成</span></section>
        <section><b>{summary.totals.autoFixPending || 0}</b><span>待自动修改</span></section>
        <section><b>{summary.totals.refreshPlanPending || 0}</b><span>待刷新计划</span></section>
        <section><b>{summary.totals.timelineBackfillPending || 0}</b><span>待回写镜头</span></section>
        <section><b>{summary.collaboration?.members || 0}</b><span>协作成员</span></section>
        <section><b>{summary.archive?.milestones || 0}</b><span>里程碑</span></section>
      </div>
      <section className="dashboard-launchpad">
        <div className="dashboard-launchpad-copy">
          <strong>启动台</strong>
          <p>{launchpadLead}</p>
          <div className="dashboard-launchpad-pills">
            <span className={`pill ${textApiReady ? "pill-ok" : "timeline-pill-danger"}`}>文本 API {textApiReady ? "已就绪" : "待配置"}</span>
            <span className={`pill ${imageApiReady ? "pill-ok" : "pill-warn"}`}>图片 API {imageApiReady ? "已就绪" : "可稍后配置"}</span>
            <span className={`pill ${nextWorkflow?.key === "novel" ? "pill-warn" : "pill-ok"}`}>当前阶段 {nextWorkflow?.title || "已可导出"}</span>
          </div>
        </div>
        <div className="dashboard-launchpad-actions">
          <button onClick={handleBootstrapNovel}>一键搭起步流程</button>
          <button onClick={handleBootstrapShot}>补齐镜头生产节点</button>
          <button onClick={onOpenSettings}>先配文本 API</button>
          <button className="primary" onClick={handleRunAutopilot} disabled={autopilotRunning || continueRunning}>{autopilotRunning ? "后台生产中..." : "一键后台自动生产"}</button>
          <button className="primary" onClick={handleContinueWorkflow} disabled={!nextWorkflow || continueRunning}>{continueRunning ? "智能推进中..." : (nextWorkflow ? "智能继续当前流程" : "查看最终导出")}</button>
        </div>
      </section>
      <div className="dashboard-actions">
        <button onClick={onCreateEpisode}>新建一集</button>
        <button disabled={!active?.nodes} onClick={onDuplicateEpisode}>复制当前集</button>
        <button onClick={handleReviewClosure} disabled={!active?.shots || reviewClosureRunning}>{reviewClosureRunning ? "审稿闭环中..." : "一键审稿闭环当前集"}</button>
        <button onClick={handleTimelineClosure} disabled={!active?.shots || timelineClosureRunning}>{timelineClosureRunning ? "顺推中..." : "一键推进到时间线可交付"}</button>
        <button onClick={handleExportClosure} disabled={!active?.shots || exportClosureRunning}>{exportClosureRunning ? "导出推进中..." : "一键推进当前集到可导出"}</button>
        <button onClick={onOpenHealth}>项目体检</button>
        <button onClick={onOpenResources}>资源中心</button>
        <button onClick={onOpenTimeline}>时间线</button>
        <button onClick={onOpenCollaboration}>协作中心</button>
        <button onClick={onOpenArchive}>归档中心</button>
        <button onClick={onOpenExport}>成片导出</button>
        <button onClick={onOpenQueue}>打开队列</button>
      </div>
      {reviewClosureMessage ? <div className="dashboard-run-message">{reviewClosureMessage}</div> : null}
      {runHints.length ? (
        <div className="dashboard-run-hints">
          {runHints.map((item, index) => (
            <section key={`${item.label}-${index}`}>
              <strong>{item.label}</strong>
              <p>{item.detail}</p>
              <button onClick={runGuide(item.action === "prompt" ? "shot" : item.action || "novel")}>
                {item.action === "review" ? "去审稿反馈" : item.action === "timeline" ? "去时间线" : item.action === "export" ? "去成片导出" : "去下一步"}
              </button>
            </section>
          ))}
        </div>
      ) : null}
      {retryCard ? (
        <section className="dashboard-retry-card">
          <div className="dashboard-retry-copy">
            <strong>{retryCard.title}</strong>
            <p>{retryCard.summary}</p>
            {retryCard.recoveryActions?.length ? (
              <div className="dashboard-retry-recovery">
                {retryCard.recoveryActions.map((item) => (
                  <button key={item.label} className={item.tone === "primary" ? "primary" : ""} onClick={item.action}>{item.label}</button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="dashboard-retry-actions">
            <button className="primary" onClick={retryCard.action}>{retryCard.actionLabel}</button>
            <button onClick={() => setRetryCard(null)}>暂时收起</button>
          </div>
        </section>
      ) : null}
      <div className="dashboard-version-strip">
        <section>
          <strong>协作状态</strong>
          <span>{summary.collaboration?.activities || 0} 条操作记录 · 最近处理人 {summary.collaboration?.latestActor || "-"}</span>
        </section>
        <section>
          <strong>版本状态</strong>
          <span>快照 {summary.archive?.snapshots || 0} · 里程碑 {summary.archive?.milestones || 0} · 交付备注 {summary.archive?.deliveryNote ? "已填写" : "未填写"}</span>
        </section>
      </div>
      {workflowSteps.length ? (
        <section className="dashboard-progress-band">
          <div className="dashboard-progress-copy">
            <strong>主流程进度</strong>
            <span>已完成 {workflowDoneCount}/{workflowSteps.length} 步 · 当前 {nextWorkflow?.title || "已完成全部流程"}</span>
          </div>
          <div className="dashboard-progress-meter" aria-label={`主流程完成 ${workflowProgress}%`}>
            <div className="dashboard-progress-track">
              <div className="dashboard-progress-fill" style={{ width: `${workflowProgress}%` }} />
            </div>
            <b>{workflowProgress}%</b>
          </div>
          <div className="dashboard-progress-steps">
            {workflowSteps.map((step) => {
              const state = step.done ? "done" : (nextWorkflow?.key === step.key ? "current" : "pending");
              return (
                <button key={`progress-${step.key}`} className={`dashboard-progress-chip state-${state}`} onClick={step.action}>
                  <span className="dot" />
                  <small>{step.title.replace(/^\d+\.\s*/, "")}</small>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
      {nextWorkflow ? (
        <section className="dashboard-control-strip">
          <div className="dashboard-control-main">
            <div className="dashboard-control-copy">
              <strong>当前总控指令</strong>
              <span>{nextWorkflow.title}</span>
              <p>{currentStepHint}</p>
              {continuePreview ? <small>{continuePreview.label}：{continuePreview.detail}</small> : null}
            </div>
            <div className="dashboard-control-actions">
              {directActionButtonsWithFocus.map((item) => (
                <button key={item.label} className={item.tone === "primary" ? "primary" : ""} onClick={item.action}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="dashboard-control-blockers">
            {workflowBlockers.length ? workflowBlockers.map((item) => (
              <section key={item.title} className={`dashboard-control-card tone-${item.tone || "warn"}`}>
                <div className="dashboard-control-card-meta">
                  <span>{item.tone === "danger" ? "阻塞" : item.tone === "warn" ? "提醒" : "就绪"}</span>
                  <small>{item.action === "review" ? "审稿" : item.action === "timeline" ? "时间线" : item.action === "export" ? "导出" : "当前阶段"}</small>
                </div>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
                <button onClick={runGuide(item.action === "prompt" ? "shot" : item.action || nextWorkflow.key, nextWorkflow.action)}>
                  {item.action === "review" ? "去处理审稿" : item.action === "timeline" ? "去时间线" : item.action === "export" ? "去导出中心" : "去当前步骤"}
                </button>
              </section>
            )) : (
              <section className="dashboard-control-card tone-ok">
                <div className="dashboard-control-card-meta">
                  <span>就绪</span>
                  <small>当前阶段</small>
                </div>
                <strong>这一环已经没有明显阻塞</strong>
                <p>可以直接执行当前下一步，或者进入对应工位做最后确认。</p>
                <button onClick={nextWorkflow.action}>去当前步骤</button>
              </section>
            )}
          </div>
        </section>
      ) : null}
      {nextWorkflow ? (
        <section className="dashboard-step-bar">
          <div className="dashboard-step-bar-copy">
            <strong>当前步骤操作条</strong>
            <span>{nextWorkflow.title}</span>
            <p>{currentStepHint}</p>
            {continuePreview ? <small>{continuePreview.label}：{continuePreview.detail}</small> : null}
          </div>
          <div className="dashboard-step-bar-actions">
            {currentStepActions.map((item) => (
              <button key={item.label} className={item.tone === "primary" ? "primary" : ""} onClick={item.action}>
                {item.label}
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {lastReceipt ? (
        <section className="dashboard-receipt">
          <div className="dashboard-receipt-copy">
            <strong>{lastReceipt.title}</strong>
            <span>{lastReceipt.at}</span>
            <p>{lastReceipt.summary}</p>
            {lastReceipt.details?.length ? (
              <div className="dashboard-receipt-details">
                {lastReceipt.details.map((item) => <small key={item}>{item}</small>)}
              </div>
            ) : null}
          </div>
          <div className="dashboard-receipt-metrics">
            {lastReceipt.metrics.map((item) => (
              <section key={item.label}>
                <b>{item.value}</b>
                <span>{item.label}</span>
              </section>
            ))}
          </div>
        </section>
      ) : null}
      {actionLog.length ? (
        <section className="dashboard-log">
          <div className="dashboard-log-header">
            <strong>执行日志</strong>
            <span>最近 {actionLog.length} 次执行</span>
          </div>
          <div className="dashboard-log-list">
            {actionLog.map((item) => (
              <section key={item.id} className={`dashboard-log-item state-${item.kind || "info"}`}>
                <div className="dashboard-log-meta">
                  <span className={`pill ${item.kind === "failed" ? "pill-warn" : "pill-ok"}`}>{item.kind === "failed" ? "失败" : "完成"}</span>
                  <small>{item.at}</small>
                </div>
                <strong>{item.title}</strong>
                <p>{item.summary}</p>
              </section>
            ))}
          </div>
        </section>
      ) : null}
      {active && (
        <div className="dashboard-workflow">
          <div className="dashboard-workflow-header">
            <div>
              <strong>执行顺序总流程</strong>
              <span>按这个顺序点下去，就能从小说一路推进到视频交付。</span>
            </div>
            {nextWorkflow ? <button className="primary" onClick={nextWorkflow.action}>{nextWorkflow.done ? "查看最终导出" : `执行当前下一步：${nextWorkflow.title}`}</button> : null}
          </div>
          <div className="dashboard-workflow-list">
            {workflowSteps.map((step) => {
              const state = step.done ? "done" : (nextWorkflow?.key === step.key ? "current" : "pending");
              return (
                <section key={step.key} className={`dashboard-workflow-step state-${state}`}>
                  <div className="dashboard-workflow-meta">
                    <span className={`pill ${state === "done" ? "pill-ok" : state === "current" ? "pill-warn" : "timeline-pill-danger"}`}>
                      {state === "done" ? "已完成" : state === "current" ? "当前执行" : "待执行"}
                    </span>
                  </div>
                  <strong>{step.title}</strong>
                  <p>{step.description}</p>
                  <small>{step.completionRule}</small>
                  <button onClick={step.action}>{step.actionLabel}</button>
                </section>
              );
            })}
          </div>
        </div>
      )}
      <div className="dashboard-body">
        <nav className="episode-list">
          {summary.episodes.map((episode) => (
            <button key={episode.id} className={episode.id === activeEpisodeId ? "active" : ""} onClick={() => onSelectEpisode(episode.id)}>
              <strong>{episode.name}</strong>
              <span>{episode.shots} 镜头 · 待审 {episode.pendingReview || 0} · 待改 {episode.autoFixPending || 0} · 待刷新 {episode.refreshPlanPending || 0} · 待回写 {episode.timelineBackfillPending || 0} · 失败导出 {episode.failedExports || 0}</span>
            </button>
          ))}
        </nav>
        {active && (
          <section className="episode-detail">
            <label>
              集标题
              <input value={active.name} onChange={(event) => onUpdateEpisode(active.id, { name: event.target.value })} />
            </label>
            <label>
              备注
              <textarea value={active.note || ""} onChange={(event) => onUpdateEpisode(active.id, { note: event.target.value })} placeholder="例如：第3集冲突升级，结尾留反转。" />
            </label>
            <div className="episode-metrics">
              <span>节点 {active.nodes}</span>
              <span>连线 {active.edges}</span>
              <span>剧本 {active.scripts}</span>
              <span>镜头表 {active.shotLists}</span>
              <span>资源 {active.resources}</span>
              <span>时间线 {active.timelineClips}</span>
              <span>待回写 {active.timelineBackfillPending || 0}</span>
              <span>结果 {active.results}</span>
              <span>待审 {active.pendingReview || 0}</span>
              <span>待自动修改 {active.autoFixPending || 0}</span>
              <span>待刷新计划 {active.refreshPlanPending || 0}</span>
              <span>快照 {active.snapshots || 0}</span>
              <span>里程碑 {active.milestones || 0}</span>
              <span>失败导出 {active.failedExports || 0}</span>
            </div>
            <h3>审稿闭环</h3>
            <div className="dashboard-issues">
              <button onClick={onOpenReviewCenter}>
                <span>{(active.pendingReview || 0) > 0 ? "警告" : "就绪"}</span>
                <strong>待审镜头 {active.pendingReview || 0} 个</strong>
              </button>
              <button onClick={onOpenReviewCenter}>
                <span>{(active.autoFixPending || 0) > 0 ? "警告" : "就绪"}</span>
                <strong>待自动修改 {active.autoFixPending || 0} 个</strong>
              </button>
              <button onClick={onOpenReviewCenter}>
                <span>{(active.refreshPlanPending || 0) > 0 ? "警告" : "就绪"}</span>
                <strong>待执行刷新计划 {active.refreshPlanPending || 0} 个</strong>
              </button>
            </div>
            <h3>镜头状态看板</h3>
            <div className="dashboard-stage-board">
              {stageBoard.shotBuckets.map((item) => (
                <button key={item.key} className={`tone-${item.tone}`} onClick={runGuide(item.action || "shot")}>
                  <span>{item.label}</span>
                  <strong>{item.count}</strong>
                </button>
              ))}
            </div>
            <h3>时间线卡点总览</h3>
            <div className="dashboard-stage-board">
              {stageBoard.timelineBuckets.map((item) => (
                <button key={item.key} className={`tone-${item.tone}`} onClick={runGuide(item.action || "timeline")}>
                  <span>{item.label}</span>
                  <strong>{item.count}</strong>
                </button>
              ))}
            </div>
            <h3>定向批处理</h3>
            <div className="dashboard-batch-actions">
              <button disabled={!(active.pendingReview || 0) || Boolean(batchRunning)} onClick={() => handleScopedBatch("pendingReview")}>
                {batchRunning === "pendingReview" ? "处理中..." : `只处理未审镜头 (${active.pendingReview || 0})`}
              </button>
              <button disabled={!(active.refreshPlanPending || 0) || Boolean(batchRunning)} onClick={() => handleScopedBatch("pendingRefresh")}>
                {batchRunning === "pendingRefresh" ? "处理中..." : `只处理待刷新镜头 (${active.refreshPlanPending || 0})`}
              </button>
              <button disabled={!(active.timelineStageBoard?.pendingApproval || 0) || Boolean(batchRunning)} onClick={() => handleScopedBatch("pendingTimelineApproval")}>
                {batchRunning === "pendingTimelineApproval" ? "处理中..." : `只验收待验收片段 (${active.timelineStageBoard?.pendingApproval || 0})`}
              </button>
              <button disabled={!(active.timelineStageBoard?.rejected || 0) || Boolean(batchRunning)} onClick={() => handleScopedBatch("rejectedTimelineRepair")}>
                {batchRunning === "rejectedTimelineRepair" ? "处理中..." : `只修退回片段 (${active.timelineStageBoard?.rejected || 0})`}
              </button>
              <button disabled={!(active.timelineBackfillPending || 0) || Boolean(batchRunning)} onClick={() => handleScopedBatch("timelineBackfill")}>
                {batchRunning === "timelineBackfill" ? "处理中..." : `只回写时间线结果 (${active.timelineBackfillPending || 0})`}
              </button>
              <button disabled={!Math.max(0, (active.timelineClips || 0) - (active.timelineReady || 0)) || Boolean(batchRunning)} onClick={() => handleScopedBatch("missingMedia")}>
                {batchRunning === "missingMedia" ? "处理中..." : `只补缺素材片段 (${Math.max(0, (active.timelineClips || 0) - (active.timelineReady || 0))})`}
              </button>
              <button disabled={!(active.failedExports || 0) || Boolean(batchRunning)} onClick={() => handleScopedBatch("failedExport")}>
                {batchRunning === "failedExport" ? "处理中..." : `只重跑失败导出 (${active.failedExports || 0})`}
              </button>
            </div>
            <h3>待处理</h3>
            <div className="dashboard-issues">
              {active.issues.length ? active.issues.map((issue, index) => (
                <button key={`${issue.text}-${index}`} onClick={() => issue.nodeId && onLocate(issue.nodeId)}>
                  <span>{issue.level}</span>
                  <strong>{issue.text}</strong>
                </button>
              )) : <div className="asset-empty">当前集结构完整，可以继续生产图片或视频。</div>}
            </div>
            <h3>关键节点</h3>
            <div className="dashboard-nodes">
              {active.keyNodes.map((node) => (
                <button key={node.id} onClick={() => onLocate(node.id)}>
                  <span>{node.kind}</span>
                  <strong>{node.title}</strong>
                </button>
              ))}
              {!active.keyNodes.length && <div className="asset-empty">本集还没有关键节点。</div>}
            </div>
          </section>
        )}
      </div>
    </aside>
  ), document.body);
}

