import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";

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
