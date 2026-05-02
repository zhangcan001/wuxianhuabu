export function normalizeProjectResource(resource, fallbackEpisodeId = "", index = 0) {
  const name = String(resource?.name || resource?.fileName || `资源${index + 1}`).trim() || `资源${index + 1}`;
  const kind = normalizeResourceKind(resource?.kind || inferResourceKind({ name, mimeType: resource?.mimeType || "" }));
  const token = resource?.token || makeResourceToken(name);
  return {
    id: resource?.id || `resource-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    token,
    kind,
    mimeType: resource?.mimeType || "",
    dataUrl: resource?.dataUrl || "",
    previewUrl: resource?.previewUrl || resource?.dataUrl || "",
    filePath: resource?.filePath || "",
    thumbnailUrl: resource?.thumbnailUrl || "",
    thumbnailPath: resource?.thumbnailPath || "",
    textContent: resource?.textContent || "",
    size: Number(resource?.size || 0),
    scene: resource?.scene || "",
    shot: resource?.shot || "",
    note: resource?.note || "",
    tags: resource?.tags || "",
    storageMode: resource?.storageMode || (resource?.dataUrl || resource?.textContent ? "embedded" : "metadata"),
    episodeId: resource?.episodeId ?? fallbackEpisodeId ?? "",
    createdAt: Number(resource?.createdAt || Date.now()),
    updatedAt: Number(resource?.updatedAt || Date.now()),
  };
}

export function resourceForStorage(resource, compact = false) {
  return {
    id: resource.id,
    name: resource.name,
    token: resource.token,
    kind: resource.kind,
    mimeType: resource.mimeType,
    dataUrl: compact ? "" : (resource.dataUrl || ""),
    previewUrl: compact ? "" : (resource.previewUrl || ""),
    filePath: resource.filePath || "",
    thumbnailUrl: resource.thumbnailUrl || "",
    thumbnailPath: resource.thumbnailPath || "",
    textContent: compact && String(resource.textContent || "").length > 200000 ? "" : (resource.textContent || ""),
    size: resource.size || 0,
    scene: resource.scene || "",
    shot: resource.shot || "",
    note: resource.note || "",
    tags: resource.tags || "",
    storageMode: compact ? "metadata" : (resource.storageMode || "metadata"),
    episodeId: resource.episodeId || "",
    createdAt: resource.createdAt || 0,
    updatedAt: resource.updatedAt || 0,
  };
}

export function makeResourceToken(name) {
  return `@资源_${String(name).replace(/\s+/g, "").replace(/[^\u4e00-\u9fa5A-Za-z0-9_-]/g, "") || "未命名"}`;
}

export function resourceMatchesQuery(resource, query) {
  const keyword = String(query || "").trim().toLowerCase();
  if (!keyword) return true;
  const haystack = `${resource.name} ${resource.token} ${resource.scene || ""} ${resource.shot || ""} ${resource.tags || ""} ${resource.note || ""}`.toLowerCase();
  return haystack.includes(keyword);
}

export function normalizeResourceKind(kind) {
  return ["image", "video", "script", "template", "doc", "reference"].includes(kind) ? kind : "reference";
}

export function inferResourceKind(file) {
  const name = String(file?.name || "").toLowerCase();
  const mimeType = String(file?.mimeType || file?.type || "").toLowerCase();
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (/(template|模版|模板|preset)/.test(name)) return "template";
  if (/(script|剧本|脚本|story|novel|shot|分镜)/.test(name)) return "script";
  if (/\.(pdf|doc|docx|txt|md|json)$/i.test(name)) return "doc";
  return "reference";
}

export function buildProjectResourceIndex(resources, nodes, episodes, activeEpisodeId, options = {}) {
  const usage = collectProjectResourceUsage(nodes, resources, episodes, options);
  const items = (resources || []).map((resource) => {
    const references = usage.byToken.get(resource.token) || [];
    return {
      ...resource,
      references,
      referenceCount: references.length,
      missing: false,
      missingMentions: [],
    };
  });
  const missingRefs = usage.missing;
  return {
    items,
    activeItems: items.filter((resource) => !resource.episodeId || resource.episodeId === activeEpisodeId),
    globalItems: items.filter((resource) => !resource.episodeId),
    images: items.filter((resource) => resource.kind === "image"),
    videos: items.filter((resource) => resource.kind === "video"),
    scripts: items.filter((resource) => resource.kind === "script"),
    templates: items.filter((resource) => resource.kind === "template"),
    docs: items.filter((resource) => resource.kind === "doc"),
    references: items.filter((resource) => resource.kind === "reference"),
    byToken: new Map(items.map((resource) => [resource.token, resource])),
    metadataOnly: items.filter((resource) => resource.storageMode === "metadata").length,
    missingRefs,
  };
}

export function collectProjectResourceUsage(nodes, resources, episodes, options = {}) {
  const fallback = episodes?.[0]?.id || "episode-1";
  const getNodeTypeLabel = typeof options.nodeTypeLabel === "function"
    ? options.nodeTypeLabel
    : (type) => type || "节点";
  const byToken = new Map((resources || []).map((resource) => [resource.token, []]));
  const knownTokens = new Set(byToken.keys());
  const missing = [];
  (nodes || []).forEach((node) => {
    walkStringFields(node.data || {}, [], (text, path) => {
      extractResourceTokens(text).forEach((token) => {
        const reference = {
          token,
          nodeId: node.id,
          nodeTitle: node.data?.displayName || getNodeTypeLabel(node.type),
          nodeType: node.type,
          episodeId: node.data?.episodeId || fallback,
          path: formatReferencePath(path),
        };
        if (knownTokens.has(token)) byToken.get(token).push(reference);
        else missing.push(reference);
      });
    });
  });
  return { byToken, missing };
}

export function walkStringFields(value, path, visit) {
  if (typeof value === "string") {
    visit(value, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkStringFields(item, [...path, index], visit));
    return;
  }
  if (!value || typeof value !== "object") return;
  Object.entries(value).forEach(([key, entry]) => walkStringFields(entry, [...path, key], visit));
}

export function formatReferencePath(path) {
  if (!path?.length) return "内容";
  return path.map((part) => {
    if (typeof part === "number") return `#${part + 1}`;
    if (part === "shots") return "镜头";
    if (part === "imagePrompt") return "图片提示词";
    if (part === "videoPrompt") return "视频提示词";
    if (part === "note") return "备注";
    if (part === "text") return "文本";
    return String(part);
  }).join(" / ");
}

