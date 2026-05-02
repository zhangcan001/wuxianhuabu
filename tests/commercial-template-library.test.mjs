import assert from "node:assert/strict";
import test from "node:test";
import {
  COMMERCIAL_PROMPT_TEMPLATE_LIBRARY,
  COMMERCIAL_TEMPLATE_CENTER_ITEMS,
  assessCommercialTemplateCoverage,
} from "../src/commercial-template-library.js";

test("commercial prompt templates cover production-critical continuity fields", () => {
  assert.match(COMMERCIAL_PROMPT_TEMPLATE_LIBRARY.image_shot, /Stable subject/);
  assert.match(COMMERCIAL_PROMPT_TEMPLATE_LIBRARY.image_shot, /Continuity lock/);
  assert.match(COMMERCIAL_PROMPT_TEMPLATE_LIBRARY.video_shot, /opening frame/);
  assert.match(COMMERCIAL_PROMPT_TEMPLATE_LIBRARY.video_shot, /closing frame/);
  assert.match(COMMERCIAL_PROMPT_TEMPLATE_LIBRARY.asset_card, /visualLock|Visual lock/);
  assert.match(COMMERCIAL_PROMPT_TEMPLATE_LIBRARY.asset_card, /continuityRule|Continuity rule/);
});

test("commercial template center ships preflight, shot acceptance and delivery checklist", () => {
  const ids = COMMERCIAL_TEMPLATE_CENTER_ITEMS.map((item) => item.id);
  assert.deepEqual(ids, [
    "tpl-commercial-preflight",
    "tpl-commercial-shot-acceptance",
    "tpl-commercial-delivery-package",
  ]);
  assert.equal(COMMERCIAL_TEMPLATE_CENTER_ITEMS.some((item) => item.content.includes("commercialReadiness")), true);
  assert.equal(COMMERCIAL_TEMPLATE_CENTER_ITEMS.some((item) => item.content.includes("approvalStatus")), true);
  assert.equal(COMMERCIAL_TEMPLATE_CENTER_ITEMS.some((item) => item.content.includes("deliverables")), true);
});

test("commercial template coverage reports missing delivery markers", () => {
  const ready = assessCommercialTemplateCoverage([
    ...Object.values(COMMERCIAL_PROMPT_TEMPLATE_LIBRARY),
    ...COMMERCIAL_TEMPLATE_CENTER_ITEMS,
  ]);
  assert.equal(ready.ready, true);
  assert.deepEqual(ready.missing, []);

  const weak = assessCommercialTemplateCoverage(["普通模板"]);
  assert.equal(weak.ready, false);
  assert.equal(weak.missing.includes("commercialReadiness"), true);
});
