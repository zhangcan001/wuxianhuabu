import assert from "node:assert/strict";
import test from "node:test";
import {
  recoverTimelineGapsAction,
  repairStateAuthorityAction,
  repairAssetConsistencyAction,
  repairMediaIntegrityAction,
  runMissingMediaBatchAction,
  runRejectedTimelineRepairBatchAction,
} from "../src/app/project-repair-actions.js";

test("runMissingMediaBatchAction queues only clips without media", () => {
  const messages = [];
  let showQueue = false;
  const queued = [];
  const result = runMissingMediaBatchAction({
    episodeTimeline: {
      clips: [
        { id: "c1", title: "缺图", mediaUrl: "" },
        { id: "c2", title: "已好", mediaUrl: "asset://ok.png" },
      ],
    },
    queueGenerationForTimelineClip: (clip, options) => {
      queued.push({ clip, options });
      return true;
    },
    setShowQueue: (value) => {
      showQueue = value;
    },
    setProjectMessage: (message) => messages.push(message),
  });

  assert.equal(result.queued, 1);
  assert.deepEqual(result.clips, ["缺图"]);
  assert.equal(queued[0].options.silent, true);
  assert.equal(showQueue, true);
  assert.equal(messages[0], "已为 1 条待补素材片段加入生成队列");
});

test("recoverTimelineGapsAction delegates missing clips to export preparation", () => {
  const messages = [];
  const result = recoverTimelineGapsAction({
    episodeId: "ep-1",
    episodeTimeline: {
      clips: [
        { id: "c1", mediaUrl: "" },
        { id: "c2", mediaUrl: "asset://ok.png" },
      ],
    },
    prepareTimelineClipsForExport: (episodeId, clipIds, options) => {
      assert.equal(episodeId, "ep-1");
      assert.deepEqual(clipIds, ["c1"]);
      assert.equal(options.silent, true);
      return { processed: 1, synced: 1, queued: 1 };
    },
    setProjectMessage: (message) => messages.push(message),
  });

  assert.equal(result.processed, 1);
  assert.equal(messages[0], "已推进 1 条时间线缺口：同步 1 · 入队 1");
});

test("runRejectedTimelineRepairBatchAction batches rejected clips", async () => {
  const messages = [];
  const result = await runRejectedTimelineRepairBatchAction({
    episodeTimeline: {
      clips: [
        { id: "c1", title: "退回", approvalStatus: "退回修改" },
        { id: "c2", title: "通过", approvalStatus: "已通过" },
      ],
    },
    setProjectMessage: (message) => messages.push(message),
    runRepair: async (clip) => ({
      clipId: clip.id,
      title: clip.title,
      actions: ["media"],
      queued: 1,
      shot: 0,
      backfill: 1,
    }),
  });

  assert.equal(result.repaired, 1);
  assert.equal(result.queued, 1);
  assert.equal(result.backfilled, 1);
  assert.equal(messages.at(-1), "退回片段自动修复完成：1 条，重入队 1");
});

test("repairAssetConsistencyAction commits update episode action", () => {
  const messages = [];
  const calls = [];
  const commercialProject = {
    activeEpisode: {
      id: "ep-1",
      assets: [{ id: "hero", token: "@角色_主角", name: "主角", type: "character" }],
      shots: [{ id: "s1", mainCharacterToken: "@角色_主角" }],
    },
  };
  const result = repairAssetConsistencyAction({
    commercialProject,
    activeEpisodeId: "ep-1",
    projectCommandService: {
      commitStoreAction: (action, options) => {
        calls.push({ action, options });
        return { project: { id: "project-1" } };
      },
    },
    setProjectMessage: (message) => messages.push(message),
  });

  assert.equal(calls[0].action.type, "updateEpisode");
  assert.equal(calls[0].options.materializeCanvas, true);
  assert.equal(calls[0].options.eventType, "production.asset.consistency_repaired");
  assert.equal(result.plan.shotPatchCount >= 0, true);
  assert.match(messages[0], /资产一致性修复完成/);
});

test("repairMediaIntegrityAction reports no-op when there are no repairable paths", () => {
  const messages = [];
  const result = repairMediaIntegrityAction({
    commercialProject: { episodes: [] },
    projectCommandService: {
      commitStoreAction: () => {
        throw new Error("should not commit");
      },
    },
    setProjectMessage: (message) => messages.push(message),
  });

  assert.equal(result.plan.repairCount, 0);
  assert.equal(result.summary, "没有发现可自动修复的断链。");
  assert.equal(messages[0], "素材路径检查完成：没有发现可自动修复的断链。");
});

test("repairStateAuthorityAction rebuilds business timeline and materializes canvas", () => {
  const calls = [];
  const result = repairStateAuthorityAction({
    commercialProject: {
      activeEpisodeId: "e1",
      activeEpisode: {
        id: "e1",
        shots: [{ id: "S01", videoUrl: "asset://s01.mp4" }],
        timeline: { clips: [] },
      },
      episodes: [{
        id: "e1",
        shots: [{ id: "S01", videoUrl: "asset://s01.mp4" }],
        timeline: { clips: [] },
      }],
    },
    projectCommandService: {
      commitStoreAction: (action, options) => {
        calls.push({ action, options });
        return { project: action.project };
      },
    },
  });

  assert.equal(calls[0].action.type, "hydrate");
  assert.equal(calls[0].options.materializeCanvas, true);
  assert.equal(calls[0].options.eventType, "production.state_authority.repaired");
  assert.equal(result.project.activeEpisode.timeline.clips[0].mediaUrl, "asset://s01.mp4");
});
