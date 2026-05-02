import {
  createProductionProject,
} from "../../core/model/production-model.js";
import {
  commercialProjectToProductionProject,
} from "../../adapters/project-production/commercial-production-adapter.js";
import {
  appendProductionEvent,
} from "../../core/events/production-events.js";
import {
  buildProductionTaskGraph,
} from "../../core/task-graph/production-task-graph.js";
import {
  createNovelToVideoWorkflow,
  evaluateWorkflow,
} from "../../core/workflow/production-workflow.js";

export function bootstrapProductionOS(input = {}) {
  const project = createProductionProject(input.project || input);
  const events = appendProductionEvent(input.events || [], "production.bootstrap", {
    projectId: project.id,
    episodeId: project.activeEpisodeId,
  }, { projectId: project.id, episodeId: project.activeEpisodeId, now: input.now });
  return makeProductionState(project, events, input);
}

export function bootstrapProductionOSFromCommercialProject(input = {}) {
  const productionProject = commercialProjectToProductionProject(input.commercialProject || input.project || {}, input.adapterOptions || {});
  return bootstrapProductionOS({
    ...input,
    project: productionProject,
  });
}

export function planEpisodeProduction(input = {}) {
  const project = createProductionProject(input.project || {});
  const episode = input.episode || project.activeEpisode;
  const taskGraph = buildProductionTaskGraph(episode, input.taskOptions || {});
  const events = appendProductionEvent(input.events || [], "production.taskGraph.planned", {
    projectId: project.id,
    episodeId: episode.id || project.activeEpisodeId,
    taskCount: taskGraph.tasks.length,
    readyCount: taskGraph.ready.length,
  }, { projectId: project.id, episodeId: episode.id || project.activeEpisodeId, now: input.now });
  return {
    ...makeProductionState(project, events, input),
    taskGraph,
    effects: [
      { type: "TASK_GRAPH_READY", graph: taskGraph },
      ...(taskGraph.ready.length ? [{ type: "QUEUE_TASKS", tasks: taskGraph.ready }] : []),
    ],
  };
}

function makeProductionState(project, events, input = {}) {
  const workflow = input.workflow || createNovelToVideoWorkflow();
  const workflowState = evaluateWorkflow(project, workflow, {
    events,
    allowDefaultBible: input.allowDefaultBible,
  });
  return {
    project,
    workflow,
    workflowState,
    events,
    effects: [],
  };
}
