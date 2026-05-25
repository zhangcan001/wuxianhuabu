import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ProjectInspector,
  ProjectSidebar,
  ProjectTopbar,
  ProjectWorkflowStepper,
} from "./project-chrome.jsx";
import {
  AssetLibraryPanel,
} from "./asset-library-panel.jsx";
import {
  DeliveryPanel,
} from "./delivery-panel.jsx";
import {
  MediaProductionPanel,
} from "./media-production-panel.jsx";
import {
  ReviewPanel,
} from "./review-panel.jsx";
import {
  ShotTablePanel,
} from "./shot-table-panel.jsx";
import {
  TimelinePanel,
} from "./timeline-panel.jsx";
import {
  normalizeAssetRows,
  normalizeShotRows,
  buildBusinessOptimizationBoard,
  summarizeMedia,
  viewSubtitle,
  viewTitle,
} from "./production-selectors.js";
import {
  buildRiskAutoFixPlan,
  executeRiskAction,
  executeRiskAutoFixPlan,
  riskActionLabel,
} from "./risk-action-helpers.js";
import {
  buildBusinessOptimizationExecutionPlan,
  businessOptimizationActionLabel,
  executeBusinessOptimizationAction,
  executeBusinessOptimizationPlan,
} from "./business-optimization-actions.js";

