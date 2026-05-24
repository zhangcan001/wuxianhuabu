import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  addApiWorkspaceToLibrary,
  createApiWorkspaceEntry,
  loadApiWorkspaceLibrary,
  normalizeApiWorkspaceLibrary,
  saveApiWorkspaceLibrary,
} from "./api-workspace-library.js";
import { applyMediaCacheReviewDecisions, getMediaCacheFileKey } from "./project-media-index-helpers.js";

const MEDIA_CACHE_REVIEW_KEY = "wuxianhuabu.mediaCacheReview.v1";
const MEDIA_CACHE_DELETE_AUDIT_KEY = "wuxianhuabu.mediaCacheDeleteAudit.v1";
const CUSTOM_API_DIAGNOSTIC_HISTORY_KEY = "wuxianhuabu.customApiDiagnosticHistory.v1";
const CUSTOM_API_DIAGNOSTIC_HISTORY_LIMIT = 8;
const API_PROFILE_LIBRARY_KEY = "wuxianhuabu.apiProfileLibrary.v1";

export function DebugTracePanel({ enabled, entries, onToggleEnabled, onClear, onClose }) {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return (Array.isArray(entries) ? entries : []).filter((entry) => {
      if (!keyword) return true;
      const haystack = `${entry.time || ""} ${entry.event || ""} ${JSON.stringify(entry.payload || {})}`.toLowerCase();
      return haystack.includes(keyword);
    }).slice().reverse();
  }, [entries, query]);

  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(`已复制：${label}`);
    } catch (error) {
      setMessage(error.message || "复制失败");
    }
  }

  async function copyAll() {
    await copyText(JSON.stringify(entries || [], null, 2), "全部日志 JSON");
  }

  return createPortal((
    <div className="debug-trace-backdrop">
      <section className="debug-trace-panel">
        <header>
          <div>
            <strong>调试日志面板</strong>
            <span>{entries?.length || 0} 条事件 · 实时查看 window.__WUXIAN_TRACE__</span>
          </div>
          <div className="debug-trace-header-actions">
            <button className={enabled ? "active" : ""} onClick={onToggleEnabled}>{enabled ? "日志采集 开" : "日志采集 关"}</button>
            <button onClick={copyAll} disabled={!entries?.length}>复制全部</button>
            <button onClick={onClear} disabled={!entries?.length}>清空</button>
            <button onClick={onClose}>关闭</button>
          </div>
        </header>
        <div className="debug-trace-toolbar">
          <input value={query} placeholder="搜索事件名、时间、payload 内容" onChange={(event) => setQuery(event.target.value)} />
          <div className="debug-trace-stats">
            <span className={`pill ${enabled ? "pill-ok" : "pill-warn"}`}>{enabled ? "实时记录中" : "当前关闭"}</span>
            <span className="pill">当前显示 {filtered.length}</span>
          </div>
        </div>
        <div className="debug-trace-tip">
          <code>window.__WUXIAN_TRACE__</code>
          <span>保留最近关键链路事件，适合排查队列、工程读写、节点联动和时间线导出。</span>
        </div>
        <div className="debug-trace-list">
          {filtered.length ? filtered.map((entry, index) => (
            <section key={`${entry.time}-${entry.event}-${index}`} className="debug-trace-item">
              <div className="debug-trace-item-topline">
                <strong>{entry.event || "unknown"}</strong>
                <span>{entry.time || "-"}</span>
              </div>
              <pre>{JSON.stringify(entry.payload || {}, null, 2)}</pre>
              <div className="debug-trace-actions">
                <button onClick={() => copyText(entry.event || "", "事件名")}>复制事件名</button>
                <button onClick={() => copyText(JSON.stringify(entry, null, 2), "单条日志 JSON")}>复制 JSON</button>
              </div>
            </section>
          )) : <div className="asset-empty">当前没有匹配的调试日志。打开日志采集后执行一次工程打开、队列生成或导出，就会在这里看到链路事件。</div>}
        </div>
        {message && <p className="asset-drawer-tip">{message}</p>}
      </section>
    </div>
  ), document.body);
}

export function GlobalAssetPanel({ assetIndex, onClose, helpers }) {
  const [tab, setTab] = useState("characters");
  const [message, setMessage] = useState("");
  const assets = helpers.assetListByTab(tab, assetIndex);

  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(`已复制：${label}`);
    } catch (error) {
      setMessage(error.message || "复制失败");
    }
  }

  return createPortal((
    <aside className="asset-drawer">
      <header>
        <div>
          <strong>全局资产库</strong>
          <span>{assetIndex.characters.length} 个人物 · {assetIndex.scenes.length} 个场景 · {assetIndex.props.length} 个道具</span>
        </div>
        <button onClick={onClose}>关闭</button>
      </header>
      <div className="asset-health-strip">
        <span>未引用 {assetIndex.unused?.length || 0}</span>
        <span>待补锁定 {assetIndex.weakLocks?.length || 0}</span>
        <span>缺失引用 {assetIndex.missingRefs?.length || 0}</span>
      </div>
      <div className="asset-drawer-tabs">
        <button className={tab === "characters" ? "active" : ""} onClick={() => setTab("characters")}>人物</button>
        <button className={tab === "scenes" ? "active" : ""} onClick={() => setTab("scenes")}>场景</button>
        <button className={tab === "props" ? "active" : ""} onClick={() => setTab("props")}>道具</button>
      </div>
      <div className="asset-drawer-list">
        {assets.length ? assets.map((asset, index) => (
          <section key={`${asset.token}-${index}`} className="asset-drawer-item">
            <div>
              <strong>{asset.name}</strong>
              <code>{asset.token}</code>
            </div>
            {asset.imageUrl && <img src={asset.imageUrl} alt="" />}
            {asset.meta && <p>{asset.meta}</p>}
            {asset.visualLock && <p>视觉锁定：{asset.visualLock}</p>}
            {asset.continuityRule && <p>连续性：{asset.continuityRule}</p>}
            <div className="asset-drawer-meta">
              <span>引用 {asset.referenceCount || 0}</span>
              <span className={asset.missingFields?.length ? "bad" : "good"}>{asset.missingFields?.length ? `待补 ${asset.missingFields.length} 项` : "锁定完整"}</span>
            </div>
            {!!asset.references?.length && (
              <div className="asset-impact-list">
                {asset.references.slice(0, 3).map((reference, refIndex) => (
                  <span key={`${asset.token}-${reference.nodeId}-${refIndex}`}>{reference.nodeTitle} · {reference.path}</span>
                ))}
              </div>
            )}
            <div className="asset-drawer-actions">
              <button onClick={() => copyText(asset.token, `${asset.name}引用`)}>复制引用</button>
              <button onClick={() => copyText(asset.prompt, `${asset.name}提示词`)}>复制提示词</button>
            </div>
          </section>
        )) : <div className="asset-empty">暂无资产。先从“小说转剧本”输出到资产库。</div>}
      </div>
      <p className="asset-drawer-tip">在 AI 生图或分镜里输入 {helpers.makeAssetToken(helpers.assetCategoryByTab(tab), "名字")}，生成时会自动展开为资产提示词。</p>
      {message && <small className="result-message">{message}</small>}
    </aside>
  ), document.body);
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

