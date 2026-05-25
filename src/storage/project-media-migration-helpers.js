export function isEmbeddedImageUrl(value) {
  return typeof value === "string" && value.trim().startsWith("data:image/");
}

export async function migrateProjectEmbeddedImages(project, deps = {}) {
  const {
    persistImage,
    enabled = true,
    fileNamePrefix = "migrated-image",
  } = deps;
  if (!enabled || typeof persistImage !== "function" || !project || typeof project !== "object") {
    return { project, migratedCount: 0 };
  }
  const cache = new Map();
  let migratedCount = 0;
  async function persist(imageUrl, fileName) {
    if (!isEmbeddedImageUrl(imageUrl)) return null;
    if (!cache.has(imageUrl)) {
      cache.set(imageUrl, persistImage({ imageUrl, fileName }));
    }
    const result = await cache.get(imageUrl);
    migratedCount += 1;
    return result;
  }
  const nodes = await Promise.all((project.nodes || []).map((node, index) => migrateNode(node, {
    persist,
    fileNamePrefix: `${fileNamePrefix}-node-${node?.id || index}`,
  })));
  const resources = await Promise.all((project.resources || []).map((resource, index) => migrateResource(resource, {
    persist,
    fileNamePrefix: `${fileNamePrefix}-resource-${resource?.id || index}`,
  })));
  return {
    project: {
      ...project,
      nodes,
      resources,
    },
    migratedCount,
  };
}

async function migrateNode(node, deps) {
  if (!node?.data || typeof node.data !== "object") return node;
  let data = { ...node.data };
  if (node.type === "assetLibrary") {
    data = await migrateAssetLibraryData(data, deps);
  }
  data = await migrateImageField(data, "imageUrl", "image", deps);
  data = await migrateImageField(data, "panorama", "panorama", deps);
  data = await migrateNestedPreviewFields(data, deps);
  return { ...node, data };
}

async function migrateAssetLibraryData(data, deps) {
  const next = { ...data };
  for (const key of ["characters", "scenes", "props"]) {
    const items = Array.isArray(next[key]) ? next[key] : [];
    next[key] = await Promise.all(items.map((asset, index) => migrateAsset(asset, {
      ...deps,
      fileNamePrefix: `${deps.fileNamePrefix}-${key}-${index}`,
    })));
  }
  return next;
}

async function migrateAsset(asset, deps) {
  if (!asset || typeof asset !== "object") return asset;
  let next = { ...asset };
  next = await migrateImageField(next, "imageUrl", "image", deps);
  const imageItems = await migrateImageItemList([
    ...(Array.isArray(next.imageItems) ? next.imageItems : []),
    ...(Array.isArray(next.images) ? next.images : []),
  ], { ...deps, fileNamePrefix: `${deps.fileNamePrefix}-image` });
  const rejectedImageItems = await migrateImageItemList([
    ...(Array.isArray(next.rejectedImageItems) ? next.rejectedImageItems : []),
    ...(Array.isArray(next.rejectedImages) ? next.rejectedImages : []),
  ], { ...deps, fileNamePrefix: `${deps.fileNamePrefix}-rejected` });
  if (imageItems.length) {
    const primary = imageItems.find((item) => item.imageUrl === next.imageUrl) || imageItems[0];
    next = {
      ...next,
      imageUrl: primary.imageUrl,
      imagePath: primary.imagePath || next.imagePath || "",
      originalImageUrl: primary.originalImageUrl || next.originalImageUrl || "",
      imageThumbnailUrl: primary.imageThumbnailUrl || next.imageThumbnailUrl || "",
      imageThumbnailPath: primary.imageThumbnailPath || next.imageThumbnailPath || "",
      imageItems,
      images: imageItems.map((item) => item.imageUrl),
    };
  }
  if (rejectedImageItems.length) {
    next.rejectedImageItems = rejectedImageItems;
    next.rejectedImages = rejectedImageItems.map((item) => item.imageUrl);
  }
  return next;
}

