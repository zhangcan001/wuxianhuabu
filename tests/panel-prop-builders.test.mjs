import test from "node:test";
import assert from "node:assert/strict";
import {
  buildProjectStudioProps,
} from "../src/app/panel-prop-builders.js";

test("buildProjectStudioProps maps main app state to studio props", () => {
  const actions = { run: () => {} };
  const props = buildProjectStudioProps({
    commercialProject: { id: "p1" },
    productionDashboard: { progress: 50 },
    exportHistory: [{ id: "e1" }],
    projectConsistencyReport: { ok: true },
    projectMigrationReport: { migrated: true },
    deliveryManifestReport: { ready: true },
    multiEpisodeDeliverySummary: { total: 2 },
    mediaCacheReport: { files: 3 },
    desktopUploadChecklist: { ok: true },
    providerHealthReport: { ok: true },
    queueOperationsBoard: { failed: 0 },
    enhancedDeliveryGate: { ok: true },
    productionState: { taskStore: { tasks: [] } },
    resourceIndex: { items: [] },
    generationQueue: [{ id: "job-1" }],
    queueRunning: true,
    projectMessage: "message",
    studioViewRequest: { view: "assets" },
    projectStudioActions: actions,
  });

  assert.equal(props.businessModel.id, "p1");
  assert.equal(props.productionTaskStore.tasks.length, 0);
  assert.equal(props.queue.length, 1);
  assert.equal(props.queueRunning, true);
  assert.equal(props.actions, actions);
  assert.equal(props.activeViewRequest.view, "assets");
});
