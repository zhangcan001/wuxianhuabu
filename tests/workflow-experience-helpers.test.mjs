import assert from "node:assert/strict";
import test from "node:test";
import { buildWorkflowNavigator } from "../src/workflow-experience-helpers.js";

test("workflow navigator identifies the first incomplete stage", () => {
  const navigator = buildWorkflowNavigator({
    scripts: 1,
    characters: 2,
    scenes: 1,
    shots: 4,
    promptReady: 2,
  });

  assert.equal(navigator.nextStage.key, "shot");
  assert.equal(navigator.progress, 33);
  assert.equal(navigator.blockers[0].label, "缺提示词 2 条");
});

test("workflow navigator reaches export-ready state", () => {
  const navigator = buildWorkflowNavigator({
    scripts: 1,
    characters: 1,
    scenes: 1,
    shots: 2,
    promptReady: 2,
    pendingReview: 0,
    autoFixPending: 0,
    refreshPlanPending: 0,
    timelineClips: 2,
    timelineReady: 2,
    exportReady: true,
    failedExports: 0,
  });

  assert.equal(navigator.readyToExport, true);
  assert.equal(navigator.doneCount, 6);
  assert.equal(navigator.progress, 100);
});
