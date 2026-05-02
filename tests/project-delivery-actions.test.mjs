import assert from "node:assert/strict";
import test from "node:test";
import {
  buildQueuedEpisodeRender,
  planProductionDeliveryAction,
  queueDeliveryPackageJobsAction,
  queueProjectRenderBatchAction,
} from "../src/app/project-delivery-actions.js";

const parseDurationSeconds = (value) => Number(value || 0);
const createRenderRequestId = (prefix) => `${prefix}-req`;

test("buildQueuedEpisodeRender creates export job and queued history", () => {
  const result = buildQueuedEpisodeRender({
    episode: { id: "ep-1", name: "第一集" },
    episodeTimeline: {
      clips: [{ title: "c1", mediaUrl: "asset://shot.mp4", mediaType: "video", duration: "3" }],
    },
    resourceIndex: {},
    options: { aspectRatio: "9:16" },
    activeEpisodeId: "ep-1",
    parseDurationSeconds,
    createRenderRequestId,
  });

  assert.equal(result.ok, true);
  assert.equal(result.job.kind, "exportVideo");
  assert.equal(result.job.title, "第一集 竖版成片");
  assert.equal(result.job.exportRequest.requestId, "render-ep-1-req");
  assert.equal(result.history.status, "queued");
  assert.equal(result.history.renderOptions.aspectRatio, "9:16");
});

