import test from "node:test";
import assert from "node:assert/strict";
import {
  checkAssetConsistencyGate,
  checkImageTaskPreflight,
  checkMediaProviderConfig,
  checkTextTaskPreflight,
  checkVideoTaskPreflight,
} from "../src/app/production-preflight.js";
import {
  buildProviderHealthReport,
} from "../src/domain/provider-health.js";

test("text preflight blocks api mode without connection settings but allows local template", () => {
  assert.equal(checkTextTaskPreflight({ sourceText: "雨夜", textApiSettings: { factoryMode: "local" } }).ok, true);
  const blocked = checkTextTaskPreflight({ sourceText: "雨夜", textApiSettings: { factoryMode: "api", apiBaseUrl: "", apiKey: "" } });
  assert.equal(blocked.ok, false);
  assert.match(blocked.message, /Base URL/);
});

test("image preflight requires completed text assets shots and image prompts", () => {
  const missingAssets = checkImageTaskPreflight({ activeEpisode: { shots: [{ id: "S01", imagePrompt: "车站" }] } });
  assert.equal(missingAssets.ok, false);
  const ready = checkImageTaskPreflight({
    activeEpisode: {
      script: "第一场",
      assets: [
        { id: "hero", type: "character", token: "@角色_林舟", prompt: "red coat" },
        { id: "station", type: "scene", token: "@场景_车站", imageUrl: "asset://station.png" },
      ],
      shots: [{
        id: "S01",
        imagePrompt: "车站",
        mainCharacterToken: "@角色_林舟",
        mainSceneToken: "@场景_车站",
        assetRefs: ["@角色_林舟", "@场景_车站"],
      }],
    },
  });
  assert.equal(ready.ok, true);
});

test("image preflight blocks shot generation when asset bindings are not locked", () => {
  const blocked = checkImageTaskPreflight({
    activeEpisode: {
      script: "第一场",
      assets: [
        { id: "hero", category: "角色", token: "@角色_林舟", prompt: "red coat" },
        { id: "station", category: "场景", token: "@场景_车站", prompt: "rain station" },
      ],
      shots: [{ id: "S01", imagePrompt: "车站" }],
    },
  });
  assert.equal(blocked.ok, false);
  assert.match(blocked.message, /主角色\/主场景/);
});

test("asset consistency gate blocks unknown shot refs but can be explicitly skipped", () => {
  const project = {
    activeEpisode: {
      assets: [
        { id: "hero", type: "character", token: "@角色_林舟", prompt: "red coat" },
        { id: "station", type: "scene", token: "@场景_车站", prompt: "rain station" },
      ],
      shots: [{
        id: "S01",
        mainCharacterToken: "@角色_林舟",
        mainSceneToken: "@场景_车站",
        assetRefs: ["@不存在"],
      }],
    },
  };
  const blocked = checkAssetConsistencyGate(project);
  assert.equal(blocked.ok, false);
  assert.match(blocked.message, /不存在的资产/);
  assert.equal(checkAssetConsistencyGate(project, { strictAssetConsistency: false }).ok, true);
});

test("video preflight requires image material and video prompts", () => {
  const blocked = checkVideoTaskPreflight({
    activeEpisode: {
      shots: [{ id: "S01", videoPrompt: "推进" }],
    },
  });
  assert.equal(blocked.ok, false);
  assert.match(blocked.message, /图片素材/);
  assert.equal(checkVideoTaskPreflight({
    activeEpisode: {
      assets: [
        { id: "hero", type: "character", token: "@角色_林舟", prompt: "red coat" },
        { id: "station", type: "scene", token: "@场景_车站", prompt: "rain station" },
      ],
      shots: [{
        id: "S01",
        imageUrl: "asset://s01.png",
        videoPrompt: "推进",
        mainCharacterToken: "@角色_林舟",
        mainSceneToken: "@场景_车站",
        assetRefs: ["@角色_林舟", "@场景_车站"],
      }],
    },
  }).ok, true);
});

test("media provider preflight validates api and comfy settings", () => {
  assert.equal(checkMediaProviderConfig({}, { kind: "image", providerMode: "upload" }).ok, true);
  assert.equal(checkMediaProviderConfig({ comfyBaseUrl: "127.0.0.1:8188" }, { kind: "image", providerMode: "comfy" }).ok, false);
  assert.equal(checkMediaProviderConfig({ customApiUrl: "https://api.example.com/v1/images", customApiKeySaved: true }, { kind: "image", providerMode: "custom" }).ok, true);
});

test("provider health does not require api and comfy at the same time", () => {
  const apiMode = buildProviderHealthReport({
    providerMode: "custom",
    customApiUrl: "https://api.example.com/v1/images",
    customApiKeySaved: true,
    customImagePath: "data.0.url",
    customResultMode: "url",
    comfyBaseUrl: "127.0.0.1:8188",
    localTextMode: true,
  });
  const comfyMode = buildProviderHealthReport({
    providerMode: "comfy",
    comfyBaseUrl: "http://127.0.0.1:8188",
    localTextMode: true,
  });

  assert.equal(apiMode.blockers.some((item) => item.key === "comfy"), false);
  assert.equal(comfyMode.blockers.some((item) => item.key === "image"), false);
});
