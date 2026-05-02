import assert from "node:assert/strict";
import test from "node:test";

import {
  clamp,
  cssEscape,
  isCanvasZoomTarget,
  isMarqueeTarget,
  isPanSurfaceTarget,
  positiveModulo,
  previewEdgePath,
  screenToWorld,
  worldToScreen,
} from "../src/canvas-viewport-helpers.js";

test("canvas viewport helpers convert coordinates both ways", () => {
  const view = { x: 20, y: -10, scale: 2 };
  assert.deepEqual(screenToWorld(120, 50, view), { x: 50, y: 30 });
  assert.deepEqual(worldToScreen(50, 30, view), { x: 120, y: 50 });
});

test("canvas viewport helpers classify surface targets", () => {
  const stage = createTarget();
  const canvasBackground = createTarget(["canvas-bg"]);
  const node = createTarget([], ".node");

  assert.equal(isPanSurfaceTarget(stage, stage), true);
  assert.equal(isPanSurfaceTarget(canvasBackground, stage), true);
  assert.equal(isCanvasZoomTarget(node, stage), false);
  assert.equal(isMarqueeTarget(node, stage), true);
});

test("canvas viewport helpers escape selectors and build edge paths", () => {
  assert.equal(cssEscape('node"\\1', null), 'node\\"\\\\1');
  assert.equal(previewEdgePath({ x: 0, y: 10 }, { x: 40, y: 30 }), "M 0 10 C 70 10, -30 30, 40 30");
});

test("canvas viewport helpers clamp and wrap numbers", () => {
  assert.equal(clamp(12, 0, 10), 10);
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(positiveModulo(-1, 4), 3);
});

function createTarget(classNames = [], closestMatch = "") {
  return {
    classList: {
      contains(name) {
        return classNames.includes(name);
      },
    },
    closest(selector) {
      return closestMatch && selector.includes(closestMatch) ? this : null;
    },
  };
}
