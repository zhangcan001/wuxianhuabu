import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDeliveryReadinessReport,
  createDeliveryPackage,
  planDeliveryExport,
} from "../src/core/delivery/delivery-package.js";

function episodeReady() {
  return {
    id: "ep-1",
    shots: [
      { id: "S01", video: { url: "s01.mp4" } },
    ],
    timeline: {
      clips: [{ id: "clip-1", shotId: "S01", mediaUrl: "s01.mp4" }],
    },
    reviews: [{ result: "approved" }],
  };
}

test("delivery package builds manifest checksum and output spec", () => {
  const pkg = createDeliveryPackage({
    projectId: "p1",
    episodeId: "ep-1",
    outputSpec: { platform: "douyin", resolution: "1080x1920" },
    files: [{ role: "final-video", path: "final.mp4", size: 100 }],
  });

  assert.equal(pkg.platform, "douyin");
  assert.equal(pkg.manifest.fileCount, 1);
  assert.match(pkg.checksum, /^manifest-/);
  assert.equal(pkg.status, "ready");
});

test("delivery readiness reports missing videos timeline and review", () => {
  const report = buildDeliveryReadinessReport({
    id: "ep-1",
    shots: [{ id: "S01" }],
    timeline: { clips: [] },
    reviews: [],
  });

  assert.equal(report.ready, false);
  assert.deepEqual(report.blockers.map((item) => item.type), [
    "missing-videos",
    "missing-timeline-clips",
    "review-not-approved",
  ]);
});

test("delivery export planner creates render task for ready episode", () => {
  const plan = planDeliveryExport({
    id: "p1",
    productionBible: { outputSpec: { platform: "kuaishou" } },
    activeEpisode: episodeReady(),
  });

  assert.equal(plan.ok, true);
  assert.equal(plan.package.platform, "kuaishou");
  assert.equal(plan.task.type, "delivery.export");
  assert.equal(plan.task.input.manifest.fileCount, 1);
});
