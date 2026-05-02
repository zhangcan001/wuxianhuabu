import {
  summarizeProductionEvents,
} from "./production-events.js";

export function buildProductionAuditReport(events = [], options = {}) {
  const normalized = normalizeEvents(events);
  const summary = summarizeProductionEvents(normalized);
  const failures = normalized.filter((event) => isFailureEvent(event));
  const milestones = normalized.filter((event) => isMilestoneEvent(event));
  const lineage = buildLineageIndex(normalized);
  return {
    projectId: options.projectId || normalized.find((event) => event.projectId)?.projectId || "",
    episodeId: options.episodeId || normalized.find((event) => event.episodeId)?.episodeId || "",
    totalEvents: summary.total,
    byType: summary.byType,
    firstEventAt: normalized[0]?.createdAt || "",
    lastEventAt: normalized.at(-1)?.createdAt || "",
    lastEvent: summary.lastEvent,
    latestFailure: failures.at(-1) || null,
    milestoneCount: milestones.length,
    milestones: milestones.slice(-options.milestoneLimit || -8),
    lineage,
    health: buildAuditHealth({ events: normalized, failures, lineage }, options),
  };
}

export function buildTargetLineage(events = [], target = {}) {
  const targetKey = targetLineageKey(target);
  return normalizeEvents(events)
    .filter((event) => targetLineageKey(event.target || event.payload?.target || {}) === targetKey)
    .map((event) => ({
      id: event.id || "",
      type: event.type || "",
      actor: event.actor || "system",
      providerId: event.payload?.providerId || event.payload?.provider || "",
      taskId: event.payload?.taskId || "",
      createdAt: event.createdAt || "",
      status: isFailureEvent(event) ? "failed" : "ok",
      error: event.payload?.error || "",
    }));
}

function buildLineageIndex(events = []) {
  return events.reduce((acc, event) => {
    const target = event.target || event.payload?.target || null;
    const key = targetLineageKey(target);
    if (!key) return acc;
    const current = acc[key] || {
      target,
      eventCount: 0,
      taskIds: [],
      providers: [],
      lastEventType: "",
      lastEventAt: "",
      failed: false,
    };
    const taskId = event.payload?.taskId || "";
    const providerId = event.payload?.providerId || event.payload?.provider || "";
    acc[key] = {
      ...current,
      eventCount: current.eventCount + 1,
      taskIds: appendUnique(current.taskIds, taskId),
      providers: appendUnique(current.providers, providerId),
      lastEventType: event.type || "",
      lastEventAt: event.createdAt || "",
      failed: current.failed || isFailureEvent(event),
    };
    return acc;
  }, {});
}

function buildAuditHealth({ events = [], failures = [], lineage = {} }, options = {}) {
  const minimumEvents = Number(options.minimumEvents || 1);
  const hasRecentFailure = Boolean(failures.length);
  const missingEventLog = events.length < minimumEvents;
  const failedTargets = Object.values(lineage).filter((item) => item.failed).length;
  return {
    ok: !missingEventLog && !hasRecentFailure,
    missingEventLog,
    hasRecentFailure,
    failedTargets,
    warnings: [
      missingEventLog ? "eventLog" : "",
      hasRecentFailure ? "failedProductionEvent" : "",
      failedTargets ? "failedTargets" : "",
    ].filter(Boolean),
  };
}

function isFailureEvent(event = {}) {
  return String(event.type || "").includes("failed") || Boolean(event.payload?.error);
}

function isMilestoneEvent(event = {}) {
  const type = String(event.type || "");
  return type.includes("bootstrap")
    || type.includes("planned")
    || type.includes("completed")
    || type.includes("delivery");
}

function targetLineageKey(target = {}) {
  if (!target?.type && !target?.id) return "";
  return `${target.type || "target"}:${target.id || ""}`;
}

function appendUnique(items = [], value = "") {
  return value && !items.includes(value) ? [...items, value] : items;
}

function normalizeEvents(events = []) {
  return (Array.isArray(events) ? events : [])
    .filter(Boolean)
    .slice()
    .sort((left, right) => String(left.createdAt || "").localeCompare(String(right.createdAt || "")));
}
