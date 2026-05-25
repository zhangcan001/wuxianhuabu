import assert from "node:assert/strict";
import test from "node:test";
import { resolvePerformanceProfile } from "../src/canvas/canvas-performance-helpers.js";

test("resolvePerformanceProfile returns explicit modes verbatim", () => {
  assert.equal(resolvePerformanceProfile({ mode: "quality" }, 1000, 1000, 100), "quality");
  assert.equal(resolvePerformanceProfile({ mode: "lite" }, 0, 0, 0), "lite");
});

test("resolvePerformanceProfile picks lite when any axis crosses its threshold", () => {
  assert.equal(resolvePerformanceProfile({ mode: "auto" }, 141, 0, 0), "lite");
  assert.equal(resolvePerformanceProfile({ mode: "auto" }, 0, 221, 0), "lite");
  assert.equal(resolvePerformanceProfile({ mode: "auto" }, 0, 0, 4), "lite");
});

test("resolvePerformanceProfile stays in quality below thresholds", () => {
  assert.equal(resolvePerformanceProfile({ mode: "auto" }, 140, 220, 3), "quality");
  assert.equal(resolvePerformanceProfile({}, 50, 80, 1), "quality");
  assert.equal(resolvePerformanceProfile(undefined, 0, 0, 0), "quality");
});
