import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

function getTimelineDeliveryState(clip) {
  const hasMedia = Boolean(String(clip?.mediaUrl || "").trim());
  if (hasMedia) return "已可导出";
  if (!hasMedia) return "待挂素材";
  return "待挂素材";
}

function getTimelineDeliveryTone(state) {
  if (state === "已齐备" || state === "已可导出") return "ok";
  return "danger";
}

function getTimelineClipChecklist(clip) {
  const hasMedia = Boolean(String(clip?.mediaUrl || "").trim());
  return [
    { key: "media", label: "素材", ready: hasMedia },
  ];
}

function getTimelineClipNextAction(clip) {
  if (!clip) return { label: "先选一个片段", key: "select" };
  const hasMedia = Boolean(String(clip.mediaUrl || "").trim());
  if (!hasMedia) return { label: "先补生成素材", key: "generate" };
  return { label: "可以直接推到可导出", key: "prepare" };
}

export function TimelinePanel({ episode, timeline, availableShots, focusClipId, onImportShots, onPatchClip, onPatchClips, onMoveClip, onDuplicateClip, onSortClips, onRemoveClip, onLocateShot, onGenerateClip, onSyncClip, onSyncClips, onPatchShotFromClip, onPatchShotsFromClips, onPrepareClips, getClipStatus, onExport, onClose, totalDurationSeconds }) {
  const [selectedId, setSelectedId] = useState(timeline.clips[0]?.id || "");
  const [filter, setFilter] = useState("全部");
  const [showAllClips, setShowAllClips] = useState(false);
  const [lastPrepareSummary, setLastPrepareSummary] = useState(null);
  const [lastBackfillSummary, setLastBackfillSummary] = useState(null);
  const clipStats = useMemo(() => {
    const withMedia = timeline.clips.filter((clip) => String(clip.mediaUrl || "").trim()).length;
    const exportReadyClips = timeline.clips.filter((clip) => Boolean(String(clip.mediaUrl || "").trim()) && String(clip.approvalStatus || "待验收") === "已通过").length;
    const readyClips = timeline.clips.filter((clip) => getTimelineDeliveryState(clip) === "已齐备").length;
    const missingMediaClips = timeline.clips.filter((clip) => !String(clip.mediaUrl || "").trim());
    const approvedClips = timeline.clips.filter((clip) => String(clip.approvalStatus || "待验收") === "已通过");
    const rejectedClips = timeline.clips.filter((clip) => String(clip.approvalStatus || "") === "退回修改");
    const pendingApprovalClips = timeline.clips.filter((clip) => String(clip.approvalStatus || "待验收") === "待验收");
    return {
      withMedia,
      exportReadyClips,
      readyClips,
      missingMediaClips,
      approvedClips,
      rejectedClips,
      pendingApprovalClips,
      deliveryReady: Boolean(timeline.clips.length) && missingMediaClips.length === 0 && pendingApprovalClips.length === 0 && rejectedClips.length === 0,
    };
  }, [timeline.clips]);
  const filteredClips = useMemo(() => {
    if (filter === "全部") return timeline.clips;
    return timeline.clips.filter((clip) => getTimelineDeliveryState(clip) === filter);
  }, [filter, timeline.clips]);
  const visibleClips = showAllClips ? filteredClips : filteredClips.slice(0, 300);
  const selected = filteredClips.find((clip) => clip.id === selectedId)
    || timeline.clips.find((clip) => clip.id === selectedId)
    || filteredClips[0]
    || timeline.clips[0]
    || null;
  const selectedDeliveryState = selected ? getTimelineDeliveryState(selected) : "";
  const selectedDeliveryTone = getTimelineDeliveryTone(selectedDeliveryState);
  const selectedChecklist = selected ? getTimelineClipChecklist(selected) : [];
  const selectedNextAction = getTimelineClipNextAction(selected);
  const preflightIssues = [
    !timeline.clips.length ? "当前时间线还没有片段" : "",
    clipStats.missingMediaClips.length ? `还有 ${clipStats.missingMediaClips.length} 条片段未挂素材` : "",
    clipStats.pendingApprovalClips.length ? `还有 ${clipStats.pendingApprovalClips.length} 条片段待验收` : "",
    clipStats.rejectedClips.length ? `还有 ${clipStats.rejectedClips.length} 条片段被退回修改` : "",
  ].filter(Boolean);
  const preflightReady = Boolean(timeline.clips.length) && preflightIssues.length === 0;
  const deliveryBuckets = [
    { label: "待挂素材", count: clipStats.missingMediaClips.length, filterKey: "待挂素材", tone: clipStats.missingMediaClips.length ? "danger" : "ok" },
    { label: "待验收", count: clipStats.pendingApprovalClips.length, filterKey: "全部", tone: clipStats.pendingApprovalClips.length ? "warn" : "ok" },
    { label: "已齐备", count: clipStats.readyClips, filterKey: "已齐备", tone: clipStats.readyClips ? "ok" : "neutral" },
  ];

  useEffect(() => {
    if (!timeline.clips.length) {
      setSelectedId("");
      return;
    }
    if (!filteredClips.some((clip) => clip.id === selectedId) && filteredClips[0]?.id) {
      setSelectedId(filteredClips[0].id);
      return;
    }
    if (!timeline.clips.some((clip) => clip.id === selectedId)) setSelectedId(timeline.clips[0].id);
  }, [filteredClips, timeline, selectedId]);

  useEffect(() => {
    if (!focusClipId) return;
    if (timeline.clips.some((clip) => clip.id === focusClipId)) setSelectedId(focusClipId);
  }, [focusClipId, timeline.clips]);

  const generateFilteredMissingMedia = () => {
    filteredClips.forEach((clip) => {
      if (!String(clip.mediaUrl || "").trim()) onGenerateClip?.(clip);
    });
  };

  const syncFilteredClips = () => {
    onSyncClips?.(filteredClips.map((clip) => clip.id));
  };

  const prepareFilteredClips = () => {
    const summary = onPrepareClips?.(filteredClips.map((clip) => clip.id));
    if (summary) {
      setLastPrepareSummary({
        ...summary,
        label: `当前筛选 ${filteredClips.length} 条`,
        createdAt: Date.now(),
      });
    }
  };

  const backfillFilteredClips = (options = {}) => {
    const summary = onPatchShotsFromClips?.(filteredClips.map((clip) => clip.id), options);
    if (summary) {
      setLastBackfillSummary({
        ...summary,
        label: `当前筛选 ${filteredClips.length} 条`,
        createdAt: Date.now(),
      });
    }
  };

  const backfillSelectedClip = (options = {}) => {
    if (!selected) return;
    const summary = onPatchShotFromClip?.(selected.id, options);
    if (summary) {
      setLastBackfillSummary({
        ...summary,
        label: selected.title || selected.shotId || "当前片段",
        createdAt: Date.now(),
      });
    }
  };

  const patchFilteredApproval = (approvalStatus) => {
    filteredClips.forEach((clip) => {
      onPatchClip(clip.id, {
        approvalStatus,
        approvalNote: approvalStatus === "退回修改"
          ? (clip.approvalNote || "时间线验收未通过，待补素材/文字轨或重新调整")
          : "",
      });
    });
  };

  const patchSelectedApproval = (approvalStatus) => {
    if (!selected) return;
    onPatchClip(selected.id, {
      approvalStatus,
      approvalNote: approvalStatus === "退回修改"
        ? (selected.approvalNote || "当前片段验收未通过，待调整")
        : "",
    });
  };

  const locateFirstMissingMedia = () => {
    const target = clipStats.missingMediaClips[0];
    if (!target) return;
    setSelectedId(target.id);
    onLocateShot?.(target);
  };


  return createPortal((
    <aside className="timeline-panel">
      <header>
        <div>
          <strong>{episode?.name || "当前集"} 时间线</strong>
          <span>{timeline.clips.length} 个片段 · 交付 {clipStats.deliveryReady ? "可导出" : "待补齐"}</span>
        </div>
        <div className="timeline-header-actions">
          <button onClick={() => onImportShots(availableShots)}>导入当前集镜头</button>
          <button className="primary" disabled={!filteredClips.length} onClick={prepareFilteredClips}>一键推到可导出</button>
          <button disabled={!filteredClips.length} onClick={syncFilteredClips}>同步当前筛选</button>
          <button disabled={!filteredClips.length} onClick={() => onPatchClips?.(filteredClips.map((clip) => clip.id), { duration: "4秒" })}>批量 4 秒</button>
          <button disabled={!timeline.clips.length} onClick={onSortClips}>按镜头排序</button>
          <button disabled={!filteredClips.some((clip) => !String(clip.mediaUrl || "").trim())} onClick={generateFilteredMissingMedia}>补当前筛选素材</button>
          <button onClick={onExport}>导出清单</button>
          <button onClick={onClose}>关闭</button>
        </div>
      </header>
      <div className="timeline-summary">
        <section><b>{timeline.clips.length}</b><span>时间线片段</span></section>
        <section><b>{availableShots.length}</b><span>可导入镜头</span></section>
        <section><b>{totalDurationSeconds}</b><span>总秒数</span></section>
        <section><b>{clipStats.withMedia}</b><span>已挂素材</span></section>
        <section><b>{clipStats.readyClips}</b><span>可导出片段</span></section>
        <section><b>{clipStats.missingMediaClips.length}</b><span>待挂素材</span></section>
        <section><b>{clipStats.approvedClips.length}</b><span>已通过验收</span></section>
        <section><b>{clipStats.pendingApprovalClips.length}</b><span>待验收</span></section>
      </div>
      <div className="timeline-preflight-card">
        <div className="timeline-preflight-copy">
          <strong>{preflightReady ? "当前集已通过导出前预检" : "当前集还没通过导出前预检"}</strong>
          <span>{preflightReady ? "素材和片段验收都齐了，可以放心进导出。" : "先把下面这些缺口清零，再进成片导出会更稳。时间线里的验收和素材结果也可以一键回写到镜头表。"} </span>
        </div>
        <div className="timeline-preflight-pills">
          <span className={`pill ${preflightReady ? "pill-ok" : "pill-warn"}`}>{preflightReady ? "预检通过" : "预检未通过"}</span>
          <span className="pill">已通过验收 {clipStats.approvedClips.length}/{timeline.clips.length}</span>
        </div>
        <div className="timeline-preflight-issues">
          {preflightIssues.length ? preflightIssues.map((issue) => <span key={issue} className="pill timeline-pill-warn">{issue}</span>) : <span className="pill pill-ok">没有阻塞项</span>}
        </div>
        <div className="timeline-preflight-actions">
          <button disabled={!filteredClips.length} onClick={() => patchFilteredApproval("已通过")}>当前筛选批量通过</button>
          <button disabled={!filteredClips.length} onClick={() => patchFilteredApproval("待验收")}>当前筛选改回待验收</button>
          <button disabled={!filteredClips.length} onClick={() => backfillFilteredClips({ approvalOnly: true })}>仅回写验收</button>
          <button disabled={!filteredClips.length} onClick={() => backfillFilteredClips()}>回写当前筛选到镜头</button>
          <button disabled={!filteredClips.length} onClick={prepareFilteredClips}>当前筛选推到可导出</button>
          <button onClick={onExport}>打开导出清单</button>
        </div>
      </div>
      <div className="timeline-delivery-board">
        <div className={`timeline-delivery-status tone-${clipStats.deliveryReady ? "ok" : "warn"}`}>
          <strong>{clipStats.deliveryReady ? "当前时间线已达到导出门槛" : "当前时间线还没齐活"}</strong>
          <span>{clipStats.deliveryReady ? "素材都齐了，可以直接去导出中心交付。" : `还差 ${clipStats.missingMediaClips.length} 个素材片段。`}</span>
        </div>
        <div className="timeline-delivery-actions">
          <div className="asset-drawer-tabs timeline-filter-tabs">
            {["全部", "已可导出", "待挂素材"].map((item) => (
              <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>
            ))}
          </div>
          <div className="timeline-delivery-pills">
            <span className={`pill ${clipStats.deliveryReady ? "pill-ok" : "pill-warn"}`}>{clipStats.deliveryReady ? "可导出" : "待补齐"}</span>
            <span className="pill">当前筛选 {filteredClips.length} 条</span>
          </div>
        </div>
        <div className="timeline-delivery-issues">
          {clipStats.missingMediaClips.length ? (
            <section>
              <strong>待挂素材</strong>
              <p>{clipStats.missingMediaClips.slice(0, 6).map((clip) => clip.title || clip.shotId || "未命名片段").join("、")}{clipStats.missingMediaClips.length > 6 ? ` 等 ${clipStats.missingMediaClips.length} 条` : ""}</p>
              <div className="timeline-delivery-pills">
                <button onClick={locateFirstMissingMedia}>定位第一条</button>
                <button onClick={() => clipStats.missingMediaClips.forEach((clip) => onGenerateClip?.(clip))}>一键补生成</button>
              </div>
            </section>
          ) : null}
          {!clipStats.missingMediaClips.length ? <div className="asset-empty">当前时间线视频素材都已经补齐。</div> : null}
        </div>
        {lastPrepareSummary ? (
          <div className="timeline-delivery-runbook">
            <section>
              <strong>上一次推进</strong>
              <p>{lastPrepareSummary.label} · 已处理 {lastPrepareSummary.processed} 条</p>
            </section>
            <section><b>{lastPrepareSummary.synced}</b><span>同步源镜头</span></section>
            <section><b>{lastPrepareSummary.queued}</b><span>加入生成队列</span></section>
            <section><b>{lastPrepareSummary.blocked || 0}</b><span>仍有阻塞</span></section>
            <section><b>{lastPrepareSummary.remaining?.media || 0}</b><span>剩余待素材</span></section>
            <section><b>{lastPrepareSummary.remaining?.exportReady || 0}</b><span>本批已可导出</span></section>
          </div>
        ) : null}
        {lastBackfillSummary ? (
          <div className="timeline-delivery-runbook">
            <section>
              <strong>最近一次回写镜头表</strong>
              <p>{lastBackfillSummary.label} · {lastBackfillSummary.approvalOnly ? "仅回写验收状态" : "回写验收 + 素材线索"}</p>
            </section>
            <section><b>{lastBackfillSummary.synced || 0}</b><span>已回写镜头</span></section>
            <section><b>{lastBackfillSummary.skipped || 0}</b><span>无变化跳过</span></section>
            <section><b>{lastBackfillSummary.missingLink || 0}</b><span>未关联镜头</span></section>
            <section><b>{lastBackfillSummary.comments || 0}</b><span>新增验收记录</span></section>
          </div>
        ) : null}
      </div>
      <div className="timeline-delivery-buckets">
        {deliveryBuckets.map((item) => (
          <button
            key={item.label}
            className={`timeline-delivery-bucket tone-${item.tone} ${filter === item.filterKey ? "active" : ""}`}
            onClick={() => setFilter(item.filterKey)}
          >
            <b>{item.count}</b>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      <div className="timeline-body">
        <section className="timeline-strip">
          {!showAllClips && filteredClips.length > visibleClips.length ? (
            <div className="large-list-notice">
              <span>性能模式：当前显示前 {visibleClips.length} / {filteredClips.length} 个片段</span>
              <button type="button" onClick={() => setShowAllClips(true)}>显示全部</button>
            </div>
          ) : null}
          {visibleClips.length ? visibleClips.map((clip) => (
            <button key={clip.id} className={clip.id === selected?.id ? "active" : ""} onClick={() => setSelectedId(clip.id)}>
              <strong>{timeline.clips.findIndex((item) => item.id === clip.id) + 1}. {clip.title}</strong>
              <span>{clip.scene || "未填场景"}</span>
              <small>{clip.duration} · {clip.transition} · {getClipStatus?.(clip) || (clip.mediaUrl ? "已挂素材" : "待补素材")}</small>
              <div className="timeline-strip-pills">
                <span className={`pill timeline-pill-${getTimelineDeliveryTone(getTimelineDeliveryState(clip))}`}>{getTimelineDeliveryState(clip)}</span>
                {clip.mediaUrl ? <span className="pill pill-ok">素材已挂</span> : null}
              </div>
            </button>
          )) : <div className="asset-empty">{timeline.clips.length ? "当前筛选下没有片段。" : "时间线还是空的。先从当前集镜头表导入。"}</div>}
        </section>
        <section className="timeline-editor">
          {selected ? (
            <>
              <div className="timeline-preview">
                {selected.mediaUrl ? (
                  /\.(mp4|webm|mov)$/i.test(selected.mediaUrl)
                    ? <video src={selected.mediaUrl} muted playsInline controls />
                    : <img src={selected.mediaUrl} alt="" />
                ) : <div className="timeline-preview-empty">当前片段还没有挂载结果素材</div>}
              </div>
              <div className="result-meta">
                <span className="pill">{getClipStatus?.(selected) || (selected.mediaUrl ? "已挂素材" : "待补素材")}</span>
                <span className="pill">{selected.mediaType === "video" ? "视频片段" : "图片片段"}</span>
                <span className={`pill timeline-pill-${selectedDeliveryTone}`}>{selectedDeliveryState}</span>
                <span className={`pill ${selected.approvalStatus === "已通过" ? "pill-ok" : selected.approvalStatus === "退回修改" ? "pill-warn" : "timeline-pill-danger"}`}>验收 {selected.approvalStatus || "待验收"}</span>
              </div>
              <div className="timeline-clip-readiness">
                <div className="timeline-clip-readiness-copy">
                  <strong>当前片段准备状态</strong>
                  <span>{selectedNextAction.label}</span>
                </div>
                <div className="timeline-clip-readiness-pills">
                  {selectedChecklist.map((item) => (
                    <span key={item.key} className={`pill ${item.ready ? "pill-ok" : "timeline-pill-danger"}`}>{item.label}{item.ready ? "已就绪" : "待补"}</span>
                  ))}
                </div>
                <div className="timeline-clip-readiness-actions">
                  {!selected.mediaUrl ? <button onClick={() => onGenerateClip?.(selected)}>补生成素材</button> : null}
                  <button className="primary" onClick={() => {
                    const summary = onPrepareClips?.([selected.id]);
                    if (summary) {
                      setLastPrepareSummary({
                        ...summary,
                        label: selected.title || selected.shotId || "当前片段",
                        createdAt: Date.now(),
                      });
                    }
                  }}>推到可导出</button>
                </div>
              </div>
              <div className="timeline-fields">
                <label>片段标题<input value={selected.title} onChange={(event) => onPatchClip(selected.id, { title: event.target.value })} /></label>
                <label>场景<input value={selected.scene} onChange={(event) => onPatchClip(selected.id, { scene: event.target.value })} /></label>
                <label>时长<input value={selected.duration} onChange={(event) => onPatchClip(selected.id, { duration: event.target.value })} /></label>
                <label>转场<select value={selected.transition} onChange={(event) => onPatchClip(selected.id, { transition: event.target.value })}>
                  <option>直切</option>
                  <option>淡入淡出</option>
                  <option>黑场</option>
                  <option>闪白</option>
                </select></label>
              </div>
              <div className="timeline-fields">
                <label>验收状态<select value={selected.approvalStatus || "待验收"} onChange={(event) => onPatchClip(selected.id, { approvalStatus: event.target.value })}>
                  <option>待验收</option>
                  <option>已通过</option>
                  <option>退回修改</option>
                </select></label>
                <label>验收备注<input value={selected.approvalNote || ""} onChange={(event) => onPatchClip(selected.id, { approvalNote: event.target.value })} placeholder="例如：素材需重生 / 节奏可直接过" /></label>
              </div>
              <label>备注<textarea className="small-textarea" value={selected.note} onChange={(event) => onPatchClip(selected.id, { note: event.target.value })} /></label>
              <div className="timeline-clip-actions">
                <button onClick={() => onLocateShot?.(selected)}>定位镜头</button>
                <button onClick={() => patchSelectedApproval("已通过")}>标记通过</button>
                <button onClick={() => patchSelectedApproval("退回修改")}>退回修改</button>
                <button onClick={() => backfillSelectedClip({ approvalOnly: true })}>仅回写验收</button>
                <button onClick={() => backfillSelectedClip()}>回写镜头表</button>
                {!selected.mediaUrl && <button onClick={() => onGenerateClip?.(selected)}>补生成</button>}
                <button className="primary" onClick={() => {
                  const summary = onPrepareClips?.([selected.id]);
                  if (summary) {
                    setLastPrepareSummary({
                      ...summary,
                      label: selected.title || selected.shotId || "当前片段",
                      createdAt: Date.now(),
                    });
                  }
                }}>推到可导出</button>
                <button onClick={() => onSyncClip?.(selected.id)}>同步源镜头</button>
                <button onClick={() => onMoveClip(selected.id, -1)}>上移</button>
                <button onClick={() => onMoveClip(selected.id, 1)}>下移</button>
                <button onClick={() => onDuplicateClip?.(selected.id)}>复制片段</button>
                <button className="danger" onClick={() => onRemoveClip(selected.id)}>移除片段</button>
              </div>
            </>
          ) : (
            <div className="asset-empty">导入镜头后，这里可以编辑时间线片段。</div>
          )}
        </section>
      </div>
    </aside>
  ), document.body);
}

