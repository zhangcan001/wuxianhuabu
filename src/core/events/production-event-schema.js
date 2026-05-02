export function normalizeProductionEvent(event = {}, defaults = {}) {
  const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
  const target = event.target || payload.target || {};
  return {
    type: String(event.type || "production.event").trim(),
    at: event.at || event.time || new Date(0).toISOString(),
    actor: event.actor || defaults.actor || "system",
    projectId: event.projectId || payload.projectId || defaults.projectId || "",
    episodeId: event.episodeId || payload.episodeId || defaults.episodeId || "",
    target: {
      type: target.type || event.targetType || "",
      id: target.id || event.targetId || "",
    },
    severity: event.severity || inferSeverity(event),
    recoverable: event.recoverable ?? inferRecoverable(event),
    payload,
  };
}

export function normalizeProductionEvents(events = [], defaults = {}) {
  return (Array.isArray(events) ? events : []).map((event) => normalizeProductionEvent(event, defaults));
}

function inferSeverity(event = {}) {
  const type = String(event.type || "").toLowerCase();
  if (type.includes("failed") || type.includes("error")) return "error";
  if (type.includes("blocked") || type.includes("warning")) return "warning";
  return "info";
}

function inferRecoverable(event = {}) {
  const type = String(event.type || "").toLowerCase();
  return type.includes("failed") || type.includes("blocked") || type.includes("repair");
}
