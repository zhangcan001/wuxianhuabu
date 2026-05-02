export function checkTextTaskPreflight(input = {}) {
  const text = String(input.sourceText || "").trim();
  if (!text) return block("请先粘贴小说或剧情梗概。");
  const settings = input.textApiSettings || {};
  if (isLocalTextMode(settings)) return ok("本地文本模板可用。");
  const apiBaseUrl = String(settings.apiUrl || settings.apiBaseUrl || "").trim();
  const hasKey = Boolean(String(settings.apiKey || "").trim() || settings.apiKeySaved);
  if (!apiBaseUrl) return block("文本 API 未配置 Base URL，已停止文字任务。");
  if (!hasKey) return block("文本 API Key 未配置，已停止文字任务。");
  return ok("文本 API 配置可检查连接。");
}

export function checkImageTaskPreflight(project = {}, input = {}) {
  const episode = input.episode || project.activeEpisode || {};
  const shots = Array.isArray(episode.shots) ? episode.shots : [];
  const assets = Array.isArray(episode.assets) ? episode.assets : [];
  if (!String(episode.script || episode.sourceText || "").trim() && !shots.length) return block("文字任务尚未完成：请先生成剧本、资产和镜头表。");
  if (!assets.length) return block("文字任务尚未完成：资产列表为空，不能开始图片任务。");
  if (!shots.length) return block("文字任务尚未完成：镜头表为空，不能开始图片任务。");
  const targetShots = input.shot ? [input.shot] : shots;
  const missingPrompt = targetShots.filter((shot) => !String(shot.imagePrompt || shot.prompt?.image || "").trim());
  if (missingPrompt.length) return block(`图片任务缺少镜头图片提示词：${missingPrompt.slice(0, 4).map((shot) => shot.id || "未编号").join("、")}`);
  if (input.asset) {
    const assetPrompt = String(input.asset.prompt || input.asset.visualLock || input.asset.description || input.asset.name || "").trim();
    if (!assetPrompt) return block("资产图片任务缺少资产提示词或视觉锁定。");
  } else {
    const consistency = checkAssetConsistencyGate(project, { ...input, episode, shots: targetShots });
    if (!consistency.ok) return consistency;
  }
  return ok("图片任务前置内容已完成。");
}

export function checkVideoTaskPreflight(project = {}, input = {}) {
  const episode = input.episode || project.activeEpisode || {};
  const shots = Array.isArray(episode.shots) ? episode.shots : [];
  if (!shots.length) return block("镜头表为空，不能开始视频任务。");
  const targetShots = input.shot ? [input.shot] : shots;
  const missingPrompt = targetShots.filter((shot) => !String(shot.videoPrompt || shot.prompt?.video || "").trim());
  if (missingPrompt.length) return block(`视频任务缺少镜头视频提示词：${missingPrompt.slice(0, 4).map((shot) => shot.id || "未编号").join("、")}`);
  const missingImage = targetShots.filter((shot) => !String(shot.imageUrl || shot.imagePath || shot.imageResultUrl || shot.imageResult || "").trim());
  if (missingImage.length) return block(`视频任务缺少前置图片素材：${missingImage.slice(0, 4).map((shot) => shot.id || "未编号").join("、")}`);
  const consistency = checkAssetConsistencyGate(project, { ...input, episode, shots: targetShots });
  if (!consistency.ok) return consistency;
  return ok("视频任务前置图片和提示词已完成。");
}

