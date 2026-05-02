import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNovelChatCompletionsUrl,
  detectComfyPromptNodeId,
  detectComfyWorkflowFormat,
  extractComfyError,
  extractComfyMedia,
  extractTextFromApiResponse,
  extractTextFromSseResponse,
  injectComfyPrompt,
  loadRecentProjects,
  formatCustomImageApiError,
  persistMediaAssetReference,
  persistGeneratedMediaResult,
  resolveComfyRequestBaseUrl,
  saveNovelApiSettings,
  splitImageToFrames,
  summarizeCustomImageApiDiagnostic,
  validateCustomImageApiSettings,
} from "../src/backend-service-helpers.js";

test("novel api url helper appends chat completions when needed", () => {
  assert.equal(
    buildNovelChatCompletionsUrl("https://api.example.com/v1/"),
    "https://api.example.com/v1/chat/completions"
  );
  assert.equal(
    buildNovelChatCompletionsUrl("https://api.example.com/v1/chat/completions"),
    "https://api.example.com/v1/chat/completions"
  );
});

test("sse text extraction joins incremental chunks", () => {
  const text = extractTextFromSseResponse([
    'data: {"choices":[{"delta":{"content":"你好"}}]}',
    "",
    'data: {"choices":[{"delta":{"content":"世界"}}]}',
    "data: [DONE]",
  ].join("\n"), "choices.0.delta.content");
  assert.equal(text, "你好世界");
});

test("api response extractor falls back to nested text field", () => {
  assert.equal(
    extractTextFromApiResponse({ output: [{ content: [{ text: "回退文本" }] }] }),
    "回退文本"
  );
});

test("comfy helpers detect format, prompt node and media payload", () => {
  const apiWorkflow = JSON.stringify({
    "12": {
      class_type: "CLIPTextEncode",
      inputs: { text: "masterpiece portrait" },
    },
  });
  assert.equal(detectComfyWorkflowFormat(apiWorkflow), "api");
  assert.equal(detectComfyPromptNodeId(apiWorkflow), "12");

  const workflow = {
    12: { inputs: { text: "old prompt" } },
    20: { inputs: { seed: 123, noise_seed: 456 } },
  };
  injectComfyPrompt(workflow, 12, "角色站在雨夜街头 @图1");
  assert.equal(workflow[12].inputs.text, "角色站在雨夜街头 图1");
  assert.notEqual(workflow[20].inputs.seed, 123);
  assert.notEqual(workflow[20].inputs.noise_seed, 456);

  const media = extractComfyMedia("http://127.0.0.1:8188", {
    outputs: {
      image: {
        images: [{ filename: "a.png", subfolder: "", type: "output" }],
      },
      video: {
        animated: [{ filename: "clip.webm", subfolder: "v", type: "temp" }],
        files: [{ filename: "clip.webm", subfolder: "v", type: "temp" }],
      },
    },
  });
  assert.deepEqual(media.images, [
    "http://127.0.0.1:8188/view?filename=a.png&subfolder=&type=output",
  ]);
  assert.deepEqual(media.videos, [
    "http://127.0.0.1:8188/view?filename=clip.webm&subfolder=v&type=temp",
  ]);
});

test("comfy error extractor reads exception message", () => {
  assert.equal(
    extractComfyError({
      status: {
        completed: false,
        messages: [["error", { exception_message: "CUDA out of memory" }]],
      },
    }),
    "ComfyUI 执行失败：CUDA out of memory"
  );
});

test("comfy request base uses dev proxy for browser localhost", async () => {
  const previousWindow = globalThis.window;
  globalThis.window = { location: { href: "http://127.0.0.1:5173/" } };
  try {
    assert.equal(resolveComfyRequestBaseUrl("http://127.0.0.1:8188"), "/comfy");
    assert.equal(resolveComfyRequestBaseUrl("http://localhost:8188/"), "/comfy");
    assert.equal(resolveComfyRequestBaseUrl("http://192.168.1.8:8188"), "http://192.168.1.8:8188");
    assert.equal(resolveComfyRequestBaseUrl("http://127.0.0.1:8188", { tauriRuntime: true }), "http://127.0.0.1:8188");
  } finally {
    if (previousWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }
  }
});

test("load recent projects returns empty list outside tauri", async () => {
  const result = await loadRecentProjects({ tauriRuntime: false });
  assert.deepEqual(result, []);
});

test("custom image api validation catches LinAPI style mode mismatch", () => {
  assert.match(
    validateCustomImageApiSettings({
      customApiUrl: "https://api.linapi.com/v1/chat/completions",
      customApiKind: "openai-compatible",
      customResultMode: "task-id",
      customImagePath: "data.0.url",
    }),
    /不会走 `\/v1\/draw\/result` 轮询/
  );

  assert.match(
    validateCustomImageApiSettings({
      customApiUrl: "https://api.example.com/v1/images/generations",
      customApiKind: "direct-image",
      customResultMode: "url",
      customImagePath: "",
    }),
    /需要填写结果图片路径/
  );

  assert.equal(
    validateCustomImageApiSettings({
      customApiUrl: "https://api.example.com/v1/images/generations",
      customApiKind: "direct-image",
      customResultMode: "base64",
      customImagePath: "data.0.b64_json",
    }),
    ""
  );
});

test("custom image api error formatter explains draw polling 404", () => {
  assert.match(
    formatCustomImageApiError("绘画结果轮询失败：HTTP 404 /v1/draw/result"),
    /LinAPI/
  );
});

