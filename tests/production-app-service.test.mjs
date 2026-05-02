import assert from "node:assert/strict";
import test from "node:test";
import {
  createProductionAppService,
} from "../src/application/services/production-app-service.js";
import {
  createInMemoryEventStore,
} from "../src/infrastructure/events/event-store.js";

function commercialProject() {
  return {
    id: "p1",
    name: "雨夜短剧",
    activeEpisodeId: "e1",
    episodes: [{
      id: "e1",
      title: "第一集",
      sourceText: "雨夜",
      script: "第一场",
      assets: [{ id: "a1", type: "character", token: "@林舟", prompt: "红衣", lifecycle: "draft" }],
      shots: [{
        id: "S01",
        imagePrompt: "雨夜车站",
        videoPrompt: "镜头推进",
        assetRefs: ["@林舟"],
      }],
      timeline: { clips: [] },
    }],
  };
}

test("production app service builds state dashboard and task graph", () => {
  const service = createProductionAppService();
  const state = service.buildState({ commercialProject: commercialProject() });

  assert.equal(state.project.id, "p1");
  assert.equal(state.dashboard.projectName, "雨夜短剧");
  assert.equal(state.taskGraph.ready.some((task) => task.type === "asset.image"), true);
  assert.equal(state.taskStore.summary.byType["asset.image"] > 0, true);
  assert.equal(state.resourceRegistry.summary.total, 0);
});

test("production app service plans legacy image and video jobs from task graph", () => {
  const eventStore = createInMemoryEventStore();
  const service = createProductionAppService({ eventStore });
  const imagePlan = service.planImageJobs({ commercialProject: commercialProject() });
  const videoPlan = service.planVideoJobs({
    commercialProject: {
      ...commercialProject(),
      episodes: [{
        ...commercialProject().episodes[0],
        assets: [{ id: "a1", type: "character", token: "@林舟", lifecycle: "locked" }],
        shots: [{ ...commercialProject().episodes[0].shots[0], imageResultUrl: "s01.png" }],
      }],
    },
  });

  assert.equal(imagePlan.jobs.some((job) => job.kind === "image"), true);
  assert.equal(videoPlan.jobs.length, 1);
  assert.equal(videoPlan.jobs[0].kind, "video");
  assert.equal(imagePlan.events.at(-1).type, "production.legacyQueue.image.planned");
  assert.equal(videoPlan.events.at(-1).type, "production.legacyQueue.video.planned");
  assert.equal(eventStore.summary().byType["production.legacyQueue.image.planned"], 1);
  assert.equal(eventStore.summary().byType["production.legacyQueue.video.planned"], 1);
});

test("production app service carries selected image provider to asset jobs", () => {
  const service = createProductionAppService();
  const imagePlan = service.planImageJobs({
    commercialProject: commercialProject(),
    taskOptions: { imageProvider: "comfy" },
    jobOptions: { providerMode: "comfy" },
  });
  const assetJob = imagePlan.jobs.find((job) => job.type === "asset.image");

  assert.equal(assetJob.imageProviderMode, "comfy");
  assert.equal(assetJob.providerMode, "comfy");
});

test("production app service runs review and plans delivery", () => {
  const service = createProductionAppService();
  const readyProject = {
    ...commercialProject(),
    episodes: [{
      ...commercialProject().episodes[0],
      assets: [{ id: "a1", type: "character", token: "@林舟", lifecycle: "locked" }],
      shots: [{
        ...commercialProject().episodes[0].shots[0],
        imageResultUrl: "s01.png",
        videoResultUrl: "s01.mp4",
      }],
      timeline: { clips: [{ id: "clip-1", shotId: "S01", mediaUrl: "s01.mp4" }] },
    }],
  };
  const review = service.runReview({ commercialProject: readyProject });
  const delivery = service.planDelivery({
    commercialProject: {
      ...readyProject,
      episodes: [{
        ...readyProject.episodes[0],
        reviews: [review.review],
      }],
    },
  });

  assert.equal(review.review.result, "approved");
  assert.equal(review.events.at(-1).type, "production.review.completed");
  assert.equal(delivery.delivery.ok, true);
  assert.equal(delivery.events.at(-1).type, "production.delivery.planned");
  assert.equal(delivery.delivery.task.type, "delivery.export");
});

test("production app service plans media ingest and emits upload events", () => {
  const eventStore = createInMemoryEventStore();
  const service = createProductionAppService({ eventStore });
  const result = service.ingestMedia({
    commercialProject: commercialProject(),
    media: {
      kind: "video",
      sourceMode: "upload",
      target: { type: "shot", id: "S01" },
      mediaUrl: "asset://s01.mp4",
    },
  });

  assert.equal(result.ingest.ok, true);
  assert.equal(result.ingest.taskType, "shot.video");
  assert.equal(result.events.at(-1).type, "production.video.uploaded");
  assert.equal(result.events.at(-1).payload.result.videoUrl, "asset://s01.mp4");
  assert.equal(eventStore.summary().byType["production.video.uploaded"], 1);
});

test("production app service reports incomplete media ingest without appending events", () => {
  const eventStore = createInMemoryEventStore();
  const service = createProductionAppService({ eventStore });
  const result = service.ingestMedia({
    commercialProject: commercialProject(),
    media: { kind: "image" },
  });

  assert.equal(result.ingest.ok, false);
  assert.deepEqual(result.ingest.blockers, ["target", "media"]);
  assert.equal(eventStore.summary().total, 0);
});
