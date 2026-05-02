import assert from "node:assert/strict";
import test from "node:test";

import { createProductionAssistHelpers } from "../src/production-assist-helpers.js";

const helpers = createProductionAssistHelpers({
  extractAssetTokens: (text) => [...String(text || "").matchAll(/@[^\s，、]+/g)].map((match) => match[0]),
  normalizeShotRecord: (shot) => ({
    status: "待写",
    reviewStatus: "未审",
    reviewComments: [],
    ...shot,
  }),
  now: () => 123456,
  randomId: () => "abcd",
});

test("director suggestions include asset tokens and shot context", () => {
  assert.equal(
    helpers.buildDirectorImageSuggestion({
      imagePrompt: "@角色_阿青 正面",
      videoPrompt: "@场景_街巷 推镜",
      scene: "雨夜街巷",
      shotSize: "近景",
      action: "抬头看向灯牌",
    }),
    "@角色_阿青、@场景_街巷，场景：雨夜街巷，景别：近景，动作瞬间：抬头看向灯牌，保持主体稳定、背景层次清楚、不要漂移",
  );

  assert.equal(helpers.suggestCameraMove({ shotSize: "特写" }), "轻微推进");
  assert.equal(helpers.suggestCameraMove({ shotSize: "远景" }), "缓慢横移");
  assert.equal(helpers.suggestShotAction({ scene: "控制室" }), "角色在控制室中完成单一动作，动作起点和终点都清楚");
});

test("timeline backfill infers statuses from approval and media", () => {
  assert.equal(helpers.inferTimelineBackfillShotStatus({ approvalStatus: "已通过" }, {}), "已确认");
  assert.equal(helpers.inferTimelineBackfillReviewStatus({ approvalStatus: "退回修改" }, {}), "待修改");
  assert.equal(helpers.inferTimelineBackfillShotStatus({ mediaUrl: "clip.mp4" }, { videoPrompt: "move" }), "已生成");
  assert.equal(helpers.inferTimelineBackfillShotStatus({ mediaUrl: "image.png" }, { videoPrompt: "move" }), "待生视频");
});

test("timeline backfill patch writes media, decision, and review comment", () => {
  const patch = helpers.buildTimelineBackfillPatch({
    approvalStatus: "退回修改",
    approvalNote: "主体漂移",
    mediaUrl: "clip.mp4",
    mediaType: "video",
    scene: "天台",
    duration: "5秒",
  }, {
    id: "S01",
    videoPrompt: "运镜",
    reviewComments: [],
  });

  assert.equal(patch.status, "待修改");
  assert.equal(patch.reviewStatus, "待修改");
  assert.equal(patch.resultDecision, "rework");
  assert.equal(patch.resultDecisionAt, 123456);
  assert.equal(patch.reworkReason, "主体漂移");
  assert.equal(patch.videoResultUrl, "clip.mp4");
  assert.equal(patch.reviewComments[0].id, "review-123456-abcd");
  assert.equal(patch.reviewComments[0].text, "时间线验收：退回修改 · 主体漂移");
});

test("timeline backfill diff reports changed keys", () => {
  const diff = helpers.computeTimelineBackfillDiff({
    approvalStatus: "已通过",
    mediaUrl: "image.png",
    mediaType: "image",
  }, {
    status: "待生图",
    reviewStatus: "未审",
    reviewComments: [],
  }, {
    approvalOnly: true,
  });

  assert.equal(diff.needsBackfill, true);
  assert.equal(diff.addsComment, true);
  assert.equal(diff.changedKeys.includes("status"), true);
  assert.equal(diff.changedKeys.includes("lastQueueResult"), false);
});
