import assert from "node:assert/strict";
import test from "node:test";

import {
  appendExportHistoryAction,
  copyExportPresetSummaryAction,
  exportEpisodeCoverAction,
  requeueExportHistoryItemAction,
  requeueExportHistoryItemsAction,
  saveDeliveryPackageArtifactAction,
  saveExportArtifactAction,
} from "../src/app/project-export-actions.js";

test("appendExportHistoryAction delegates to injected upsert", () => {
  let nextState;
  const entry = { id: "h1" };

  appendExportHistoryAction({
    entry,
    setExportHistory: (updater) => {
      nextState = updater([{ id: "old" }]);
    },
    upsertExportHistoryEntry: (current, next) => [...current, next],
  });

  assert.deepEqual(nextState, [{ id: "old" }, entry]);
});

test("copyExportPresetSummaryAction writes a readable preset summary", async () => {
  const writes = [];
  const summary = await copyExportPresetSummaryAction({
    preset: { name: "竖版", width: 1080, height: 1920, fps: 25, encodePreset: "fast", crf: 20, locked: true },
    clipboard: { writeText: async (value) => writes.push(value) },
  });

  assert.match(summary, /导出预设：竖版/);
  assert.match(summary, /分辨率：1080x1920/);
  assert.equal(writes[0], summary);
});

test("saveExportArtifactAction saves through desktop port and records history", async () => {
  const histories = [];
  const messages = [];
  const result = await saveExportArtifactAction({
    fileName: "report.json",
    extension: "json",
    content: "{}",
    isRuntimeAvailable: () => true,
    saveExportFile: async (request) => {
      assert.deepEqual(request, { fileName: "report.json", extension: "json", content: "{}" });
      return { path: "C:/out/report.json" };
    },
    appendExportHistory: (entry) => histories.push(entry),
    setProjectMessage: (value) => messages.push(value),
    activeEpisodeId: "ep1",
    episodeName: "第一集",
  });

  assert.deepEqual(result, { path: "C:/out/report.json" });
  assert.deepEqual(histories[0], {
    type: "artifact",
    status: "done",
    title: "report.json",
    detail: "JSON",
    path: "C:/out/report.json",
    episodeId: "ep1",
    episodeName: "第一集",
  });
  assert.equal(messages[0], "已导出：C:/out/report.json");
});

test("saveExportArtifactAction uses browser download fallback", async () => {
  const downloads = [];
  const histories = [];
  const result = await saveExportArtifactAction({
    fileName: "report.txt",
    extension: "txt",
    content: "hello",
    createBrowserTextDownload: (request) => downloads.push(request),
    appendExportHistory: (entry) => histories.push(entry),
  });

  assert.deepEqual(result, { path: "report.txt" });
  assert.deepEqual(downloads, [{ fileName: "report.txt", content: "hello" }]);
  assert.equal(histories[0].path, "report.txt");
});

test("saveDeliveryPackageArtifactAction records package history in desktop runtime", async () => {
  const histories = [];
  const result = await saveDeliveryPackageArtifactAction({
    fileName: "package.zip",
    packageContent: "{}",
    options: { requestId: "req1" },
    isRuntimeAvailable: () => true,
    saveDeliveryPackage: async (request) => {
      assert.deepEqual(request, { fileName: "package.zip", packageJson: "{}" });
      return { path: "C:/out/package.zip" };
    },
    appendExportHistory: (entry) => histories.push(entry),
    activeEpisodeId: "ep1",
    episodeName: "第一集",
  });

  assert.deepEqual(result, { path: "C:/out/package.zip" });
  assert.equal(histories[0].requestId, "req1");
  assert.equal(histories[0].type, "package");
});

test("exportEpisodeCoverAction saves cover and reports failures as messages", async () => {
  const histories = [];
  const messages = [];
  const result = await exportEpisodeCoverAction({
    imageUrl: "asset://cover.png",
    episodeName: "第一集",
    saveImageToDownloads: async () => ({ path: "C:/cover.png" }),
    safeFileName: (value) => value.replaceAll("一", "1"),
    appendExportHistory: (entry) => histories.push(entry),
    setProjectMessage: (value) => messages.push(value),
    activeEpisodeId: "ep1",
  });

  assert.deepEqual(result, { path: "C:/cover.png" });
  assert.equal(histories[0].type, "cover");
  assert.equal(messages[0], "封面已保存：C:/cover.png");

  const missing = await exportEpisodeCoverAction({ setProjectMessage: (value) => messages.push(value) });
  assert.equal(missing, null);
  assert.equal(messages.at(-1), "当前时间线还没有可用封面图");
});

test("requeue export history actions route valid render histories", () => {
  const queued = [];
  const messages = [];
  const common = {
    exportHistory: [
      { id: "h1", episodeId: "ep1", renderOptions: { aspectRatio: "9:16" } },
      { id: "h2", episodeId: "missing", renderOptions: { aspectRatio: "16:9" } },
      { id: "h3", episodeId: "ep1" },
    ],
    episodes: [{ id: "ep1", name: "第一集" }],
    timeline: { byEpisode: {} },
    resourceIndex: { items: [] },
    defaultEpisodeTimeline: { clips: [] },
    getEpisodeTimeline: (_timeline, episodeId) => ({ episodeId, clips: [] }),
    queueEpisodeRender: (...args) => queued.push(args),
    setProjectMessage: (value) => messages.push(value),
  };

  assert.deepEqual(requeueExportHistoryItemAction({ ...common, itemId: "h1" }).matched, 1);
  assert.equal(queued.length, 1);

  assert.deepEqual(requeueExportHistoryItemAction({ ...common, itemId: "h3" }), { matched: 0 });
  assert.equal(messages.at(-1), "这条导出历史暂时不能重新入队。");

  const result = requeueExportHistoryItemsAction({ ...common, itemIds: ["h1", "h2", "h3"] });
  assert.deepEqual(result, { matched: 1 });
  assert.equal(messages.at(-1), "已重新入队 1 条导出历史");
});
