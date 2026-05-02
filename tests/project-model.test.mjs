import test from "node:test";
import assert from "node:assert/strict";
import {
  applyImageResultToProject,
  applyTaskResultToProject,
  applyTextPackageToProject,
  applyVideoResultToProject,
  buildShotPatchFromBusinessShot,
  createCommercialProject,
  discardAssetImageCandidateInProject,
  discardShotMediaCandidateInProject,
  queueEpisodeImageTasks,
  queueEpisodeVideoTasks,
  selectActiveEpisode,
  selectEpisodeShot,
  setAssetPrimaryImageInProject,
  setShotPrimaryMediaInProject,
  updateShotReviewStatusInProject,
  updateEpisode,
} from "../src/domain/project-model.js";

function textPackage() {
  return {
    ok: true,
    novelText: "雨夜旧车站",
    pipeline: { script: "第一场：雨夜旧车站" },
    assetPatch: {
      characters: [{ name: "林舟", token: "@角色_林舟" }],
      scenes: [{ name: "旧车站", token: "@场景_旧车站" }],
      props: [],
    },
    shotPatch: {
      shots: [
        {
          id: "S01",
          imagePrompt: "雨夜车站首帧",
          videoPrompt: "镜头推进",
          imageRuntimeModel: "sdxl",
          videoRuntimeModel: "wan-video",
          mainCharacterToken: "@角色_林舟",
          mainSceneToken: "@场景_旧车站",
          assetRefs: ["@角色_林舟", ""],
        },
        { id: "S02", imagePrompt: "钥匙特写", videoPrompt: "光线闪动", imageResultUrl: "existing.png" },
      ],
    },
  };
}

test("project model creates a normalized business project", () => {
  const project = createCommercialProject({
    id: "p1",
    name: "商业项目",
    activeEpisodeId: "e2",
    episodes: [
      { id: "e1", title: "第一集" },
      { id: "e2", title: "第二集", assets: [{ type: "character" }], shots: [{ id: "S01" }] },
    ],
  });

  assert.equal(project.id, "p1");
  assert.equal(project.activeEpisode.title, "第二集");
  assert.equal(project.totals.episodes, 2);
  assert.equal(project.totals.assets, 1);
  assert.equal(project.totals.shots, 1);
  assert.equal(selectActiveEpisode(project).id, "e2");
});

test("project model applies text packages to the active episode", () => {
  const project = createCommercialProject({
    activeEpisodeId: "e1",
    episodes: [{ id: "e1", title: "第一集" }],
  });
  const next = applyTextPackageToProject(project, "e1", textPackage());

  assert.equal(next.activeEpisode.sourceText, "雨夜旧车站");
  assert.equal(next.activeEpisode.script, "第一场：雨夜旧车站");
  assert.equal(next.activeEpisode.assetCounts.characters, 1);
  assert.equal(next.activeEpisode.shots.length, 2);
  assert.equal(next.activeEpisode.status.textReady, true);
});

test("project model plans business-addressed image and video tasks", () => {
  const project = applyTextPackageToProject(createCommercialProject({
    activeEpisodeId: "e1",
    episodes: [{ id: "e1", title: "第一集" }],
  }), "e1", textPackage());

  const imageTasks = queueEpisodeImageTasks(project.activeEpisode, { providerMode: "custom" });
  const videoTasks = queueEpisodeVideoTasks(project.activeEpisode);

  assert.equal(imageTasks.length, 1);
  assert.equal(imageTasks[0].type, "shot.image");
  assert.equal(imageTasks[0].episodeId, "e1");
  assert.equal(imageTasks[0].shotId, "S01");
  assert.equal(imageTasks[0].providerMode, "api");
  assert.equal(imageTasks[0].imageRuntimeModel, "sdxl");
  assert.equal(imageTasks[0].mainCharacterToken, "@角色_林舟");
  assert.deepEqual(imageTasks[0].assetRefs, ["@角色_林舟"]);
  assert.equal(videoTasks.length, 2);
  assert.equal(videoTasks[0].type, "shot.video");
  assert.equal(videoTasks[0].videoRuntimeModel, "wan-video");
  assert.equal(videoTasks[0].mainSceneToken, "@场景_旧车站");
});