async function migrateImageItemList(items, deps) {
  const seen = new Set();
  const migrated = [];
  for (let index = 0; index < items.length; index += 1) {
    const raw = items[index];
    const item = typeof raw === "string" ? { imageUrl: raw } : { ...(raw || {}) };
    if (!item.imageUrl) continue;
    const persisted = await deps.persist(item.imageUrl, `${deps.fileNamePrefix}-${index}`);
    const next = persisted ? toImageItem(persisted) : normalizeImageItem(item);
    if (!next.imageUrl || seen.has(next.imageUrl)) continue;
    seen.add(next.imageUrl);
    migrated.push(next);
  }
  return migrated.slice(-8);
}

async function migrateImageField(object, field, fileNamePart, deps) {
  const value = object?.[field];
  if (!isEmbeddedImageUrl(value)) return object;
  const persisted = await deps.persist(value, `${deps.fileNamePrefix}-${fileNamePart}`);
  if (!persisted) return object;
  const prefix = field === "imageUrl" ? "image" : field;
  return {
    ...object,
    [field]: persisted.imageUrl,
    [`${prefix}Path`]: persisted.imagePath || object[`${prefix}Path`] || "",
    [`original${capitalize(prefix)}Url`]: persisted.originalImageUrl || value,
    [`${prefix}ThumbnailUrl`]: persisted.imageThumbnailUrl || "",
    [`${prefix}ThumbnailPath`]: persisted.imageThumbnailPath || "",
  };
}

async function migrateNestedPreviewFields(data, deps) {
  if (!data?.result || typeof data.result !== "object") return data;
  if (!isEmbeddedImageUrl(data.result.previewUrl)) return data;
  const persisted = await deps.persist(data.result.previewUrl, `${deps.fileNamePrefix}-preview`);
  if (!persisted) return data;
  return {
    ...data,
    result: {
      ...data.result,
      previewUrl: persisted.imageThumbnailUrl || persisted.imageUrl,
      filePath: persisted.imagePath || "",
      thumbnailUrl: persisted.imageThumbnailUrl || "",
      thumbnailPath: persisted.imageThumbnailPath || "",
      originalPreviewUrl: data.result.previewUrl,
    },
  };
}

async function migrateResource(resource, deps) {
  if (!resource || typeof resource !== "object" || resource.kind !== "image") return resource;
  const source = isEmbeddedImageUrl(resource.dataUrl) ? resource.dataUrl : resource.previewUrl;
  if (!isEmbeddedImageUrl(source)) return resource;
  const persisted = await deps.persist(source, deps.fileNamePrefix);
  if (!persisted) return resource;
  return {
    ...resource,
    dataUrl: "",
    previewUrl: persisted.imageUrl,
    filePath: persisted.imagePath || "",
    thumbnailUrl: persisted.imageThumbnailUrl || "",
    thumbnailPath: persisted.imageThumbnailPath || "",
    originalDataUrl: resource.dataUrl || "",
    storageMode: "file",
  };
}

function toImageItem(persisted) {
  return normalizeImageItem({
    imageUrl: persisted.imageUrl,
    imagePath: persisted.imagePath,
    originalImageUrl: persisted.originalImageUrl,
    imageThumbnailUrl: persisted.imageThumbnailUrl,
    imageThumbnailPath: persisted.imageThumbnailPath,
  });
}

function normalizeImageItem(item) {
  return {
    imageUrl: item.imageUrl || "",
    imagePath: item.imagePath || "",
    originalImageUrl: item.originalImageUrl || "",
    thumbnailUrl: item.thumbnailUrl || item.imageThumbnailUrl || "",
    thumbnailPath: item.thumbnailPath || item.imageThumbnailPath || "",
  };
}

function capitalize(value) {
  const text = String(value || "");
  return text ? `${text[0].toUpperCase()}${text.slice(1)}` : "";
}
