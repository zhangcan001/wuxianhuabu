import React, { useState } from "react";
import {
  EmptyPanel,
  ShotPreview,
} from "./studio-panel-primitives.jsx";

export function ReviewPanel({ shots = [], stats = {}, actions = {}, running = false }) {
  const [reviewNotes, setReviewNotes] = useState({});
  const missingImages = shots.filter((shot) => !shot.hasImage);
  const missingVideos = shots.filter((shot) => !shot.hasVideo);
  const readyForReview = stats.total > 0 && missingImages.length === 0 && missingVideos.length === 0;
  const reviewRows = shots.slice(0, 10).map((shot) => ({
    ...shot,
    issue: !shot.hasImage ? "缺首帧图" : !shot.hasVideo ? "缺视频" : shot.reviewStatus || "待审片",
    ready: shot.hasImage && shot.hasVideo,
  }));
  return (
    <section className="workbench-panel review-work-panel">
      <div className="panel-title">
        <strong>审片</strong>
        <span>{readyForReview ? "素材已齐备，可以进入审片质检" : "先补齐图片和视频，再执行审片"}</span>
      </div>
      <div className="review-gate-board">
        <section className={missingImages.length ? "warn" : "ok"}>
          <strong>{missingImages.length ? `${missingImages.length} 项缺图` : "图片通过"}</strong>
          <p>{missingImages.length ? "补齐所有首帧图后再检查画面连续性。" : "所有镜头已有图片素材。"}</p>
        </section>
        <section className={missingVideos.length ? "warn" : "ok"}>
          <strong>{missingVideos.length ? `${missingVideos.length} 项缺视频` : "视频通过"}</strong>
          <p>{missingVideos.length ? "缺失视频会阻塞审片和交付。" : "所有镜头已有视频片段。"}</p>
        </section>
      </div>
      <div className="review-shot-list">
        {reviewRows.length ? reviewRows.map((shot) => (
          <article key={shot.id} className={shot.ready ? "ok" : "warn"}>
            <ShotPreview shot={shot} />
            <div>
              <strong>{shot.id} · {shot.title || shot.scene || "未命名镜头"}</strong>
              <span>{shot.ready ? `审片状态：${shot.reviewStatus || "未审"}${shot.reviewComment ? ` · ${shot.reviewComment}` : ""}` : shot.issue}</span>
              {shot.reviewRepairSuggestion?.suggestions?.length ? (
                <small>{shot.reviewRepairSuggestion.suggestions.slice(0, 2).join("；")}</small>
              ) : null}
              {shot.reviewHistory?.length ? <small>审片记录 {shot.reviewHistory.length} 条</small> : null}
            </div>
            <div className="review-row-actions">
              {!shot.ready ? (
                <button
                  disabled={running}
                  onClick={() => !shot.hasImage ? actions.generateShotImage?.(shot) : actions.generateShotVideo?.(shot)}
                >
                  {!shot.hasImage ? "补图" : "补视频"}
                </button>
              ) : (
                <>
                  <input
                    aria-label="退回原因"
                    placeholder="退回原因"
                    value={reviewNotes[shot.id] || ""}
                    onChange={(event) => setReviewNotes((current) => ({ ...current, [shot.id]: event.target.value }))}
                  />
                  <button disabled={running} onClick={() => actions.setShotReviewStatus?.(shot, "已通过", { comment: reviewNotes[shot.id] || "人工审片通过" })}>通过</button>
                  <button disabled={running} onClick={() => actions.setShotReviewStatus?.(shot, "待修改", { comment: reviewNotes[shot.id] || "需要返修" })}>退回</button>
                  {shot.reviewStatus === "待修改" ? (
                    <>
                      <button disabled={running} onClick={() => actions.generateShotImage?.(shot, { reviewComment: reviewNotes[shot.id] || shot.reviewComment || "" })}>重刷图</button>
                      <button disabled={running} onClick={() => actions.generateShotVideo?.(shot, { reviewComment: reviewNotes[shot.id] || shot.reviewComment || "" })}>重刷视频</button>
                    </>
                  ) : null}
                </>
              )}
            </div>
          </article>
        )) : <EmptyPanel text="还没有可审片的镜头。" />}
      </div>
      <div className="panel-actions">
        <button className="primary" onClick={actions.runReview} disabled={running || !readyForReview}>执行审片</button>
        <button onClick={actions.openDashboard}>打开高级总控台</button>
      </div>
    </section>
  );
}