export function extractResourceTokens(text) {
  const matches = String(text || "").match(/@资源_[\u4e00-\u9fa5A-Za-z0-9_-]+/g) || [];
  return [...new Set(matches)];
}

export function resourceKindLabel(kind) {
  return {
    image: "图片",
    video: "视频",
    script: "脚本",
    template: "模板",
    doc: "文档",
    reference: "参考",
  }[kind] || "参考";
}

export function resourceKindShort(kind) {
  return {
    image: "IMG",
    video: "VID",
    script: "TXT",
    template: "TPL",
    doc: "DOC",
    reference: "REF",
  }[kind] || "REF";
}

export function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let current = value;
  let unitIndex = 0;
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }
  return `${current >= 10 || unitIndex === 0 ? current.toFixed(unitIndex ? 1 : 0) : current.toFixed(2)} ${units[unitIndex]}`;
}

export function parseDurationSeconds(value) {
  const text = String(value || "").trim();
  if (!text) return 0;
  const match = text.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : 0;
}

export async function createProjectResourceFromFile(file, episodeId, options = {}) {
  const kind = inferResourceKind(file);
  const shouldEmbedBinary = file.size <= 4 * 1024 * 1024;
  const shouldEmbedText = file.size <= 800 * 1024;
  const summarizeText = typeof options.summarizeText === "function"
    ? options.summarizeText
    : (text, maxLength) => String(text || "").slice(0, maxLength);
  const persistMediaAsset = typeof options.persistMediaAsset === "function"
    ? options.persistMediaAsset
    : null;
  const resource = {
    name: file.name.replace(/\.[^.]+$/, ""),
    kind,
    mimeType: file.type || "",
    size: file.size || 0,
    episodeId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  if (["image", "video"].includes(kind) && persistMediaAsset) {
    const dataUrl = await readFileAsDataUrl(file);
    const persisted = await persistMediaAsset({
      mediaUrl: dataUrl,
      mediaType: kind,
      fileName: file.name,
    });
    if (persisted?.mediaPath) {
      resource.previewUrl = persisted.mediaUrl || "";
      resource.filePath = persisted.mediaPath || "";
      resource.thumbnailUrl = persisted.thumbnailUrl || "";
      resource.thumbnailPath = persisted.thumbnailPath || "";
      resource.storageMode = "file";
    } else if (shouldEmbedBinary) {
      resource.dataUrl = dataUrl;
      resource.previewUrl = dataUrl;
      resource.storageMode = "embedded";
    } else {
      resource.storageMode = "metadata";
      resource.note = `${resourceKindLabel(kind)}资源已登记，原文件较大，当前工程仅保存元信息。`;
    }
  } else if (["image", "video"].includes(kind) && shouldEmbedBinary) {
    const dataUrl = await readFileAsDataUrl(file);
    resource.dataUrl = dataUrl;
    resource.previewUrl = dataUrl;
    resource.storageMode = "embedded";
  } else if (["script", "template", "doc", "reference"].includes(kind) && shouldEmbedText) {
    const text = await readFileAsText(file);
    resource.textContent = text;
    resource.note = summarizeText(text, 120);
    resource.storageMode = "embedded";
  } else {
    resource.storageMode = "metadata";
    resource.note = `${resourceKindLabel(kind)}资源已登记，原文件较大，当前工程仅保存元信息。`;
  }
  return resource;
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("读取文件失败"));
    reader.readAsText(file);
  });
}

export function expandResourceReferences(text, resourceIndex) {
  if (!text || !resourceIndex?.items?.length) return String(text || "");
  let expanded = String(text || "");
  resourceIndex.items.forEach((resource) => {
    const escaped = escapeRegExp(resource.token);
    const note = resource.note || resource.name || resource.token;
    expanded = expanded.replace(new RegExp(`${escaped}(?![\\u4e00-\\u9fa5A-Za-z0-9_-])`, "g"), `${resource.token}：${note}`);
  });
  return expanded;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
