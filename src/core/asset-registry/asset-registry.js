export function createAssetRegistry(input = {}) {
  const assets = normalizeAssets(input.assets || []);
  return {
    id: input.id || "asset-registry",
    projectId: input.projectId || "",
    assets,
    indexes: buildAssetIndexes(assets),
    summary: summarizeAssetRegistry(assets),
  };
}

export function upsertRegistryAsset(registry = createAssetRegistry(), asset = {}) {
  const normalized = normalizeAsset(asset, registry.assets?.length || 0);
  const existing = Array.isArray(registry.assets) ? registry.assets : [];
  const matched = existing.some((item) => item.id === normalized.id || (normalized.token && item.token === normalized.token));
  const assets = matched
    ? existing.map((item) => (item.id === normalized.id || (normalized.token && item.token === normalized.token) ? { ...item, ...normalized } : item))
    : [...existing, normalized];
  return createAssetRegistry({ ...registry, assets });
}

export function lockRegistryAsset(registry = createAssetRegistry(), assetId = "", patch = {}) {
  const assets = (registry.assets || []).map((asset) => (
    asset.id === assetId || asset.token === assetId
      ? normalizeAsset({ ...asset, ...patch, lifecycle: "locked", reviewStatus: patch.reviewStatus || "approved" })
      : asset
  ));
  return createAssetRegistry({ ...registry, assets });
}

export function findRegistryAsset(registry = createAssetRegistry(), query = "") {
  const key = String(query || "").trim();
  if (!key) return null;
  return registry.indexes.byId[key] || registry.indexes.byToken[key] || registry.indexes.byName[key] || null;
}

export function validateAssetContinuity(registry = createAssetRegistry(), shots = []) {
  const missingRefs = [];
  const unlockedRefs = [];
  (Array.isArray(shots) ? shots : []).forEach((shot) => {
    (Array.isArray(shot.assetRefs) ? shot.assetRefs : []).filter(Boolean).forEach((token) => {
      const asset = findRegistryAsset(registry, token);
      if (!asset) {
        missingRefs.push({ shotId: shot.id || "", token });
        return;
      }
      if (!["locked", "approved"].includes(asset.lifecycle)) {
        unlockedRefs.push({ shotId: shot.id || "", token, lifecycle: asset.lifecycle });
      }
    });
  });
  return {
    ok: missingRefs.length === 0 && unlockedRefs.length === 0,
    missingRefs,
    unlockedRefs,
  };
}

export function buildAssetUsageMap(registry = createAssetRegistry(), shots = []) {
  const usage = {};
  (registry.assets || []).forEach((asset) => {
    const key = asset.token || asset.id;
    if (key) usage[key] = [];
  });
  (Array.isArray(shots) ? shots : []).forEach((shot) => {
    (Array.isArray(shot.assetRefs) ? shot.assetRefs : []).filter(Boolean).forEach((token) => {
      if (!usage[token]) usage[token] = [];
      usage[token].push(shot.id || "");
    });
  });
  return usage;
}

function normalizeAssets(assets = []) {
  return (Array.isArray(assets) ? assets : []).map((asset, index) => normalizeAsset(asset, index));
}

function normalizeAsset(asset = {}, index = 0) {
  const id = asset.id || asset.token || `asset-${index + 1}`;
  return {
    id,
    type: asset.type || "character",
    name: asset.name || asset.token || id,
    token: asset.token || "",
    canonicalPrompt: asset.canonicalPrompt || asset.prompt || "",
    visualFingerprint: asset.visualFingerprint || asset.visualLock || "",
    lifecycle: asset.lifecycle || asset.status || "draft",
    references: Array.isArray(asset.references) ? asset.references : [],
    variants: Array.isArray(asset.variants) ? asset.variants : [],
    reviewStatus: asset.reviewStatus || "pending",
  };
}

function buildAssetIndexes(assets = []) {
  return assets.reduce((indexes, asset) => {
    indexes.byId[asset.id] = asset;
    if (asset.token) indexes.byToken[asset.token] = asset;
    if (asset.name) indexes.byName[asset.name] = asset;
    return indexes;
  }, { byId: {}, byToken: {}, byName: {} });
}

function summarizeAssetRegistry(assets = []) {
  return {
    total: assets.length,
    characters: assets.filter((asset) => asset.type === "character").length,
    scenes: assets.filter((asset) => asset.type === "scene").length,
    props: assets.filter((asset) => asset.type === "prop").length,
    locked: assets.filter((asset) => ["locked", "approved"].includes(asset.lifecycle)).length,
    draft: assets.filter((asset) => asset.lifecycle === "draft").length,
  };
}
