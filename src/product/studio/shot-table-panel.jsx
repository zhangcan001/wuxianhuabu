import React, { useState } from "react";
import {
  EmptyPanel,
  InlineTaskStatus,
  ShotMediaCandidateStrip,
  ShotPreview,
} from "./studio-panel-primitives.jsx";

export function ShotTablePanel({ shots = [], actions = {}, running = false, runningAction = "", taskIndex = {}, uploadShotImage, uploadShotVideo, pickDesktopShotImage, pickDesktopShotVideo }) {
  const [imageModes, setImageModes] = useState({});
  const [videoModes, setVideoModes] = useState({});
  const [promptDrafts, setPromptDrafts] = useState({});
  const [showAllShots, setShowAllShots] = useState(false);
  const imageReadyCount = shots.filter((shot) => String(shot.imagePrompt || "").trim()).length;
  const videoReadyCount = shots.filter((shot) => String(shot.videoPrompt || "").trim()).length;
  const visibleShots = showAllShots ? shots : shots.slice(0, 240);
  const promptValue = (shot, key) => promptDrafts[shot.id]?.[key] ?? shot[key] ?? "";
  const updatePromptDraft = (shot, key, value) => setPromptDrafts((current) => ({
    ...current,
    [shot.id]: {
      ...(current[shot.id] || {}),
      [key]: value,
    },
  }));
  const savePromptDraft = (shot) => {
    actions.updateShotPrompt?.(shot, {
      imagePrompt: promptValue(shot, "imagePrompt"),
      videoPrompt: promptValue(shot, "videoPrompt"),
    });
    setPromptDrafts((current) => {
      const next = { ...current };
      delete next[shot.id];
      return next;
    });
  };
  return (
    <section className="workbench-panel">
      <div className="panel-title">
        <div className="panel-title-row">
          <strong>镜头表</strong>
          <div className="shot-batch-actions">
            <button type="button" disabled={running || !imageReadyCount} onClick={actions.generateImages}>批量生图</button>
            <button type="button" disabled={running || !videoReadyCount} onClick={actions.generateVideos}>批量生视频</button>
            <button type="button" disabled={!shots.length} onClick={actions.openQueue}>失败队列</button>
            <button type="button" disabled={running || !shots.length} onClick={actions.runReview}>审片</button>
            <button type="button" disabled={!shots.length} onClick={actions.exportAssetsAndStoryboard}>导出资产+分镜</button>
          </div>
        </div>
        <span>{shots.length ? `${shots.length} 个镜头，${imageReadyCount} 条可生图，${videoReadyCount} 条可生视频` : "生成文本方案后会出现镜头表"}</span>
      </div>
      {shots.length ? (
        <div className="production-shot-table">
          {!showAllShots && shots.length > visibleShots.length ? (
            <div className="large-list-notice">
              <span>性能模式：当前显示前 {visibleShots.length} / {shots.length} 个镜头</span>
              <button type="button" onClick={() => setShowAllShots(true)}>显示全部</button>
            </div>
          ) : null}
          {visibleShots.map((shot) => {
            const imageUploading = runningAction === `shot-image-upload-${shot.id}`;
            const videoUploading = runningAction === `shot-video-upload-${shot.id}`;
            const rowBusy = imageUploading || videoUploading;
            const taskStatus = taskIndex.shots?.[shot.id] || null;
            const imageMode = imageModes[shot.id] || "inherit";
            const videoMode = videoModes[shot.id] || "inherit";
            return (
              <article key={shot.id} className={rowBusy ? "shot-list-card is-uploading" : "shot-list-card"}>
                <div className="shot-list-media">
                  <ShotPreview shot={shot} actions={actions} />
                  <strong>{shot.id}</strong>
                  <small>{rowBusy ? imageUploading ? "图片上传中..." : "视频上传中..." : shot.title || shot.scene || "未命名镜头"}</small>
                </div>
                <div className="shot-list-prompts">
                  <label>
                    <b>图片</b>
                    <textarea
                      value={promptValue(shot, "imagePrompt")}
                      placeholder="缺少图片提示词"
                      onChange={(event) => updatePromptDraft(shot, "imagePrompt", event.target.value)}
                    />
                  </label>
                  <label>
                    <b>视频</b>
                    <textarea
                      value={promptValue(shot, "videoPrompt")}
                      placeholder="缺少视频提示词"
                      onChange={(event) => updatePromptDraft(shot, "videoPrompt", event.target.value)}
                    />
                  </label>
                  <div className="shot-prompt-actions">
                    <button type="button" disabled={running} onClick={() => savePromptDraft(shot)}>保存提示词</button>
                    <button type="button" disabled={running} onClick={() => actions.rewriteShotPrompt?.(shot, "image")}>优化图词</button>
                    <button type="button" disabled={running} onClick={() => actions.rewriteShotPrompt?.(shot, "video")}>优化视频词</button>
                  </div>
                </div>
                <div className="shot-status-stack shot-action-stack">
                  <span className={shot.hasImage ? "ok" : "warn"}>{shot.hasImage ? "图片就绪" : "待图片"}</span>
                  <span className={shot.hasVideo ? "ok" : "warn"}>{shot.hasVideo ? "视频就绪" : "待视频"}</span>
                  <InlineTaskStatus taskStatus={taskStatus} actions={actions} />
                  <ShotMediaCandidateStrip shot={shot} kind="image" actions={actions} />
                  <ShotMediaCandidateStrip shot={shot} kind="video" actions={actions} />
                  <div className="shot-action-row">
                    <select
                      value={imageMode}
                      onChange={(event) => setImageModes((current) => ({ ...current, [shot.id]: event.target.value }))}
                    >
                      <option value="inherit">图跟随总开关</option>
                      <option value="api">图 API</option>
                      <option value="comfy">图 ComfyUI</option>
                      <option value="upload">图上传</option>
                    </select>
                    {imageMode === "upload" ? (
                      <>
                        <button type="button" disabled={running} onClick={() => pickDesktopShotImage?.(shot)}>{imageUploading ? "上传中" : "桌面选图"}</button>
                        <label className={running ? "is-disabled" : ""}>
                          浏览器选图
                          {!running ? <input hidden type="file" accept="image/*" onChange={(event) => uploadShotImage?.(shot, event)} /> : null}
                        </label>
                      </>
                    ) : (
                      <button
                        disabled={running || !shot.imagePrompt}
                        onClick={() => actions.generateShotImage?.(shot, imageMode === "inherit" ? {} : { providerMode: imageMode })}
                      >
                        生图
                      </button>
                    )}
                  </div>
                  <div className="shot-action-row">
                    <select
                      value={videoMode}
                      onChange={(event) => setVideoModes((current) => ({ ...current, [shot.id]: event.target.value }))}
                    >
                      <option value="inherit">视频跟随总开关</option>
                      <option value="api">视频 API</option>
                      <option value="comfy">视频 ComfyUI</option>
                      <option value="upload">视频上传</option>
                    </select>
                    {videoMode === "upload" ? (
                      <>
                        <button type="button" disabled={running} onClick={() => pickDesktopShotVideo?.(shot)}>{videoUploading ? "上传中" : "桌面选视频"}</button>
                        <label className={running ? "is-disabled" : ""}>
                          浏览器选视频
                          {!running ? <input hidden type="file" accept="video/*" onChange={(event) => uploadShotVideo?.(shot, event)} /> : null}
                        </label>
                      </>
                    ) : (
                      <button
                        disabled={running || !shot.videoPrompt}
                        onClick={() => actions.generateShotVideo?.(shot, videoMode === "inherit" ? {} : { providerMode: videoMode })}
                      >
                        生视频
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : <EmptyPanel text="还没有镜头。先导入小说并生成文本方案。" />}
    </section>
  );
}
