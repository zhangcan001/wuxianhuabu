import test from "node:test";
import assert from "node:assert/strict";
import {
  buildProjectStudioActions,
} from "../src/app/project-studio-actions.js";

test("project studio actions wrap generation commands with studio defaults", async () => {
  const calls = [];
  const actions = buildProjectStudioActions({
    generateStudioTextPlan: (text) => `text:${text}`,
    queueActiveEpisodeImages: (options) => {
      calls.push(["image", options]);
      return { ok: true };
    },
    queueActiveEpisodeVideos: (options) => {
      calls.push(["video", options]);
      return { ok: true };
    },
  });

  assert.equal(actions.generateText("雨夜"), "text:雨夜");
  assert.deepEqual(await actions.generateImages(), { ok: true });
  assert.deepEqual(await actions.generateVideos(), { ok: true });
  assert.deepEqual(calls, [
    ["image", { autoRun: true }],
    ["video", { autoRun: true }],
  ]);
});

test("project studio actions open panels through injected setters", () => {
  const calls = [];
  const actions = buildProjectStudioActions({
    setShowDashboard: (value) => calls.push(["dashboard", value]),
    setShowQueue: (value) => calls.push(["queue", value]),
    openSettingsPanel: (focus) => calls.push(["settings", focus]),
    setShowPromptFactory: (value) => calls.push(["prompt", value]),
    setShowTimeline: (value) => calls.push(["timeline", value]),
    setShowExportCenter: (value) => calls.push(["export", value]),
    runProductionReview: () => calls.push(["review", true]),
    uploadActiveShotImage: (imageUrl) => calls.push(["upload", imageUrl]),
    uploadActiveShotVideo: (videoUrl) => calls.push(["videoUpload", videoUrl]),
  });

  actions.openDashboard();
  actions.openQueue();
  actions.openSettings();
  actions.openPromptFactory();
  actions.openTimeline();
  actions.runReview();
  actions.uploadShotImage("data:image/png;base64,abc");
  actions.uploadShotVideo("data:video/mp4;base64,abc");
  actions.openExport();

  assert.deepEqual(calls, [
    ["dashboard", true],
    ["queue", true],
    ["settings", "root"],
    ["prompt", true],
    ["timeline", true],
    ["review", true],
    ["upload", "data:image/png;base64,abc"],
    ["videoUpload", "data:video/mp4;base64,abc"],
    ["export", true],
  ]);
});

test("project studio timeline action prefers the production workbench view", () => {
  const calls = [];
  const actions = buildProjectStudioActions({
    openProductionStudioView: (view, message) => {
      calls.push(["studioView", view, message]);
      return { ok: true };
    },
    setShowTimeline: (value) => calls.push(["timeline", value]),
  });

  actions.openTimeline();

  assert.deepEqual(calls, [["studioView", "timeline", "已打开生产工作台时间线。"]]);
});

test("project studio actions prefer production delivery planner", () => {
  const calls = [];
  const actions = buildProjectStudioActions({
    planProductionDelivery: () => calls.push(["delivery", true]),
    setShowExportCenter: (value) => calls.push(["export", value]),
  });

  actions.openExport();

  assert.deepEqual(calls, [["delivery", true]]);
});

test("project studio actions expose targeted retry and asset candidate commands", () => {
  const calls = [];
  const actions = buildProjectStudioActions({
    stopGenerationQueue: () => calls.push(["stop"]),
    retryQueueJobs: (ids) => calls.push(["retryQueueJobs", ids]),
    retryQueueJobsWithProvider: (ids, provider) => calls.push(["retryProvider", ids, provider]),
    skipQueueJobs: (ids) => calls.push(["skip", ids]),
    retryFailedJobs: () => calls.push(["retryFailedJobs"]),
    updateStudioShotPrompt: (shot, patch) => calls.push(["prompt", shot.id, patch.imagePrompt]),
    rewriteStudioShotPrompt: (shot, kind) => calls.push(["rewrite", shot.id, kind]),
    setPrimaryAssetImage: (asset, candidate) => calls.push(["primary", asset.id, candidate.imageUrl]),
    discardAssetImageCandidate: (asset, candidate) => calls.push(["discard", asset.id, candidate.imageUrl]),
    setPrimaryShotMedia: (shot, kind, candidate) => calls.push(["shotPrimary", shot.id, kind, candidate.url]),
    discardShotMediaCandidate: (shot, kind, candidate) => calls.push(["shotDiscard", shot.id, kind, candidate.url]),
    queueMultiEpisodeDelivery: (options) => calls.push(["batchDelivery", options.format]),
    exportAssetsAndStoryboard: () => calls.push(["exportAssetsStoryboard"]),
    runFullChainCheck: () => calls.push(["chain"]),
    runSystemSelfCheck: () => calls.push(["self"]),
    repairMediaIntegrity: () => calls.push(["media"]),
    repairAssetConsistency: () => calls.push(["assets"]),
    focusMainChain: () => calls.push(["focus"]),
    importProjectResources: () => calls.push(["importResources"]),
  });

  actions.stopQueue();
  actions.retryQueueJobs(["job-1"]);
  actions.retryQueueJobsWithProvider(["job-1"], "comfy");
  actions.skipQueueJobs(["job-2"]);
  actions.retryFailedJobs();
  actions.updateShotPrompt({ id: "S01" }, { imagePrompt: "new" });
  actions.rewriteShotPrompt({ id: "S01" }, "video");
  actions.setPrimaryAssetImage({ id: "asset-1" }, { imageUrl: "asset://a.png" });
  actions.discardAssetImageCandidate({ id: "asset-1" }, { imageUrl: "asset://b.png" });
  actions.setPrimaryShotMedia({ id: "S01" }, "video", { url: "asset://a.mp4" });
  actions.discardShotMediaCandidate({ id: "S01" }, "video", { url: "asset://b.mp4" });
  actions.queueMultiEpisodeDelivery({ format: "both" });
  actions.exportAssetsAndStoryboard();
  actions.runFullChainCheck();
  actions.runSystemSelfCheck();
  actions.repairMediaIntegrity();
  actions.repairAssetConsistency();
  actions.focusMainChain();
  actions.importResources();

  assert.deepEqual(calls, [
    ["stop"],
    ["retryQueueJobs", ["job-1"]],
    ["retryProvider", ["job-1"], "comfy"],
    ["skip", ["job-2"]],
    ["retryFailedJobs"],
    ["prompt", "S01", "new"],
    ["rewrite", "S01", "video"],
    ["primary", "asset-1", "asset://a.png"],
    ["discard", "asset-1", "asset://b.png"],
    ["shotPrimary", "S01", "video", "asset://a.mp4"],
    ["shotDiscard", "S01", "video", "asset://b.mp4"],
    ["batchDelivery", "both"],
    ["exportAssetsStoryboard"],
    ["chain"],
    ["self"],
    ["media"],
    ["assets"],
    ["focus"],
    ["importResources"],
  ]);
});

test("project studio actions tolerate missing dependencies", () => {
  const actions = buildProjectStudioActions();

  assert.doesNotThrow(() => actions.openAdvancedCanvas());
  assert.doesNotThrow(() => actions.saveProject());
  assert.equal(actions.generateText("x"), undefined);
});
