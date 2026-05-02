import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAssetsStoryboardExportFileName,
  buildAssetsStoryboardExportPackage,
  exportAssetsAndStoryboardAction,
  stringifyAssetsStoryboardExportPackage,
} from "../src/app/project-production-export.js";

test("buildAssetsStoryboardExportPackage exports linked assets and storyboard shots", () => {
  const pkg = buildAssetsStoryboardExportPackage({
    exportedAt: "2026-04-28T00:00:00.000Z",
    project: {
      id: "p1",
      name: "测试项目",
      activeEpisode: {
        id: "ep1",
        name: "第一集",
        assets: [
          {
            id: "a1",
            type: "character",
            token: "@角色_林舟",
            name: "林舟",
            imageUrl: "asset://lin.png",
            visualLock: ["红外套"],
            promptOutput: {
              nano_gemini: "完整资产提示词 nano",
              open_model: "完整资产提示词 open",
              chatgpt_image2: "Subject: 林舟",
            },
          },
          { id: "s1", type: "scene", token: "@场景_车站", name: "车站" },
        ],
        shots: [
          {
            id: "S01",
            sceneId: "EP01_SC01",
            title: "开场",
            mainCharacterToken: "@角色_林舟",
            mainSceneToken: "@场景_车站",
            imagePrompt: "使用角色资产",
            videoPrompt: "openingFrame -> action -> closingFrame",
            mainPrompt: "镜头合同完整提示词",
            openingFrame: "开场帧",
            closingFrame: "收尾帧",
          },
        ],
      },
    },
    timeline: { clips: [{ id: "clip1", shotId: "S01", mediaUrl: "asset://s01.mp4" }] },
  });

  assert.equal(pkg.assetRegistry.assets.length, 2);
  assert.deepEqual(pkg.assetRegistry.assetIndex.characters, ["@角色_林舟"]);
  assert.equal(pkg.storyboardPackage.shots[0].assetRefs.characters[0], "@角色_林舟");
  assert.equal(pkg.storyboardPackage.shots[0].assetRefs.scenes[0], "@场景_车站");
  assert.equal(pkg.assetRegistry.assets[0].prompts.nano_gemini, "完整资产提示词 nano");
  assert.equal(pkg.storyboardPackage.shots[0].prompts.mainPrompt, "镜头合同完整提示词");
  assert.match(pkg.markdown, /完整资产提示词 nano/);
  assert.match(pkg.markdown, /openingFrame -> action -> closingFrame/);
  assert.equal(pkg.storyboardPackage.shots[0].timelineClip.id, "clip1");
  assert.match(pkg.markdown, /资产与分镜导出/);
});

test("stringifyAssetsStoryboardExportPackage returns readable json", () => {
  const text = stringifyAssetsStoryboardExportPackage({
    project: { activeEpisode: { assets: [], shots: [] } },
  });
  assert.match(text, /wuxianhuabu\.assets_storyboard_export/);
  assert.doesNotThrow(() => JSON.parse(text));
});

test("buildAssetsStoryboardExportFileName uses safe episode title", () => {
  const fileName = buildAssetsStoryboardExportFileName({ name: "第一集:开场" }, (value) => value.replaceAll(":", "-"));
  assert.equal(fileName, "第一集-开场-assets-storyboard.json");
});

test("exportAssetsAndStoryboardAction saves package and opens delivery", async () => {
  const calls = [];
  const result = await exportAssetsAndStoryboardAction({
    commercialProject: {
      id: "p1",
      activeEpisode: {
        id: "ep1",
        name: "第一集",
        assets: [{ id: "a1", type: "character", token: "@角色_A" }],
        shots: [{ id: "S01", imagePrompt: "p", videoPrompt: "v" }],
      },
    },
    timeline: { byEpisodeId: { ep1: { clips: [] } } },
    getEpisodeTimeline: (state, episodeId) => state.byEpisodeId[episodeId],
    safeFileName: (value) => value.replaceAll(":", "-"),
    saveExportArtifact: async (fileName, type, content) => {
      calls.push(["save", fileName, type, JSON.parse(content).episode.id]);
      return { path: "C:/export.json" };
    },
    openProductionStudioView: (view, message) => calls.push(["view", view, message]),
  });

  assert.deepEqual(result, { path: "C:/export.json" });
  assert.equal(calls[0][0], "save");
  assert.equal(calls[0][1], "第一集-assets-storyboard.json");
  assert.deepEqual(calls[1], ["view", "delivery", "资产与分镜已导出：C:/export.json"]);
});

test("exportAssetsAndStoryboardAction reports empty episode", async () => {
  const calls = [];
  const result = await exportAssetsAndStoryboardAction({
    commercialProject: { activeEpisode: { id: "ep1", assets: [], shots: [] } },
    setProjectMessage: (message) => calls.push(message),
  });

  assert.equal(result, null);
  assert.deepEqual(calls, ["当前集还没有可导出的资产或分镜。"]);
});
