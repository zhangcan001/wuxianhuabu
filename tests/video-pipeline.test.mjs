import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCascadedVideoJobsAfterImage,
  buildShotVideoJob,
  shouldPreferVideoForShot,
} from "../src/domain/video-pipeline.js";

test("shot prefers direct video only when image prompt is missing", () => {
  assert.equal(shouldPreferVideoForShot({ videoPrompt: "推进", imagePrompt: "" }), true);
  assert.equal(shouldPreferVideoForShot({ videoPrompt: "推进", imagePrompt: "车站远景" }), false);
  assert.equal(shouldPreferVideoForShot({ videoPrompt: "", imagePrompt: "" }), false);
});

test("shot video job preserves production metadata", () => {
  const job = buildShotVideoJob("shot-node", {
    id: "S01",
    videoPrompt: "镜头缓慢推进",
    videoRuntimeModel: "wan-video",
    videoModelPreset: "电影感",
    videoParamPreset: "建立镜头默认",
    videoAspectRatio: "16:9",
    mainCharacterToken: "@角色_林舟",
    mainSceneToken: "@场景_旧车站",
    keyPropTokens: ["@道具_钥匙", ""],
    assetRefs: ["@角色_林舟", ""],
    referenceResources: "ref://station",
  }, {
    buildVideoShotPrompt: (shot) => `${shot.videoPrompt} / enhanced`,
  });

  assert.equal(job.sourceNodeId, "shot-node");
  assert.equal(job.shotId, "S01");
  assert.equal(job.kind, "video");
  assert.equal(job.prompt, "镜头缓慢推进 / enhanced");
  assert.equal(job.videoProviderMode, "mock");
  assert.equal(job.providerMode, "mock");
  assert.equal(job.videoRuntimeModel, "wan-video");
  assert.equal(job.videoAspectRatio, "16:9");
  assert.deepEqual(job.keyPropTokens, ["@道具_钥匙"]);
  assert.deepEqual(job.assetRefs, ["@角色_林舟"]);
  assert.equal(job.offsetX, 1480);
});

test("shot video job is null without a prompt", () => {
  assert.equal(buildShotVideoJob("shot-node", { id: "S02", videoPrompt: "" }), null);
});

test("shot video job skips local upload shots because they require manual import", () => {
  const job = buildShotVideoJob("shot-node", {
    id: "S03",
    videoPrompt: "上传成片",
    videoProviderMode: "upload",
  }, {
    resolveShotVideoProviderMode: (shot) => shot.videoProviderMode,
  });

  assert.equal(job, null);
});

test("cascaded video job is created once after an image job", () => {
  const imageJob = {
    id: "image-job",
    kind: "image",
    sourceNodeId: "shot-node",
    shotId: "S01",
    title: "S01-图片",
    prompt: "车站远景",
    videoPrompt: "镜头推进",
    autoCascadeVideo: true,
  };

  const jobs = buildCascadedVideoJobsAfterImage(imageJob, [], {
    shortTitle: () => "短标题",
  });

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, undefined);
  assert.equal(jobs[0].kind, "video");
  assert.equal(jobs[0].title, "S01-视频");
  assert.equal(jobs[0].prompt, "镜头推进");
  assert.equal(jobs[0].videoProviderMode, "");
  assert.equal(jobs[0].offsetX, 1480);
  assert.equal(jobs[0].autoCascadeVideo, false);

  const duplicate = buildCascadedVideoJobsAfterImage(imageJob, [
    { kind: "video", sourceNodeId: "shot-node", shotId: "S01", status: "pending" },
  ]);
  assert.deepEqual(duplicate, []);
});

test("cascaded video job skips manual upload mode", () => {
  assert.deepEqual(buildCascadedVideoJobsAfterImage({
    kind: "image",
    videoPrompt: "x",
    autoCascadeVideo: true,
    videoProviderMode: "upload",
  }), []);
});

test("cascaded video job ignores non image or disabled cascade tasks", () => {
  assert.deepEqual(buildCascadedVideoJobsAfterImage({ kind: "video", videoPrompt: "x", autoCascadeVideo: true }), []);
  assert.deepEqual(buildCascadedVideoJobsAfterImage({ kind: "image", videoPrompt: "x", autoCascadeVideo: false }), []);
  assert.deepEqual(buildCascadedVideoJobsAfterImage({ kind: "image", videoPrompt: " ", autoCascadeVideo: true }), []);
});
