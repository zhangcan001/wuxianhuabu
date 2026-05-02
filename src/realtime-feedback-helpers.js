import { applyTimelineRenderProgress } from "./queue-state-helpers.js";

export function buildTimelineRenderMessage(progress, message) {
  const safeMessage = String(message || "");
  const numeric = Number(progress);
  const prefix = Number.isFinite(numeric)
    ? `导出中 ${Math.max(0, Math.min(100, numeric))}% · `
    : "导出中 · ";
  return `${prefix}${safeMessage}`;
}

export function handleTimelineRenderEvent({
  queue,
  payload,
  activeRequestId = "",
  now,
}) {
  const result = applyTimelineRenderProgress(queue, payload, now ? { now } : undefined);
  const requestId = String(payload?.requestId || "");
  const message = String(payload?.message || "");
  return {
    queue: result.queue,
    changed: result.changed,
    projectMessage:
      requestId && activeRequestId === requestId && message
        ? buildTimelineRenderMessage(payload?.progress, message)
        : "",
  };
}
