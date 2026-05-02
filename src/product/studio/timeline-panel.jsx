import React from "react";
import {
  normalizeTimelineRows,
} from "./production-selectors.js";
import {
  EmptyPanel,
  StatusTile,
} from "./studio-panel-primitives.jsx";

export function TimelinePanel({ shots = [], timeline = {}, stats = {}, actions = {} }) {
  const readyShots = shots.filter((shot) => shot.hasVideo);
  const blockedShots = shots.filter((shot) => !shot.hasVideo);
  const timelineRows = normalizeTimelineRows(timeline, shots);
  const hasTimelineRows = timelineRows.length > 0;
  const readyTimelineRows = timelineRows.filter((clip) => clip.ready);
  const previewClip = readyTimelineRows.find((clip) => clip.mediaUrl || clip.videoUrl) || null;
  const stripRows = hasTimelineRows ? timelineRows : shots.map((shot, index) => ({
    id: shot.id,
    index,
    title: shot.title || shot.scene || shot.id,
    ready: shot.hasVideo,
    partial: shot.hasImage,
    status: shot.hasVideo ? "视频已就绪" : shot.hasImage ? "等待视频" : "等待首帧图",
  }));
  return (
    <section className="workbench-panel timeline-work-panel">
      <div className="panel-title">
        <strong>时间线</strong>
        <span>{hasTimelineRows ? `${readyTimelineRows.length}/${timelineRows.length} 条时间线片段已挂素材` : readyShots.length ? `${readyShots.length} 条视频可进入剪辑线` : "视频生成后会进入时间线装配"}</span>
      </div>
      <div className="production-status-grid">
        <StatusTile label={hasTimelineRows ? "时间线片段" : "镜头总数"} value={hasTimelineRows ? timelineRows.length : stats.total || 0} />
        <StatusTile label="图片就绪" value={`${stats.imagesReady || 0}/${stats.total || 0}`} tone={stats.imagesReady === stats.total && stats.total ? "ok" : "warn"} />
        <StatusTile label="视频就绪" value={`${stats.videosReady || 0}/${stats.total || 0}`} tone={stats.videosReady === stats.total && stats.total ? "ok" : "warn"} />
        <StatusTile label={hasTimelineRows ? "片段素材" : "可装配"} value={hasTimelineRows ? `${readyTimelineRows.length}/${timelineRows.length}` : readyShots.length} tone={(hasTimelineRows ? readyTimelineRows.length : readyShots.length) ? "ok" : "warn"} />
      </div>
      <div className="timeline-strip-board">
        {previewClip ? (
          <article className="ready timeline-preview-player">
            <strong>预览</strong>
            <div>
              <span>{previewClip.title || previewClip.shotId || previewClip.id}</span>
              <video src={previewClip.mediaUrl || previewClip.videoUrl} muted playsInline controls />
            </div>
          </article>
        ) : null}
        {stripRows.length ? stripRows.map((item, index) => (
          <article key={item.id || index} className={item.ready ? "ready" : item.partial ? "partial" : "blocked"}>
            <strong>{String(index + 1).padStart(2, "0")}</strong>
            <div>
              <span>{item.title || item.shotId || item.id}</span>
              <small>{item.status}{item.duration ? ` · ${item.duration}` : ""}</small>
            </div>
            {hasTimelineRows ? (
              <div className="timeline-clip-actions">
                <button type="button" disabled={index === 0} onClick={() => actions.moveTimelineClip?.(item, -1)}>上移</button>
                <button type="button" disabled={index === stripRows.length - 1} onClick={() => actions.moveTimelineClip?.(item, 1)}>下移</button>
                <input
                  aria-label="片段时长"
                  defaultValue={item.duration || "4秒"}
                  onBlur={(event) => actions.updateTimelineClipDuration?.(item, event.target.value)}
                />
                <input
                  aria-label="入点"
                  defaultValue={item.inPoint || "0s"}
                  onBlur={(event) => actions.updateTimelineClip?.(item, { inPoint: event.target.value })}
                />
                <input
                  aria-label="出点"
                  defaultValue={item.outPoint || ""}
                  placeholder="出点"
                  onBlur={(event) => actions.updateTimelineClip?.(item, { outPoint: event.target.value })}
                />
                <select
                  aria-label="转场"
                  defaultValue={item.transition || "直切"}
                  onChange={(event) => actions.updateTimelineClip?.(item, { transition: event.target.value })}
                >
                  <option value="直切">直切</option>
                  <option value="淡入淡出">淡入淡出</option>
                  <option value="叠化">叠化</option>
                  <option value="闪白">闪白</option>
                </select>
                <button type="button" disabled={item.ready} onClick={() => actions.syncTimelineClipMedia?.(item)}>挂素材</button>
                <button type="button" onClick={() => actions.setTimelineClipReviewStatus?.(item, "已通过")}>通过</button>
                <button type="button" onClick={() => actions.removeTimelineClip?.(item)}>删除</button>
              </div>
            ) : null}
          </article>
        )) : <EmptyPanel text="还没有可装配的镜头。先生成文本方案。" />}
      </div>
      <div className="panel-actions">
        <button className="primary" onClick={actions.syncTimelineFromShots} disabled={!shots.length}>同步镜头到时间线</button>
        <button onClick={actions.openTimeline} disabled={hasTimelineRows ? !readyTimelineRows.length : !readyShots.length}>打开视频时间线</button>
        <button onClick={actions.generateVideos} disabled={!blockedShots.length}>补齐视频</button>
      </div>
    </section>
  );
}
