import React, { useEffect, useRef, useState } from "react";

const productionViews = [
  ["overview", "总览"],
  ["assets", "资产库"],
  ["review", "审片"],
];

const workflowSteps = [
  { key: "script", label: "写小说", hint: "粘贴或生成文本方案" },
  { key: "shots", label: "生分镜", hint: "解析为镜头表" },
  { key: "media", label: "出图出视频", hint: "批量生成媒体" },
  { key: "timeline", label: "时间线", hint: "装配镜头" },
  { key: "delivery", label: "交付", hint: "导出成片" },
];

const advancedActions = [
  ["openAdvancedCanvas", "兼容画布"],
  ["openPromptFactory", "Prompt 工厂"],
  ["openSettings", "API 设置"],
  ["openDashboard", "总控台"],
];

export function ProjectTopbar({
  title = "",
  episodeTitle = "",
  running = false,
  actions = {},
  episodes = [],
  activeEpisodeId = "",
  onEpisodeChange,
  onCreateEpisode,
  workspaces = [],
  activeWorkspaceId = "",
  onWorkspaceChange,
  queueCounts = null,
  onSmartContinue,
  smartContinueHint = "",
}) {
  const channel = import.meta.env.DEV ? "开发版" : import.meta.env.VITE_APP_CHANNEL;
  const version = import.meta.env.VITE_APP_VERSION;
  const hasEpisodes = Array.isArray(episodes) && episodes.length > 0;
  const hasWorkspaces = Array.isArray(workspaces) && workspaces.length > 0;
  const imageQueue = queueCounts?.image || 0;
  const videoQueue = queueCounts?.video || 0;
  return (
    <header className="product-topbar">
      <div className="product-brand">
        <div className="product-brand-title">
          <strong>{title}</strong>
          <span className={import.meta.env.DEV ? "app-version-badge is-dev" : "app-version-badge"}>
            {channel} v{version}
          </span>
        </div>
        <span>Production OS</span>
      </div>
      <div className="product-topbar-context">
        {hasEpisodes ? (
          <div className="topbar-segment" title="当前集">
            <select
              className="topbar-episode-select"
              value={activeEpisodeId}
              onChange={(event) => onEpisodeChange?.(event.target.value)}
            >
              {episodes.map((episode) => (
                <option key={episode.id} value={episode.id}>{episode.name}</option>
              ))}
            </select>
            {onCreateEpisode ? (
              <button type="button" className="topbar-icon-btn" onClick={onCreateEpisode} title="新建集">＋</button>
            ) : null}
          </div>
        ) : null}
        {hasWorkspaces ? (
          <div className="topbar-segment" title="工作配置">
            <select
              className="topbar-workspace-select"
              value={activeWorkspaceId || ""}
              onChange={(event) => onWorkspaceChange?.(event.target.value)}
            >
              <option value="">工作配置 · 临时</option>
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
              ))}
            </select>
          </div>
        ) : null}
        {queueCounts ? (
          <button
            type="button"
            className="topbar-queue-pill"
            onClick={actions.openQueue}
            title="打开生成队列"
          >
            队列 <b>{imageQueue + videoQueue}</b>
            <span className="topbar-queue-breakdown">图 {imageQueue} · 视 {videoQueue}</span>
          </button>
        ) : null}
      </div>
      <div className="product-topbar-actions">
        {onSmartContinue ? (
          <button
            type="button"
            className="primary topbar-smart-continue"
            onClick={onSmartContinue}
            title={smartContinueHint || "按当前生产进度推进下一步"}
            disabled={running}
          >
            智能继续
          </button>
        ) : null}
        <button onClick={actions.openProject}>打开工程</button>
        <button onClick={actions.saveProject}>保存工程</button>
        {running ? <button type="button" className="danger" onClick={actions.stopQueue}>停止生成</button> : null}
        <button className="primary" onClick={actions.openExport}>交付导出</button>
      </div>
    </header>
  );
}

export function ProjectWorkflowStepper({ activeView = "overview", progress = {}, onNavigate }) {
  const stepCount = workflowSteps.length;
  const completedCount = workflowSteps.reduce((count, step) => count + (progress[step.key] ? 1 : 0), 0);
  return (
    <nav className="workflow-stepper" aria-label="生产流程">
      <ol>
        {workflowSteps.map((step, index) => {
          const done = Boolean(progress[step.key]);
          const isActive = activeView === step.key;
          const reachable = done || isActive || index === 0 || progress[workflowSteps[index - 1]?.key];
          const className = [
            "workflow-step",
            done ? "is-done" : "",
            isActive ? "is-active" : "",
            reachable ? "" : "is-locked",
          ].filter(Boolean).join(" ");
          return (
            <li key={step.key}>
              <button
                type="button"
                className={className}
                onClick={() => onNavigate?.(step.key)}
                title={step.hint}
              >
                <span className="workflow-step-num" aria-hidden="true">{done ? "✓" : index + 1}</span>
                <span className="workflow-step-body">
                  <span className="workflow-step-label">{step.label}</span>
                  <span className="workflow-step-hint">{step.hint}</span>
                </span>
              </button>
              {index < stepCount - 1 ? <span className="workflow-step-sep" aria-hidden="true" /> : null}
            </li>
          );
        })}
      </ol>
      <span className="workflow-stepper-count">{completedCount}/{stepCount}</span>
    </nav>
  );
}

