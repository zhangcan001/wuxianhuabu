import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMediaSourcePolicy,
  canQueueMediaSource,
  mediaSourceModeLabel,
  normalizeMediaKind,
  normalizeMediaSourceMode,
  resolveMediaSourceMode,
} from "../src/core/providers/media-source-policy.js";

test("media source policy normalizes shared source modes", () => {
  assert.equal(normalizeMediaSourceMode("custom"), "api");
  assert.equal(normalizeMediaSourceMode("ComfyUI"), "comfy");
  assert.equal(normalizeMediaSourceMode("manual"), "upload");
  assert.equal(resolveMediaSourceMode("inherit", "custom"), "api");
  assert.equal(normalizeMediaKind("video"), "video");
  assert.equal(normalizeMediaKind("audio"), "image");
});

test("media source policy labels and queueability are media-kind aware", () => {
  assert.equal(mediaSourceModeLabel("api", "image"), "API 生图");
  assert.equal(mediaSourceModeLabel("api", "video"), "API 视频");
  assert.equal(canQueueMediaSource("upload"), false);
  assert.equal(canQueueMediaSource("comfy"), true);

  const policy = buildMediaSourcePolicy({ kind: "video", mode: "upload" });
  assert.equal(policy.kind, "video");
  assert.equal(policy.mode, "upload");
  assert.equal(policy.requiresUpload, true);
  assert.equal(policy.providerMode, "upload");
});
