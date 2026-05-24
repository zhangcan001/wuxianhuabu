import React, { useState } from "react";
import {
  AssetCandidateStrip,
  EmptyPanel,
  InlineTaskStatus,
} from "./studio-panel-primitives.jsx";

export function AssetLibraryPanel({ assets = [], resources = [], actions = {}, running = false, runningAction = "", taskIndex = {}, uploadAssetImage }) {
  const [sourceModes, setSourceModes] = useState({});
  const [showAllAssets, setShowAllAssets] = useState(false);
  const missingImageCount = assets.filter((asset) => !asset.hasImage).length;
  const unreferencedCount = assets.filter((asset) => Number(asset.referenceCount || 0) === 0 && !asset.assetRefs?.length).length;
  const lockedCount = assets.filter((asset) => asset.hasImage && String(asset.visualLock || asset.prompt || asset.description || "").trim()).length;
  const visibleAssets = showAllAssets ? assets : assets.slice(0, 240);
  return (
    <section className="workbench-panel">
      <div className="panel-title">
        <div className="panel-title-row">
          <strong>资产库</strong>
          <button type="button" disabled={!assets.length} onClick={actions.exportAssetsAndStoryboard}>导出资产+分镜</button>
          <button type="button" onClick={actions.importResources}>导入资源</button>
        </div>
        <span>{assets.length || resources.length ? `${assets.length} 个资产 · 缺定妆 ${missingImageCount} · 未引用 ${unreferencedCount} · 参考资源 ${resources.length}` : "生成文本方案或导入资源后会出现资产库"}</span>
      </div>
      {assets.length ? (
        <div className="asset-health-strip studio-asset-health">
          <span className={missingImageCount ? "bad" : "good"}>缺定妆 {missingImageCount}</span>
          <span className={unreferencedCount ? "bad" : "good"}>未引用 {unreferencedCount}</span>
          <span className={lockedCount >= assets.length ? "good" : "warn"}>视觉锁定 {lockedCount}/{assets.length}</span>
          <button type="button" onClick={actions.repairAssetConsistency} disabled={running || !assets.length}>一键检查一致性</button>
        </div>
      ) : null}
      {resources.length ? (
        <section className="studio-resource-section">
          <div className="panel-title">
            <strong>项目资源</strong>
            <span>参考图、脚本、视频和文档会参与提示词与连续性绑定</span>
          </div>
          <div className="studio-resource-grid">
            {resources.map((resource) => (
              <article key={resource.id || resource.token || resource.name} className="studio-resource-card">
                <div className="studio-resource-preview">
                  {resource.kind === "image" && (resource.previewUrl || resource.dataUrl || resource.thumbnailUrl) ? (
                    <button
                      type="button"
                      className="image-preview-trigger"
                      onClick={() => actions.openImagePreview?.({
                        url: resource.previewUrl || resource.dataUrl || resource.thumbnailUrl,
                        thumbnailUrl: resource.thumbnailUrl || "",
                        title: resource.name || resource.token || "资源高清大图",
                      })}
                      title="查看高清大图"
                    >
                      <img src={resource.thumbnailUrl || resource.previewUrl || resource.dataUrl} alt="" />
                    </button>
                  ) : resource.kind === "video" && (resource.previewUrl || resource.dataUrl) ? (
                    <video src={resource.previewUrl || resource.dataUrl} muted playsInline />
                  ) : (
                    <span>{resourceKindLabel(resource.kind)}</span>
                  )}
                </div>
                <div>
                  <strong>{resource.name || resource.token || "未命名资源"}</strong>
                  <small>{resource.token || resourceKindLabel(resource.kind)}</small>
                </div>
                <p>{resource.note || resource.textContent || `${resourceKindLabel(resource.kind)} · 引用 ${resource.referenceCount || 0} 次`}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
      {assets.length ? (
        <div className="asset-table">
          {!showAllAssets && assets.length > visibleAssets.length ? (
            <div className="large-list-notice">
              <span>性能模式：当前显示前 {visibleAssets.length} / {assets.length} 个资产</span>
              <button type="button" onClick={() => setShowAllAssets(true)}>显示全部</button>
            </div>
          ) : null}
          {visibleAssets.map((asset) => {
            const assetKey = asset.id || asset.token || asset.name;
            const uploading = runningAction === `asset-upload-${assetKey}`;
            const taskStatus = taskIndex.assets?.[asset.id] || taskIndex.assets?.[asset.token] || taskIndex.assets?.[asset.name] || null;
            const sourceMode = sourceModes[assetKey] || "inherit";
            return (
              <article key={assetKey} className={uploading ? "asset-list-card is-uploading" : "asset-list-card"}>
                <div className="asset-list-media">
                  <div className="asset-preview">
                    {asset.imageUrl ? (
                      <button
                        type="button"
                        className="image-preview-trigger"
                        onClick={() => actions.openImagePreview?.({
                          url: asset.imageUrl,
                          thumbnailUrl: asset.imageThumbnailUrl || asset.thumbnailUrl || "",
                          title: asset.name || asset.token || "资产高清大图",
                        })}
                        title="查看高清大图"
                      >
                        <img src={asset.imageThumbnailUrl || asset.thumbnailUrl || asset.imageUrl} alt="" />
                      </button>
                    ) : <span>{asset.typeLabel}</span>}
                  </div>
                  <strong>{asset.name || asset.token || "未命名资产"}</strong>
                  <small>{asset.typeLabel}</small>
                </div>
                <div className="asset-list-body">
                  <p>{asset.prompt || asset.visualLock || asset.description || "暂无视觉锁定"}</p>
                  <div className="asset-reference-meta">
                    <span className={asset.hasImage ? "ok" : "warn"}>{asset.hasImage ? "定妆图已锁定" : "缺少定妆图"}</span>
                    <span className={Number(asset.referenceCount || 0) > 0 ? "ok" : "warn"}>引用 {asset.referenceCount || 0}</span>
                    {asset.token ? <code>{asset.token}</code> : null}
                  </div>
                  <AssetCandidateStrip asset={asset} actions={actions} />
                </div>
                <div className="asset-actions">
                  <em className={asset.hasImage ? "ok" : "warn"}>{asset.hasImage ? "有图" : "待定妆"}</em>
                  <InlineTaskStatus taskStatus={taskStatus} actions={actions} />
                  <select
                    value={sourceMode}
                    onChange={(event) => setSourceModes((current) => ({
                      ...current,
                      [asset.id || asset.token || asset.name]: event.target.value,
                    }))}
                  >
                    <option value="inherit">跟随总开关</option>
                    <option value="api">API</option>
                    <option value="comfy">ComfyUI</option>
                    <option value="upload">上传</option>
                  </select>
                  {sourceMode === "upload" ? (
                    <label className={running ? "is-disabled" : ""}>
                      {uploading ? "上传中" : "上传图片"}
                      {!running ? <input hidden type="file" accept="image/*" onChange={(event) => uploadAssetImage?.(asset, event)} /> : null}
                    </label>
                  ) : (
                    <button
                      onClick={() => actions.generateAssetImage?.(asset, {
                        ...(sourceMode === "inherit" ? {} : { providerMode: sourceMode }),
                      })}
                      disabled={running}
                    >
                      {asset.hasImage ? "重新生成" : "生成图片"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : <EmptyPanel text="还没有资产。先生成文本方案，系统会提取角色、场景和道具。" />}
    </section>
  );
}

function resourceKindLabel(kind = "") {
  return {
    image: "图片",
    video: "视频",
    script: "脚本",
    template: "模板",
    doc: "文档",
    reference: "参考",
  }[kind] || "资源";
}
