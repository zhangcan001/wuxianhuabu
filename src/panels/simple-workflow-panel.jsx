import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

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

