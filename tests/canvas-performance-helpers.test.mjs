import assert from "node:assert/strict";
import test from "node:test";

import {
  filterNodesInViewport,
  getNodeBounds,
  resolvePerformanceProfile,
} from "../src/canvas/canvas-performance-helpers.js";

test("canvas performance profile respects explicit modes and auto thresholds", () => {
  assert.equal(resolvePerformanceProfile({ mode: "quality" }, 999, 999, 9), "quality");
  assert.equal(resolvePerformanceProfile({ mode: "lite" }, 1, 1, 0), "lite");
  assert.equal(resolvePerformanceProfile({ mode: "auto" }, 141, 1, 0), "lite");
  assert.equal(resolvePerformanceProfile({ mode: "auto" }, 10, 10, 2), "quality");
});

test("canvas node bounds cover all nodes with a nonzero fallback", () => {
  assert.deepEqual(getNodeBounds([]), { minX: 0, minY: 0, width: 1, height: 1 });
  assert.deepEqual(getNodeBounds([
    { x: -20, y: 5, width: 40, height: 20 },
    { x: 60, y: -10, width: 20, height: 30 },
  ]), { minX: -20, minY: -10, width: 100, height: 35 });
});

test("canvas viewport filtering includes only nodes near the current viewport", () => {
  const nodes = [
    { id: "near", x: 10, y: 10, width: 80, height: 80 },
    { id: "far", x: 5000, y: 5000, width: 80, height: 80 },
  ];
  assert.deepEqual(
    filterNodesInViewport(nodes, { x: 0, y: 0, scale: 1 }, "quality", { width: 800, height: 600 }).map((node) => node.id),
    ["near"],
  );
});

test("canvas viewport filtering caps lite mode render count", () => {
  const nodes = Array.from({ length: 220 }, (_, index) => ({
    id: `node-${index}`,
    x: index,
    y: index,
    width: 10,
    height: 10,
  }));
  assert.equal(filterNodesInViewport(nodes, { x: 0, y: 0, scale: 1 }, "lite", { width: 1000, height: 1000 }).length, 180);
});