export function checkAssetConsistencyGate(project = {}, input = {}) {
  const episode = input.episode || project.activeEpisode || {};
  if (input.strictAssetConsistency === false || episode.consistencyLockEnabled === false || project.consistencyLockEnabled === false) {
    return ok("资产一致性检查已跳过。");
  }
  const assets = Array.isArray(episode.assets) ? episode.assets : [];
  const shots = Array.isArray(input.shots) ? input.shots : input.shot ? [input.shot] : Array.isArray(episode.shots) ? episode.shots : [];
  const assetByToken = new Map();
  assets.forEach((asset) => {
    const token = assetToken(asset);
    if (token && !assetByToken.has(token)) assetByToken.set(token, asset);
  });
  const characterTokens = assets.filter((asset) => assetKind(asset) === "character").map(assetToken).filter(Boolean);
  const sceneTokens = assets.filter((asset) => assetKind(asset) === "scene").map(assetToken).filter(Boolean);
  if (!characterTokens.length) return block("资产一致性未就绪：缺少角色资产，请先生成文本方案或执行“锁定资产”。");
  if (!sceneTokens.length) return block("资产一致性未就绪：缺少场景资产，请先生成文本方案或执行“锁定资产”。");

  const missingBinding = shots.filter((shot) => !String(shot.mainCharacterToken || "").trim() || !String(shot.mainSceneToken || "").trim());
  if (missingBinding.length) {
    return block(`资产一致性未就绪：镜头未绑定主角色/主场景：${formatShotList(missingBinding)}。请先执行“锁定资产”。`);
  }

  const unknownRefs = [];
  const weakAssets = new Map();
  shots.forEach((shot) => {
    collectShotAssetTokens(shot).forEach((token) => {
      const asset = assetByToken.get(token);
      if (!asset) {
        unknownRefs.push({ shotId: shot.id || "未编号", token });
        return;
      }
      if (!assetHasStableIdentity(asset)) weakAssets.set(token, asset);
    });
  });
  if (unknownRefs.length) {
    const refs = unknownRefs.slice(0, 4).map((item) => `${item.shotId}:${item.token}`).join("、");
    return block(`资产一致性未就绪：镜头引用了不存在的资产：${refs}。请先执行“锁定资产”。`);
  }
  if (weakAssets.size) {
    const names = Array.from(weakAssets.values()).slice(0, 4).map((asset) => asset.name || asset.token || asset.id || "未命名").join("、");
    return block(`资产一致性未就绪：资产缺少视觉锁定/提示词/参考图：${names}。请先补齐资产或执行“锁定资产”。`);
  }
  return ok("资产一致性已通过。");
}

export function checkMediaProviderConfig(settings = {}, input = {}) {
  const kind = input.kind === "video" ? "video" : "image";
  const mode = normalizeProviderMode(input.providerMode);
  if (mode === "upload" || mode === "mock" || mode === "inherit") return ok("本地或上传模式不需要远程连接检查。");
  if (mode === "comfy") {
    const baseUrl = String(settings.comfyBaseUrl || settings.comfyUrl || "").trim();
    if (!baseUrl) return block("ComfyUI 地址未配置，已停止任务。");
    if (!/^https?:\/\//i.test(baseUrl)) return block("ComfyUI 地址格式不正确，已停止任务。");
    return ok("ComfyUI 配置可检查连接。");
  }
  const apiUrl = String(settings.customApiUrl || "").trim();
  const hasKey = Boolean(String(settings.customApiKey || "").trim() || settings.customApiKeySaved || settings.imageApiKey || settings.videoApiKey);
  if (!apiUrl) return block(`${kind === "video" ? "视频" : "图片"} API 地址未配置，已停止任务。`);
  if (!/^https?:\/\//i.test(apiUrl)) return block(`${kind === "video" ? "视频" : "图片"} API 地址格式不正确，已停止任务。`);
  if (!hasKey) return block(`${kind === "video" ? "视频" : "图片"} API Key 未配置，已停止任务。`);
  return ok(`${kind === "video" ? "视频" : "图片"} API 配置可检查连接。`);
}

export function isLocalTextMode(settings = {}) {
  return (settings.factoryMode || "local") !== "api";
}

function normalizeProviderMode(value = "") {
  const mode = String(value || "").trim().toLowerCase();
  if (mode === "api" || mode === "custom") return "custom";
  if (mode === "comfy" || mode === "comfyui") return "comfy";
  if (mode === "upload" || mode === "manual" || mode === "local-upload") return "upload";
  if (mode === "mock" || mode === "local") return "mock";
  return mode || "inherit";
}

function ok(message) {
  return { ok: true, message };
}

function block(message) {
  return { ok: false, message };
}

function formatShotList(shots = []) {
  return shots.slice(0, 4).map((shot) => shot.id || shot.title || "未编号").join("、");
}

function collectShotAssetTokens(shot = {}) {
  return [
    shot.mainCharacterToken,
    shot.mainSceneToken,
    ...(Array.isArray(shot.assetRefs) ? shot.assetRefs : []),
  ].map(normalizeToken).filter(Boolean);
}

function assetHasStableIdentity(asset = {}) {
  return Boolean(String(asset.visualLock || asset.visualAnchor || asset.prompt || asset.canonicalPrompt || asset.description || asset.imageUrl || asset.imagePath || asset.image || asset.image?.url || "").trim());
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

function normalizeToken(value = "") {
  return String(value || "").trim();
}
