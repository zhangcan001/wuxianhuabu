import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  buildQueueFailureDetails,
} from "./domain/queue-diagnostics.js";

function getTimelineDeliveryState(clip) {
  const hasMedia = Boolean(String(clip?.mediaUrl || "").trim());
  if (hasMedia) return "已可导出";
  if (!hasMedia) return "待挂素材";
  return "待挂素材";
}

function getTimelineDeliveryTone(state) {
  if (state === "已齐备" || state === "已可导出") return "ok";
  return "danger";
}

function getTimelineClipChecklist(clip) {
  const hasMedia = Boolean(String(clip?.mediaUrl || "").trim());
  return [
    { key: "media", label: "素材", ready: hasMedia },
  ];
}

function getTimelineClipNextAction(clip) {
  if (!clip) return { label: "先选一个片段", key: "select" };
  const hasMedia = Boolean(String(clip.mediaUrl || "").trim());
  if (!hasMedia) return { label: "先补生成素材", key: "generate" };
  return { label: "可以直接推到可导出", key: "prepare" };
}

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

function summarizeSimpleQueue(queue = []) {
  const source = Array.isArray(queue) ? queue : [];
  return {
    total: source.length,
    pending: source.filter((job) => job.status === "pending").length,
    running: source.filter((job) => job.status === "running").length,
    done: source.filter((job) => job.status === "done").length,
    failed: source.filter((job) => job.status === "failed").length,
    image: source.filter((job) => job.kind === "image" && ["pending", "running"].includes(job.status)).length,
    video: source.filter((job) => job.kind === "video" && ["pending", "running"].includes(job.status)).length,
    exportVideo: source.filter((job) => job.kind === "exportVideo" && ["pending", "running"].includes(job.status)).length,
    recent: source.slice(-5).reverse(),
  };
}

