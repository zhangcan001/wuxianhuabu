import {
  applyTaskResultToProject,
} from "../domain/project-task-model.js";
import {
  buildShotPatchFromBusinessShot,
  selectEpisodeShot,
} from "../domain/project-selectors.js";
import {
  normalizeProductionEvent,
} from "../core/events/production-event-schema.js";

export function createProjectCommandService(deps = {}) {
  const getProject = typeof deps.getProject === "function" ? deps.getProject : () => deps.project || null;
  const getEvents = typeof deps.getEvents === "function" ? deps.getEvents : () => deps.events || [];
  const commitProjectStoreAction = typeof deps.commitProjectStoreAction === "function"
    ? deps.commitProjectStoreAction
    : null;
  const setProductionEvents = typeof deps.setProductionEvents === "function" ? deps.setProductionEvents : null;
  const productionAppService = deps.productionAppService || null;

  function commitTaskResult({ job = {}, result = {}, materializeCanvas = true } = {}) {
    const baseProject = getProject() || {};
    const nextStoreState = commitProjectStoreAction
      ? commitProjectStoreAction({
        type: "applyTaskResult",
        task: job,
        result,
      }, { materializeCanvas })
      : null;
    const project = nextStoreState?.project || applyTaskResultToProject(baseProject, { task: job, result });
    const patch = buildShotPatch(project, job);
    return {
      project,
      patch,
      storeState: nextStoreState,
    };
  }

  function commitStoreAction(action = {}, options = {}) {
    if (!action?.type) {
      return {
        project: getProject(),
        storeState: null,
      };
    }
    const nextStoreState = commitProjectStoreAction
      ? commitProjectStoreAction(action, {
        materializeCanvas: options.materializeCanvas !== false,
      })
      : null;
    if (options.eventType) {
      appendCommandEvent(options.eventType, {
        actionType: action.type,
        episodeId: action.episodeId || "",
        targetId: action.shotId || action.clipId || action.assetId || action.targetId || "",
        detail: options.detail || "",
      });
    }
    return {
      project: nextStoreState?.project || getProject(),
      storeState: nextStoreState,
    };
  }

  function commitTextPackage({ action = {}, materializeCanvas = true } = {}) {
    return commitStoreAction(action, { materializeCanvas });
  }

  function updateShotReviewStatus(input = {}) {
    return commitStoreAction({
      type: "updateShotReviewStatus",
      ...input,
    }, {
      materializeCanvas: true,
      eventType: "production.review.status_updated",
      detail: input.reviewStatus || "",
    });
  }

  function syncTimelineFromShots(input = {}) {
    return commitStoreAction({
      type: "syncTimelineFromShots",
      ...input,
    }, {
      materializeCanvas: false,
      eventType: "production.timeline.synced",
    });
  }

  function updateTimelineClip(input = {}) {
    return commitStoreAction({
      type: "updateTimelineClip",
      ...input,
    }, {
      materializeCanvas: false,
      eventType: input.remove ? "production.timeline.clip_removed" : "production.timeline.clip_updated",
      detail: input.patch?.reviewStatus || input.patch?.duration || "",
    });
  }

  function replaceEpisodeTimeline(input = {}) {
    return commitStoreAction({
      type: "replaceEpisodeTimeline",
      ...input,
    }, {
      materializeCanvas: false,
      eventType: "production.timeline.legacy_synced",
      detail: `${input.timeline?.clips?.length || input.clips?.length || 0} clips`,
    });
  }

  function recordDeliveryPlanned(input = {}) {
    appendCommandEvent("production.delivery.planned", {
      episodeId: input.episodeId || "",
      targetId: input.packageId || "",
      detail: input.detail || "",
    });
    return {
      events: getEvents(),
    };
  }

  function commitUploadedMedia({ job = {}, result = {}, media = {}, events = null } = {}) {
    const committed = commitTaskResult({ job, result, materializeCanvas: true });
    const ingest = recordMediaIngest({
      project: committed.project,
      media,
      events,
    });
    return {
      ...committed,
      events: ingest.events,
      ingest,
    };
  }

  function recordMediaIngest({ project = null, media = {}, events = null } = {}) {
    if (!productionAppService?.ingestMedia) {
      return {
        events: events || getEvents(),
        ingest: null,
      };
    }
    const result = productionAppService.ingestMedia({
      commercialProject: project || getProject(),
      events: events || getEvents(),
      media,
    });
    const nextEvents = result.events || events || getEvents();
    if (setProductionEvents) setProductionEvents(nextEvents);
    return {
      ...result,
      events: nextEvents,
    };
  }

  function appendCommandEvent(type = "", payload = {}) {
    if (!type || !setProductionEvents) return;
    const event = {
      type,
      at: new Date().toISOString(),
      projectId: getProject()?.id || "",
      ...payload,
    };
    setProductionEvents([...(getEvents() || []), normalizeProductionEvent(event, {
      projectId: getProject()?.id || "",
      actor: "project-command-service",
    })]);
  }

  return {
    commitStoreAction,
    commitTextPackage,
    commitTaskResult,
    commitUploadedMedia,
    syncTimelineFromShots,
    replaceEpisodeTimeline,
    recordDeliveryPlanned,
    updateShotReviewStatus,
    updateTimelineClip,
    recordMediaIngest,
  };
}

function buildShotPatch(project = {}, job = {}) {
  if (!job?.shotId || !job?.episodeId) return null;
  const shot = selectEpisodeShot(project, job.episodeId, job.shotId);
  return shot ? buildShotPatchFromBusinessShot(shot) : null;
}
