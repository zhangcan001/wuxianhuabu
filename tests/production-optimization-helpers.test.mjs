import test from "node:test";
import assert from "node:assert/strict";
import { buildMediaIntegrityRepairPlan, applyMediaIntegrityRepairPlan } from "../src/domain/media-integrity-repair.js";
import { buildProviderHealthReport } from "../src/domain/provider-health.js";
import { buildQueueOperationsBoard, classifyFailure } from "../src/domain/queue-diagnostics.js";
import { buildEnhancedDeliveryGate } from "../src/domain/delivery-gate.js";
import { createMiniProductionFixture, runMiniProductionE2E } from "../src/domain/mini-production-e2e.js";
import { normalizeProductionEvent } from "../src/core/events/production-event-schema.js";
import { resolvePrimaryStudioAction } from "../src/product/studio/primary-action.js";
import { buildSecurityConfigReport, buildDevSecurityConfig, buildReleaseSecurityConfig } from "../src/domain/security-config-policy.js";
import { buildCanvasWriteGuard } from "../src/domain/canvas-write-guard.js";
import {
  buildBatchGenerationPreview,
  buildDeliveryPreflightChecklist,
  buildGenerationTaskFingerprint,
  buildOptimizationMigrationBoard,
  buildSyncStatusReport,
  auditMediaReferenceBoundaries,
  FRONTEND_OPTIMIZATION_CHECKLIST,
  recoverInterruptedQueue,
} from "../src/domain/production-optimization-helpers.js";

test("media integrity repair fills paths and thumbnails from asset urls", () => {
  const project = {
    activeEpisodeId: "e1",
    episodes: [{ id: "e1", shots: [{ id: "S01", imageUrl: "asset://C%3A/cache/s01.png" }], assets: [], timeline: { clips: [] } }],
    activeEpisode: { id: "e1", shots: [{ id: "S01", imageUrl: "asset://C%3A/cache/s01.png" }], assets: [], timeline: { clips: [] } },
  };
  const plan = buildMediaIntegrityRepairPlan(project);
  const next = applyMediaIntegrityRepairPlan(project, plan);

  assert.equal(plan.repairCount, 1);
  assert.equal(next.activeEpisode.shots[0].imagePath, "C:/cache/s01.png");
  assert.equal(next.activeEpisode.shots[0].imageThumbnailUrl, "asset://C%3A/cache/s01.png");
});

test("provider health report flags missing required providers", () => {
  const report = buildProviderHealthReport({ customApiUrl: "https://api.example.com", customResultMode: "url" });

  assert.equal(report.ok, false);
  assert.equal(report.blockers.some((item) => item.key === "text"), true);
  assert.equal(report.blockers.some((item) => item.key === "customImage"), true);
});

test("queue diagnostics classifies failures and suggests actions", () => {
  assert.equal(classifyFailure("401 api key invalid"), "auth");
  assert.equal(classifyFailure("request timeout"), "network");
  const board = buildQueueOperationsBoard([{ id: "a", status: "failed", error: "quota exceeded", shotId: "S01" }]);

  assert.equal(board.failed, 1);
  assert.equal(board.failureReasons.quota, 1);
  assert.equal(board.suggestedAction, "switchProvider");
  assert.equal(board.failureDetails[0].label, "额度不足");
  assert.equal(board.failureDetails[0].actionLabel, "切换 Provider");
  assert.equal(board.failureDetails[0].examples[0].title, "S01");
});

test("enhanced delivery gate reports render blockers and warnings", () => {
  const gate = buildEnhancedDeliveryGate({ timeline: { clips: [{ id: "c1" }] } }, { requireSubtitles: true });

  assert.equal(gate.ok, false);
  assert.deepEqual(gate.blockers, ["clip-media:c1"]);
  assert.equal(gate.warnings.includes("subtitles"), true);
});

test("mini production e2e fixture reaches delivery gate", () => {
  const result = runMiniProductionE2E(createMiniProductionFixture());

  assert.equal(result.ok, true);
  assert.equal(result.gate.ok, true);
  assert.equal(result.episode.shots[0].mainCharacterToken, "@主角");
});

test("production events normalize schema fields", () => {
  const event = normalizeProductionEvent({ type: "task.failed", payload: { projectId: "p1", target: { type: "shot", id: "S01" } } });

  assert.equal(event.projectId, "p1");
  assert.equal(event.target.id, "S01");
  assert.equal(event.severity, "error");
  assert.equal(event.recoverable, true);
});

test("primary studio action resolves one next command", () => {
  assert.equal(resolvePrimaryStudioAction({ sourceText: "" }).key, "script");
  assert.equal(resolvePrimaryStudioAction({ sourceText: "雨夜" }).key, "text");
  assert.equal(resolvePrimaryStudioAction({ sourceText: "雨夜", textReady: true, assetReady: true, imageReady: true, videoReady: true, timelineReady: true, reviewReady: true }).key, "delivery");
});

