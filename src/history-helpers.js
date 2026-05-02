export function structuredCloneSafe(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function createEditorSnapshot(state, clone = structuredCloneSafe) {
  return {
    nodes: clone(state.nodes),
    edges: clone(state.edges),
    view: clone(state.view),
    resources: clone(state.resources),
    timeline: clone(state.timeline),
    promptFactory: clone(state.promptFactory),
    templateCenter: clone(state.templateCenter),
    stylePresetCenter: clone(state.stylePresetCenter),
    modelParamCenter: clone(state.modelParamCenter),
    collaborationState: clone(state.collaborationState),
    archiveState: clone(state.archiveState),
    performanceSettings: clone(state.performanceSettings),
    businessProject: clone(state.businessProject || null),
    productionEvents: clone(state.productionEvents || []),
    episodes: clone(state.episodes),
    activeEpisodeId: state.activeEpisodeId,
  };
}

export function pushHistoryState(history, snapshot, limit = 50) {
  return {
    past: [...history.past.slice(-(limit - 1)), snapshot],
    future: [],
  };
}

export function computeUndoState(history, currentSnapshot, limit = 50) {
  if (!history.past.length) {
    return { history, snapshotToRestore: null };
  }
  const snapshotToRestore = history.past[history.past.length - 1];
  return {
    snapshotToRestore,
    history: {
      past: history.past.slice(0, -1),
      future: [currentSnapshot, ...history.future].slice(0, limit),
    },
  };
}

export function computeRedoState(history, currentSnapshot, limit = 50) {
  if (!history.future.length) {
    return { history, snapshotToRestore: null };
  }
  const snapshotToRestore = history.future[0];
  return {
    snapshotToRestore,
    history: {
      past: [...history.past, currentSnapshot].slice(-limit),
      future: history.future.slice(1),
    },
  };
}

export function normalizeRestoredSnapshot(item, deps) {
  const {
    normalizeTimelineState,
    normalizePromptFactoryState,
    normalizeTemplateCenterState,
    normalizeStylePresetCenterState,
    normalizeModelParamCenterState,
    normalizeCollaborationState,
    normalizeArchiveState,
    normalizePerformanceSettings,
    defaultEpisodes,
    inferNextNodeId,
  } = deps;
  const episodes = item.episodes || defaultEpisodes();
  const activeEpisodeId = item.activeEpisodeId || item.episodes?.[0]?.id || "episode-1";
  return {
    nodes: item.nodes,
    edges: item.edges,
    view: item.view,
    resources: item.resources || [],
    timeline: normalizeTimelineState(item.timeline, activeEpisodeId),
    promptFactory: normalizePromptFactoryState(item.promptFactory),
    templateCenter: normalizeTemplateCenterState(item.templateCenter),
    stylePresetCenter: normalizeStylePresetCenterState(item.stylePresetCenter),
    modelParamCenter: normalizeModelParamCenterState(item.modelParamCenter),
    collaborationState: normalizeCollaborationState(item.collaborationState),
    archiveState: normalizeArchiveState(item.archiveState),
    performanceSettings: normalizePerformanceSettings(item.performanceSettings),
    businessProject: item.businessProject || null,
    productionEvents: Array.isArray(item.productionEvents) ? item.productionEvents : [],
    episodes,
    activeEpisodeId,
    nextNodeId: inferNextNodeId(item.nodes),
  };
}
