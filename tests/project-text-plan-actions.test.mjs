import test from "node:test";
import assert from "node:assert/strict";
import {
  createStudioTextPlanPackage,
} from "../src/app/project-text-plan-actions.js";

test("studio text plan package uses local factory in local mode", async () => {
  const calls = [];
  const result = await createStudioTextPlanPackage({
    sourceText: " 雨夜车站 ",
    textApiSettings: { factoryMode: "local" },
    createLocalPackage: (text) => {
      calls.push(`local:${text}`);
      return { ok: true, source: "local", novelText: text };
    },
    createApiPackage: () => {
      calls.push("api");
      return { ok: true, source: "api" };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.source, "local");
  assert.deepEqual(calls, ["local:雨夜车站"]);
});

test("studio text plan package uses API factory in API mode", async () => {
  const calls = [];
  const result = await createStudioTextPlanPackage({
    sourceText: "废弃车站",
    textApiSettings: { factoryMode: "api" },
    createLocalPackage: () => {
      calls.push("local");
      return { ok: true, source: "local" };
    },
    createApiPackage: async (text) => {
      calls.push(`api:${text}`);
      return { ok: true, source: "api", novelText: text };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.source, "api");
  assert.deepEqual(calls, ["api:废弃车站"]);
});

test("studio text plan package rejects empty source before calling factories", async () => {
  const result = await createStudioTextPlanPackage({
    sourceText: "  ",
    textApiSettings: { factoryMode: "api" },
    createApiPackage: () => {
      throw new Error("should not be called");
    },
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /请先粘贴/);
});
