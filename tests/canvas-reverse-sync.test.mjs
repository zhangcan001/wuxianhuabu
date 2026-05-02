import test from "node:test";
import assert from "node:assert/strict";
import {
  applyCanvasNodeToEpisode,
  applyCanvasNodeToProject,
} from "../src/domain/canvas-reverse-sync.js";
import {
  createCommercialProject,
} from "../src/domain/project-model.js";

test("canvas reverse sync applies novel node data to episode", () => {
  const episode = applyCanvasNodeToEpisode({ id: "e1", title: "第一集" }, {
    id: "novel-node",
    type: "novelPipeline",
    data: {
      episodeId: "e1",
      novel: "雨夜车站",
      pipeline: { script: "第一场" },
    },
  });

  assert.equal(episode.sourceText, "雨夜车站");
  assert.equal(episode.script, "第一场");
  assert.deepEqual(episode.sourceNodeIds.novel, ["novel-node"]);
});

test("canvas reverse sync applies asset library data to episode", () => {
  const episode = applyCanvasNodeToEpisode({ id: "e1", title: "第一集" }, {
    id: "asset-node",
    type: "assetLibrary",
      data: {
        episodeId: "e1",
      characters: [{
        name: "林舟",
        token: "@角色_林舟",
        visualLock: "黑风衣",
        imageUrl: "hero-a.png",
        imageItems: [{ imageUrl: "hero-b.png", thumbnailUrl: "hero-b-thumb.png" }],
        discardedImageKeys: ["hero-old.png"],
      }],
      scenes: [{ name: "旧车站", token: "@场景_旧车站", imageUrl: "station.png" }],
      props: [{ name: "钥匙", token: "@道具_钥匙" }],
    },
  });

  assert.deepEqual(episode.assets.map((asset) => asset.type), ["character", "scene", "prop"]);
  assert.equal(episode.assets[0].sourceNodeId, "asset-node");
  assert.equal(episode.assets[0].imageItems.length, 2);
  assert.equal(episode.assets[0].imageItems[0].imageUrl, "hero-b.png");
  assert.equal(episode.assets[0].imageItems[1].primary, true);
  assert.deepEqual(episode.assets[0].discardedImageKeys, ["hero-old.png"]);
  assert.equal(episode.assets[1].image, "station.png");
  assert.deepEqual(episode.sourceNodeIds.asset, ["asset-node"]);
});

test("canvas reverse sync applies shot list data to project", () => {
  const project = createCommercialProject({
    activeEpisodeId: "e1",
    episodes: [{ id: "e1", title: "第一集" }],
  });
  const next = applyCanvasNodeToProject(project, {
    id: "shot-node",
    type: "shotList",
    data: {
      episodeId: "e1",
      shots: [{
        id: "S01",
        scene: "旧车站",
        imagePrompt: "车站远景",
        videoPrompt: "镜头推进",
        imageResultUrl: "s01.png",
        imageThumbnailUrl: "s01-thumb.png",
        imageItems: [{ imageUrl: "s01-alt.png", thumbnailUrl: "s01-alt-thumb.png" }],
        videoItems: [{ videoUrl: "s01-alt.mp4", thumbnailUrl: "s01-alt-poster.png" }],
        mainCharacterToken: "@角色_林舟",
        resultDecision: "confirm",
        resultDecisionAt: 123,
      }],
    },
  });

  assert.equal(next.activeEpisode.shots.length, 1);
  assert.equal(next.activeEpisode.shots[0].imageResultUrl, "s01.png");
  assert.equal(next.activeEpisode.shots[0].imageThumbnailUrl, "s01-thumb.png");
  assert.equal(next.activeEpisode.shots[0].imageItems.length, 2);
  assert.equal(next.activeEpisode.shots[0].videoItems[0].videoUrl, "s01-alt.mp4");
  assert.equal(next.activeEpisode.shots[0].resultDecision, "confirm");
  assert.equal(next.activeEpisode.shots[0].resultDecisionAt, 123);
  assert.equal(next.activeEpisode.shots[0].sourceNodeId, "shot-node");
  assert.equal(next.activeEpisode.status.imageReady, true);
});
