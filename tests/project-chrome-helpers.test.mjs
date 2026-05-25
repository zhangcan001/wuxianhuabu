import assert from "node:assert/strict";
import test from "node:test";
import {
  detectSaveStateTone,
  diffNewlyDoneSteps,
  providerLabel,
} from "../src/product/studio/project-chrome-helpers.js";

test("detectSaveStateTone returns null for empty input", () => {
  assert.equal(detectSaveStateTone(""), null);
  assert.equal(detectSaveStateTone(null), null);
  assert.equal(detectSaveStateTone(undefined), null);
});

test("detectSaveStateTone reports ok for success prefix", () => {
  const result = detectSaveStateTone("已自动保存 14:32");
  assert.deepEqual(result, { tone: "ok", icon: "✓", text: "已自动保存 14:32" });
});

test("detectSaveStateTone reports err for failure prefix", () => {
  const result = detectSaveStateTone("自动保存失败：网络异常");
  assert.deepEqual(result, { tone: "err", icon: "!", text: "自动保存失败：网络异常" });
});

test("detectSaveStateTone falls back to pending for other strings", () => {
  const result = detectSaveStateTone("正在保存…");
  assert.deepEqual(result, { tone: "pending", icon: "…", text: "正在保存…" });
});

test("diffNewlyDoneSteps returns steps that flipped from false to true", () => {
  const steps = [{ key: "a" }, { key: "b" }, { key: "c" }];
  const prev = { a: true, b: false, c: false };
  const next = { a: true, b: true, c: false };
  assert.deepEqual(diffNewlyDoneSteps(prev, next, steps), { b: true });
});

test("diffNewlyDoneSteps ignores steps that were already done", () => {
  const steps = [{ key: "a" }, { key: "b" }];
  const prev = { a: true, b: true };
  const next = { a: true, b: true };
  assert.deepEqual(diffNewlyDoneSteps(prev, next, steps), {});
});

test("diffNewlyDoneSteps treats undefined prev as fresh start", () => {
  const steps = [{ key: "a" }, { key: "b" }];
  const next = { a: true, b: false };
  assert.deepEqual(diffNewlyDoneSteps({}, next, steps), { a: true });
  assert.deepEqual(diffNewlyDoneSteps(undefined, next, steps), { a: true });
});

test("diffNewlyDoneSteps does not flag steps that were undone", () => {
  const steps = [{ key: "a" }];
  const prev = { a: true };
  const next = { a: false };
  assert.deepEqual(diffNewlyDoneSteps(prev, next, steps), {});
});

test("providerLabel maps known keys to Chinese labels", () => {
  assert.equal(providerLabel("text"), "文本");
  assert.equal(providerLabel("image"), "图片");
  assert.equal(providerLabel("video"), "视频");
  assert.equal(providerLabel("comfy"), "ComfyUI");
  assert.equal(providerLabel("gemini"), "Gemini");
  assert.equal(providerLabel("customImage"), "自定义图片");
});

test("providerLabel returns the key for unknown providers", () => {
  assert.equal(providerLabel("unknown-key"), "unknown-key");
  assert.equal(providerLabel(""), "");
});
