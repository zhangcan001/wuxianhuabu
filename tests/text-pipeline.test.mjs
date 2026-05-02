import test from "node:test";
import assert from "node:assert/strict";
import {
  applyTextProductionPackageToNodes,
  buildTextProductionMetrics,
  createTextProductionPackage,
} from "../src/domain/text-pipeline.js";

function fakeBuildNovelPipeline(novelText, template) {
  return {
    script: `剧本：${novelText}`,
    templateUsed: template,
    characterAssets: [{ name: "阿明", token: "@角色_阿明" }],
    sceneAssets: [{ name: "旧车站", token: "@场景_旧车站" }],
    propAssets: [{ name: "旧钥匙", token: "@道具_旧钥匙" }],
    shots: [
      { id: "S01", imagePrompt: "雨夜旧车站", videoPrompt: "阿明推门" },
      { id: "S02", imagePrompt: "钥匙特写", videoPrompt: "钥匙发光" },
    ],
  };
}

function fakeBuildPipelineSyncPayloads(pipeline) {
  return {
    assetPatch: {
      characters: pipeline.characterAssets,
      scenes: pipeline.sceneAssets,
      props: pipeline.propAssets,
      displayName: "资产库",
    },
    shotPatch: {
      shots: pipeline.shots,
      displayName: "镜头表",
    },
    hasAssets: true,
    hasShots: true,
  };
}

test("text production package rejects empty novel text", () => {
  const result = createTextProductionPackage({ novelText: "  " }, {
    buildNovelPipeline: fakeBuildNovelPipeline,
    buildPipelineSyncPayloads: fakeBuildPipelineSyncPayloads,
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /请先粘贴/);
});

test("text production package builds pipeline assets and shots", () => {
  const result = createTextProductionPackage({ novelText: "雨夜旧车站" }, {
    buildNovelPipeline: fakeBuildNovelPipeline,
    buildPipelineSyncPayloads: fakeBuildPipelineSyncPayloads,
    buildProjectName: (mode, text) => `${mode}-${text}`,
    template: "模板A",
    taskMode: "漫剧",
    note: "新手流程",
  });

  assert.equal(result.ok, true);
  assert.equal(result.pipeline.projectName, "漫剧-雨夜旧车站");
  assert.equal(result.pipeline.note, "新手流程");
  assert.equal(result.assetPatch.characters.length, 1);
  assert.equal(result.assetPatch.scenes.length, 1);
  assert.equal(result.assetPatch.props.length, 1);
  assert.equal(result.shotPatch.shots.length, 2);
  assert.deepEqual(result.metrics.map((item) => item.value), [1, 1, 1, 2]);
});

test("default local text builder creates assets and prompted shots", () => {
  const result = createTextProductionPackage({
    novelText: "林舟走进废弃车站，拿起一枚旧钥匙。雨声里，陈岚低声说：“别回头。”",
  }, {
    buildProjectName: (mode) => `${mode}-默认实现`,
    taskMode: "漫剧",
    template: "商业级漫剧视觉风格",
  });

  assert.equal(result.ok, true);
  assert.equal(result.assetPatch.characters.length >= 1, true);
  assert.equal(result.assetPatch.scenes.length >= 1, true);
  assert.equal(result.assetPatch.props.length >= 1, true);
  assert.equal(result.shotPatch.shots.length >= 1, true);
  assert.equal(result.shotPatch.shots.every((shot) => shot.imagePrompt && shot.videoPrompt), true);
  assert.match(result.pipeline.finalPrompts, /镜头提示词/);
});

test("text production metrics tolerate missing arrays", () => {
  assert.deepEqual(buildTextProductionMetrics({}, {}).map((item) => item.value), [0, 0, 0, 0]);
});

test("text production package applies only to target nodes", () => {
  const packageResult = createTextProductionPackage({ novelText: "雨夜旧车站" }, {
    buildNovelPipeline: fakeBuildNovelPipeline,
    buildPipelineSyncPayloads: fakeBuildPipelineSyncPayloads,
  });
  const nodes = [
    { id: "novel", type: "novelPipeline", data: { episodeId: "e" } },
    { id: "asset", type: "assetLibrary", data: { episodeId: "e" } },
    { id: "shot", type: "shotList", data: { episodeId: "e" } },
    { id: "other", type: "text", data: { text: "keep" } },
  ];

  const next = applyTextProductionPackageToNodes(nodes, packageResult, {
    novelNodeId: "novel",
    assetNodeId: "asset",
    shotNodeId: "shot",
  });

  assert.equal(next.find((node) => node.id === "novel").data.novel, "雨夜旧车站");
  assert.equal(next.find((node) => node.id === "novel").data.pipeline.script, "剧本：雨夜旧车站");
  assert.equal(next.find((node) => node.id === "asset").data.characters.length, 1);
  assert.equal(next.find((node) => node.id === "shot").data.shots.length, 2);
  assert.equal(next.find((node) => node.id === "other").data.text, "keep");
});
