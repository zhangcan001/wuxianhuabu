import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";

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