test("project model enriches shot prompts with episode asset continuity", () => {
  const episode = {
    id: "ep-lock",
    assets: [
      {
        token: "@角色_林舟",
        type: "character",
        name: "林舟",
        visualLock: "红色外套，短发",
        continuityRule: "保持脸型和服装一致",
        imageUrl: "asset://linzhou.png",
      },
      {
        token: "@场景_旧车站",
        type: "scene",
        name: "旧车站",
        prompt: "潮湿站台，蓝绿色灯光",
      },
    ],
    shots: [{
      id: "S01",
      imagePrompt: "雨夜车站",
      videoPrompt: "镜头推进",
      mainCharacterToken: "@角色_林舟",
      mainSceneToken: "@场景_旧车站",
      assetRefs: ["@角色_林舟", "@场景_旧车站"],
    }],
  };

  const [imageTask] = queueEpisodeImageTasks(episode);
  const [videoTask] = queueEpisodeVideoTasks(episode);

  assert.match(imageTask.prompt, /连续性锁定（图片）/);
  assert.match(imageTask.prompt, /红色外套/);
  assert.match(imageTask.prompt, /asset:\/\/linzhou\.png/);
  assert.match(videoTask.prompt, /连续性锁定（视频）/);
  assert.match(videoTask.prompt, /只描述运动/);
});

test("project model gives node-free business shots a stable projected source id", () => {
  const episode = {
    id: "ep-clean",
    shots: [
      { id: "S01", imagePrompt: "雨夜街口", videoPrompt: "缓慢推进" },
    ],
  };
  const [imageTask] = queueEpisodeImageTasks(episode);
  const [videoTask] = queueEpisodeVideoTasks(episode);

  assert.equal(imageTask.sourceNodeId, "episode-ep-clean-shots");
  assert.equal(videoTask.sourceNodeId, "episode-ep-clean-shots");
});

test("project model applies image and video results through business ids", () => {
  const project = applyTextPackageToProject(createCommercialProject({
    activeEpisodeId: "e1",
    episodes: [{ id: "e1", title: "第一集" }],
  }), "e1", textPackage());

  const withImage = applyImageResultToProject(project, {
    episodeId: "e1",
    shotId: "S01",
    result: { imagePath: "s01.png" },
  });
  const withVideo = applyVideoResultToProject(withImage, {
    episodeId: "e1",
    shotId: "S01",
    result: { videoPath: "s01.mp4" },
  });

  assert.equal(withImage.activeEpisode.shots[0].imageResultUrl, "s01.png");
  assert.equal(withImage.activeEpisode.shots[0].imageItems.length, 1);
  assert.equal(withVideo.activeEpisode.shots[0].videoResultUrl, "s01.mp4");
  assert.equal(withVideo.activeEpisode.shots[0].videoItems.length, 1);
  assert.equal(withVideo.activeEpisode.status.videosReady, 1);
});

test("project model applies queue task results and exposes legacy shot patches", () => {
  const project = applyTextPackageToProject(createCommercialProject({
    activeEpisodeId: "e1",
    episodes: [{ id: "e1", title: "第一集" }],
  }), "e1", textPackage());
  const [imageTask] = queueEpisodeImageTasks(project.activeEpisode);

  const withImage = applyTaskResultToProject(project, {
    task: imageTask,
    result: { imagePath: "s01.png" },
  });
  const shot = selectEpisodeShot(withImage, "e1", "S01");
  const patch = buildShotPatchFromBusinessShot(shot);

  assert.equal(shot.imageResultUrl, "s01.png");
  assert.equal(patch.imageResultUrl, "s01.png");
  assert.equal(patch.lastQueueResult, "s01.png");
  assert.equal(patch.status, "待生视频");
});

test("project model closes review repair tasks after regenerated media", () => {
  const project = applyTextPackageToProject(createCommercialProject({
    activeEpisodeId: "e1",
    episodes: [{ id: "e1", title: "第一集" }],
  }), "e1", textPackage());
  const rejected = updateShotReviewStatusInProject(project, {
    episodeId: "e1",
    shotId: "S01",
    reviewStatus: "待修改",
    comment: "画面不连续",
  });
  const [imageTask] = queueEpisodeImageTasks(rejected.activeEpisode);
  const repaired = applyTaskResultToProject(rejected, {
    task: { ...imageTask, reviewRepair: true, reviewComment: "画面不连续" },
    result: { imagePath: "s01-fix.png" },
  });
  const shot = selectEpisodeShot(repaired, "e1", "S01");

  assert.equal(rejected.activeEpisode.tasks[0].type, "review.repair");
  assert.equal(rejected.activeEpisode.shots[0].reviewHistory.length, 1);
  assert.equal(rejected.activeEpisode.shots[0].reviewRepairSuggestion.suggestions.length > 0, true);
  assert.equal(shot.reviewStatus, "待复审");
  assert.equal(repaired.activeEpisode.tasks[0].status, "done");
});