export function SimpleWorkflowPanel({
  summary,
  activeEpisodeId,
  queue = [],
  queueRunning,
  projectMessage,
  textApiReady,
  imageApiReady,
  onBootstrapNovelFlow,
  onSubmitNovel,
  onGenerateImages,
  onGenerateVideos,
  onRunAutopilot,
  onContinueWorkflow,
  onOpenSettings,
  onOpenTextSettings,
  onOpenMediaSettings,
  onOpenDashboard,
  onOpenQueue,
  onOpenPromptFactory,
  onOpenTimeline,
  onOpenExport,
  onClose,
}) {
  const active = summary?.episodes?.find((episode) => episode.id === activeEpisodeId) || summary?.active || {};
  const [novelInput, setNovelInput] = useState("");
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const queueStats = useMemo(() => summarizeSimpleQueue(queue), [queue]);
  const setupMissing = !active?.nodes || !active?.novelNodeId;
  const apiReady = textApiReady;
  const hasNovelInput = Boolean(String(novelInput || "").trim());
  const shotCount = Number(active.shots || 0);
  const imageReadyCount = Number(active.imagesReady || 0);
  const videoReadyCount = Number(active.videosReady || 0);
  const textReady = Boolean(active.scripts && active.characters && active.scenes && shotCount && active.promptReady >= shotCount);
  const imageReady = shotCount > 0 && imageReadyCount >= shotCount;
  const videoReady = shotCount > 0 && videoReadyCount >= shotCount;
  const productionProgress = Math.round(((textReady ? 1 : 0) + (imageReady ? 1 : 0) + (videoReady ? 1 : 0)) / 3 * 100);
  const productionStages = [
    {
      key: "text",
      title: "文本拆解",
      subtitle: "小说 -> 资产 + 镜头表",
      ready: textReady,
      active: !textReady,
      stat: textReady ? "已完成" : `${active.promptReady || 0}/${shotCount || 0} 条提示词`,
      detail: "粘贴小说后，一次生成角色、场景、道具、镜头表和提示词。",
      primary: "生成资产和镜头表",
      action: startSimpleFlow,
      disabled: running || queueRunning || (!hasNovelInput && setupMissing),
    },
    {
      key: "image",
      title: "图片生成",
      subtitle: "提示词 -> 镜头首帧图",
      ready: imageReady,
      active: textReady && !imageReady,
      stat: `${imageReadyCount}/${shotCount || 0} 张图片`,
      detail: "系统按镜头表自动排队生成图片，并把结果回填到镜头。",
      primary: "生成全部图片",
      action: generateImages,
      disabled: running || queueRunning || !textReady,
    },
    {
      key: "video",
      title: "视频生成",
      subtitle: "图片 + 视频提示词 -> 片段",
      ready: videoReady,
      active: imageReady && !videoReady,
      stat: `${videoReadyCount}/${shotCount || 0} 条视频`,
      detail: "图片确认后按视频提示词生成片段，结果进入时间线。",
      primary: "生成全部视频",
      action: generateVideos,
      disabled: running || queueRunning || !textReady,
    },
  ];

  async function startSimpleFlow() {
    setRunning(true);
    setMessage("正在生成文本资产和镜头表...");
    try {
      if (hasNovelInput && onSubmitNovel) {
        const result = await onSubmitNovel(novelInput, { autoRun: true });
        setMessage(result?.summary || "文本资产和镜头表已生成。");
        return;
      }
      if (setupMissing) onBootstrapNovelFlow?.();
      const result = await onRunAutopilot?.({ mode: "textOnly" });
      setMessage(result?.summary || "后台已推进一轮，请看下面的运行状态。");
    } catch (error) {
      setMessage(error.message || String(error));
    } finally {
      setRunning(false);
    }
  }

  async function continueOnce() {
    setRunning(true);
    setMessage("正在推进当前一步...");
    try {
      if (hasNovelInput && onSubmitNovel) {
        const result = await onSubmitNovel(novelInput, { autoRun: false });
        setMessage(result?.summary || "小说已写入。");
        return;
      }
      if (setupMissing) onBootstrapNovelFlow?.();
      const result = await onContinueWorkflow?.();
      setMessage(result?.summary || "当前步骤已推进。");
    } catch (error) {
      setMessage(error.message || String(error));
    } finally {
      setRunning(false);
    }
  }

  async function generateImages() {
    setRunning(true);
    setMessage("正在把镜头加入图片生成队列...");
    try {
      const result = await onGenerateImages?.({ autoRun: true });
      setMessage(result?.summary || "图片任务已加入队列。");
    } catch (error) {
      setMessage(error.message || String(error));
    } finally {
      setRunning(false);
    }
  }

  async function generateVideos() {
    setRunning(true);
    setMessage("正在把镜头加入视频生成队列...");
    try {
      const result = await onGenerateVideos?.({ autoRun: true });
      setMessage(result?.summary || "视频任务已加入队列。");
    } catch (error) {
      setMessage(error.message || String(error));
    } finally {
      setRunning(false);
    }
  }

  return createPortal((
    <aside className="simple-flow-panel">
      <header>
        <div>
          <strong>项目生产台</strong>
          <span>{active?.name || "当前集"} · 文本 / 图片 / 视频</span>
        </div>
        <button onClick={onClose}>关闭</button>
      </header>
      <section className="simple-flow-hero">
        <div>
          <strong>{videoReady ? "当前集视频已完成" : `下一步：${productionStages.find((stage) => !stage.ready)?.title || "开始生产"}`}</strong>
          <p>按顺序推进即可：先文本拆解，再生成图片，最后生成视频。节点画布和高级总控台都保留为高级编辑入口。</p>
        </div>
        <div className="simple-flow-progress" aria-label={`生产线完成 ${productionProgress}%`}>
          <b>{productionProgress}%</b>
          <span>生产线进度</span>
        </div>
      </section>
      <div className="production-line">
        {productionStages.map((stage, index) => (
          <section key={stage.key} className={`production-stage ${stage.ready ? "done" : stage.active ? "current" : "pending"}`}>
            <div className="production-stage-index">{index + 1}</div>
            <div>
              <strong>{stage.title}</strong>
              <span>{stage.subtitle}</span>
              <p>{stage.detail}</p>
              <b>{stage.stat}</b>
            </div>
            <button className={stage.active ? "primary" : ""} disabled={stage.disabled} onClick={stage.action}>
              {running || queueRunning ? "运行中" : stage.ready ? "重新生成" : stage.primary}
            </button>
          </section>
        ))}
      </div>
      <section className="simple-flow-input">
        <label>
          小说或剧情梗概
          <textarea
            value={novelInput}
            onChange={(event) => setNovelInput(event.target.value)}
            placeholder="把小说片段、剧情梗概或已有剧本粘贴到这里。"
          />
        </label>
        <div>
          <button className="primary" disabled={running || queueRunning || !hasNovelInput} onClick={startSimpleFlow}>生成资产和镜头表</button>
          <button disabled={running || queueRunning || !hasNovelInput} onClick={continueOnce}>只写入小说</button>
        </div>
      </section>
      <div className="simple-flow-actions">
        <button disabled={running || queueRunning || !textReady} onClick={generateImages}>生成全部图片</button>
        <button disabled={running || queueRunning || !textReady} onClick={generateVideos}>生成全部视频</button>
        <button onClick={onOpenQueue}>查看运行队列</button>
        <button onClick={onOpenSettings}>配置接口</button>
      </div>
      {!apiReady ? (
        <section className="simple-flow-warning">
          <strong>文本接口还没就绪</strong>
          <p>文本接口未就绪，小说转剧本、资产和镜头表可能会停在本地或等待配置。</p>
          <div>
            {!textApiReady ? <button onClick={onOpenTextSettings}>配置文本 API</button> : null}
          </div>
        </section>
      ) : null}
      <section className="simple-flow-status">
        <div>
          <strong>实时运行状态</strong>
          <span>{queueRunning ? "队列运行中" : queueStats.pending ? "等待运行" : queueStats.failed ? "需要处理失败任务" : "空闲"}</span>
        </div>
        <div className="simple-flow-metrics">
          <section><b>{queueStats.pending}</b><span>待执行</span></section>
          <section><b>{queueStats.running}</b><span>运行中</span></section>
          <section><b>{queueStats.done}</b><span>已完成</span></section>
          <section><b>{queueStats.failed}</b><span>失败</span></section>
        </div>
        <div className="simple-flow-metrics">
          <section><b>{active.characters || 0}</b><span>角色资产</span></section>
          <section><b>{active.scenes || 0}</b><span>场景资产</span></section>
          <section><b>{active.shots || 0}</b><span>镜头</span></section>
        </div>
        {(message || projectMessage) ? <p className="simple-flow-message">{message || projectMessage}</p> : null}
        {queueStats.recent.length ? (
          <div className="simple-flow-recent">
            {queueStats.recent.map((job) => (
              <section key={job.id}>
                <span className={`pill ${job.status === "failed" ? "timeline-pill-danger" : job.status === "done" ? "pill-ok" : "pill-warn"}`}>{job.status}</span>
                <strong>{job.title || job.shotId || job.kind}</strong>
                <small>{job.resultSummary || job.error || job.prompt || ""}</small>
              </section>
            ))}
          </div>
        ) : null}
      </section>
      <div className="simple-flow-secondary">
        <button onClick={onOpenPromptFactory}>编辑提示词</button>
        <button onClick={onOpenTimeline}>视频时间线</button>
        <button onClick={onOpenExport}>导出成片</button>
        <button onClick={onOpenDashboard}>高级总控台</button>
      </div>
    </aside>
  ), document.body);
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

export function GenerationQueuePanel({ jobs, running, onRun, onStop, onClear, onClearFinished, onRetryFailed, onRetryFailedShots, onRetryAllExports, onRetryFailedExports, onRetryJob, onRemoveJob, onReprioritizeJob, onLocateJob, onRecoverTimelineGaps, onOpenTimeline, activeEpisodeName, timelineGapCount = 0, onClose, queuePriorityOptions, queueStatusLabel, queueKindLabel, compareQueueJobs, shortTitle }) {
  const [filter, setFilter] = useState("全部");
  const [showAllJobs, setShowAllJobs] = useState(false);
  const counts = jobs.reduce((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, {});
  const exportJobs = jobs.filter((job) => job.kind === "exportVideo");
  const failedShotJobs = jobs.filter((job) => job.status === "failed" && job.kind !== "exportVideo");
  const failedExportCount = exportJobs.filter((job) => job.status === "failed").length;
  const failureDetails = useMemo(() => buildQueueFailureDetails(jobs.filter((job) => job.status === "failed")), [jobs]);
  const filteredJobs = filter === "全部" ? jobs : jobs.filter((job) => queueStatusLabel(job.status) === filter || job.status === filter);
  const sortedJobs = filteredJobs.slice().sort(compareQueueJobs);
  const visibleJobs = showAllJobs ? sortedJobs : sortedJobs.slice(0, 400);
  return createPortal((
    <aside className="queue-panel">
      <header>
        <div>
          <strong>生成队列</strong>
          <span>{jobs.length} 个任务 · 等待 {counts.pending || 0} · 完成 {counts.done || 0} · 失败 {counts.failed || 0}</span>
        </div>
        <button onClick={onClose}>关闭</button>
      </header>
      <div className="queue-actions">
        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option>全部</option>
          <option>pending</option>
          <option>running</option>
          <option>done</option>
          <option>failed</option>
        </select>
        <button disabled={running || !(counts.pending || 0)} onClick={onRun}>{running ? "生成中" : "开始队列"}</button>
        {running ? <button type="button" className="danger" onClick={onStop}>停止生成</button> : null}
        <button disabled={!(counts.failed || 0)} onClick={onRetryFailed}>重试失败</button>
        <button disabled={!failedShotJobs.length} onClick={onRetryFailedShots}>重试失败镜头</button>
        <button disabled={!exportJobs.length} onClick={onRetryAllExports}>重跑全部导出</button>
        <button disabled={!failedExportCount} onClick={onRetryFailedExports}>重跑失败导出</button>
        <button onClick={onClearFinished}>清理完成</button>
        <button className="danger" onClick={onClear}>清空队列</button>
      </div>
      {(failedShotJobs.length || timelineGapCount > 0) ? (
        <section className="queue-recovery-board">
          <div className="queue-recovery-copy">
            <strong>恢复中心</strong>
            <span>{activeEpisodeName || "当前集"} · 失败镜头 {failedShotJobs.length} · 时间线缺素材 {timelineGapCount}</span>
          </div>
          <div className="queue-recovery-actions">
            <button className="primary" disabled={!failedShotJobs.length} onClick={onRetryFailedShots}>一键重试失败镜头</button>
            <button disabled={!timelineGapCount} onClick={onRecoverTimelineGaps}>补齐时间线缺口</button>
            <button onClick={onOpenTimeline}>打开时间线</button>
          </div>
          {failedShotJobs.length ? (
            <div className="queue-recovery-list">
              {failedShotJobs.slice(0, 6).map((job) => (
                <article key={`recovery-${job.id}`} className="queue-recovery-item">
                  <div>
                    <strong>{job.shotId || job.title || "失败镜头"}</strong>
                    <p>{queueKindLabel(job.kind)} · {shortTitle(job.error || job.resultSummary || job.prompt || "")}</p>
                  </div>
                  <div className="queue-item-actions">
                    <button onClick={() => onLocateJob?.(job.id)}>定位镜头</button>
                    <button onClick={() => onRetryJob?.(job.id)}>重试这条</button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
          {failureDetails.length ? (
            <div className="queue-failure-detail-grid">
              {failureDetails.map((item) => (
                <article key={item.reason} className="queue-failure-detail-card">
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.count} 个任务 · {item.actionLabel}</span>
                  </div>
                  <p>{item.detail}</p>
                  {item.examples.map((example) => (
                    <small key={example.id || `${item.reason}-${example.title}`}>{example.title} · {shortTitle(example.message)}</small>
                  ))}
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
      <div className="queue-list">
        {!showAllJobs && sortedJobs.length > visibleJobs.length ? (
          <div className="large-list-notice">
            <span>性能模式：当前显示前 {visibleJobs.length} / {sortedJobs.length} 个任务</span>
            <button type="button" onClick={() => setShowAllJobs(true)}>显示全部</button>
          </div>
        ) : null}
        {visibleJobs.length ? visibleJobs
          .map((job) => {
            const progressValue = typeof job.progress === "number" ? Math.max(0, Math.min(100, job.progress)) : null;
            return (
            <section key={job.id} className={`queue-item ${job.status}`}>
              <header>
                <strong>{job.title || "生成任务"}</strong>
                <div className="queue-item-meta">
                  <span className={`queue-priority priority-${job.priority || "中"}`}>{job.priority || "中"}</span>
                  <span>{queueStatusLabel(job.status)}</span>
                </div>
              </header>
              <p>{job.shotId || job.renderLabel || queueKindLabel(job.kind) || "任务"} · {shortTitle(job.prompt || "")}</p>
              <small>{queueKindLabel(job.kind)} · 尝试 {job.attempts || 0} 次 {job.resultSummary ? `· ${job.resultSummary}` : ""}</small>
              {progressValue !== null && (
                <div className="queue-progress" aria-label={`任务进度 ${progressValue}%`}>
                  <div className="queue-progress-bar" style={{ width: `${progressValue}%` }} />
                  <span>{progressValue}%</span>
                </div>
              )}
              {job.error && <em>{job.error}</em>}
              <div className="queue-item-actions">
                <select value={job.priority || "中"} onChange={(event) => onReprioritizeJob(job.id, event.target.value)} disabled={job.status === "running"}>
                  {queuePriorityOptions.map((priority) => <option key={priority}>{priority}</option>)}
                </select>
                {job.shotId || job.sourceNodeId ? <button disabled={job.status === "running"} onClick={() => onLocateJob?.(job.id)}>定位</button> : null}
                <button disabled={job.status === "running"} onClick={() => onRetryJob(job.id)}>重试</button>
                <button disabled={job.status === "running"} onClick={() => onRemoveJob(job.id)}>移除</button>
              </div>
            </section>
          );
          }) : (
            <div className="empty-panel empty-panel-guide queue-empty-guide">
              <div className="empty-panel-icon" aria-hidden="true">⚙️</div>
              {jobs.length ? (
                <>
                  <div className="empty-panel-title">当前筛选下没有任务</div>
                  <p className="empty-panel-text">切回「全部」就能看到所有任务，或换一个状态试试。</p>
                  <div className="empty-panel-actions">
                    <button type="button" className="empty-panel-btn is-primary" onClick={() => setFilter("全部")}>显示全部</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="empty-panel-title">队列还没接到活</div>
                  <p className="empty-panel-text">去分镜表点「生图」「生视频」，任务会自动排进这里。</p>
                  <p className="empty-panel-hint">导出视频、批量出图也都走这条队列。</p>
                </>
              )}
            </div>
          )}
      </div>
    </aside>
  ), document.body);
}

export function TimelinePanel({ episode, timeline, availableShots, focusClipId, onImportShots, onPatchClip, onPatchClips, onMoveClip, onDuplicateClip, onSortClips, onRemoveClip, onLocateShot, onGenerateClip, onSyncClip, onSyncClips, onPatchShotFromClip, onPatchShotsFromClips, onPrepareClips, getClipStatus, onExport, onClose, totalDurationSeconds }) {
  const [selectedId, setSelectedId] = useState(timeline.clips[0]?.id || "");
  const [filter, setFilter] = useState("全部");
  const [showAllClips, setShowAllClips] = useState(false);
  const [lastPrepareSummary, setLastPrepareSummary] = useState(null);
  const [lastBackfillSummary, setLastBackfillSummary] = useState(null);
  const clipStats = useMemo(() => {
    const withMedia = timeline.clips.filter((clip) => String(clip.mediaUrl || "").trim()).length;
    const exportReadyClips = timeline.clips.filter((clip) => Boolean(String(clip.mediaUrl || "").trim()) && String(clip.approvalStatus || "待验收") === "已通过").length;
    const readyClips = timeline.clips.filter((clip) => getTimelineDeliveryState(clip) === "已齐备").length;
    const missingMediaClips = timeline.clips.filter((clip) => !String(clip.mediaUrl || "").trim());
    const approvedClips = timeline.clips.filter((clip) => String(clip.approvalStatus || "待验收") === "已通过");
    const rejectedClips = timeline.clips.filter((clip) => String(clip.approvalStatus || "") === "退回修改");
    const pendingApprovalClips = timeline.clips.filter((clip) => String(clip.approvalStatus || "待验收") === "待验收");
    return {
      withMedia,
      exportReadyClips,
      readyClips,
      missingMediaClips,
      approvedClips,
      rejectedClips,
      pendingApprovalClips,
      deliveryReady: Boolean(timeline.clips.length) && missingMediaClips.length === 0 && pendingApprovalClips.length === 0 && rejectedClips.length === 0,
    };
  }, [timeline.clips]);
  const filteredClips = useMemo(() => {
    if (filter === "全部") return timeline.clips;
    return timeline.clips.filter((clip) => getTimelineDeliveryState(clip) === filter);
  }, [filter, timeline.clips]);
  const visibleClips = showAllClips ? filteredClips : filteredClips.slice(0, 300);
  const selected = filteredClips.find((clip) => clip.id === selectedId)
    || timeline.clips.find((clip) => clip.id === selectedId)
    || filteredClips[0]
    || timeline.clips[0]
    || null;
  const selectedDeliveryState = selected ? getTimelineDeliveryState(selected) : "";
  const selectedDeliveryTone = getTimelineDeliveryTone(selectedDeliveryState);
  const selectedChecklist = selected ? getTimelineClipChecklist(selected) : [];
  const selectedNextAction = getTimelineClipNextAction(selected);
  const preflightIssues = [
    !timeline.clips.length ? "当前时间线还没有片段" : "",
    clipStats.missingMediaClips.length ? `还有 ${clipStats.missingMediaClips.length} 条片段未挂素材` : "",
    clipStats.pendingApprovalClips.length ? `还有 ${clipStats.pendingApprovalClips.length} 条片段待验收` : "",
    clipStats.rejectedClips.length ? `还有 ${clipStats.rejectedClips.length} 条片段被退回修改` : "",
  ].filter(Boolean);
  const preflightReady = Boolean(timeline.clips.length) && preflightIssues.length === 0;
  const deliveryBuckets = [
    { label: "待挂素材", count: clipStats.missingMediaClips.length, filterKey: "待挂素材", tone: clipStats.missingMediaClips.length ? "danger" : "ok" },
    { label: "待验收", count: clipStats.pendingApprovalClips.length, filterKey: "全部", tone: clipStats.pendingApprovalClips.length ? "warn" : "ok" },
    { label: "已齐备", count: clipStats.readyClips, filterKey: "已齐备", tone: clipStats.readyClips ? "ok" : "neutral" },
  ];

  useEffect(() => {
    if (!timeline.clips.length) {
      setSelectedId("");
      return;
    }
    if (!filteredClips.some((clip) => clip.id === selectedId) && filteredClips[0]?.id) {
      setSelectedId(filteredClips[0].id);
      return;
    }
    if (!timeline.clips.some((clip) => clip.id === selectedId)) setSelectedId(timeline.clips[0].id);
  }, [filteredClips, timeline, selectedId]);

  useEffect(() => {
    if (!focusClipId) return;
    if (timeline.clips.some((clip) => clip.id === focusClipId)) setSelectedId(focusClipId);
  }, [focusClipId, timeline.clips]);

  const generateFilteredMissingMedia = () => {
    filteredClips.forEach((clip) => {
      if (!String(clip.mediaUrl || "").trim()) onGenerateClip?.(clip);
    });
  };

  const syncFilteredClips = () => {
    onSyncClips?.(filteredClips.map((clip) => clip.id));
  };

  const prepareFilteredClips = () => {
    const summary = onPrepareClips?.(filteredClips.map((clip) => clip.id));
    if (summary) {
      setLastPrepareSummary({
        ...summary,
        label: `当前筛选 ${filteredClips.length} 条`,
        createdAt: Date.now(),
      });
    }
  };

  const backfillFilteredClips = (options = {}) => {
    const summary = onPatchShotsFromClips?.(filteredClips.map((clip) => clip.id), options);
    if (summary) {
      setLastBackfillSummary({
        ...summary,
        label: `当前筛选 ${filteredClips.length} 条`,
        createdAt: Date.now(),
      });
    }
  };

  const backfillSelectedClip = (options = {}) => {
    if (!selected) return;
    const summary = onPatchShotFromClip?.(selected.id, options);
    if (summary) {
      setLastBackfillSummary({
        ...summary,
        label: selected.title || selected.shotId || "当前片段",
        createdAt: Date.now(),
      });
    }
  };

  const patchFilteredApproval = (approvalStatus) => {
    filteredClips.forEach((clip) => {
      onPatchClip(clip.id, {
        approvalStatus,
        approvalNote: approvalStatus === "退回修改"
          ? (clip.approvalNote || "时间线验收未通过，待补素材/文字轨或重新调整")
          : "",
      });
    });
  };

  const patchSelectedApproval = (approvalStatus) => {
    if (!selected) return;
    onPatchClip(selected.id, {
      approvalStatus,
      approvalNote: approvalStatus === "退回修改"
        ? (selected.approvalNote || "当前片段验收未通过，待调整")
        : "",
    });
  };

  const locateFirstMissingMedia = () => {
    const target = clipStats.missingMediaClips[0];
    if (!target) return;
    setSelectedId(target.id);
    onLocateShot?.(target);
  };


  return createPortal((
    <aside className="timeline-panel">
      <header>
        <div>
          <strong>{episode?.name || "当前集"} 时间线</strong>
          <span>{timeline.clips.length} 个片段 · 交付 {clipStats.deliveryReady ? "可导出" : "待补齐"}</span>
        </div>
        <div className="timeline-header-actions">
          <button onClick={() => onImportShots(availableShots)}>导入当前集镜头</button>
          <button className="primary" disabled={!filteredClips.length} onClick={prepareFilteredClips}>一键推到可导出</button>
          <button disabled={!filteredClips.length} onClick={syncFilteredClips}>同步当前筛选</button>
          <button disabled={!filteredClips.length} onClick={() => onPatchClips?.(filteredClips.map((clip) => clip.id), { duration: "4秒" })}>批量 4 秒</button>
          <button disabled={!timeline.clips.length} onClick={onSortClips}>按镜头排序</button>
          <button disabled={!filteredClips.some((clip) => !String(clip.mediaUrl || "").trim())} onClick={generateFilteredMissingMedia}>补当前筛选素材</button>
          <button onClick={onExport}>导出清单</button>
          <button onClick={onClose}>关闭</button>
        </div>
      </header>
      <div className="timeline-summary">
        <section><b>{timeline.clips.length}</b><span>时间线片段</span></section>
        <section><b>{availableShots.length}</b><span>可导入镜头</span></section>
        <section><b>{totalDurationSeconds}</b><span>总秒数</span></section>
        <section><b>{clipStats.withMedia}</b><span>已挂素材</span></section>
        <section><b>{clipStats.readyClips}</b><span>可导出片段</span></section>
        <section><b>{clipStats.missingMediaClips.length}</b><span>待挂素材</span></section>
        <section><b>{clipStats.approvedClips.length}</b><span>已通过验收</span></section>
        <section><b>{clipStats.pendingApprovalClips.length}</b><span>待验收</span></section>
      </div>
      <div className="timeline-preflight-card">
        <div className="timeline-preflight-copy">
          <strong>{preflightReady ? "当前集已通过导出前预检" : "当前集还没通过导出前预检"}</strong>
          <span>{preflightReady ? "素材和片段验收都齐了，可以放心进导出。" : "先把下面这些缺口清零，再进成片导出会更稳。时间线里的验收和素材结果也可以一键回写到镜头表。"} </span>
        </div>
        <div className="timeline-preflight-pills">
          <span className={`pill ${preflightReady ? "pill-ok" : "pill-warn"}`}>{preflightReady ? "预检通过" : "预检未通过"}</span>
          <span className="pill">已通过验收 {clipStats.approvedClips.length}/{timeline.clips.length}</span>
        </div>
        <div className="timeline-preflight-issues">
          {preflightIssues.length ? preflightIssues.map((issue) => <span key={issue} className="pill timeline-pill-warn">{issue}</span>) : <span className="pill pill-ok">没有阻塞项</span>}
        </div>
        <div className="timeline-preflight-actions">
          <button disabled={!filteredClips.length} onClick={() => patchFilteredApproval("已通过")}>当前筛选批量通过</button>
          <button disabled={!filteredClips.length} onClick={() => patchFilteredApproval("待验收")}>当前筛选改回待验收</button>
          <button disabled={!filteredClips.length} onClick={() => backfillFilteredClips({ approvalOnly: true })}>仅回写验收</button>
          <button disabled={!filteredClips.length} onClick={() => backfillFilteredClips()}>回写当前筛选到镜头</button>
          <button disabled={!filteredClips.length} onClick={prepareFilteredClips}>当前筛选推到可导出</button>
          <button onClick={onExport}>打开导出清单</button>
        </div>
      </div>
      <div className="timeline-delivery-board">
        <div className={`timeline-delivery-status tone-${clipStats.deliveryReady ? "ok" : "warn"}`}>
          <strong>{clipStats.deliveryReady ? "当前时间线已达到导出门槛" : "当前时间线还没齐活"}</strong>
          <span>{clipStats.deliveryReady ? "素材都齐了，可以直接去导出中心交付。" : `还差 ${clipStats.missingMediaClips.length} 个素材片段。`}</span>
        </div>
        <div className="timeline-delivery-actions">
          <div className="asset-drawer-tabs timeline-filter-tabs">
            {["全部", "已可导出", "待挂素材"].map((item) => (
              <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>
            ))}
          </div>
          <div className="timeline-delivery-pills">
            <span className={`pill ${clipStats.deliveryReady ? "pill-ok" : "pill-warn"}`}>{clipStats.deliveryReady ? "可导出" : "待补齐"}</span>
            <span className="pill">当前筛选 {filteredClips.length} 条</span>
          </div>
        </div>
        <div className="timeline-delivery-issues">
          {clipStats.missingMediaClips.length ? (
            <section>
              <strong>待挂素材</strong>
              <p>{clipStats.missingMediaClips.slice(0, 6).map((clip) => clip.title || clip.shotId || "未命名片段").join("、")}{clipStats.missingMediaClips.length > 6 ? ` 等 ${clipStats.missingMediaClips.length} 条` : ""}</p>
              <div className="timeline-delivery-pills">
                <button onClick={locateFirstMissingMedia}>定位第一条</button>
                <button onClick={() => clipStats.missingMediaClips.forEach((clip) => onGenerateClip?.(clip))}>一键补生成</button>
              </div>
            </section>
          ) : null}
          {!clipStats.missingMediaClips.length ? <div className="asset-empty">当前时间线视频素材都已经补齐。</div> : null}
        </div>
        {lastPrepareSummary ? (
          <div className="timeline-delivery-runbook">
            <section>
              <strong>上一次推进</strong>
              <p>{lastPrepareSummary.label} · 已处理 {lastPrepareSummary.processed} 条</p>
            </section>
            <section><b>{lastPrepareSummary.synced}</b><span>同步源镜头</span></section>
            <section><b>{lastPrepareSummary.queued}</b><span>加入生成队列</span></section>
            <section><b>{lastPrepareSummary.blocked || 0}</b><span>仍有阻塞</span></section>
            <section><b>{lastPrepareSummary.remaining?.media || 0}</b><span>剩余待素材</span></section>
            <section><b>{lastPrepareSummary.remaining?.exportReady || 0}</b><span>本批已可导出</span></section>
          </div>
        ) : null}
        {lastBackfillSummary ? (
          <div className="timeline-delivery-runbook">
            <section>
              <strong>最近一次回写镜头表</strong>
              <p>{lastBackfillSummary.label} · {lastBackfillSummary.approvalOnly ? "仅回写验收状态" : "回写验收 + 素材线索"}</p>
            </section>
            <section><b>{lastBackfillSummary.synced || 0}</b><span>已回写镜头</span></section>
            <section><b>{lastBackfillSummary.skipped || 0}</b><span>无变化跳过</span></section>
            <section><b>{lastBackfillSummary.missingLink || 0}</b><span>未关联镜头</span></section>
            <section><b>{lastBackfillSummary.comments || 0}</b><span>新增验收记录</span></section>
          </div>
        ) : null}
      </div>
      <div className="timeline-delivery-buckets">
        {deliveryBuckets.map((item) => (
          <button
            key={item.label}
            className={`timeline-delivery-bucket tone-${item.tone} ${filter === item.filterKey ? "active" : ""}`}
            onClick={() => setFilter(item.filterKey)}
          >
            <b>{item.count}</b>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      <div className="timeline-body">
        <section className="timeline-strip">
          {!showAllClips && filteredClips.length > visibleClips.length ? (
            <div className="large-list-notice">
              <span>性能模式：当前显示前 {visibleClips.length} / {filteredClips.length} 个片段</span>
              <button type="button" onClick={() => setShowAllClips(true)}>显示全部</button>
            </div>
          ) : null}
          {visibleClips.length ? visibleClips.map((clip) => (
            <button key={clip.id} className={clip.id === selected?.id ? "active" : ""} onClick={() => setSelectedId(clip.id)}>
              <strong>{timeline.clips.findIndex((item) => item.id === clip.id) + 1}. {clip.title}</strong>
              <span>{clip.scene || "未填场景"}</span>
              <small>{clip.duration} · {clip.transition} · {getClipStatus?.(clip) || (clip.mediaUrl ? "已挂素材" : "待补素材")}</small>
              <div className="timeline-strip-pills">
                <span className={`pill timeline-pill-${getTimelineDeliveryTone(getTimelineDeliveryState(clip))}`}>{getTimelineDeliveryState(clip)}</span>
                {clip.mediaUrl ? <span className="pill pill-ok">素材已挂</span> : null}
              </div>
            </button>
          )) : <div className="asset-empty">{timeline.clips.length ? "当前筛选下没有片段。" : "时间线还是空的。先从当前集镜头表导入。"}</div>}
        </section>
        <section className="timeline-editor">
          {selected ? (
            <>
              <div className="timeline-preview">
                {selected.mediaUrl ? (
                  /\.(mp4|webm|mov)$/i.test(selected.mediaUrl)
                    ? <video src={selected.mediaUrl} muted playsInline controls />
                    : <img src={selected.mediaUrl} alt="" />
                ) : <div className="timeline-preview-empty">当前片段还没有挂载结果素材</div>}
              </div>
              <div className="result-meta">
                <span className="pill">{getClipStatus?.(selected) || (selected.mediaUrl ? "已挂素材" : "待补素材")}</span>
                <span className="pill">{selected.mediaType === "video" ? "视频片段" : "图片片段"}</span>
                <span className={`pill timeline-pill-${selectedDeliveryTone}`}>{selectedDeliveryState}</span>
                <span className={`pill ${selected.approvalStatus === "已通过" ? "pill-ok" : selected.approvalStatus === "退回修改" ? "pill-warn" : "timeline-pill-danger"}`}>验收 {selected.approvalStatus || "待验收"}</span>
              </div>
              <div className="timeline-clip-readiness">
                <div className="timeline-clip-readiness-copy">
                  <strong>当前片段准备状态</strong>
                  <span>{selectedNextAction.label}</span>
                </div>
                <div className="timeline-clip-readiness-pills">
                  {selectedChecklist.map((item) => (
                    <span key={item.key} className={`pill ${item.ready ? "pill-ok" : "timeline-pill-danger"}`}>{item.label}{item.ready ? "已就绪" : "待补"}</span>
                  ))}
                </div>
                <div className="timeline-clip-readiness-actions">
                  {!selected.mediaUrl ? <button onClick={() => onGenerateClip?.(selected)}>补生成素材</button> : null}
                  <button className="primary" onClick={() => {
                    const summary = onPrepareClips?.([selected.id]);
                    if (summary) {
                      setLastPrepareSummary({
                        ...summary,
                        label: selected.title || selected.shotId || "当前片段",
                        createdAt: Date.now(),
                      });
                    }
                  }}>推到可导出</button>
                </div>
              </div>
              <div className="timeline-fields">
                <label>片段标题<input value={selected.title} onChange={(event) => onPatchClip(selected.id, { title: event.target.value })} /></label>
                <label>场景<input value={selected.scene} onChange={(event) => onPatchClip(selected.id, { scene: event.target.value })} /></label>
                <label>时长<input value={selected.duration} onChange={(event) => onPatchClip(selected.id, { duration: event.target.value })} /></label>
                <label>转场<select value={selected.transition} onChange={(event) => onPatchClip(selected.id, { transition: event.target.value })}>
                  <option>直切</option>
                  <option>淡入淡出</option>
                  <option>黑场</option>
                  <option>闪白</option>
                </select></label>
              </div>
              <div className="timeline-fields">
                <label>验收状态<select value={selected.approvalStatus || "待验收"} onChange={(event) => onPatchClip(selected.id, { approvalStatus: event.target.value })}>
                  <option>待验收</option>
                  <option>已通过</option>
                  <option>退回修改</option>
                </select></label>
                <label>验收备注<input value={selected.approvalNote || ""} onChange={(event) => onPatchClip(selected.id, { approvalNote: event.target.value })} placeholder="例如：素材需重生 / 节奏可直接过" /></label>
              </div>
              <label>备注<textarea className="small-textarea" value={selected.note} onChange={(event) => onPatchClip(selected.id, { note: event.target.value })} /></label>
              <div className="timeline-clip-actions">
                <button onClick={() => onLocateShot?.(selected)}>定位镜头</button>
                <button onClick={() => patchSelectedApproval("已通过")}>标记通过</button>
                <button onClick={() => patchSelectedApproval("退回修改")}>退回修改</button>
                <button onClick={() => backfillSelectedClip({ approvalOnly: true })}>仅回写验收</button>
                <button onClick={() => backfillSelectedClip()}>回写镜头表</button>
                {!selected.mediaUrl && <button onClick={() => onGenerateClip?.(selected)}>补生成</button>}
                <button className="primary" onClick={() => {
                  const summary = onPrepareClips?.([selected.id]);
                  if (summary) {
                    setLastPrepareSummary({
                      ...summary,
                      label: selected.title || selected.shotId || "当前片段",
                      createdAt: Date.now(),
                    });
                  }
                }}>推到可导出</button>
                <button onClick={() => onSyncClip?.(selected.id)}>同步源镜头</button>
                <button onClick={() => onMoveClip(selected.id, -1)}>上移</button>
                <button onClick={() => onMoveClip(selected.id, 1)}>下移</button>
                <button onClick={() => onDuplicateClip?.(selected.id)}>复制片段</button>
                <button className="danger" onClick={() => onRemoveClip(selected.id)}>移除片段</button>
              </div>
            </>
          ) : (
            <div className="asset-empty">导入镜头后，这里可以编辑时间线片段。</div>
          )}
        </section>
      </div>
    </aside>
  ), document.body);
}

export function ProjectHealthPanel({ report, activeEpisodeId, onSelectEpisode, onLocate, onAutoFix, onAutoFixBatch, fixingKeys = [], repairLog = [], remainingKeys = [], onClose }) {
  const [tab, setTab] = useState("all");
  const [focusMode, setFocusMode] = useState("all");
  const tabbedFindings = tab === "all" ? report.findings : report.findings.filter((item) => item.level === tab || item.category === tab);
  const findings = focusMode === "remaining"
    ? tabbedFindings.filter((item) => remainingKeys.includes(`${item.category}-${item.text}-${item.nodeId || ""}-${item.fix?.kind || ""}`))
    : tabbedFindings;
  const fixableFindings = findings.filter((item) => item.fix?.kind);

  return createPortal((
    <aside className="health-panel">
      <header>
        <div>
          <strong>项目体检</strong>
          <span>{report.summary.totalFindings} 个问题 · 严重 {report.summary.critical} · 警告 {report.summary.warning} · 建议 {report.summary.info}</span>
        </div>
        <button onClick={onClose}>关闭</button>
      </header>
      <div className="health-stats">
        <section><b>{report.summary.critical}</b><span>严重</span></section>
        <section><b>{report.summary.warning}</b><span>警告</span></section>
        <section><b>{report.summary.info}</b><span>建议</span></section>
        <section><b>{report.summary.coverage}</b><span>健康度</span></section>
      </div>
      <div className="health-toolbar">
        <div className="asset-drawer-tabs health-tabs">
          <button className={tab === "all" ? "active" : ""} onClick={() => setTab("all")}>全部</button>
          <button className={tab === "严重" ? "active" : ""} onClick={() => setTab("严重")}>严重</button>
          <button className={tab === "警告" ? "active" : ""} onClick={() => setTab("警告")}>警告</button>
          <button className={tab === "建议" ? "active" : ""} onClick={() => setTab("建议")}>建议</button>
          <button className={tab === "镜头" ? "active" : ""} onClick={() => setTab("镜头")}>镜头</button>
          <button className={tab === "资产" ? "active" : ""} onClick={() => setTab("资产")}>资产</button>
          <button className={tab === "时间线" ? "active" : ""} onClick={() => setTab("时间线")}>时间线</button>
        </div>
        <div className="health-item-actions">
          <button
            className={focusMode === "remaining" ? "active" : ""}
            disabled={!remainingKeys.length}
            onClick={() => setFocusMode((current) => (current === "remaining" ? "all" : "remaining"))}
          >
            {focusMode === "remaining" ? "显示全部" : `仅看剩余${remainingKeys.length ? ` (${remainingKeys.length})` : ""}`}
          </button>
          <button disabled={!fixableFindings.length || fixingKeys.length > 0} onClick={() => onAutoFixBatch?.(fixableFindings)}>
            {fixingKeys.length > 0 ? "批量修复中..." : "自动修复当前筛选"}
          </button>
        </div>
      </div>
      <div className="health-list">
        {findings.length ? findings.map((finding, index) => (
          <section key={`${finding.category}-${finding.text}-${index}`} className={`health-item level-${finding.level}`}>
            <header>
              <div className="health-item-meta">
                <span className={`health-level level-${finding.level}`}>{finding.level}</span>
                <span>{finding.category}</span>
                <span>{finding.episodeName || "全项目"}</span>
              </div>
              <div className="health-item-actions">
                {finding.episodeId && finding.episodeId !== activeEpisodeId && <button onClick={() => onSelectEpisode(finding.episodeId)}>切到该集</button>}
                {!!finding.nodeId && <button onClick={() => onLocate(finding.nodeId)}>定位</button>}
                {!!finding.fix?.kind && (
                  <button
                    disabled={fixingKeys.includes(`${finding.category}-${finding.text}-${finding.nodeId || ""}-${finding.fix?.kind || ""}`)}
                    onClick={() => onAutoFix?.(finding)}
                  >
                    {fixingKeys.includes(`${finding.category}-${finding.text}-${finding.nodeId || ""}-${finding.fix?.kind || ""}`) ? "修复中..." : "API修复"}
                  </button>
                )}
              </div>
            </header>
            <strong>{finding.text}</strong>
            {finding.detail && <p>{finding.detail}</p>}
          </section>
        )) : <div className="asset-empty">当前筛选下没有发现问题。</div>}
      </div>
      <div className="health-list">
        <section className="health-item">
          <header>
            <div className="health-item-meta">
              <span className="health-level level-建议">记录</span>
              <span>自动修复日志</span>
            </div>
          </header>
          {repairLog.length ? repairLog.slice(0, 8).map((item) => (
            <div key={item.id} className="health-item" style={{ marginTop: 10 }}>
              <div className="health-item-meta">
                <span className={`health-level level-${item.status === "failed" ? "严重" : "建议"}`}>{item.status === "failed" ? "失败" : "通过"}</span>
                <span>{item.category || "体检"}</span>
                <span>{item.episodeName || "全项目"}</span>
              </div>
              <strong>{item.findingText || item.action}</strong>
              <p>{item.detail || item.action}</p>
              <small>{item.at}</small>
            </div>
          )) : <div className="asset-empty">还没有自动修复记录。</div>}
        </section>
      </div>
    </aside>
  ), document.body);
}

export function ProductionHubPanel({
  report,
  onOpenDashboard,
  onOpenHealth,
  onOpenResources,
  onOpenPromptFactory,
  onOpenReviewCenter,
  onOpenTimeline,
  onOpenExportCenter,
  onOpenQueue,
  onLocate,
  onClose,
}) {
  const openByKey = {
    dashboard: onOpenDashboard,
    health: onOpenHealth,
    resources: onOpenResources,
    prompt: onOpenPromptFactory,
    review: onOpenReviewCenter,
    timeline: onOpenTimeline,
    export: onOpenExportCenter,
    queue: onOpenQueue,
  };
  return createPortal((
    <aside className="production-hub-panel">
      <header>
        <div>
          <strong>生产闭环中心</strong>
          <span>{report.episodeName} · 完成度 {report.coverage}% · 当前建议 {report.nextAction.label}</span>
        </div>
        <button onClick={onClose}>关闭</button>
      </header>
      <div className="review-summary">
        <section><b>{report.summary.scripts}</b><span>剧本节点</span></section>
        <section><b>{report.summary.assets}</b><span>资产总数</span></section>
        <section><b>{report.summary.shots}</b><span>镜头总数</span></section>
        <section><b>{report.summary.generated}</b><span>已生成镜头</span></section>
      </div>
      <div className="production-next">
        <div>
          <strong>下一步</strong>
          <p>{report.nextAction.description}</p>
        </div>
        <div className="health-item-actions">
          <button onClick={() => openByKey[report.nextAction.actionKey]?.()}>打开对应面板</button>
          {report.nextAction.nodeId ? <button onClick={() => onLocate(report.nextAction.nodeId)}>定位节点</button> : null}
        </div>
      </div>
      <div className="production-quick-actions">
        {(report.quickActions || []).map((item) => (
          <section key={item.key} className="production-quick-card">
            <div>
              <strong>{item.label}</strong>
              <p>{item.detail}</p>
            </div>
            <div className="production-quick-meta">
              <span className={`pill ${item.count ? "pill-warn" : "pill-ok"}`}>{item.count || 0}</span>
              <button onClick={() => openByKey[item.actionKey]?.()}>打开</button>
            </div>
          </section>
        ))}
      </div>
      <div className="production-blockers">
        {(report.blockerGroups || []).map((group) => (
          <section key={group.key} className={`production-blocker tone-${group.tone || "warn"}`}>
            <header>
              <div className="health-item-meta">
                <span className={`health-level level-${group.count ? (group.tone === "danger" ? "严重" : "警告") : "建议"}`}>{group.title}</span>
                <span>{group.count || 0}</span>
              </div>
              <div className="health-item-actions">
                <button onClick={() => openByKey[group.actionKey]?.()}>处理</button>
                {group.nodeId ? <button onClick={() => onLocate(group.nodeId)}>定位</button> : null}
              </div>
            </header>
            <p>{group.description}</p>
            {group.detail?.length ? <small>{group.detail.join("、")}</small> : <small>当前没有待处理项。</small>}
          </section>
        ))}
      </div>
      <div className="production-hub-grid">
        {report.stages.map((stage) => (
          <section key={stage.key} className={`production-stage stage-${stage.status}`}>
            <header>
              <div className="health-item-meta">
                <span className={`health-level level-${stage.level}`}>{stage.label}</span>
                <span>{stage.metric}</span>
              </div>
              <div className="health-item-actions">
                <button onClick={() => openByKey[stage.actionKey]?.()}>打开</button>
                {stage.nodeId ? <button onClick={() => onLocate(stage.nodeId)}>定位</button> : null}
              </div>
            </header>
            <strong>{stage.title}</strong>
            <p>{stage.detail}</p>
          </section>
        ))}
      </div>
      <div className="dashboard-actions">
        <button onClick={onOpenDashboard}>总控台</button>
        <button onClick={onOpenHealth}>项目体检</button>
        <button onClick={onOpenResources}>资源中心</button>
        <button onClick={onOpenPromptFactory}>Prompt工厂</button>
        <button onClick={onOpenReviewCenter}>审稿反馈</button>
        <button onClick={onOpenTimeline}>时间线</button>
        <button onClick={onOpenExportCenter}>成片导出</button>
        <button onClick={onOpenQueue}>生成队列</button>
      </div>
    </aside>
  ), document.body);
}

export function ArchiveCenterPanel({ state, report, onPatchState, onCreateSnapshot, onExportFile, onClose, archiveStageOptions, exportBaseName }) {
  const [label, setLabel] = useState("");
  const [stage, setStage] = useState("开发中");
  const milestones = new Set(state.milestoneIds || []);

  async function exportArchiveIndex() {
    await onExportFile(`${exportBaseName}-archive-index.json`, "json", JSON.stringify(report.archiveIndex, null, 2));
  }

  return createPortal((
    <aside className="archive-panel">
      <header>
        <div>
          <strong>归档中心</strong>
          <span>{report.episodeName} · 快照 {report.summary.snapshots} · 里程碑 {report.summary.milestones}</span>
        </div>
        <button onClick={onClose}>关闭</button>
      </header>
      <div className="review-summary">
        <section><b>{report.summary.snapshots}</b><span>项目快照</span></section>
        <section><b>{report.summary.milestones}</b><span>里程碑版本</span></section>
        <section><b>{report.summary.lastStage}</b><span>当前阶段</span></section>
        <section><b>{report.summary.deliveryReady ? "是" : "否"}</b><span>交付备注</span></section>
      </div>
      <div className="archive-blockers">
        {(report.blockers || []).map((item) => (
          <section key={item.key} className={`archive-blocker ${item.ready ? "ready" : "warn"}`}>
            <strong>{item.label}</strong>
            <p>{item.detail}</p>
          </section>
        ))}
      </div>
      <div className="archive-toolbar">
        <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="快照名称，例如：第3集交付前" />
        <select value={stage} onChange={(event) => setStage(event.target.value)}>
          {archiveStageOptions.map((item) => <option key={item}>{item}</option>)}
        </select>
        <button onClick={() => onCreateSnapshot(label || `${report.episodeName}-${stage}`, stage)}>创建快照</button>
        <button onClick={exportArchiveIndex}>导出归档索引</button>
      </div>
      <div className="archive-body">
        <section className="archive-note-box">
          <label>交付备注<textarea value={state.deliveryNote || ""} onChange={(event) => onPatchState({ deliveryNote: event.target.value })} placeholder="这里写交付说明、版本差异、注意事项、对接信息。" /></label>
        </section>
        <section className="archive-list">
          {(state.snapshots || []).length ? state.snapshots.map((item) => (
            <article key={item.id} className={`archive-item ${milestones.has(item.id) ? "milestone" : ""}`}>
              <header>
                <div className="health-item-meta">
                  <span className="health-level level-建议">{item.stage || "开发中"}</span>
                  <span>{new Date(item.createdAt || Date.now()).toLocaleString()}</span>
                </div>
                {milestones.has(item.id) && <strong>里程碑</strong>}
              </header>
              <strong>{item.label}</strong>
              <p>{item.summary}</p>
              {item.note ? <small>{item.note}</small> : null}
              <div className="health-item-actions">
                <button onClick={() => onPatchState({
                  milestoneIds: milestones.has(item.id)
                    ? (state.milestoneIds || []).filter((id) => id !== item.id)
                    : [item.id, ...(state.milestoneIds || []).filter((id) => id !== item.id)].slice(0, 20),
                })}>{milestones.has(item.id) ? "取消里程碑" : "设为里程碑"}</button>
              </div>
            </article>
          )) : <div className="asset-empty">当前还没有项目快照。</div>}
        </section>
      </div>
    </aside>
  ), document.body);
}

export function ExportCenterPanel({ episode, episodes, timeline, exportBundle, projectExportSummary, exportHistory, exportPresetCenter, activeExportPreset, onExportFile, onExportCover, onRenderVideo, onQueueRender, onQueueBatchRender, onRenderPreset, onQueuePreset, onQueueBatchPreset, onSelectExportPreset, onPatchExportPreset, onOpenExportPresetCenter, onQueueEpisodeRender, onRetryExportJobs, onRequeueHistoryItem, onRequeueHistoryItems, onClose, exportBaseName }) {
  const [message, setMessage] = useState("");
  const [deliverySummary, setDeliverySummary] = useState(null);
  const [historyFilter, setHistoryFilter] = useState("全部");
  const qualityCheck = exportBundle.qualityCheck || {};
  const readyEpisodes = (projectExportSummary || []).filter((item) => item.ready);
  const blockedEpisodes = (projectExportSummary || []).filter((item) => !item.ready);
  const currentBundleVariants = [
    { key: "16:9", label: "横版", options: { aspectRatio: "16:9" }, enabled: qualityCheck.readyToRender },
    { key: "9:16", label: "竖版", options: { aspectRatio: "9:16" }, enabled: qualityCheck.readyToRender },
  ].filter((item) => item.enabled);
  const failedHistoryItems = (exportHistory || []).filter((item) => item.status === "failed");
  const failedHistoryCount = failedHistoryItems.length;
  const replayableHistoryItems = (exportHistory || []).filter((item) => item.renderOptions && item.episodeId);
  const visibleHistory = (exportHistory || []).filter((item) => {
    if (historyFilter === "全部") return true;
    if (historyFilter === "失败") return item.status === "failed";
    if (historyFilter === "可重试") return Boolean(item.renderOptions && item.episodeId);
    if (historyFilter === "成功") return item.status === "done";
    return true;
  });

  async function runExport(kind) {
    try {
      if (kind === "md") await onExportFile(`${exportBaseName}.md`, "md", exportBundle.markdown);
      if (kind === "json") await onExportFile(`${exportBaseName}.json`, "json", exportBundle.manifest);
      if (kind === "landscape") await onExportFile(`${exportBaseName}-16x9.json`, "json", exportBundle.landscapeManifest);
      if (kind === "portrait") await onExportFile(`${exportBaseName}-9x16.json`, "json", exportBundle.portraitManifest);
      if (kind === "archive") await onExportFile(`${exportBaseName}-archive.json`, "json", exportBundle.archiveBundle);
      if (kind === "all") {
        await onExportFile(`${exportBaseName}.md`, "md", exportBundle.markdown);
        await onExportFile(`${exportBaseName}.json`, "json", exportBundle.manifest);
        await onExportFile(`${exportBaseName}-16x9.json`, "json", exportBundle.landscapeManifest);
        await onExportFile(`${exportBaseName}-9x16.json`, "json", exportBundle.portraitManifest);
        await onExportFile(`${exportBaseName}-archive.json`, "json", exportBundle.archiveBundle);
      }
      setMessage("导出完成");
    } catch (error) {
      setMessage(String(error));
    }
  }

  async function runRenderVideo(options = {}) {
    try {
      await onRenderVideo?.(options);
      const label = options.aspectRatio === "9:16" ? "竖版成片" : "横版成片";
      setMessage(`${label}导出完成`);
    } catch (error) {
      setMessage(String(error));
    }
  }

  async function queueRenderVideo(options = {}) {
    try {
      await onQueueRender?.(options);
      const label = options.aspectRatio === "9:16" ? "竖版成片" : "横版成片";
      setMessage(`${label}已加入任务队列`);
    } catch (error) {
      setMessage(String(error));
    }
  }

  async function queueBatchRenderVideo(options = {}) {
    try {
      await onQueueBatchRender?.(options);
      const label = options.aspectRatio === "9:16" ? "全项目竖版成片" : "全项目横版成片";
      setMessage(`${label}已加入任务队列`);
    } catch (error) {
      setMessage(String(error));
    }
  }

  async function runCurrentDeliveryBundle() {
    try {
      let queued = 0;
      for (const item of currentBundleVariants) {
        await onQueueRender?.(item.options);
        queued += 1;
      }
      setDeliverySummary({
        label: `${episode?.name || "当前集"} 交付套餐`,
        queued,
        episodes: 1,
        archiveExported: false,
      });
      setMessage(`当前集交付套餐已入队 ${queued} 个版本`);
    } catch (error) {
      setMessage(String(error));
    }
  }

  async function runProjectDeliveryBundle() {
    try {
      let queued = 0;
      for (const item of readyEpisodes) {
        await onQueueEpisodeRender?.(item.id, { aspectRatio: "16:9" });
        queued += 1;
        await onQueueEpisodeRender?.(item.id, { aspectRatio: "9:16" });
        queued += 1;
      }
      setDeliverySummary({
        label: "全项目交付套餐",
        queued,
        episodes: readyEpisodes.length,
        archiveExported: false,
      });
      setMessage(readyEpisodes.length ? `全项目可交付集已入队 ${queued} 个版本` : "当前没有可交付的集");
    } catch (error) {
      setMessage(String(error));
    }
  }

  async function runCurrentDeliveryDocs() {
    try {
      await runExport("all");
      setDeliverySummary({
        label: `${episode?.name || "当前集"} 资料包`,
        queued: 0,
        episodes: 1,
        archiveExported: true,
      });
      setMessage("当前集交付资料包已全部导出");
    } catch (error) {
      setMessage(String(error));
    }
  }

  return createPortal((
    <aside className="export-center-panel">
      <header>
        <div>
          <strong>成片导出</strong>
          <span>{episode?.name || "当前集"} · {timeline.clips.length} 个片段</span>
        </div>
        <button onClick={onClose}>关闭</button>
      </header>
      <div className="export-summary">
        <section><b>{timeline.clips.length}</b><span>时间线片段</span></section>
        <section><b>{exportBundle.durationText}</b><span>总时长</span></section>
        <section><b>{exportBundle.coverImage ? "有" : "无"}</b><span>封面图</span></section>
        <section><b>{exportBundle.aspectTargets.length}</b><span>发布版式</span></section>
        <section><b>{exportBundle.archiveCount}</b><span>归档条目</span></section>
        <section><b>{qualityCheck.averageShotScore || 0}</b><span>镜头均分</span></section>
        <section><b>{timeline.clips.filter((clip) => String(clip.approvalStatus || "待验收") === "已通过").length}/{timeline.clips.length}</b><span>时间线验收</span></section>
        <section><b>{qualityCheck.readyToRender ? "可导出" : "待补"}</b><span>交付门槛</span></section>
        <section><b>{readyEpisodes.length}</b><span>项目可交付集</span></section>
        <section><b>{failedHistoryCount}</b><span>失败导出</span></section>
      </div>
      <div className="export-delivery-grid">
        <section className="export-preset-box">
          <div className="export-preset-header">
            <strong>当前集交付套餐</strong>
            <div className="export-preset-header-actions">
              <span>{currentBundleVariants.length} 个版本</span>
            </div>
          </div>
          <p className="export-delivery-note">
            默认打包横版和竖版视频。资料包只保留 Markdown、JSON、横竖版清单和归档包。
          </p>
          <div className="export-delivery-pills">
            {currentBundleVariants.length
              ? currentBundleVariants.map((item) => <span key={item.key} className="pill pill-ok">{item.label}</span>)
              : <span className="pill timeline-pill-danger">当前集还没过导出门槛</span>}
          </div>
          <div className="export-preset-actions">
            <button className="primary" disabled={!qualityCheck.readyToRender} onClick={runCurrentDeliveryBundle}>当前集一键交付入队</button>
            <button onClick={runCurrentDeliveryDocs}>当前集资料包导出</button>
            <button disabled={!exportBundle.coverImage} onClick={() => onExportCover(exportBundle.coverImage, episode?.name || "episode")}>导出当前集封面</button>
          </div>
        </section>
        <section className="export-preset-box">
          <div className="export-preset-header">
            <strong>全项目交付套餐</strong>
            <div className="export-preset-header-actions">
              <span>可交付 {readyEpisodes.length} 集 / 阻塞 {blockedEpisodes.length} 集</span>
            </div>
          </div>
          <p className="export-delivery-note">
            只会处理已经达到交付门槛的集，避免把缺素材的内容误塞进导出队列。
          </p>
          <div className="export-delivery-pills">
            <span className="pill pill-ok">可交付 {readyEpisodes.length}</span>
            <span className={`pill ${blockedEpisodes.length ? "pill-warn" : "pill-ok"}`}>待补 {blockedEpisodes.length}</span>
            <span className={`pill ${failedHistoryCount ? "timeline-pill-danger" : "pill-ok"}`}>失败导出 {failedHistoryCount}</span>
          </div>
          <div className="export-preset-actions">
            <button className="primary" disabled={!readyEpisodes.length} onClick={runProjectDeliveryBundle}>全项目可交付集一键入队</button>
            <button onClick={() => onQueueBatchPreset?.()}>按当前预设全项目入队</button>
            <button onClick={() => queueBatchRenderVideo({ aspectRatio: "16:9" })}>全项目横版入队</button>
          </div>
        </section>
      </div>
      {deliverySummary ? (
        <div className="export-delivery-runbook">
          <section>
            <strong>最近一次交付动作</strong>
            <p>{deliverySummary.label}</p>
          </section>
          <section><b>{deliverySummary.episodes}</b><span>处理集数</span></section>
          <section><b>{deliverySummary.queued}</b><span>入队版本</span></section>
          <section><b>{deliverySummary.archiveExported ? "已导出" : "未导出"}</b><span>资料包</span></section>
        </div>
      ) : null}
      <div className="export-preset-box">
        <div className="export-preset-header">
          <strong>导出前检查</strong>
          <div className="export-preset-header-actions">
            <span>{qualityCheck.readyToRender ? "已通过" : "需处理"}</span>
          </div>
        </div>
        <div className="director-list">
          {qualityCheck.missingMediaClips?.length ? <section className="director-item"><strong>未挂素材片段</strong><p>{qualityCheck.missingMediaClips.join("、")}</p></section> : null}
          {qualityCheck.pendingApprovalClips?.length ? <section className="director-item"><strong>未通过时间线验收片段</strong><p>{qualityCheck.pendingApprovalClips.join("、")}</p></section> : null}
          {qualityCheck.unreviewedShots?.length ? <section className="director-item"><strong>未通过审稿镜头</strong><p>{qualityCheck.unreviewedShots.map((item) => `${item.id}(${item.reviewStatus})`).join("、")}</p></section> : null}
          {qualityCheck.weakShots?.length ? <section className="director-item"><strong>弱镜头</strong><p>{qualityCheck.weakShots.map((item) => `${item.id}(${item.score}分)`).join("、")}</p></section> : null}
          {!qualityCheck.missingMediaClips?.length && !qualityCheck.pendingApprovalClips?.length && !qualityCheck.unreviewedShots?.length && !qualityCheck.weakShots?.length ? <div className="asset-empty">当前导出前检查已通过。</div> : null}
        </div>
      </div>
      <div className="export-preset-box">
        <div className="export-preset-header">
          <strong>导出预设</strong>
          <div className="export-preset-header-actions">
            <span>{(exportPresetCenter?.presets || []).length} 套</span>
            <button onClick={() => onOpenExportPresetCenter?.()}>管理预设</button>
          </div>
        </div>
        <div className="export-preset-fields">
          <label>当前预设
            <select value={exportPresetCenter?.activePresetId || ""} onChange={(event) => onSelectExportPreset?.(event.target.value)}>
              {(exportPresetCenter?.presets || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>名称<input value={activeExportPreset?.name || ""} onChange={(event) => onPatchExportPreset?.({ name: event.target.value })} /></label>
          <label>宽度<input type="number" min="320" step="2" value={activeExportPreset?.width || 1920} onChange={(event) => onPatchExportPreset?.({ width: Number(event.target.value || 1920) })} /></label>
          <label>高度<input type="number" min="320" step="2" value={activeExportPreset?.height || 1080} onChange={(event) => onPatchExportPreset?.({ height: Number(event.target.value || 1080) })} /></label>
          <label>FPS<input type="number" min="12" max="60" value={activeExportPreset?.fps || 30} onChange={(event) => onPatchExportPreset?.({ fps: Number(event.target.value || 30) })} /></label>
          <label>编码预设
            <select value={activeExportPreset?.encodePreset || "veryfast"} onChange={(event) => onPatchExportPreset?.({ encodePreset: event.target.value })}>
              {["ultrafast", "superfast", "veryfast", "faster", "fast", "medium", "slow", "slower", "veryslow"].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>CRF<input type="number" min="12" max="35" value={activeExportPreset?.crf || 18} onChange={(event) => onPatchExportPreset?.({ crf: Number(event.target.value || 18) })} /></label>
        </div>
        <label>预设备注<textarea className="small-textarea" value={activeExportPreset?.note || ""} onChange={(event) => onPatchExportPreset?.({ note: event.target.value })} /></label>
        <div className="export-preset-actions">
          <button className="primary" disabled={!qualityCheck.readyToRender} onClick={() => onRenderPreset?.()}>按当前预设导出</button>
          <button disabled={!qualityCheck.readyToRender} onClick={() => onQueuePreset?.()}>按当前预设入队</button>
          <button onClick={() => onQueueBatchPreset?.()}>按当前预设全项目入队</button>
          <small>{activeExportPreset ? `${activeExportPreset.width}x${activeExportPreset.height} · ${activeExportPreset.fps}fps · ${activeExportPreset.encodePreset} · CRF ${activeExportPreset.crf}` : "未选择导出预设"}</small>
        </div>
      </div>
      <div className="export-actions">
        <button className="primary" disabled={!qualityCheck.readyToRender} onClick={() => runRenderVideo({ aspectRatio: "16:9" })}>导出 MP4 横版</button>
        <button className="primary" disabled={!qualityCheck.readyToRender} onClick={() => runRenderVideo({ aspectRatio: "9:16" })}>导出 MP4 竖版</button>
        <button disabled={!qualityCheck.readyToRender} onClick={() => queueRenderVideo({ aspectRatio: "16:9" })}>横版加入队列</button>
        <button disabled={!qualityCheck.readyToRender} onClick={() => queueRenderVideo({ aspectRatio: "9:16" })}>竖版加入队列</button>
        <button onClick={() => queueBatchRenderVideo({ aspectRatio: "16:9" })}>全项目横版加入队列</button>
        <button onClick={() => queueBatchRenderVideo({ aspectRatio: "9:16" })}>全项目竖版加入队列</button>
        <button onClick={() => runExport("md")}>导出 Markdown</button>
        <button onClick={() => runExport("json")}>导出 JSON</button>
        <button onClick={() => runExport("landscape")}>导出横版清单</button>
        <button onClick={() => runExport("portrait")}>导出竖版清单</button>
        <button onClick={() => runExport("archive")}>导出归档包</button>
        <button onClick={() => runExport("all")}>全部导出</button>
        <button disabled={!exportBundle.coverImage} onClick={() => onExportCover(exportBundle.coverImage, episode?.name || "episode")}>导出封面图</button>
      </div>
      <div className="export-meta-grid">
        <section className="export-project-list">
          <header>
            <strong>连续导出概览</strong>
            <span>{episodes?.length || 0} 集</span>
          </header>
          <div className="export-project-items">
            {(projectExportSummary || []).map((item) => (
              <article key={item.id} className={`export-project-item ${item.ready ? "ready" : "empty"}`}>
                <div>
                  <strong>{item.name}</strong>
                  <small>{item.readyClips}/{item.clipCount} 片段可导出 · 验收 {item.approvedClips || 0}/{item.clipCount} · {item.durationText}</small>
                  {item.deliveryIssues?.length ? <em>{item.deliveryIssues.join("；")}</em> : null}
                </div>
                <div className="export-project-actions">
                  <button disabled={!item.ready} onClick={() => onQueueEpisodeRender?.(item.id, { aspectRatio: "16:9" })}>横版入队</button>
                  <button disabled={!item.ready} onClick={() => onQueueEpisodeRender?.(item.id, { aspectRatio: "9:16" })}>竖版入队</button>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="export-history-panel">
          <header>
            <strong>导出历史</strong>
            <span>{(exportHistory || []).length} 条</span>
          </header>
          <div className="export-history-toolbar">
            <div className="asset-drawer-tabs">
              {["全部", "失败", "可重试", "成功"].map((item) => (
                <button key={item} className={historyFilter === item ? "active" : ""} onClick={() => setHistoryFilter(item)}>{item}</button>
              ))}
            </div>
            <div className="export-project-actions">
              <button disabled={!failedHistoryCount} onClick={() => onRetryExportJobs?.("failed")}>重跑失败导出</button>
              <button disabled={!failedHistoryCount} onClick={() => onRequeueHistoryItems?.(failedHistoryItems.map((item) => item.id))}>失败历史重入队</button>
              <button disabled={!replayableHistoryItems.length} onClick={() => onRequeueHistoryItems?.(replayableHistoryItems.map((item) => item.id))}>全部可重试重入队</button>
            </div>
          </div>
          <div className="export-history-list">
            {visibleHistory.slice(0, 20).map((item) => (
              <article key={item.id} className={`export-history-item status-${item.status}`}>
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.episodeName || "项目"} · {item.detail || item.type} · {new Date(item.updatedAt || Date.now()).toLocaleString()}</small>
                  {item.path ? <em>{item.path}</em> : null}
                </div>
                <div className="export-project-actions">
                  {item.status === "failed" ? <span className="pill timeline-pill-danger">失败</span> : <span className="pill pill-ok">完成</span>}
                  {item.renderOptions ? <button onClick={() => onRequeueHistoryItem?.(item.id)}>再次入队</button> : null}
                </div>
              </article>
            ))}
            {!visibleHistory.length && <div className="asset-empty">当前筛选下没有导出历史。</div>}
          </div>
        </section>
      </div>
      <div className="export-preview-grid">
        <label>时间线 Markdown<textarea readOnly value={exportBundle.markdown} /></label>
      </div>
      <div className="export-preview-grid">
        <label>成片 JSON 清单<textarea readOnly value={exportBundle.manifest} /></label>
      </div>
      <div className="export-preview-grid">
        <label>横版发布清单<textarea readOnly value={exportBundle.landscapeManifest} /></label>
        <label>竖版发布清单<textarea readOnly value={exportBundle.portraitManifest} /></label>
      </div>
      <label>项目归档包<textarea readOnly value={exportBundle.archiveBundle} /></label>
      {message && <small className="result-message">{message}</small>}
    </aside>
  ), document.body);
}
