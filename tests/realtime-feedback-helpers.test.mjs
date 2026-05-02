import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTimelineRenderMessage,
  handleTimelineRenderEvent,
} from "../src/realtime-feedback-helpers.js";

test("timeline render message clamps progress and keeps message readable", () => {
  assert.equal(
    buildTimelineRenderMessage(120, "成片已整理完成"),
    "导出中 100% · 成片已整理完成"
  );
  assert.equal(
    buildTimelineRenderMessage(undefined, "正在整理成片"),
    "导出中 · 正在整理成片"
  );
});

test("timeline render event updates queue and active request message", () => {
  const queue = [
    { id: "job-1", requestId: "render-1", progress: 0, resultSummary: "", updatedAt: 0 },
    { id: "job-2", requestId: "other", progress: 0, resultSummary: "", updatedAt: 0 },
  ];
  const result = handleTimelineRenderEvent({
    queue,
    payload: {
      requestId: "render-1",
      progress: 48,
      message: "正在整理成片",
    },
    activeRequestId: "render-1",
    now: () => 123,
  });

  assert.equal(result.changed, true);
  assert.equal(result.queue[0].progress, 48);
  assert.equal(result.queue[0].resultSummary, "正在整理成片");
  assert.equal(result.queue[0].updatedAt, 123);
  assert.equal(result.queue[1], queue[1]);
  assert.equal(result.projectMessage, "导出中 48% · 正在整理成片");
});

test("timeline render event ignores unrelated active request message", () => {
  const result = handleTimelineRenderEvent({
    queue: [],
    payload: {
      requestId: "render-2",
      progress: 20,
      message: "片段处理中",
    },
    activeRequestId: "render-1",
  });

  assert.equal(result.projectMessage, "");
});
