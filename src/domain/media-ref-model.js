export function normalizeMediaRef(input = {}, options = {}) {
  const kind = input.kind || options.kind || "image";
  const rawUrl = stringValue(input.url || input.imageUrl || input.videoUrl || input.mediaUrl);
  const rawPath = stringValue(input.localPath || input.path || input.imagePath || input.videoPath || input.mediaPath);
  const url = isLocalPath(rawUrl) ? "" : rawUrl;
  const localPath = rawPath || (isLocalPath(rawUrl) ? rawUrl : "");
  const thumbnailUrl = stringValue(input.thumbnailUrl || input.imageThumbnailUrl || input.videoThumbnailUrl);
  const thumbnailPath = stringValue(input.thumbnailPath || input.imageThumbnailPath || input.videoThumbnailPath);
  const originalUrl = stringValue(input.originalUrl || input.originalImageUrl || input.sourceUrl);
  const key = mediaRefKey({ url, localPath, id: input.id });
  return {
    id: stringValue(input.id) || `${kind}:${key || options.index || Date.now()}`,
    kind,
    url,
    localPath,
    thumbnailUrl,
    thumbnailPath,
    originalUrl,
    provider: stringValue(input.provider || input.providerMode),
    primary: Boolean(input.primary),
    discarded: Boolean(input.discarded),
    locked: Boolean(input.locked),
    createdAt: input.createdAt || input.savedAt || options.createdAt || Date.now(),
  };
}

export function normalizeMediaRefs(items = [], options = {}) {
  const source = Array.isArray(items) ? items : [];
  return source
    .map((item, index) => normalizeMediaRef(item, { ...options, index }))
    .filter((item) => item.url || item.localPath)
    .reduce((refs, item) => upsertMediaRef(refs, item), []);
}

export function upsertMediaRef(refs = [], next = {}) {
  const item = normalizeMediaRef(next, { kind: next.kind || "image" });
  if (!(item.url || item.localPath)) return Array.isArray(refs) ? refs : [];
  const current = Array.isArray(refs) ? refs : [];
  const index = current.findIndex((candidate) => sameMediaRef(candidate, item));
  const cleared = item.primary
    ? current.map((candidate) => candidate.kind === item.kind ? { ...candidate, primary: false } : candidate)
    : current;
  if (index >= 0) {
    cleared[index] = {
      ...cleared[index],
      ...item,
      primary: item.primary || cleared[index].primary,
      discarded: item.discarded,
    };
    return cleared;
  }
  return [...cleared, item].slice(-12);
}

export function setPrimaryMediaRef(refs = [], candidate = {}, kind = "image") {
  const item = normalizeMediaRef(candidate, { kind });
  if (!(item.url || item.localPath)) return normalizeMediaRefs(refs, { kind });
  const current = normalizeMediaRefs(refs, { kind });
  const hasCandidate = current.some((ref) => sameMediaRef(ref, item));
  const source = hasCandidate ? current : [...current, item];
  return source.map((ref) => (
    ref.kind === kind
      ? { ...ref, primary: sameMediaRef(ref, item), discarded: false }
      : ref
  ));
}

export function discardMediaRef(refs = [], candidate = {}, kind = "image") {
  const item = normalizeMediaRef(candidate, { kind });
  const next = normalizeMediaRefs(refs, { kind })
    .filter((ref) => !(ref.kind === kind && sameMediaRef(ref, item)));
  if (next.some((ref) => ref.kind === kind && ref.primary)) return next;
  const fallbackIndex = findLastIndex(next, (ref) => ref.kind === kind && !ref.discarded);
  if (fallbackIndex < 0) return next;
  return next.map((ref, index) => (
    ref.kind === kind ? { ...ref, primary: index === fallbackIndex } : ref
  ));
}

export function primaryMediaRef(refs = [], kind = "image") {
  const source = normalizeMediaRefs(refs, { kind }).filter((ref) => ref.kind === kind && !ref.discarded);
  return source.find((ref) => ref.primary) || source[source.length - 1] || null;
}

export function sameMediaRef(left = {}, right = {}) {
  const leftKeys = mediaRefKeys(left);
  const rightKeys = new Set(mediaRefKeys(right));
  return leftKeys.some((key) => rightKeys.has(key));
}

export function mediaRefToAssetImageItem(ref = {}) {
  return {
    id: ref.id || "",
    imageUrl: ref.url || "",
    imagePath: ref.localPath || "",
    originalImageUrl: ref.originalUrl || "",
    thumbnailUrl: ref.thumbnailUrl || "",
    thumbnailPath: ref.thumbnailPath || "",
    primary: Boolean(ref.primary),
    discarded: Boolean(ref.discarded),
    locked: Boolean(ref.locked),
    createdAt: ref.createdAt,
  };
}

export function mediaRefToShotMediaItem(ref = {}) {
  const isVideo = ref.kind === "video";
  return {
    id: ref.id || "",
    url: ref.url || ref.localPath || "",
    path: ref.localPath || "",
    imageUrl: isVideo ? "" : ref.url || "",
    imagePath: isVideo ? "" : ref.localPath || "",
    videoUrl: isVideo ? ref.url || "" : "",
    videoPath: isVideo ? ref.localPath || "" : "",
    thumbnailUrl: ref.thumbnailUrl || "",
    thumbnailPath: ref.thumbnailPath || "",
    primary: Boolean(ref.primary),
    discarded: Boolean(ref.discarded),
    locked: Boolean(ref.locked),
    createdAt: ref.createdAt,
  };
}

export function mediaRefKeys(ref = {}) {
  return [
    ref.id,
    ref.url,
    ref.localPath,
    ref.path,
    ref.imageUrl,
    ref.imagePath,
    ref.videoUrl,
    ref.videoPath,
  ].map(stringValue).filter(Boolean);
}

function mediaRefKey(ref = {}) {
  return mediaRefKeys(ref)[0] || "";
}

function stringValue(value = "") {
  return String(value || "").trim();
}

function isLocalPath(value = "") {
  const text = String(value || "");
  return /^[a-zA-Z]:[\\/]/.test(text) || /^\\\\/.test(text) || text.startsWith("/");
}

function findLastIndex(items = [], predicate = () => false) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index], index)) return index;
  }
  return -1;
}
