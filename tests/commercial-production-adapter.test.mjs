import assert from "node:assert/strict";
import test from "node:test";
import {
  bootstrapProductionOSFromCommercialProject,
  planEpisodeProduction,
} from "../src/application/use-cases/production-use-cases.js";
import {
  commercialProjectToProductionProject,
  productionProjectToCommercialSeed,
} from "../src/adapters/legacy-canvas/commercial-production-adapter.js";

function commercialFixture() {
  return {
    id: "commercial-1",
    name: "雨夜短剧",
    activeEpisodeId: "ep-1",
    episodes: [{
      id: "ep-1",
      title: "第一集",
      sourceText: "雨夜，快递员捡到钥匙。",
      script: "第一场：旧车站。",
      assets: [
        {
          id: "char-1",
          type: "character",
          name: "林舟",
          token: "@角色_林舟",
          prompt: "红衣快递员",
          visualLock: "红衣、短发、疲惫眼神",
          imageUrl: "linzhou.png",
        },
      ],
      shots: [
        {
          id: "S01",
          title: "雨夜车站",
          scene: "旧车站",
          action: "林舟低头捡起钥匙",
          cameraMove: "缓慢推进",
          imagePrompt: "雨夜车站首帧",
          videoPrompt: "镜头缓慢推进到钥匙",
          imageResultUrl: "C:/cache/shot.png",
          imageUrl: "asset://C:/cache/shot.png",
          assetRefs: ["@角色_林舟"],
          reviewStatus: "已通过",
        },
      ],
      tasks: [
        { id: "job-1", kind: "image", shotId: "S01", status: "已完成", prompt: "雨夜车站首帧" },
      ],
      timeline: { clips: [{ id: "clip-1", shotId: "S01", mediaUrl: "shot.png" }] },
    }],
  };
}

test("commercial adapter maps legacy business project into Production OS", () => {
  const project = commercialProjectToProductionProject(commercialFixture(), {
    outputSpec: { platform: "douyin", aspectRatio: "9:16" },
  });

  assert.equal(project.id, "commercial-1");
  assert.equal(project.name, "雨夜短剧");
  assert.equal(project.productionBible.characterContinuity, "林舟");
  assert.equal(project.productionBible.cameraLanguage, "缓慢推进");
  assert.equal(project.productionBible.outputSpec.platform, "douyin");
  assert.equal(project.activeEpisode.assets[0].lifecycle, "locked");
  assert.equal(project.activeEpisode.shots[0].prompt.video, "镜头缓慢推进到钥匙");
  assert.equal(project.activeEpisode.shots[0].image.url, "asset://C:/cache/shot.png");
  assert.equal(project.activeEpisode.tasks[0].status, "done");
});

test("commercial adapter can create a commercial seed from production project", () => {
  const productionProject = commercialProjectToProductionProject(commercialFixture());
  const seed = productionProjectToCommercialSeed(productionProject);

  assert.equal(seed.activeEpisodeId, "ep-1");
  assert.equal(seed.episodes[0].assets[0].visualLock, "红衣、短发、疲惫眼神");
  assert.equal(seed.episodes[0].shots[0].imagePrompt, "雨夜车站首帧");
  assert.equal(seed.episodes[0].tasks[0].targetId, "S01");
});

test("commercial project can bootstrap Production OS and plan remaining work", () => {
  const boot = bootstrapProductionOSFromCommercialProject({
    commercialProject: commercialFixture(),
    adapterOptions: {
      includePendingReview: true,
    },
    now: 100,
  });
  const planned = planEpisodeProduction({ project: boot.project, events: boot.events, now: 101 });

  assert.equal(boot.project.schemaVersion, "production-os.v1");
  assert.equal(boot.events[0].type, "production.bootstrap");
  assert.equal(planned.taskGraph.tasks.some((task) => task.type === "shot.video"), true);
  assert.equal(planned.taskGraph.ready.some((task) => task.type === "shot.video"), true);
});
