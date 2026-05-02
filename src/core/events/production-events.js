export function createProductionEvent(type = "production.event", payload = {}, options = {}) {
  return {
    id: options.id || `${type}:${options.now || Date.now()}:${options.sequence || 0}`,
    type,
    actor: options.actor || "system",
    projectId: options.projectId || payload.projectId || "",
    episodeId: options.episodeId || payload.episodeId || "",
    target: options.target || payload.target || null,
    payload,
    createdAt: options.createdAt || new Date(options.now || Date.now()).toISOString(),
  };
}

export function appendProductionEvent(events = [], type = "production.event", payload = {}, options = {}) {
  const current = Array.isArray(events) ? events : [];
  return [
    ...current,
    createProductionEvent(type, payload, { ...options, sequence: current.length }),
  ];
}

export function summarizeProductionEvents(events = []) {
  const normalized = Array.isArray(events) ? events : [];
  return {
    total: normalized.length,
    byType: normalized.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {}),
    lastEvent: normalized.at(-1) || null,
  };
}
