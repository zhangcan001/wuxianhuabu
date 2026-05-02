import assert from "node:assert/strict";
import test from "node:test";
import {
  bootstrapProductionOS,
  planEpisodeProduction,
} from "../src/application/use-cases/production-use-cases.js";
import {
  createProductionProject,
} from "../src/core/model/production-model.js";
import {
  buildProductionTaskGraph,
  markTaskGraphResult,
} from "../src/core/task-graph/production-task-graph.js";
import {
  createNovelToVideoWorkflow,
  evaluateWorkflow,
} from "../src/core/workflow/production-workflow.js";
import {
  appendProductionEvent,
  summarizeProductionEvents,
} from "../src/core/events/production-events.js";
import {
  buildProductionDashboard,
  buildProductionRiskReport,
} from "../src/core/selectors/production-dashboard.js";

function productionFixture() {
  return {
    id: "project-1",
    name: "Commercial Demo",
    activeEpisodeId: "ep-1",
    productionBible: {
      storyWorld: "rain city",
      visualStyle: "cinematic vertical drama",
    },
    episodes: [{
      id: "ep-1",
      title: "Episode 1",
      sourceText: "A courier finds a lost key.",
      script: "Scene 1: rain station.",
      assets: [
        { id: "char-1", type: "character", token: "@hero", canonicalPrompt: "red coat courier", lifecycle: "draft" },
      ],
      shots: [
        { id: "S01", prompt: { image: "rain station first frame", video: "slow push in" }, mainCharacterToken: "@hero", assetRefs: ["@hero"] },
      ],
    }],
  };
}

test("production model normalizes commercial delivery objects", () => {
  const project = createProductionProject(productionFixture());

  assert.equal(project.schemaVersion, "production-os.v1");
  assert.equal(project.productionBible.outputSpec.aspectRatio, "9:16");
  assert.equal(project.activeEpisode.shots[0].prompt.image, "rain station first frame");
  assert.equal(project.totals.assets, 1);
});

test("workflow evaluates commercial gates and blockers", () => {
  const project = createProductionProject(productionFixture());
  const state = evaluateWorkflow(project, createNovelToVideoWorkflow(), { events: [] });

  assert.equal(state.currentStage, "assetGeneration");
  assert.deepEqual(state.blockers, ["approvedAssets"]);
  assert.equal(state.readyForDelivery, false);
});

test("task graph creates dependency-aware production tasks", () => {
  const project = createProductionProject(productionFixture());
  const graph = buildProductionTaskGraph(project.activeEpisode);

  assert.equal(graph.tasks.some((task) => task.type === "asset.image"), true);
  assert.equal(graph.tasks.some((task) => task.type === "shot.image"), true);
  assert.equal(graph.tasks.some((task) => task.type === "delivery.export"), true);
  assert.match(graph.tasks.find((task) => task.type === "shot.image").input.prompt, /red coat courier/);
  assert.deepEqual(graph.tasks.find((task) => task.type === "shot.video").input.assetRefs, ["@hero"]);
  assert.deepEqual(graph.ready.map((task) => task.type), ["asset.image"]);

  const afterAsset = markTaskGraphResult(graph, "asset-image:ep-1:char-1", { output: { url: "asset.png" } });
  assert.equal(afterAsset.ready.some((task) => task.id === "shot-image:ep-1:S01"), true);
});

test("task graph treats local upload image tasks as manual work", () => {
  const project = createProductionProject({
    ...productionFixture(),
    episodes: [{
      ...productionFixture().episodes[0],
      assets: [],
      shots: [{
        id: "S01",
        imagePrompt: "uploaded frame",
        imageProviderMode: "upload",
      }],
    }],
  });
  const graph = buildProductionTaskGraph(project.activeEpisode, { imageProvider: "upload" });
  const uploadTask = graph.tasks.find((task) => task.type === "shot.image");

  assert.equal(uploadTask.status, "waiting-upload");
  assert.equal(uploadTask.input.sourceMode, "upload");
  assert.equal(graph.ready.some((task) => task.id === uploadTask.id), false);
  assert.equal(graph.blocked.some((task) => task.id === uploadTask.id), true);
});

