import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";

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

