export function buildOutputNodePlacement(sourceNode, viewportCenter, offsets = {}) {
  const offsetX = offsets.offsetX || 0;
  const offsetY = offsets.offsetY || 0;
  if (!sourceNode) return viewportCenter;
  return {
    x: sourceNode.x + sourceNode.width + 130 + offsetX,
    y: sourceNode.y + 20 + offsetY,
  };
}

export function appendLinkedEdge(edges, sourceId, targetId, now = () => Date.now()) {
  if (!sourceId || !targetId || sourceId === targetId) return edges;
  if (edges.some((edge) => edge.source === sourceId && edge.target === targetId)) return edges;
  return [...edges, { id: `edge-${sourceId}-${targetId}-${now()}`, source: sourceId, target: targetId }];
}

export function buildCreateOutputPayload(sourceNode, viewportCenter, activeEpisodeId, type, label, data = {}) {
  const { __offsetX = 0, __offsetY = 0, ...nodeData } = data;
  return {
    position: buildOutputNodePlacement(sourceNode, viewportCenter, { offsetX: __offsetX, offsetY: __offsetY }),
    payload: {
      displayName: label,
      ...nodeData,
      episodeId: sourceNode?.data?.episodeId || activeEpisodeId,
    },
    type,
  };
}

export function linkedNodeLabel(targetType) {
  if (targetType === "upload") return "上传图片";
  if (targetType === "vr360") return "VR360 全景场景";
  return "联动节点";
}

export function planShotListAppend(target, draftShots) {
  const normalizedDrafts = Array.isArray(draftShots) ? draftShots.filter(Boolean) : [];
  if (!normalizedDrafts.length) return null;
  return {
    target,
    normalizedDrafts,
    currentShots: Array.isArray(target?.data?.shots) ? target.data.shots : [],
  };
}

export function planPipelineNodeSync(target, type, patch, label) {
  if (!patch) return null;
  if (target) {
    return {
      mode: "updated",
      targetId: target.id,
      targetType: type,
      patch,
      message: `${label}已同步`,
    };
  }
  return {
    mode: "created",
    targetId: "",
    targetType: type,
    patch,
    message: `已创建${label}`,
  };
}

export function buildPipelineSyncPlan({ assetTarget, assetPatch, hasAssets, shotTarget, shotPatch, hasShots }) {
  return {
    asset: hasAssets ? planPipelineNodeSync(assetTarget, "assetLibrary", assetPatch, "资产库") : null,
    shot: hasShots ? planPipelineNodeSync(shotTarget, "shotList", shotPatch, "镜头表") : null,
  };
}

export function buildLinkedTimelineShots(options) {
  const {
    shots,
    shotNodeId,
    sourceEpisodeId,
    nodes,
    resources,
    episodes,
    normalizeShotRecord,
    buildTimelineSourceFromShotRecord,
    buildProjectResourceIndex,
    pickTimelineResultUrl,
    expandResourceReferences,
  } = options;
  const resourceIndex = buildProjectResourceIndex(resources || [], nodes || [], episodes || [], sourceEpisodeId);
  return (shots || []).map((shot, index) => ({
    ...buildTimelineSourceFromShotRecord({
      sourceNodeId: shotNodeId,
      shot: normalizeShotRecord(shot, index),
      sourceNode: { data: { episodeId: sourceEpisodeId } },
      activeEpisodeId: sourceEpisodeId,
      nodes: nodes || [],
      resourceIndex,
      pickTimelineResultUrl,
      expandResourceReferences,
    }),
    sourceNodeId: shotNodeId,
  }));
}

export function buildNodeSyncOutcome(mode, targetId, extra = {}) {
  return {
    mode,
    targetId,
    ...extra,
  };
}

export function buildResultShotActionLabel(action) {
  if (action === "confirm") return "已采用并确认";
  if (action === "complete") return "已采用并完成";
  if (action === "rework") return "已标记待重做";
  return "已更新";
}

export function findResultNodeForShot(nodes, shotId, episodeId) {
  if (!shotId) return null;
  const normalizedShotId = String(shotId || "").trim().toUpperCase();
  return (nodes || [])
    .filter((node) => (
      node.type === "result"
      && (node.data?.episodeId || episodeId) === episodeId
      && (
        String(node.data?.targetShotId || "").trim().toUpperCase() === normalizedShotId
        || String(node.data?.note || "").includes(shotId)
      )
    ))
    .sort((a, b) => (Number(b.data?.adoptionUpdatedAt) || 0) - (Number(a.data?.adoptionUpdatedAt) || 0) || b.y - a.y)[0] || null;
}

export function buildManyOutputPlans({ sourceNode, outputs, activeEpisodeId, nextNodeId, createNode, now = () => Date.now() }) {
  if (!sourceNode || !Array.isArray(outputs) || !outputs.length) {
    return { createdNodes: [], createdEdges: [], nextNodeId, ids: [] };
  }
  let currentNodeId = nextNodeId;
  const createdNodes = [];
  const createdEdges = [];
  outputs.forEach((output, index) => {
    const id = `node-${currentNodeId++}`;
    const col = index % 3;
    const row = Math.floor(index / 3);
    createdNodes.push(
      createNode("result", id, {
        x: sourceNode.x + sourceNode.width + 130 + col * 310,
        y: sourceNode.y + row * 330,
      }, { ...output, episodeId: sourceNode.data?.episodeId || activeEpisodeId }),
    );
    createdEdges.push({ id: `edge-${sourceNode.id}-${id}-${now()}-${index}`, source: sourceNode.id, target: id });
  });
  return {
    createdNodes,
    createdEdges,
    nextNodeId: currentNodeId,
    ids: createdNodes.map((node) => node.id),
  };
}
