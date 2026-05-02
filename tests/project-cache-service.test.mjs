import assert from "node:assert/strict";
import test from "node:test";
import {
  cacheProjectWithFallback,
} from "../src/app/project-cache-service.js";

test("cache project uses normal cache path first", async () => {
  const calls = [];
  const result = await cacheProjectWithFallback({
    project: { id: "p1" },
    projectPath: "draft.wxhb",
    projectRepository: {
      cache: async (project, options) => calls.push([project.id, options]),
    },
  });

  assert.deepEqual(result, { cached: true, mode: "normal" });
  assert.deepEqual(calls, [["p1", { storage: "cache", projectPath: "draft.wxhb" }]]);
});

test("cache project falls back to compact browser cache", async () => {
  const calls = [];
  const messages = [];
  const result = await cacheProjectWithFallback({
    project: { id: "p1" },
    projectRepository: {
      cache: async (_project, options) => {
        calls.push(options);
        if (!options.compact) throw new Error("quota");
      },
    },
    setProjectMessage: (message) => messages.push(message),
  });

  assert.equal(result.mode, "compact");
  assert.equal(result.cached, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].compact, true);
  assert.equal(messages[0], "浏览器缓存已切换为轻量模式：大图片不再写入缓存，建议及时保存工程文件。");
});

test("cache project reports tauri cache write failure without browser fallback", async () => {
  const messages = [];
  const warnings = [];
  const result = await cacheProjectWithFallback({
    tauriRuntime: true,
    projectRepository: {
      cache: async () => {
        throw new Error("disk");
      },
    },
    setProjectMessage: (message) => messages.push(message),
    logger: {
      warn: (...args) => warnings.push(args),
    },
  });

  assert.equal(result.mode, "tauri-failed");
  assert.equal(result.cached, false);
  assert.equal(messages[0], "本地恢复缓存写入失败：请尽快保存工程，避免草稿丢失。");
  assert.equal(warnings.length, 1);
});
