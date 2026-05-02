import assert from "node:assert/strict";
import test from "node:test";
import {
  applyReviewResultToEpisode,
  buildReviewGate,
  runEpisodeReview,
} from "../src/core/review/review-system.js";

function readyEpisode() {
  return {
    id: "ep-1",
    script: "第一场",
    assets: [{ id: "a1", token: "@林舟", lifecycle: "locked" }],
    shots: [
      { id: "S01", assetRefs: ["@林舟"], image: { url: "s01.png" }, video: { url: "s01.mp4" } },
    ],
    timeline: { clips: [{ id: "clip-1", shotId: "S01", mediaUrl: "s01.mp4" }] },
  };
}

test("review system approves ready episode", () => {
  const review = runEpisodeReview(readyEpisode(), {
    outputSpec: { aspectRatio: "9:16" },
    reviewer: "qa",
    reviewedAt: "2026-04-26T00:00:00.000Z",
  });

  assert.equal(review.result, "approved");
  assert.equal(review.approvedBy, "qa");
  assert.equal(review.issues.length, 0);
});

test("review system reports missing media and continuity issues", () => {
  const review = runEpisodeReview({
    id: "ep-1",
    script: "",
    assets: [{ token: "@林舟", lifecycle: "draft" }],
    shots: [{ id: "S01", assetRefs: ["@林舟", "@旧车站"] }],
    timeline: { clips: [] },
  });

  assert.equal(review.result, "changes-requested");
  assert.equal(review.issues.some((issue) => issue.code === "script-missing"), true);
  assert.equal(review.issues.some((issue) => issue.code === "asset-ref-missing"), true);
  assert.equal(review.issues.some((issue) => issue.code === "shot-video-missing"), true);
  assert.match(review.revisionPlan, /Generate or import/);
});

test("review gate and episode patch expose approval state", () => {
  const episode = readyEpisode();
  const gate = buildReviewGate(episode);
  const nextEpisode = applyReviewResultToEpisode(episode, gate.review);

  assert.equal(gate.ok, true);
  assert.equal(nextEpisode.reviews.length, 1);
  assert.equal(nextEpisode.shots[0].reviewStatus, "approved");
});
