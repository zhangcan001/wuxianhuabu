import test from "node:test";
import assert from "node:assert/strict";
import {
  createProjectCommandService,
} from "../src/app/project-command-service.js";
import {
  createProjectStoreState,
  projectStoreReducer,
} from "../src/app/project-store.js";
import {
  applyTextPackageToProject,
  createCommercialProject,
  queueEpisodeImageTasks,
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
      shots: [{ id: "S01", imagePrompt: "雨夜车站首帧", videoPrompt: "镜头推进" }],
    },
  };
}

test("project command service commits task result before recording media ingest", () => {
  const project = applyTextPackageToProject(createCommercialProject({
    activeEpisodeId: "e1",
    episodes: [{ id: "e1", title: "第一集" }],
  }), "e1", textPackage());
  const [job] = queueEpisodeImageTasks(project.activeEpisode);
  let state = createProjectStoreState(project);
  let storedEvents = [];
  let ingestedProjectImage = "";

  const service = createProjectCommandService({
    getProject: () => state.project,
    getEvents: () => storedEvents,
    setProductionEvents: (events) => {
      storedEvents = events;
    },
    commitProjectStoreAction: (action) => {
      state = projectStoreReducer(state, action);
      return state;
    },
    productionAppService: {
      ingestMedia(input = {}) {
        ingestedProjectImage = input.commercialProject?.activeEpisode?.shots?.[0]?.imageResultUrl || "";
        return {
          events: [...(input.events || []), { type: "production.image.uploaded" }],
          ingest: { ok: true },
        };
      },
    },
  });

  const result = service.commitUploadedMedia({
    job,
    result: {
      imagePath: "C:/cache/s01.png",
      imageUrl: "asset://C:/cache/s01.png",
    },
    media: {
      kind: "image",
      sourceMode: "upload",
      target: { type: "shot", id: "S01" },
      mediaUrl: "asset://C:/cache/s01.png",
      mediaPath: "C:/cache/s01.png",
    },
  });

  assert.equal(state.project.activeEpisode.shots[0].imageResultUrl, "C:/cache/s01.png");
  assert.equal(result.patch.imageResultUrl, "asset://C:/cache/s01.png");
  assert.equal(result.patch.imageUrl, "asset://C:/cache/s01.png");
  assert.equal(ingestedProjectImage, "C:/cache/s01.png");
  assert.equal(storedEvents.length, 1);
});

test("project command service commits text package actions through the project store", () => {
  let state = createProjectStoreState(createCommercialProject({
    activeEpisodeId: "e1",
    episodes: [{ id: "e1", title: "第一集" }],
  }));
  const service = createProjectCommandService({
    getProject: () => state.project,
    commitProjectStoreAction: (action, options) => {
      assert.equal(options.materializeCanvas, true);
      state = projectStoreReducer(state, action);
      return state;
    },
  });

  const committed = service.commitTextPackage({
    action: {
      type: "applyTextPackage",
      episodeId: "e1",
      packageResult: textPackage(),
      sourceNodeIds: { shot: ["shot-node"] },
    },
  });

  assert.equal(committed.project.activeEpisode.shots.length, 1);
  assert.equal(committed.project.activeEpisode.shots[0].sourceNodeId, "shot-node");
  assert.equal(state.revision, 1);
});

test("project command service exposes timeline and review commands", () => {
  let state = createProjectStoreState(applyTextPackageToProject(createCommercialProject({
    activeEpisodeId: "e1",
    episodes: [{ id: "e1", title: "第一集" }],
  }), "e1", textPackage()));
  let events = [];
  state = projectStoreReducer(state, {
    type: "applyTaskResult",
    task: { type: "shot.video", episodeId: "e1", shotId: "S01" },
    result: { videoPath: "s01.mp4", videoUrl: "asset://s01.mp4" },
  });
  const service = createProjectCommandService({
    getProject: () => state.project,
    getEvents: () => events,
    setProductionEvents: (nextEvents) => {
      events = nextEvents;
    },
    commitProjectStoreAction: (action) => {
      state = projectStoreReducer(state, action);
      return state;
    },
  });

  service.updateShotReviewStatus({ episodeId: "e1", shotId: "S01", reviewStatus: "已通过" });
  service.syncTimelineFromShots({ episodeId: "e1" });
  service.updateTimelineClip({ episodeId: "e1", clipId: "clip-S01", patch: { duration: "8s" } });
  service.replaceEpisodeTimeline({ episodeId: "e1", timeline: { clips: [{ id: "legacy", shotId: "S01", mediaUrl: "legacy.mp4" }] } });

  assert.equal(state.project.activeEpisode.shots[0].reviewStatus, "已通过");
  assert.equal(state.project.activeEpisode.timeline.clips[0].mediaUrl, "legacy.mp4");
  assert.deepEqual(events.map((event) => event.type), [
    "production.review.status_updated",
    "production.timeline.synced",
    "production.timeline.clip_updated",
    "production.timeline.legacy_synced",
  ]);
});
