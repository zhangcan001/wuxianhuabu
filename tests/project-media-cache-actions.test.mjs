import assert from "node:assert/strict";
import test from "node:test";
import {
  deleteSelectedMediaCacheFilesAction,
  exportMediaCacheCleanupReportAction,
  refreshMediaCacheIndexAction,
} from "../src/app/project-media-cache-actions.js";

test("refreshMediaCacheIndexAction stores listed files", async () => {
  let state = [];
  const result = await refreshMediaCacheIndexAction({
    listMediaCache: async () => ({ files: ["a.png", "b.mp4"] }),
    setMediaCacheFiles: (files) => {
      state = files;
    },
  });

  assert.equal(result.ok, true);
  assert.deepEqual(state, ["a.png", "b.mp4"]);
});

test("exportMediaCacheCleanupReportAction builds and saves report json", async () => {
  const saved = [];
  const report = await exportMediaCacheCleanupReportAction({
    buildMediaCacheCleanupReport: (input, files, options) => ({ input, files, options }),
    reportInput: { nodes: [] },
    mediaCacheFiles: ["orphan.png"],
    reviewDecisions: { keep: ["x"] },
    deletionAudit: [{ path: "old.png" }],
    saveExportArtifact: async (...args) => saved.push(args),
    fileName: "report.json",
  });

  assert.deepEqual(report.files, ["orphan.png"]);
  assert.equal(saved[0][0], "report.json");
  assert.equal(saved[0][1], "json");
  assert.match(saved[0][2], /orphan\.png/);
});

test("deleteSelectedMediaCacheFilesAction refreshes after deletion", async () => {
  let refreshed = false;
  const result = await deleteSelectedMediaCacheFilesAction({
    paths: ["a.png"],
    deleteMediaCacheFiles: async ({ paths }) => ({ deleted: paths.length }),
    refreshMediaCacheIndex: async () => {
      refreshed = true;
    },
  });

  assert.equal(result.deleted, 1);
  assert.equal(refreshed, true);
});
