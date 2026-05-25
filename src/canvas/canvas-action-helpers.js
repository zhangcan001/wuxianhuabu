function buildTimelineApprovalFromShot(shot) {
  if (shot?.resultDecision === "complete" || shot?.resultDecision === "confirm") return "已通过";
  if (shot?.resultDecision === "rework" || shot?.status === "待修改") return "退回修改";
  if (shot?.videoResultUrl || shot?.imageResultUrl || shot?.lastQueueResult) return "待验收";
  return "待验收";
}

export function findNearestNodeInEpisode({ sourceId, nodeById, nodes, targetTypes, activeEpisodeId }) {
  const source = nodeById.get(sourceId);
  if (!source) return null;
  const types = Array.isArray(targetTypes) ? targetTypes : [targetTypes];
  const episodeId = source.data?.episodeId || activeEpisodeId;
  const sourceCenterX = source.x + source.width / 2;
  const sourceCenterY = source.y + source.height / 2;
  const candidates = nodes.filter((node) => (
    node.id !== sourceId
    && types.includes(node.type)
    && ((node.data?.episodeId || activeEpisodeId) === episodeId)
  ));
  if (!candidates.length) return null;
  return candidates
    .map((node) => ({
      node,
      distance: Math.hypot((node.x + node.width / 2) - sourceCenterX, (node.y + node.height / 2) - sourceCenterY),
    }))
    .sort((a, b) => a.distance - b.distance)[0]?.node || null;
}

export function buildTimelineSourceFromShotRecord({
  sourceNodeId,
  shot,
  sourceNode,
  activeEpisodeId,
  nodes,
  resourceIndex,
  pickTimelineResultUrl,
  expandResourceReferences,
}) {
  const episodeId = sourceNode?.data?.episodeId || activeEpisodeId;
  const mediaUrl = shot.videoUrl
    || shot.videoResultUrl
    || shot.imageUrl
    || shot.imageResultUrl
    || pickTimelineResultUrl(nodes, sourceNodeId, shot.id)
    || "";
  const mediaPath = shot.videoPath
    || shot.imagePath
    || (isLocalFilePath(shot.lastQueueResult) ? shot.lastQueueResult : "")
    || "";
  const mediaTypeProbe = mediaPath || mediaUrl;
  const bindingSummary = [
    shot.mainCharacterToken ? `主角色：${shot.mainCharacterToken}` : "",
    shot.mainSceneToken ? `主场景：${shot.mainSceneToken}` : "",
    Array.isArray(shot.keyPropTokens) && shot.keyPropTokens.length ? `关键道具：${shot.keyPropTokens.join("、")}` : "",
  ].filter(Boolean).join(" · ");
  return {
    episodeId,
    shotId: shot.id,
    sourceNodeId,
    title: shot.id,
    scene: shot.scene || "",
    duration: shot.duration || "4秒",
    transition: "直切",
    mediaUrl,
    mediaPath,
    mediaType: /\.(mp4|webm|mov)$/i.test(mediaTypeProbe || "") ? "video" : "image",
    approvalStatus: buildTimelineApprovalFromShot(shot),
    approvalNote: shot.reworkReason || "",
    note: [
      bindingSummary,
      shot.referenceResources ? expandResourceReferences(shot.referenceResources, resourceIndex) : "",
    ].filter(Boolean).join("\n"),
    mainCharacterToken: shot.mainCharacterToken || "",
    mainSceneToken: shot.mainSceneToken || "",
    keyPropTokens: Array.isArray(shot.keyPropTokens) ? shot.keyPropTokens.filter(Boolean) : [],
    assetRefs: Array.isArray(shot.assetRefs) ? shot.assetRefs.filter(Boolean) : [],
  };
}

