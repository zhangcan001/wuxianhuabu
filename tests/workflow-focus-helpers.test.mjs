import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDashboardWorkflowFocus,
  buildWorkflowFocusContext,
  findWorkflowReviewTarget,
  formatWorkflowClipLabel,
  formatWorkflowReviewLabel,
} from "../src/workflow-focus-helpers.js";

test("findWorkflowReviewTarget prefers matching shot statuses", () => {
  const report = {
    targets: [
      { id: "t1", shotId: "S01", reviewStatus: "已通过" },
      { id: "t2", shotId: "S02", reviewStatus: "未审" },
    ],
  };

  assert.equal(findWorkflowReviewTarget(report, "未审")?.id, "t2");
  assert.equal(findWorkflowReviewTarget(report, "待修改"), null);
});

test("buildWorkflowFocusContext resolves review and timeline targets", () => {
  const summary = { shotNodeId: "shot-node-fallback" };
  const report = {
    targets: [
      { id: "review-1", nodeId: "shot-node-1", shotId: "S01", reviewStatus: "未审" },
      { id: "review-2", nodeId: "shot-node-2", shotId: "S02", reviewStatus: "待修改" },
    ],
  };
  const episodeTimeline = {
    clips: [
      { id: "clip-1", shotId: "S03", sourceNodeId: "shot-node-3", mediaUrl: "", approvalStatus: "待验收" },
      { id: "clip-2", shotId: "S04", sourceNodeId: "shot-node-4", mediaUrl: "ok.png", approvalStatus: "已通过" },
    ],
  };

  assert.deepEqual(buildWorkflowFocusContext("review", summary, report, episodeTimeline), {
    reviewTargetId: "review-1",
    shotNodeId: "shot-node-1",
    shotId: "S01",
    clipId: "",
  });
  assert.deepEqual(buildWorkflowFocusContext("timeline", summary, report, episodeTimeline), {
    reviewTargetId: "review-1",
    shotNodeId: "shot-node-3",
    shotId: "S03",
    clipId: "clip-1",
  });
  assert.deepEqual(buildWorkflowFocusContext("shot", summary, report, episodeTimeline), {
    reviewTargetId: "",
    shotNodeId: "shot-node-1",
    shotId: "S01",
    clipId: "",
  });
});

test("workflow focus labels stay readable", () => {
  const report = {
    targets: [
      { id: "review-1", shotId: "S08", reviewStatus: "待修改", title: "镜头 8" },
    ],
  };
  const timeline = {
    clips: [
      { id: "clip-8", title: "夜戏", shotId: "S08" },
    ],
  };

  assert.equal(formatWorkflowReviewLabel(report, "review-1"), "S08 · 待修改");
  assert.equal(formatWorkflowClipLabel(timeline, "clip-8"), "夜戏 · S08");
});

test("buildDashboardWorkflowFocus combines shot, review and timeline labels", () => {
  const summary = { shotNodeId: "shot-node-1" };
  const report = {
    targets: [
      { id: "review-1", nodeId: "shot-node-1", shotId: "S01", reviewStatus: "未审" },
    ],
  };
  const timeline = {
    clips: [
      { id: "clip-1", shotId: "S01", title: "开场", sourceNodeId: "shot-node-1", mediaUrl: "", approvalStatus: "待验收" },
    ],
  };

  assert.deepEqual(buildDashboardWorkflowFocus(summary, report, timeline), {
    shotLabel: "S01",
    reviewLabel: "S01 · 未审",
    timelineLabel: "开场 · S01",
    exportLabel: "开场 · S01",
  });
});
