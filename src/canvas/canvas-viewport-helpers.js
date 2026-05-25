export function screenToWorld(x, y, view = {}) {
  const scale = view.scale || 1;
  return { x: (x - (view.x || 0)) / scale, y: (y - (view.y || 0)) / scale };
}

export function worldToScreen(x, y, view = {}) {
  const scale = view.scale || 1;
  return { x: x * scale + (view.x || 0), y: y * scale + (view.y || 0) };
}

export function isPanSurfaceTarget(target, stage) {
  if (!target) return false;
  if (target === stage) return true;
  return target.classList?.contains("canvas-bg") || target.classList?.contains("edge-layer");
}

export function isCanvasZoomTarget(target, stage) {
  if (!target) return false;
  if (target === stage) return true;
  if (target.closest?.("input,textarea,select,.node,.settings-panel,.asset-drawer,.prompt-preview-panel,.queue-panel,.dashboard-panel,.context-menu,.add-menu")) return false;
  return target.classList?.contains("canvas-bg") || target.classList?.contains("edge-layer");
}

export function isMarqueeTarget(target, stage) {
  if (!target) return false;
  if (target === stage) return true;
  if (target.closest?.("input,textarea,select,.settings-panel,.asset-drawer,.prompt-preview-panel,.queue-panel,.dashboard-panel,.context-menu,.add-menu,button,label")) return false;
  return true;
}

export function cssEscape(value, css = globalThis.CSS) {
  if (css?.escape) return css.escape(String(value));
  return String(value).replace(/["\\]/g, "\\$&");
}

export function previewEdgePath(from, to) {
  const mid = Math.max(70, Math.abs(to.x - from.x) / 2);
  return `M ${from.x} ${from.y} C ${from.x + mid} ${from.y}, ${to.x - mid} ${to.y}, ${to.x} ${to.y}`;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function positiveModulo(value, modulo) {
  return ((value % modulo) + modulo) % modulo;
}
