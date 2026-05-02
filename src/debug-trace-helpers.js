export const DEBUG_TRACE_EVENT = "wuxian:debug-trace";

function createDebugTraceEvent(detail) {
  if (typeof CustomEvent === "function") {
    return new CustomEvent(DEBUG_TRACE_EVENT, { detail });
  }
  return { type: DEBUG_TRACE_EVENT, detail };
}

export function loadDebugTraceEnabled(storage, storageKey) {
  try {
    return storage?.getItem(storageKey) === "1";
  } catch {
    return false;
  }
}

export function saveDebugTraceEnabled(storage, storageKey, enabled) {
  try {
    if (!enabled) {
      storage?.removeItem(storageKey);
      return;
    }
    storage?.setItem(storageKey, "1");
  } catch {
    // Ignore storage failures in private mode or restricted environments.
  }
}

export function appendDebugTraceEntry(existingEntries, entry, limit = 200) {
  return [...(Array.isArray(existingEntries) ? existingEntries : []), entry].slice(-limit);
}

export function getDebugTraceEntries(sink = typeof window !== "undefined" ? window : null) {
  return Array.isArray(sink?.__WUXIAN_TRACE__) ? sink.__WUXIAN_TRACE__ : [];
}

export function clearDebugTraceEntries(sink = typeof window !== "undefined" ? window : null) {
  if (!sink) return [];
  sink.__WUXIAN_TRACE__ = [];
  if (typeof sink.dispatchEvent === "function") {
    sink.dispatchEvent(createDebugTraceEvent({ cleared: true, entries: [] }));
  }
  return sink.__WUXIAN_TRACE__;
}

export function emitDebugTrace(options) {
  const {
    enabled,
    event,
    payload = {},
    sink = typeof window !== "undefined" ? window : null,
    now = () => new Date().toISOString(),
    logger = console.info,
  } = options;
  if (!enabled) return null;
  const entry = {
    time: now(),
    event,
    payload,
  };
  if (sink) {
    sink.__WUXIAN_TRACE__ = appendDebugTraceEntry(sink.__WUXIAN_TRACE__, entry);
    if (typeof sink.dispatchEvent === "function") {
      sink.dispatchEvent(createDebugTraceEvent({ entry, entries: sink.__WUXIAN_TRACE__ }));
    }
  }
  logger(`[WuxianTrace] ${event}`, payload);
  return entry;
}
