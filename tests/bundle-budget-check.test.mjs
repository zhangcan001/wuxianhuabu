import assert from "node:assert/strict";
import test from "node:test";

import { checkBundleBudgets } from "../scripts/bundle-budget-check.mjs";

test("checkBundleBudgets reports files over configured limits", () => {
  const result = checkBundleBudgets([
    { file: "dist/assets/index-abc.js", kb: 721 },
    { file: "dist/assets/index-abc.css", kb: 100 },
    { file: "dist/assets/other.js", kb: 999 },
  ], [
    { pattern: /^dist\/assets\/index-.*\.js$/, maxKb: 720 },
    { pattern: /^dist\/assets\/index-.*\.css$/, maxKb: 160 },
  ]);

  assert.equal(result.ok, false);
  assert.deepEqual(result.violations, [{ file: "dist/assets/index-abc.js", kb: 721, maxKb: 720 }]);
});

test("checkBundleBudgets passes when matching bundles stay within limits", () => {
  const result = checkBundleBudgets([
    { file: "dist/assets/index-abc.js", kb: 700 },
    { file: "dist/assets/three-abc.js", kb: 760 },
  ], [
    { pattern: /^dist\/assets\/index-.*\.js$/, maxKb: 720 },
    { pattern: /^dist\/assets\/three-.*\.js$/, maxKb: 780 },
  ]);

  assert.equal(result.ok, true);
  assert.deepEqual(result.violations, []);
});

test("checkBundleBudgets reports missing required split bundles", () => {
  const result = checkBundleBudgets([
    { file: "dist/assets/index-abc.js", kb: 680 },
  ], [
    { pattern: /^dist\/assets\/index-.*\.js$/, maxKb: 700, required: true },
    { pattern: /^dist\/assets\/legacy-canvas-shell-.*\.js$/, maxKb: 25, required: true },
  ]);

  assert.equal(result.ok, false);
  assert.deepEqual(result.violations, [{
    file: String(/^dist\/assets\/legacy-canvas-shell-.*\.js$/),
    kb: 0,
    maxKb: 25,
    missing: true,
  }]);
});
