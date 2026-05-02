import assert from "node:assert/strict";
import test from "node:test";
import {
  buildExportDeliverableResult,
  buildFailedExportRetrySummary,
  buildMissingMediaBatchSummary,
  buildTimelineBackfillBatchSummary,
  buildTimelineClosureSummary,
  runBatchTimelineApprovals,
  runBatchTimelineRepairs,
  summarizeTimelineApprovalBatch,
  summarizeTimelineRepairBatch,
} from "../src/delivery-workflow-helpers.js";

test("runBatchTimelineApprovals processes clips in order", async () => {
  const progress = [];
  const results = await runBatchTimelineApprovals([
    { id: "clip-1", title: "开场" },
    { id: "clip-2", title: "夜戏" },
  ], {
    onProgress: ({ index, total, clip }) => progress.push(`${index + 1}/${total}:${clip.id}`),
    runApproval: async (clip) => ({ clipId: clip.id, title: clip.title, approvalStatus: clip.id === "clip-1" ? "已通过" : "退回修改", backfill: { synced: 1 } }),
  });

  assert.deepEqual(progress, ["1/2:clip-1", "2/2:clip-2"]);
  assert.equal(results.length, 2);
});

test("timeline approval and repair summaries stay readable", () => {
  const approval = summarizeTimelineApprovalBatch([
    { clipId: "clip-1", title: "开场", shotId: "S01", approvalStatus: "已通过", backfill: { synced: 1 } },
    { clipId: "clip-2", title: "夜戏", shotId: "S02", approvalStatus: "退回修改", backfill: { synced: 2 } },
  ]);
  const repair = summarizeTimelineRepairBatch([
    { clipId: "clip-1", title: "开场", actions: ["media", "shot"], queued: 0, shot: 1, backfill: 2 },
    { clipId: "clip-2", title: "夜戏", actions: [], queued: 1, shot: 0, backfill: { synced: 1 } },
  ]);

  assert.deepEqual(approval, {
    reviewed: 2,
    passed: 1,
    rejected: 1,
    backfilled: 3,
    clips: ["开场 · S01(已通过)", "夜戏 · S02(退回修改)"],
  });
  assert.deepEqual(repair, {
    repaired: 2,
    queued: 1,
    shot: 1,
    backfilled: 3,
    clips: ["开场(media/shot)", "夜戏(无动作)"],
  });
});

test("timeline closure helpers derive labels and counts from clip state", async () => {
  const repairs = await runBatchTimelineRepairs([
    { id: "clip-1" },
    { id: "clip-2" },
  ], {
    runRepair: async (clip) => ({ clipId: clip.id, title: clip.id, actions: ["media"] }),
  });
  const backfill = buildTimelineBackfillBatchSummary([
    { id: "clip-1", title: "开场", shotId: "S01" },
    { id: "clip-2", title: "夜戏" },
  ], {
    synced: 1,
    skipped: 1,
    missingLink: 0,
    syncedClipIds: ["clip-1"],
  });
  const closure = buildTimelineClosureSummary({
    imported: 2,
    importedSources: [{ shotId: "S01" }, { shotId: "S02" }],
    episodeTimeline: { clips: [{ id: "clip-1", title: "开场", shotId: "S01" }, { id: "clip-2", title: "夜戏" }] },
    prepare: { processed: 2, synced: 2, queued: 1, blocked: 0, remaining: { media: 1 } },
    backfill,
  });

  assert.equal(repairs.length, 2);
  assert.deepEqual(backfill.clips, ["开场 · S01"]);
  assert.deepEqual(closure, {
    imported: 2,
    processed: 2,
    synced: 2,
    backfilled: 1,
    backfillSkipped: 1,
    backfillMissingLink: 0,
    queued: 1,
    blocked: 0,
    remaining: { media: 1 },
    importedShots: ["S01", "S02"],
    processedClips: ["开场 · S01", "夜戏"],
  });
});

test("export retry and deliverable summaries keep response payload compact", () => {
  assert.deepEqual(buildMissingMediaBatchSummary([
    { id: "clip-1", title: "开场", shotId: "S01" },
  ], 1), {
    queued: 1,
    clips: ["开场 · S01"],
  });

  assert.deepEqual(buildFailedExportRetrySummary([{ id: "job-1" }, { id: "job-2" }], "第一集"), {
    retried: 2,
    target: "第一集",
  });

  assert.deepEqual(buildExportDeliverableResult({
    pipelineResult: { imported: 2 },
    approvalResult: { reviewed: 3, passed: 2, rejected: 1 },
    exportReady: true,
    queuedRenders: 3,
    queuedRenderLabels: ["横版 MP4", "竖版 MP4"],
  }), {
    imported: 2,
    reviewedApprovals: 3,
    passedApprovals: 2,
    rejectedApprovals: 1,
    queuedRenders: 3,
    exportReady: true,
    queuedRenderLabels: ["横版 MP4", "竖版 MP4"],
  });
});
