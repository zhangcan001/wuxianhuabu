import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { applyMediaCacheReviewDecisions, getMediaCacheFileKey } from "../storage/project-media-index-helpers.js";

const MEDIA_CACHE_REVIEW_KEY = "wuxianhuabu.mediaCacheReview.v1";
const MEDIA_CACHE_DELETE_AUDIT_KEY = "wuxianhuabu.mediaCacheDeleteAudit.v1";

function loadMediaCacheReviewDecisions() {
  try {
    const raw = localStorage.getItem(MEDIA_CACHE_REVIEW_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveMediaCacheReviewDecisions(decisions) {
  try {
    localStorage.setItem(MEDIA_CACHE_REVIEW_KEY, JSON.stringify(decisions || {}));
  } catch {
    // Review markers are a convenience layer; losing them should not block resource work.
  }
}

function loadMediaCacheDeleteAudit() {
  try {
    const raw = localStorage.getItem(MEDIA_CACHE_DELETE_AUDIT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveMediaCacheDeleteAudit(entries) {
  try {
    localStorage.setItem(MEDIA_CACHE_DELETE_AUDIT_KEY, JSON.stringify(entries || []));
  } catch {
    // Deletion already happened in the backend; audit persistence should not mask that result.
  }
}

export function ProjectResourcePanel({ resourceIndex, episodes, activeEpisodeId, activeEpisodeName, exportBundle, projectExportSummary, exportHistory, mediaCacheReport, projectIndexSummary, onImport, onRefreshMediaCache, onRebuildProjectIndex, onSearchProjectIndex, onExportMediaCacheReport, onDeleteMediaCacheFiles, onUpdateResource, onDeleteResource, onExportFile, onExportCover, exportBaseName, onOpenExportCenter, onLocateNode, onClose, helpers }) {
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [mediaReviewDecisions, setMediaReviewDecisions] = useState(() => loadMediaCacheReviewDecisions());
  const [mediaDeleteAudit, setMediaDeleteAudit] = useState(() => loadMediaCacheDeleteAudit());
  const [selectedDeleteKeys, setSelectedDeleteKeys] = useState([]);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [selectedMediaFileKey, setSelectedMediaFileKey] = useState("");
  const [indexSearchItems, setIndexSearchItems] = useState([]);
  const [indexSearchStatus, setIndexSearchStatus] = useState("");
  const reviewedMediaCacheReport = useMemo(
    () => mediaCacheReport ? applyMediaCacheReviewDecisions(mediaCacheReport, mediaReviewDecisions) : null,
    [mediaCacheReport, mediaReviewDecisions],
  );
  const selectedMediaFile = useMemo(() => {
    if (!selectedMediaFileKey || !reviewedMediaCacheReport) return null;
    return [...(reviewedMediaCacheReport.orphanFiles || []), ...(reviewedMediaCacheReport.referencedFiles || [])]
      .find((file) => getMediaCacheFileKey(file) === selectedMediaFileKey) || null;
  }, [selectedMediaFileKey, reviewedMediaCacheReport]);
  const resources = helpers.resourceListByTab(tab, resourceIndex)
    .filter((resource) => helpers.resourceMatchesQuery(resource, query))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const deliveryEntries = useMemo(() => {
    const bundle = exportBundle || {};
    const readyEpisodes = (projectExportSummary || []).filter((item) => item.ready);
    const blockedEpisodes = (projectExportSummary || []).filter((item) => !item.ready);
    const failedExports = (exportHistory || []).filter((item) => item.status === "failed");
    return [
      { id: "cover", title: "当前集封面", kind: "asset", status: bundle.coverImage ? "ready" : "missing", detail: bundle.coverImage ? "已检测到可导出封面图" : "当前时间线还没有可用封面", action: "cover" },
      { id: "markdown", title: "时间线 Markdown", kind: "doc", status: bundle.markdown ? "ready" : "missing", detail: "当前集交付说明与时间线文字版", action: "md" },
      { id: "manifest", title: "成片 JSON 清单", kind: "doc", status: bundle.manifest ? "ready" : "missing", detail: "用于交付和程序化检查", action: "json" },
      { id: "landscape", title: "横版发布清单", kind: "doc", status: bundle.landscapeManifest ? "ready" : "missing", detail: "16:9 发布计划", action: "landscape" },
      { id: "portrait", title: "竖版发布清单", kind: "doc", status: bundle.portraitManifest ? "ready" : "missing", detail: "9:16 发布计划", action: "portrait" },
      { id: "archive", title: "项目归档包", kind: "archive", status: bundle.archiveBundle ? "ready" : "missing", detail: `${bundle.archiveCount || 0} 条归档内容`, action: "archive" },
      { id: "projectReady", title: "全项目可交付集", kind: "project", status: readyEpisodes.length ? "ready" : "pending", detail: `${readyEpisodes.length} 集可交付 / ${blockedEpisodes.length} 集待补`, action: "openExport" },
      { id: "failedExports", title: "失败导出", kind: "project", status: failedExports.length ? "missing" : "ready", detail: failedExports.length ? `${failedExports.length} 条失败记录待恢复` : "当前没有失败导出", action: "openExport" },
    ].filter((item) => `${item.title} ${item.detail}`.toLowerCase().includes(query.trim().toLowerCase() || ""));
  }, [exportBundle, projectExportSummary, exportHistory, query]);

  useEffect(() => {
    if (!projectIndexSummary || !onSearchProjectIndex) return undefined;
    const keyword = query.trim();
    if (!keyword) {
      setIndexSearchItems([]);
      setIndexSearchStatus("");
      return undefined;
    }
    let cancelled = false;
    setIndexSearchStatus("查询 SQLite 索引中...");
    const timer = window.setTimeout(() => {
      onSearchProjectIndex(keyword)
        .then((result) => {
          if (cancelled) return;
          setIndexSearchItems(Array.isArray(result?.items) ? result.items : []);
          setIndexSearchStatus("");
        })
        .catch((error) => {
          if (cancelled) return;
          setIndexSearchItems([]);
          setIndexSearchStatus(error.message || "SQLite 索引查询失败");
        });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, projectIndexSummary, onSearchProjectIndex]);

  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(`已复制：${label}`);
    } catch (error) {
      setMessage(error.message || "复制失败");
    }
  }

  function setMediaReviewDecision(file, decision) {
    const key = getMediaCacheFileKey(file);
    if (!key) return;
    setSelectedMediaFileKey(key);
    setMediaReviewDecisions((current) => {
      const next = { ...current };
      if (decision === "pending") {
        delete next[key];
      } else {
        next[key] = decision;
      }
      saveMediaCacheReviewDecisions(next);
      return next;
    });
  }

  function toggleDeleteCandidate(file) {
    const key = getMediaCacheFileKey(file);
    if (!key) return;
    setSelectedDeleteKeys((current) => (
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    ));
  }

  async function deleteSelectedMediaFiles() {
    const pendingFiles = reviewedMediaCacheReport?.pendingOrphanFiles || [];
    const selectedFiles = pendingFiles.filter((file) => selectedDeleteKeys.includes(getMediaCacheFileKey(file)));
    if (!selectedFiles.length) {
      setMessage("请先勾选待删除的疑似孤儿文件");
      return;
    }
    if (deleteConfirmText.trim() !== "删除") {
      setMessage("请输入“删除”完成二次确认");
      return;
    }
    try {
      const result = await onDeleteMediaCacheFiles?.(selectedFiles.map((file) => file.path).filter(Boolean));
      const auditEntry = {
        deletedAt: new Date().toISOString(),
        requested: selectedFiles.map((file) => ({ path: file.path || "", fileName: file.fileName || file.file_name || "", size: file.size || 0 })),
        deleted: result?.deleted || [],
        skipped: result?.skipped || [],
        errors: result?.errors || [],
      };
      const nextAudit = [auditEntry, ...mediaDeleteAudit].slice(0, 50);
      setMediaDeleteAudit(nextAudit);
      saveMediaCacheDeleteAudit(nextAudit);
      setSelectedDeleteKeys([]);
      setDeleteConfirmText("");
      setSelectedMediaFileKey("");
      setMessage(`清理完成：删除 ${auditEntry.deleted.length} 个，跳过 ${auditEntry.skipped.length} 个，错误 ${auditEntry.errors.length} 个`);
    } catch (error) {
      setMessage(error.message || "删除缓存文件失败");
    }
  }

  async function exportDeliveryItem(action) {
    try {
      if (action === "cover") {
        if (!exportBundle?.coverImage) throw new Error("当前没有可导出的封面图");
        await onExportCover?.(exportBundle.coverImage, activeEpisodeName || "episode");
      } else if (action === "md") {
        await onExportFile?.(`${exportBaseName}.md`, "md", exportBundle?.markdown || "");
      } else if (action === "json") {
        await onExportFile?.(`${exportBaseName}.json`, "json", exportBundle?.manifest || "");
      } else if (action === "landscape") {
        await onExportFile?.(`${exportBaseName}-16x9.json`, "json", exportBundle?.landscapeManifest || "");
      } else if (action === "portrait") {
        await onExportFile?.(`${exportBaseName}-9x16.json`, "json", exportBundle?.portraitManifest || "");
      } else if (action === "archive") {
        await onExportFile?.(`${exportBaseName}-archive.json`, "json", exportBundle?.archiveBundle || "");
      } else if (action === "openExport") {
        onOpenExportCenter?.();
        return;
      }
      setMessage("交付资源已导出");
    } catch (error) {
      setMessage(error.message || "导出失败");
    }
  }

  return createPortal((
    <aside className="resource-panel">
      <header>
        <div>
          <strong>项目资源中心</strong>
          <span>{resourceIndex.items.length} 个资源 · 图片 {resourceIndex.images.length} · 视频 {resourceIndex.videos.length}</span>
        </div>
        <div className="resource-header-actions">
          <button onClick={onImport}>导入资源</button>
          <button onClick={onClose}>关闭</button>
        </div>
      </header>
      <div className="resource-toolbar">
        <div className="asset-drawer-tabs resource-tabs">
          {[
            ["all", "全部"],
            ["images", "图片"],
            ["videos", "视频"],
            ["scripts", "脚本"],
            ["templates", "模板"],
            ["docs", "文档"],
            ["references", "参考"],
            ["delivery", "交付包"],
          ].map(([key, label]) => (
            <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>
          ))}
        </div>
        <input value={query} placeholder="搜索资源名、Token、场次、镜头、标签" onChange={(event) => setQuery(event.target.value)} />
      </div>
      <div className="resource-stats">
        <section><b>{resourceIndex.activeItems.length}</b><span>{episodes.find((episode) => episode.id === activeEpisodeId)?.name || "当前集"}资源</span></section>
        <section><b>{resourceIndex.globalItems.length}</b><span>全项目通用</span></section>
        <section><b>{resourceIndex.metadataOnly}</b><span>仅元信息</span></section>
        <section><b>{resourceIndex.missingRefs.length}</b><span>缺失引用</span></section>
      </div>
      {projectIndexSummary ? (
        <div className="resource-missing-block">
          <strong>SQLite 项目索引</strong>
          <div className="resource-stats">
            <section><b>{projectIndexSummary.resourceCount || 0}</b><span>资源索引</span></section>
            <section><b>{projectIndexSummary.shotCount || 0}</b><span>镜头索引</span></section>
            <section><b>{projectIndexSummary.timelineClipCount || 0}</b><span>时间线片段</span></section>
            <section><b>{projectIndexSummary.mediaCount || 0}</b><span>媒体索引</span></section>
          </div>
          <div className="resource-delivery-actions">
            <button onClick={async () => {
              try {
                await onRebuildProjectIndex?.(mediaDeleteAudit);
                setMessage("SQLite 索引已重建");
              } catch (error) {
                setMessage(error.message || "SQLite 索引重建失败");
              }
            }}>重建索引</button>
            <button onClick={() => copyText(projectIndexSummary.dbPath || "", "SQLite 索引路径")}>复制索引路径</button>
          </div>
          <p className="asset-drawer-tip">状态：{projectIndexSummary.updatedAt ? `已同步 ${new Date(projectIndexSummary.updatedAt * 1000).toLocaleString()}` : "等待首次同步"}。影子索引文件：{projectIndexSummary.dbPath || "等待创建"}。</p>
          {query.trim() ? (
            <div className="resource-missing-list">
              {indexSearchItems.length ? indexSearchItems.slice(0, 10).map((item) => (
                <button key={`${item.kind}-${item.id}-${item.path}`} onClick={() => copyText(item.path || item.title || "", "SQLite 索引结果")}>
                  <code>{indexKindLabel(item.kind)}</code>
                  <span>{item.title} · {item.subtitle} {item.size ? `· ${helpers.formatBytes(item.size)}` : ""}</span>
                </button>
              )) : <span className="asset-drawer-tip">{indexSearchStatus || "SQLite 索引暂无匹配结果"}</span>}
            </div>
          ) : null}
        </div>
      ) : null}
      {reviewedMediaCacheReport ? (
        <div className="resource-missing-block">
          <strong>本地媒体缓存索引</strong>
          <div className="resource-stats">
            <section><b>{reviewedMediaCacheReport.totalFiles || 0}</b><span>缓存文件</span></section>
            <section><b>{reviewedMediaCacheReport.referencedCount || 0}</b><span>当前工程引用</span></section>
            <section><b>{reviewedMediaCacheReport.pendingOrphanFiles?.length || 0}</b><span>待确认孤儿</span></section>
            <section><b>{helpers.formatBytes(reviewedMediaCacheReport.orphanSize || 0)}</b><span>疑似孤儿体积</span></section>
          </div>
          <div className="resource-delivery-actions">
            <button onClick={() => onRefreshMediaCache?.()}>刷新缓存索引</button>
            <button onClick={() => onExportMediaCacheReport?.(mediaReviewDecisions, mediaDeleteAudit)}>导出清理报告</button>
            <span className="asset-drawer-tip">只读统计，不会删除文件；跨工程共享缓存可能会显示为未引用。</span>
          </div>
          <div className="resource-stats">
            <section><b>{reviewedMediaCacheReport.keptOrphanFiles?.length || 0}</b><span>已标记保留</span></section>
            <section><b>{reviewedMediaCacheReport.ignoredOrphanFiles?.length || 0}</b><span>已忽略</span></section>
            <section><b>{reviewedMediaCacheReport.thumbnailCount || 0}</b><span>缩略图</span></section>
            <section><b>{reviewedMediaCacheReport.references?.length || 0}</b><span>引用记录</span></section>
          </div>
          {reviewedMediaCacheReport.pendingOrphanFiles?.length ? (
            <div className="resource-missing-list">
              {reviewedMediaCacheReport.pendingOrphanFiles.slice(0, 8).map((file, index) => (
                <button key={`pending-${file.path || file.fileName}-${index}`} onClick={() => setSelectedMediaFileKey(getMediaCacheFileKey(file))}>
                  <code>
                    <input
                      type="checkbox"
                      checked={selectedDeleteKeys.includes(getMediaCacheFileKey(file))}
                      onChange={(event) => {
                        event.stopPropagation();
                        toggleDeleteCandidate(file);
                      }}
                      onClick={(event) => event.stopPropagation()}
                    />
                    {file.fileName || file.file_name || "media"}
                  </code>
                  <span>待确认 · {helpers.formatBytes(file.size || 0)}</span>
                </button>
              ))}
            </div>
          ) : null}
          {reviewedMediaCacheReport.pendingOrphanFiles?.length ? (
            <div className="resource-missing-block">
              <strong>手动清理确认</strong>
              <p className="asset-drawer-tip">仅允许清理“待确认孤儿”中已勾选的文件；被当前工程引用、标记保留或忽略的文件不会进入删除请求。</p>
              <div className="resource-stats">
                <section><b>{selectedDeleteKeys.length}</b><span>已勾选</span></section>
                <section><b>{helpers.formatBytes((reviewedMediaCacheReport.pendingOrphanFiles || []).filter((file) => selectedDeleteKeys.includes(getMediaCacheFileKey(file))).reduce((sum, file) => sum + (Number(file.size) || 0), 0))}</b><span>预计释放</span></section>
                <section><b>{mediaDeleteAudit.length}</b><span>审计记录</span></section>
                <section><b>{deleteConfirmText.trim() === "删除" ? "已确认" : "待输入"}</b><span>二次确认</span></section>
              </div>
              <input value={deleteConfirmText} placeholder="输入“删除”后才能执行清理" onChange={(event) => setDeleteConfirmText(event.target.value)} />
              <div className="resource-delivery-actions">
                <button className="danger" onClick={deleteSelectedMediaFiles}>删除已勾选缓存</button>
                <button onClick={() => setSelectedDeleteKeys([])}>清空勾选</button>
              </div>
            </div>
          ) : null}
          {reviewedMediaCacheReport.referencedFiles?.length ? (
            <div className="resource-missing-list">
              {reviewedMediaCacheReport.referencedFiles.slice(0, 5).map((file, index) => (
                <button key={`referenced-${file.path || file.fileName}-${index}`} onClick={() => setSelectedMediaFileKey(getMediaCacheFileKey(file))}>
                  <code>{file.fileName || file.file_name || "media"}</code>
                  <span>{(file.references || []).slice(0, 2).map((item) => item.path).join(" · ") || "当前工程引用"}</span>
                </button>
              ))}
            </div>
          ) : null}
          {selectedMediaFile ? (
            <div className="resource-missing-block">
              <strong>{selectedMediaFile.fileName || selectedMediaFile.file_name || "媒体文件详情"}</strong>
              <p className="asset-drawer-tip">{selectedMediaFile.path || "无本地路径"}</p>
              <div className="resource-stats">
                <section><b>{helpers.formatBytes(selectedMediaFile.size || 0)}</b><span>文件体积</span></section>
                <section><b>{selectedMediaFile.references?.length || 0}</b><span>引用来源</span></section>
                <section><b>{selectedMediaFile.reviewDecision === "keep" ? "保留" : selectedMediaFile.reviewDecision === "ignore" ? "忽略" : "待确认"}</b><span>人工标记</span></section>
                <section><b>{selectedMediaFile.isThumbnail || selectedMediaFile.is_thumbnail ? "是" : "否"}</b><span>缩略图</span></section>
              </div>
              {selectedMediaFile.references?.length ? (
                <div className="resource-missing-list">
                  {selectedMediaFile.references.slice(0, 6).map((reference, index) => (
                    <button key={`${reference.path}-${index}`} onClick={() => copyText(`${reference.path}: ${reference.value}`, "引用来源")}>
                      <code>{reference.path}</code>
                      <span>{reference.value}</span>
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="resource-delivery-actions">
                <button onClick={() => copyText(selectedMediaFile.path || "", "缓存路径")}>复制路径</button>
                <button onClick={() => setMediaReviewDecision(selectedMediaFile, "keep")}>标记保留</button>
                <button onClick={() => setMediaReviewDecision(selectedMediaFile, "ignore")}>忽略候选</button>
                <button onClick={() => setMediaReviewDecision(selectedMediaFile, "pending")}>恢复待确认</button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {tab === "delivery" ? (
        <div className="resource-delivery-grid">
          <section className="resource-delivery-card resource-delivery-summary">
            <strong>{activeEpisodeName || "当前集"} 交付资源</strong>
            <p>把当前集的封面、清单、归档包集中在这里。需要更多交付动作时可直接跳到成片导出。</p>
            <div className="resource-delivery-meta">
              <span className={`pill ${(exportBundle?.qualityCheck?.readyToRender) ? "pill-ok" : "pill-warn"}`}>{exportBundle?.qualityCheck?.readyToRender ? "当前集可交付" : "当前集待补齐"}</span>
              <span className="pill">归档 {exportBundle?.archiveCount || 0}</span>
            </div>
            <div className="resource-delivery-actions">
              <button className="primary" onClick={() => onOpenExportCenter?.()}>打开成片导出</button>
              <button onClick={() => exportDeliveryItem("archive")}>导出归档包</button>
            </div>
          </section>
          {deliveryEntries.length ? deliveryEntries.map((entry) => (
            <section key={entry.id} className={`resource-delivery-card status-${entry.status}`}>
              <div className="resource-delivery-topline">
                <strong>{entry.title}</strong>
                <span className={`pill ${entry.status === "ready" ? "pill-ok" : entry.status === "pending" ? "pill-warn" : "timeline-pill-danger"}`}>
                  {entry.status === "ready" ? "就绪" : entry.status === "pending" ? "待处理" : "缺口"}
                </span>
              </div>
              <p>{entry.detail}</p>
              <div className="resource-delivery-actions">
                <button onClick={() => exportDeliveryItem(entry.action)}>{entry.action === "openExport" ? "去导出中心" : "导出"}</button>
                <button onClick={() => copyText(entry.detail, `${entry.title}说明`)}>复制说明</button>
              </div>
            </section>
          )) : <div className="asset-empty">当前筛选下没有交付资源。</div>}
        </div>
      ) : (
      <div className="resource-list">
        {resources.length ? resources.map((resource) => (
          <section key={resource.id} className={`resource-item ${resource.referenceCount ? "used" : ""} ${resource.missing ? "missing" : ""}`}>
            <div className="resource-preview">
              {resource.kind === "image" && resource.previewUrl && <img src={resource.thumbnailUrl || resource.previewUrl} alt="" />}
              {resource.kind === "video" && resource.previewUrl && <video src={resource.previewUrl} muted playsInline preload="metadata" />}
              {!resource.previewUrl && (
                <div className="resource-placeholder">
                  <span>{helpers.resourceKindShort(resource.kind)}</span>
                </div>
              )}
            </div>
            <div className="resource-main">
              <div className="resource-topline">
                <input value={resource.name} onChange={(event) => onUpdateResource(resource.id, { name: event.target.value })} />
                <span className={`resource-kind kind-${resource.kind}`}>{helpers.resourceKindLabel(resource.kind)}</span>
              </div>
              <div className="resource-meta-grid">
                <label>
                  Token
                  <input value={resource.token} onChange={(event) => onUpdateResource(resource.id, { token: event.target.value })} />
                </label>
                <label>
                  归属
                  <select value={resource.episodeId || ""} onChange={(event) => onUpdateResource(resource.id, { episodeId: event.target.value })}>
                    <option value="">全项目</option>
                    {episodes.map((episode) => <option key={episode.id} value={episode.id}>{episode.name}</option>)}
                  </select>
                </label>
                <label>
                  场次
                  <input value={resource.scene || ""} placeholder="如：S03 旧巷对峙" onChange={(event) => onUpdateResource(resource.id, { scene: event.target.value })} />
                </label>
                <label>
                  镜头
                  <input value={resource.shot || ""} placeholder="如：A12" onChange={(event) => onUpdateResource(resource.id, { shot: event.target.value })} />
                </label>
              </div>
              <textarea value={resource.note || ""} placeholder="备注、风格锚点、使用说明" onChange={(event) => onUpdateResource(resource.id, { note: event.target.value })} />
              <div className="resource-tags-line">
                <input value={resource.tags || ""} placeholder="标签，用空格分隔：主角 夜景 写实 参考图" onChange={(event) => onUpdateResource(resource.id, { tags: event.target.value })} />
              </div>
              <div className="resource-footer">
                <div className="resource-flags">
                  <code>{resource.token}</code>
                  <span>{resource.storageMode === "metadata" ? "仅元信息" : "已内置"}</span>
                  <span>{helpers.formatBytes(resource.size)}</span>
                  <span>引用 {resource.referenceCount}</span>
                </div>
                <div className="resource-actions">
                  <button onClick={() => copyText(resource.token, `${resource.name} Token`)}>复制引用</button>
                  <button onClick={() => copyText(resource.note || resource.name, `${resource.name}备注`)}>复制备注</button>
                  <button className="danger" onClick={() => onDeleteResource(resource.id)}>删除</button>
                </div>
              </div>
              {resource.references.length ? (
                <div className="resource-reference-list">
                  {resource.references.slice(0, 3).map((reference) => (
                    <button key={`${resource.id}-${reference.nodeId}-${reference.path}`} onClick={() => onLocateNode(reference.nodeId)}>
                      <span>{reference.nodeTitle}</span>
                      <strong>{reference.path}</strong>
                    </button>
                  ))}
                  {resource.references.length > 3 && <small>还有 {resource.references.length - 3} 处引用</small>}
                </div>
              ) : (
                <div className={`resource-reference-empty ${resource.missing ? "missing" : ""}`}>
                  {resource.missing ? `检测到 ${resource.missingMentions.length} 处缺失引用，建议补回资源或修正 Token。` : "暂时还没有节点引用这个资源。"}
                </div>
              )}
            </div>
          </section>
        )) : <div className="asset-empty">当前筛选条件下还没有资源。先导入图片、视频、模板或脚本文档。</div>}
      </div>
      )}
      {resourceIndex.missingRefs.length ? (
        <div className="resource-missing-block">
          <strong>缺失资源引用</strong>
          <div className="resource-missing-list">
            {resourceIndex.missingRefs.slice(0, 8).map((reference, index) => (
              <button key={`${reference.token}-${reference.nodeId}-${index}`} onClick={() => onLocateNode(reference.nodeId)}>
                <code>{reference.token}</code>
                <span>{reference.nodeTitle} · {reference.path}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {message && <p className="asset-drawer-tip">{message}</p>}
    </aside>
  ), document.body);
}
