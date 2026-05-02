import {
  buildShotContinuityPrompt,
} from "./shot-continuity-prompt.js";

export function buildAssetImageJobs(assetNodeId, assetPatch = {}, options = {}) {
  const {
    providerMode = "mock",
    normalizeAsset = defaultNormalizeAsset,
    buildAssetPromptPayload = defaultBuildAssetPromptPayload,
  } = options;
  const promptMode = providerMode === "comfy" ? "image-comfy" : "image-api";
  const groups = [
    ["characters", "角色"],
    ["scenes", "场景"],
    ["props", "道具"],
  ];
  return groups.flatMap(([key, category]) => (
    (Array.isArray(assetPatch[key]) ? assetPatch[key] : [])
      .map((asset) => normalizeAsset(asset, category, assetNodeId))
      .filter((asset) => !String(asset.imageUrl || asset.imagePath || "").trim())
      .map((asset, index) => {
        const payload = buildAssetPromptPayload(asset, promptMode, { autoStart: false });
        const prompt = String(payload?.patch?.prompt || asset.prompt || asset.visualLock || asset.name || "").trim();
        return {
          sourceNodeId: assetNodeId,
          sourceAssetToken: asset.token || "",
          sourceAssetName: asset.name || "",
          assetCategory: category,
          title: `${asset.name || asset.token || `${category}${index + 1}`}-资产图`,
          kind: "image",
          prompt,
          imageProviderMode: providerMode,
          providerMode: providerMode === "custom" ? "api" : providerMode,
          queueStage: "asset",
          priority: "高",
          offsetX: 1080,
          offsetY: index * 290,
        };
      })
      .filter((job) => String(job.prompt || "").trim())
  ));
}

export function buildShotImageJobs(shotNodeId, shots = [], options = {}) {
  const {
    buildImageShotPrompt = (shot) => shot.imagePrompt || "",
    resolveShotImageProviderMode = () => options.providerMode || "mock",
    settings = {},
    assets = [],
    continuityPrompt = true,
  } = options;
  return (Array.isArray(shots) ? shots : [])
    .map((shot, index) => {
      const basePrompt = buildImageShotPrompt(shot);
      return {
        sourceNodeId: shotNodeId,
        shotId: shot.id,
        title: `${shot.id || `镜头${index + 1}`}-图片`,
        kind: "image",
        prompt: buildShotContinuityPrompt(shot, assets, {
          basePrompt,
          kind: "image",
          enabled: continuityPrompt !== false,
        }),
        imageProviderMode: resolveShotImageProviderMode(shot, settings),
        imageRuntimeModel: shot.imageRuntimeModel || "",
        mainCharacterToken: shot.mainCharacterToken || "",
        mainSceneToken: shot.mainSceneToken || "",
        keyPropTokens: Array.isArray(shot.keyPropTokens) ? shot.keyPropTokens.filter(Boolean) : [],
        assetRefs: Array.isArray(shot.assetRefs) ? shot.assetRefs.filter(Boolean) : [],
        referenceResources: String(shot.referenceResources || ""),
        videoPrompt: String(shot.videoPrompt || ""),
        autoCascadeVideo: Boolean(String(shot.videoPrompt || "").trim()),
        offsetX: 1180,
        offsetY: index * 290,
      };
    })
    .filter((job) => job.imageProviderMode !== "upload")
    .filter((job) => String(job.prompt || "").trim());
}

function defaultNormalizeAsset(asset = {}, category = "", sourceNodeId = "") {
  return {
    ...asset,
    category,
    sourceNodeId,
  };
}

function defaultBuildAssetPromptPayload(asset = {}) {
  return {
    patch: {
      prompt: asset.prompt || asset.visualLock || asset.name || "",
    },
  };
}
