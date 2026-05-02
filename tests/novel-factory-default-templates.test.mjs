import assert from "node:assert/strict";
import test from "node:test";
import {
  NOVEL_ASSET_TEMPLATE_V2,
  NOVEL_FACTORY_DEFAULT_TEMPLATES_V2,
  NOVEL_REVIEW_TEMPLATE_V2,
  NOVEL_SCRIPT_TEMPLATE_V2,
  NOVEL_STORYBOARD_TEMPLATE_V2,
} from "../src/novel-factory-default-templates.js";

test("novel factory v2 default templates cover the four production steps", () => {
  assert.match(NOVEL_SCRIPT_TEMPLATE_V2, /01_novel_to_script/);
  assert.match(NOVEL_REVIEW_TEMPLATE_V2, /02_production_gate_and_handoff/);
  assert.match(NOVEL_ASSET_TEMPLATE_V2, /03_asset_extraction/);
  assert.match(NOVEL_STORYBOARD_TEMPLATE_V2, /04_storyboard_prompt/);
});

test("novel factory v2 templates preserve linked asset and shot contract fields", () => {
  assert.match(NOVEL_SCRIPT_TEMPLATE_V2, /openingState/);
  assert.match(NOVEL_SCRIPT_TEMPLATE_V2, /closingState/);
  assert.match(NOVEL_REVIEW_TEMPLATE_V2, /不负责评分/);
  assert.match(NOVEL_REVIEW_TEMPLATE_V2, /assetExtractionBrief/);
  assert.match(NOVEL_REVIEW_TEMPLATE_V2, /storyboardBrief/);
  assert.match(NOVEL_ASSET_TEMPLATE_V2, /visualLock/);
  assert.match(NOVEL_ASSET_TEMPLATE_V2, /continuityRule/);
  assert.match(NOVEL_STORYBOARD_TEMPLATE_V2, /assetRefs/);
  assert.match(NOVEL_STORYBOARD_TEMPLATE_V2, /imagePrompt/);
  assert.match(NOVEL_STORYBOARD_TEMPLATE_V2, /videoPrompt/);
});

test("novel factory default template map exposes script review asset and storyboard keys", () => {
  assert.equal(NOVEL_FACTORY_DEFAULT_TEMPLATES_V2.script, NOVEL_SCRIPT_TEMPLATE_V2);
  assert.equal(NOVEL_FACTORY_DEFAULT_TEMPLATES_V2.review, NOVEL_REVIEW_TEMPLATE_V2);
  assert.equal(NOVEL_FACTORY_DEFAULT_TEMPLATES_V2.asset, NOVEL_ASSET_TEMPLATE_V2);
  assert.equal(NOVEL_FACTORY_DEFAULT_TEMPLATES_V2.storyboard, NOVEL_STORYBOARD_TEMPLATE_V2);
});
