import {
  buildEpisodeCanvasProjection,
  mergeCanvasProjection,
} from "./canvas-projection.js";
import {
  createCommercialProject,
  selectActiveEpisode,
} from "./project-model.js";

const PROJECTED_NODE_TYPES = {
  novel: "novelPipeline",
  asset: "assetLibrary",
  shot: "shotList",
};

export function materializeBusinessProjectCanvas(project = null, nodes = [], edges = [], options = {}) {
  if (!project) {
    return { nodes: Array.isArray(nodes) ? nodes : [], edges: Array.isArray(edges) ? edges : [], projected: false };
  }
  const normalizedProject = createCommercialProject(project);
  const activeEpisode = selectActiveEpisode(normalizedProject);
  if (!activeEpisode) {
    return { nodes: Array.isArray(nodes) ? nodes : [], edges: Array.isArray(edges) ? edges : [], projected: false };
  }

  const episode = withInferredSourceNodeIds(activeEpisode, nodes);
  const projection = buildEpisodeCanvasProjection(episode, options.projection || {});
  const merged = mergeCanvasProjection(nodes, edges, projection);
  return {
    ...merged,
    projected: true,
    projectedNodeIds: projection.nodes.map((node) => node.id),
  };
}

function withInferredSourceNodeIds(episode = {}, nodes = []) {
  const sourceNodeIds = {
    novel: inferSourceNodeIds(episode, nodes, "novel"),
    asset: inferSourceNodeIds(episode, nodes, "asset"),
    shot: inferSourceNodeIds(episode, nodes, "shot"),
  };
  return {
    ...episode,
    sourceNodeIds,
  };
}

function inferSourceNodeIds(episode = {}, nodes = [], bucket = "") {
  const existing = Array.isArray(episode.sourceNodeIds?.[bucket]) ? episode.sourceNodeIds[bucket].filter(Boolean) : [];
  if (existing.length) return existing;
  const type = PROJECTED_NODE_TYPES[bucket];
  const episodeId = episode.id || "";
  const match = (Array.isArray(nodes) ? nodes : []).find((node) => (
    node.type === type && (!episodeId || !node.data?.episodeId || node.data.episodeId === episodeId)
  ));
  return match?.id ? [match.id] : [];
}
