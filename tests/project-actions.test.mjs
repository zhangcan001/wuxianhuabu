import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEpisodeImageQueueAction,
  buildEpisodeVideoQueueAction,
  buildStudioTextPlanAction,
} from "../src/app/project-actions.js";

test("studio text action packages store action and node targets", () => {
  const action = buildStudioTextPlanAction({
    episodeId: "e1",
    bootstrapResult: {
      created: 3,
      novelNodeId: "novel",
      assetNodeId: "asset",
      shotNodeId: "shot",
    },
    textPackage: {
      ok: true,
      summary: "完成",
      metrics: [{ label: "镜头", value: 2 }],
    },
  });

  assert.equal(action.ok, true);
  assert.equal(action.storeAction.type, "applyTextPackage");
  assert.deepEqual(action.storeAction.sourceNodeIds.shot, ["shot"]);
  assert.equal(action.nodeTargetIds.assetNodeId, "asset");
  assert.deepEqual(action.result.metrics.map((item) => item.value), [3, 2]);
});

test("studio text action reports failed package", () => {
  const action = buildStudioTextPlanAction({
    textPackage: { ok: false, error: "缺少输入" },
  });

  assert.equal(action.ok, false);
  assert.equal(action.storeAction, null);
  assert.match(action.result.summary, /缺少输入/);
});

test("episode image queue action builds business queue jobs", () => {
  const action = buildEpisodeImageQueueAction({
    id: "e1",
    shots: [
      { id: "S01", sourceNodeId: "shot-node", imagePrompt: "车站", videoPrompt: "推进" },
      { id: "S02", sourceNodeId: "shot-node", imagePrompt: "已完成", imageResultUrl: "ready.png" },
    ],
  }, {
    requireSourceNode: true,
    providerMode: "custom",
  });

  assert.equal(action.ok, true);
  assert.equal(action.jobs.length, 1);
  assert.equal(action.jobs[0].type, "shot.image");
  assert.equal(action.jobs[0].providerMode, "api");
  assert.equal(action.result.metrics[0].value, 1);
});

test("episode video queue action explains missing prompts", () => {
  const action = buildEpisodeVideoQueueAction({
    id: "e1",
    shots: [{ id: "S01", sourceNodeId: "shot-node", videoPrompt: "" }],
  }, {
    requireSourceNode: true,
  });

  assert.equal(action.ok, false);
  assert.equal(action.jobs.length, 0);
  assert.match(action.message, /视频提示词/);
});
