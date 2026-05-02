export async function runTimelineImportHealthFix({
  finding = {},
  getEpisodeNodesForHealthFix = () => [],
  buildTimelineSourceFromShotRecord,
  normalizeShotRecord = (shot) => shot,
  importShotsToTimelineByEpisode = () => false,
  waitForHealthRepairCommit = async () => {},
  reconcileHealthRepair = async () => {},
  setShowTimeline = () => {},
  setProjectMessage = () => {},
  activeEpisodeId = "",
  nodes = [],
  resources = [],
  episodes = [],
  nodeTypeLabel,
  buildProjectResourceIndex,
  pickTimelineResultUrl,
  expandResourceReferences,
} = {}) {
  const episodeId = finding.episodeId || activeEpisodeId;
  const episodeNodes = getEpisodeNodesForHealthFix(episodeId);
  const resourceIndex = buildProjectResourceIndex(resources, nodes, episodes, episodeId, { nodeTypeLabel });
  const shots = episodeNodes
    .filter((node) => node.type === "shotList")
    .flatMap((node) => (node.data?.shots || []).map((shot, index) => ({
      ...buildTimelineSourceFromShotRecord({
        sourceNodeId: node.id,
        shot: normalizeShotRecord(shot, index),
        sourceNode: node,
        activeEpisodeId: episodeId,
        nodes,
        resourceIndex,
        pickTimelineResultUrl,
        expandResourceReferences,
      }),
      sourceNodeId: node.id,
    })));
  if (!shots.length) throw new Error("当前集没有可导入时间线的镜头。");
  importShotsToTimelineByEpisode(episodeId, shots, { silent: true });
  await waitForHealthRepairCommit();
  setShowTimeline(true);
  await reconcileHealthRepair(finding);
  setProjectMessage(`已自动导入时间线并通过复检：${finding.text}`);
  return { episodeId, imported: shots.length, shots };
}

export async function runShotBindingPatchHealthFix({
  finding = {},
  fix = finding?.fix || {},
  getNodeById = () => null,
  normalizeShotRecord = (shot) => shot,
  collectGlobalAssets = () => ({}),
  suggestShotAssetBindingPatch = () => ({}),
  patchShotRecord = () => false,
  waitForHealthRepairCommit = async () => {},
  reconcileHealthRepair = async () => {},
  setProjectMessage = () => {},
  nodes = [],
} = {}) {
  const sourceNode = fix.sourceNodeId ? getNodeById(fix.sourceNodeId) : null;
  const shot = (sourceNode?.data?.shots || [])
    .map((item, index) => normalizeShotRecord(item, index))
    .find((item) => item.id === fix.shotId);
  if (!shot) throw new Error("没有找到需要补绑定的镜头。");
  const assetIndexForFix = collectGlobalAssets(nodes);
  const patch = suggestShotAssetBindingPatch(shot, assetIndexForFix);
  if (!patch.mainCharacterToken && !patch.mainSceneToken && !(patch.keyPropTokens || []).length && !(patch.assetRefs || []).length) {
    throw new Error("当前镜头没有可自动推断的绑定资产。");
  }
  patchShotRecord(fix.sourceNodeId, fix.shotId, patch);
  await waitForHealthRepairCommit();
  await reconcileHealthRepair(finding);
  setProjectMessage(`已自动补齐并通过复检：${finding.text}`);
  return { shotId: fix.shotId, patch };
}
