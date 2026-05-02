import assert from "node:assert/strict";
import test from "node:test";

import {
  appendToken,
  buildStoryboardPrompt,
  compactPromptText,
  dedupeOrderedStrings,
  escapeRegExp,
  splitGeminiPrompts,
} from "../src/text-format-helpers.js";

test("text helpers build storyboard prompts with frame fallbacks", () => {
  assert.equal(
    buildStoryboardPrompt({ rows: 2, cols: 2, frames: ["开场", "", "追逐"] }),
    "生成一张2×2的4宫格分镜图，画面风格统一，禁止添加描述文本。\n分镜1：开场\n分镜2：依据之前的内容进行推测\n分镜3：追逐",
  );
});

test("text helpers append tokens with a trailing separator", () => {
  assert.equal(appendToken("", "@角色_小明"), "@角色_小明 ");
  assert.equal(appendToken("已有文本   ", "@场景_街道"), "已有文本 @场景_街道 ");
});

test("text helpers split Gemini prompts by supported modes", () => {
  assert.deepEqual(splitGeminiPrompts("a\n\nb", "paragraph"), ["a", "b"]);
  assert.deepEqual(splitGeminiPrompts("a\nb", "line"), ["a", "b"]);
  assert.deepEqual(splitGeminiPrompts("a\n---\nb\n###\nc", "separator"), ["a", "b", "c"]);
  assert.deepEqual(splitGeminiPrompts(""), []);
});

test("text helpers escape regex and normalize prompt text", () => {
  assert.equal(escapeRegExp("a+b?"), "a\\+b\\?");
  assert.deepEqual(dedupeOrderedStrings([" a ", "b", "a", "", null, " c "]), ["a", "b", "c"]);
  assert.equal(compactPromptText("第一行   \n\n\n第二行，，；；"), "第一行\n\n第二行，；");
});
