export function safeFileName(name, {
  maxLength = 40,
  fallback = "result",
} = {}) {
  const cleaned = String(name || "").replace(/[\\/:*?"<>|]+/g, "_").slice(0, maxLength);
  return cleaned || fallback;
}

export function shortPath(path) {
  const parts = String(path || "").split(/[\\/]/).filter(Boolean);
  if (parts.length <= 2) return path;
  return `${parts.at(-2)}\\${parts.at(-1)}`;
}