export function appendDraftShotsToList({ currentShots, draftShots, normalizeShotRecord }) {
  const used = new Set(currentShots.map((shot, index) => normalizeShotRecord(shot, index).id));
  let cursor = currentShots.length + 1;
  const appended = draftShots.map((shot, index) => {
    let id = shot.id;
    while (!id || used.has(id)) {
      id = `S${String(cursor).padStart(2, "0")}`;
      cursor += 1;
    }
    used.add(id);
    return normalizeShotRecord({ ...shot, id }, currentShots.length + index);
  });
  return {
    appended,
    shots: [...currentShots, ...appended],
  };
}

export function applyResultToShotList({ currentShots, resultNodeData, normalizeShotRecord }) {
  const noteText = `${resultNodeData.note || ""} ${resultNodeData.displayName || ""}`;
  const matchedShotId = String(resultNodeData.targetShotId || "").trim() || noteText.match(/S\d{2,}/)?.[0] || "";
  const isVideo = Boolean(resultNodeData.videoPath || resultNodeData.videoUrl);
  const imageResultUrl = resultNodeData.imageUrl || resultNodeData.imagePath || "";
  const videoResultUrl = resultNodeData.videoUrl || resultNodeData.videoPath || "";
  const resultPath = resultNodeData.videoPath || resultNodeData.imagePath || videoResultUrl || imageResultUrl || "";
  const preferredStatus = isVideo
    ? ["待生视频", "待修改", "已生成"]
    : ["待生图", "待修改", "待生视频", "已生成"];
  let patchedShotId = "";
  let patchedShot = null;
  const shots = currentShots.map((shot, index) => {
    const normalized = normalizeShotRecord(shot, index);
    const shouldPatch = patchedShotId
      ? false
      : matchedShotId
        ? normalized.id === matchedShotId
        : preferredStatus.includes(normalized.status || "待写");
    if (!shouldPatch) return shot;
    patchedShotId = normalized.id;
    patchedShot = {
      ...normalized,
      imagePrompt: !isVideo && !normalized.imagePrompt ? String(resultNodeData.sourcePrompt || "") : normalized.imagePrompt,
      videoPrompt: isVideo && !normalized.videoPrompt ? String(resultNodeData.sourcePrompt || "") : normalized.videoPrompt,
      imageResultUrl: imageResultUrl || normalized.imageResultUrl || "",
      videoResultUrl: videoResultUrl || normalized.videoResultUrl || "",
      imageUrl: imageResultUrl || normalized.imageUrl || "",
      videoUrl: videoResultUrl || normalized.videoUrl || "",
      imagePath: resultNodeData.imagePath || normalized.imagePath || "",
      videoPath: resultNodeData.videoPath || normalized.videoPath || "",
      imageThumbnailUrl: resultNodeData.imageThumbnailUrl || resultNodeData.thumbnailUrl || normalized.imageThumbnailUrl || "",
      imageThumbnailPath: resultNodeData.imageThumbnailPath || resultNodeData.thumbnailPath || normalized.imageThumbnailPath || "",
      lastQueueResult: resultPath || normalized.lastQueueResult || "",
      status: isVideo
        ? "已生成"
        : (String(normalized.videoPrompt || "").trim() ? "待生视频" : "已生成"),
      resultDecision: "",
      resultDecisionAt: 0,
      reworkReason: "",
    };
    return patchedShot;
  });
  return {
    patchedShotId,
    patchedShot,
    shots,
  };
}

function isLocalFilePath(value = "") {
  return /^[a-zA-Z]:[\\/]/.test(String(value || "")) || String(value || "").startsWith("\\\\") || String(value || "").startsWith("/");
}

function normalizeAssetPromptVariants(value) {
  return {
    nanoBanana: String(value?.nanoBanana || value?.gemini || value?.nanoBananaPrompt || "").trim(),
    openSource: String(value?.openSource || value?.openSourcePrompt || "").trim(),
    midjourney: String(value?.midjourney || value?.midjourneyPrompt || value?.mj || "").trim(),
  };
}

