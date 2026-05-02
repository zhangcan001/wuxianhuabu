import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAssetImageJobs,
  buildShotImageJobs,
} from "../src/domain/image-pipeline.js";

test("asset image jobs use normalized assets and skip existing images", () => {
  const jobs = buildAssetImageJobs("asset-node", {
    characters: [
      { name: "林舟", token: "@角色_林舟", visualLock: "短发青年" },
      { name: "陈岚", token: "@角色_陈岚", imageUrl: "ready.png", visualLock: "红衣少女" },
    ],
    scenes: [{ name: "旧车站", token: "@场景_旧车站", prompt: "雨夜旧车站" }],
    props: [{ name: "旧钥匙", token: "@道具_旧钥匙" }],
  }, {
    providerMode: "comfy",
    normalizeAsset: (asset, category, sourceNodeId) => ({
      ...asset,
      name: `${category}-${asset.name}`,
      category,
      sourceNodeId,
    }),
    buildAssetPromptPayload: (asset, promptMode, options) => ({
      patch: {
        prompt: `${promptMode}:${asset.sourceNodeId}:${asset.name}:${options.autoStart}`,
      },
    }),
  });

  assert.equal(jobs.length, 3);
  assert.deepEqual(jobs.map((job) => job.sourceAssetToken), ["@角色_林舟", "@场景_旧车站", "@道具_旧钥匙"]);
  assert.equal(jobs[0].assetCategory, "角色");
  assert.equal(jobs[0].prompt, "image-comfy:asset-node:角色-林舟:false");
  assert.equal(jobs[0].imageProviderMode, "comfy");
  assert.equal(jobs[0].providerMode, "comfy");
  assert.equal(jobs[0].queueStage, "asset");
  assert.equal(jobs.every((job) => job.kind === "image"), true);
});

test("asset image jobs map custom image mode to api provider mode", () => {
  const jobs = buildAssetImageJobs("asset-node", {
    props: [{ name: "罗盘", token: "@道具_罗盘" }],
  }, {
    providerMode: "custom",
  });

  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].imageProviderMode, "custom");
  assert.equal(jobs[0].providerMode, "api");
  assert.equal(jobs[0].prompt, "罗盘");
});

test("shot image jobs resolve provider mode and video cascade state", () => {
  const resolved = [];
  const jobs = buildShotImageJobs("shot-node", [
    {
      id: "S01",
      imagePrompt: "雨夜车站远景",
      videoPrompt: "镜头缓慢推进",
      imageRuntimeModel: "sdxl",
      mainCharacterToken: "@角色_林舟",
      mainSceneToken: "@场景_旧车站",
      keyPropTokens: ["@道具_钥匙", ""],
      assetRefs: ["@角色_林舟", ""],
      referenceResources: "ref://station",
    },
    {
      id: "S02",
      imagePrompt: "",
      videoPrompt: "不会入队",
    },
    {
      id: "S03",
      imagePrompt: "钥匙特写",
      videoPrompt: "",
    },
  ], {
    settings: { imageProviderMode: "custom" },
    assets: [
      {
        token: "@角色_林舟",
        name: "林舟",
        visualLock: "红色外套，短发",
        imageUrl: "asset://linzhou.png",
      },
      {
        token: "@场景_旧车站",
        name: "旧车站",
        prompt: "潮湿站台，蓝绿色灯光",
      },
    ],
    buildImageShotPrompt: (shot) => shot.imagePrompt,
    resolveShotImageProviderMode: (shot, settings) => {
      resolved.push([shot.id, settings.imageProviderMode]);
      return shot.id === "S03" ? "mock" : "api";
    },
  });

  assert.equal(jobs.length, 2);
  assert.deepEqual(resolved, [["S01", "custom"], ["S02", "custom"], ["S03", "custom"]]);
  assert.equal(jobs[0].title, "S01-图片");
  assert.equal(jobs[0].imageProviderMode, "api");
  assert.equal(jobs[0].imageRuntimeModel, "sdxl");
  assert.deepEqual(jobs[0].keyPropTokens, ["@道具_钥匙"]);
  assert.deepEqual(jobs[0].assetRefs, ["@角色_林舟"]);
  assert.match(jobs[0].prompt, /连续性锁定/);
  assert.match(jobs[0].prompt, /红色外套/);
  assert.match(jobs[0].prompt, /asset:\/\/linzhou\.png/);
  assert.equal(jobs[0].autoCascadeVideo, true);
  assert.equal(jobs[1].shotId, "S03");
  assert.equal(jobs[1].autoCascadeVideo, false);
});

test("shot image jobs skip local-upload shots because they require manual import", () => {
  const jobs = buildShotImageJobs("shot-node", [{
    id: "S01",
    imagePrompt: "手动上传首帧",
    imageProviderMode: "upload",
  }], {
    buildImageShotPrompt: (shot) => shot.imagePrompt,
    resolveShotImageProviderMode: (shot) => shot.imageProviderMode,
  });

  assert.deepEqual(jobs, []);
});
