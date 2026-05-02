import test from "node:test";
import assert from "node:assert/strict";
import { planRiskFixes, executeRiskFixPlan, summarizeRiskScoreChange } from "../src/application/services/risk-fix-service.js";
import { runProviderLiveCheck } from "../src/domain/provider-live-check.js";
import { verifyDeliveryPackage } from "../src/domain/delivery-package-verify.js";
import { verifyMediaFiles, planThumbnailRebuild } from "../src/domain/media-file-check.js";
import { buildQueueFallbackPlan } from "../src/domain/queue-fallback-policy.js";
import { replayProductionEvents } from "../src/core/events/production-event-replay.js";

test("risk fix service plans and summarizes score changes", async () => {
  const report = { score: 50, topRisks: [{ key: "b", actionKind: "syncTimeline" }, { key: "a", actionKind: "repairStateAuthority" }] };
  const plan = planRiskFixes(report);
  const result = await executeRiskFixPlan(plan, { repairStateAuthority: () => "ok", syncTimeline: () => "ok" });
  const score = summarizeRiskScoreChange({ score: 50 }, { score: 70, openCount: 2 });

  assert.deepEqual(plan.map((item) => item.key), ["a", "b"]);
  assert.equal(result.ok, true);
  assert.equal(score.label, "50% -> 70% · 剩余 2 项");
});

test("provider live check handles success failure and timeout", async () => {
  const report = await runProviderLiveCheck({
    text: () => ({ ok: true, detail: "pong" }),
    image: () => { throw new Error("bad key"); },
  }, { timeoutMs: 1000 });

  assert.equal(report.ok, false);
  assert.equal(report.results[0].detail, "pong");
  assert.equal(report.failed[0].key, "image");
});

test("delivery package verifier checks manifest refs", () => {
  const result = verifyDeliveryPackage({
    manifest: { media: [{ filePath: "a.mp4" }], checksum: "x" },
    checksum: "x",
    project: {},
  }, { "a.mp4": true });

  assert.equal(result.ok, true);
  assert.equal(result.references, 1);
});

test("media file check reports missing files and thumbnail plan", async () => {
  const result = await verifyMediaFiles(["a.png", "b.png"], async (path) => path === "a.png" ? { exists: true, size: 10 } : false);
  const thumbs = planThumbnailRebuild([{ path: "a.png", kind: "image" }]);

  assert.deepEqual(result.missing, ["b.png"]);
  assert.equal(thumbs[0].targetPath, "a.thumb.jpg");
});

test("queue fallback plan maps failure causes to actions", () => {
  const plan = buildQueueFallbackPlan([{ id: "job-1", kind: "video", status: "failed", error: "quota exceeded" }]);

  assert.deepEqual(plan, [{ jobId: "job-1", reason: "quota", action: "switchToUpload" }]);
});

test("production event replay rebuilds media state", () => {
  const project = { activeEpisodeId: "e1", episodes: [{ id: "e1", shots: [{ id: "S01" }] }] };
  const next = replayProductionEvents(project, [
    { type: "shot.image.completed", episodeId: "e1", target: { id: "S01" }, payload: { imageUrl: "s01.png" } },
    { type: "shot.video.completed", episodeId: "e1", target: { id: "S01" }, payload: { videoUrl: "s01.mp4" } },
  ]);

  assert.equal(next.activeEpisode.shots[0].imageResultUrl, "s01.png");
  assert.equal(next.activeEpisode.shots[0].videoResultUrl, "s01.mp4");
});
