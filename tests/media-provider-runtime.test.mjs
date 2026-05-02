import assert from "node:assert/strict";
import test from "node:test";
import {
  createMediaProviderRuntime,
  currentProviderMode,
  normalizeImageProviderMode,
  normalizeVideoProviderMode,
  resolveImageJobSettings,
  resolveShotImageProviderMode,
  resolveShotVideoProviderMode,
  resolveVideoJobSettings,
} from "../src/app/media-provider-runtime.js";

test("provider mode helpers normalize shared aliases", () => {
  assert.equal(currentProviderMode({ comfyEnabled: true, providerMode: "mock" }), "comfy");
  assert.equal(currentProviderMode({ providerMode: "api" }), "custom");
  assert.equal(currentProviderMode({ providerMode: "manual" }), "upload");
  assert.equal(currentProviderMode({}), "mock");

  assert.equal(normalizeImageProviderMode("api"), "custom");
  assert.equal(normalizeImageProviderMode("comfyui"), "comfy");
  assert.equal(normalizeImageProviderMode("local-upload"), "upload");
  assert.equal(normalizeImageProviderMode(""), "inherit");

  assert.equal(normalizeVideoProviderMode("api"), "custom");
  assert.equal(normalizeVideoProviderMode("manual"), "upload");
});

test("job setting resolvers apply provider overrides", () => {
  const base = { providerMode: "mock", customModel: "base" };

  assert.equal(resolveImageJobSettings(base, { imageProviderMode: "inherit" }), base);
  assert.deepEqual(resolveImageJobSettings(base, {
    imageProviderMode: "api",
    imageRuntimeModel: "image-model",
  }), {
    providerMode: "custom",
    customModel: "image-model",
    comfyEnabled: false,
  });

  assert.deepEqual(resolveVideoJobSettings(base, {
    videoProviderMode: "comfy",
    videoRuntimeModel: "video-model",
  }), {
    providerMode: "comfy",
    customModel: "base",
    comfyEnabled: true,
  });
});

test("shot provider resolvers prefer shot mode before global mode", () => {
  assert.equal(resolveShotImageProviderMode({ imageProviderMode: "upload" }, { providerMode: "api" }), "upload");
  assert.equal(resolveShotImageProviderMode({}, { providerMode: "api" }), "custom");
  assert.equal(resolveShotVideoProviderMode({ videoProviderMode: "comfyui" }, { providerMode: "api" }), "comfy");
  assert.equal(resolveShotVideoProviderMode({}, { providerMode: "manual" }), "upload");
});

test("media provider runtime dispatches image and video providers", async () => {
  const calls = [];
  const runtime = createMediaProviderRuntime({
    runCustomApiGeneration: async (settings, prompt) => ({ imageUrl: `custom:${settings.customModel}:${prompt}` }),
    runCustomVideoApiGeneration: async (settings, prompt) => ({ videoUrl: `video:${settings.customModel}:${prompt}` }),
    runComfyGeneration: async (settings, prompt, kind) => ({ imageUrl: `comfy:${kind}:${prompt}` }),
    makeGeneratedImage: (prompt) => `mock:${prompt}`,
    enqueueComfyGeneration: async (task) => {
      calls.push("queued");
      return task();
    },
  });

  assert.deepEqual(await runtime.runImageGeneration({ providerMode: "custom", customModel: "m" }, "p"), { imageUrl: "custom:m:p" });
  assert.deepEqual(await runtime.runVideoGeneration({ providerMode: "custom", customModel: "v" }, "p"), { videoUrl: "video:v:p" });
  assert.deepEqual(await runtime.runImageGeneration({ providerMode: "comfy" }, "p"), { imageUrl: "comfy:image:p" });
  assert.deepEqual(await runtime.runVideoGeneration({ providerMode: "mock" }, "p"), { imageUrl: "mock:视频预览\np", note: "本地模拟视频 · 请在 AI 设置中启用 ComfyUI 视频工作流" });
  assert.deepEqual(calls, ["queued"]);
  await assert.rejects(runtime.runImageGeneration({ providerMode: "upload" }, "p"), /本地上传/);
});
