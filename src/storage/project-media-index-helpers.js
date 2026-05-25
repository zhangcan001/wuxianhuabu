const PATH_KEY_PATTERN = /(path|url|src|preview|thumbnail|image|video|media|file)$/i;
const MEDIA_CACHE_PATTERN = /media-cache/i;

export function normalizeMediaPath(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/%5c/gi, "/")
    .replace(/%2f/gi, "/")
    .toLowerCase();
}

export function collectProjectMediaReferences(project) {
  const references = [];
  const seen = new Set();

  function add(value, path) {
    const raw = String(value || "").trim();
    if (!raw) return;
    const normalized = normalizeMediaPath(raw);
    if (!MEDIA_CACHE_PATTERN.test(normalized) && !looksLikeLocalMediaReference(raw, path)) return;
    const key = `${normalized}::${path}`;
    if (seen.has(key)) return;
    seen.add(key);
    references.push({ value: raw, normalized, path });
  }

  function visit(value, path = "project") {
    if (typeof value === "string") {
      add(value, path);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (!value || typeof value !== "object") return;
    Object.entries(value).forEach(([key, item]) => {
      const nextPath = `${path}.${key}`;
      if (typeof item === "string") {
        if (PATH_KEY_PATTERN.test(key) || MEDIA_CACHE_PATTERN.test(item)) add(item, nextPath);
        return;
      }
      visit(item, nextPath);
    });
  }

  visit(project);
  return { references, referencedPaths: references.map((item) => item.normalized) };
}

export function buildMediaCacheReport(project, cacheFiles) {
  const files = Array.isArray(cacheFiles) ? cacheFiles : [];
  const { references } = collectProjectMediaReferences(project);
  const referencedFiles = [];
  const orphanFiles = [];

  files.forEach((file) => {
    const normalizedPath = normalizeMediaPath(file?.path || "");
    const normalizedName = normalizeMediaPath(file?.fileName || file?.file_name || "");
    const matchedReferences = references.filter((reference) => {
      if (!reference.normalized) return false;
      return reference.normalized.includes(normalizedPath)
        || normalizedPath.includes(reference.normalized)
        || (normalizedName && reference.normalized.includes(normalizedName));
    });
    const enrichedFile = {
      ...file,
      normalizedPath,
      references: matchedReferences.map((reference) => ({
        path: reference.path,
        value: reference.value,
      })),
    };
    (matchedReferences.length ? referencedFiles : orphanFiles).push(enrichedFile);
  });

  return {
    references,
    totalFiles: files.length,
    totalSize: files.reduce((sum, file) => sum + safeSize(file), 0),
    thumbnailCount: files.filter((file) => Boolean(file?.isThumbnail ?? file?.is_thumbnail)).length,
    referencedCount: referencedFiles.length,
    orphanCount: orphanFiles.length,
    orphanSize: orphanFiles.reduce((sum, file) => sum + safeSize(file), 0),
    referencedFiles,
    orphanFiles,
  };
}

export function buildMediaCacheCleanupReport(project, cacheFiles, options = {}) {
  const report = buildMediaCacheReport(project, cacheFiles);
  const reviewedReport = applyMediaCacheReviewDecisions(report, options.reviewDecisions || {});
  const generatedAt = options.generatedAt || new Date().toISOString();
  return {
    generatedAt,
    summary: {
      totalFiles: reviewedReport.totalFiles,
      totalSize: reviewedReport.totalSize,
      thumbnailCount: reviewedReport.thumbnailCount,
      referencedCount: reviewedReport.referencedCount,
      orphanCount: reviewedReport.orphanCount,
      orphanSize: reviewedReport.orphanSize,
      referenceCount: reviewedReport.references.length,
      pendingOrphanCount: reviewedReport.pendingOrphanFiles.length,
      keptOrphanCount: reviewedReport.keptOrphanFiles.length,
      ignoredOrphanCount: reviewedReport.ignoredOrphanFiles.length,
    },
    referencedFiles: reviewedReport.referencedFiles.map(serializeReportFile),
    orphanFiles: reviewedReport.orphanFiles.map(serializeReportFile),
    pendingOrphanFiles: reviewedReport.pendingOrphanFiles.map(serializeReportFile),
    keptOrphanFiles: reviewedReport.keptOrphanFiles.map(serializeReportFile),
    ignoredOrphanFiles: reviewedReport.ignoredOrphanFiles.map(serializeReportFile),
    deletionAudit: Array.isArray(options.deletionAudit) ? options.deletionAudit : [],
  };
}

export function applyMediaCacheReviewDecisions(report, reviewDecisions = {}) {
  const orphanFiles = (report?.orphanFiles || []).map((file) => ({
    ...file,
    reviewDecision: reviewDecisions[getMediaCacheFileKey(file)] || "pending",
  }));
  return {
    ...(report || {}),
    orphanFiles,
    pendingOrphanFiles: orphanFiles.filter((file) => file.reviewDecision === "pending"),
    keptOrphanFiles: orphanFiles.filter((file) => file.reviewDecision === "keep"),
    ignoredOrphanFiles: orphanFiles.filter((file) => file.reviewDecision === "ignore"),
  };
}

export function getMediaCacheFileKey(file) {
  return normalizeMediaPath(file?.path || file?.fileName || file?.file_name || "");
}

function looksLikeLocalMediaReference(value, path) {
  const normalized = normalizeMediaPath(value);
  if (/^[a-z]:\//.test(normalized) || normalized.startsWith("/") || normalized.startsWith("asset:")) {
    return /\.(png|jpe?g|webp|gif|mp4|mov|webm|mp3|wav|m4a|ogg)$/i.test(normalized) || PATH_KEY_PATTERN.test(path);
  }
  return false;
}

function serializeReportFile(file) {
  return {
    path: file.path || "",
    fileName: file.fileName || file.file_name || "",
    size: safeSize(file),
    modifiedAt: file.modifiedAt || file.modified_at || 0,
    isThumbnail: Boolean(file.isThumbnail ?? file.is_thumbnail),
    reviewDecision: file.reviewDecision || "pending",
    references: Array.isArray(file.references) ? file.references : [],
  };
}

function safeSize(file) {
  const size = Number(file?.size);
  return Number.isFinite(size) && size > 0 ? size : 0;
}