export function ProjectShell({
  title = "小说视频生产工作台",
  episodeTitle = "当前集",
  sourceText = "",
  setSourceText,
  stages = [],
  shots = [],
  assets = [],
  resources = [],
  timeline = {},
  exportHistory = [],
  consistencyReport = null,
  migrationReport = null,
  deliveryManifestReport = null,
  multiEpisodeDeliverySummary = null,
  mediaCacheReport = null,
  desktopUploadChecklist = null,
  providerHealthReport = null,
  queueOperationsBoard = null,
  enhancedDeliveryGate = null,
  riskReport = null,
  progress = 0,
  heroTitle = "",
  heroDetail = "",
  primaryAction = null,
  metrics = [],
  queueStatus = "",
  queue = [],
  nextActions = [],
  message = "",
  uploadReceipt = null,
  onDismissUploadReceipt,
  activeViewRequest = null,
  runningAction = "",
  running = false,
  actions = {},
  runStage,
  uploadShotImage,
  uploadShotVideo,
  uploadSpecificShotImage,
  uploadSpecificShotVideo,
  pickDesktopShotImage,
  pickDesktopShotVideo,
  uploadAssetImage,
}) {
  const [activeView, setActiveView] = useState("overview");
  const [imagePreview, setImagePreview] = useState(null);
  useEffect(() => {
    const requestedView = typeof activeViewRequest === "string" ? activeViewRequest : activeViewRequest?.view;
    if (!requestedView) return;
    if (["overview", "script", "shots", "assets", "media", "timeline", "review", "delivery"].includes(requestedView)) {
      setActiveView(requestedView);
    }
  }, [activeViewRequest]);
  useEffect(() => {
    if (!imagePreview) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setImagePreview(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [imagePreview]);
  const activeStage = stages.find((stage) => stage.active) || stages.find((stage) => !stage.done) || stages[0] || {};
  const completedStages = stages.filter((stage) => stage.done).length;
  const visibleMetrics = useMemo(() => metrics.filter((item) => item && item.label), [metrics]);
  const shotRows = useMemo(() => normalizeShotRows(shots), [shots]);
  const assetRows = useMemo(() => normalizeAssetRows(assets), [assets]);
  const taskIndex = useMemo(() => buildWorkbenchTaskIndex(queue), [queue]);
  const studioActions = useMemo(() => ({
    ...actions,
    openImagePreview: (input) => {
      const payload = typeof input === "string" ? { url: input } : input || {};
      const url = payload.fullUrl || payload.url || payload.imageUrl || payload.src || "";
      if (!url) return;
      setImagePreview({
        url,
        fallbackUrl: payload.fallbackUrl || payload.previewUrl || payload.thumbnailUrl || "",
        title: payload.title || "点击空白处关闭高清预览",
      });
    },
    navigateView: (view) => {
      if (typeof view === "string" && view) setActiveView(view);
    },
  }), [actions]);
  const mediaStats = useMemo(() => summarizeMedia(shotRows), [shotRows]);
  const workflowProgress = useMemo(() => ({
    script: Boolean(String(sourceText || "").trim()),
    shots: shotRows.length > 0,
    media: shotRows.some((shot) => shot.imageUrl || shot.videoUrl),
    timeline: Array.isArray(timeline?.clips) && timeline.clips.length > 0,
    delivery: Array.isArray(exportHistory) && exportHistory.length > 0,
  }), [sourceText, shotRows, timeline, exportHistory]);
  const businessOptimizationBoard = useMemo(() => buildBusinessOptimizationBoard({
    sourceText,
    shots: shotRows,
    assets: assetRows,
    timeline,
    queue,
    exportHistory,
    providerHealthReport,
    riskReport,
    multiEpisodeDeliverySummary,
  }), [sourceText, shotRows, assetRows, timeline, queue, exportHistory, providerHealthReport, riskReport, multiEpisodeDeliverySummary]);
  const featuredShot = shotRows.find((shot) => shot.imageUrl) || shotRows[0] || null;
  const runPrimaryAction = () => {
    const key = primaryAction?.key;
    if (key === "script") return setActiveView("script");
    if (key === "text") return runStage?.(stages.find((stage) => stage.key === "text"));
    if (key === "image") return studioActions.generateImages?.();
    if (key === "video") return studioActions.generateVideos?.();
    if (key === "syncTimeline") return studioActions.syncTimelineFromShots?.();
    if (key === "review") return studioActions.runReview?.();
    if (key === "delivery") return studioActions.openExport?.();
    if (key === "repairAssetConsistency") return studioActions.repairAssetConsistency?.();
    return null;
  };

  return (
    <section
      className="product-shell"
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
    >
      <ProjectTopbar title={title} episodeTitle={episodeTitle} running={running} actions={studioActions} />
      <ProjectWorkflowStepper activeView={activeView} progress={workflowProgress} onNavigate={setActiveView} />
      <ProjectSidebar activeView={activeView} setActiveView={setActiveView} actions={studioActions} />

      <main className="product-workbench">
        <section className="workbench-head">
          <div>
            <span className="workbench-kicker">当前阶段</span>
            <h1>{heroTitle || activeStage.title || "准备生产"}</h1>
            <p>{heroDetail || activeStage.detail || "按生产线推进文本、图片、视频、审片和交付。"}</p>
            {primaryAction ? (
              <button type="button" className="workbench-primary-action" disabled={primaryAction.disabled} onClick={runPrimaryAction}>
                <strong>{primaryAction.label}</strong>
                <span>{primaryAction.detail}</span>
              </button>
            ) : null}
          </div>
          <figure className="workbench-visual">
            {featuredShot?.imageUrl ? (
              <button
                type="button"
                className="image-preview-trigger"
                onClick={() => studioActions.openImagePreview?.({
                  url: featuredShot.imageUrl,
                  thumbnailUrl: featuredShot.imageThumbnailUrl || featuredShot.previewUrl || "",
                  title: `${featuredShot.id || "镜头"} · ${featuredShot.title || featuredShot.scene || "高清大图"}`,
                })}
                title="查看高清大图"
              >
                <img src={featuredShot.imageThumbnailUrl || featuredShot.previewUrl || featuredShot.imageUrl} alt="" />
              </button>
            ) : (
              <img src="/assets/studio-production.jpg" alt="" />
            )}
            <figcaption>
              <strong>{featuredShot?.title || featuredShot?.scene || "Production Preview"}</strong>
              <span>{featuredShot?.hasVideo ? "视频素材已就绪" : featuredShot?.hasImage ? "首帧图已就绪" : "制作现场预览"}</span>
            </figcaption>
          </figure>
          <div className="workbench-progress">
            <strong>{progress}%</strong>
            <span>{completedStages}/{stages.length || 4} 阶段</span>
          </div>
        </section>

        <section className="production-actions">
          {stages.map((stage) => (
            <button
              key={stage.key}
              className={stage.active ? "primary" : stage.done ? "done" : ""}
              disabled={stage.disabled}
              onClick={() => runStage?.(stage)}
            >
              <span>{stage.title}</span>
              <small>{runningAction === stage.key ? "执行中" : stage.stat}</small>
            </button>
          ))}
        </section>

        {message ? <p className={running ? "workbench-message is-running" : "workbench-message"}>{message}</p> : null}
        {uploadReceipt ? (
          <section className="upload-receipt">
            <div>
              <strong>{uploadReceipt.title || "上传成功"}</strong>
              <span>{uploadReceipt.detail || "素材已经写入当前项目。"}</span>
            </div>
            {uploadReceipt.previewUrl ? (
              uploadReceipt.kind === "video"
                ? <video src={uploadReceipt.previewUrl} muted playsInline controls />
                : <img src={uploadReceipt.previewUrl} alt="" />
            ) : null}
            <button type="button" onClick={onDismissUploadReceipt}>知道了</button>
          </section>
        ) : null}

        {activeView === "script" ? (
          <section className="workbench-panel script-panel">
            <div className="panel-title">
              <strong>小说 / 剧情梗概</strong>
              <span>输入文本后生成可生产剧本、资产和镜头表</span>
            </div>
            <textarea
              value={sourceText}
              onChange={(event) => setSourceText?.(event.target.value)}
              placeholder="把小说、剧情梗概或已有剧本粘贴到这里。"
            />
            <div className="panel-actions">
              <button className="primary" disabled={stages[0]?.disabled} onClick={() => runStage?.(stages[0])}>
                {runningAction === "text" ? "生成中" : "生成文本方案"}
              </button>
              <button onClick={studioActions.openPromptFactory}>编辑提示词</button>
            </div>
          </section>
        ) : activeView === "shots" ? (
          <ShotTablePanel
            shots={shotRows}
            actions={studioActions}
            running={running}
            runningAction={runningAction}
            taskIndex={taskIndex}
            uploadShotImage={uploadSpecificShotImage}
            uploadShotVideo={uploadSpecificShotVideo}
            pickDesktopShotImage={pickDesktopShotImage}
            pickDesktopShotVideo={pickDesktopShotVideo}
          />
        ) : activeView === "media" ? (
          <MediaProductionPanel
            shots={shotRows}
            running={running}
            runningAction={runningAction}
            taskIndex={taskIndex}
            actions={studioActions}
            uploadShotImage={uploadShotImage}
            uploadShotVideo={uploadShotVideo}
            pickDesktopShotImage={pickDesktopShotImage}
            pickDesktopShotVideo={pickDesktopShotVideo}
          />
        ) : activeView === "assets" ? (
          <AssetLibraryPanel assets={assetRows} resources={resources} actions={studioActions} running={running} runningAction={runningAction} taskIndex={taskIndex} uploadAssetImage={uploadAssetImage} />
        ) : activeView === "timeline" ? (
          <TimelinePanel shots={shotRows} timeline={timeline} stats={mediaStats} actions={studioActions} />
        ) : activeView === "review" ? (
          <ReviewPanel shots={shotRows} stats={mediaStats} actions={studioActions} running={running} />
        ) : activeView === "delivery" ? (
          <DeliveryPanel shots={shotRows} assets={assetRows} timeline={timeline} exportHistory={exportHistory} queue={queue} consistencyReport={consistencyReport} migrationReport={migrationReport} deliveryManifestReport={deliveryManifestReport} multiEpisodeDeliverySummary={multiEpisodeDeliverySummary} mediaCacheReport={mediaCacheReport} desktopUploadChecklist={desktopUploadChecklist} enhancedDeliveryGate={enhancedDeliveryGate} riskReport={riskReport} stats={mediaStats} progress={progress} actions={studioActions} />
        ) : (
          <section className="workbench-panel">
            <div className="panel-title">
              <strong>{viewTitle(activeView)}</strong>
              <span>{viewSubtitle(activeView)}</span>
            </div>
            <ProductionRiskPanel riskReport={riskReport} actions={studioActions} />
            <BusinessOptimizationPanel board={businessOptimizationBoard} actions={studioActions} setActiveView={setActiveView} />
            <div className="shot-table">
              {stages.map((stage, index) => (
                <article key={stage.key} className={stage.done ? "done" : stage.active ? "active" : ""}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{stage.title}</strong>
                    <p>{stage.detail}</p>
                  </div>
                  <em>{stage.stat}</em>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>

      <ProjectInspector
        visibleMetrics={visibleMetrics}
        queueStatus={queueStatus}
        nextActions={nextActions}
        businessOptimizationBoard={businessOptimizationBoard}
        riskReport={riskReport}
        providerHealthReport={providerHealthReport}
        queueOperationsBoard={queueOperationsBoard}
        message={message}
        running={running}
        actions={studioActions}
        uploadShotImage={uploadShotImage}
        uploadShotVideo={uploadShotVideo}
      />
      {imagePreview && typeof document !== "undefined" ? createPortal(
        <div className="result-lightbox-backdrop" onClick={() => setImagePreview(null)}>
          <div className="result-lightbox-panel" onClick={(event) => event.stopPropagation()}>
            <img
              src={imagePreview.url}
              alt=""
              onError={() => {
                if (imagePreview.fallbackUrl && imagePreview.fallbackUrl !== imagePreview.url) {
                  setImagePreview((current) => current ? { ...current, url: current.fallbackUrl, fallbackUrl: "" } : null);
                  return;
                }
                setImagePreview(null);
              }}
            />
            <small>{imagePreview.title}</small>
          </div>
        </div>,
        document.body,
      ) : null}
    </section>
  );
}

function ProductionRiskPanel({ riskReport = null, actions = {} }) {
  const [autoFixResult, setAutoFixResult] = useState(null);
  const [fixHistory, setFixHistory] = useState([]);
  if (!riskReport) return null;
  const topRisks = riskReport.topRisks?.length ? riskReport.topRisks : riskReport.items?.filter((item) => !item.ok).slice(0, 5) || [];
  const runRiskAction = (item) => executeRiskAction(item, actions);
  const autoFixPlan = buildRiskAutoFixPlan(riskReport);
  async function runAutoFix() {
    const result = await executeRiskAutoFixPlan(riskReport, actions);
    setAutoFixResult(result);
    setFixHistory((current) => [{
      at: new Date().toLocaleTimeString(),
      beforeScore: riskReport.score,
      summary: result.summary,
      ok: result.ok,
    }, ...current].slice(0, 3));
  }
  return (
    <section className={riskReport.ok ? "production-risk-panel is-ok" : "production-risk-panel"}>
      <div>
        <strong>交付风险 {riskReport.score}%</strong>
        <span>{riskReport.ok ? "主流程暂无致命阻塞" : `${riskReport.openCount} 项待处理 · 严重 ${riskReport.criticalCount} · 高风险 ${riskReport.highCount}`}</span>
      </div>
      <div className="production-risk-list">
        {topRisks.length ? topRisks.map((item) => (
          <article key={item.key} className={`severity-${item.severity}`}>
            <b>{item.title}</b>
            <span>{item.detail}</span>
            <small>{item.action}</small>
            <button type="button" onClick={() => runRiskAction(item)}>{riskActionLabel(item)}</button>
          </article>
        )) : <article className="severity-info"><b>主链闭环</b><span>文本、图片、视频、时间线和交付检查已连通。</span><small>继续归档真实生产事件。</small></article>}
      </div>
      <div className="panel-actions">
        <button type="button" className="primary" disabled={!autoFixPlan.length} onClick={runAutoFix}>
          自动处理最高风险
        </button>
        <button type="button" onClick={actions.openDashboard}>打开总控台</button>
        <button type="button" onClick={actions.openQueue}>处理队列</button>
        <button type="button" onClick={actions.openExport}>交付检查</button>
      </div>
      {autoFixResult ? (
        <div className={autoFixResult.ok ? "risk-fix-result is-ok" : "risk-fix-result"}>
          <strong>{autoFixResult.summary} · {autoFixResult.beforeScore}% 到 {autoFixResult.afterScore}%</strong>
          <div>
            {autoFixResult.results.map((item) => (
              <span key={`${item.key}-${item.actionKind}`} className={item.ok ? "ok" : "failed"}>
                {riskActionLabel(item)}：{item.ok ? "完成" : item.error || "失败"}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {fixHistory.length ? (
        <div className="risk-fix-history">
          {fixHistory.map((entry, index) => (
            <span key={`${entry.at}-${index}`}>{entry.at} · {entry.summary} · 修复前 {entry.beforeScore}%</span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function BusinessOptimizationPanel({ board = null, actions = {}, setActiveView }) {
  const [selectedKey, setSelectedKey] = useState("");
  const [executionResult, setExecutionResult] = useState(null);
  const [executing, setExecuting] = useState(false);
  if (!board?.items?.length) return null;
  const selectedItem = board.items.find((item) => item.key === selectedKey) || board.topItems?.[0] || board.items.find((item) => item.status !== "done") || board.items[0];
  const executionPlan = buildBusinessOptimizationExecutionPlan(board, { limit: 5 });
  const runAction = async (item) => {
    await executeBusinessOptimizationAction(item, actions, { setActiveView });
  };
  const runPlan = async () => {
    if (executing) return;
    setExecuting(true);
    try {
      setExecutionResult(await executeBusinessOptimizationPlan(board, actions, { setActiveView, limit: 5 }));
    } finally {
      setExecuting(false);
    }
  };
  return (
    <section className="business-optimization-panel">
      <div className="panel-title-row">
        <div className="panel-title">
          <strong>业务优化看板</strong>
          <span>20 项生产体验优化 · 已完成 {board.done}/20 · 待执行 {executionPlan.length} 项 · 成熟度 {board.score}%</span>
        </div>
        <button type="button" onClick={runPlan} disabled={!executionPlan.length || executing}>
          {executing ? "执行中" : "按顺序执行"}
        </button>
      </div>
      {executionPlan.length ? (
        <div className="business-optimization-steps">
          {executionPlan.map((item) => (
            <span key={`${item.step}-${item.key}`}>{item.step}. {item.title} · {businessOptimizationActionLabel(item)}</span>
          ))}
        </div>
      ) : null}
      {executionResult ? (
        <div className={executionResult.ok ? "risk-fix-result is-ok" : "risk-fix-result"}>
          <strong>{executionResult.summary}</strong>
          {(executionResult.results || []).map((item) => (
            <span key={item.key}>{item.title}：{item.ok ? "完成" : item.error || "失败"}</span>
          ))}
        </div>
      ) : null}
      <div className="business-optimization-grid">
        {board.items.map((item, index) => (
          <article
            key={item.key}
            className={`status-${item.status} severity-${item.severity} ${selectedItem?.key === item.key ? "is-selected" : ""}`}
            onClick={() => setSelectedKey(item.key)}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <b>{item.title}</b>
              <small>{item.detail}</small>
              <em>{item.maturity} · {item.progress}%{item.blockers?.length ? ` · ${item.blockers[0]}` : ""}</em>
              <i style={{ "--progress": `${item.progress}%` }} />
            </div>
            <button type="button" disabled={item.status === "done" && !item.actionKey} onClick={(event) => {
              event.stopPropagation();
              runAction(item);
            }}>
              {item.status === "done" ? "查看" : businessOptimizationActionLabel(item)}
            </button>
          </article>
        ))}
      </div>
      {selectedItem ? (
        <section className={`business-optimization-detail status-${selectedItem.status}`}>
          <div>
            <strong>{selectedItem.title}</strong>
            <span>{selectedItem.maturity} · {selectedItem.progress}% · 成本 {selectedItem.estimate?.costLevel || "低"}</span>
          </div>
          <div className="business-detail-metrics">
            <span><b>{selectedItem.estimate?.tasks || 0}</b>预计任务</span>
            <span><b>{selectedItem.estimate?.minutes || 0}</b>预计分钟</span>
            <span><b>{selectedItem.blockers?.length || 0}</b>阻塞项</span>
          </div>
          {selectedItem.blockers?.length ? (
            <ul>
              {selectedItem.blockers.slice(0, 5).map((blocker) => <li key={blocker}>{blocker}</li>)}
            </ul>
          ) : <p>当前没有明确阻塞，可以继续打磨质量或进入下一步。</p>}
          {selectedItem.nextSteps?.length ? (
            <ol>
              {selectedItem.nextSteps.slice(0, 4).map((step) => <li key={step}>{step}</li>)}
            </ol>
          ) : null}
          <button type="button" className="primary" onClick={() => runAction(selectedItem)}>
            {selectedItem.status === "done" ? "查看相关页面" : businessOptimizationActionLabel(selectedItem)}
          </button>
        </section>
      ) : null}
    </section>
  );
}

function buildWorkbenchTaskIndex(queue = []) {
  const index = {
    shots: {},
    assets: {},
  };
  (Array.isArray(queue) ? queue : []).forEach((job) => {
    const status = String(job.status || "");
    if (!["pending", "running", "failed"].includes(status)) return;
    const targetType = job.targetType || (job.sourceAssetToken || job.assetCategory ? "asset" : "shot");
    const targetId = String(job.targetId || job.shotId || job.sourceAssetToken || job.sourceAssetName || "").trim();
    if (!targetId) return;
    const bucket = targetType === "asset" ? index.assets : index.shots;
    const current = bucket[targetId] || { pending: 0, running: 0, failed: 0, jobs: [] };
    current[status] = (current[status] || 0) + 1;
    current.jobs = [...current.jobs, job].slice(-3);
    bucket[targetId] = current;
  });
  return index;
}
