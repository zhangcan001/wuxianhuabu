import assert from "node:assert/strict";
import test from "node:test";

import {
  applyResultToShotList,
  buildTimelineSourceFromShotRecord,
} from "../src/canvas-action-helpers.js";

const normalizeShotRecord = (shot, index = 0) => ({
  id: shot.id || `S${String(index + 1).padStart(2, "0")}`,
  status: shot.status || "待生图",
  imagePrompt: shot.imagePrompt || "",
  videoPrompt: shot.videoPrompt || "",
  imageResultUrl: shot.imageResultUrl || "",
  videoResultUrl: shot.videoResultUrl || "",
  imagePath: shot.imagePath || "",
  videoPath: shot.videoPath || "",
  lastQueueResult: shot.lastQueueResult || "",
  ...shot,
});

test("applyResultToShotList stores Comfy display url separately from local path", () => {
  const result = applyResultToShotList({
    currentShots: [{ id: "S01", status: "待生图", videoPrompt: "推镜" }],
    resultNodeData: {
      targetShotId: "S01",
      imageUrl: "asset://C:/cache/comfy.png",
      imagePath: "C:/cache/comfy.png",
      imageThumbnailUrl: "asset://C:/cache/thumb.png",
      imageThumbnailPath: "C:/cache/thumb.png",
      sourcePrompt: "角色站立",
    },
    normalizeShotRecord,
  });

  assert.equal(result.patchedShot.imageResultUrl, "asset://C:/cache/comfy.png");
  assert.equal(result.patchedShot.imageUrl, "asset://C:/cache/comfy.png");
  assert.equal(result.patchedShot.imagePath, "C:/cache/comfy.png");
  assert.equal(result.patchedShot.imageThumbnailUrl, "asset://C:/cache/thumb.png");
  assert.equal(result.patchedShot.lastQueueResult, "C:/cache/comfy.png");
  assert.equal(result.patchedShot.status, "待生视频");
});

test("buildTimelineSourceFromShotRecord uses display media url and keeps render path", () => {
  const source = buildTimelineSourceFromShotRecord({
    sourceNodeId: "shot-node",
    shot: {
      id: "S01",
      scene: "开场",
      imageResultUrl: "C:/cache/comfy.png",
      imageUrl: "asset://C:/cache/comfy.png",
      imagePath: "C:/cache/comfy.png",
      lastQueueResult: "C:/cache/comfy.png",
    },
    sourceNode: { data: { episodeId: "ep1" } },
    activeEpisodeId: "ep1",
    nodes: [],
    resourceIndex: { items: [] },
    pickTimelineResultUrl: () => "",
    expandResourceReferences: () => "",
  });

  assert.equal(source.mediaUrl, "asset://C:/cache/comfy.png");
  assert.equal(source.mediaPath, "C:/cache/comfy.png");
  assert.equal(source.mediaType, "image");
});
