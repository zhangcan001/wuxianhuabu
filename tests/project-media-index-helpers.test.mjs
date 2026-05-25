import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMediaCacheReviewDecisions,
  buildMediaCacheCleanupReport,
  buildMediaCacheReport,
  collectProjectMediaReferences,
  getMediaCacheFileKey,
  normalizeMediaPath,
} from "../src/storage/project-media-index-helpers.js";

test("normalizeMediaPath handles Windows paths and encoded asset urls", () => {
  assert.equal(
    normalizeMediaPath("C:\\Users\\ADMIN\\AppData\\media-cache\\Image.PNG"),
    "c:/users/admin/appdata/media-cache/image.png",
  );
  assert.equal(
    normalizeMediaPath("asset://localhost/C:%5Ccache%5Cmedia-cache%5Cthumbs%5Ca.png"),
    "asset://localhost/c:/cache/media-cache/thumbs/a.png",
  );
});

test("collectProjectMediaReferences finds nested local media references", () => {
  const report = collectProjectMediaReferences({
    nodes: [
      {
        id: "n1",
        data: {
          imagePath: "C:\\App\\media-cache\\hero.png",
          imageUrl: "asset://localhost/C:%5CApp%5Cmedia-cache%5Chero.png",
        },
      },
    ],
    resources: [{ thumbnailPath: "C:/App/media-cache/thumbs/hero.png.thumb.png" }],
  });

  assert.equal(report.references.length, 3);
  assert.ok(report.referencedPaths.some((path) => path.includes("hero.png")));
});

test("buildMediaCacheReport separates referenced and orphan files", () => {
  const cacheFiles = [
    { path: "C:\\App\\media-cache\\hero.png", fileName: "hero.png", size: 100, isThumbnail: false },
    { path: "C:\\App\\media-cache\\orphan.png", fileName: "orphan.png", size: 50, isThumbnail: false },
    { path: "C:\\App\\media-cache\\thumbs\\hero.png.thumb.png", fileName: "hero.png.thumb.png", size: 10, isThumbnail: true },
  ];
  const report = buildMediaCacheReport({
    nodes: [{ data: { imagePath: "C:/App/media-cache/hero.png" } }],
    resources: [{ thumbnailPath: "C:/App/media-cache/thumbs/hero.png.thumb.png" }],
  }, cacheFiles);

  assert.equal(report.totalFiles, 3);
  assert.equal(report.referencedCount, 2);
  assert.equal(report.orphanCount, 1);
  assert.equal(report.orphanSize, 50);
  assert.equal(report.thumbnailCount, 1);
  assert.equal(report.referencedFiles[0].references[0].path, "project.nodes[0].data.imagePath");
});

test("buildMediaCacheCleanupReport exports stable summary and source paths", () => {
  const stale = { path: "C:/App/media-cache/stale.mp4", fileName: "stale.mp4", size: 300, modifiedAt: 124, isThumbnail: false };
  const cleanupReport = buildMediaCacheCleanupReport({
    nodes: [{ data: { videoPath: "C:/App/media-cache/clip.mp4" } }],
  }, [
    { path: "C:/App/media-cache/clip.mp4", fileName: "clip.mp4", size: 200, modifiedAt: 123, isThumbnail: false },
    stale,
  ], {
    generatedAt: "2026-04-23T00:00:00.000Z",
    reviewDecisions: { [getMediaCacheFileKey(stale)]: "keep" },
    deletionAudit: [{ deletedAt: "2026-04-23T01:00:00.000Z", deleted: ["old.png"] }],
  });

  assert.equal(cleanupReport.generatedAt, "2026-04-23T00:00:00.000Z");
  assert.equal(cleanupReport.summary.referencedCount, 1);
  assert.equal(cleanupReport.summary.orphanSize, 300);
  assert.equal(cleanupReport.summary.keptOrphanCount, 1);
  assert.equal(cleanupReport.referencedFiles[0].references[0].path, "project.nodes[0].data.videoPath");
  assert.equal(cleanupReport.orphanFiles[0].fileName, "stale.mp4");
  assert.equal(cleanupReport.keptOrphanFiles[0].reviewDecision, "keep");
  assert.equal(cleanupReport.deletionAudit[0].deleted[0], "old.png");
});

test("applyMediaCacheReviewDecisions groups pending, keep and ignore decisions", () => {
  const report = {
    orphanFiles: [
      { path: "C:/App/media-cache/a.png", fileName: "a.png" },
      { path: "C:/App/media-cache/b.png", fileName: "b.png" },
      { path: "C:/App/media-cache/c.png", fileName: "c.png" },
    ],
  };
  const reviewed = applyMediaCacheReviewDecisions(report, {
    "c:/app/media-cache/a.png": "keep",
    "c:/app/media-cache/b.png": "ignore",
  });

  assert.equal(reviewed.keptOrphanFiles.length, 1);
  assert.equal(reviewed.ignoredOrphanFiles.length, 1);
  assert.equal(reviewed.pendingOrphanFiles.length, 1);
});