test("project model preserves display urls for uploaded shot images", () => {
  const project = applyTextPackageToProject(createCommercialProject({
    activeEpisodeId: "e1",
    episodes: [{ id: "e1", title: "第一集" }],
  }), "e1", textPackage());
  const [imageTask] = queueEpisodeImageTasks(project.activeEpisode);

  const withImage = applyTaskResultToProject(project, {
    task: imageTask,
    result: {
      imagePath: "C:/cache/s01.png",
      imageUrl: "asset://C:/cache/s01.png",
      imageThumbnailUrl: "asset://C:/cache/s01-thumb.png",
      imageThumbnailPath: "C:/cache/s01-thumb.png",
    },
  });
  const shot = selectEpisodeShot(withImage, "e1", "S01");
  const patch = buildShotPatchFromBusinessShot(shot);

  assert.equal(shot.imageResultUrl, "C:/cache/s01.png");
  assert.equal(shot.imageUrl, "asset://C:/cache/s01.png");
  assert.equal(shot.imageThumbnailUrl, "asset://C:/cache/s01-thumb.png");
  assert.equal(patch.imageResultUrl, "asset://C:/cache/s01.png");
  assert.equal(patch.imageUrl, "asset://C:/cache/s01.png");
  assert.equal(patch.imageThumbnailUrl, "asset://C:/cache/s01-thumb.png");
});

test("project model preserves display urls for uploaded asset images", () => {
  const project = applyTextPackageToProject(createCommercialProject({
    activeEpisodeId: "e1",
    episodes: [{ id: "e1", title: "第一集" }],
  }), "e1", textPackage());

  const withAssetImage = applyTaskResultToProject(project, {
    task: {
      type: "asset.image",
      episodeId: "e1",
      targetType: "asset",
      targetId: "@角色_林舟",
      sourceAssetToken: "@角色_林舟",
    },
    result: {
      imagePath: "C:/cache/linzhou.png",
      imageUrl: "asset://C:/cache/linzhou.png",
      imageThumbnailUrl: "asset://C:/cache/linzhou-thumb.png",
      imageThumbnailPath: "C:/cache/linzhou-thumb.png",
    },
  });
  const asset = withAssetImage.activeEpisode.assets.find((item) => item.token === "@角色_林舟");

  assert.equal(asset.image, "C:/cache/linzhou.png");
  assert.equal(asset.imagePath, "C:/cache/linzhou.png");
  assert.equal(asset.imageUrl, "asset://C:/cache/linzhou.png");
  assert.equal(asset.imageThumbnailUrl, "asset://C:/cache/linzhou-thumb.png");
  assert.equal(asset.imageItems[0].imageUrl, "asset://C:/cache/linzhou.png");
});

test("project model backfills shot asset bindings after asset image results", () => {
  const project = createCommercialProject({
    activeEpisodeId: "e1",
    episodes: [{
      id: "e1",
      title: "第一集",
      script: "林舟进入旧车站",
      assets: [
        { id: "char-1", type: "character", token: "@角色_林舟", name: "林舟" },
        { id: "scene-1", type: "scene", token: "@场景_旧车站", name: "旧车站", prompt: "雨夜旧车站" },
      ],
      shots: [
        { id: "S01", imagePrompt: "林舟站在旧车站入口", videoPrompt: "镜头推进", assetRefs: [] },
      ],
    }],
  });

  const next = applyTaskResultToProject(project, {
    task: {
      type: "asset.image",
      episodeId: "e1",
      targetType: "asset",
      targetId: "@角色_林舟",
      sourceAssetToken: "@角色_林舟",
    },
    result: { imagePath: "C:/cache/linzhou.png", imageUrl: "asset://linzhou.png" },
  });
  const shot = next.activeEpisode.shots[0];
  const character = next.activeEpisode.assets.find((asset) => asset.token === "@角色_林舟");

  assert.equal(shot.mainCharacterToken, "@角色_林舟");
  assert.equal(shot.mainSceneToken, "@场景_旧车站");
  assert.deepEqual(shot.assetRefs, ["@角色_林舟", "@场景_旧车站"]);
  assert.equal(character.lifecycle, "locked");
});