test("buildQueuedEpisodeRender blocks invalid timeline before queueing", () => {
  const result = buildQueuedEpisodeRender({
    episode: { id: "ep-1", name: "第一集" },
    episodeTimeline: { clips: [{ title: "c1", mediaUrl: "", duration: "0" }] },
    options: {},
    activeEpisodeId: "ep-1",
    parseDurationSeconds,
    createRenderRequestId,
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "blocked");
  assert.match(result.message, /导出前检查未通过/);
});

test("queueProjectRenderBatchAction queues renderable episodes and reports skipped ones", () => {
  const jobs = [];
  const histories = [];
  const messages = [];
  const timeline = {
    byEpisodeId: {
      "ep-1": { clips: [{ title: "ready", mediaUrl: "asset://ready.png", duration: "2" }] },
      "ep-2": { clips: [{ title: "missing", mediaUrl: "", duration: "2" }] },
    },
  };
  const result = queueProjectRenderBatchAction({
    episodes: [{ id: "ep-1", name: "第一集" }, { id: "ep-2", name: "第二集" }],
    timeline,
    defaultEpisodeTimeline: { clips: [] },
    resourceIndex: {},
    options: { aspectRatio: "16:9" },
    activeEpisodeId: "ep-1",
    parseDurationSeconds,
    createRenderRequestId,
    getEpisodeTimeline: (state, episodeId) => state.byEpisodeId[episodeId],
    addGenerationJobs: (nextJobs) => jobs.push(...nextJobs),
    appendExportHistory: (entry) => histories.push(entry),
    setProjectMessage: (message) => messages.push(message),
  });

  assert.equal(result.queued, 1);
  assert.equal(result.skipped, 1);
  assert.equal(jobs[0].episodeId, "ep-1");
  assert.equal(histories[0].detail.includes("批量连续导出已排队"), true);
  assert.equal(messages[0], "已批量加入队列：1 集，跳过 1 集空时间线");
});

test("queueDeliveryPackageJobsAction appends pending history and schedules queue run", () => {
  const jobs = [];
  const histories = [];
  let shown = false;
  let scheduled = false;

  const result = queueDeliveryPackageJobsAction({
    packagePlans: [{
      episode: { id: "ep-1", name: "第一集" },
      requestId: "package-1",
      packageEntry: { title: "pkg" },
      packageContent: "{}",
      packageFileName: "pkg.json",
    }],
    activeEpisodeId: "ep-1",
    addGenerationJobs: (nextJobs) => jobs.push(...nextJobs),
    appendExportHistory: (entry) => histories.push(entry),
    setShowQueue: (value) => {
      shown = value;
    },
    scheduleRunQueue: () => {
      scheduled = true;
    },
  });

  assert.equal(result.queued, 1);
  assert.equal(jobs[0].kind, "exportPackage");
  assert.equal(histories[0].status, "pending");
  assert.equal(shown, true);
  assert.equal(scheduled, true);
});

test("planProductionDeliveryAction queues render and package for ready delivery", () => {
  const calls = [];
  const result = planProductionDeliveryAction({
    options: { format: "both" },
    commercialProject: { activeEpisode: { id: "ep-1", title: "第一集", timeline: { clips: [{ id: "c1" }] } } },
    activeEpisodeId: "ep-1",
    productionEvents: ["start"],
    productionAppService: {
      planDelivery: () => ({ events: ["planned"], delivery: { ok: true, package: { id: "pkg-1" }, readiness: { blockers: [] } } }),
    },
    projectCommandService: {
      recordDeliveryPlanned: (input) => calls.push(["record", input.detail, input.packageId]),
    },
    resourceIndex: { items: [] },
    buildStudioDeliveryOutputSpec: () => ({ platform: "douyin", aspectRatio: "9:16", resolution: "1080x1920", fps: 24 }),
    buildStudioPackageHistoryEntry: () => ({ title: "package-entry" }),
    buildStudioDeliveryPackageContent: () => "{}",
    queueEpisodeRender: (episode, timeline, resourceIndex, options) => calls.push(["render", episode.id, timeline.clips.length, options.platform]),
    queueDeliveryPackageJobs: (input) => calls.push(["package", input.packagePlans[0].requestId, input.packagePlans[0].packageFileName]),
    safeFileName: (value) => `safe-${value}`,
    setProductionEvents: (events) => calls.push(["events", events]),
    setProjectMessage: (message) => calls.push(["message", message]),
    openProductionStudioView: (view, message) => calls.push(["view", view, message]),
    createPackageRequestId: () => "package-req",
  });

  assert.equal(result.title, "交付可导出");
  assert.deepEqual(calls, [
    ["events", ["planned"]],
    ["record", "ready", "pkg-1"],
    ["render", "ep-1", 1, "douyin"],
    ["package", "package-req", "safe-第一集-delivery-package"],
    ["view", "delivery", "Production OS 交付规划完成，已打开生产工作台交付。"],
    ["message", "Production OS 交付规划完成：已加入真实导出队列。"],
  ]);
});

test("planProductionDeliveryAction reports blockers without queueing", () => {
  const calls = [];
  const result = planProductionDeliveryAction({
    commercialProject: { activeEpisode: { id: "ep-1" } },
    productionEvents: ["start"],
    productionAppService: {
      planDelivery: () => ({ delivery: { ok: false, readiness: { blockers: ["缺视频"] } } }),
    },
    projectCommandService: {
      recordDeliveryPlanned: (input) => calls.push(["record", input.detail]),
    },
    buildStudioDeliveryOutputSpec: () => ({ platform: "douyin" }),
    queueEpisodeRender: () => calls.push(["render"]),
    queueDeliveryPackageJobs: () => calls.push(["package"]),
    setProductionEvents: (events) => calls.push(["events", events]),
    setProjectMessage: (message) => calls.push(["message", message]),
    openProductionStudioView: (view, message) => calls.push(["view", view, message]),
  });

  assert.equal(result.title, "交付未就绪");
  assert.equal(result.summary, "仍有 1 个阻塞项需要处理。");
  assert.deepEqual(calls, [
    ["events", ["start"]],
    ["record", "blocked"],
    ["view", "review", "Production OS 交付规划完成：还有 1 个交付阻塞。"],
    ["message", "Production OS 交付规划完成：还有 1 个交付阻塞，已打开生产工作台。"],
  ]);
});
