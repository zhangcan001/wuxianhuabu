import test from "node:test";
import assert from "node:assert/strict";
import {
  applyImageResultToShot,
  applyTextPackageToEpisode,
  applyVideoResultToShot,
  buildCommercialProjectModel,
  summarizeEpisodeProductionStatus,
} from "../src/domain/commercial-project-model.js";

test("commercial project model maps nodes into business entities", () => {
  const model = buildCommercialProjectModel({
    projectId: "p1",
    projectName: "商业项目",
    activeEpisodeId: "e1",
    episodes: [{ id: "e1", name: "第一集" }],
    nodes: [
      {
        id: "novel",
        type: "novelPipeline",
        data: {
          episodeId: "e1",
          novel: "雨夜车站",
          pipeline: { script: "第一场：雨夜车站" },
        },
      },
      {
        id: "asset",
        type: "assetLibrary",
        data: {
          episodeId: "e1",
          characters: [{ name: "林舟", token: "@角色_林舟", imageUrl: "lin.png" }],
          scenes: [{ name: "旧车站", token: "@场景_旧车站" }],
          props: [{ name: "旧钥匙", token: "@道具_旧钥匙" }],
        },
      },
      {
        id: "shot",
        type: "shotList",
        data: {
          episodeId: "e1",
          shots: [
            {
              id: "S01",
              scene: "旧车站",
              imagePrompt: "雨夜旧车站",
              videoPrompt: "镜头推进",
              imageResultUrl: "s01.png",
              videoResultUrl: "s01.mp4",
              mainCharacterToken: "@角色_林舟",
              imageRuntimeModel: "sdxl",
              videoRuntimeModel: "wan",
              assetRefs: ["@角色_林舟"],
              status: "完成",
            },
          ],
        },
      },
    ],
    generationQueue: [
      { id: "job-1", kind: "image", sourceNodeId: "shot", shotId: "S01", status: "done" },
    ],
    resources: [{ id: "r1", name: "参考", token: "@资源_参考", kind: "image", episodeId: "e1" }],
  });

  assert.equal(model.id, "p1");
  assert.equal(model.name, "商业项目");
  assert.equal(model.activeEpisode.title, "第一集");
  assert.equal(model.activeEpisode.sourceText, "雨夜车站");
  assert.equal(model.activeEpisode.script, "第一场：雨夜车站");
  assert.deepEqual(model.activeEpisode.assets.map((asset) => asset.type), ["character", "scene", "prop"]);
  assert.equal(model.activeEpisode.shots[0].imageResult, "s01.png");
  assert.equal(model.activeEpisode.shots[0].videoResult, "s01.mp4");
  assert.equal(model.activeEpisode.shots[0].mainCharacterToken, "@角色_林舟");
  assert.equal(model.activeEpisode.shots[0].imageRuntimeModel, "sdxl");
  assert.equal(model.activeEpisode.shots[0].videoRuntimeModel, "wan");
  assert.equal(model.activeEpisode.tasks[0].targetId, "S01");
  assert.equal(model.activeEpisode.status.videoReady, true);
  assert.equal(model.totals.assets, 3);
});

test("commercial project model separates task episodes by source shot node", () => {
  const model = buildCommercialProjectModel({
    activeEpisodeId: "e2",
    episodes: [{ id: "e1" }, { id: "e2" }],
    nodes: [
      { id: "shot-e1", type: "shotList", data: { episodeId: "e1", shots: [{ id: "S01" }] } },
      { id: "shot-e2", type: "shotList", data: { episodeId: "e2", shots: [{ id: "S01" }] } },
    ],
    generationQueue: [
      { id: "job-1", sourceNodeId: "shot-e1", status: "pending" },
      { id: "job-2", sourceNodeId: "shot-e2", status: "failed", error: "bad" },
    ],
  });

  assert.equal(model.episodes[0].tasks.length, 1);
  assert.equal(model.episodes[1].tasks.length, 1);
  assert.equal(model.activeEpisode.status.failedTasks, 1);
});

