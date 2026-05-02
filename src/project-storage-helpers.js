export function createProjectCachePayload(project, serializers, options = {}) {
  const compact = Boolean(options.compact);
  return {
    nodes: (project.nodes || []).map((node) => sanitizeNodeForCache(node, { compact, imageLimit: options.imageLimit })),
    edges: project.edges || [],
    view: project.view,
    settings: sanitizeSettingsForStorage(project.settings),
    resources: (project.resources || []).map((resource) => serializers.resource(resource, compact)),
    timeline: serializers.timeline(project.timeline),
    promptFactory: serializers.promptFactory(project.promptFactory),
    templateCenter: serializers.templateCenter(project.templateCenter),
    stylePresetCenter: serializers.stylePresetCenter(project.stylePresetCenter),
    modelParamCenter: serializers.modelParamCenter(project.modelParamCenter),
    exportPresetCenter: serializers.exportPresetCenter(project.exportPresetCenter),
    collaborationState: serializers.collaborationState(project.collaborationState),
    archiveState: serializers.archiveState(project.archiveState),
    exportHistory: exportHistoryForStorage(project.exportHistory),
    performanceSettings: serializers.performanceSettings(project.performanceSettings),
    generationQueue: generationQueueForStorage(project.generationQueue),
    episodes: project.episodes,
    activeEpisodeId: project.activeEpisodeId,
    businessProject: project.businessProject || null,
    productionEvents: productionEventsForStorage(project.productionEvents),
  };
}

export function createProjectStoragePayload(project, serializers) {
  return {
    ...createProjectCachePayload(project, serializers, { compact: false, imageLimit: Number.POSITIVE_INFINITY }),
    nodes: (project.nodes || []).map(sanitizeNodeForStorage),
    resources: (project.resources || []).map((resource) => serializers.resource(resource, false)),
  };
}

export function stringifyProjectStoragePayload(project, serializers) {
  return JSON.stringify(createProjectStoragePayload(project, serializers), null, 2);
}

export function normalizeGenerationQueueState(queue, now = () => Date.now()) {
  return (Array.isArray(queue) ? queue : []).map((job, index) => {
    const isRecovered = job.status === "running";
    const status = isRecovered ? "pending" : (job.status || "pending");
    return {
      ...job,
      id: job.id || `job-restored-${index + 1}`,
      kind: job.kind || "image",
      title: job.title || "生成任务",
      prompt: job.prompt || "",
      priority: job.priority || "中",
      status,
      error: status === "pending" ? "" : (job.error || ""),
      attempts: Number(job.attempts || 0),
      createdAt: Number(job.createdAt || now()),
      updatedAt: Number(job.updatedAt || now()),
      resultSummary: isRecovered ? "上次关闭时任务未完成，已恢复待执行" : (job.resultSummary || ""),
      progress: typeof job.progress === "number" ? Math.max(0, Math.min(100, job.progress)) : (job.kind === "exportVideo" ? 0 : null),
      wasRecovered: Boolean(job.wasRecovered || isRecovered),
      recoveryNotified: Boolean(job.recoveryNotified),
    };
  });
}

export function generationQueueForStorage(queue) {
  return (Array.isArray(queue) ? queue : []).map((job) => ({
    ...job,
    recoveryNotified: Boolean(job.recoveryNotified),
    wasRecovered: Boolean(job.wasRecovered),
  }));
}

export function normalizeExportHistoryState(history, now = () => Date.now()) {
  return (Array.isArray(history) ? history : [])
    .map((item, index) => {
      const wasInterrupted = item.status === "running";
      return {
        id: item.id || `export-history-${index + 1}`,
        requestId: item.requestId || "",
        type: item.type || "artifact",
        status: wasInterrupted ? "interrupted" : (item.status || "done"),
        title: item.title || "导出记录",
        detail: wasInterrupted ? "上次关闭时导出未完成，可重新入队" : (item.detail || ""),
        path: item.path || "",
        episodeId: item.episodeId || "",
        episodeName: item.episodeName || "",
        renderOptions: item.renderOptions && typeof item.renderOptions === "object" ? {
          aspectRatio: item.renderOptions.aspectRatio || "16:9",
        } : null,
        createdAt: Number(item.createdAt || now()),
        updatedAt: Number(item.updatedAt || item.createdAt || now()),
        wasInterrupted: Boolean(item.wasInterrupted || wasInterrupted),
      };
    })
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 120);
}

