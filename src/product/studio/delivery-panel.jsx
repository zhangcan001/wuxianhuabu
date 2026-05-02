import React, { useState } from "react";
import {
  normalizeTimelineRows,
} from "./production-selectors.js";
import {
  formatBytesCompact,
} from "./studio-panel-primitives.jsx";

export function DeliveryPanel({ shots = [], assets = [], timeline = {}, exportHistory = [], queue = [], consistencyReport = null, migrationReport = null, deliveryManifestReport = null, multiEpisodeDeliverySummary = null, mediaCacheReport = null, desktopUploadChecklist = null, enhancedDeliveryGate = null, riskReport = null, stats = {}, progress = 0, actions = {} }) {
  const [format, setFormat] = useState("mp4");
  const [platform, setPlatform] = useState("douyin");
  const [oldRoot, setOldRoot] = useState("");
  const [newRoot, setNewRoot] = useState("");
  const [selectedExport, setSelectedExport] = useState(null);
  const missingImages = shots.filter((shot) => !shot.hasImage).length;
  const missingVideos = shots.filter((shot) => !shot.hasVideo).length;
  const missingAssets = assets.filter((asset) => !asset.hasImage).length;
  const reviewBlocked = shots.filter((shot) => !["已通过", "搁置"].includes(shot.reviewStatus || "未审")).length;
  const timelineRows = normalizeTimelineRows(timeline, shots);
  const missingTimeline = timelineRows.length ? timelineRows.filter((clip) => !clip.ready).length : missingVideos;
  const ready = stats.total > 0 && !missingImages && !missingVideos && !missingTimeline && !reviewBlocked;
  const estimatedMinutes = Math.max(3, Math.ceil((stats.total || 0) * 1.8 + missingImages * 2 + missingVideos * 4));
  const checks = [
    { label: "文本方案", ok: stats.total > 0, detail: stats.total ? `${stats.total} 个镜头` : "缺少镜头表" },
    { label: "资产定妆", ok: !missingAssets, detail: missingAssets ? `${missingAssets} 个资产待定妆` : "资产无阻塞" },
    { label: "图片素材", ok: !missingImages && stats.total > 0, detail: missingImages ? `${missingImages} 张待补` : "图片齐备" },
    { label: "视频素材", ok: !missingVideos && stats.total > 0, detail: missingVideos ? `${missingVideos} 条待补` : "视频齐备" },
    { label: "时间线", ok: !missingTimeline && stats.total > 0, detail: missingTimeline ? `${missingTimeline} 条片段待挂素材` : "时间线可导出" },
    { label: "审片", ok: !reviewBlocked && stats.total > 0, detail: reviewBlocked ? `${reviewBlocked} 个镜头待通过` : "审片已通过" },
  ];
  const recentExports = (Array.isArray(exportHistory) ? exportHistory : []).slice(0, 4);
  const deliveryJobs = (Array.isArray(queue) ? queue : []).filter((job) => ["exportVideo", "exportPackage"].includes(job.kind) || job.type === "delivery.export").slice(0, 4);
  const actionLabel = format === "package" ? "打包工程" : format === "both" ? "成片 + 工程包" : "导出 MP4";
  return (
    <section className="workbench-panel delivery-work-panel">
      <div className="panel-title">
        <strong>交付</strong>
        <span>{ready ? "当前集已达到导出门槛" : "交付前需要清理素材阻塞"}</span>
      </div>
      <div className="delivery-scoreboard">
        <strong>{progress}%</strong>
        <span>{ready ? "可交付" : "生产中"}</span>
      </div>
      <div className="delivery-check-grid">
        {checks.map((item) => (
          <article key={item.label} className={item.ok ? "ok" : "warn"}>
            <strong>{item.label}</strong>
            <span>{item.detail}</span>
          </article>
        ))}
      </div>
      {multiEpisodeDeliverySummary?.total > 1 ? (
        <div className="delivery-history-list">
          <article className={multiEpisodeDeliverySummary.blocked ? "warn" : "ok"}>
            <strong>多集交付</strong>
            <span>{multiEpisodeDeliverySummary.ready}/{multiEpisodeDeliverySummary.total} 集可交付 · {multiEpisodeDeliverySummary.blocked} 集阻塞</span>
            <button type="button" disabled={!multiEpisodeDeliverySummary.ready} onClick={() => actions.queueMultiEpisodeDelivery?.({ format, platform })}>批量调度</button>
          </article>
        </div>
      ) : null}
      {mediaCacheReport ? (
        <div className="delivery-history-list">
          <article className={mediaCacheReport.orphanCount ? "warn" : "ok"}>
            <strong>媒体缓存</strong>
            <span>引用 {mediaCacheReport.referencedCount || 0} · 孤儿 {mediaCacheReport.orphanCount || 0} · 占用 {formatBytesCompact(mediaCacheReport.totalSize || 0)}</span>
            {mediaCacheReport.orphanCount ? <button type="button" onClick={actions.openDashboard}>清理缓存</button> : null}
          </article>
        </div>
      ) : null}
      {desktopUploadChecklist ? (
        <div className="delivery-history-list">
          <article>
            <strong>桌面上传持久化</strong>
            <span>{desktopUploadChecklist.items?.filter((item) => item.done).length || 0}/{desktopUploadChecklist.total || 0} 项已具备证据</span>
            {(desktopUploadChecklist.items || []).slice(0, 3).map((item) => <small key={item.key}>{item.done ? "已检查" : "待验证"} · {item.label}</small>)}
          </article>
        </div>
      ) : null}
      {riskReport ? (
        <div className="delivery-history-list">
          <article className={riskReport.ok ? "ok" : "warn"}>
            <strong>致命风险总检</strong>
            <span>{riskReport.ok ? "主流程暂无致命阻塞" : `${riskReport.openCount} 项待处理，交付评分 ${riskReport.score}%`}</span>
          </article>
          {(riskReport.topRisks || []).slice(0, 3).map((item) => (
            <article key={item.key} className={item.severity === "critical" || item.severity === "high" ? "warn" : ""}>
              <strong>{item.title}</strong>
              <span>{item.detail} · {item.action}</span>
            </article>
          ))}
        </div>
      ) : null}
      <div className="delivery-options-grid">
        <label>
          <span>导出格式</span>
          <select value={format} onChange={(event) => setFormat(event.target.value)}>
            <option value="mp4">MP4 成片</option>
            <option value="package">工程包</option>
            <option value="both">成片 + 工程包</option>
          </select>
        </label>
        <label>
          <span>平台规格</span>
          <select value={platform} onChange={(event) => setPlatform(event.target.value)}>
            <option value="douyin">抖音 / 快手 9:16</option>
            <option value="bilibili">B 站 16:9</option>
            <option value="custom">自定义规格</option>
          </select>
        </label>
        <section>
          <strong>{estimatedMinutes} 分钟</strong>
          <span>预估整理耗时</span>
        </section>
        <section>
          <strong>{Math.max(0, missingImages + missingVideos + missingAssets + missingTimeline + reviewBlocked)}</strong>
          <span>交付阻塞项</span>
        </section>
      </div>
      <div className="panel-actions">
        <button className="primary" onClick={() => actions.openExport?.({ format, platform })} disabled={!ready}>{actionLabel}</button>
        <button onClick={actions.exportAssetsAndStoryboard} disabled={!assets.length && !shots.length}>导出资产+分镜</button>
        <button onClick={actions.openTimeline} disabled={!stats.videosReady}>检查时间线</button>
      </div>
      {consistencyReport && !consistencyReport.ok ? (
        <div className="delivery-history-list">
          <article className="warn">
            <strong>一致性检查</strong>
            <span>{consistencyReport.issues.slice(0, 3).join("；")}</span>
            <button type="button" onClick={actions.repairLegacyTimelineFromBusiness}>修复旧时间线</button>
            <button type="button" onClick={actions.repairBusinessTimelineFromLegacy}>修复商业时间线</button>
          </article>
        </div>
      ) : null}
      {deliveryManifestReport ? (
        <div className="delivery-history-list">
          <article className={deliveryManifestReport.ok ? "ok" : "warn"}>
            <strong>Manifest 校验</strong>
            <span>
              {deliveryManifestReport.ok
                ? `可复制素材 ${deliveryManifestReport.totals?.copyableMedia || 0}/${deliveryManifestReport.totals?.references || 0}`
                : deliveryManifestReport.issues?.slice(0, 2).join("；")}
              {deliveryManifestReport.warnings?.length ? ` · ${deliveryManifestReport.warnings.slice(0, 2).join("；")}` : ""}
            </span>
            {!deliveryManifestReport.ok || deliveryManifestReport.warnings?.length ? (
              <>
                <button type="button" onClick={actions.openDashboard}>定位素材问题</button>
                <button type="button" onClick={() => setOldRoot((value) => value || "D:\\old")}>准备重定位</button>
              </>
            ) : null}
          </article>
        </div>
      ) : null}
      {enhancedDeliveryGate ? (
        <div className="delivery-history-list">
          <article className={enhancedDeliveryGate.ok ? "ok" : "warn"}>
            <strong>成片门禁</strong>
            <span>
              {enhancedDeliveryGate.ok
                ? `可渲染 · 评分 ${enhancedDeliveryGate.score}%`
                : `阻塞 ${enhancedDeliveryGate.blockers?.length || 0} · 警告 ${enhancedDeliveryGate.warnings?.length || 0} · 评分 ${enhancedDeliveryGate.score}%`}
            </span>
            {!enhancedDeliveryGate.ok ? <button type="button" onClick={actions.syncTimelineFromShots}>同步时间线</button> : null}
          </article>
        </div>
      ) : null}
      {migrationReport ? (
        <div className="delivery-history-list">
          <article className={migrationReport.ok ? "ok" : "warn"}>
            <strong>迁移检查</strong>
            <span>{migrationReport.notes?.slice(0, 2).join("；") || "媒体路径可用"}</span>
          </article>
          <article>
            <strong>媒体路径重定位</strong>
            <span>将旧磁盘根目录替换为新根目录，并回写商业模型。</span>
            <input aria-label="旧媒体根目录" placeholder="旧目录，如 D:\\old" value={oldRoot} onChange={(event) => setOldRoot(event.target.value)} />
            <input aria-label="新媒体根目录" placeholder="新目录，如 E:\\project\\media" value={newRoot} onChange={(event) => setNewRoot(event.target.value)} />
            <button type="button" disabled={!oldRoot.trim() || !newRoot.trim()} onClick={() => actions.relocateMediaRoot?.(oldRoot, newRoot)}>执行重定位</button>
          </article>
        </div>
      ) : null}
      {deliveryJobs.length ? (
        <div className="delivery-history-list">
          {deliveryJobs.map((job) => (
            <article key={job.id || job.requestId || job.title}>
              <strong>{job.title || job.type || "交付任务"}</strong>
              <span>{job.status || "pending"} · {job.resultSummary || job.error || "等待队列处理"}</span>
              {job.status === "failed" ? <button type="button" onClick={() => actions.retryQueueJobs?.([job.id])}>重试</button> : null}
            </article>
          ))}
        </div>
      ) : null}
      {recentExports.length ? (
        <div className="delivery-history-list">
          {recentExports.map((item) => (
            <article key={item.requestId || item.id || item.title}>
              <strong>{item.title || item.type || "交付记录"}</strong>
              <span>{item.status || "pending"} · {item.detail || item.path || "等待处理"}</span>
              <button type="button" onClick={() => setSelectedExport(item)}>详情</button>
              {item.status === "interrupted" ? <button type="button" onClick={() => actions.openExport?.({ format, platform })}>重新入队</button> : null}
            </article>
          ))}
        </div>
      ) : null}
      {selectedExport ? (
        <div className="delivery-history-list">
          <article className="ok">
            <strong>导出详情</strong>
            <span>{selectedExport.title || selectedExport.type} · {selectedExport.status || "done"}</span>
            <span>{selectedExport.path || selectedExport.detail || "暂无输出路径"}</span>
            <span>{selectedExport.renderOptions ? `参数：${JSON.stringify(selectedExport.renderOptions)}` : "参数：工程包 / 清单导出"}</span>
            <button type="button" onClick={() => setSelectedExport(null)}>关闭</button>
          </article>
        </div>
      ) : null}
    </section>
  );
}
