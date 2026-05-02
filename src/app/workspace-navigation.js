export const PRODUCTION_STUDIO_VIEW_BY_NODE_TYPE = {
  novelPipeline: "script",
  assetLibrary: "assets",
  shotList: "shots",
};

export const PRODUCTION_STUDIO_VIEW_BY_ACTION = {
  prompt: "shots",
  review: "review",
  timeline: "timeline",
  export: "delivery",
  resources: "assets",
};

export const WORKFLOW_ACTION_STUDIO_TARGETS = {
  review: { view: "review", message: "已打开生产工作台审片。" },
  prompt: { view: "shots", message: "已打开生产工作台镜头表。" },
  timeline: { view: "timeline", message: "已打开生产工作台时间线。" },
  export: { view: "delivery", message: "已打开生产工作台交付。" },
  resources: { view: "assets", message: "已打开生产工作台资产库。" },
};

export const MAIN_CHAIN_AUXILIARY_PANEL_SETTERS = [
  "setShowDashboard",
  "setShowHealth",
  "setShowGlobalAssets",
  "setShowResources",
  "setShowSearch",
  "setShowDebugTracePanel",
  "setShowPromptFactory",
  "setShowTemplateCenter",
  "setShowStylePresetCenter",
  "setShowModelParamCenter",
  "setShowExportPresetCenter",
  "setShowDirectorAssistant",
  "setShowReviewCenter",
  "setShowCollaborationCenter",
  "setShowProductionHub",
  "setShowArchiveCenter",
  "setShowTimeline",
  "setShowQueue",
];

export function resolveProductionStudioTargetView({ node = null, actionKey = "" } = {}) {
  return PRODUCTION_STUDIO_VIEW_BY_NODE_TYPE[node?.type]
    || PRODUCTION_STUDIO_VIEW_BY_ACTION[actionKey]
    || "";
}

export function openAdvancedCanvasNavigation({
  commercialProject = null,
  nodes = [],
  nodesRef = null,
  edges = [],
  viewportCenter = { x: 0, y: 0 },
  mergeAdvancedCanvasProjection,
  setNodes,
  setEdges,
  setShowCompatibilityCanvas,
  setShowProjectStudio,
  setProjectMessage,
} = {}) {
  const episode = commercialProject?.activeEpisode;
  if (episode?.id && typeof mergeAdvancedCanvasProjection === "function") {
    const merged = mergeAdvancedCanvasProjection({
      episode,
      nodes: nodesRef?.current || nodes,
      edges,
      origin: { x: Number(viewportCenter?.x || 0) - 760, y: Number(viewportCenter?.y || 0) - 280 },
    });
    setNodes?.(merged.nodes);
    setEdges?.(merged.edges);
  }
  setShowCompatibilityCanvas?.(true);
  setShowProjectStudio?.(false);
  setProjectMessage?.("已打开兼容画布。这里用于查看和迁移旧节点，主生产数据仍以生产工作台为准。");
}

export function openProductionStudioNavigation({
  projectStoreStateRef = null,
  syncLegacyCanvasFromBusinessProject,
  setShowCompatibilityCanvas,
  setShowProjectStudio,
  setProjectMessage,
  message = "已返回生产工作台。",
} = {}) {
  if (projectStoreStateRef?.current?.project && typeof syncLegacyCanvasFromBusinessProject === "function") {
    syncLegacyCanvasFromBusinessProject(projectStoreStateRef.current.project);
  }
  setShowCompatibilityCanvas?.(false);
  setShowProjectStudio?.(true);
  setProjectMessage?.(message);
}

export function openProductionStudioViewNavigation({
  view = "overview",
  message = "已定位到生产工作台。",
  now = Date.now,
  setStudioViewRequest,
  openProductionStudio,
} = {}) {
  const token = typeof now === "function" ? now() : Date.now();
  setStudioViewRequest?.({ view, token });
  openProductionStudio?.(message);
  return { view, token };
}

export function openNodeTargetInProductionStudioNavigation({
  nodeId = "",
  actionKey = "",
  nodes = [],
  nodesRef = null,
  openProductionStudioView,
} = {}) {
  const node = (nodesRef?.current || nodes).find((item) => item.id === nodeId);
  const view = resolveProductionStudioTargetView({ node, actionKey });
  if (!view) return false;
  openProductionStudioView?.(view, "已在生产工作台定位相关业务内容。");
  return true;
}

export function openWorkflowActionNavigation({
  actionKey = "",
  nodeId = "",
  openNodeTargetInProductionStudio,
  openAdvancedCanvas,
  locateNode,
  openProductionStudioView,
  setShowQueue,
  setShowHealth,
  setShowDashboard,
  schedule = (callback) => setTimeout(callback, 0),
} = {}) {
  if (nodeId) {
    if (!openNodeTargetInProductionStudio?.(nodeId, actionKey)) {
      openAdvancedCanvas?.();
      if (typeof locateNode === "function") {
        schedule(() => locateNode(nodeId));
      }
    }
    return { handled: true, target: "node" };
  }

  const studioTarget = WORKFLOW_ACTION_STUDIO_TARGETS[actionKey];
  if (studioTarget) {
    openProductionStudioView?.(studioTarget.view, studioTarget.message);
    return { handled: true, target: studioTarget.view };
  }

  if (actionKey === "queue") {
    setShowQueue?.(true);
    return { handled: true, target: "queue" };
  }

  if (actionKey === "health") {
    setShowHealth?.(true);
    return { handled: true, target: "health" };
  }

  setShowDashboard?.(true);
  return { handled: true, target: "dashboard" };
}

export function focusMainChainNavigation({
  openProductionStudioView,
  ...panelSetters
} = {}) {
  MAIN_CHAIN_AUXILIARY_PANEL_SETTERS.forEach((setterName) => {
    panelSetters[setterName]?.(false);
  });
  openProductionStudioView?.("overview", "已收敛到主生产链：文本、图片、视频、时间线、交付。");
  return { summary: "已关闭高级辅助面板，回到主生产链。" };
}

export function openSettingsPanelNavigation({
  focus = "image",
  setSettingsFocus,
  refreshGlobalApiConfigs,
  setShowSettings,
} = {}) {
  setSettingsFocus?.(focus);
  refreshGlobalApiConfigs?.();
  setShowSettings?.(true);
  return { focus };
}
