import assert from "node:assert/strict";
import test from "node:test";
import {
  executeProductionTask,
} from "../src/application/use-cases/execute-production-task.js";
import {
  createMockProvider,
  createProviderGateway,
} from "../src/core/providers/provider-gateway.js";

test("execute production task runs provider and emits completion event", async () => {
  const gateway = createProviderGateway([
    createMockProvider({
      id: "image-provider",
      capabilities: ["image"],
      estimate: () => ({ cost: 0.08, tokens: 90 }),
      run: (payload) => ({ url: "image.png", prompt: payload.prompt }),
    }),
  ]);
  const result = await executeProductionTask({
    gateway,
    projectId: "p1",
    task: {
      id: "shot-image:ep-1:S01",
      type: "shot.image",
      target: { type: "shot", id: "S01" },
      input: { prompt: "雨夜车站" },
    },
    now: 1,
  });

  assert.equal(result.ok, true);
  assert.equal(result.output.url, "image.png");
  assert.equal(result.taskPatch.status, "done");
  assert.equal(result.events[0].type, "production.task.completed");
  assert.equal(result.events[0].episodeId, "ep-1");
  assert.equal(result.events[0].payload.estimate.cost, 0.08);
  assert.equal(result.events[0].payload.cost, 0.08);
});

test("execute production task returns failed patch and audit event", async () => {
  const gateway = createProviderGateway([
    createMockProvider({
      id: "video-provider",
      capabilities: ["video"],
      run: () => {
        throw new Error("视频模型失败");
      },
    }),
  ]);
  const result = await executeProductionTask({
    gateway,
    task: {
      id: "shot-video:ep-1:S01",
      type: "shot.video",
      target: { type: "shot", id: "S01" },
      input: { prompt: "推进" },
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.taskPatch.status, "failed");
  assert.match(result.taskPatch.error, /视频模型失败/);
  assert.equal(result.events[0].type, "production.task.failed");
});
