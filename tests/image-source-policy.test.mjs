import assert from "node:assert/strict";
import test from "node:test";
import {
  buildImageSourcePolicy,
  canQueueImageSource,
  imageSourceModeLabel,
  normalizeImageSourceMode,
  resolveImageSourceMode,
} from "../src/core/providers/image-source-policy.js";

test("image source policy normalizes api comfy and upload modes", () => {
  assert.equal(normalizeImageSourceMode("custom"), "api");
  assert.equal(normalizeImageSourceMode("ComfyUI"), "comfy");
  assert.equal(normalizeImageSourceMode("local-upload"), "upload");
  assert.equal(resolveImageSourceMode("inherit", "custom"), "api");
});

test("image source policy marks upload as manual and non queueable", () => {
  const policy = buildImageSourcePolicy({ mode: "upload" });

  assert.equal(policy.mode, "upload");
  assert.equal(policy.label, "本地上传");
  assert.equal(policy.queueable, false);
  assert.equal(policy.requiresUpload, true);
  assert.equal(canQueueImageSource("comfy"), true);
  assert.equal(canQueueImageSource("upload"), false);
  assert.equal(imageSourceModeLabel("api"), "API 生图");
});
