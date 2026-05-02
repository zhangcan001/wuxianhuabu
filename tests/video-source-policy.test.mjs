import assert from "node:assert/strict";
import test from "node:test";
import {
  buildVideoSourcePolicy,
  canQueueVideoSource,
  normalizeVideoSourceMode,
  resolveVideoSourceMode,
  videoSourceModeLabel,
} from "../src/core/providers/video-source-policy.js";

test("video source policy normalizes api comfy and upload modes", () => {
  assert.equal(normalizeVideoSourceMode("custom"), "api");
  assert.equal(normalizeVideoSourceMode("ComfyUI"), "comfy");
  assert.equal(normalizeVideoSourceMode("local-upload"), "upload");
  assert.equal(resolveVideoSourceMode("inherit", "api"), "api");
});

test("video source policy marks upload as manual and non queueable", () => {
  const policy = buildVideoSourcePolicy({ mode: "upload" });

  assert.equal(policy.mode, "upload");
  assert.equal(policy.label, "本地上传");
  assert.equal(policy.queueable, false);
  assert.equal(policy.requiresUpload, true);
  assert.equal(canQueueVideoSource("comfy"), true);
  assert.equal(canQueueVideoSource("upload"), false);
  assert.equal(videoSourceModeLabel("api"), "API 视频");
});
