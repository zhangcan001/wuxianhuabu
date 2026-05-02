export function buildShotContinuityPrompt(shot = {}, assetsInput = [], options = {}) {
  const basePrompt = String(options.basePrompt ?? shot.imagePrompt ?? shot.videoPrompt ?? "").trim();
  if (!basePrompt || options.enabled === false) return basePrompt;
  const assets = normalizeAssetCollection(assetsInput);
  const lookup = buildAssetLookup(assetsInput, assets);
  if (!assets.length && !lookup.size) return basePrompt;
  const tokens = collectShotTokens(shot);
  if (!tokens.length) return basePrompt;

  const lines = tokens
    .map((token) => formatAssetLine(token, lookup.get(token)))
    .filter(Boolean);
  if (!lines.length) return basePrompt;

  const referenceImages = tokens
    .map((token) => {
      const asset = lookup.get(token);
      const image = asset?.imageUrl || asset?.imagePath || asset?.image || asset?.images?.[0] || "";
      return image ? `${token}=${image}` : "";
    })
    .filter(Boolean)
    .slice(0, 4);
  const isVideo = options.kind === "video";
  const lockHint = isVideo
    ? "以上一帧/首帧为准，保持角色外观、场景空间、道具位置一致；只描述运动、表情和镜头变化。"
    : "保持角色脸型、服装、发型、色彩、场景空间和关键道具一致；只改变当前镜头动作、构图和光线。";
  return [
    basePrompt,
    "",
    `连续性锁定（${isVideo ? "视频" : "图片"}）：`,
    ...lines,
    referenceImages.length ? `参考图：${referenceImages.join("；")}` : "",
    `一致性约束：${lockHint}`,
  ].filter(Boolean).join("\n");
}

export function collectShotTokens(shot = {}) {
  return dedupe([
    shot.mainCharacterToken,
    shot.mainSceneToken,
    ...(Array.isArray(shot.keyPropTokens) ? shot.keyPropTokens : []),
    ...(Array.isArray(shot.assetRefs) ? shot.assetRefs : []),
  ].map(normalizeText).filter(Boolean));
}

function normalizeAssetCollection(input = []) {
  if (Array.isArray(input)) return input;
  if (Array.isArray(input.items)) return input.items;
  if (input instanceof Map) return Array.from(input.values());
  if (input?.byToken instanceof Map) return Array.from(input.byToken.values());
  return [];
}

function buildAssetLookup(input = [], assets = []) {
  const lookup = input?.byToken instanceof Map ? new Map(input.byToken) : new Map();
  assets.forEach((asset) => {
    const keys = [asset?.token, asset?.assetToken, asset?.id, asset?.name].map(normalizeText).filter(Boolean);
    keys.forEach((key) => {
      if (!lookup.has(key)) lookup.set(key, asset);
    });
  });
  return lookup;
}

function formatAssetLine(token = "", asset = null) {
  if (!asset) return `- ${token}：保持该资产身份一致。`;
  const name = normalizeText(asset.name || asset.token || token);
  const identity = firstText(asset.visualLock, asset.visualAnchor, asset.canonicalPrompt, asset.prompt, asset.description);
  const continuity = firstText(asset.continuityRule, asset.continuity, asset.lockRule);
  const parts = [
    `${token}${name && name !== token ? ` ${name}` : ""}`,
    identity ? `视觉锚点：${compact(identity)}` : "",
    continuity ? `连续性：${compact(continuity)}` : "",
  ].filter(Boolean);
  return parts.length ? `- ${parts.join("；")}` : "";
}

function firstText(...values) {
  return values.map(normalizeText).find(Boolean) || "";
}

function compact(value = "", maxLength = 180) {
  const text = normalizeText(value).replace(/\s+/g, " ");
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function dedupe(values = []) {
  const seen = new Set();
  return values.filter((value) => {
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function normalizeText(value = "") {
  return String(value || "").trim();
}
