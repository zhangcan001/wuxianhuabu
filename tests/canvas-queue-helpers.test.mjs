import assert from "node:assert/strict";
import test from "node:test";
import {
  buildQueueAssetSuccessPatch,
  buildQueueShotSuccessPatch,
  buildTimelineShotPatchFromQueue,
} from "../src/canvas-queue-helpers.js";

test("queue success patch keeps display urls and persisted media paths separately", () => {
  const patch = buildQueueShotSuccessPatch(
    { kind: "image" },
    {
      imageUrl: "asset://preview/image.png",
      imagePath: "C:/cache/image.png",
      imageThumbnailUrl: "asset://preview/thumb.png",
      imageThumbnailPath: "C:/cache/thumb.png",
    },
  );

  assert.deepEqual(patch, {
    status: "已生成",
    lastQueueResult: "C:/cache/image.png",
    imageResultUrl: "asset://preview/image.png",
    videoResultUrl: "",
    imageUrl: "asset://preview/image.png",
    videoUrl: "",
    imagePath: "C:/cache/image.png",
    videoPath: "",
    imageThumbnailUrl: "asset://preview/thumb.png",
    imageThumbnailPath: "C:/cache/thumb.png",
    resultDecision: "",
    resultDecisionAt: 0,
    reworkReason: "",
  });
});

test("asset queue success patch keeps Comfy display url separate from local path", () => {
  const patch = buildQueueAssetSuccessPatch({
    imageUrl: "http://asset.localhost/C%3A/cache/comfy.png",
    imagePath: "C:/cache/comfy.png",
    imageThumbnailUrl: "http://asset.localhost/C%3A/cache/thumb.png",
    imageThumbnailPath: "C:/cache/thumb.png",
    originalImageUrl: "http://127.0.0.1:8188/view?filename=a.png&type=output",
  });

  assert.equal(patch.imageUrl, "http://asset.localhost/C%3A/cache/comfy.png");
  assert.equal(patch.imagePath, "C:/cache/comfy.png");
  assert.equal(patch.imageThumbnailUrl, "http://asset.localhost/C%3A/cache/thumb.png");
  assert.equal(patch.imageThumbnailPath, "C:/cache/thumb.png");
  assert.equal(patch.originalImageUrl, "http://127.0.0.1:8188/view?filename=a.png&type=output");
});

test("timeline shot patch keeps local file path for downstream export", () => {
  const patch = buildTimelineShotPatchFromQueue(
    { kind: "video" },
    {
      videoUrl: "asset://preview/video.mp4",
      videoPath: "C:/cache/video.mp4",
    },
    {
      id: "S01",
      imageResultUrl: "",
      videoResultUrl: "",
      lastQueueResult: "",
    },
  );

  assert.equal(patch.lastQueueResult, "C:/cache/video.mp4");
  assert.equal(patch.videoResultUrl, "asset://preview/video.mp4");
  assert.equal(patch.videoUrl, "asset://preview/video.mp4");
  assert.equal(patch.videoPath, "C:/cache/video.mp4");
  assert.equal(patch.status, "已生成");
});
