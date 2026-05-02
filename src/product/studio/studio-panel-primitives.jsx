import React from "react";

export function ShotPreview({ shot = {}, actions = {} }) {
  const imageUrl = shot.imageUrl || shot.imageResultUrl || shot.imageResult || shot.previewUrl || "";
  const thumbnailUrl = shot.imageThumbnailUrl || shot.thumbnailUrl || shot.previewUrl || imageUrl;
  const openImage = () => actions.openImagePreview?.({
    url: imageUrl,
    thumbnailUrl,
    title: `${shot.id || "镜头"} · ${shot.title || shot.scene || "高清大图"}`,
  });
  if (shot.videoUrl) {
    return (
      <div className="shot-preview">
        <video src={shot.videoUrl} muted playsInline />
      </div>
    );
  }
  if (imageUrl) {
    return (
      <button type="button" className="shot-preview image-preview-trigger" onClick={openImage} title="查看高清大图">
        <img src={thumbnailUrl} alt="" />
      </button>
    );
  }
  return (
    <div className={shot.hasVideo ? "shot-preview is-video-ready" : "shot-preview is-empty"}>
      <span>{shot.hasVideo ? "视频就绪" : "待素材"}</span>
    </div>
  );
}

export function InlineTaskStatus({ taskStatus = null, actions = {}, compact = false }) {
  if (!taskStatus) return null;
  const failed = Number(taskStatus.failed || 0);
  const running = Number(taskStatus.running || 0);
  const pending = Number(taskStatus.pending || 0);
  const failedJobs = (taskStatus.jobs || []).filter((job) => job.status === "failed");
  const latestError = failedJobs.find((job) => job.error)?.error || "";
  const failedIds = failedJobs.map((job) => job.id).filter(Boolean);
  const className = failed ? "task-pill failed" : running ? "task-pill running" : "task-pill pending";
  const label = failed ? `${failed} 失败` : running ? `${running} 运行中` : `${pending} 等待`;
  return (
    <span className={compact ? "inline-task-status compact" : "inline-task-status"}>
      <button
        type="button"
        className={compact ? `${className} compact` : className}
        title={latestError || label}
        onClick={() => actions.openQueue?.()}
      >
        {label}
      </button>
      {failed ? (
        <span className="task-recovery-actions">
          <button type="button" className="task-retry-button" onClick={() => failedIds.length ? actions.retryQueueJobs?.(failedIds) : actions.retryFailedJobs?.()}>重试</button>
          <button type="button" onClick={() => actions.retryQueueJobsWithProvider?.(failedIds, "api")}>换 API</button>
          <button type="button" onClick={() => actions.retryQueueJobsWithProvider?.(failedIds, "comfy")}>换 Comfy</button>
          <button type="button" onClick={() => actions.skipQueueJobs?.(failedIds)}>跳过</button>
        </span>
      ) : null}
      {latestError && !compact ? <small className="task-error-text">{latestError}</small> : null}
    </span>
  );
}

export function EmptyPanel({ text = "" }) {
  return <div className="empty-panel">{text}</div>;
}

export function AssetCandidateStrip({ asset = {}, actions = {} }) {
  const candidates = (asset.imageCandidates || []).filter((item) => !item.discarded).slice(0, 4);
  if (!candidates.length) return null;
  return (
    <div className="asset-candidate-strip">
      {candidates.map((item) => (
        <section key={item.id || item.imageUrl || item.imagePath} className={item.primary ? "primary" : ""}>
          <button
            type="button"
            className="candidate-preview-trigger"
            onClick={() => actions.openImagePreview?.({
              url: item.imageUrl || item.url || item.imagePath || item.path || "",
              thumbnailUrl: item.thumbnailUrl || item.imageThumbnailUrl || "",
              title: `${asset.name || asset.token || "资产"} · 高清大图`,
            })}
            title="查看高清大图"
          >
            <img src={item.thumbnailUrl || item.imageUrl || item.imagePath} alt="" />
          </button>
          <div>
            <button type="button" disabled={item.primary} onClick={() => actions.setPrimaryAssetImage?.(asset, item)}>主图</button>
            <button type="button" disabled={item.primary || item.locked} onClick={() => actions.discardAssetImageCandidate?.(asset, item)}>废弃</button>
          </div>
        </section>
      ))}
    </div>
  );
}

export function ShotMediaCandidateStrip({ shot = {}, kind = "image", actions = {} }) {
  const candidates = (kind === "video" ? shot.videoCandidates : shot.imageCandidates || []).filter((item) => !item.discarded).slice(0, 4);
  if (!candidates.length) return null;
  return (
    <div className="asset-candidate-strip shot-media-candidate-strip">
      {candidates.map((item) => (
        <section key={item.id || item.url || item.path} className={item.primary ? "primary" : ""}>
          {kind === "video" ? (
            <video src={item.videoUrl || item.url || item.path} muted playsInline />
          ) : (
            <button
              type="button"
              className="candidate-preview-trigger"
              onClick={() => actions.openImagePreview?.({
                url: item.imageUrl || item.url || item.path || "",
                thumbnailUrl: item.thumbnailUrl || "",
                title: `${shot.id || "镜头"} · 高清大图`,
              })}
              title="查看高清大图"
            >
              <img src={item.thumbnailUrl || item.imageUrl || item.url || item.path} alt="" />
            </button>
          )}
          <div>
            <button type="button" disabled={item.primary} onClick={() => actions.setPrimaryShotMedia?.(shot, kind, item)}>主版本</button>
            <button type="button" disabled={item.primary || item.locked} onClick={() => actions.discardShotMediaCandidate?.(shot, kind, item)}>废弃</button>
          </div>
        </section>
      ))}
    </div>
  );
}

export function StatusTile({ label = "", value = "", tone = "" }) {
  return (
    <div className={tone ? `status-tile ${tone}` : "status-tile"}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export function formatBytesCompact(value = 0) {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  if (size >= 1024 * 1024 * 1024) return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${Math.round(size)} B`;
}
