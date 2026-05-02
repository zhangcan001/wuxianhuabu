import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSystemSelfCheckResult,
  runSystemSelfCheckAction,
} from "../src/app/system-self-check-action.js";

test("system self check action opens dashboard and reports success", () => {
  const calls = [];
  const result = runSystemSelfCheckAction({
    runSelfCheck: () => ({ ok: true, gate: { blockers: [] } }),
    setShowDashboard: (value) => calls.push(["dashboard", value]),
    setProjectMessage: (message) => calls.push(["message", message]),
  });

  assert.equal(result.title, "系统自检通过");
  assert.equal(result.summary, "最小生产链路可跑通。");
  assert.deepEqual(calls, [
    ["dashboard", true],
    ["message", "系统自检通过：最小生产链路可跑通。"],
  ]);
});

test("system self check action reports blockers on failure", () => {
  const calls = [];
  const result = runSystemSelfCheckAction({
    runSelfCheck: () => ({ ok: false, gate: { blockers: ["缺少镜头", "未审片"] } }),
    setShowDashboard: (value) => calls.push(["dashboard", value]),
    setProjectMessage: (message) => calls.push(["message", message]),
  });

  assert.equal(result.title, "系统自检失败");
  assert.equal(result.summary, "阻塞：缺少镜头、未审片");
  assert.deepEqual(calls, [
    ["dashboard", true],
    ["message", "系统自检发现阻塞，请查看总控台。"],
  ]);
});

test("system self check result handles unknown failure", () => {
  assert.deepEqual(buildSystemSelfCheckResult({ ok: false }), {
    title: "系统自检失败",
    summary: "阻塞：未知",
    result: { ok: false },
  });
});
