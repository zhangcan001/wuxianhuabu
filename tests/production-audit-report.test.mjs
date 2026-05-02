import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProductionAuditReport,
  buildTargetLineage,
} from "../src/core/events/production-audit-report.js";
import {
  appendProductionEvent,
} from "../src/core/events/production-events.js";

test("production audit report summarizes milestones failures and target lineage", () => {
  const events = appendProductionEvent(
    appendProductionEvent([], "production.task.completed", {
      projectId: "p1",
      episodeId: "ep-1",
      taskId: "shot-image:ep-1:S01",
      taskType: "shot.image",
      providerId: "image-provider",
      target: { type: "shot", id: "S01" },
    }, { now: 1, target: { type: "shot", id: "S01" } }),
    "production.task.failed",
    {
      projectId: "p1",
      episodeId: "ep-1",
      taskId: "shot-video:ep-1:S01",
      taskType: "shot.video",
      providerId: "video-provider",
      target: { type: "shot", id: "S01" },
      error: "timeout",
    },
    { now: 2, target: { type: "shot", id: "S01" } },
  );
  const report = buildProductionAuditReport(events);

  assert.equal(report.projectId, "p1");
  assert.equal(report.totalEvents, 2);
  assert.equal(report.latestFailure.payload.error, "timeout");
  assert.equal(report.lineage["shot:S01"].eventCount, 2);
  assert.deepEqual(report.lineage["shot:S01"].providers, ["image-provider", "video-provider"]);
  assert.equal(report.health.ok, false);
  assert.equal(report.health.failedTargets, 1);
});

test("target lineage returns ordered compact production history", () => {
  const events = appendProductionEvent([], "production.task.completed", {
    taskId: "asset-image:ep-1:a1",
    providerId: "image-provider",
    target: { type: "asset", id: "a1" },
  }, { now: 1, actor: "queue", target: { type: "asset", id: "a1" } });
  const lineage = buildTargetLineage(events, { type: "asset", id: "a1" });

  assert.equal(lineage.length, 1);
  assert.equal(lineage[0].actor, "queue");
  assert.equal(lineage[0].providerId, "image-provider");
  assert.equal(lineage[0].status, "ok");
});
