import {
  productionTasksToQueueJobs,
} from "./production-task-store.js";

export function planImageQueueJobsFromProductionService({
  productionAppService,
  commercialProject,
  providerMode = "",
  events = [],
  adapterOptions = defaultAdapterOptions(),
  taskOptions = {},
  queueOptions = {},
} = {}) {
  if (!productionAppService?.planImageTasks) {
    return emptyTaskPlan("image");
  }
  const plan = productionAppService.planImageTasks({
    commercialProject,
    adapterOptions,
    taskOptions: {
      imageProvider: providerMode,
      ...taskOptions,
    },
    events,
  });
  return {
    ...plan,
    jobs: productionTasksToQueueJobs(plan.tasks || [], {
      providerMode,
      ...queueOptions,
    }),
  };
}

export function planVideoQueueJobsFromProductionService({
  productionAppService,
  commercialProject,
  providerMode = "",
  events = [],
  adapterOptions = defaultAdapterOptions(),
  taskOptions = {},
  queueOptions = {},
} = {}) {
  if (!productionAppService?.planVideoTasks) {
    return emptyTaskPlan("video");
  }
  const plan = productionAppService.planVideoTasks({
    commercialProject,
    adapterOptions,
    taskOptions: {
      videoProvider: providerMode,
      ...taskOptions,
    },
    events,
  });
  return {
    ...plan,
    jobs: productionTasksToQueueJobs(plan.tasks || [], {
      videoProvider: providerMode,
      ...queueOptions,
    }),
  };
}

function defaultAdapterOptions() {
  return {
    outputSpec: { platform: "short-video", aspectRatio: "9:16" },
    includePendingReview: true,
  };
}

function emptyTaskPlan(kind = "") {
  return {
    project: null,
    taskGraph: { tasks: [], ready: [] },
    taskStore: null,
    dashboard: null,
    events: [],
    tasks: [],
    jobs: [],
    kind,
  };
}
