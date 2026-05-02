import assert from "node:assert/strict";
import test from "node:test";
import {
  materializeBusinessProjectCanvas,
} from "../src/domain/project-canvas-materializer.js";

function businessProject() {
  return {
    id: "project-1",
    activeEpisodeId: "ep-1",
    episodes: [{
      id: "ep-1",
      title: "第 1 集",
      sourceText: "原始小说",
      script: "分镜脚本",
      assets: [{ id: "asset-1", type: "character", name: "女主", token: "@女主", prompt: "红衣" }],
      shots: [{ id: "shot-1", title: "开场", imagePrompt: "雨夜街道", videoPrompt: "镜头推进" }],
    }],
  };
}

test("materializes canvas nodes from a business project", () => {
  const result = materializeBusinessProjectCanvas(businessProject(), [], []);
  assert.equal(result.projected, true);
  assert.deepEqual(result.nodes.map((node) => node.type), ["novelPipeline", "assetLibrary", "shotList"]);
  assert.equal(result.edges.length, 2);
  assert.equal(result.nodes[0].data.novel, "原始小说");
  assert.equal(result.nodes[2].data.shots[0].id, "shot-1");
});

test("reuses existing compatible nodes instead of duplicating them", () => {
  const existingNodes = [
    { id: "legacy-novel", type: "novelPipeline", x: 1, y: 2, width: 999, data: { episodeId: "ep-1", custom: true } },
    { id: "legacy-assets", type: "assetLibrary", x: 3, y: 4, data: { episodeId: "ep-1" } },
    { id: "legacy-shots", type: "shotList", x: 5, y: 6, data: { episodeId: "ep-1" } },
  ];
  const result = materializeBusinessProjectCanvas(businessProject(), existingNodes, []);
  assert.equal(result.nodes.length, 3);
  assert.deepEqual(result.nodes.map((node) => node.id), ["legacy-novel", "legacy-assets", "legacy-shots"]);
  assert.equal(result.nodes[0].x, 1);
  assert.equal(result.nodes[0].width, 999);
  assert.equal(result.nodes[0].data.custom, true);
  assert.equal(result.nodes[0].data.pipeline.script, "分镜脚本");
});
