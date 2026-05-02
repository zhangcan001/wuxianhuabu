import React from "react";
import {
  InlineTaskStatus,
} from "./studio-panel-primitives.jsx";

export function MediaProductionPanel({ shots = [], running = false, runningAction = "", taskIndex = {}, actions = {}, uploadShotImage, uploadShotVideo, pickDesktopShotImage, pickDesktopShotVideo }) {
  const missingImages = shots.filter((shot) => !shot.hasImage);
  const missingVideos = shots.filter((shot) => !shot.hasVideo);
  const readyImages = shots.length - missingImages.length;
  const readyVideos = shots.length - missingVideos.length;
  return (
    <section className="workbench-panel">
      <div className="panel-title">
        <strong>媒体生产</strong>
        <span>图片和视频都支持 API、ComfyUI 与本地上传</span>
      </div>
      <div className="media-command-bar">
        <section>
          <strong>{readyImages}/{shots.length || 0}</strong>
          <span>图片就绪</span>
        </section>
        <section>
          <strong>{readyVideos}/{shots.length || 0}</strong>
          <span>视频就绪</span>
        </section>
        <section className={missingImages.length || missingVideos.length ? "warn" : "ok"}>
          <strong>{missingImages.length + missingVideos.length}</strong>
          <span>待补素材</span>
        </section>
        <div>
          {running ? (
            <button type="button" className="danger" onClick={actions.stopQueue}>停止批量生成</button>
          ) : (
            <>
              <button className="primary" onClick={actions.generateImages} disabled={!missingImages.length}>补齐图片</button>
              <button className="primary" onClick={actions.generateVideos} disabled={!missingVideos.length}>补齐视频</button>
            </>
          )}
        </div>
      </div>
      <div className="media-production-grid">
        <section>
          <strong>图片</strong>
          <span>{missingImages.length ? `${missingImages.length} 个镜头待补图` : "图片已补齐"}</span>
          <div>
            <button className="primary" onClick={actions.generateImages} disabled={running || !missingImages.length}>批量生成图片</button>
            <button type="button" disabled={running} onClick={() => pickDesktopShotImage?.()}>{runningAction === "upload-image" ? "上传中" : "桌面选图"}</button>
            <label className={running ? "is-disabled" : ""}>
              浏览器上传
              {!running ? <input hidden type="file" accept="image/*" onChange={uploadShotImage} /> : null}
            </label>
          </div>
          <MediaGapList items={missingImages} kind="image" actions={actions} running={running} taskIndex={taskIndex} />
        </section>
        <section>
          <strong>视频</strong>
          <span>{missingVideos.length ? `${missingVideos.length} 个镜头待补视频` : "视频已补齐"}</span>
          <div>
            <button className="primary" onClick={actions.generateVideos} disabled={running || !missingVideos.length}>批量生成视频</button>
            <button type="button" disabled={running} onClick={() => pickDesktopShotVideo?.()}>{runningAction === "upload-video" ? "上传中" : "桌面选视频"}</button>
            <label className={running ? "is-disabled" : ""}>
              浏览器上传
              {!running ? <input hidden type="file" accept="video/*" onChange={uploadShotVideo} /> : null}
            </label>
          </div>
          <MediaGapList items={missingVideos} kind="video" actions={actions} running={running} taskIndex={taskIndex} />
        </section>
      </div>
    </section>
  );
}

function MediaGapList({ items = [], kind = "image", actions = {}, running = false, taskIndex = {} }) {
  if (!items.length) return <p className="empty-line">没有缺失项。</p>;
  return (
    <div className="media-gap-list">
      {items.slice(0, 10).map((shot) => (
        <article key={`${kind}-${shot.id}`}>
          <div>
            <strong>{shot.id}</strong>
            <span>{shot.title || shot.scene || "未命名镜头"}</span>
            <InlineTaskStatus taskStatus={taskIndex.shots?.[shot.id] || null} actions={actions} compact />
            <p>{kind === "video" ? shot.videoPrompt || "缺少视频提示词" : shot.imagePrompt || "缺少图片提示词"}</p>
          </div>
          <button
            disabled={running || (kind === "video" ? !shot.videoPrompt : !shot.imagePrompt)}
            onClick={() => kind === "video"
              ? actions.generateShotVideo?.(shot)
              : actions.generateShotImage?.(shot)}
          >
            {kind === "video" ? "生视频" : "生图"}
          </button>
        </article>
      ))}
      {items.length > 10 ? <p className="empty-line">还有 {items.length - 10} 个待补镜头，可使用批量补齐。</p> : null}
    </div>
  );
}