test("task graph treats local upload video tasks as manual work", () => {
  const project = createProductionProject({
    ...productionFixture(),
    episodes: [{
      ...productionFixture().episodes[0],
      assets: [],
      shots: [{
        id: "S01",
        imageResultUrl: "s01.png",
        videoPrompt: "uploaded clip",
        videoProviderMode: "upload",
      }],
    }],
  });
  const graph = buildProductionTaskGraph(project.activeEpisode, { videoProvider: "upload" });
  const uploadTask = graph.tasks.find((task) => task.type === "shot.video");

  assert.equal(uploadTask.status, "waiting-upload");
  assert.equal(uploadTask.input.sourceMode, "upload");
  assert.equal(graph.ready.some((task) => task.id === uploadTask.id), false);
  assert.equal(graph.blocked.some((task) => task.id === uploadTask.id), true);
});

test("production use case returns state effects and audit events", () => {
  const boot = bootstrapProductionOS({ project: productionFixture(), now: 1 });
  const planned = planEpisodeProduction({ project: boot.project, events: boot.events, now: 2 });
  const summary = summarizeProductionEvents(planned.events);

  assert.equal(boot.events[0].type, "production.bootstrap");
  assert.equal(planned.effects.some((effect) => effect.type === "QUEUE_TASKS"), true);
  assert.equal(summary.byType["production.taskGraph.planned"], 1);
});

test("event log records lineage-friendly production events", () => {
  const events = appendProductionEvent([], "shot.image.completed", {
    projectId: "project-1",
    episodeId: "ep-1",
    target: { type: "shot", id: "S01" },
    provider: "mock-image",
  }, { now: 10, actor: "queue" });

  assert.equal(events[0].actor, "queue");
  assert.equal(events[0].target.id, "S01");
  assert.equal(summarizeProductionEvents(events).total, 1);
});

test("production dashboard summarizes workflow task graph and next actions", () => {
  const project = createProductionProject(productionFixture());
  const dashboard = buildProductionDashboard(project);

  assert.equal(dashboard.projectId, "project-1");
  assert.equal(dashboard.currentStage, "assetGeneration");
  assert.equal(dashboard.totals.tasks > 0, true);
  assert.equal(dashboard.taskTypes["asset.image"], 1);
  assert.equal(dashboard.costs.totals.estimatedTotalCost > 0, true);
  assert.equal(dashboard.audit.totalEvents, 0);
  assert.equal(dashboard.riskReport.items.length, 10);
  assert.equal(dashboard.nextActions[0].type, "run-task");
});

test("production risk report tracks the ten fatal product risks", () => {
  const project = createProductionProject({
    ...productionFixture(),
    episodes: [{
      ...productionFixture().episodes[0],
      assets: [{ id: "char-1", type: "character", token: "@hero", lifecycle: "draft", imageUrl: "asset://hero.png" }],
      shots: [{
        id: "S01",
        imagePrompt: "rain station first frame",
        videoPrompt: "slow push in",
        imageUrl: "asset://s01.png",
        videoUrl: "asset://s01.mp4",
      }],
      timeline: { clips: [{ id: "clip-1", shotId: "S01", mediaUrl: "asset://s01.mp4" }] },
    }],
  });
  const report = buildProductionRiskReport(project, {
    queue: [{ id: "job-1", status: "failed", title: "S01 video", error: "provider timeout" }],
    consistencyReport: { ok: false, issues: ["timeline clip missing business shot"] },
    migrationReport: { ok: false, notes: ["missing source path"] },
    deliveryManifestReport: { ok: false, issues: ["video path is not copyable"] },
    events: [],
    securityReport: { strict: false },
  });

  assert.equal(report.items.length, 10);
  assert.equal(report.ok, false);
  assert.equal(report.topRisks.some((item) => item.key === "state-authority"), true);
  assert.equal(report.items.find((item) => item.key === "provider-reliability").ok, false);
  assert.equal(report.items.find((item) => item.key === "provider-reliability").actionKind, "retryFailedQueue");
  assert.deepEqual(report.items.find((item) => item.key === "provider-reliability").targetIds, ["job-1"]);
  assert.equal(report.items.find((item) => item.key === "media-integrity").severity, "critical");
  assert.equal(report.items.find((item) => item.key === "asset-consistency").ok, false);
  assert.equal(report.items.find((item) => item.key === "asset-consistency").actionKind, "repairAssetConsistency");
  assert.equal(report.items.find((item) => item.key === "real-chain-coverage").actionKind, "runFullChainCheck");
  assert.equal(report.items.find((item) => item.key === "scope-control").actionKind, "focusMainChain");
  assert.equal(report.items.find((item) => item.key === "desktop-security").ok, false);
});
