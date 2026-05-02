const NODE_SIZES = {
  novelPipeline: [1080, 760],
  assetLibrary: [480, 560],
  shotList: [760, 640],
};

export function buildEpisodeCanvasProjection(episode = {}, options = {}) {
  const episodeId = episode.id || options.episodeId || "episode-1";
  const origin = options.origin || { x: 80, y: 80 };
  const gapX = Number(options.gapX || 140);
  const novelId = episode.sourceNodeIds?.novel?.[0] || `episode-${episodeId}-novel`;
  const assetId = episode.sourceNodeIds?.asset?.[0] || `episode-${episodeId}-assets`;
  const shotId = episode.sourceNodeIds?.shot?.[0] || `episode-${episodeId}-shots`;
  const nodes = [
    makeProjectionNode("novelPipeline", novelId, origin, {
      episodeId,
      displayName: `${episode.title || "当前集"} · 文本方案`,
      novel: episode.sourceText || "",
      pipeline: {
        script: episode.script || "",
        characterAssets: filterAssetsByType(episode.assets, "character"),
        sceneAssets: filterAssetsByType(episode.assets, "scene"),
        propAssets: filterAssetsByType(episode.assets, "prop"),
        shots: episode.shots || [],
        note: "业务模型投影",
        stage: episode.status?.textReady ? "ready" : "draft",
      },
    }),
    makeProjectionNode("assetLibrary", assetId, {
      x: origin.x + NODE_SIZES.novelPipeline[0] + gapX,
      y: origin.y,
    }, {
      episodeId,
      displayName: `${episode.title || "当前集"} · 资产库`,
      characters: filterAssetsByType(episode.assets, "character").map(assetToLegacyRecord),
      scenes: filterAssetsByType(episode.assets, "scene").map(assetToLegacyRecord),
      props: filterAssetsByType(episode.assets, "prop").map(assetToLegacyRecord),
    }),
    makeProjectionNode("shotList", shotId, {
      x: origin.x + NODE_SIZES.novelPipeline[0] + gapX + NODE_SIZES.assetLibrary[0] + gapX,
      y: origin.y,
    }, {
      episodeId,
      displayName: `${episode.title || "当前集"} · 镜头表`,
      shots: (episode.shots || []).map(shotToLegacyRecord),
    }),
  ];
  return {
    nodes,
    edges: [
      makeProjectionEdge(novelId, assetId),
      makeProjectionEdge(assetId, shotId),
    ],
  };
}

export function mergeCanvasProjection(existingNodes = [], existingEdges = [], projection = {}) {
  const nodeById = new Map((existingNodes || []).map((node) => [node.id, node]));
  const projectedIds = new Set((projection.nodes || []).map((node) => node.id));
  const nextNodes = [
    ...(existingNodes || []).map((node) => (
      projectedIds.has(node.id) ? mergeProjectedNode(node, nodeById.get(node.id), projection.nodes) : node
    )),
    ...(projection.nodes || []).filter((node) => !nodeById.has(node.id)),
  ];
  const edgeKeys = new Set((existingEdges || []).map((edge) => `${edge.source}->${edge.target}`));
  const nextEdges = [
    ...(existingEdges || []),
    ...(projection.edges || []).filter((edge) => {
      const key = `${edge.source}->${edge.target}`;
      if (edgeKeys.has(key)) return false;
      edgeKeys.add(key);
      return true;
    }),
  ];
  return { nodes: nextNodes, edges: nextEdges };
}

function mergeProjectedNode(existingNode, fallbackNode, projectedNodes) {
  const projected = projectedNodes.find((node) => node.id === existingNode.id) || fallbackNode;
  if (!projected) return existingNode;
  return {
    ...existingNode,
    type: projected.type,
    width: existingNode.width || projected.width,
    height: existingNode.height || projected.height,
    data: {
      ...(existingNode.data || {}),
      ...(projected.data || {}),
    },
  };
}

function makeProjectionNode(type, id, position, data = {}) {
  const [width, height] = NODE_SIZES[type] || [260, 200];
  return {
    id,
    type,
    x: position.x,
    y: position.y,
    width,
    height,
    selected: false,
    data,
  };
}

