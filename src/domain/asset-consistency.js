export function buildAssetConsistencyPlan(episode = {}) {
  const assets = Array.isArray(episode.assets) ? episode.assets : [];
  const shots = Array.isArray(episode.shots) ? episode.shots : [];
  const assetByToken = new Map();
  const duplicates = [];
  const lockedAssetIds = [];
  const enrichedAssetIds = [];

  assets.forEach((asset) => {
    const token = assetToken(asset);
    if (!token) return;
    if (assetByToken.has(token)) duplicates.push({ token, keepId: assetByToken.get(token).id, duplicateId: asset.id || token });
    else assetByToken.set(token, asset);
    const hasVisualLock = hasText(asset.visualLock || asset.visualAnchor || asset.prompt || asset.canonicalPrompt);
    const hasImage = hasText(asset.imageUrl || asset.imagePath || asset.image || asset.image?.url);
    if ((hasVisualLock || hasImage) && asset.lifecycle !== "locked" && !asset.locked) lockedAssetIds.push(asset.id || token);
    if ((hasVisualLock || hasImage) && !asset.continuityRule) enrichedAssetIds.push(asset.id || token);
  });

  const characterTokens = assets.filter((asset) => assetKind(asset) === "character").map(assetToken).filter(Boolean);
  const sceneTokens = assets.filter((asset) => assetKind(asset) === "scene").map(assetToken).filter(Boolean);
  const missingRefs = [];
  const shotPatches = [];

  shots.forEach((shot, index) => {
    const refs = Array.isArray(shot.assetRefs) ? shot.assetRefs.map(normalizeToken).filter(Boolean) : [];
    const validRefs = refs.filter((token) => assetByToken.has(token));
    refs.forEach((token) => {
      if (!assetByToken.has(token)) missingRefs.push({ shotId: shot.id || `S${index + 1}`, token });
    });
    const patch = {};
    const nextRefs = [...validRefs];
    const preferredCharacterToken = pickTokenForShot(shot, characterTokens, assetByToken) || characterTokens[0];
    const preferredSceneToken = pickTokenForShot(shot, sceneTokens, assetByToken) || sceneTokens[0];
    if (!hasText(shot.mainCharacterToken) && preferredCharacterToken) {
      patch.mainCharacterToken = preferredCharacterToken;
      if (!nextRefs.includes(preferredCharacterToken)) nextRefs.push(preferredCharacterToken);
    }
    if (!hasText(shot.mainSceneToken) && preferredSceneToken) {
      patch.mainSceneToken = preferredSceneToken;
      if (!nextRefs.includes(preferredSceneToken)) nextRefs.push(preferredSceneToken);
    }
    if (nextRefs.length !== refs.length || nextRefs.some((token, refIndex) => token !== refs[refIndex])) patch.assetRefs = nextRefs;
    if (Object.keys(patch).length) shotPatches.push({ shotId: shot.id || `S${index + 1}`, patch });
  });

  return {
    ok: !duplicates.length && !missingRefs.length && !lockedAssetIds.length && !enrichedAssetIds.length && !shotPatches.length,
    duplicateCount: duplicates.length,
    missingRefCount: missingRefs.length,
    lockedCount: lockedAssetIds.length,
    enrichedCount: enrichedAssetIds.length,
    shotPatchCount: shotPatches.length,
    duplicates,
    missingRefs,
    lockedAssetIds,
    enrichedAssetIds,
    shotPatches,
  };
}

export function applyAssetConsistencyPlan(episode = {}, plan = buildAssetConsistencyPlan(episode)) {
  const duplicateIds = new Set((plan.duplicates || []).map((item) => item.duplicateId).filter(Boolean));
  const shotPatchById = new Map((plan.shotPatches || []).map((item) => [item.shotId, item.patch || {}]));
  return {
    ...episode,
    assets: (Array.isArray(episode.assets) ? episode.assets : [])
      .filter((asset) => !duplicateIds.has(asset.id || normalizeToken(asset.token || asset.name)))
      .map((asset) => {
        const hasVisualLock = hasText(asset.visualLock || asset.visualAnchor || asset.prompt || asset.canonicalPrompt);
        const hasImage = hasText(asset.imageUrl || asset.imagePath || asset.image || asset.image?.url);
        if (!hasVisualLock && !hasImage) return asset;
        return {
          ...asset,
          lifecycle: "locked",
          locked: true,
          lockVersion: asset.lockVersion || buildAssetLockVersion(asset),
          continuityRule: asset.continuityRule || `${asset.token || asset.name || "资产"}在本集镜头中保持外观、服装、颜色和关键识别点一致。`,
        };
      }),
    shots: (Array.isArray(episode.shots) ? episode.shots : []).map((shot, index) => {
      const shotId = shot.id || `S${index + 1}`;
      const patch = shotPatchById.get(shotId);
      return patch ? { ...shot, ...patch } : shot;
    }),
  };
}

function normalizeToken(value = "") {
  return String(value || "").trim();
}

function hasText(value) {
  return String(value || "").trim().length > 0;
}

function assetToken(asset = {}) {
  return normalizeToken(asset.token || asset.assetToken || asset.name || asset.id);
}

function assetKind(asset = {}) {
  const raw = String(asset.type || asset.category || asset.kind || "").trim().toLowerCase();
  if (raw === "character" || raw === "role" || raw === "角色" || raw.includes("character") || raw.includes("主角")) return "character";
  if (raw === "scene" || raw === "location" || raw === "场景" || raw.includes("scene") || raw.includes("地点")) return "scene";
  if (raw === "prop" || raw === "item" || raw === "道具") return "prop";
  if (raw === "style" || raw === "风格") return "style";
  const token = String(asset.token || asset.name || "").trim();
  if (/^@?角色[_-]/.test(token)) return "character";
  if (/^@?场景[_-]/.test(token)) return "scene";
  return "";
}

function pickTokenForShot(shot = {}, tokens = [], assetByToken = new Map()) {
  const haystack = [
    shot.title,
    shot.summary,
    shot.description,
    shot.script,
    shot.content,
    shot.imagePrompt,
    shot.videoPrompt,
    shot.prompt?.image,
    shot.prompt?.video,
  ].filter(Boolean).join(" ");
  if (!haystack) return "";
  return tokens.find((token) => {
    const asset = assetByToken.get(token) || {};
    const name = String(asset.name || "").trim();
    const normalizedName = name.replace(/^@(角色|场景|道具|风格)[_-]/, "");
    return haystack.includes(token) || (name && haystack.includes(name)) || (normalizedName && haystack.includes(normalizedName));
  }) || "";
}

function buildAssetLockVersion(asset = {}) {
  const source = [
    asset.token,
    asset.name,
    asset.visualLock || asset.visualAnchor,
    asset.prompt || asset.canonicalPrompt,
    asset.imageUrl || asset.imagePath || asset.image,
  ].filter(Boolean).join("|");
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash) + source.charCodeAt(index);
    hash |= 0;
  }
  return `lock-${Math.abs(hash).toString(36)}`;
}
