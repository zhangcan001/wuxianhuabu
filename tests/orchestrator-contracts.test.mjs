import test from "node:test";
import assert from "node:assert/strict";
import {
  PIPELINE_COMMANDS,
  PIPELINE_EVENTS,
  PRODUCTION_MODES,
  commandAllowedInMode,
  createPipelineCommand,
  createPipelineEvent,
} from "../src/domain/pipeline-contracts.js";
import {
  buildAutopilotPauseResult,
  buildAutopilotStartMessage,
  buildFullProductionCommand,
  buildTextOnlyCommand,
  buildTextPackageCompletedEvent,
  buildTextProductionCompleteResult,
  describeAutopilotPauseReason,
  isTextProductionReady,
  planCommandsForMode,
  resolveProductionMode,
  summarizePipelineSnapshot,
} from "../src/domain/orchestrator.js";

test("text-only command stops after shot table", () => {
  const command = buildTextOnlyCommand({
    projectId: "project-1",
    episodeId: "episode-1",
    novelText: "雨夜里，主角推开旧车站的门。",
  }, {
    id: "cmd-text",
    createdAt: 100,
  });

  assert.equal(command.type, PIPELINE_COMMANDS.runTextOnly);
  assert.equal(command.mode, PRODUCTION_MODES.textOnly);
  assert.equal(command.payload.stopAfter, "shot");
  assert.equal(command.payload.episodeId, "episode-1");
});

test("text-only mode blocks media commands", () => {
  const textCommand = createPipelineCommand(PIPELINE_COMMANDS.generateTextPackage, {}, { id: "cmd-1" });
  const imageCommand = createPipelineCommand(PIPELINE_COMMANDS.queueShotImages, {}, { id: "cmd-2" });
  const videoCommand = createPipelineCommand(PIPELINE_COMMANDS.queueShotVideos, {}, { id: "cmd-3" });

  assert.equal(commandAllowedInMode(textCommand, PRODUCTION_MODES.textOnly), true);
  assert.equal(commandAllowedInMode(imageCommand, PRODUCTION_MODES.textOnly), false);
  assert.equal(commandAllowedInMode(videoCommand, PRODUCTION_MODES.textOnly), false);

  const plan = planCommandsForMode([textCommand, imageCommand, videoCommand], PRODUCTION_MODES.textOnly);
  assert.deepEqual(plan.allowed.map((command) => command.id), ["cmd-1"]);
  assert.deepEqual(plan.blocked.map((command) => command.id), ["cmd-2", "cmd-3"]);
});

test("full production command can carry shot scope", () => {
  const command = buildFullProductionCommand({
    projectId: "project-1",
    episodeId: "episode-1",
    shotIds: ["S01", "", "S02"],
  }, {
    id: "cmd-full",
  });

  assert.equal(command.type, PIPELINE_COMMANDS.runFullProduction);
  assert.equal(command.mode, PRODUCTION_MODES.full);
  assert.deepEqual(command.payload.shotIds, ["S01", "S02"]);
  assert.equal(command.payload.stopAfter, "export");
});

test("text package event carries assets shots and prompt coverage", () => {
  const command = buildTextOnlyCommand({ projectId: "p", episodeId: "e" }, { id: "cmd-text" });
  const event = buildTextPackageCompletedEvent(command, {
    script: "第一场...",
    characterAssets: [{ name: "阿明" }],
    sceneAssets: [{ name: "旧车站" }],
    propAssets: [{ name: "钥匙" }],
    shots: [
      { id: "S01", imagePrompt: "雨夜旧车站", videoPrompt: "推门进入" },
      { id: "S02", imagePrompt: "站台", videoPrompt: "" },
    ],
  }, {
    id: "evt-text",
    createdAt: 200,
  });

  assert.equal(event.type, PIPELINE_EVENTS.textCompleted);
  assert.equal(event.commandId, "cmd-text");
  assert.equal(event.payload.assets.characters.length, 1);
  assert.equal(event.payload.assets.scenes.length, 1);
  assert.equal(event.payload.assets.props.length, 1);
  assert.equal(event.payload.promptReady, 1);
});

test("text-only snapshot stops when assets and shot prompts are ready", () => {
  const snapshot = summarizePipelineSnapshot({
    scripts: 1,
    characters: 2,
    scenes: 1,
    shots: 3,
    promptReady: 3,
    imagesReady: 0,
    videosReady: 0,
  }, PRODUCTION_MODES.textOnly);

  assert.equal(snapshot.textReady, true);
  assert.equal(snapshot.shouldStop, true);
  assert.equal(snapshot.progress, 100);
  assert.equal(snapshot.stages.length, 3);
  assert.equal(snapshot.nextStage.key, "shot");
});

test("full snapshot includes media and export stages", () => {
  const snapshot = summarizePipelineSnapshot({
    scripts: 1,
    characters: 1,
    scenes: 1,
    shots: 2,
    promptReady: 2,
    imagesReady: 2,
    videosReady: 0,
    exportReady: false,
  }, PRODUCTION_MODES.full);

  assert.equal(snapshot.shouldStop, false);
  assert.equal(snapshot.stages.length, 6);
  assert.equal(snapshot.nextStage.key, "video");
  assert.equal(snapshot.progress, 67);
});

test("orchestrator resolves production mode and user-facing start message", () => {
  assert.equal(resolveProductionMode({ mode: "textOnly" }), PRODUCTION_MODES.textOnly);
  assert.equal(resolveProductionMode({ mode: "unknown" }), PRODUCTION_MODES.full);
  assert.match(buildAutopilotStartMessage(PRODUCTION_MODES.textOnly), /不会自动生成图片/);
  assert.match(buildAutopilotStartMessage(PRODUCTION_MODES.full), /后台自动生产/);
});

test("text production readiness and completion result are stable", () => {
  const summary = {
    scripts: 1,
    characters: 2,
    scenes: 1,
    shots: 3,
    promptReady: 3,
  };
  const result = buildTextProductionCompleteResult(summary, [
    { title: "起步流程" },
    { summary: "镜头表已同步" },
  ]);

  assert.equal(isTextProductionReady(summary), true);
  assert.equal(isTextProductionReady({ ...summary, promptReady: 2 }), false);
  assert.equal(result.title, "文本生产完成");
  assert.deepEqual(result.metrics.map((item) => item.value), [2, 1, 3, "3/3"]);
  assert.deepEqual(result.details, ["起步流程", "镜头表已同步"]);
});

test("autopilot pause reason and result explain next blocker", () => {
  assert.match(describeAutopilotPauseReason({}, 0, 2), /2 个任务/);
  assert.match(describeAutopilotPauseReason({ novelNodeId: "n", scripts: 1, characters: 1, scenes: 1, shots: 2, promptReady: 1 }, 0, 0), /1 条镜头提示词/);

  const result = buildAutopilotPauseResult({
    mode: PRODUCTION_MODES.textOnly,
    summary: { timelineStageBoard: { missingMedia: 4 } },
    pending: 0,
    failed: 0,
    receipts: [{ summary: "已生成资产" }],
    pauseReason: "等待用户确认",
  });

  assert.equal(result.title, "文本生产已暂停");
  assert.equal(result.summary, "等待用户确认");
  assert.deepEqual(result.metrics.map((item) => item.value), [1, 0, 0, 4]);
  assert.deepEqual(result.details, ["已生成资产", "等待用户确认"]);
});

test("pipeline event infers source from event prefix", () => {
  const event = createPipelineEvent(PIPELINE_EVENTS.imageCompleted, {}, { id: "evt-image" });
  assert.equal(event.source, "image");
});
