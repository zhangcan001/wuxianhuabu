import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLegacyQueueCommand,
  prepareImageQueueCommand,
  prepareStudioTextCommand,
  prepareVideoQueueCommand,
} from "../src/app/project-command-handlers.js";

test("text command handler rejects empty source text", () => {
  const command = prepareStudioTextCommand({ sourceText: "  " });

  assert.equal(command.ok, false);
  assert.equal(command.shouldBootstrap, false);
  assert.equal(command.textPackage, null);
  assert.match(command.result.summary, /请先粘贴/);
});

test("text command handler builds text package and store action", () => {
  const command = prepareStudioTextCommand({
    sourceText: " 雨夜车站 ",
    episodeId: "e1",
    bootstrapResult: {
      created: 2,
      novelNodeId: "novel",
      assetNodeId: "asset",
      shotNodeId: "shot",
    },
    createTextPackage: (text) => ({
      ok: true,
      novelText: text,
      summary: "完成",
      metrics: [{ label: "镜头", value: 1 }],
    }),
  });

  assert.equal(command.ok, true);
  assert.equal(command.text, "雨夜车站");
  assert.equal(command.textPackage.novelText, "雨夜车站");
  assert.equal(command.action.storeAction.type, "applyTextPackage");
  assert.deepEqual(command.action.storeAction.sourceNodeIds.shot, ["shot"]);
  assert.equal(command.result.metrics[0].value, 2);
});

test("text command handler reports package errors", () => {
  const command = prepareStudioTextCommand({
    sourceText: "雨夜",
    createTextPackage: () => ({ ok: false, error: "模型失败" }),
  });

  assert.equal(command.ok, false);
  assert.equal(command.shouldBootstrap, true);
  assert.match(command.message, /模型失败/);
});

test("queue command handler prefers business image jobs when source shots exist", () => {
  const command = prepareImageQueueCommand({
    episode: {
      id: "e1",
      shots: [{ id: "S01", sourceNodeId: "shot-node", imagePrompt: "车站" }],
    },
    businessOptions: { providerMode: "custom", requireSourceNode: true },
    legacyJobs: [{ kind: "image", shotId: "OLD" }],
    legacyEntryCount: 1,
  });

  assert.equal(command.source, "business");
  assert.equal(command.ok, true);
  assert.equal(command.jobs.length, 1);
  assert.equal(command.jobs[0].type, "shot.image");
  assert.equal(command.jobs[0].providerMode, "api");
});

test("queue command handler falls back to legacy jobs without business source shots", () => {
  const command = prepareVideoQueueCommand({
    episode: {
      id: "e1",
      shots: [],
    },
    legacyJobs: [{ kind: "video", shotId: "S01", prompt: "推进" }],
    legacyEntryCount: 1,
  });

  assert.equal(command.source, "legacy");
  assert.equal(command.ok, true);
  assert.equal(command.jobs[0].kind, "video");
  assert.equal(command.result.metrics[0].label, "视频任务");
});

test("queue command handler uses business shots even without legacy node ids", () => {
  const command = prepareVideoQueueCommand({
    episode: {
      id: "e1",
      shots: [{ id: "S01", videoPrompt: "推进" }],
    },
    businessOptions: { requireSourceNode: true },
    legacyJobs: [{ kind: "video", shotId: "OLD", prompt: "旧节点" }],
    legacyEntryCount: 1,
  });

  assert.equal(command.source, "business");
  assert.equal(command.ok, true);
  assert.equal(command.jobs[0].sourceNodeId, "episode-e1-shots");
  assert.equal(command.jobs[0].shotId, "S01");
});

test("legacy queue command explains empty image and video queues", () => {
  const image = buildLegacyQueueCommand("image", [], 0);
  const video = buildLegacyQueueCommand("video", [], 2);

  assert.equal(image.ok, false);
  assert.match(image.message, /待生成图片/);
  assert.equal(video.ok, false);
  assert.match(video.message, /视频提示词/);
});
