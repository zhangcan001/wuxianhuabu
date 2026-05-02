import test from "node:test";
import assert from "node:assert/strict";
import {
  createProjectStoreState,
  projectStoreReducer,
} from "../src/app/project-store.js";
import {
  createCommercialProject,
  queueEpisodeImageTasks,
} from "../src/domain/project-model.js";

function packageResult() {
  return {
    ok: true,
    novelText: "雨夜车站",
    pipeline: { script: "第一场" },
    assetPatch: {
      characters: [{ name: "林舟", token: "@角色_林舟" }],
      scenes: [{ name: "旧车站", token: "@场景_旧车站" }],
      props: [],
    },
    shotPatch: {
      shots: [{ id: "S01", imagePrompt: "车站远景", videoPrompt: "镜头推进" }],
    },
  };
}

test("project store hydrates from a project snapshot", () => {
  const state = projectStoreReducer(createProjectStoreState(), {
    type: "hydrate",
    source: "legacy",
    project: createCommercialProject({
      activeEpisodeId: "e1",
      episodes: [{ id: "e1", title: "第一集", shots: [{ id: "S01" }] }],
    }),
  });

  assert.equal(state.project.activeEpisode.id, "e1");
  assert.equal(state.project.totals.shots, 1);
  assert.equal(state.revision, 0);
  assert.equal(state.source, "legacy");
});

test("project store applies text packages with source node ids", () => {
  const hydrated = projectStoreReducer(createProjectStoreState(), {
    type: "hydrate",
    project: createCommercialProject({
      activeEpisodeId: "e1",
      episodes: [{ id: "e1", title: "第一集" }],
    }),
  });
  const state = projectStoreReducer(hydrated, {
    type: "applyTextPackage",
    episodeId: "e1",
    packageResult: packageResult(),
    sourceNodeIds: {
      novel: ["novel-node"],
      asset: ["asset-node"],
      shot: ["shot-node"],
    },
  });

  assert.equal(state.revision, 1);
  assert.equal(state.lastAction, "applyTextPackage");
  assert.equal(state.project.activeEpisode.sourceText, "雨夜车站");
  assert.equal(state.project.activeEpisode.assets[0].sourceNodeId, "asset-node");
  assert.equal(state.project.activeEpisode.shots[0].sourceNodeId, "shot-node");
});

test("project store applies task results to business shots", () => {
  const textState = projectStoreReducer(createProjectStoreState(), {
    type: "applyTextPackage",
    episodeId: "e1",
    packageResult: packageResult(),
    sourceNodeIds: { shot: ["shot-node"] },
  });
  const [task] = queueEpisodeImageTasks(textState.project.activeEpisode);
  const state = projectStoreReducer(textState, {
    type: "applyTaskResult",
    task,
    result: { imagePath: "s01.png" },
  });

  assert.equal(state.revision, 2);
  assert.equal(state.project.activeEpisode.shots[0].imageResultUrl, "s01.png");
  assert.equal(state.project.activeEpisode.status.imageReady, true);
  assert.equal(state.project.activeEpisode.timeline.clips.length, 0);
});

test("project store incrementally syncs media results to timeline", () => {
  const textState = projectStoreReducer(createProjectStoreState(), {
    type: "applyTextPackage",
    episodeId: "e1",
    packageResult: packageResult(),
  });
  const withTimeline = projectStoreReducer(textState, {
    type: "syncTimelineFromShots",
    episodeId: "e1",
  });
  const withImage = projectStoreReducer(withTimeline, {
    type: "applyTaskResult",
    task: { type: "shot.image", episodeId: "e1", shotId: "S01" },
    result: { imagePath: "s01.png", imageUrl: "asset://s01.png" },
  });
  const withVideo = projectStoreReducer(textState, {
    type: "applyTaskResult",
    task: { type: "shot.video", episodeId: "e1", shotId: "S01" },
    result: { videoPath: "s01.mp4", videoUrl: "asset://s01.mp4" },
  });

  assert.equal(withImage.project.activeEpisode.timeline.clips[0].imageUrl, "asset://s01.png");
  assert.equal(withImage.project.activeEpisode.timeline.clips[0].mediaUrl, "");
  assert.equal(withVideo.project.activeEpisode.timeline.clips[0].mediaUrl, "asset://s01.mp4");
  assert.equal(withVideo.project.activeEpisode.timeline.clips[0].videoPath, "s01.mp4");
});

test("project store applies canvas node edits to business episode", () => {
  const hydrated = projectStoreReducer(createProjectStoreState(), {
    type: "hydrate",
    project: createCommercialProject({
      activeEpisodeId: "e1",
      episodes: [{ id: "e1", title: "第一集" }],
    }),
  });
  const state = projectStoreReducer(hydrated, {
    type: "applyCanvasNode",
    node: {
      id: "shot-node",
      type: "shotList",
      data: {
        episodeId: "e1",
        shots: [{ id: "S01", imagePrompt: "车站", videoPrompt: "推进" }],
      },
    },
  });

  assert.equal(state.revision, 1);
  assert.equal(state.project.activeEpisode.shots[0].sourceNodeId, "shot-node");
  assert.equal(state.project.activeEpisode.status.shotReady, true);
});

