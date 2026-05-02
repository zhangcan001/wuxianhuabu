import assert from "node:assert/strict";
import test from "node:test";
import { runProjectGenerationQueue } from "../src/app/project-queue-runner.js";

function createQueueStore(initial) {
  let state = initial;
  return {
    get state() {
      return state;
    },
    setState(updater) {
      state = typeof updater === "function" ? updater(state) : updater;
    },
  };
}

test("runProjectGenerationQueue retries media failures and then completes the job", async () => {
  const store = createQueueStore([
    {
      id: "job-image",
      kind: "image",
      status: "pending",
      attempts: 0,
      prompt: "shot prompt",
      title: "Shot image",
      sourceNodeId: "shot-node",
      shotId: "shot-1",
    },
  ]);
  const events = [];
  const messages = [];
  const shotPatches = [];
  let imageRuns = 0;

  const result = await runProjectGenerationQueue({
    queueRunningRef: { current: false },
    generationQueue: store.state,
    setGenerationQueue: store.setState,
    setQueueRunning: () => {},
    setShowQueue: () => {},
    setProjectMessage: (message) => messages.push(message),
    traceAppEvent: (name, payload) => events.push({ name, payload }),
    compareQueueJobs: () => 0,
    autoRetryLimit: 2,
    delay: async () => {},
    runImageGeneration: async () => {
      imageRuns += 1;
      if (imageRuns === 1) throw new Error("temporary");
      return { imageUrl: "image://done", note: "done" };
    },
    createOutputNear: () => {},
    markShotProgressFromQueue: (job, patch) => shotPatches.push({ jobId: job.id, patch }),
    getSourceNode: () => ({ data: { shots: [{ id: "shot-1", videoPrompt: "" }] } }),
    upsertTimelineClipFromShot: () => {},
    shortTitle: (value) => String(value),
  });

  assert.equal(result.processed, 2);
  assert.equal(imageRuns, 2);
  assert.equal(store.state[0].status, "done");
  assert.equal(store.state[0].attempts, 2);
  assert.equal(store.state[0].resultSummary, "done");
  assert.match(messages[0], /自动重试/);
  assert.equal(events.some((event) => event.name === "queue.job.auto_retry"), true);
  assert.deepEqual(shotPatches.map((item) => item.patch.status), ["待生图", "待生图", "已生成"]);
});

test("runProjectGenerationQueue executes delivery package jobs and records history", async () => {
  const store = createQueueStore([
    {
      id: "job-package",
      kind: "exportPackage",
      status: "pending",
      attempts: 0,
      title: "Delivery package",
      episodeId: "ep-1",
      episodeName: "第一集",
      requestId: "request-1",
      packageContent: "{}",
    },
  ]);
  const history = [];
  const messages = [];

  await runProjectGenerationQueue({
    queueRunningRef: { current: false },
    generationQueue: store.state,
    setGenerationQueue: store.setState,
    setQueueRunning: () => {},
    setShowQueue: () => {},
    setProjectMessage: (message) => messages.push(message),
    traceAppEvent: () => {},
    compareQueueJobs: () => 0,
    delay: async () => {},
    appendExportHistory: (entry) => history.push(entry),
    saveDeliveryPackageArtifact: async () => ({ path: "C:/out/package.json" }),
  });

  assert.equal(store.state[0].status, "done");
  assert.equal(store.state[0].resultSummary, "C:/out/package.json");
  assert.deepEqual(history.map((entry) => entry.status), ["running", "done"]);
  assert.equal(history[0].type, "package");
  assert.equal(history[1].path, "C:/out/package.json");
  assert.equal(messages[0], "工程包队列导出完成：C:/out/package.json");
});

test("runProjectGenerationQueue stops before starting the next pending job", async () => {
  const stopRef = { current: false };
  const store = createQueueStore([
    {
      id: "job-image-1",
      kind: "image",
      status: "pending",
      prompt: "shot one",
      title: "Shot one",
    },
    {
      id: "job-image-2",
      kind: "image",
      status: "pending",
      prompt: "shot two",
      title: "Shot two",
    },
  ]);
  const messages = [];
  let imageRuns = 0;

  const result = await runProjectGenerationQueue({
    queueRunningRef: { current: false },
    queueStopRef: stopRef,
    generationQueue: store.state,
    setGenerationQueue: store.setState,
    setQueueRunning: () => {},
    setShowQueue: () => {},
    setProjectMessage: (message) => messages.push(message),
    traceAppEvent: () => {},
    compareQueueJobs: () => 0,
    delay: async () => {},
    runImageGeneration: async () => {
      imageRuns += 1;
      stopRef.current = true;
      return { imageUrl: `image://done-${imageRuns}` };
    },
    createOutputNear: () => {},
    markShotProgressFromQueue: () => {},
  });

  assert.equal(result.processed, 1);
  assert.equal(result.stopped, true);
  assert.equal(imageRuns, 1);
  assert.equal(store.state[0].status, "done");
  assert.equal(store.state[1].status, "pending");
  assert.match(messages.at(-1), /批量生成已停止/);
  assert.equal(stopRef.current, false);
});
