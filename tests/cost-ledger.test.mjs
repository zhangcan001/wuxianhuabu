import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCostLedger,
  buildProductionCostSummary,
  buildTaskCostForecast,
  estimateTaskCost,
} from "../src/core/cost/cost-ledger.js";
import {
  appendProductionEvent,
} from "../src/core/events/production-events.js";

test("cost ledger estimates task costs from the production rate card", () => {
  const estimate = estimateTaskCost({
    id: "shot-video:ep-1:S01",
    type: "shot.video",
    provider: "mock-video",
  });

  assert.equal(estimate.estimatedCost, 0.8);
  assert.equal(estimate.unit, "clip");
  assert.equal(estimate.providerId, "mock-video");
});

test("cost ledger treats local uploads as zero-cost manual work", () => {
  const estimate = estimateTaskCost({
    id: "shot-image:ep-1:S01",
    type: "shot.image",
    provider: "upload",
    input: { sourceMode: "upload" },
  });

  assert.equal(estimate.estimatedCost, 0);
  assert.equal(estimate.unit, "manual");
  assert.equal(estimate.source, "manual-upload");
});

test("cost ledger summarizes completed task events", () => {
  const events = appendProductionEvent([], "production.task.completed", {
    projectId: "p1",
    episodeId: "ep-1",
    taskId: "shot-image:ep-1:S01",
    taskType: "shot.image",
    providerId: "image-provider",
    estimate: { cost: 0.06, tokens: 120 },
    result: { url: "s01.png", usage: { cost: 0.05, tokens: 118 } },
  }, { now: 1 });
  const ledger = buildCostLedger(events, { budget: 0.04 });

  assert.equal(ledger.entries.length, 1);
  assert.equal(ledger.totals.estimatedCost, 0.06);
  assert.equal(ledger.totals.actualCost, 0.05);
  assert.equal(ledger.totals.tokens, 118);
  assert.equal(ledger.totals.byProvider["image-provider"].count, 1);
  assert.equal(ledger.budget.exceeded, true);
});

test("cost summary combines actual spend with remaining forecast", () => {
  const tasks = [
    { id: "shot-image:ep-1:S01", type: "shot.image", status: "done" },
    { id: "shot-video:ep-1:S01", type: "shot.video", status: "pending" },
  ];
  const events = appendProductionEvent([], "production.task.completed", {
    taskId: "shot-image:ep-1:S01",
    taskType: "shot.image",
    providerId: "image-provider",
    estimate: { cost: 0.06 },
    cost: 0.05,
  }, { now: 1 });
  const summary = buildProductionCostSummary({ tasks, events }, { budget: 1 });

  assert.equal(summary.actual.totals.actualCost, 0.05);
  assert.equal(summary.forecast.totals.estimatedCost, 0.8);
  assert.equal(summary.totals.estimatedTotalCost, 0.85);
  assert.equal(summary.budget.usagePercent, 85);
});

test("task cost forecast supports provider-specific rate cards", () => {
  const forecast = buildTaskCostForecast([{
    id: "asset-image:ep-1:a1",
    type: "asset.image",
    provider: "premium-image",
  }], {
    providerRateCard: {
      "premium-image": {
        "asset.image": { estimatedCost: 0.12, unit: "image" },
      },
    },
  });

  assert.equal(forecast.totals.estimatedCost, 0.12);
  assert.equal(forecast.entries[0].source, "forecast");
});
