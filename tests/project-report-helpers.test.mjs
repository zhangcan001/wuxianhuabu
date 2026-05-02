import assert from "node:assert/strict";
import test from "node:test";
import {
  buildArchiveReportFromState,
  compareQueueJobs,
  makeFixableHealthFinding,
  makeHealthFinding,
  queueKindLabel,
  queuePriorityRank,
  queueStatusLabel,
  summarizeEpisodeTotals,
  summarizeQueue,
} from "../src/project-report-helpers.js";

test("queue labels and priority ranks are stable", () => {
  assert.equal(queueStatusLabel("pending"), "等待中");
  assert.equal(queueStatusLabel("unknown"), "unknown");
  assert.equal(queueKindLabel("exportVideo"), "导出");
  assert.equal(queueKindLabel("custom"), "custom");
  assert.equal(queuePriorityRank("高"), 0);
  assert.equal(queuePriorityRank("中"), 1);
  assert.equal(queuePriorityRank("低"), 2);
  assert.equal(queuePriorityRank("其它"), 1);
});

test("compareQueueJobs sorts by priority then creation time", () => {
  const jobs = [
    { id: "old-low", priority: "低", createdAt: 1 },
    { id: "new-high", priority: "高", createdAt: 10 },
    { id: "old-high", priority: "高", createdAt: 2 },
  ].sort(compareQueueJobs);

  assert.deepEqual(jobs.map((job) => job.id), ["old-high", "new-high", "old-low"]);
});

test("summarizeQueue counts known and custom statuses", () => {
  assert.deepEqual(summarizeQueue([
    { status: "pending" },
    { status: "running" },
    { status: "failed" },
    { status: "failed" },
    { status: "paused" },
  ]), {
    total: 5,
    pending: 1,
    running: 1,
    done: 0,
    failed: 2,
    paused: 1,
  });
});

test("summarizeEpisodeTotals aggregates missing fields as zero", () => {
  const totals = summarizeEpisodeTotals([
    { nodes: 2, shots: 4, completedShots: 1, characters: 2, failedExports: 1 },
    { nodes: 3, edges: 2, shots: 1, scenes: 5, timelineBackfillPending: 2 },
  ]);

  assert.equal(totals.nodes, 5);
  assert.equal(totals.edges, 2);
  assert.equal(totals.shots, 5);
  assert.equal(totals.completedShots, 1);
  assert.equal(totals.characters, 2);
  assert.equal(totals.scenes, 5);
  assert.equal(totals.timelineBackfillPending, 2);
  assert.equal(totals.failedExports, 1);
});

test("health finding helpers include episode metadata and fixes", () => {
  const episode = { id: "ep1", name: "第 1 集" };
  assert.deepEqual(makeHealthFinding("警告", "资产", "缺少场景", episode, "node1", "detail"), {
    level: "警告",
    category: "资产",
    text: "缺少场景",
    detail: "detail",
    nodeId: "node1",
    episodeId: "ep1",
    episodeName: "第 1 集",
  });
  assert.deepEqual(makeFixableHealthFinding("严重", "镜头", "缺提示词", null, "", "", { kind: "fix" }).fix, { kind: "fix" });
});

test("archive report filters current episode and marks milestones", () => {
  const report = buildArchiveReportFromState({
    deliveryNote: "交付说明",
    milestoneIds: ["s1"],
    snapshots: [
      { id: "s1", episodeId: "ep1", label: "交付版", stage: "导出", createdAt: 3, summary: "ok", metrics: { shots: 3 } },
      { id: "s2", episodeId: "ep2", label: "别集", stage: "草稿", createdAt: 2 },
      { id: "global", episodeId: "", label: "全局", stage: "归档", createdAt: 1 },
    ],
  }, [{ id: "ep1", name: "第 1 集" }], "ep1");

  assert.equal(report.episodeName, "第 1 集");
  assert.equal(report.summary.snapshots, 2);
  assert.equal(report.summary.milestones, 1);
  assert.equal(report.summary.deliveryReady, true);
  assert.deepEqual(report.snapshots.map((item) => [item.id, item.isMilestone]), [["s1", true], ["global", false]]);
  assert.equal(report.blockers.every((item) => item.ready), true);
});