export function ProjectSidebar({ activeView = "overview", setActiveView, actions = {} }) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const advancedRef = useRef(null);
  useEffect(() => {
    if (!advancedOpen) return undefined;
    function handleClickAway(event) {
      if (!advancedRef.current) return;
      if (!advancedRef.current.contains(event.target)) {
        setAdvancedOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickAway);
    return () => document.removeEventListener("mousedown", handleClickAway);
  }, [advancedOpen]);
  return (
    <aside className="product-sidebar">
      <div className="sidebar-group">
        <span>生产</span>
        {productionViews.map(([key, label]) => (
          <button key={key} className={activeView === key ? "active" : ""} onClick={() => setActiveView?.(key)}>
            {label}
          </button>
        ))}
      </div>
      <div className="sidebar-group sidebar-group-advanced" ref={advancedRef}>
        <span>高级</span>
        <button
          type="button"
          className={`sidebar-advanced-trigger${advancedOpen ? " is-open" : ""}`}
          onClick={() => setAdvancedOpen((value) => !value)}
          aria-expanded={advancedOpen}
          aria-haspopup="menu"
        >
          更多工具 <span aria-hidden="true">⋯</span>
        </button>
        {advancedOpen ? (
          <div className="sidebar-advanced-menu" role="menu">
            {advancedActions.map(([action, label]) => (
              <button
                key={action}
                role="menuitem"
                onClick={() => {
                  setAdvancedOpen(false);
                  actions[action]?.();
                }}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export function ProjectInspector({
  visibleMetrics = [],
  queueStatus = "",
  nextActions = [],
  businessOptimizationBoard = null,
  riskReport = null,
  providerHealthReport = null,
  queueOperationsBoard = null,
  message = "",
  running = false,
  actions = {},
  uploadShotImage,
  uploadShotVideo,
}) {
  return (
    <aside className="product-inspector">
      <section>
        <div className="panel-title">
          <strong>运行状态</strong>
          <span>{queueStatus}</span>
        </div>
        <div className="inspector-metrics">
          {visibleMetrics.map((item) => (
            <div key={item.label}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="panel-title">
          <strong>已发现的阻塞 / 风险</strong>
          <span>{riskReport?.openCount ? `${riskReport.openCount} 项风险` : businessOptimizationBoard?.open ? `${businessOptimizationBoard.open} 项待优化` : running ? "处理中" : "无阻塞"}</span>
        </div>
        <div className="next-actions">
          {riskReport?.topRisks?.length ? riskReport.topRisks.slice(0, 4).map((item) => (
            <p key={item.key}>
              <b>{item.title}</b><br />{item.action}
            </p>
          )) : businessOptimizationBoard?.topItems?.length ? businessOptimizationBoard.topItems.slice(0, 4).map((item) => (
            <p key={item.key}><b>{item.title}</b><br />{item.action}<br /><small>{item.progress}% · {item.blockers?.[0] || item.detail}</small></p>
          )) : nextActions.length ? nextActions.slice(0, 4).map((item, index) => (
            <p key={`${item.label}-${index}`}>{item.label}</p>
          )) : <p>暂无阻塞，请使用 Topbar 的「智能继续」按钮推进。</p>}
        </div>
      </section>

      <section>
        <div className="panel-title">
          <strong>媒体入口</strong>
          <span>API / ComfyUI / 本地上传</span>
        </div>
        <div className="media-ingest-grid">
          <button onClick={actions.generateImages} disabled={running}>生成图片</button>
          <button onClick={actions.generateVideos} disabled={running}>生成视频</button>
          {running ? <button type="button" className="danger" onClick={actions.stopQueue}>停止生成</button> : null}
          <label className={running ? "is-disabled" : ""}>
            上传图片
            {!running ? <input hidden type="file" accept="image/*" onChange={uploadShotImage} /> : null}
          </label>
          <label className={running ? "is-disabled" : ""}>
            上传视频
            {!running ? <input hidden type="file" accept="video/*" onChange={uploadShotVideo} /> : null}
          </label>
        </div>
      </section>

      {providerHealthReport ? (
        <section>
          <div className="panel-title">
            <strong>模型服务体检</strong>
            <span>{providerHealthReport.ok ? "可用" : `${providerHealthReport.blockers?.length || 0} 项阻塞`}</span>
          </div>
          <div className="next-actions">
            {(providerHealthReport.checks || []).slice(0, 4).map((item) => (
              <p key={item.key}><b>{providerLabel(item.key)}</b><br />{item.message}</p>
            ))}
          </div>
          <div className="provider-health-actions">
            <button type="button" onClick={actions.openSettings}>打开 API 设置</button>
            <button type="button" onClick={actions.runSystemSelfCheck}>重新体检</button>
          </div>
        </section>
      ) : null}

      {queueOperationsBoard ? (
        <section>
          <div className="panel-title">
            <strong>队列调度</strong>
            <span>{queueOperationsBoard.failed ? `失败 ${queueOperationsBoard.failed}` : `待执行 ${queueOperationsBoard.pending || 0}`}</span>
          </div>
          <div className="inspector-metrics">
            <div><strong>{queueOperationsBoard.running || 0}</strong><span>运行中</span></div>
            <div><strong>{queueOperationsBoard.failed || 0}</strong><span>失败</span></div>
          </div>
          {queueOperationsBoard.failureDetails?.length ? (
            <div className="queue-failure-summary">
              {queueOperationsBoard.failureDetails.slice(0, 3).map((item) => (
                <p key={item.reason}>
                  <b>{item.label} · {item.count}</b><br />{item.detail}
                </p>
              ))}
            </div>
          ) : null}
          {queueOperationsBoard.failed ? <button type="button" onClick={actions.openQueue}>处理失败队列</button> : null}
        </section>
      ) : null}

      {message ? <p className="inspector-message">{message}</p> : null}
    </aside>
  );
}

function providerLabel(key = "") {
  const labels = {
    text: "文本",
    image: "图片",
    video: "视频",
    comfy: "ComfyUI",
    gemini: "Gemini",
    customImage: "自定义图片",
  };
  return labels[key] || key;
}
