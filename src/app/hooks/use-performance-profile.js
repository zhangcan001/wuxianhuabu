import { useMemo, useState } from "react";
import { resolvePerformanceProfile } from "../../canvas/canvas-performance-helpers.js";

export function usePerformanceProfile(initial, { nodeCount = 0, edgeCount = 0, panelCount = 0 } = {}) {
  const [performanceSettings, setPerformanceSettings] = useState(initial);
  const performanceProfile = useMemo(
    () => resolvePerformanceProfile(performanceSettings, nodeCount, edgeCount, panelCount),
    [performanceSettings, nodeCount, edgeCount, panelCount],
  );
  return { performanceSettings, setPerformanceSettings, performanceProfile };
}
