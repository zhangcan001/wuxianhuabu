import assert from "node:assert/strict";
import test from "node:test";
import {
  commitPlannedQueueJobs,
  createProductionCommandContext,
} from "../src/app/production-commands.js";

test("production command context fills safe no-op ports", () => {
  const context = createProductionCommandContext({ commercialProject: { id: "p1" } });

  assert.equal(context.commercialProject.id, "p1");
  assert.doesNotThrow(() => context.setProjectMessage("ok"));
});

test("commit planned queue jobs updates events queue and message", () => {
  const calls = [];
  const context = createProductionCommandContext({
    productionEvents: [{ type: "before" }],
    setProductionEvents: (events) => calls.push(["events", events.length]),
    addGenerationJobs: (jobs, options) => calls.push(["jobs", jobs.length, options.autoRun]),
    setProjectMessage: (message) => calls.push(["message", message]),
  });
  const result = commitPlannedQueueJobs(context, {
    events: [{ type: "after" }],
    jobs: [{ id: "j1" }],
  }, {
    autoRun: true,
    message: "任务已入队",
  });

  assert.equal(result.ok, true);
  assert.equal(result.jobCount, 1);
  assert.deepEqual(calls, [
    ["events", 1],
    ["jobs", 1, true],
    ["message", "任务已入队"],
  ]);
});
