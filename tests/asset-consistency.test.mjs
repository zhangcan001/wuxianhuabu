import test from "node:test";
import assert from "node:assert/strict";
import {
  applyAssetConsistencyPlan,
  buildAssetConsistencyPlan,
} from "../src/domain/asset-consistency.js";

test("asset consistency plan locks assets and backfills shot tokens", () => {
  const episode = {
    assets: [
      { id: "char-1", category: "角色", token: "@角色_林舟", name: "林舟", prompt: "red coat" },
      { id: "char-2", category: "角色", token: "@角色_安然", name: "安然", prompt: "blue coat" },
      { id: "scene-1", category: "场景", token: "@场景_车站", name: "车站", imageUrl: "asset://station.png" },
    ],
    shots: [
      { id: "S01", imagePrompt: "安然站在车站雨中", assetRefs: [] },
    ],
  };
  const plan = buildAssetConsistencyPlan(episode);
  const next = applyAssetConsistencyPlan(episode, plan);

  assert.equal(plan.lockedCount, 3);
  assert.equal(plan.enrichedCount, 3);
  assert.equal(plan.shotPatchCount, 1);
  assert.equal(next.assets.every((asset) => asset.lifecycle === "locked"), true);
  assert.equal(next.assets.every((asset) => String(asset.lockVersion || "").startsWith("lock-")), true);
  assert.equal(next.shots[0].mainCharacterToken, "@角色_安然");
  assert.equal(next.shots[0].mainSceneToken, "@场景_车站");
  assert.deepEqual(next.shots[0].assetRefs, ["@角色_安然", "@场景_车站"]);
});

test("asset consistency plan reports missing refs and removes duplicate assets", () => {
  const episode = {
    assets: [
      { id: "char-1", type: "character", token: "@主角", prompt: "red coat" },
      { id: "char-dup", type: "character", token: "@主角", prompt: "red coat duplicate" },
    ],
    shots: [
      { id: "S01", assetRefs: ["@不存在"] },
    ],
  };
  const plan = buildAssetConsistencyPlan(episode);
  const next = applyAssetConsistencyPlan(episode, plan);

  assert.equal(plan.duplicateCount, 1);
  assert.equal(plan.missingRefCount, 1);
  assert.deepEqual(plan.missingRefs, [{ shotId: "S01", token: "@不存在" }]);
  assert.deepEqual(next.assets.map((asset) => asset.id), ["char-1"]);
  assert.deepEqual(next.shots[0].assetRefs, ["@主角"]);
});
