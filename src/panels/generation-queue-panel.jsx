import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { buildQueueFailureDetails } from "../domain/queue-diagnostics.js";

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

