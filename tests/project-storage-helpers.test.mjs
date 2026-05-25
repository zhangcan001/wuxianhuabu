import assert from "node:assert/strict";
import test from "node:test";
import {
  createProjectCachePayload,
  normalizeExportHistoryState,
  normalizeGenerationQueueState,
  sanitizeNodeForCache,
  sanitizeNodeForStorage,
  sanitizeSettingsForStorage,
  stringifyProjectStoragePayload,
  upsertExportHistoryEntry,
} from "../src/storage/project-storage-helpers.js";

const serializers = {
  resource: (resource, compact) => ({ id: resource.id, dataUrl: compact ? "" : resource.dataUrl }),
  timeline: (value) => value || { clips: [] },
  promptFactory: (value) => value || {},
  templateCenter: (value) => value || {},
  stylePresetCenter: (value) => value || {},
  modelParamCenter: (value) => value || {},
  exportPresetCenter: (value) => value || {},
  collaborationState: (value) => value || {},
  archiveState: (value) => value || {},
  performanceSettings: (value) => value || {},
};

test("project storage strips API keys from nodes and settings", () => {
  const node = sanitizeNodeForStorage({ type: "novelPipeline", data: { apiKey: "secret", title: "node" } });
  const settings = sanitizeSettingsForStorage({ customApiKey: "image-secret", customModel: "model" });

  assert.deepEqual(node.data, { title: "node" });
  assert.deepEqual(settings, { customModel: "model" });
});

test("cache payload removes oversized embedded images but full project payload keeps them", () => {
  const largeImage = `data:image/png;base64,${"a".repeat(20)}`;
  const project = {
    nodes: [{ id: "n1", type: "upload", data: { imageUrl: largeImage } }],
    edges: [],
    settings: { customApiKey: "secret" },
    resources: [{ id: "r1", dataUrl: largeImage }],
    exportHistory: [],
    generationQueue: [],
  };

  const cache = createProjectCachePayload(project, serializers, { imageLimit: 10 });
  const full = JSON.parse(stringifyProjectStoragePayload(project, serializers));

  assert.equal(cache.nodes[0].data.imageUrl, "");
  assert.match(cache.nodes[0].data.cacheWarning, /图片过大/);
  assert.equal(cache.resources[0].dataUrl, largeImage);
  assert.equal(full.nodes[0].data.imageUrl, largeImage);
  assert.equal(full.settings.customApiKey, undefined);
});

test("compact cache drops resource payloads", () => {
  const cache = createProjectCachePayload({
    nodes: [],
    edges: [],
    resources: [{ id: "r1", dataUrl: "data:image/png;base64,abc" }],
    exportHistory: [],
    generationQueue: [],
  }, serializers, { compact: true });

  assert.deepEqual(cache.resources, [{ id: "r1", dataUrl: "" }]);
});

test("project storage carries business project snapshot", () => {
  const businessProject = {
    id: "p1",
    activeEpisodeId: "e1",
    episodes: [{ id: "e1", title: "第一集" }],
  };
  const cache = createProjectCachePayload({
    nodes: [],
    edges: [],
    resources: [],
    exportHistory: [],
    generationQueue: [],
    businessProject,
  }, serializers);
  const full = JSON.parse(stringifyProjectStoragePayload({
    nodes: [],
    edges: [],
    resources: [],
    exportHistory: [],
    generationQueue: [],
    businessProject,
  }, serializers));

  assert.equal(cache.businessProject.id, "p1");
  assert.equal(full.businessProject.activeEpisodeId, "e1");
});

test("project storage carries production events", () => {
  const cache = createProjectCachePayload({
    nodes: [],
    edges: [],
    resources: [],
    exportHistory: [],
    generationQueue: [],
    productionEvents: [
      { type: "production.started", projectId: "p1", episodeId: "e1", payload: { ok: true } },
    ],
  }, serializers);

  assert.equal(cache.productionEvents.length, 1);
  assert.equal(cache.productionEvents[0].type, "production.started");
  assert.equal(cache.productionEvents[0].projectId, "p1");
});

test("running queue jobs recover to pending state", () => {
  const queue = normalizeGenerationQueueState([
    { status: "running", kind: "exportVideo", progress: 240, error: "interrupted" },
  ], () => 123);

  assert.equal(queue[0].status, "pending");
  assert.equal(queue[0].error, "");
  assert.equal(queue[0].progress, 100);
  assert.equal(queue[0].wasRecovered, true);
  assert.equal(queue[0].resultSummary, "上次关闭时任务未完成，已恢复待执行");
});

test("running export history recovers to interrupted state", () => {
  const history = normalizeExportHistoryState([
    { requestId: "render-1", type: "mp4", status: "running", title: "导出中" },
  ], () => 1000);

  assert.equal(history[0].status, "interrupted");
  assert.equal(history[0].wasInterrupted, true);
  assert.match(history[0].detail, /未完成/);
});

test("export history normalizes, sorts, and upserts by request id", () => {
  const history = normalizeExportHistoryState([
    { requestId: "old", updatedAt: 1, renderOptions: { aspectRatio: "9:16" } },
    { requestId: "new", updatedAt: 3 },
  ], () => 10);

  assert.equal(history[0].requestId, "new");
  assert.deepEqual(history[1].renderOptions, { aspectRatio: "9:16" });

  const next = upsertExportHistoryEntry(history, { requestId: "old", title: "rerendered" }, () => 20, () => "abc");
  assert.equal(next[0].requestId, "old");
  assert.equal(next[0].title, "rerendered");
  assert.equal(next[0].createdAt, 10);
  assert.equal(next[0].updatedAt, 20);
});

test("sanitizing a cache node handles compact mode", () => {
  const node = sanitizeNodeForCache({
    type: "upload",
    data: { panorama: "data:image/png;base64,abc" },
  }, { compact: true });

  assert.equal(node.data.panorama, "");
  assert.match(node.data.cacheWarning, /轻量缓存/);
});

test("cache sanitizing strips nested embedded media arrays in compact mode", () => {
  const node = sanitizeNodeForCache({
    type: "assetLibrary",
    data: {
      characters: [
        {
          imageUrl: "data:image/png;base64,abc",
          images: ["data:image/png;base64,def", "https://example.com/a.png"],
          rejectedImages: ["data:image/png;base64,ghi"],
        },
      ],
      result: {
        previewUrl: "data:image/png;base64,jkl",
      },
    },
  }, { compact: true });

  assert.equal(node.data.characters[0].imageUrl, "");
  assert.deepEqual(node.data.characters[0].images, ["", "https://example.com/a.png"]);
  assert.deepEqual(node.data.characters[0].rejectedImages, [""]);
  assert.equal(node.data.result.previewUrl, "");
  assert.match(node.data.cacheWarning, /轻量缓存/);
});
