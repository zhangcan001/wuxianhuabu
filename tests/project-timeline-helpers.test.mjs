import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEpisodeExportBundle,
  buildEpisodeRenderRequest,
  buildEpisodeTimelineSources,
  buildProjectExportSummary,
  buildTimelineRenderReadinessReport,
  createTimelineClip,
  getEpisodeTimeline,
  normalizeTimelineState,
} from "../src/project-timeline-helpers.js";

function defaultEpisodeTimeline() {
  return { clips: [] };
}

test("normalizeTimelineState hydrates per-episode defaults", () => {
  const state = normalizeTimelineState({
    byEpisode: {
      ep1: { clips: [{ shotId: "S01" }] },
    },
  }, "ep2", { defaultEpisodeTimeline });

  assert.equal(state.byEpisode.ep1.clips[0].title, "S01");
  assert.deepEqual(state.byEpisode.ep2, defaultEpisodeTimeline());
  assert.equal(getEpisodeTimeline(state, "ep1", { defaultEpisodeTimeline }).clips.length, 1);
});

test("buildEpisodeTimelineSources expands note and picks result media", () => {
  const sources = buildEpisodeTimelineSources([
    {
      id: "shot-node-1",
      type: "shotList",
      data: {
        episodeId: "ep1",
        shots: [{ id: "S01", scene: "街道", referenceResources: "@资源_街景" }],
      },
    },
  ], "ep1", { items: [] }, {
    normalizeShotRecord: (shot) => shot,
    pickTimelineResultUrl: () => "https://demo/image.png",
    expandResourceReferences: (text) => `${text}：夜景街道`,
  });

  assert.deepEqual(sources[0], {
    shotId: "S01",
    sourceNodeId: "shot-node-1",
    title: "S01",
    scene: "街道",
    duration: "4秒",
    transition: "直切",
    mediaUrl: "https://demo/image.png",
    mediaPath: "",
    mediaType: "image",
    note: "@资源_街景：夜景街道",
  });
});

test("buildEpisodeTimelineSources keeps Comfy preview url separate from local path", () => {
  const sources = buildEpisodeTimelineSources([
    {
      id: "shot-node-1",
      type: "shotList",
      data: {
        episodeId: "ep1",
        shots: [{
          id: "S01",
          imageResultUrl: "asset://C:/cache/comfy.png",
          imagePath: "C:/cache/comfy.png",
          lastQueueResult: "C:/cache/comfy.png",
        }],
      },
    },
  ], "ep1", { items: [] }, {
    normalizeShotRecord: (shot) => shot,
  });

  assert.equal(sources[0].mediaUrl, "asset://C:/cache/comfy.png");
  assert.equal(sources[0].mediaPath, "C:/cache/comfy.png");
  assert.equal(sources[0].mediaType, "image");
});

test("buildEpisodeExportBundle summarizes image and video readiness", () => {
  const bundle = buildEpisodeExportBundle(
    { id: "ep1", name: "第 1 集" },
    {
      clips: [
        { id: "clip-1", shotId: "S01", title: "镜头1", duration: "4秒", mediaUrl: "a.png", approvalStatus: "已通过" },
      ],
    },
    [
      { id: "S01", reviewStatus: "已通过", assetRefs: ["@角色_主角"], referenceResources: "@资源_街景" },
    ],
    { items: [{ token: "@资源_街景", name: "街景", kind: "image", note: "" }] },
    {
      defaultEpisodeTimeline,
      formatTimelineText: () => "# 第 1 集 时间线",
      buildPublishingPlan: (clips, shots, aspectRatio) => ({ aspectRatio, clipCount: clips.length, shotCount: shots.length }),
      normalizeShotRecord: (shot) => shot,
      buildShotQualityReport: () => ({ score: 90, summary: "ok" }),
      extractAssetTokens: () => [],
      buildProjectArchiveBundle: () => ({ entries: [{ kind: "manifest" }] }),
      parseDurationSeconds: () => 4,
    },
  );

  assert.equal(bundle.durationText, "4 秒");
  assert.equal(bundle.qualityCheck.readyToRender, true);
  assert.equal(bundle.archiveCount, 1);
  assert.equal(bundle.aspectTargets.length, 2);
});

test("buildEpisodeRenderRequest carries only clips and render settings", () => {
  const request = buildEpisodeRenderRequest(
    { id: "ep1", name: "第 1 集" },
    {
      clips: [{ title: "镜头1", mediaUrl: "a.png", duration: "4秒", mediaType: "image" }],
    },
    { items: [] },
    {
      parseDurationSeconds: () => 4,
      createRenderRequestId: () => "render-1",
    },
  );

  assert.equal(request.requestId, "render-1");
  assert.equal(request.clips[0].durationSeconds, 4);
  assert.equal(request.episodeName, "第 1 集");
  assert.equal(typeof request.fps, "number");
  assert.equal(typeof request.width, "number");
  assert.equal(typeof request.height, "number");
});

test("buildEpisodeRenderRequest prefers local mediaPath for desktop rendering", () => {
  const request = buildEpisodeRenderRequest(
    { id: "ep1", name: "第一集" },
    {
      clips: [{
        title: "镜头1",
        mediaUrl: "asset://C:/cache/comfy.png",
        mediaPath: "C:/cache/comfy.png",
        duration: "4秒",
        mediaType: "image",
      }],
    },
    {},
    { parseDurationSeconds: () => 4, requestId: "render-1" },
  );

  assert.equal(request.clips[0].mediaUrl, "C:/cache/comfy.png");
});

test("buildTimelineRenderReadinessReport blocks partial or invalid renders", () => {
  const report = buildTimelineRenderReadinessReport({
    clips: [
      { id: "clip-1", title: "完整镜头", duration: "4秒", mediaUrl: "a.png" },
      { id: "clip-2", title: "缺素材", duration: "3秒", mediaUrl: "" },
      { id: "clip-3", title: "坏时长", duration: "0秒", mediaUrl: "b.png" },
    ],
  }, {
    parseDurationSeconds: (text) => Number(String(text).replace(/[^0-9.]/g, "")),
  });

  assert.equal(report.canRender, false);
  assert.equal(report.renderableClips, 1);
  assert.deepEqual(report.missingMediaClips, ["缺素材"]);
  assert.deepEqual(report.invalidDurationClips, ["坏时长"]);
  assert.match(report.issues.join("；"), /缺少素材：缺素材/);
});

test("buildProjectExportSummary reports delivery blockers", () => {
  const summary = buildProjectExportSummary([{ id: "ep1", name: "第 1 集" }], {
    byEpisode: {
      ep1: {
        clips: [{ duration: "4秒", mediaUrl: "", approvalStatus: "待验收" }],
      },
    },
  }, {
    getEpisodeTimeline,
    parseDurationSeconds: () => 4,
    defaultEpisodeTimeline,
  });

  assert.equal(summary[0].ready, false);
  assert.deepEqual(summary[0].deliveryIssues, ["片段素材未挂全", "时间线片段未全部通过验收"]);
});

test("createTimelineClip assigns clip id and normalizes fields", () => {
  const clip = createTimelineClip({ shotId: "S08", duration: "5秒" }, 3);
  assert.equal(clip.shotId, "S08");
  assert.equal(clip.duration, "5秒");
  assert.match(clip.id, /^clip-/);
});
