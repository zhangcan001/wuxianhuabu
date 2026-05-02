import {
  buildEpisodeCanvasProjection,
  mergeCanvasProjection,
} from "../domain/canvas-projection.js";
import {
  materializeBusinessProjectCanvas,
} from "../domain/project-canvas-materializer.js";
import {
  projectStoreReducer,
} from "./project-store.js";

export function materializeLegacyCanvasFromBusinessProject(project = null, nodes = [], edges = [], options = {}) {
  return materializeBusinessProjectCanvas(project, nodes, edges, options);
}

export function reduceProjectStoreWithCanvasCompatibility({
  storeState,
  action = {},
  nodes = [],
  edges = [],
  materializeCanvas = false,
  reducer = projectStoreReducer,
} = {}) {
  const nextStoreState = reducer(storeState, action);
  if (!materializeCanvas || !nextStoreState.project) {
    return {
      storeState: nextStoreState,
      nodes,
      edges,
      materialized: false,
    };
  }
  const canvas = materializeLegacyCanvasFromBusinessProject(nextStoreState.project, nodes, edges);
  return {
    storeState: nextStoreState,
    nodes: canvas.nodes,
    edges: canvas.edges,
    materialized: true,
  };
}

export function reduceCanvasNodeEditToProjectStore({
  storeState,
  node,
  reducer = projectStoreReducer,
} = {}) {
  if (!isBusinessCanvasNode(node)) return storeState;
  return reducer(storeState, {
    type: "applyCanvasNode",
    node,
  });
}

export function syncCanvasNodesToProjectStore({
  storeState,
  nextNodes = [],
  previousNodes = [],
  reducer = projectStoreReducer,
} = {}) {
  const previousById = new Map((Array.isArray(previousNodes) ? previousNodes : []).map((node) => [node.id, node]));
  let nextStoreState = storeState;
  const syncedNodeIds = [];
  (Array.isArray(nextNodes) ? nextNodes : []).forEach((node) => {
    if (previousById.get(node.id) === node) return;
    const reduced = reduceCanvasNodeEditToProjectStore({
      storeState: nextStoreState,
      node,
      reducer,
    });
    if (reduced !== nextStoreState) {
      nextStoreState = reduced;
      syncedNodeIds.push(node.id);
    }
  });
  return {
    storeState: nextStoreState,
    changed: nextStoreState !== storeState,
    syncedNodeIds,
  };
}

export function patchCanvasNodeAndSyncProjectStore({
  storeState,
  node,
  patch = {},
  reducer = projectStoreReducer,
} = {}) {
  if (!node) {
    return {
      node,
      storeState,
      changed: false,
    };
  }
  const nextNode = { ...node, data: { ...node.data, ...patch } };
  const nextStoreState = reduceCanvasNodeEditToProjectStore({
    storeState,
    node: nextNode,
    reducer,
  });
  return {
    node: nextNode,
    storeState: nextStoreState,
    changed: nextStoreState !== storeState,
  };
}

export function isBusinessCanvasNode(node = {}) {
  return ["novelPipeline", "assetLibrary", "shotList"].includes(node.type);
}

export function mergeAdvancedCanvasProjection({
  episode = null,
  nodes = [],
  edges = [],
  origin = { x: 80, y: 80 },
} = {}) {
  if (!episode?.id) {
    return {
      nodes: Array.isArray(nodes) ? nodes : [],
      edges: Array.isArray(edges) ? edges : [],
      projected: false,
    };
  }
  const projection = buildEpisodeCanvasProjection(episode, { origin });
  return {
    ...mergeCanvasProjection(nodes, edges, projection),
    projected: true,
    projectedNodeIds: projection.nodes.map((node) => node.id),
  };
}
