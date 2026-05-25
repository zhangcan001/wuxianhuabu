export function resolvePerformanceProfile(settings, nodeCount, edgeCount, panelCount) {
  const mode = settings?.mode || "auto";
  if (mode === "quality") return "quality";
  if (mode === "lite") return "lite";
  return nodeCount > 140 || edgeCount > 220 || panelCount > 3 ? "lite" : "quality";
}

export function getNodeBounds(nodes = []) {
  if (!nodes.length) return { minX: 0, minY: 0, width: 1, height: 1 };
  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));
  return { minX, minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

export function filterNodesInViewport(nodes = [], view = {}, profile = "quality", viewport = {}) {
  const scale = view.scale || 1;
  const viewportWidth = viewport.width ?? globalThis.window?.innerWidth ?? 0;
  const viewportHeight = viewport.height ?? globalThis.window?.innerHeight ?? 0;
  const marginBase = profile === "lite" ? 420 : 700;
  const margin = marginBase / Math.max(scale, 0.12);
  const left = (-(view.x || 0) / scale) - margin;
  const top = (-(view.y || 0) / scale) - margin;
  const right = ((viewportWidth - (view.x || 0)) / scale) + margin;
  const bottom = ((viewportHeight - (view.y || 0)) / scale) + margin;
  const filtered = nodes.filter((node) => (
    node.x + node.width >= left
    && node.x <= right
    && node.y + node.height >= top
    && node.y <= bottom
  ));
  return profile === "lite" ? filtered.slice(0, 180) : filtered;
}