function loadCustomApiDiagnosticHistory() {
  try {
    const raw = localStorage.getItem(CUSTOM_API_DIAGNOSTIC_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCustomApiDiagnosticHistory(entries) {
  try {
    localStorage.setItem(CUSTOM_API_DIAGNOSTIC_HISTORY_KEY, JSON.stringify(entries || []));
  } catch {
    // Diagnostic history is only a convenience layer for repeated API debugging.
  }
}

function createApiProfileId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeApiProfileLibrary(raw) {
  const library = raw && typeof raw === "object" ? raw : {};
  return {
    textProfiles: Array.isArray(library.textProfiles) ? library.textProfiles : [],
    mediaProfiles: Array.isArray(library.mediaProfiles) ? library.mediaProfiles : [],
    activeTextProfileId: String(library.activeTextProfileId || ""),
    activeMediaProfileId: String(library.activeMediaProfileId || ""),
  };
}

function loadApiProfileLibrary() {
  try {
    const raw = localStorage.getItem(API_PROFILE_LIBRARY_KEY);
    return normalizeApiProfileLibrary(raw ? JSON.parse(raw) : {});
  } catch {
    return normalizeApiProfileLibrary({});
  }
}

function saveApiProfileLibrary(library) {
  try {
    localStorage.setItem(API_PROFILE_LIBRARY_KEY, JSON.stringify(normalizeApiProfileLibrary(library)));
  } catch {
    // Profile presets are a convenience layer and should not block settings editing.
  }
}

function buildTextApiProfileSnapshot(settings = {}) {
  return {
    factoryMode: settings.factoryMode || "local",
    apiProvider: settings.apiProvider || "openai",
    apiBaseUrl: settings.apiBaseUrl || "",
    apiUrl: settings.apiUrl || "",
    apiKey: settings.apiKey || "",
    apiKeySaved: Boolean(settings.apiKeySaved || settings.apiKey),
    apiKeyClear: false,
    authType: settings.authType || "bearer",
    headersJson: settings.headersJson || "",
    apiModel: settings.apiModel || "",
    bodyTemplate: settings.bodyTemplate || "",
    responsePath: settings.responsePath || "",
    schema: settings.schema || "",
  };
}

function buildMediaApiProfileSnapshot(settings = {}) {
  return {
    providerMode: settings.providerMode || "mock",
    customApiUrl: settings.customApiUrl || "",
    customApiKey: settings.customApiKey || "",
    customApiKeySaved: Boolean(settings.customApiKeySaved || settings.customApiKey),
    customApiKeyClear: false,
    customAuthType: settings.customAuthType || "bearer",
    customHeadersJson: settings.customHeadersJson || "",
    customModel: settings.customModel || "",
    customApiKind: settings.customApiKind || "direct-image",
    customResultMode: settings.customResultMode || "auto",
    customImagePath: settings.customImagePath || "",
    customBodyTemplate: settings.customBodyTemplate || "",
    comfyEnabled: Boolean(settings.comfyEnabled),
    comfyBaseUrl: settings.comfyBaseUrl || "",
    positiveNodeId: settings.positiveNodeId || "",
    workflowJson: settings.workflowJson || "",
    comfyImagePositiveNodeId: settings.comfyImagePositiveNodeId || "",
    comfyImageWorkflowJson: settings.comfyImageWorkflowJson || "",
    comfyVideoPositiveNodeId: settings.comfyVideoPositiveNodeId || "",
    comfyVideoWorkflowJson: settings.comfyVideoWorkflowJson || "",
    comfyTimeoutSeconds: settings.comfyTimeoutSeconds || "",
  };
}

function sanitizeImportedProfileName(value, fallback) {
  const name = String(value || "").trim();
  return name || fallback;
}

function parseImportedApiProfile(rawText, expectedKind) {
  const parsed = JSON.parse(rawText);
  const payload = parsed?.profile ? parsed : { kind: expectedKind, profile: parsed };
  if (payload.kind !== expectedKind) {
    throw new Error(`导入文件不是${expectedKind === "text" ? "文本" : "图片/视频"}配置。`);
  }
  if (!payload.profile || typeof payload.profile !== "object") {
    throw new Error("导入文件缺少 profile 配置内容。");
  }
  return payload.profile;
}

function parseImportedApiWorkspace(rawText) {
  const parsed = JSON.parse(rawText);
  const payload = parsed?.workspace ? parsed : { kind: "workspace", workspace: parsed };
  if (payload.kind !== "workspace") {
    throw new Error("导入文件不是整套工作配置。");
  }
  if (!payload.workspace || typeof payload.workspace !== "object") {
    throw new Error("导入文件缺少 workspace 配置内容。");
  }
  return payload.workspace;
}

function summarizeTextSettings(settings = {}) {
  const mode = settings.factoryMode === "api" ? "API" : "本地";
  const provider = settings.apiProvider || "openai";
  const model = settings.apiModel || "未填模型";
  return `${mode} · ${provider} · ${model}`;
}

function summarizeMediaSettings(settings = {}) {
  const providerMode = settings.comfyEnabled ? "comfy" : (settings.providerMode || "mock");
  if (providerMode === "comfy" || settings.comfyEnabled) {
    return `ComfyUI · ${settings.comfyBaseUrl || "未填地址"} · 图${settings.comfyImagePositiveNodeId || settings.positiveNodeId || "-"} / 视${settings.comfyVideoPositiveNodeId || "-"}`;
  }
  if (providerMode === "custom") {
    return `HTTP API · ${settings.customApiKind || "direct-image"} · ${settings.customModel || "未填模型"}`;
  }
  return "本地模拟";
}

function summarizeWorkspace(workspace = {}) {
  return {
    text: summarizeTextSettings(workspace.textSettings || {}),
    media: summarizeMediaSettings(workspace.mediaSettings || {}),
  };
}

function indexKindLabel(kind) {
  if (kind === "node") return "节点";
  if (kind === "shot") return "镜头";
  if (kind === "timelineClip") return "时间线";
  if (kind === "resource") return "资源";
  if (kind === "task") return "任务";
  if (kind === "media") return "媒体";
  if (kind === "mediaReference") return "媒体引用";
  return "索引";
}

export function GlobalSearchPanel({ nodes, assetIndex, resourceIndex, projectIndexSummary, onSearchProjectIndex, onOpenIndexResult, onLocate, onClose, helpers }) {
  const [query, setQuery] = useState("");
  const [sqliteItems, setSqliteItems] = useState([]);
  const [sqliteStatus, setSqliteStatus] = useState("");
  const [indexTypeFilter, setIndexTypeFilter] = useState("all");
  const [message, setMessage] = useState("");
  const entries = useMemo(() => helpers.buildSearchEntries(nodes, assetIndex, resourceIndex), [nodes, assetIndex, resourceIndex, helpers]);
  const runtimeFiltered = entries
    .filter((entry) => !query.trim() || `${entry.title} ${entry.subtitle} ${entry.kind}`.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 80);
  const sqliteEntries = useMemo(() => sqliteItems
    .filter((item) => indexTypeFilter === "all" || item.kind === indexTypeFilter)
    .map(sqliteSearchItemToEntry), [sqliteItems, indexTypeFilter]);
  const useSqliteResults = Boolean(query.trim() && projectIndexSummary && onSearchProjectIndex && !sqliteStatus);
  const filtered = useSqliteResults ? sqliteEntries : runtimeFiltered;

  useEffect(() => {
    if (!query.trim() || !projectIndexSummary || !onSearchProjectIndex) {
      setSqliteItems([]);
      setSqliteStatus("");
      return undefined;
    }
    let cancelled = false;
    setSqliteStatus("正在查询 SQLite 索引...");
    const timer = window.setTimeout(() => {
      onSearchProjectIndex(query.trim())
        .then((result) => {
          if (cancelled) return;
          setSqliteItems(Array.isArray(result?.items) ? result.items : []);
          setSqliteStatus("");
        })
        .catch((error) => {
          if (cancelled) return;
          setSqliteItems([]);
          setSqliteStatus(error.message || "SQLite 查询失败，已使用运行时搜索兜底");
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, projectIndexSummary, onSearchProjectIndex]);

  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text || "");
      setMessage(`已复制：${label}`);
    } catch (error) {
      setMessage(error.message || "复制失败");
    }
  }

  function openEntry(entry) {
    if (entry.indexItem && onOpenIndexResult) {
      onOpenIndexResult(entry.indexItem);
      return;
    }
    if (entry.nodeId) {
      onLocate(entry.nodeId);
      return;
    }
    copyText(entry.path || entry.subtitle || entry.title, entry.kind);
  }

  return createPortal((
    <div className="search-backdrop">
      <section className="search-panel">
        <header>
          <strong>全局搜索</strong>
          <button onClick={onClose}>关闭</button>
        </header>
        <input autoFocus value={query} placeholder="搜索节点、角色、场景、道具、镜头号" onChange={(event) => setQuery(event.target.value)} />
        {query.trim() && projectIndexSummary ? (
          <p className="asset-drawer-tip">{sqliteStatus || `SQLite 索引结果 ${sqliteEntries.length} 条 · 更新时间 ${projectIndexSummary.updatedAt ? new Date(projectIndexSummary.updatedAt * 1000).toLocaleString() : "待同步"}`}</p>
        ) : null}
        {query.trim() && projectIndexSummary ? (
          <div className="asset-drawer-tabs resource-tabs">
            {[
              ["all", "全部"],
              ["node", "节点"],
              ["shot", "镜头"],
              ["timelineClip", "时间线"],
              ["resource", "资源"],
              ["task", "任务"],
              ["media", "媒体"],
              ["mediaReference", "引用"],
            ].map(([key, label]) => (
              <button key={key} className={indexTypeFilter === key ? "active" : ""} onClick={() => setIndexTypeFilter(key)}>{label}</button>
            ))}
          </div>
        ) : null}
        <div className="search-results">
          {filtered.length ? filtered.map((entry) => (
            <button key={`${entry.kind}-${entry.id}-${entry.title}`} onClick={() => openEntry(entry)}>
              <span>{entry.kind}</span>
              <strong>{entry.title}</strong>
              <em>{entry.subtitle}</em>
            </button>
          )) : <div className="asset-empty">没有找到结果</div>}
        </div>
        {message && <small className="result-message">{message}</small>}
      </section>
    </div>
  ), document.body);
}

function sqliteSearchItemToEntry(item) {
  const raw = parseRawJson(item.rawJson);
  return {
    id: item.id,
    nodeId: item.kind === "task" || item.kind === "node" ? item.path : raw.nodeId || raw.sourceNodeId || "",
    kind: indexKindLabel(item.kind),
    title: item.title || item.id,
    subtitle: `${item.subtitle || ""}${item.path ? ` · ${item.path}` : ""}`,
    path: item.path || "",
    indexItem: item,
  };
}

function parseRawJson(rawJson) {
  try {
    return rawJson ? JSON.parse(rawJson) : {};
  } catch {
    return {};
  }
}

export function PromptPreviewPanel({ preview, assetIndex, onClose, helpers }) {
  const [message, setMessage] = useState("");
  const analysis = helpers.analyzePromptReferences(preview.original || "", assetIndex);
  const expanded = helpers.expandAssetReferences(preview.original || "", assetIndex);
  const weakAssets = analysis.used.filter((asset) => (asset.missingFields || []).length);

  async function copy(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(`已复制${label}`);
    } catch (error) {
      setMessage(error.message || "复制失败");
    }
  }

  return createPortal((
    <div className="prompt-preview-backdrop">
      <section className="prompt-preview-panel">
        <header>
          <div>
            <strong>{preview.title || "提示词预览"}</strong>
            <span>{preview.params || "生成前检查引用与展开结果"}</span>
          </div>
          <button onClick={onClose}>关闭</button>
        </header>
        <div className="prompt-health">
          <span className={analysis.missing.length ? "bad" : "good"}>{analysis.missing.length ? `缺失 ${analysis.missing.length}` : "引用完整"}</span>
          <span>命中资产 {analysis.used.length}</span>
          <span className={weakAssets.length ? "bad" : "good"}>{weakAssets.length ? `弱锁定 ${weakAssets.length}` : "锁定稳定"}</span>
          <span>检测引用 {analysis.tokens.length}</span>
        </div>
        <div className="prompt-assets">
          <section>
            <h3>命中资产</h3>
            {analysis.used.length ? analysis.used.map((asset) => <code key={asset.token}>{asset.token}</code>) : <p>暂无命中资产</p>}
          </section>
          <section>
            <h3>缺失引用</h3>
            {analysis.missing.length ? analysis.missing.map((token) => <code key={token} className="missing">{token}</code>) : <p>没有缺失引用</p>}
          </section>
          <section>
            <h3>待补资产</h3>
            {weakAssets.length ? weakAssets.map((asset) => <code key={asset.token} className="missing">{asset.token}</code>) : <p>没有弱锁定资产</p>}
          </section>
        </div>
        <div className="prompt-preview-grid">
          <label>原始提示词<textarea readOnly value={preview.original || ""} /></label>
          <label>展开后提示词<textarea readOnly value={expanded} /></label>
        </div>
        <label className="prompt-negative">负面提示词<textarea readOnly value={preview.negative || ""} /></label>
        <div className="prompt-preview-actions">
          <button onClick={() => copy(preview.original || "", "原始提示词")}>复制原始</button>
          <button onClick={() => copy(expanded, "展开提示词")}>复制展开</button>
          <button onClick={() => copy(preview.negative || "", "负面提示词")}>复制负面</button>
        </div>
        {message && <small className="result-message">{message}</small>}
      </section>
    </div>
  ), document.body);
}

export function SettingsPanel({ settings, setSettings, textApiSettings, patchTextApiSettings, focusSection = "image", onBackToRoot, onClose, helpers }) {
  const [message, setMessage] = useState("");
  const [testing, setTesting] = useState("");
  const [customApiDiagnostic, setCustomApiDiagnostic] = useState(null);
  const [customApiDiagnosticHistory, setCustomApiDiagnosticHistory] = useState(() => loadCustomApiDiagnosticHistory());
  const [apiProfileLibrary, setApiProfileLibrary] = useState(() => loadApiProfileLibrary());
  const [apiWorkspaceLibrary, setApiWorkspaceLibrary] = useState(() => loadApiWorkspaceLibrary());
  const autoSaveReadyRef = useRef(false);
  const textGroupRef = useRef(null);
  const imageGroupRef = useRef(null);
  const videoGroupRef = useRef(null);
  const importTextProfileInputRef = useRef(null);
  const importMediaProfileInputRef = useRef(null);
  const importWorkspaceInputRef = useRef(null);
  const textProvider = textApiSettings?.apiProvider || "openai";
  const textProviderPreset = helpers.NOVEL_API_PROVIDERS[textProvider] || helpers.NOVEL_API_PROVIDERS.openai;
  const textApiBaseUrl = textApiSettings?.apiBaseUrl || textProviderPreset.baseUrl;
  const textApiUrl = textApiSettings?.apiUrl || helpers.buildNovelChatCompletionsUrl(textApiBaseUrl);
  const textApiKeySaved = Boolean(textApiSettings?.apiKeySaved || textApiSettings?.apiKey);
  const textProviderUnsupported = Boolean(textProviderPreset?.unsupportedInApp);
  const sectionRefs = { text: textGroupRef, image: imageGroupRef, video: videoGroupRef };
  const activeTextProfile = useMemo(
    () => apiProfileLibrary.textProfiles.find((item) => item.id === apiProfileLibrary.activeTextProfileId) || null,
    [apiProfileLibrary],
  );
  const activeMediaProfile = useMemo(
    () => apiProfileLibrary.mediaProfiles.find((item) => item.id === apiProfileLibrary.activeMediaProfileId) || null,
    [apiProfileLibrary],
  );
  const activeWorkspace = useMemo(
    () => apiWorkspaceLibrary.workspaces.find((item) => item.id === apiWorkspaceLibrary.activeWorkspaceId) || null,
    [apiWorkspaceLibrary],
  );
  const activeWorkspaceSummary = useMemo(
    () => activeWorkspace ? summarizeWorkspace(activeWorkspace) : null,
    [activeWorkspace],
  );

  useEffect(() => {
    if (focusSection === "root") {
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
      return;
    }
    const target = sectionRefs[focusSection]?.current;
    if (!target) return;
    window.setTimeout(() => target.scrollIntoView({ block: "start", behavior: "smooth" }), 80);
  }, [focusSection]);

  useEffect(() => {
    function handleEsc(event) {
      if (event.key !== "Escape") return;
      if (focusSection !== "root") {
        event.preventDefault();
        onBackToRoot?.();
        setMessage("已返回一级设置页");
      }
    }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [focusSection, onBackToRoot]);

  useEffect(() => {
    if (!autoSaveReadyRef.current) {
      autoSaveReadyRef.current = true;
      return;
    }
    const timer = window.setTimeout(() => {
      helpers.saveBackendAiConfig(settings)
        .then(() => setMessage("图片/视频 API 设置已自动保存到本地"))
        .catch((error) => setMessage(`图片/视频 API 自动保存失败：${error.message}`));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [settings, helpers]);

  function patch(next) {
    setSettings((current) => ({ ...current, ...next }));
  }

  function patchMediaProviderMode(mode = "custom") {
    if (mode === "comfy") {
      patch({
        providerMode: "comfy",
        comfyEnabled: true,
        comfyBaseUrl: settings.comfyBaseUrl || "http://127.0.0.1:8188",
      });
      return;
    }
    if (mode === "mock") {
      patch({ providerMode: "mock", comfyEnabled: false });
      return;
    }
    patch({ providerMode: "custom", comfyEnabled: false });
  }

  function updateApiProfileLibrary(updater) {
    setApiProfileLibrary((current) => {
      const next = normalizeApiProfileLibrary(updater(current));
      saveApiProfileLibrary(next);
      return next;
    });
  }

  function updateApiWorkspaceLibrary(updater) {
    setApiWorkspaceLibrary((current) => {
      const next = normalizeApiWorkspaceLibrary(updater(current));
      saveApiWorkspaceLibrary(next);
      return next;
    });
  }

  function downloadProfileJson(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function switchTextProfile(profileId) {
    const profile = apiProfileLibrary.textProfiles.find((item) => item.id === profileId);
    updateApiProfileLibrary((current) => ({ ...current, activeTextProfileId: profileId || "" }));
    if (!profile) {
      setMessage("已取消文本 API 配置绑定");
      return;
    }
    patchTextApiSettings?.(buildTextApiProfileSnapshot(profile.settings || {}));
    setMessage(`已切换文本 API 配置：${profile.name}`);
  }

  async function switchMediaProfile(profileId) {
    const profile = apiProfileLibrary.mediaProfiles.find((item) => item.id === profileId);
    updateApiProfileLibrary((current) => ({ ...current, activeMediaProfileId: profileId || "" }));
    if (!profile) {
      setMessage("已取消图片/视频 API 配置绑定");
      return;
    }
    const nextSettings = buildMediaApiProfileSnapshot(profile.settings || {});
    setSettings((current) => ({ ...current, ...nextSettings }));
    try {
      await helpers.saveBackendAiConfig(nextSettings);
      setMessage(`已切换图片/视频配置：${profile.name}`);
    } catch (error) {
      setMessage(`切换图片/视频配置失败：${error.message}`);
    }
  }

  function saveCurrentTextProfileAsNew() {
    const name = window.prompt("请输入文本 API 配置名称", `${textProviderPreset.label || "文本"}配置`);
    if (!name || !name.trim()) return;
    const entry = {
      id: createApiProfileId("text"),
      name: name.trim(),
      updatedAt: new Date().toISOString(),
      settings: buildTextApiProfileSnapshot(textApiSettings || {}),
    };
    updateApiProfileLibrary((current) => ({
      ...current,
      activeTextProfileId: entry.id,
      textProfiles: [entry, ...current.textProfiles],
    }));
    setMessage(`已保存文本 API 配置：${entry.name}`);
  }

  function saveCurrentMediaProfileAsNew() {
    const name = window.prompt("请输入图片/视频配置名称", `${settings.customModel || "图片视频"}配置`);
    if (!name || !name.trim()) return;
    const entry = {
      id: createApiProfileId("media"),
      name: name.trim(),
      updatedAt: new Date().toISOString(),
      settings: buildMediaApiProfileSnapshot(settings || {}),
    };
    updateApiProfileLibrary((current) => ({
      ...current,
      activeMediaProfileId: entry.id,
      mediaProfiles: [entry, ...current.mediaProfiles],
    }));
    setMessage(`已保存图片/视频配置：${entry.name}`);
  }

  function renameActiveTextProfile() {
    if (!activeTextProfile) return;
    const name = window.prompt("请输入新的文本配置名称", activeTextProfile.name || "文本配置");
    if (!name || !name.trim()) return;
    updateApiProfileLibrary((current) => ({
      ...current,
      textProfiles: current.textProfiles.map((item) => (
        item.id === activeTextProfile.id ? { ...item, name: name.trim(), updatedAt: new Date().toISOString() } : item
      )),
    }));
    setMessage(`已重命名文本 API 配置：${name.trim()}`);
  }

  function renameActiveMediaProfile() {
    if (!activeMediaProfile) return;
    const name = window.prompt("请输入新的图片/视频配置名称", activeMediaProfile.name || "图片视频配置");
    if (!name || !name.trim()) return;
    updateApiProfileLibrary((current) => ({
      ...current,
      mediaProfiles: current.mediaProfiles.map((item) => (
        item.id === activeMediaProfile.id ? { ...item, name: name.trim(), updatedAt: new Date().toISOString() } : item
      )),
    }));
    setMessage(`已重命名图片/视频配置：${name.trim()}`);
  }

  function exportTextProfile() {
    const profile = activeTextProfile || {
      id: createApiProfileId("text-export"),
      name: sanitizeImportedProfileName(textProviderPreset.label, "文本配置"),
      updatedAt: new Date().toISOString(),
      settings: buildTextApiProfileSnapshot(textApiSettings || {}),
    };
    downloadProfileJson(`${profile.name.replace(/[\\/:*?"<>|]+/g, "-") || "text-profile"}.json`, {
      kind: "text",
      version: 1,
      exportedAt: new Date().toISOString(),
      profile,
    });
    setMessage(`已导出文本 API 配置：${profile.name}`);
  }

  function exportMediaProfile() {
    const profile = activeMediaProfile || {
      id: createApiProfileId("media-export"),
      name: sanitizeImportedProfileName(settings.customModel, "图片视频配置"),
      updatedAt: new Date().toISOString(),
      settings: buildMediaApiProfileSnapshot(settings || {}),
    };
    downloadProfileJson(`${profile.name.replace(/[\\/:*?"<>|]+/g, "-") || "media-profile"}.json`, {
      kind: "media",
      version: 1,
      exportedAt: new Date().toISOString(),
      profile,
    });
    setMessage(`已导出图片/视频配置：${profile.name}`);
  }

  function openTextProfileImport() {
    importTextProfileInputRef.current?.click();
  }

  function openMediaProfileImport() {
    importMediaProfileInputRef.current?.click();
  }

  function openWorkspaceImport() {
    importWorkspaceInputRef.current?.click();
  }

  function importTextProfileFromText(text) {
    const imported = parseImportedApiProfile(text, "text");
    const entry = {
      id: createApiProfileId("text"),
      name: sanitizeImportedProfileName(imported.name, "导入的文本配置"),
      updatedAt: new Date().toISOString(),
      settings: buildTextApiProfileSnapshot(imported.settings || imported),
    };
    updateApiProfileLibrary((current) => ({
      ...current,
      activeTextProfileId: entry.id,
      textProfiles: [entry, ...current.textProfiles],
    }));
    patchTextApiSettings?.(entry.settings);
    setMessage(`已导入文本 API 配置：${entry.name}`);
  }

  function importMediaProfileFromText(text) {
    const imported = parseImportedApiProfile(text, "media");
    const entry = {
      id: createApiProfileId("media"),
      name: sanitizeImportedProfileName(imported.name, "导入的图片视频配置"),
      updatedAt: new Date().toISOString(),
      settings: buildMediaApiProfileSnapshot(imported.settings || imported),
    };
    updateApiProfileLibrary((current) => ({
      ...current,
      activeMediaProfileId: entry.id,
      mediaProfiles: [entry, ...current.mediaProfiles],
    }));
    setSettings((current) => ({ ...current, ...entry.settings }));
    helpers.saveBackendAiConfig(entry.settings)
      .then(() => setMessage(`已导入图片/视频配置：${entry.name}`))
      .catch((error) => setMessage(`图片/视频配置已导入，但写入当前设置失败：${error.message}`));
  }

  async function applyWorkspace(entry) {
    if (!entry) {
      updateApiWorkspaceLibrary((current) => ({ ...current, activeWorkspaceId: "" }));
      setMessage("已取消整套工作配置绑定");
      return;
    }
    patchTextApiSettings?.(buildTextApiProfileSnapshot(entry.textSettings || {}));
    const nextMediaSettings = buildMediaApiProfileSnapshot(entry.mediaSettings || {});
    setSettings((current) => ({ ...current, ...nextMediaSettings }));
    updateApiWorkspaceLibrary((current) => ({ ...current, activeWorkspaceId: entry.id }));
    try {
      await helpers.saveBackendAiConfig(nextMediaSettings);
      setMessage(`已切换整套工作配置：${entry.name}`);
    } catch (error) {
      setMessage(`整套工作配置已切换，但图片/视频写入失败：${error.message}`);
    }
  }

  async function switchWorkspace(workspaceId) {
    const entry = apiWorkspaceLibrary.workspaces.find((item) => item.id === workspaceId) || null;
    await applyWorkspace(entry);
  }

  function saveCurrentWorkspaceAsNew() {
    const name = window.prompt("请输入整套工作配置名称", `${textProviderPreset.label || "文本"} + ${settings.customModel || "图片视频"}`);
    if (!name || !name.trim()) return;
    const entry = createApiWorkspaceEntry({
      id: createApiProfileId("workspace"),
      name: name.trim(),
      textSettings: buildTextApiProfileSnapshot(textApiSettings || {}),
      mediaSettings: buildMediaApiProfileSnapshot(settings || {}),
    });
    updateApiWorkspaceLibrary((current) => addApiWorkspaceToLibrary(current, entry));
    setMessage(`已创建新工作区：${entry.name}`);
  }

  function overwriteActiveWorkspace() {
    if (!activeWorkspace) {
      saveCurrentWorkspaceAsNew();
      return;
    }
    updateApiWorkspaceLibrary((current) => ({
      ...current,
      workspaces: current.workspaces.map((item) => (
        item.id === activeWorkspace.id
          ? {
              ...item,
              updatedAt: new Date().toISOString(),
              textSettings: buildTextApiProfileSnapshot(textApiSettings || {}),
              mediaSettings: buildMediaApiProfileSnapshot(settings || {}),
            }
          : item
      )),
    }));
    setMessage(`已覆盖整套工作配置：${activeWorkspace.name}`);
  }

  function renameActiveWorkspace() {
    if (!activeWorkspace) return;
    const name = window.prompt("请输入新的整套工作配置名称", activeWorkspace.name || "整套工作配置");
    if (!name || !name.trim()) return;
    updateApiWorkspaceLibrary((current) => ({
      ...current,
      workspaces: current.workspaces.map((item) => (
        item.id === activeWorkspace.id ? { ...item, name: name.trim(), updatedAt: new Date().toISOString() } : item
      )),
    }));
    setMessage(`已重命名整套工作配置：${name.trim()}`);
  }

  function deleteActiveWorkspace() {
    if (!activeWorkspace) return;
    updateApiWorkspaceLibrary((current) => ({
      ...current,
      activeWorkspaceId: "",
      workspaces: current.workspaces.filter((item) => item.id !== activeWorkspace.id),
    }));
    setMessage(`已删除整套工作配置：${activeWorkspace.name}`);
  }

  function exportWorkspace() {
    const workspace = activeWorkspace || {
      id: createApiProfileId("workspace-export"),
      name: sanitizeImportedProfileName(`${textProviderPreset.label || "文本"}-${settings.customModel || "图片视频"}`, "workspace"),
      updatedAt: new Date().toISOString(),
      textSettings: buildTextApiProfileSnapshot(textApiSettings || {}),
      mediaSettings: buildMediaApiProfileSnapshot(settings || {}),
    };
    downloadProfileJson(`${workspace.name.replace(/[\\/:*?"<>|]+/g, "-") || "workspace"}.json`, {
      kind: "workspace",
      version: 1,
      exportedAt: new Date().toISOString(),
      workspace,
    });
    setMessage(`已导出整套工作配置：${workspace.name}`);
  }

  function importWorkspaceFromText(text) {
    const imported = parseImportedApiWorkspace(text);
    const entry = {
      id: createApiProfileId("workspace"),
      name: sanitizeImportedProfileName(imported.name, "导入的整套工作配置"),
      updatedAt: new Date().toISOString(),
      textSettings: buildTextApiProfileSnapshot(imported.textSettings || {}),
      mediaSettings: buildMediaApiProfileSnapshot(imported.mediaSettings || {}),
    };
    updateApiWorkspaceLibrary((current) => ({
      ...current,
      activeWorkspaceId: entry.id,
      workspaces: [entry, ...current.workspaces],
    }));
    applyWorkspace(entry);
  }

  function overwriteActiveTextProfile() {
    if (!activeTextProfile) {
      saveCurrentTextProfileAsNew();
      return;
    }
    updateApiProfileLibrary((current) => ({
      ...current,
      textProfiles: current.textProfiles.map((item) => (
        item.id === activeTextProfile.id
          ? { ...item, updatedAt: new Date().toISOString(), settings: buildTextApiProfileSnapshot(textApiSettings || {}) }
          : item
      )),
    }));
    setMessage(`已覆盖文本 API 配置：${activeTextProfile.name}`);
  }

  function overwriteActiveMediaProfile() {
    if (!activeMediaProfile) {
      saveCurrentMediaProfileAsNew();
      return;
    }
    updateApiProfileLibrary((current) => ({
      ...current,
      mediaProfiles: current.mediaProfiles.map((item) => (
        item.id === activeMediaProfile.id
          ? { ...item, updatedAt: new Date().toISOString(), settings: buildMediaApiProfileSnapshot(settings || {}) }
          : item
      )),
    }));
    setMessage(`已覆盖图片/视频配置：${activeMediaProfile.name}`);
  }

  function deleteActiveTextProfile() {
    if (!activeTextProfile) return;
    updateApiProfileLibrary((current) => ({
      ...current,
      activeTextProfileId: "",
      textProfiles: current.textProfiles.filter((item) => item.id !== activeTextProfile.id),
    }));
    setMessage(`已删除文本 API 配置：${activeTextProfile.name}`);
  }

  function deleteActiveMediaProfile() {
    if (!activeMediaProfile) return;
    updateApiProfileLibrary((current) => ({
      ...current,
      activeMediaProfileId: "",
      mediaProfiles: current.mediaProfiles.filter((item) => item.id !== activeMediaProfile.id),
    }));
    setMessage(`已删除图片/视频配置：${activeMediaProfile.name}`);
  }

  function patchImageApiKey(value) {
    const next = { ...settings, customApiKey: value, customApiKeyClear: false, customApiKeySaved: Boolean(value || settings.customApiKeySaved) };
    setSettings((current) => ({ ...current, customApiKey: value, customApiKeyClear: false, customApiKeySaved: Boolean(value || current.customApiKeySaved) }));
    if (value.trim()) {
      helpers.saveBackendAiConfig(next)
        .then((saved) => {
          setSettings((current) => ({
            ...current,
            ...saved,
            customApiKey: current.customApiKey || value,
            customApiKeySaved: true,
          }));
          setMessage("图片/视频 API Key 已保存，后续会自动使用");
        })
        .catch((error) => setMessage(`图片/视频 API Key 保存失败：${error.message}`));
    }
  }

  function patchText(next) {
    patchTextApiSettings?.(next);
    setMessage("文本 API 设置已自动保存到本地");
  }

  function patchTextApiKey(value) {
    patchText({ apiKey: value, apiKeyClear: false, apiKeySaved: Boolean(value || textApiKeySaved) });
    if (value.trim()) setMessage("文本 API Key 已保存，后续会自动使用");
  }

  function applyTextProvider(provider) {
    const preset = helpers.NOVEL_API_PROVIDERS[provider] || helpers.NOVEL_API_PROVIDERS.custom;
    patchText({
      factoryMode: "api",
      apiProvider: provider,
      apiBaseUrl: preset.baseUrl,
      apiUrl: "",
      authType: preset.authType,
      apiModel: preset.model,
      responsePath: preset.responsePath,
      headersJson: preset.headersJson || "",
      bodyTemplate: preset.bodyTemplate || helpers.NOVEL_API_BODY_TEMPLATE_DEFAULT,
      schema: helpers.NOVEL_FACTORY_SCHEMA,
    });
  }

  function clearTextApiKey() {
    patchText({ apiKey: "", apiKeyClear: true, apiKeySaved: false });
    setMessage("已清除本地保存的文本 API Key");
  }

  async function testTextApi() {
    if (textProviderUnsupported) {
      setMessage(textProviderPreset?.unsupportedReason || "当前供应商不支持在本软件里直接测试。");
      return;
    }
    setTesting("text-api");
    setMessage("正在测试文本 API...");
    try {
      await helpers.runNovelFactoryApi({
        apiUrl: textApiUrl,
        apiBaseUrl: textApiBaseUrl,
        apiProvider: textProvider,
        apiKey: textApiSettings?.apiKey || "",
        authType: textApiSettings?.authType || textProviderPreset.authType || "bearer",
        headersJson: textApiSettings?.headersJson || "",
        model: textApiSettings?.apiModel || textProviderPreset.model || "gpt-4o-mini",
        bodyTemplate: helpers.normalizeNovelBodyTemplate(textApiSettings?.bodyTemplate, textProviderPreset),
        responsePath: textApiSettings?.responsePath || textProviderPreset.responsePath || "choices.0.message.content",
        novel: "主角在雨夜发现一封没有署名的信。",
        input: "主角在雨夜发现一封没有署名的信。",
        template: "请用一句话改写输入内容。",
        schema: "只输出一句中文文本。",
      }, (text, note) => ({ text, note }));
      setMessage(`文本 API 测试成功：${textProviderPreset.label}`);
    } catch (error) {
      setMessage(`文本 API 测试失败：${error.message || String(error)}`);
    } finally {
      setTesting("");
    }
  }

  function patchComfyWorkflow(value, kind = "image") {
    const detected = helpers.detectComfyPromptNodeId(value);
    const format = helpers.detectComfyWorkflowFormat(value);
    if (kind === "video") {
      patch({
        comfyVideoWorkflowJson: value,
        ...(detected && !settings.comfyVideoPositiveNodeId ? { comfyVideoPositiveNodeId: detected } : {}),
      });
      if (format === "ui") setMessage("已识别普通 ComfyUI workflow。运行生图需要在 ComfyUI 里导出 API workflow JSON。");
      else if (detected) setMessage(`已识别视频提示词节点：${detected}`);
      return;
    }
    patch({
      comfyImageWorkflowJson: value,
      workflowJson: value,
      ...(detected && !(settings.comfyImagePositiveNodeId || settings.positiveNodeId) ? { comfyImagePositiveNodeId: detected, positiveNodeId: detected } : {}),
    });
    if (format === "ui") setMessage("已识别普通 ComfyUI workflow。运行生图需要在 ComfyUI 里导出 API workflow JSON。");
    else if (detected) setMessage(`已识别生图提示词节点：${detected}`);
  }

  function applyApiPreset(preset) {
    if (preset === "openai") {
      patch({
        providerMode: "custom",
        comfyEnabled: false,
        customApiUrl: "https://api.openai.com/v1/images/generations",
        customAuthType: "bearer",
        customModel: "gpt-image-1",
        customApiKind: "direct-image",
        customResultMode: "base64",
        customImagePath: "data.0.b64_json",
        customBodyTemplate: JSON.stringify({ model: "{{model}}", prompt: "{{prompt}}", size: "{{size}}" }, null, 2),
      });
    }
    if (preset === "url") {
      patch({
        providerMode: "custom",
        comfyEnabled: false,
        customApiKind: "direct-image",
        customResultMode: "url",
        customImagePath: "data.0.url",
        customBodyTemplate: JSON.stringify({ prompt: "{{prompt}}", model: "{{model}}" }, null, 2),
      });
    }
    if (preset === "base64") {
      patch({
        providerMode: "custom",
        comfyEnabled: false,
        customApiKind: "direct-image",
        customResultMode: "base64",
        customImagePath: "data.0.b64_json",
        customBodyTemplate: JSON.stringify({ prompt: "{{prompt}}", model: "{{model}}" }, null, 2),
      });
    }
    if (preset === "grsai-banana-pro-4k") {
      patch({
        providerMode: "custom",
        comfyEnabled: false,
        customApiUrl: "https://grsaiapi.com/v1/draw/nano-banana",
        customAuthType: "bearer",
        customModel: "nano-banana-pro-4k-vip",
        customApiKind: "draw-poll",
        customResultMode: "task-id",
        customImagePath: "data.results.0.url",
        customBodyTemplate: JSON.stringify({
          model: "{{model}}",
          prompt: "{{prompt}}",
          aspectRatio: "auto",
          imageSize: "4K",
          urls: [],
          webHook: "-1",
          shutProgress: true,
        }, null, 2),
      });
    }
  }

  async function testComfyConnectionOnly() {
    setTesting("comfy-connect");
    setMessage("正在检测 ComfyUI...");
    try {
      const result = await helpers.testComfyConnection(settings);
      setMessage(`ComfyUI 已连接：${result}`);
    } catch (error) {
      setMessage(`ComfyUI 连接失败：${error.message}`);
    } finally {
      setTesting("");
    }
  }

  async function saveBackendConfig() {
    setMessage("正在保存...");
    try {
      const saved = await helpers.saveBackendAiConfig(settings);
      setSettings((current) => ({ ...current, ...saved, customApiKey: current.customApiKey || "" }));
      setMessage(`已保存到本地：${saved.configPath || "~/.wuxianhuabu/ai-config.json"}`);
    } catch (error) {
      setMessage(`保存失败：${error.message}`);
    }
  }

  async function clearBackendApiKey() {
    setMessage("正在清除 Key...");
    try {
      const saved = await helpers.saveBackendAiConfig({ ...settings, customApiKey: "", customApiKeyClear: true });
      setSettings((current) => ({ ...current, ...saved, customApiKey: "" }));
      setMessage("已清除本地保存的 API Key");
    } catch (error) {
      setMessage(`清除失败：${error.message}`);
    }
  }

  async function copyDiagnosticJson() {
    if (!customApiDiagnostic) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(customApiDiagnostic, null, 2));
      setMessage("诊断 JSON 已复制");
    } catch (error) {
      setMessage(error.message || "复制诊断 JSON 失败");
    }
  }

  function rememberCustomApiDiagnostic(report) {
    const entry = {
      id: `${Date.now()}`,
      createdAt: new Date().toISOString(),
      apiUrl: settings.customApiUrl || "",
      model: settings.customModel || "",
      report,
    };
    setCustomApiDiagnosticHistory((current) => {
      const next = [entry, ...current].slice(0, CUSTOM_API_DIAGNOSTIC_HISTORY_LIMIT);
      saveCustomApiDiagnosticHistory(next);
      return next;
    });
  }

  async function copyHistoryDiagnosticJson(entry) {
    if (!entry?.report) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(entry.report, null, 2));
      setMessage("历史诊断 JSON 已复制");
    } catch (error) {
      setMessage(error.message || "复制历史诊断 JSON 失败");
    }
  }

  function restoreHistoryDiagnostic(entry) {
    if (!entry?.report) return;
    setCustomApiDiagnostic(entry.report);
    setMessage(`已载入 ${new Date(entry.createdAt).toLocaleString()} 的测试报告`);
  }

  function clearCustomApiDiagnosticHistory() {
    setCustomApiDiagnosticHistory([]);
    saveCustomApiDiagnosticHistory([]);
    setMessage("已清空自定义图片 API 测试历史");
  }

  async function copyDiagnosticSummary() {
    if (!customApiDiagnosticSummary) return;
    const text = [
      `接口识别：${customApiDiagnosticSummary.apiKind || "direct-image"}`,
      `结果模式：${customApiDiagnosticSummary.resultMode || "auto"}`,
      `首轮响应键摘要：${customApiDiagnosticSummary.keySummary || "暂无"}`,
      `图片字段检测：${customApiDiagnosticSummary.imageFieldStatus || "未检测到图片字段"}`,
      `任务 ID 检测：${customApiDiagnosticSummary.taskFieldStatus || "未检测到任务 ID"}`,
      `轮询判断：${customApiDiagnosticSummary.pollingStatus || "不会进入轮询"}`,
      customApiDiagnostic.firstResponseContentType ? `首轮 Content-Type：${customApiDiagnostic.firstResponseContentType}` : "",
      customApiDiagnostic.error ? `诊断结论：${customApiDiagnostic.error}` : "",
    ].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setMessage("诊断结论已复制");
    } catch (error) {
      setMessage(error.message || "复制诊断结论失败");
    }
  }

  async function testCustomApiWithReport() {
    setTesting("custom-api");
    setMessage("正在测试自定义图片 API 并生成报告...");
    try {
      await helpers.saveBackendAiConfig(settings);
      const report = await helpers.diagnoseCustomImageApi(settings, "一只在霓虹城市里看星星的白猫");
      setCustomApiDiagnostic(report);
      rememberCustomApiDiagnostic(report);
      if (report?.success) {
        setMessage("自定义图片 API 测试成功，已生成接口报告");
      } else {
        setMessage(`自定义图片 API 测试完成：${report?.error || "未返回图片，请查看下方测试报告"}`);
      }
    } catch (error) {
      setCustomApiDiagnostic({
        success: false,
        normalizedApiKind: settings.customApiKind || "direct-image",
        normalizedResultMode: settings.customResultMode || "auto",
        firstResponseContentType: "",
        firstResponseKeySummary: "",
        firstResponseTopLevelKeys: [],
        firstResponseNestedKeys: [],
        detectedImageField: "",
        detectedTaskId: "",
        hasImageField: false,
        hasTaskId: false,
        willPoll: false,
        imagePreview: "",
        note: "自定义图片 API 诊断",
        error: helpers.formatCustomImageApiError(error),
      });
      rememberCustomApiDiagnostic({
        success: false,
        normalizedApiKind: settings.customApiKind || "direct-image",
        normalizedResultMode: settings.customResultMode || "auto",
        firstResponseContentType: "",
        firstResponseKeySummary: "",
        firstResponseTopLevelKeys: [],
        firstResponseNestedKeys: [],
        detectedImageField: "",
        detectedTaskId: "",
        hasImageField: false,
        hasTaskId: false,
        willPoll: false,
        imagePreview: "",
        note: "自定义图片 API 诊断",
        error: helpers.formatCustomImageApiError(error),
      });
      setMessage(`自定义图片 API 测试失败：${helpers.formatCustomImageApiError(error)}`);
    } finally {
      setTesting("");
    }
  }

  const customApiValidationMessage = helpers.validateCustomImageApiSettings(settings);
  const customApiDiagnosticSummary = customApiDiagnostic ? helpers.summarizeCustomImageApiDiagnostic(customApiDiagnostic) : null;

  return (
    <div className="settings-backdrop">
      <section className="settings-panel">
        <header>
          <div>
            <strong>AI 设置</strong>
            <span>选择本地模拟、自定义 HTTP API 或本地 ComfyUI。</span>
          </div>
          <button onClick={onClose}>关闭</button>
        </header>
        <div className="settings-group">
          <h3>整套工作配置</h3>
          <div className="settings-profile-strip">
            <input
              hidden
              ref={importWorkspaceInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(event) => helpers.readTextFile(event, importWorkspaceFromText)}
            />
            <label>
              当前工作配置
              <select value={apiWorkspaceLibrary.activeWorkspaceId || ""} onChange={(event) => switchWorkspace(event.target.value)}>
                <option value="">当前临时组合</option>
                {apiWorkspaceLibrary.workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name} · {(workspace.textSettings?.apiModel || workspace.textSettings?.apiProvider || "文本")} / {(workspace.mediaSettings?.customModel || workspace.mediaSettings?.providerMode || "媒体")}
                  </option>
                ))}
              </select>
            </label>
            {activeWorkspaceSummary && (
              <div className="settings-workspace-summary">
                <span>文本：{activeWorkspaceSummary.text}</span>
                <span>图片/视频：{activeWorkspaceSummary.media}</span>
              </div>
            )}
            <div className="quick-actions">
              <button onClick={saveCurrentWorkspaceAsNew}>新建工作区</button>
              <button onClick={overwriteActiveWorkspace}>{activeWorkspace ? "覆盖当前整套配置" : "保存为当前整套配置"}</button>
              <button onClick={renameActiveWorkspace} disabled={!activeWorkspace}>重命名</button>
              <button onClick={exportWorkspace}>导出 JSON</button>
              <button onClick={openWorkspaceImport}>导入 JSON</button>
              <button onClick={deleteActiveWorkspace} disabled={!activeWorkspace}>删除当前整套配置</button>
            </div>
            {apiWorkspaceLibrary.workspaces.length ? (
              <div className="settings-workspace-list">
                {apiWorkspaceLibrary.workspaces.slice(0, 6).map((workspace) => {
                  const summary = summarizeWorkspace(workspace);
                  return (
                    <section
                      key={workspace.id}
                      className={`settings-workspace-item ${workspace.id === apiWorkspaceLibrary.activeWorkspaceId ? "active" : ""}`}
                    >
                      <strong>{workspace.name}</strong>
                      <p>{summary.text}</p>
                      <p>{summary.media}</p>
                    </section>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
        <div className="settings-savebar">
          <button onClick={saveBackendConfig}>立即保存图片/视频配置</button>
          {message && <span>{message}</span>}
        </div>
        <div className="settings-group settings-master-switches">
          <h3>生成总开关</h3>
          <div className="settings-switch-grid">
            <section>
              <strong>文字生成</strong>
              <span>剧本、资产抽取、提示词和审稿</span>
              <div className="quick-actions">
                <button className={textApiSettings?.factoryMode === "api" ? "active" : ""} onClick={() => patchText({ factoryMode: "api" })}>API 生成</button>
                <button className={(textApiSettings?.factoryMode || "local") === "local" ? "active" : ""} onClick={() => patchText({ factoryMode: "local" })}>本地规则</button>
              </div>
            </section>
            <section>
              <strong>图片/视频生成</strong>
              <span>镜头图、资产图、视频队列默认跟随这里</span>
              <div className="quick-actions">
                <button className={helpers.currentProviderMode(settings) === "custom" ? "active" : ""} onClick={() => patchMediaProviderMode("custom")}>API 生成</button>
                <button className={helpers.currentProviderMode(settings) === "comfy" ? "active" : ""} onClick={() => patchMediaProviderMode("comfy")}>本地 ComfyUI</button>
                <button className={helpers.currentProviderMode(settings) === "mock" ? "active" : ""} onClick={() => patchMediaProviderMode("mock")}>本地模拟</button>
              </div>
            </section>
          </div>
          <small className="settings-hint">总开关控制默认生成来源；镜头、资产行内下拉选择“跟随总开关”时会自动使用这里的设置。</small>
        </div>
        <div className="provider-cards">
          {[
            ["text", "文本 API", "剧本、评分、资产抽取、提示词生成。"],
            ["image", "图片 API", "生成分镜图、角色图和场景图。"],
            ["video", "视频 API", "根据镜头提示词生成视频素材。"],
          ].map(([mode, title, desc]) => (
            <button
              key={mode}
              className={`provider-card ${focusSection === mode ? "active" : ""}`}
              onClick={() => sectionRefs[mode]?.current?.scrollIntoView({ block: "start", behavior: "smooth" })}
            >
              <strong>{title}</strong>
              <span>{desc}</span>
            </button>
          ))}
        </div>
        <div className="settings-group" ref={textGroupRef}>
          <h3>文本 API</h3>
          <div className="settings-profile-strip">
            <input
              hidden
              ref={importTextProfileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(event) => helpers.readTextFile(event, importTextProfileFromText)}
            />
            <label>
              文本配置组
              <select value={apiProfileLibrary.activeTextProfileId || ""} onChange={(event) => switchTextProfile(event.target.value)}>
                <option value="">当前临时配置</option>
                {apiProfileLibrary.textProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>{profile.name}</option>
                ))}
              </select>
            </label>
            <div className="quick-actions">
              <button onClick={saveCurrentTextProfileAsNew}>另存为新配置</button>
              <button onClick={overwriteActiveTextProfile}>{activeTextProfile ? "覆盖当前配置" : "保存为当前配置"}</button>
              <button onClick={renameActiveTextProfile} disabled={!activeTextProfile}>重命名</button>
              <button onClick={exportTextProfile}>导出 JSON</button>
              <button onClick={openTextProfileImport}>导入 JSON</button>
              <button onClick={deleteActiveTextProfile} disabled={!activeTextProfile}>删除当前配置</button>
            </div>
          </div>
          <div className="quick-actions">
            <button className={textApiSettings?.factoryMode === "local" ? "active" : ""} onClick={() => patchText({ factoryMode: "local" })}>本地规则</button>
            <button className={textApiSettings?.factoryMode === "api" ? "active" : ""} onClick={() => patchText({ factoryMode: "api" })}>启用 API</button>
            <button onClick={testTextApi} disabled={testing === "text-api" || textApiSettings?.factoryMode === "local" || textProviderUnsupported}>{testing === "text-api" ? "测试中..." : "测试文本 API"}</button>
          </div>
          <label>
            供应商
            <select value={textProvider} onChange={(event) => applyTextProvider(event.target.value)}>
              {Object.entries(helpers.NOVEL_API_PROVIDERS).map(([key, preset]) => (
                <option key={key} value={key}>{preset.label}</option>
              ))}
            </select>
          </label>
          {textProviderUnsupported && (
            <div className="settings-warning">
              <strong>{textProviderPreset.label}</strong>
              <p>{textProviderPreset.unsupportedReason}</p>
              <p>如果你是想让本软件稳定调用阿里模型，请改用“阿里百炼 / DashScope”供应商；它适合本软件现在这类文本 API 链路。</p>
              {textProviderPreset.suggestedProvider && (
                <button className="settings-secondary" onClick={() => applyTextProvider(textProviderPreset.suggestedProvider)}>切换到阿里百炼 / DashScope</button>
              )}
            </div>
          )}
          <label>
            Base URL
            <input value={textApiBaseUrl} onChange={(event) => patchText({ apiBaseUrl: event.target.value, apiUrl: "" })} placeholder="https://api.example.com/v1" />
          </label>
          <label>
            API Key
            <input value={textApiSettings?.apiKey || ""} onChange={(event) => patchTextApiKey(event.target.value)} type="password" placeholder={textApiKeySaved ? "已保存到本地，留空会自动沿用" : "只需输入一次，保存后自动沿用"} />
          </label>
          <small className="settings-hint">{textApiKeySaved ? "文本 API Key 已保存在本机，小说转剧本、评分、资产提取和提示词生成会自动使用。" : "输入一次文本 API Key 后会立即保存到本机。"}</small>
          {textApiKeySaved && <button className="settings-secondary" onClick={clearTextApiKey}>清除文本 API Key</button>}
          <label>
            模型
            <input value={textApiSettings?.apiModel || textProviderPreset.model || ""} onChange={(event) => patchText({ apiModel: event.target.value })} placeholder="gpt-4o-mini / deepseek-chat / qwen-plus" />
          </label>
          <label>
            完整接口地址
            <input value={textApiSettings?.apiUrl || ""} onChange={(event) => patchText({ apiUrl: event.target.value })} placeholder="默认由 Base URL 自动拼接 /chat/completions" />
          </label>
          <label>
            认证方式
            <select value={textApiSettings?.authType || textProviderPreset.authType || "bearer"} onChange={(event) => patchText({ authType: event.target.value })}>
              <option value="bearer">Authorization: Bearer</option>
              <option value="x-api-key">x-api-key</option>
              <option value="none">不自动添加</option>
            </select>
          </label>
          <label>
            结果文本路径
            <input value={textApiSettings?.responsePath || textProviderPreset.responsePath || "choices.0.message.content"} onChange={(event) => patchText({ responsePath: event.target.value })} placeholder="choices.0.message.content" />
          </label>
          <label>
            额外请求头 JSON
            <textarea className="small-textarea" value={textApiSettings?.headersJson || ""} onChange={(event) => patchText({ headersJson: event.target.value })} placeholder='{"X-Provider":"demo"}' />
          </label>
          <label>
            请求体模板 JSON
            <textarea className="small-textarea" value={helpers.normalizeNovelBodyTemplate(textApiSettings?.bodyTemplate, textProviderPreset)} onChange={(event) => patchText({ bodyTemplate: event.target.value })} />
          </label>
        </div>
        <div className="settings-group" ref={imageGroupRef}>
          <h3>图片 API</h3>
          <div className="settings-profile-strip">
            <input
              hidden
              ref={importMediaProfileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(event) => helpers.readTextFile(event, importMediaProfileFromText)}
            />
            <label>
              图片/视频配置组
              <select value={apiProfileLibrary.activeMediaProfileId || ""} onChange={(event) => switchMediaProfile(event.target.value)}>
                <option value="">当前临时配置</option>
                {apiProfileLibrary.mediaProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>{profile.name}</option>
                ))}
              </select>
            </label>
            <div className="quick-actions">
              <button onClick={saveCurrentMediaProfileAsNew}>另存为新配置</button>
              <button onClick={overwriteActiveMediaProfile}>{activeMediaProfile ? "覆盖当前配置" : "保存为当前配置"}</button>
              <button onClick={renameActiveMediaProfile} disabled={!activeMediaProfile}>重命名</button>
              <button onClick={exportMediaProfile}>导出 JSON</button>
              <button onClick={openMediaProfileImport}>导入 JSON</button>
              <button onClick={deleteActiveMediaProfile} disabled={!activeMediaProfile}>删除当前配置</button>
            </div>
          </div>
          <label>
            默认生图工具
            <select
              value={helpers.currentProviderMode(settings) === "comfy" ? "comfy" : helpers.currentProviderMode(settings) === "custom" ? "custom" : ""}
              onChange={(event) => {
                if (event.target.value === "comfy") patchMediaProviderMode("comfy");
                if (event.target.value === "custom") patchMediaProviderMode("custom");
              }}
            >
              <option value="" disabled>请选择 API 或 ComfyUI</option>
              <option value="custom">API</option>
              <option value="comfy">ComfyUI</option>
            </select>
          </label>
          <div className="quick-actions">
            <button className={helpers.currentProviderMode(settings) === "mock" ? "active" : ""} onClick={() => patchMediaProviderMode("mock")}>本地模拟</button>
            <button className={helpers.currentProviderMode(settings) === "custom" ? "active" : ""} onClick={() => patchMediaProviderMode("custom")}>HTTP API</button>
            <button className={helpers.currentProviderMode(settings) === "comfy" ? "active" : ""} onClick={() => patchMediaProviderMode("comfy")}>ComfyUI</button>
          </div>
          <div className="quick-actions">
            <button onClick={() => applyApiPreset("openai")}>OpenAI 图片格式</button>
            <button onClick={() => applyApiPreset("url")}>通用 URL 返回</button>
            <button onClick={() => applyApiPreset("base64")}>通用 Base64 返回</button>
            <button onClick={() => applyApiPreset("grsai-banana-pro-4k")}>GrsAI Banana Pro 4K</button>
          </div>
          <label>
            接口 URL
            <input value={settings.customApiUrl} onChange={(event) => patch({ customApiUrl: event.target.value })} placeholder="https://api.example.com/v1/images/generations" />
          </label>
          <label>
            API Key
            <input value={settings.customApiKey} onChange={(event) => patchImageApiKey(event.target.value)} placeholder={settings.customApiKeySaved ? "已保存到本地，留空会自动沿用" : "只需输入一次，保存后自动沿用"} type="password" />
          </label>
          <small className="settings-hint">{settings.customApiKeySaved ? "图片/视频 HTTP API Key 已保存在本机，生成时会自动使用。" : "输入一次图片/视频 API Key 后会立即保存到本机。"}</small>
          {settings.customApiKeySaved && <button className="settings-secondary" onClick={clearBackendApiKey}>清除已保存 API Key</button>}
          <label>
            认证方式
            <select value={settings.customAuthType} onChange={(event) => patch({ customAuthType: event.target.value })}>
              <option value="bearer">Authorization: Bearer</option>
              <option value="x-api-key">x-api-key</option>
              <option value="none">不自动添加</option>
            </select>
          </label>
          <label>
            模型
            <input value={settings.customModel} onChange={(event) => patch({ customModel: event.target.value })} placeholder="例如 gpt-image-1 / flux / nano-banana" />
          </label>
          <label>
            接口类型
            <select value={settings.customApiKind || "direct-image"} onChange={(event) => patch({ customApiKind: event.target.value })}>
              <option value="direct-image">直返图片接口</option>
              <option value="openai-compatible">OpenAI 兼容聊天接口</option>
              <option value="draw-poll">火山 Draw 轮询接口</option>
            </select>
          </label>
          <label>
            结果模式
            <select value={settings.customResultMode || "auto"} onChange={(event) => patch({ customResultMode: event.target.value })}>
              <option value="auto">自动识别</option>
              <option value="url">图片 URL</option>
              <option value="base64">Base64 图片</option>
              <option value="task-id">任务 ID + 轮询</option>
            </select>
          </label>
          <label>
            额外请求头 JSON
            <textarea className="small-textarea" value={settings.customHeadersJson} onChange={(event) => patch({ customHeadersJson: event.target.value })} placeholder='{"X-Provider":"demo"}' />
          </label>
          <label>
            请求体模板 JSON
            <textarea className="small-textarea" value={settings.customBodyTemplate} onChange={(event) => patch({ customBodyTemplate: event.target.value })} />
          </label>
          <label>
            结果图片路径
            <input value={settings.customImagePath} onChange={(event) => patch({ customImagePath: event.target.value })} placeholder="data.0.url 或 data.0.b64_json" />
          </label>
          <small className="settings-hint">
            {settings.customApiKind === "draw-poll"
              ? "火山 Draw 模式会先拿任务 ID，再轮询 draw/result。LinAPI / OpenAI 兼容层通常不支持这一模式。"
              : settings.customApiKind === "openai-compatible"
                ? "OpenAI 兼容聊天接口通常不会走 draw/result 轮询；如果你用的是 LinAPI，请优先选 url、base64 或 auto。"
                : "直返图片接口适合 `/images/generations` 或直接返回图片 URL/Base64 的服务。"}
          </small>
          {customApiValidationMessage && (
            <div className="settings-warning">
              <strong>请求前预检</strong>
              <p>{customApiValidationMessage}</p>
            </div>
          )}
          <button
            className="settings-test"
            onClick={testCustomApiWithReport}
            disabled={Boolean(customApiValidationMessage) || testing === "custom-api"}
          >
            {testing === "custom-api" ? "测试并生成报告中..." : "保存并测试自定义 API"}
          </button>
          {customApiDiagnostic && (
            <div className={`settings-diagnostic ${customApiDiagnostic.success ? "is-success" : "is-warning"}`}>
              <div className="settings-diagnostic-header">
                <strong>自定义图片 API 测试报告</strong>
                <span>{customApiDiagnostic.success ? "已拿到图片结果" : "已完成诊断"}</span>
              </div>
              <div className="quick-actions settings-diagnostic-actions">
                <button onClick={copyDiagnosticSummary}>复制结论</button>
                <button onClick={copyDiagnosticJson}>复制 JSON</button>
              </div>
              <div className="settings-diagnostic-grid">
                <section>
                  <span>接口识别</span>
                  <b>{customApiDiagnosticSummary?.apiKind || "direct-image"}</b>
                </section>
                <section>
                  <span>结果模式</span>
                  <b>{customApiDiagnosticSummary?.resultMode || "auto"}</b>
                </section>
                <section>
                  <span>首轮响应键摘要</span>
                  <b>{customApiDiagnosticSummary?.keySummary || "暂无"}</b>
                </section>
                <section>
                  <span>图片字段检测</span>
                  <b>{customApiDiagnosticSummary?.imageFieldStatus || "未检测到图片字段"}</b>
                </section>
                <section>
                  <span>任务 ID 检测</span>
                  <b>{customApiDiagnosticSummary?.taskFieldStatus || "未检测到任务 ID"}</b>
                </section>
                <section>
                  <span>轮询判断</span>
                  <b>{customApiDiagnosticSummary?.pollingStatus || "不会进入轮询"}</b>
                </section>
              </div>
              {customApiDiagnostic.firstResponseContentType && (
                <p className="settings-diagnostic-line">首轮 Content-Type：{customApiDiagnostic.firstResponseContentType}</p>
              )}
              {customApiDiagnosticSummary?.nestedKeySummary && customApiDiagnosticSummary.nestedKeySummary !== "暂无" && (
                <div className="settings-diagnostic-paths">
                  <span>首轮响应嵌套键路径样本</span>
                  <pre>{customApiDiagnosticSummary.nestedKeySummary}</pre>
                </div>
              )}
              {customApiDiagnostic.imagePreview && (
                <p className="settings-diagnostic-line">结果预览：{customApiDiagnostic.imagePreview}</p>
              )}
              {customApiDiagnostic.error && (
                <div className="settings-warning">
                  <strong>诊断结论</strong>
                  <p>{customApiDiagnostic.error}</p>
                </div>
              )}
            </div>
          )}
          {customApiDiagnosticHistory.length ? (
            <div className="settings-diagnostic-history">
              <div className="settings-diagnostic-history-header">
                <strong>最近测试历史</strong>
                <button className="settings-secondary" onClick={clearCustomApiDiagnosticHistory}>清空历史</button>
              </div>
              <div className="settings-diagnostic-history-list">
                {customApiDiagnosticHistory.map((entry) => {
                  const summary = helpers.summarizeCustomImageApiDiagnostic(entry.report || {});
                  return (
                    <section key={entry.id} className={`settings-history-item ${(entry.report?.success) ? "is-success" : "is-warning"}`}>
                      <div className="settings-history-item-top">
                        <strong>{entry.report?.success ? "测试成功" : "测试失败"}</strong>
                        <span>{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "-"}</span>
                      </div>
                      <p>{summary.apiKind} · {summary.resultMode}</p>
                      <p>{entry.model || "未填模型"} · {entry.apiUrl || "未填 URL"}</p>
                      <p>{summary.keySummary || "暂无响应键摘要"}</p>
                      <div className="quick-actions settings-history-actions">
                        <button onClick={() => restoreHistoryDiagnostic(entry)}>查看这次报告</button>
                        <button onClick={() => copyHistoryDiagnosticJson(entry)}>复制 JSON</button>
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
        <div className="settings-group" ref={videoGroupRef}>
          <h3>视频 API</h3>
          <div className="setup-steps">
            <span>1. 打开 ComfyUI</span>
            <span>2. 导出 API workflow JSON</span>
            <span>3. 导入后测试生图</span>
          </div>
          <label className="switch-row">
            <input type="checkbox" checked={settings.providerMode === "comfy" || settings.comfyEnabled} onChange={(event) => patchMediaProviderMode(event.target.checked ? "comfy" : "custom")} />
            图片/视频默认使用本地 ComfyUI
          </label>
          <label>
            ComfyUI 地址
            <input value={settings.comfyBaseUrl} onChange={(event) => patch({ comfyBaseUrl: event.target.value })} placeholder="http://127.0.0.1:8188" />
          </label>
          <div className="quick-actions">
            <button onClick={testComfyConnectionOnly} disabled={testing === "comfy-connect"}>{testing === "comfy-connect" ? "检测中..." : "检测连接"}</button>
            <button onClick={() => patchMediaProviderMode("comfy")}>设为图片/视频总开关</button>
          </div>
          <label>
            生图正向提示词节点 ID
            <input value={settings.comfyImagePositiveNodeId || settings.positiveNodeId || ""} onChange={(event) => patch({ comfyImagePositiveNodeId: event.target.value, positiveNodeId: event.target.value })} placeholder="例如 6" />
          </label>
          <label>
            生图工作流 JSON
            <textarea value={settings.comfyImageWorkflowJson || settings.workflowJson || ""} onChange={(event) => patchComfyWorkflow(event.target.value, "image")} placeholder="粘贴从 ComfyUI 导出的 API workflow JSON" />
          </label>
          <div className="quick-actions">
            <label className="file-action">导入生图工作流<input hidden type="file" accept=".json,application/json" onChange={(event) => helpers.readTextFile(event, (text) => patchComfyWorkflow(text, "image"))} /></label>
            <button onClick={() => {
              const detected = helpers.detectComfyPromptNodeId(settings.comfyImageWorkflowJson || settings.workflowJson || "");
              if (detected) patch({ comfyImagePositiveNodeId: detected, positiveNodeId: detected });
              setMessage(detected ? `已识别生图提示词节点：${detected}` : "未识别到提示词节点，请确认导出的是 API workflow JSON。");
            }}>自动识别节点</button>
          </div>
          <label>
            视频正向提示词节点 ID
            <input value={settings.comfyVideoPositiveNodeId} onChange={(event) => patch({ comfyVideoPositiveNodeId: event.target.value })} placeholder="例如 12" />
          </label>
          <label>
            视频工作流 JSON
            <textarea value={settings.comfyVideoWorkflowJson} onChange={(event) => patchComfyWorkflow(event.target.value, "video")} placeholder="粘贴 AnimateDiff / Wan / LTX / HunyuanVideo 等视频工作流的 API JSON" />
          </label>
          <div className="quick-actions">
            <label className="file-action">导入视频工作流<input hidden type="file" accept=".json,application/json" onChange={(event) => helpers.readTextFile(event, (text) => patchComfyWorkflow(text, "video"))} /></label>
            <button onClick={() => {
              const detected = helpers.detectComfyPromptNodeId(settings.comfyVideoWorkflowJson || "");
              if (detected) patch({ comfyVideoPositiveNodeId: detected });
              setMessage(detected ? `已识别视频提示词节点：${detected}` : "未识别到视频提示词节点。");
            }}>自动识别节点</button>
          </div>
          <label>
            ComfyUI 轮询超时秒数
            <input value={settings.comfyTimeoutSeconds} onChange={(event) => patch({ comfyTimeoutSeconds: event.target.value })} placeholder="图片 180，视频建议 900" />
          </label>
          <div className="settings-test-row">
            <button className="settings-test" onClick={async () => {
              await saveBackendConfig();
              await helpers.testComfyImage(settings);
            }}>测试 Comfy 生图</button>
            <button className="settings-test" onClick={async () => {
              await saveBackendConfig();
              await helpers.testComfyVideo(settings);
            }}>测试 Comfy 视频</button>
          </div>
        </div>
        <p>提示：浏览器直连第三方 API 可能遇到 CORS；接入 Tauri 后端后可统一代理请求并安全保存密钥。</p>
      </section>
    </div>
  );
}