function pickAssetPromptVariant(asset, mode = "image") {
  const variants = normalizeAssetPromptVariants(asset?.promptVariants || asset?.cineForge || {});
  if (mode === "image-comfy") return variants.openSource || variants.nanoBanana || variants.midjourney || asset?.prompt || "";
  if (mode === "image-gemini" || mode === "image-api") return variants.nanoBanana || variants.openSource || variants.midjourney || asset?.prompt || "";
  if (mode === "image-mj") return variants.midjourney || variants.nanoBanana || variants.openSource || asset?.prompt || "";
  return variants.nanoBanana || variants.openSource || variants.midjourney || asset?.prompt || "";
}

export function buildAssetPromptPayload(asset, mode = "image", options = {}) {
  const selectedPrompt = pickAssetPromptVariant(asset, mode);
  const coreReference = [
    asset.token || "",
    selectedPrompt || "",
    asset.visualLock ? `视觉锁定：${asset.visualLock}` : "",
    asset.continuityRule ? `连续性规则：${asset.continuityRule}` : "",
    Array.isArray(asset.evidenceSource) && asset.evidenceSource.length ? `证据来源：${asset.evidenceSource.join("；")}` : "",
    asset.referenceResources ? `参考资源：${asset.referenceResources}` : "",
  ].filter(Boolean).join("\n");
  if (mode === "image" || mode === "image-api" || mode === "image-comfy" || mode === "image-gemini" || mode === "image-mj") {
    const providerMode = mode === "image-comfy" ? "comfy" : mode === "image-api" || mode === "image-mj" ? "api" : "inherit";
    const displayMode = mode === "image-comfy"
      ? "开源模型 / ComfyUI"
      : mode === "image-gemini"
        ? "Gemini 网页生图"
        : mode === "image-mj"
          ? "Midjourney / 英文图像提示"
          : "API / 中文图像提示";
    return {
      label: `${asset.name || "资产"}-${displayMode}`,
      nodeType: mode === "image-gemini" ? "geminiWeb" : "imageEdit",
      patch: (() => {
        const prompt = [
          asset.token || "",
          selectedPrompt || "",
          asset.visualLock ? `稳定锚点：${asset.visualLock}` : "",
          asset.continuityRule ? `连续性：${asset.continuityRule}` : "",
          Array.isArray(asset.evidenceSource) && asset.evidenceSource.length ? `证据来源：${asset.evidenceSource.join("；")}` : "",
          asset.referenceResources ? `参考资源：${asset.referenceResources}` : "",
          "请严格沿用以上资产设定生成，不要擅自改脸、改服装、改材质或改空间结构。",
        ].filter(Boolean).join("\n");
        return {
          prompt,
          assetPromptSeed: prompt,
          providerMode,
          autoStart: Boolean(options.autoStart),
          sourceAssetToken: asset.token || "",
          sourceAssetName: asset.name || "",
          sourceAssetVariant: mode === "image-comfy" ? "openSource" : mode === "image-mj" ? "midjourney" : "nanoBanana",
        };
      })(),
    };
  }
  return {
    label: `${asset.name || "资产"}-视频提示词`,
    nodeType: "text",
    patch: {
      text: [
        `# ${asset.name || "资产"} 视频提示词`,
        "",
        coreReference,
        "",
        "建议补充：动作过程、运镜、时长、结束状态。",
      ].join("\n"),
      width: 380,
      height: 300,
    },
  };
}

export function buildPipelineSyncPayloads(pipeline) {
  const assetPatch = {
    characters: pipeline?.characterAssets || [],
    scenes: pipeline?.sceneAssets || [],
    props: pipeline?.propAssets || [],
    displayName: "资产库",
  };
  const shotPatch = {
    shots: pipeline?.shots || [],
    displayName: "镜头表",
  };
  return {
    assetPatch,
    hasAssets: assetPatch.characters.length || assetPatch.scenes.length || assetPatch.props.length,
    shotPatch,
    hasShots: shotPatch.shots.length,
  };
}
