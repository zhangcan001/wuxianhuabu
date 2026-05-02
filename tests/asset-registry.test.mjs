import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAssetUsageMap,
  createAssetRegistry,
  findRegistryAsset,
  lockRegistryAsset,
  upsertRegistryAsset,
  validateAssetContinuity,
} from "../src/core/asset-registry/asset-registry.js";

test("asset registry indexes assets and summarizes lifecycle", () => {
  const registry = createAssetRegistry({
    assets: [
      { id: "a1", type: "character", name: "林舟", token: "@林舟", lifecycle: "draft" },
      { id: "s1", type: "scene", name: "旧车站", token: "@旧车站", lifecycle: "locked" },
    ],
  });

  assert.equal(registry.summary.total, 2);
  assert.equal(registry.summary.locked, 1);
  assert.equal(findRegistryAsset(registry, "@林舟").name, "林舟");
});

test("asset registry upserts locks and validates shot continuity", () => {
  let registry = createAssetRegistry();
  registry = upsertRegistryAsset(registry, { id: "a1", token: "@林舟", name: "林舟" });
  registry = lockRegistryAsset(registry, "@林舟", { visualFingerprint: "红衣短发" });

  const report = validateAssetContinuity(registry, [
    { id: "S01", assetRefs: ["@林舟", "@不存在"] },
  ]);

  assert.equal(findRegistryAsset(registry, "a1").lifecycle, "locked");
  assert.equal(report.ok, false);
  assert.deepEqual(report.missingRefs, [{ shotId: "S01", token: "@不存在" }]);
});

test("asset registry builds usage map across shots", () => {
  const registry = createAssetRegistry({ assets: [{ token: "@林舟" }] });
  const usage = buildAssetUsageMap(registry, [
    { id: "S01", assetRefs: ["@林舟"] },
    { id: "S02", assetRefs: ["@林舟"] },
  ]);

  assert.deepEqual(usage["@林舟"], ["S01", "S02"]);
});
