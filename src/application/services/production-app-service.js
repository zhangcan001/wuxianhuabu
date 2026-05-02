import {
  commercialProjectToProductionProject,
} from "../../adapters/project-production/commercial-production-adapter.js";
import {
  productionTasksToLegacyGenerationJobs,
} from "../../adapters/legacy-canvas/production-task-adapter.js";
import {
  createProductionTaskStore,
  normalizeProductionTasks,
} from "../../app/production-task-store.js";
import {
  buildProjectResourceRegistry,
} from "../../app/resource-registry.js";
import {
  buildProductionDashboard,
} from "../../core/selectors/production-dashboard.js";
import {
  buildProductionTaskGraph,
} from "../../core/task-graph/production-task-graph.js";
import {
  planDeliveryExport,
} from "../../core/delivery/delivery-package.js";
import {
  runEpisodeReview,
} from "../../core/review/review-system.js";
import {
  appendProductionEvent,
} from "../../core/events/production-events.js";
import {
  buildMediaIngestPlan,
} from "../../core/ingest/media-ingest-plan.js";

export function createProductionAppService(deps = {}) {
  const eventStore = deps.eventStore || null;
  return {
    buildState(input = {}) {
      const project = commercialProjectToProductionProject(input.commercialProject || input.project || {}, input.adapterOptions || {});
      const taskGraph = buildProductionTaskGraph(project.activeEpisode || {}, input.taskOptions || {});
      const taskStore = createProductionTaskStore({ tasks: taskGraph.tasks || [] });
      const resourceRegistry = buildProjectResourceRegistry(input.commercialProject || input.project || {});
      const events = eventStore?.list({ projectId: project.id }) || input.events || [];
      const dashboard = buildProductionDashboard(project, {
        taskGraph,
        events,
        allowDefaultBible: input.allowDefaultBible ?? true,
        costOptions: input.costOptions || {},
        auditOptions: input.auditOptions || {},
        queue: input.queue || [],
        consistencyReport: input.consistencyReport || null,
        migrationReport: input.migrationReport || null,
        deliveryManifestReport: input.deliveryManifestReport || null,
        securityReport: input.securityReport || null,
      });
      return {
        project,
        taskGraph,
        taskStore,
        resourceRegistry,
        dashboard,
        events,
      };
    },
    planImageTasks(input = {}) {
      const state = this.buildState(input);
      const tasks = normalizeProductionTasks((state.taskGraph.ready || []).filter((task) => task.type === "asset.image" || task.type === "shot.image"));
      const events = appendEvents(eventStore, input.events, "production.queue.image.planned", {
        projectId: state.project.id,
        episodeId: state.project.activeEpisodeId,
        taskCount: tasks.length,
      });
      return { ...state, events, tasks, taskStore: createProductionTaskStore({ tasks }) };
    },
    planImageJobs(input = {}) {
      const state = this.planImageTasks(input);
      const jobs = productionTasksToLegacyGenerationJobs(
        state.tasks,
        input.jobOptions || {},
      );
      const events = appendEvents(eventStore, input.events, "production.legacyQueue.image.planned", {
        projectId: state.project.id,
        episodeId: state.project.activeEpisodeId,
        jobCount: jobs.length,
      });
      return { ...state, events, jobs };
    },
    planVideoTasks(input = {}) {
      const state = this.buildState(input);
      const tasks = normalizeProductionTasks((state.taskGraph.ready || []).filter((task) => task.type === "shot.video"));
      const events = appendEvents(eventStore, input.events, "production.queue.video.planned", {
        projectId: state.project.id,
        episodeId: state.project.activeEpisodeId,
        taskCount: tasks.length,
      });
      return { ...state, events, tasks, taskStore: createProductionTaskStore({ tasks }) };
    },
    planVideoJobs(input = {}) {
      const state = this.planVideoTasks(input);
      const jobs = productionTasksToLegacyGenerationJobs(
        state.tasks,
        input.jobOptions || {},
      );
      const events = appendEvents(eventStore, input.events, "production.legacyQueue.video.planned", {
        projectId: state.project.id,
        episodeId: state.project.activeEpisodeId,
        jobCount: jobs.length,
      });
      return { ...state, events, jobs };
    },
    runReview(input = {}) {
      const state = this.buildState(input);
      const review = runEpisodeReview(state.project.activeEpisode || {}, {
        outputSpec: state.project.productionBible?.outputSpec || {},
        ...(input.reviewOptions || {}),
      });
      const events = appendEvents(eventStore, input.events, "production.review.completed", {
        projectId: state.project.id,
        episodeId: state.project.activeEpisodeId,
        result: review.result,
        issueCount: review.issues.length,
      });
      return { ...state, events, review };
    },
    planDelivery(input = {}) {
      const state = this.buildState(input);
      const delivery = planDeliveryExport(state.project, input.deliveryOptions || {});
      const events = appendEvents(eventStore, input.events, "production.delivery.planned", {
        projectId: state.project.id,
        episodeId: state.project.activeEpisodeId,
        ok: delivery.ok,
        blockerCount: delivery.readiness?.blockers?.length || 0,
      });
      return { ...state, events, delivery };
    },
    ingestMedia(input = {}) {
      const state = this.buildState(input);
      const plan = buildMediaIngestPlan({
        projectId: state.project.id,
        episodeId: input.episodeId || state.project.activeEpisodeId,
        ...(input.media || input.ingest || {}),
      });
      if (!plan.ok) return { ...state, events: input.events || state.events, ingest: plan };
      const events = appendEvents(eventStore, input.events || state.events, plan.eventType, {
        projectId: plan.projectId,
        episodeId: plan.episodeId,
        taskId: plan.taskId,
        taskType: plan.taskType,
        providerId: plan.providerId,
        target: plan.target,
        result: plan.result,
      });
      return { ...state, events, ingest: plan };
    },
  };
}

function appendEvents(store, fallbackEvents = [], type = "", payload = {}) {
  const nextEvents = appendProductionEvent(fallbackEvents || [], type, payload, {
    projectId: payload.projectId || "",
    episodeId: payload.episodeId || "",
  });
  const event = nextEvents[nextEvents.length - 1];
  if (store) store.append(event);
  return nextEvents;
}
