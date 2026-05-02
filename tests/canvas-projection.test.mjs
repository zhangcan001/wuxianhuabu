import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEpisodeCanvasProjection,
  mergeCanvasProjection,
} from "../src/domain/canvas-projection.js";

function episode() {
  return {
    id: "e1",
    title: "第一集",
    sourceText: "雨夜车站",
    script: "第一场",
    sourceNodeIds: {
      novel: ["novel-node"],
      asset: ["asset-node"],
      shot: ["shot-node"],
    },
    assets: [
      {
        id: "a1",
        type: "character",
        name: "林舟",
        token: "@角色_林舟",
        visualLock: "黑风衣",
        imageItems: [{ imageUrl: "hero-a.png", thumbnailUrl: "hero-a-thumb.png" }],
        discardedImageKeys: ["hero-old.png"],
      },
      { id: "s1", type: "scene", name: "旧车站", token: "@场景_旧车站", prompt: "雨夜旧车站" },
      { id: "p1", type: "prop", name: "钥匙", token: "@道具_钥匙" },
    ],
    shots: [
      {
        id: "S01",
        scene: "旧车站",
        imagePrompt: "车站远景",
        videoPrompt: "镜头推进",
        imageResultUrl: "C:/cache/s01.png",
        imageUrl: "asset://C:/cache/s01.png",
        imagePath: "C:/cache/s01.png",
        imageItems: [{ imageUrl: "s01-alt.png", thumbnailUrl: "s01-alt-thumb.png" }],
        videoItems: [{ videoUrl: "s01-alt.mp4", thumbnailUrl: "s01-alt-poster.png" }],
        mainCharacterToken: "@角色_林舟",
        resultDecision: "confirm",
      },
    ],
    status: { textReady: true },
  };
}

test("canvas projection maps an episode into legacy nodes and links", () => {
  const projection = buildEpisodeCanvasProjection(episode(), { origin: { x: 10, y: 20 } });

  assert.deepEqual(projection.nodes.map((node) => node.id), ["novel-node", "asset-node", "shot-node"]);
  assert.deepEqual(projection.nodes.map((node) => node.type), ["novelPipeline", "assetLibrary", "shotList"]);
  assert.equal(projection.nodes[0].data.novel, "雨夜车站");
  assert.equal(projection.nodes[0].data.pipeline.script, "第一场");
  assert.equal(projection.nodes[1].data.characters[0].token, "@角色_林舟");
  assert.equal(projection.nodes[1].data.characters[0].imageItems[0].imageUrl, "hero-a.png");
  assert.deepEqual(projection.nodes[1].data.characters[0].discardedImageKeys, ["hero-old.png"]);
  assert.equal(projection.nodes[1].data.scenes[0].prompt, "雨夜旧车站");
  assert.equal(projection.nodes[2].data.shots[0].imageResultUrl, "asset://C:/cache/s01.png");
  assert.equal(projection.nodes[2].data.shots[0].imagePath, "C:/cache/s01.png");
  assert.equal(projection.nodes[2].data.shots[0].imageItems[0].thumbnailUrl, "s01-alt-thumb.png");
  assert.equal(projection.nodes[2].data.shots[0].videoItems[0].videoUrl, "s01-alt.mp4");
  assert.equal(projection.nodes[2].data.shots[0].resultDecision, "confirm");
  assert.deepEqual(projection.edges.map((edge) => [edge.source, edge.target]), [
    ["novel-node", "asset-node"],
    ["asset-node", "shot-node"],
  ]);
});

test("canvas projection creates stable ids when source nodes are absent", () => {
  const projection = buildEpisodeCanvasProjection({ ...episode(), sourceNodeIds: {} });

  assert.deepEqual(projection.nodes.map((node) => node.id), [
    "episode-e1-novel",
    "episode-e1-assets",
    "episode-e1-shots",
  ]);
});

test("canvas projection merge updates data while preserving existing placement", () => {
  const projection = buildEpisodeCanvasProjection(episode());
  const existingNodes = [
    {
      id: "asset-node",
      type: "assetLibrary",
      x: 999,
      y: 888,
      width: 300,
      height: 200,
      selected: true,
      data: { displayName: "旧资产库", stale: true },
    },
  ];
  const existingEdges = [{ id: "edge-old", source: "novel-node", target: "asset-node" }];
  const result = mergeCanvasProjection(existingNodes, existingEdges, projection);
  const assetNode = result.nodes.find((node) => node.id === "asset-node");

  assert.equal(assetNode.x, 999);
  assert.equal(assetNode.y, 888);
  assert.equal(assetNode.data.displayName, "第一集 · 资产库");
  assert.equal(assetNode.data.stale, true);
  assert.equal(assetNode.data.characters.length, 1);
  assert.equal(result.edges.filter((edge) => edge.source === "novel-node" && edge.target === "asset-node").length, 1);
  assert.equal(result.edges.some((edge) => edge.source === "asset-node" && edge.target === "shot-node"), true);
});
