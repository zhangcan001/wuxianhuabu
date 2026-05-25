import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { buildQueueFailureDetails } from "../domain/queue-diagnostics.js";

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

