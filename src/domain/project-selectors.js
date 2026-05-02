import {
  buildShotPatchFromBusinessShot,
  normalizeCommercialProject,
  selectActiveEpisode,
  selectEpisodeShot,
} from "./project-model.js";

export {
  buildShotPatchFromBusinessShot,
  selectActiveEpisode,
  selectEpisodeShot,
};

export function selectActiveEpisodeTimeline(project = {}) {
  return selectActiveEpisode(project)?.timeline || { clips: [] };
}

export function selectProjectTotals(project = {}) {
  return normalizeCommercialProject(project).totals;
}
