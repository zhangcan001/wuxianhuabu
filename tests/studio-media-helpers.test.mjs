import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStudioPackageHistoryEntry,
  buildProjectConsistencyReport,
  buildProjectMigrationReport,
  buildDeliveryManifestValidationReport,
  buildMultiEpisodeDeliverySummary,
  buildDesktopUploadPersistenceChecklist,
  buildMediaRelocationPlan,
  buildStudioDeliveryPackageContent,
  buildStudioDeliveryOutputSpec,
  buildTimelineClipMediaPatchFromShot,
  businessTimelineClipsToLegacyEpisodeTimeline,
  resolveUploadFilePath,
  shouldWarnBrowserLargeVideoUpload,
} from "../src/app/studio-media-helpers.js";

test("studio media helpers prefer desktop file paths and build platform specs", () => {
  assert.equal(resolveUploadFilePath({ path: "C:/video/s01.mp4" }), "C:/video/s01.mp4");
  assert.equal(resolveUploadFilePath({ webkitRelativePath: "fallback/s01.mp4" }), "fallback/s01.mp4");

  assert.deepEqual(buildStudioDeliveryOutputSpec({ platform: "bilibili" }), {
    platform: "bilibili",
    aspectRatio: "16:9",
    resolution: "1920x1080",
    fps: 24,
    container: "mp4",
  });
  assert.equal(buildStudioDeliveryOutputSpec({ format: "package" }).container, "zip");
  assert.equal(shouldWarnBrowserLargeVideoUpload({ type: "video/mp4", size: 300 * 1024 * 1024 }), true);
  assert.equal(buildTimelineClipMediaPatchFromShot({ videoUrl: "asset://s01.mp4" }).mediaType, "video");
  assert.equal(businessTimelineClipsToLegacyEpisodeTimeline([{ shotId: "S01", mediaUrl: "s01.mp4", reviewStatus: "已通过" }]).clips[0].approvalStatus, "已通过");
  assert.equal(buildStudioPackageHistoryEntry({ episode: { title: "第一集" }, deliveryPackage: { manifest: { fileCount: 2 } } }).detail, "manifest 2 个文件");
  assert.equal(buildProjectConsistencyReport({
    businessProject: {
      activeEpisodeId: "e1",
      activeEpisode: {
        id: "e1",
        shots: [{ id: "S01", videoUrl: "s01.mp4" }],
        timeline: { clips: [{ id: "clip-S01", shotId: "S01", mediaUrl: "s01.mp4" }] },
      },
    },
    timeline: { byEpisode: { e1: { clips: [{ id: "clip-S01", shotId: "S01", mediaUrl: "s01.mp4" }] } } },
  }).ok, true);
  const drift = buildProjectConsistencyReport({
    businessProject: {
      activeEpisodeId: "e1",
      activeEpisode: {
        id: "e1",
        shots: [
          { id: "S01", videoUrl: "fresh.mp4" },
          { id: "S02", videoUrl: "missing-from-timeline.mp4" },
        ],
        timeline: {
          clips: [
            { id: "clip-S01", shotId: "S01", mediaUrl: "old.mp4" },
            { id: "clip-S01-copy", shotId: "S01", mediaUrl: "old.mp4" },
          ],
        },
      },
    },
    timeline: { byEpisode: { e1: { clips: [{ id: "clip-S01", shotId: "S01", mediaUrl: "legacy-old.mp4" }] } } },
  });
  assert.equal(drift.ok, false);
  assert.equal(drift.issues.some((issue) => issue.includes("已有视频但未进入商业时间线")), true);
  assert.equal(drift.issues.some((issue) => issue.includes("镜头视频与商业时间线媒体不一致")), true);
  assert.equal(drift.issues.some((issue) => issue.includes("重复镜头片段")), true);
  const pkg = buildStudioDeliveryPackageContent({
    businessProject: {
      id: "p1",
      name: "项目",
      activeEpisode: {
        id: "e1",
        shots: [{ id: "S01", videoPath: "D:/old/a.mp4" }],
        assets: [],
        timeline: { clips: [] },
      },
    },
    deliveryPackage: { manifest: { fileCount: 0 }, outputSpec: { platform: "douyin" } },
  });
  assert.equal(JSON.parse(pkg).packageVersion, 1);
  assert.equal(JSON.parse(pkg).mediaReferences[0].packagePath, "media/shot/S01-001.mp4");
  assert.equal(buildMediaRelocationPlan({
    episodes: [{ id: "e1", shots: [{ id: "S01", videoPath: "D:/old/a.mp4" }] }],
    activeEpisodeId: "e1",
  }, "D:/old", "E:/new").project.episodes[0].shots[0].videoPath, "E:/new/a.mp4");
  assert.equal(buildProjectMigrationReport({
    project: { activeEpisode: { shots: [{ id: "S01", imageUrl: "data:image/png;base64,abc" }] } },
  }).embeddedRefs, 1);
  const validation = buildDeliveryManifestValidationReport({
    businessProject: { activeEpisode: { shots: [{ id: "S01", videoPath: "D:/old/a.mp4" }] } },
  });
  assert.equal(validation.ok, true);
  assert.equal(validation.totals.copyableMedia, 1);
  const multi = buildMultiEpisodeDeliverySummary({
    episodes: [
      { id: "e1", shots: [{ id: "S01", videoUrl: "s01.mp4", reviewStatus: "已通过" }], timeline: { clips: [{ mediaUrl: "s01.mp4" }] } },
      { id: "e2", shots: [{ id: "S01" }], timeline: { clips: [] } },
    ],
  });
  assert.equal(multi.ready, 1);
  assert.equal(multi.blocked, 1);
  assert.equal(buildDesktopUploadPersistenceChecklist({
    episode: { shots: [{ id: "S01", videoPath: "D:/old/a.mp4" }] },
  }).localRefs, 1);
});