test("project store applies asset candidate commands", () => {
  const textState = projectStoreReducer(createProjectStoreState(), {
    type: "applyTextPackage",
    episodeId: "e1",
    packageResult: packageResult(),
  });
  const first = projectStoreReducer(textState, {
    type: "applyTaskResult",
    task: { type: "asset.image", episodeId: "e1", targetType: "asset", targetId: "@角色_林舟" },
    result: { imagePath: "a.png", imageUrl: "asset://a.png" },
  });
  const second = projectStoreReducer(first, {
    type: "applyTaskResult",
    task: { type: "asset.image", episodeId: "e1", targetType: "asset", targetId: "@角色_林舟" },
    result: { imagePath: "b.png", imageUrl: "asset://b.png" },
  });
  const promoted = projectStoreReducer(second, {
    type: "setAssetPrimaryImage",
    episodeId: "e1",
    assetId: "@角色_林舟",
    candidate: { imageUrl: "asset://a.png", imagePath: "a.png" },
  });
  const discarded = projectStoreReducer(promoted, {
    type: "discardAssetImageCandidate",
    episodeId: "e1",
    assetId: "@角色_林舟",
    candidate: { imageUrl: "asset://b.png", imagePath: "b.png" },
  });
  const asset = discarded.project.activeEpisode.assets[0];

  assert.equal(asset.imageUrl, "asset://a.png");
  assert.equal(asset.imageItems.some((item) => item.imageUrl === "asset://b.png"), false);
  assert.equal(asset.images.includes("asset://b.png"), false);
  assert.equal(discarded.lastAction, "discardAssetImageCandidate");
});

test("project store applies shot media candidate commands", () => {
  const textState = projectStoreReducer(createProjectStoreState(), {
    type: "applyTextPackage",
    episodeId: "e1",
    packageResult: packageResult(),
  });
  const first = projectStoreReducer(textState, {
    type: "applyTaskResult",
    task: { type: "shot.video", episodeId: "e1", shotId: "S01" },
    result: { videoPath: "a.mp4", videoUrl: "asset://a.mp4" },
  });
  const second = projectStoreReducer(first, {
    type: "applyTaskResult",
    task: { type: "shot.video", episodeId: "e1", shotId: "S01" },
    result: { videoPath: "b.mp4", videoUrl: "asset://b.mp4" },
  });
  const promoted = projectStoreReducer(second, {
    type: "setShotPrimaryMedia",
    episodeId: "e1",
    shotId: "S01",
    kind: "video",
    candidate: { videoUrl: "asset://a.mp4", videoPath: "a.mp4" },
  });
  const discarded = projectStoreReducer(promoted, {
    type: "discardShotMediaCandidate",
    episodeId: "e1",
    shotId: "S01",
    kind: "video",
    candidate: { videoUrl: "asset://b.mp4", videoPath: "b.mp4" },
  });
  const shot = discarded.project.activeEpisode.shots[0];

  assert.equal(shot.videoUrl, "asset://a.mp4");
  assert.equal(promoted.project.activeEpisode.timeline.clips[0].mediaUrl, "asset://a.mp4");
  assert.equal(discarded.project.activeEpisode.timeline.clips[0].mediaUrl, "asset://a.mp4");
  assert.equal(shot.videoItems.some((item) => item.videoUrl === "asset://b.mp4"), false);
  assert.equal(discarded.lastAction, "discardShotMediaCandidate");
});

test("project store updates review status and syncs timeline from shots", () => {
  const textState = projectStoreReducer(createProjectStoreState(), {
    type: "applyTextPackage",
    episodeId: "e1",
    packageResult: packageResult(),
  });
  const withVideo = projectStoreReducer(textState, {
    type: "applyTaskResult",
    task: { type: "shot.video", episodeId: "e1", shotId: "S01" },
    result: { videoPath: "s01.mp4", videoUrl: "asset://s01.mp4" },
  });
  const reviewed = projectStoreReducer(withVideo, {
    type: "updateShotReviewStatus",
    episodeId: "e1",
    shotId: "S01",
    reviewStatus: "已通过",
  });
  assert.equal(reviewed.project.activeEpisode.timeline.clips[0].reviewStatus, "已通过");
  const synced = projectStoreReducer(reviewed, {
    type: "syncTimelineFromShots",
    episodeId: "e1",
  });
  const moved = projectStoreReducer(synced, {
    type: "updateTimelineClip",
    episodeId: "e1",
    clipId: "clip-S01",
    patch: { duration: "6s", reviewStatus: "已通过" },
  });
  const removed = projectStoreReducer(moved, {
    type: "updateTimelineClip",
    episodeId: "e1",
    clipId: "clip-S01",
    remove: true,
  });

  assert.equal(moved.project.activeEpisode.shots[0].reviewStatus, "已通过");
  assert.equal(moved.project.activeEpisode.shots[0].reviewer, "human");
  assert.equal(moved.project.activeEpisode.timeline.clips[0].mediaUrl, "asset://s01.mp4");
  assert.equal(moved.project.activeEpisode.timeline.clips[0].duration, "6s");
  assert.equal(moved.project.activeEpisode.timeline.clips[0].reviewStatus, "已通过");
  assert.equal(removed.project.activeEpisode.timeline.clips.length, 0);
});

test("project store replaces episode timeline from legacy editor", () => {
  const textState = projectStoreReducer(createProjectStoreState(), {
    type: "applyTextPackage",
    episodeId: "e1",
    packageResult: packageResult(),
  });
  const state = projectStoreReducer(textState, {
    type: "replaceEpisodeTimeline",
    episodeId: "e1",
    timeline: {
      clips: [{ id: "clip-legacy", shotId: "S01", mediaUrl: "legacy.mp4", approvalStatus: "已通过" }],
    },
  });

  assert.equal(state.project.activeEpisode.timeline.clips[0].mediaUrl, "legacy.mp4");
  assert.equal(state.project.activeEpisode.timeline.clips[0].reviewStatus, "已通过");
});
