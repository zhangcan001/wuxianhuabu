import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMediaIngestPlan,
  buildShotPatchFromMediaIngest,
} from "../src/core/ingest/media-ingest-plan.js";

test("media ingest plan creates shot image upload lineage payload", () => {
  const plan = buildMediaIngestPlan({
    projectId: "p1",
    episodeId: "ep-1",
    kind: "image",
    sourceMode: "upload",
    target: { type: "shot", id: "S01" },
    mediaUrl: "asset://s01.png",
    mediaPath: "C:/cache/s01.png",
    imageThumbnailUrl: "asset://thumb.png",
  });
  const patch = buildShotPatchFromMediaIngest(plan);

  assert.equal(plan.ok, true);
  assert.equal(plan.taskType, "shot.image");
  assert.equal(plan.eventType, "production.image.uploaded");
  assert.equal(plan.result.imageUrl, "asset://s01.png");
  assert.equal(plan.result.imagePath, "C:/cache/s01.png");
  assert.equal(patch.imageResultUrl, "C:/cache/s01.png");
  assert.equal(patch.status, "待生视频");
});

test("media ingest plan creates shot video upload lineage payload", () => {
  const plan = buildMediaIngestPlan({
    episodeId: "ep-1",
    kind: "video",
    sourceMode: "upload",
    targetType: "shot",
    targetId: "S02",
    mediaUrl: "asset://s02.mp4",
  });
  const patch = buildShotPatchFromMediaIngest(plan);

  assert.equal(plan.ok, true);
  assert.equal(plan.taskType, "shot.video");
  assert.equal(plan.eventType, "production.video.uploaded");
  assert.equal(plan.result.videoUrl, "asset://s02.mp4");
  assert.equal(patch.videoResultUrl, "asset://s02.mp4");
  assert.equal(patch.status, "已生成");
});

test("media ingest plan reports blockers for incomplete manual import", () => {
  const plan = buildMediaIngestPlan({ kind: "image" });

  assert.equal(plan.ok, false);
  assert.deepEqual(plan.blockers, ["target", "media"]);
});