test("security config policy separates dev and release expectations", () => {
  const release = buildReleaseSecurityConfig({ assetScope: ["$HOME/.wuxianhuabu/**"] });
  const dev = buildDevSecurityConfig({ assetScope: ["$HOME/.wuxianhuabu/**"] });

  assert.equal(buildSecurityConfigReport(release, "release").ok, true);
  assert.equal(buildSecurityConfigReport(dev, "dev").allowsLocalhost, true);
  assert.equal(buildSecurityConfigReport({ ...release, csp: "script-src 'self' 'unsafe-eval'; default-src https:" }, "release").ok, false);
});

test("canvas write guard warns production field edits outside command service", () => {
  const blocked = buildCanvasWriteGuard({ patch: { data: { shots: [] } } });
  const allowed = buildCanvasWriteGuard({ viaCommandService: true, patch: { data: { shots: [] } } });

  assert.equal(blocked.ok, false);
  assert.equal(blocked.productionFields.includes("shots"), true);
  assert.equal(allowed.ok, true);
});

test("generation fingerprint and batch preview keep batch jobs addressable", () => {
  const fp1 = buildGenerationTaskFingerprint({ kind: "image", episodeId: "e1", shotId: "S01", prompt: "雨夜", assetRefs: ["@角色_林舟"] });
  const fp2 = buildGenerationTaskFingerprint({ kind: "image", episodeId: "e1", shotId: "S01", prompt: "雨夜", assetRefs: ["@角色_林舟"] });
  const preview = buildBatchGenerationPreview({
    id: "e1",
    shots: [
      { id: "S01", imagePrompt: "雨夜", assetRefs: ["@角色_林舟"] },
      { id: "S02", imagePrompt: "", imageUrl: "asset://done.png" },
    ],
  }, { kind: "image", providerMode: "comfy" });

  assert.equal(fp1, fp2);
  assert.equal(preview.runnable, 1);
  assert.equal(preview.skipped, 1);
  assert.match(preview.rows[0].fingerprint, /^gen-/);
});

test("queue recovery and sync status report identify recoverable drift", () => {
  const recovered = recoverInterruptedQueue([
    { id: "a", status: "running", kind: "image", progress: 50 },
    { id: "b", status: "done" },
  ], { now: () => 1000 });
  const sync = buildSyncStatusReport({
    activeEpisode: {
      shots: [{ id: "S01", videoUrl: "asset://s01.mp4" }],
      timeline: { clips: [] },
    },
  }, {
    queue: [{ id: "q1", kind: "image", status: "pending" }],
  });

  assert.equal(recovered.recovered, 1);
  assert.equal(recovered.queue[0].status, "pending");
  assert.equal(recovered.queue[0].recoveryNotified, true);
  assert.equal(sync.ok, false);
  assert.equal(sync.issues.some((issue) => issue.includes("未进时间线")), true);
  assert.equal(sync.issues.some((issue) => issue.includes("缺业务地址")), true);
});

test("delivery preflight checklist reports blockers before export", () => {
  const checklist = buildDeliveryPreflightChecklist({
    activeEpisode: {
      shots: [{ id: "S01", videoPath: "C:/cache/s01.mp4", reviewStatus: "未审" }, { id: "S02" }],
      timeline: { clips: [{ id: "clip-S01", shotId: "S01", mediaUrl: "asset://s01.mp4" }] },
    },
  });

  assert.equal(checklist.ok, false);
  assert.equal(checklist.blockers.some((item) => item.includes("缺视频素材")), true);
  assert.equal(checklist.warnings.some((item) => item.includes("未通过审片")), true);
  assert.equal(checklist.totals.localPaths, 1);
});

test("optimization migration board tracks the 12 requested items", () => {
  const board = buildOptimizationMigrationBoard(FRONTEND_OPTIMIZATION_CHECKLIST.map((item) => item.key), {
    generatedAt: "2026-05-02",
  });

  assert.equal(FRONTEND_OPTIMIZATION_CHECKLIST.length, 12);
  assert.equal(board.ok, true);
  assert.equal(board.done, 12);
  assert.equal(board.pending, 0);
  assert.equal(board.next, "");
  assert.equal(board.items[0].index, 1);
});

test("media reference boundary audit catches local paths in display urls", () => {
  const report = auditMediaReferenceBoundaries({
    activeEpisode: {
      assets: [{ id: "a1", imageUrl: "C:/cache/a.png", imagePath: "asset://a.png" }],
      shots: [{ id: "S01", imageUrl: "asset://s01.png", imagePath: "C:/cache/s01.png" }],
      timeline: { clips: [{ id: "c1", mediaUrl: "asset://s01.mp4", mediaPath: "C:/cache/s01.mp4" }] },
    },
  });

  assert.equal(report.ok, false);
  assert.equal(report.issues.length, 2);
  assert.equal(report.issues[0].field, "url");
  assert.equal(report.issues[1].field, "path");
});