test("custom image api diagnostic summary highlights polling and image fields", () => {
  const summary = summarizeCustomImageApiDiagnostic({
    normalizedApiKind: "openai-compatible",
    normalizedResultMode: "auto",
    firstResponseTopLevelKeys: ["id", "choices"],
    firstResponseKeySummary: "id, choices",
    firstResponseNestedKeys: ["choices", "choices.0", "choices.0.message", "choices.0.message.content"],
    hasImageField: false,
    hasTaskId: true,
    detectedTaskId: "chatcmpl-123",
    willPoll: false,
  });
  assert.equal(summary.apiKind, "openai-compatible");
  assert.equal(summary.resultMode, "auto");
  assert.equal(summary.keySummary, "id, choices");
  assert.match(summary.nestedKeySummary, /choices\.0\.message\.content/);
  assert.match(summary.imageFieldStatus, /未检测到图片字段/);
  assert.match(summary.taskFieldStatus, /chatcmpl-123/);
  assert.equal(summary.pollingStatus, "不会进入轮询");
});

test("save novel api settings sanitizes stored payload", () => {
  const calls = [];
  const storage = {
    value: "",
    setItem(key, value) {
      this.key = key;
      this.value = value;
    },
  };
  saveNovelApiSettings({
    apiProvider: "openai",
    apiBaseUrl: "https://api.example.com/v1",
    apiKey: "secret",
  }, {
    forgetApiKey: () => calls.push("forget"),
    rememberApiKey: (kind, value) => calls.push(`${kind}:${value}`),
    hasSavedApiKey: () => true,
    loadApiKeyVault: () => ({}),
    normalizeNovelBodyTemplate: (template) => template || "{}",
    novelApiProviders: { openai: {} },
    novelFactorySchema: "schema",
    storage,
    storageKey: "novel-settings",
    tauriRuntime: false,
  });
  assert.deepEqual(calls, ["text:secret"]);
  const saved = JSON.parse(storage.value);
  assert.equal(saved.apiKey, "secret");
  assert.equal(saved.apiKeySaved, true);
  assert.equal(saved.schema, "schema");
});

test("split image helper can use tauri branch without canvas", async () => {
  const frames = await splitImageToFrames("data:image/png;base64,abc", 2, 2, {
    tauriRuntime: true,
    splitImageGridImpl: async () => ({ frames: ["a", "b", "c", "d"] }),
  });
  assert.deepEqual(frames, ["a", "b", "c", "d"]);
});

test("persistGeneratedMediaResult rewrites preview urls and keeps local paths", async () => {
  const calls = [];
  const result = await persistGeneratedMediaResult({
    imageUrl: "data:image/png;base64,abc",
    videoUrl: "https://cdn.example.com/clip.mp4",
  }, {
    tauriRuntime: true,
    fileName: "镜头S01",
    cacheMediaAssetImpl: async (request) => {
      calls.push(request);
      return {
        path: request.mediaType === "image" ? "C:/cache/image.png" : "C:/cache/video.mp4",
        thumbnailPath: request.mediaType === "image" ? "C:/cache/thumb.png" : "",
      };
    },
    convertFileSrcImpl: (path) => `asset://${path}`,
  });

  assert.deepEqual(calls, [
    { mediaUrl: "data:image/png;base64,abc", mediaType: "image", fileName: "镜头S01" },
    { mediaUrl: "https://cdn.example.com/clip.mp4", mediaType: "video", fileName: "镜头S01" },
  ]);
  assert.equal(result.imageUrl, "asset://C:/cache/image.png");
  assert.equal(result.imagePath, "C:/cache/image.png");
  assert.equal(result.imageThumbnailUrl, "asset://C:/cache/thumb.png");
  assert.equal(result.imageThumbnailPath, "C:/cache/thumb.png");
  assert.equal(result.originalImageUrl, "data:image/png;base64,abc");
  assert.equal(result.videoUrl, "asset://C:/cache/video.mp4");
  assert.equal(result.videoPath, "C:/cache/video.mp4");
  assert.equal(result.originalVideoUrl, "https://cdn.example.com/clip.mp4");
});

test("persistMediaAssetReference preserves existing paths and caches tauri imports", async () => {
  const existing = await persistMediaAssetReference({
    mediaUrl: "asset://C:/cache/existing.png",
    mediaPath: "C:/cache/existing.png",
    mediaType: "image",
  }, {
    tauriRuntime: true,
    convertFileSrcImpl: (path) => `asset://${path}`,
  });
  assert.deepEqual(existing, {
    mediaUrl: "asset://C:/cache/existing.png",
    mediaPath: "C:/cache/existing.png",
    originalMediaUrl: "asset://C:/cache/existing.png",
    thumbnailUrl: "",
    thumbnailPath: "",
  });

  const cached = await persistMediaAssetReference({
    mediaUrl: "data:image/png;base64,abc",
    mediaType: "image",
    fileName: "upload",
  }, {
    tauriRuntime: true,
    cacheMediaAssetImpl: async () => ({ path: "C:/cache/upload.png", thumbnailPath: "C:/cache/upload-thumb.png" }),
    convertFileSrcImpl: (path) => `asset://${path}`,
  });
  assert.deepEqual(cached, {
    mediaUrl: "asset://C:/cache/upload.png",
    mediaPath: "C:/cache/upload.png",
    originalMediaUrl: "data:image/png;base64,abc",
    thumbnailUrl: "asset://C:/cache/upload-thumb.png",
    thumbnailPath: "C:/cache/upload-thumb.png",
  });
});