test("commercial project model summarizes timeline and export readiness", () => {
  const model = buildCommercialProjectModel({
    activeEpisodeId: "e1",
    episodes: [{ id: "e1", name: "第一集" }],
    nodes: [
      {
        id: "novel",
        type: "novelPipeline",
        data: {
          episodeId: "e1",
          pipeline: { script: "第一场" },
        },
      },
      {
        id: "asset",
        type: "assetLibrary",
        data: {
          episodeId: "e1",
          characters: [{ name: "林舟" }],
          scenes: [{ name: "旧车站" }],
        },
      },
      {
        id: "shot",
        type: "shotList",
        data: {
          episodeId: "e1",
          shots: [
            {
              id: "S01",
              imagePrompt: "雨夜旧车站",
              videoPrompt: "镜头推进",
              imageResultUrl: "s01.png",
              videoResultUrl: "s01.mp4",
              reviewStatus: "已通过",
            },
          ],
        },
      },
    ],
    timeline: {
      byEpisode: {
        e1: {
          clips: [{ id: "clip-1", shotId: "S01", mediaUrl: "s01.mp4", approvalStatus: "已通过" }],
        },
      },
    },
  });

  assert.deepEqual(model.activeEpisode.assetCounts, { characters: 1, scenes: 1, props: 0 });
  assert.equal(model.activeEpisode.status.textReady, true);
  assert.equal(model.activeEpisode.status.timelineClips, 1);
  assert.equal(model.activeEpisode.status.timelineReady, 1);
  assert.equal(model.activeEpisode.status.exportReady, true);
});

test("text package can be applied directly to a commercial episode", () => {
  const next = applyTextPackageToEpisode({
    id: "e1",
    title: "第一集",
    sourceNodeIds: {
      asset: ["asset-node"],
      shot: ["shot-node"],
    },
  }, {
    ok: true,
    novelText: "雨夜车站",
    pipeline: { script: "剧本正文" },
    assetPatch: {
      characters: [{ name: "林舟", token: "@角色_林舟", visualLock: "黑色风衣" }],
      scenes: [{ name: "旧车站", token: "@场景_旧车站" }],
      props: [{ name: "旧钥匙", token: "@道具_旧钥匙" }],
    },
    shotPatch: {
      shots: [{ id: "S01", scene: "旧车站", imagePrompt: "雨夜", videoPrompt: "推进" }],
    },
  });

  assert.equal(next.sourceText, "雨夜车站");
  assert.equal(next.script, "剧本正文");
  assert.deepEqual(next.assetCounts, { characters: 1, scenes: 1, props: 1 });
  assert.equal(next.assets[0].sourceNodeId, "asset-node");
  assert.equal(next.shots[0].sourceNodeId, "shot-node");
  assert.equal(next.status.textReady, true);
});

test("commercial shot result helpers update media readiness", () => {
  const episode = {
    id: "e1",
    script: "剧本",
    assets: [{ type: "character" }, { type: "scene" }],
    shots: [
      {
        id: "S01",
        imagePrompt: "图片",
        videoPrompt: "视频",
      },
    ],
  };

  const withImage = applyImageResultToShot(episode, "S01", { imagePath: "s01.png" });
  assert.equal(withImage.shots[0].imageResultUrl, "s01.png");
  assert.equal(withImage.shots[0].status, "待生视频");
  assert.equal(withImage.status.imageReady, true);
  assert.equal(withImage.status.videoReady, false);

  const withVideo = applyVideoResultToShot(withImage, "S01", { videoPath: "s01.mp4" });
  assert.equal(withVideo.shots[0].videoResultUrl, "s01.mp4");
  assert.equal(withVideo.shots[0].status, "已生成");
  assert.equal(withVideo.status.videoReady, true);
});

test("commercial status summarizes readiness gates", () => {
  const status = summarizeEpisodeProductionStatus({
    script: "script",
    assets: [{ type: "character" }, { type: "scene" }],
    shots: [
      { imagePrompt: "i", videoPrompt: "v", imageResult: "i.png", videoResult: "" },
      { imagePrompt: "i2", videoPrompt: "v2", imageResult: "", videoResult: "" },
    ],
    tasks: [{ status: "pending" }, { status: "failed" }],
  });

  assert.equal(status.scriptReady, true);
  assert.equal(status.assetReady, true);
  assert.equal(status.shotReady, true);
  assert.equal(status.imageReady, false);
  assert.equal(status.runningTasks, 1);
  assert.equal(status.failedTasks, 1);
});