export function exportHistoryForStorage(history) {
  return normalizeExportHistoryState(history);
}

export function normalizeProductionEventsState(events) {
  return (Array.isArray(events) ? events : [])
    .filter((event) => event && typeof event === "object")
    .map((event, index) => ({
      id: event.id || `production-event-${index + 1}`,
      type: event.type || "production.event",
      actor: event.actor || "system",
      projectId: event.projectId || event.payload?.projectId || "",
      episodeId: event.episodeId || event.payload?.episodeId || "",
      target: event.target || event.payload?.target || null,
      payload: event.payload && typeof event.payload === "object" ? event.payload : {},
      createdAt: event.createdAt || "",
    }))
    .slice(-1000);
}

export function productionEventsForStorage(events) {
  return normalizeProductionEventsState(events);
}

export function upsertExportHistoryEntry(history, entry, now = () => Date.now(), idSuffix = () => Math.random().toString(36).slice(2, 7)) {
  const normalized = normalizeExportHistoryState(history, now);
  const requestId = String(entry?.requestId || "").trim();
  const timestamp = now();
  const nextEntry = {
    id: entry?.id || requestId || `export-history-${timestamp}-${idSuffix()}`,
    requestId,
    type: entry?.type || "artifact",
    status: entry?.status || "done",
    title: entry?.title || "导出记录",
    detail: entry?.detail || "",
    path: entry?.path || "",
    episodeId: entry?.episodeId || "",
    episodeName: entry?.episodeName || "",
    renderOptions: entry?.renderOptions || null,
    createdAt: entry?.createdAt || timestamp,
    updatedAt: timestamp,
  };
  const matchIndex = normalized.findIndex((item) => (
    (requestId && item.requestId === requestId)
    || (!requestId && item.id === nextEntry.id)
  ));
  if (matchIndex >= 0) {
    const merged = {
      ...normalized[matchIndex],
      ...nextEntry,
      createdAt: normalized[matchIndex].createdAt || nextEntry.createdAt,
      updatedAt: timestamp,
    };
    return [merged, ...normalized.filter((_, index) => index !== matchIndex)].slice(0, 120);
  }
  return [nextEntry, ...normalized].slice(0, 120);
}

export function sanitizeNodeForCache(node, options = {}) {
  const compact = Boolean(options.compact);
  const imageLimit = typeof options.imageLimit === "number" ? options.imageLimit : 420_000;
  const next = sanitizeNodeForStorage(node);
  const sanitized = stripEmbeddedMediaFromValue(next.data, { compact, imageLimit });
  next.data = sanitized.value;
  if (sanitized.strippedCount > 0) {
    next.data.cacheWarning = compact ? "已切换为轻量缓存模式，图片内容改为本地工程保存优先。" : "图片过大，已跳过浏览器缓存。请使用保存工程保留完整图片。";
  }
  return next;
}

export function sanitizeNodeForStorage(node) {
  const next = { ...node, data: { ...(node?.data || {}) } };
  if (next.type === "novelPipeline") {
    delete next.data.apiKey;
  }
  return next;
}

export function sanitizeSettingsForStorage(settings) {
  const next = { ...(settings || {}) };
  delete next.customApiKey;
  return next;
}

function stripEmbeddedMediaFromValue(value, options = {}) {
  const compact = Boolean(options.compact);
  const imageLimit = typeof options.imageLimit === "number" ? options.imageLimit : 420_000;
  if (typeof value === "string") {
    if (value.startsWith("data:") && (compact || value.length > imageLimit)) {
      return { value: "", strippedCount: 1 };
    }
    return { value, strippedCount: 0 };
  }
  if (Array.isArray(value)) {
    let strippedCount = 0;
    const next = value.map((item) => {
      const result = stripEmbeddedMediaFromValue(item, options);
      strippedCount += result.strippedCount;
      return result.value;
    });
    return { value: next, strippedCount };
  }
  if (value && typeof value === "object") {
    let strippedCount = 0;
    const next = Object.fromEntries(Object.entries(value).map(([key, item]) => {
      const result = stripEmbeddedMediaFromValue(item, options);
      strippedCount += result.strippedCount;
      return [key, result.value];
    }));
    return { value: next, strippedCount };
  }
  return { value, strippedCount: 0 };
}
