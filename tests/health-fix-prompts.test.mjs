import assert from "node:assert/strict";
import test from "node:test";

import {
  NOVEL_CHARACTER_ASSET_SCHEMA,
  NOVEL_PROP_ASSET_SCHEMA,
  NOVEL_SCENE_ASSET_SCHEMA,
  buildAssetLockFieldsHealthFixTemplate,
  buildHealthAssetSliceTemplate,
  buildShotHealthFixTemplate,
  selectHealthAssetSliceSchema,
} from "../src/app/health-fix-prompts.js";

test("asset lock health fix template asks for continuity fields and resource tokens", () => {
  const template = buildAssetLockFieldsHealthFixTemplate();

  assert.match(template, /visualLock/);
  assert.match(template, /continuityRule/);
  assert.match(template, /referenceResources/);
});

test("health asset slice templates and schemas follow the target category", () => {
  assert.match(buildHealthAssetSliceTemplate("角色", "base"), /人物资产/);
  assert.match(buildHealthAssetSliceTemplate("场景", "base"), /场景资产/);
  assert.match(buildHealthAssetSliceTemplate("道具", "base"), /道具资产/);

  assert.equal(selectHealthAssetSliceSchema("角色"), NOVEL_CHARACTER_ASSET_SCHEMA);
  assert.equal(selectHealthAssetSliceSchema("场景"), NOVEL_SCENE_ASSET_SCHEMA);
  assert.equal(selectHealthAssetSliceSchema("道具"), NOVEL_PROP_ASSET_SCHEMA);
});

test("shot health fix template covers supported shot fix kinds", () => {
  assert.match(buildShotHealthFixTemplate("shot_image_prompt"), /imagePrompt/);
  assert.match(buildShotHealthFixTemplate("shot_video_prompt"), /videoPrompt/);
  assert.match(buildShotHealthFixTemplate("shot_asset_refs"), /assetTokens/);
  assert.match(buildShotHealthFixTemplate("shot_reference_resources"), /referenceResources/);
  assert.equal(buildShotHealthFixTemplate("unknown"), "");
});
