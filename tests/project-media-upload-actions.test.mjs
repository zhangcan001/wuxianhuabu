import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAssetImageUploadAction,
  buildShotImageUploadAction,
  buildShotVideoUploadAction,
  selectUploadShotTarget,
} from "../src/app/project-media-upload-actions.js";

test("selectUploadShotTarget chooses explicit shot or first missing media target", () => {
  const entries = [
    { shot: { id: "s1", imageResultUrl: "asset://done.png" } },
    { shot: { id: "s2", imageResultUrl: "" } },
  ];

  assert.equal(selectUploadShotTarget(entries, { shotId: "s1", kind: "image" }).shot.id, "s1");
  assert.equal(selectUploadShotTarget(entries, { kind: "image" }).shot.id, "s2");
  assert.equal(selectUploadShotTarget([], { kind: "video" }), null);
});

test("buildShotImageUploadAction builds ingest result job and media payload", () => {
  const action = buildShotImageUploadAction({
    projectId: "project-1",
    episodeId: "ep-1",
    target: {
      node: { id: "node-shot" },
      shot: { id: "shot-1", imagePrompt: "prompt" },
    },
    persisted: {
      imageUrl: "asset://image.png",
      imagePath: "C:/media/image.png",
      originalImageUrl: "data:image/png;base64,abc",
      imageThumbnailUrl: "asset://thumb.png",
      imageThumbnailPath: "C:/media/thumb.png",
    },
    sourceUrl: "data:image/png;base64,abc",
  });

  assert.equal(action.job.type, "shot.image");
  assert.equal(action.job.sourceNodeId, "node-shot");
  assert.equal(action.result.imageUrl, "asset://image.png");
  assert.equal(action.media.target.id, "shot-1");
  assert.equal(action.media.sourceMode, "upload");
});

test("buildShotVideoUploadAction builds video upload payload", () => {
  const action = buildShotVideoUploadAction({
    projectId: "project-1",
    episodeId: "ep-1",
    target: {
      node: { id: "node-shot" },
      shot: { id: "shot-1", videoPrompt: "video prompt" },
    },
    persisted: {
      mediaUrl: "asset://video.mp4",
      mediaPath: "C:/media/video.mp4",
      originalMediaUrl: "C:/source/video.mp4",
    },
    sourceUrl: "C:/source/video.mp4",
  });

  assert.equal(action.job.type, "shot.video");
  assert.equal(action.job.videoProviderMode, "upload");
  assert.equal(action.result.videoUrl, "asset://video.mp4");
  assert.equal(action.media.originalVideoUrl, "C:/source/video.mp4");
});

test("buildAssetImageUploadAction carries asset identity and category", () => {
  const action = buildAssetImageUploadAction({
    projectId: "project-1",
    episodeId: "ep-1",
    asset: {
      token: "hero",
      name: "主角",
      sourceNodeId: "asset-node",
      typeLabel: "角色",
    },
    targetId: "hero",
    persisted: {
      imageUrl: "asset://hero.png",
      imagePath: "C:/media/hero.png",
      originalImageUrl: "data:image/png;base64,abc",
    },
    sourceUrl: "data:image/png;base64,abc",
  });

  assert.equal(action.job.type, "asset.image");
  assert.equal(action.job.sourceAssetToken, "hero");
  assert.equal(action.job.assetCategory, "角色");
  assert.equal(action.media.target.type, "asset");
  assert.equal(action.result.imagePath, "C:/media/hero.png");
});
