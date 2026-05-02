import assert from "node:assert/strict";
import test from "node:test";
import {
  buildShotContinuityPrompt,
  collectShotTokens,
} from "../src/domain/shot-continuity-prompt.js";

test("shot continuity prompt appends locked asset identity", () => {
  const prompt = buildShotContinuityPrompt({
    imagePrompt: "雨夜车站首帧",
    mainCharacterToken: "@角色_林舟",
    mainSceneToken: "@场景_旧车站",
    assetRefs: ["@角色_林舟", "@场景_旧车站"],
  }, [
    {
      token: "@角色_林舟",
      name: "林舟",
      visualLock: "红色外套，短发，左脸小痣",
      continuityRule: "所有镜头保持脸型、服装和发型一致",
      imageUrl: "asset://linzhou.png",
    },
    {
      token: "@场景_旧车站",
      name: "旧车站",
      prompt: "潮湿站台，蓝绿色灯光",
    },
  ], { kind: "image" });

  assert.match(prompt, /雨夜车站首帧/);
  assert.match(prompt, /连续性锁定/);
  assert.match(prompt, /红色外套/);
  assert.match(prompt, /asset:\/\/linzhou\.png/);
  assert.equal((prompt.match(/@角色_林舟/g) || []).length >= 1, true);
});

test("shot continuity prompt stays unchanged without an asset catalog", () => {
  const prompt = buildShotContinuityPrompt({
    videoPrompt: "镜头推进",
    mainCharacterToken: "@角色_林舟",
  }, [], { kind: "video" });

  assert.equal(prompt, "镜头推进");
});

test("collectShotTokens dedupes primary tokens and refs", () => {
  assert.deepEqual(collectShotTokens({
    mainCharacterToken: "@角色_林舟",
    mainSceneToken: "@场景_旧车站",
    keyPropTokens: ["@道具_钥匙", ""],
    assetRefs: ["@角色_林舟", "@道具_钥匙"],
  }), ["@角色_林舟", "@场景_旧车站", "@道具_钥匙"]);
});
