import { useEffect, useState } from "react";

import {
  DEBUG_TRACE_EVENT,
  getDebugTraceEntries,
  loadDebugTraceEnabled,
  saveDebugTraceEnabled,
} from "../../debug-trace-helpers.js";

export function useDebugTraceState({
  storage,
  storageKey,
  sink = typeof window !== "undefined" ? window : null,
} = {}) {
  const [debugTraceEnabled, setDebugTraceEnabled] = useState(() => loadDebugTraceEnabled(storage, storageKey));
  const [debugTraceEntries, setDebugTraceEntries] = useState(() => getDebugTraceEntries(sink));

  useEffect(() => {
    saveDebugTraceEnabled(storage, storageKey, debugTraceEnabled);
  }, [debugTraceEnabled, storage, storageKey]);

  useEffect(() => {
    if (!sink || typeof sink.addEventListener !== "function") return undefined;
    const syncTraceEntries = () => {
      setDebugTraceEntries(getDebugTraceEntries(sink));
    };
    syncTraceEntries();
    sink.addEventListener(DEBUG_TRACE_EVENT, syncTraceEntries);
    return () => sink.removeEventListener(DEBUG_TRACE_EVENT, syncTraceEntries);
  }, [sink]);

  return {
    debugTraceEnabled,
    setDebugTraceEnabled,
    debugTraceEntries,
    setDebugTraceEntries,
  };
}
