import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBusinessOptimizationBoard,
  normalizeAssetRows,
  normalizeShotRows,
  normalizeTimelineRows,
  resolveStudioMediaUrl,
  summarizeMedia,
  viewSubtitle,
  viewTitle,
} from "../src/product/studio/production-selectors.js";

test("production selectors normalize shot media candidates and readiness", () => {
  const [shot] = normalizeShotRows([{
    id: "S01",
    scene: "雨夜车站",
    imageItems: [{ imageUrl: "asset://s01-a.png" }],
    imageUrl: "asset://s01.png",
    videoResultUrl: "asset://s01.mp4",
    mainCharacterToken: "@角色_林舟",
    mainSceneToken: "@场景_旧车站",
    assetRefs: ["@角色_林舟", "@场景_旧车站"],
    referenceResources: "@资源_林舟",
  }]);

  assert.equal(shot.id, "S01");
  assert.equal(shot.hasImage, true);
  assert.equal(shot.hasVideo, true);
  assert.equal(shot.imageCandidates.length, 2);
  assert.equal(shot.mainCharacterToken, "@角色_林舟");
  assert.deepEqual(shot.assetRefs, ["@角色_林舟", "@场景_旧车站"]);
  assert.equal(shot.referenceResources, "@资源_林舟");
});

test("production selectors normalize assets timeline and labels", () => {
  const [asset] = normalizeAssetRows([{ type: "character", token: "@林舟", imageUrl: "asset://lin.png" }]);
  const [clip] = normalizeTimelineRows({ clips: [{ id: "c1", shotId: "S01", mediaUrl: "asset://s01.mp4" }] }, [{ id: "S01", title: "开场" }]);
  const stats = summarizeMedia([{ hasImage: true, hasVideo: false }, { hasImage: true, hasVideo: true }]);

  assert.equal(asset.typeLabel, "角色");
  assert.equal(clip.ready, true);
  assert.equal(clip.title, "开场");
  assert.deepEqual(stats, { total: 2, imagesReady: 2, videosReady: 1 });
  assert.equal(viewTitle("delivery"), "交付");
  assert.equal(viewSubtitle("unknown"), "按阶段查看当前集的生产完成度");
});

test("production selectors convert local media paths for studio previews", () => {
  const resolveMediaUrl = (value, fallbackPath = "") => `asset://${value || fallbackPath}`;
  const [shot] = normalizeShotRows([{
    id: "S02",
    imagePath: "C:/cache/shot.png",
    imageItems: [{ imagePath: "C:/cache/shot-alt.png", thumbnailPath: "C:/cache/shot-alt-thumb.png" }],
  }], { resolveMediaUrl });
  const [asset] = normalizeAssetRows([{
    type: "scene",
    imagePath: "C:/cache/scene.png",
    imageItems: [{ imagePath: "C:/cache/scene-alt.png" }],
  }], { resolveMediaUrl });

  assert.equal(shot.imageUrl, "asset://C:/cache/shot.png");
  assert.equal(shot.previewUrl, "asset://C:/cache/shot.png");
  assert.equal(shot.imageCandidates[0].thumbnailUrl, "asset://C:/cache/shot-alt-thumb.png");
  assert.equal(asset.imageUrl, "asset://C:/cache/scene.png");
  assert.equal(asset.imageCandidates[0].imageUrl, "asset://C:/cache/scene-alt.png");
});

test("studio media url resolver uses Tauri converter for Windows paths", () => {
  const previousWindow = globalThis.window;
  globalThis.window = {
    __TAURI_INTERNALS__: {
      convertFileSrc: (path, protocol) => `${protocol}://converted/${path}`,
    },
  };
  try {
    assert.equal(resolveStudioMediaUrl("C:/cache/a.png"), "asset://converted/C:/cache/a.png");
    assert.equal(resolveStudioMediaUrl("asset://already.png"), "asset://already.png");
  } finally {
    if (previousWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }
  }
});

test("studio media url resolver falls back to asset host for local paths", () => {
  const previousWindow = globalThis.window;
  delete globalThis.window;
  try {
    assert.equal(
      resolveStudioMediaUrl("C:/Users/ADMIN/.wuxianhuabu/media-cache/comfy.png"),
      "http://asset.localhost/C%3A%2FUsers%2FADMIN%2F.wuxianhuabu%2Fmedia-cache%2Fcomfy.png",
    );
  } finally {
    if (previousWindow !== undefined) globalThis.window = previousWindow;
  }
});

test("business optimization board tracks the 20 product improvements", () => {
  const shots = normalizeShotRows([{
    id: "S01",
    imagePrompt: "雨夜车站",
    videoPrompt: "镜头推进",
    imageUrl: "asset://s01.png",
    videoUrl: "asset://s01.mp4",
    imageItems: [{ imageUrl: "asset://s01-a.png" }, { imageUrl: "asset://s01-b.png" }],
    reviewStatus: "已通过",
  }]);
  const assets = normalizeAssetRows([{ id: "a1", type: "character", token: "@林舟", imageUrl: "asset://lin.png" }]);
  const board = buildBusinessOptimizationBoard({
    sourceText: "雨夜",
    shots,
    assets,
    timeline: { clips: [{ shotId: "S01", mediaUrl: "asset://s01.mp4" }] },
    queue: [{ id: "q1", status: "failed" }],
    exportHistory: [{ status: "done" }],
    providerHealthReport: { ok: true },
    riskReport: { ok: true },
  });

  assert.equal(board.items.length, 20);
  assert.equal(board.items.find((item) => item.key === "flow").status, "done");
  assert.equal(board.items.find((item) => item.key === "failureRecovery").status, "blocked");
  assert.equal(board.items.find((item) => item.key === "failureRecovery").severity, "critical");
  assert.equal(board.items.find((item) => item.key === "failureRecovery").estimate.tasks, 1);
  assert.equal(board.items.find((item) => item.key === "deliveryGate").nextSteps.includes("运行交付检查"), true);
  assert.equal(board.previews.image.total, 1);
  assert.equal(board.previews.video.skipped, 1);
  assert.equal(board.deliveryPreflight.ok, true);
  assert.equal(board.syncStatus.ok, true);
  assert.equal(board.topItems.some((item) => item.key === "failureRecovery"), true);
  assert.equal(board.score > 50, true);
});