test("project model manages asset image candidates without losing the primary image", () => {
  const project = applyTextPackageToProject(createCommercialProject({
    activeEpisodeId: "e1",
    episodes: [{ id: "e1", title: "第一集" }],
  }), "e1", textPackage());
  const withFirst = applyTaskResultToProject(project, {
    task: { type: "asset.image", episodeId: "e1", targetType: "asset", targetId: "@角色_林舟", sourceAssetToken: "@角色_林舟" },
    result: { imagePath: "C:/cache/a.png", imageUrl: "asset://a.png" },
  });
  const withSecond = applyTaskResultToProject(withFirst, {
    task: { type: "asset.image", episodeId: "e1", targetType: "asset", targetId: "@角色_林舟", sourceAssetToken: "@角色_林舟" },
    result: { imagePath: "C:/cache/b.png", imageUrl: "asset://b.png" },
  });
  const regeneratedAsset = withSecond.activeEpisode.assets.find((item) => item.token === "@角色_林舟");

  assert.equal(regeneratedAsset.imageUrl, "asset://b.png");
  assert.equal(regeneratedAsset.imagePath, "C:/cache/b.png");
  assert.equal(regeneratedAsset.imageItems.find((item) => item.imageUrl === "asset://b.png").primary, true);

  const promoted = setAssetPrimaryImageInProject(withSecond, {
    episodeId: "e1",
    assetId: "@角色_林舟",
    candidate: { imageUrl: "asset://a.png", imagePath: "C:/cache/a.png" },
  });
  const discarded = discardAssetImageCandidateInProject(promoted, {
    episodeId: "e1",
    assetId: "@角色_林舟",
    candidate: { imageUrl: "asset://b.png", imagePath: "C:/cache/b.png" },
  });
  const asset = discarded.activeEpisode.assets.find((item) => item.token === "@角色_林舟");

  assert.equal(asset.imageUrl, "asset://a.png");
  assert.equal(asset.imagePath, "C:/cache/a.png");
  assert.equal(asset.imageItems.find((item) => item.imageUrl === "asset://a.png").primary, true);
  assert.equal(asset.imageItems.some((item) => item.imageUrl === "asset://b.png"), false);
  assert.equal(asset.images.includes("asset://b.png"), false);
  assert.equal(asset.discardedImageKeys.includes("asset://b.png"), true);
});

test("project model promotes and discards shot media versions", () => {
  const project = applyTextPackageToProject(createCommercialProject({
    activeEpisodeId: "e1",
    episodes: [{ id: "e1", title: "第一集" }],
  }), "e1", textPackage());
  const withFirst = applyTaskResultToProject(project, {
    task: { type: "shot.image", episodeId: "e1", shotId: "S01" },
    result: { imagePath: "a.png", imageUrl: "asset://a.png" },
  });
  const withSecond = applyTaskResultToProject(withFirst, {
    task: { type: "shot.image", episodeId: "e1", shotId: "S01" },
    result: { imagePath: "b.png", imageUrl: "asset://b.png" },
  });
  const promoted = setShotPrimaryMediaInProject(withSecond, {
    episodeId: "e1",
    shotId: "S01",
    kind: "image",
    candidate: { imageUrl: "asset://a.png", imagePath: "a.png" },
  });
  const discarded = discardShotMediaCandidateInProject(promoted, {
    episodeId: "e1",
    shotId: "S01",
    kind: "image",
    candidate: { imageUrl: "asset://b.png", imagePath: "b.png" },
  });
  const shot = discarded.activeEpisode.shots[0];

  assert.equal(shot.imageUrl, "asset://a.png");
  assert.equal(shot.imageItems.find((item) => item.imageUrl === "asset://a.png").primary, true);
  assert.equal(shot.imageItems.some((item) => item.imageUrl === "asset://b.png"), false);
});

test("project model updateEpisode keeps totals and active episode fresh", () => {
  const project = createCommercialProject({
    activeEpisodeId: "e1",
    episodes: [{ id: "e1", title: "第一集" }],
  });
  const next = updateEpisode(project, "e1", (episode) => ({
    ...episode,
    shots: [{ id: "S01" }, { id: "S02" }],
  }));

  assert.equal(next.activeEpisode.shots.length, 2);
  assert.equal(next.totals.shots, 2);
});
