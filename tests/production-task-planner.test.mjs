import assert from "node:assert/strict";
import test from "node:test";
import {
  planImageQueueJobsFromProductionService,
  planVideoQueueJobsFromProductionService,
} from "../src/app/production-task-planner.js";

function service() {
  return {
    planImageTasks(input = {}) {
      return {
        events: [...(input.events || []), { type: "image.planned" }],
        tasks: [{ type: "shot.image", episodeId: "e1", targetType: "shot", targetId: "S01", prompt: "首帧" }],
      };
    },
    planVideoTasks(input = {}) {
      return {
        events: [...(input.events || []), { type: "video.planned" }],
        tasks: [{ type: "shot.video", episodeId: "e1", targetType: "shot", targetId: "S01", prompt: "推进" }],
      };
    },
  };
}

test("production task planner converts image tasks to legacy queue jobs at the boundary", () => {
  const plan = planImageQueueJobsFromProductionService({
    productionAppService: service(),
    providerMode: "api",
    events: [{ type: "before" }],
  });

  assert.equal(plan.jobs.length, 1);
  assert.equal(plan.jobs[0].kind, "image");
  assert.equal(plan.jobs[0].imageProviderMode, "api");
  assert.equal(plan.events.length, 2);
});

test("production task planner converts video tasks to legacy queue jobs at the boundary", () => {
  const plan = planVideoQueueJobsFromProductionService({
    productionAppService: service(),
    providerMode: "comfy",
  });

  assert.equal(plan.jobs.length, 1);
  assert.equal(plan.jobs[0].kind, "video");
  assert.equal(plan.jobs[0].videoProviderMode, "comfy");
});
