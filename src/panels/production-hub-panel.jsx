import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";

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

