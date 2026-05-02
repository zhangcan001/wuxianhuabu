import {
  applyTextPackageToProject,
  createCommercialProject,
  normalizeCommercialProject,
  updateEpisode,
} from "../domain/project-model.js";
import {
  applyTaskResultToProject,
} from "../domain/project-task-model.js";
import {
  discardAssetImageCandidateInProject,
  setAssetPrimaryImageInProject,
} from "../domain/project-asset-model.js";
import {
  discardShotMediaCandidateInProject,
  setShotPrimaryMediaInProject,
} from "../domain/project-shot-model.js";
import {
  updateShotReviewStatusInProject,
} from "../domain/project-review-model.js";
import {
  replaceEpisodeTimelineInProject,
  syncTimelineFromShotsInProject,
  updateTimelineClipInProject,
} from "../domain/project-timeline-model.js";
import {
  applyCanvasNodeToProject,
} from "../domain/canvas-reverse-sync.js";

export function createProjectStoreState(project = null, options = {}) {
  return {
    project: project ? normalizeCommercialProject(project) : null,
    revision: Number(options.revision || 0),
    source: options.source || "",
    lastAction: options.lastAction || "",
  };
}

export function projectStoreReducer(state = createProjectStoreState(), action = {}) {
  const current = state?.project ? state : createProjectStoreState();
  switch (action.type) {
    case "hydrate": {
      if (action.source === "legacy" && current.source === "loaded" && current.project && Number(current.revision || 0) === 0) {
        return current;
      }
      const project = action.project ? createCommercialProject(action.project) : null;
      return {
        ...current,
        project,
        source: action.source || "hydrate",
        lastAction: "hydrate",
      };
    }
    case "applyTextPackage": {
      const baseProject = ensureProject(current.project, action);
      const episodeId = action.episodeId || baseProject.activeEpisodeId || "";
      const projectWithSourceIds = action.sourceNodeIds
        ? updateEpisode(baseProject, episodeId, (episode) => ({
          ...episode,
          sourceNodeIds: {
            ...(episode.sourceNodeIds || {}),
            ...action.sourceNodeIds,
          },
        }))
        : baseProject;
      return nextStoreState(current, applyTextPackageToProject(projectWithSourceIds, episodeId, action.packageResult), action.type);
    }
    case "applyTaskResult": {
      const baseProject = ensureProject(current.project, action);
      return nextStoreState(current, applyTaskResultToProject(baseProject, {
        task: action.task || action.job || {},
        result: action.result || {},
        episodeId: action.episodeId || "",
        shotId: action.shotId || "",
      }), action.type);
    }
    case "setAssetPrimaryImage": {
      const baseProject = ensureProject(current.project, action);
      return nextStoreState(current, setAssetPrimaryImageInProject(baseProject, action), action.type);
    }
    case "discardAssetImageCandidate": {
      const baseProject = ensureProject(current.project, action);
      return nextStoreState(current, discardAssetImageCandidateInProject(baseProject, action), action.type);
    }
    case "setShotPrimaryMedia": {
      const baseProject = ensureProject(current.project, action);
      return nextStoreState(current, setShotPrimaryMediaInProject(baseProject, action), action.type);
    }
    case "discardShotMediaCandidate": {
      const baseProject = ensureProject(current.project, action);
      return nextStoreState(current, discardShotMediaCandidateInProject(baseProject, action), action.type);
    }
    case "updateShotReviewStatus": {
      const baseProject = ensureProject(current.project, action);
      return nextStoreState(current, updateShotReviewStatusInProject(baseProject, action), action.type);
    }
    case "syncTimelineFromShots": {
      const baseProject = ensureProject(current.project, action);
      return nextStoreState(current, syncTimelineFromShotsInProject(baseProject, action), action.type);
    }
    case "replaceEpisodeTimeline": {
      const baseProject = ensureProject(current.project, action);
      return nextStoreState(current, replaceEpisodeTimelineInProject(baseProject, action), action.type);
    }
    case "updateTimelineClip": {
      const baseProject = ensureProject(current.project, action);
      return nextStoreState(current, updateTimelineClipInProject(baseProject, action), action.type);
    }
    case "applyCanvasNode": {
      const baseProject = ensureProject(current.project, action);
      return nextStoreState(current, applyCanvasNodeToProject(baseProject, action.node), action.type);
    }
    case "updateEpisode": {
      const baseProject = ensureProject(current.project, action);
      return nextStoreState(current, updateEpisode(baseProject, action.episodeId || baseProject.activeEpisodeId, action.updater), action.type);
    }
    default:
      return current;
  }
}

function nextStoreState(state, project, lastAction) {
  return {
    project: normalizeCommercialProject(project),
    revision: Number(state.revision || 0) + 1,
    source: "store",
    lastAction,
  };
}

function ensureProject(project, action = {}) {
  return project
    ? normalizeCommercialProject(project)
    : createCommercialProject({
      activeEpisodeId: action.episodeId || "episode-1",
      episodes: [{ id: action.episodeId || "episode-1", title: "当前集" }],
    });
}
