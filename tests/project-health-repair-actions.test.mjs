import assert from "node:assert/strict";
import test from "node:test";
import {
  buildHealthFindingKey,
  filterHealthRemainingKeys,
  fixHealthFindingAction,
  fixHealthFindingsBatchAction,
  prependHealthRepairLog,
  reconcileHealthRepairAction,
} from "../src/app/project-health-repair-actions.js";

const finding = {
  category: "镜头",
  text: "缺少图片提示词",
  nodeId: "node-1",
  episodeName: "第一集",
  fix: { kind: "shot_image_prompt" },
};

test("health repair helpers build stable keys and capped log entries", () => {
  assert.equal(buildHealthFindingKey(finding), "镜头-缺少图片提示词-node-1-shot_image_prompt");

  const log = prependHealthRepairLog(Array.from({ length: 24 }, (_, index) => ({ id: `old-${index}` })), {
    status: "done",
    findingText: "fixed",
  }, {
    now: () => 100,
    idSuffix: () => "abc",
    formatTime: () => "now",
  });

  assert.equal(log.length, 24);
  assert.equal(log[0].id, "health-repair-100-abc");
  assert.equal(log[0].at, "now");
  assert.equal(log[0].findingText, "fixed");
});

test("filterHealthRemainingKeys keeps only currently available findings", () => {
  const report = {
    findings: [
      finding,
      { ...finding, text: "缺少视频提示词", fix: { kind: "shot_video_prompt" } },
    ],
  };
  const keys = filterHealthRemainingKeys(report, [
    buildHealthFindingKey(finding),
    "gone",
  ]);

  assert.deepEqual(keys, [buildHealthFindingKey(finding)]);
});

test("fixHealthFindingAction tracks fixing key and logs failures", async () => {
  let fixingKeys = [];
  const logs = [];
  const messages = [];
  let pushed = false;

  const result = await fixHealthFindingAction({
    finding,
    pushHistory: () => {
      pushed = true;
    },
    autoFixHealthFinding: async () => {
      throw new Error("bad fix");
    },
    appendHealthRepairLog: (entry) => logs.push(entry),
    setHealthFixingKeys: (updater) => {
      fixingKeys = updater(fixingKeys);
    },
    setProjectMessage: (message) => messages.push(message),
  });

  assert.equal(result.ok, false);
  assert.equal(pushed, true);
  assert.deepEqual(fixingKeys, []);
  assert.equal(logs[0].status, "failed");
  assert.equal(logs[0].detail, "bad fix");
  assert.equal(messages[0], "自动修复失败：bad fix");
});

test("fixHealthFindingsBatchAction summarizes success failed and remaining findings", async () => {
  const logs = [];
  const messages = [];
  const remainingSyncs = [];
  const remainingFinding = { ...finding, text: "仍未解决" };
  const findings = [finding, remainingFinding];

  const result = await fixHealthFindingsBatchAction({
    findings,
    fixHealthFinding: async (item) => ({ ok: item === finding }),
    buildRefreshedReport: () => ({ findings: [remainingFinding] }),
    syncHealthRemainingKeys: (report, keys) => remainingSyncs.push({ report, keys }),
    appendHealthRepairLog: (entry) => logs.push(entry),
    setProjectMessage: (message) => messages.push(message),
    getEpisodeName: () => "第一集",
  });

  assert.equal(result.success, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.remaining, 1);
  assert.deepEqual(remainingSyncs[0].keys, [buildHealthFindingKey(remainingFinding)]);
  assert.equal(logs[0].status, "failed");
  assert.match(logs[0].detail, /失败 1 条/);
  assert.equal(messages[0], "批量修复完成：成功 1 条，失败 1 条，剩余 1 条");
});

test("reconcileHealthRepairAction records done log or unresolved remaining key", async () => {
  const logs = [];
  const synced = [];
  let refreshed = { findings: [] };

  await reconcileHealthRepairAction({
    finding,
    refreshGeneratedImagesIntoAssets: () => {},
    waitForCommit: async () => {},
    buildRefreshedReport: () => refreshed,
    getRemainingKeys: () => [],
    syncHealthRemainingKeys: (report, keys) => synced.push({ report, keys }),
    appendHealthRepairLog: (entry) => logs.push(entry),
  });

  assert.equal(logs[0].status, "done");
  assert.equal(synced[0].keys, undefined);

  refreshed = { findings: [finding] };
  await assert.rejects(
    reconcileHealthRepairAction({
      finding,
      refreshGeneratedImagesIntoAssets: () => {},
      waitForCommit: async () => {},
      buildRefreshedReport: () => refreshed,
      getRemainingKeys: () => ["old"],
      syncHealthRemainingKeys: (report, keys) => synced.push({ report, keys }),
      appendHealthRepairLog: (entry) => logs.push(entry),
    }),
    /复检后这条问题仍然存在/,
  );
  assert.deepEqual(synced.at(-1).keys, ["old", buildHealthFindingKey(finding)]);
});