function makeProjectionEdge(source, target) {
  return {
    id: `edge-${source}-${target}`,
    source,
    target,
  };
}

function filterAssetsByType(assets = [], type = "") {
  return (Array.isArray(assets) ? assets : []).filter((asset) => asset.type === type);
}

function assetToLegacyRecord(asset = {}) {
  return {
    id: asset.id || asset.token || "",
    name: asset.name || asset.token || "",
    token: asset.token || "",
    prompt: asset.prompt || "",
    visualLock: asset.visualLock || "",
    imageUrl: asset.imageUrl || asset.image || "",
    imagePath: asset.imagePath || "",
    originalImageUrl: asset.originalImageUrl || "",
    imageThumbnailUrl: asset.imageThumbnailUrl || "",
    imageThumbnailPath: asset.imageThumbnailPath || "",
    mediaRefs: Array.isArray(asset.mediaRefs) ? asset.mediaRefs : [],
    imageItems: Array.isArray(asset.imageItems) ? asset.imageItems : [],
    rejectedImageItems: Array.isArray(asset.rejectedImageItems) ? asset.rejectedImageItems : [],
    discardedImageKeys: Array.isArray(asset.discardedImageKeys) ? asset.discardedImageKeys : [],
    images: Array.isArray(asset.images) ? asset.images : [],
  };
}

function shotToLegacyRecord(shot = {}) {
  const imageDisplayUrl = shot.imageUrl || shot.imageResultUrl || shot.imageResult || "";
  const videoDisplayUrl = shot.videoUrl || shot.videoResultUrl || shot.videoResult || "";
  return {
    id: shot.id || "",
    title: shot.title || shot.id || "",
    scene: shot.scene || "",
    action: shot.action || "",
    cameraMove: shot.cameraMove || "",
    duration: shot.duration || "",
    imagePrompt: shot.imagePrompt || "",
    videoPrompt: shot.videoPrompt || "",
    imageResultUrl: imageDisplayUrl,
    videoResultUrl: videoDisplayUrl,
    imageUrl: shot.imageUrl || "",
    imagePath: shot.imagePath || "",
    imageThumbnailUrl: shot.imageThumbnailUrl || "",
    imageThumbnailPath: shot.imageThumbnailPath || "",
    videoUrl: shot.videoUrl || "",
    videoPath: shot.videoPath || "",
    videoThumbnailUrl: shot.videoThumbnailUrl || "",
    videoThumbnailPath: shot.videoThumbnailPath || "",
    mediaRefs: Array.isArray(shot.mediaRefs) ? shot.mediaRefs : [],
    imageItems: Array.isArray(shot.imageItems) ? shot.imageItems : [],
    videoItems: Array.isArray(shot.videoItems) ? shot.videoItems : [],
    lastQueueResult: shot.lastQueueResult || "",
    imageProviderMode: shot.imageProviderMode || "",
    videoProviderMode: shot.videoProviderMode || "",
    imageRuntimeModel: shot.imageRuntimeModel || "",
    videoRuntimeModel: shot.videoRuntimeModel || "",
    videoModelPreset: shot.videoModelPreset || "",
    videoParamPreset: shot.videoParamPreset || "",
    videoAspectRatio: shot.videoAspectRatio || "",
    mainCharacterToken: shot.mainCharacterToken || "",
    mainSceneToken: shot.mainSceneToken || "",
    keyPropTokens: Array.isArray(shot.keyPropTokens) ? shot.keyPropTokens.filter(Boolean) : [],
    assetRefs: Array.isArray(shot.assetRefs) ? shot.assetRefs.filter(Boolean) : [],
    referenceResources: shot.referenceResources || "",
    reviewStatus: shot.reviewStatus || "未审",
    reviewComment: shot.reviewComment || "",
    reviewReason: shot.reviewReason || "",
    reviewer: shot.reviewer || "",
    reviewedAt: shot.reviewedAt || "",
    resultDecision: shot.resultDecision || "",
    resultDecisionAt: Number(shot.resultDecisionAt) || 0,
    reworkReason: shot.reworkReason || "",
    status: shot.status || "待写",
  };
}
