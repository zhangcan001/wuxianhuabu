import assert from "node:assert/strict";
import test from "node:test";

import {
  TEMPLATE_CATEGORY_OPTIONS,
  createTemplateCenterStateHelpers,
  templateCategoryLabel,
} from "../src/template-center-state-helpers.js";

function createHelpers() {
  return createTemplateCenterStateHelpers({
    novelTemplatePresets: [{
      id: "urban",
      name: "都市逆袭",
      genre: "都市",
      scriptTemplate: "都市剧本",
      reviewTemplate: "都市审稿",
      assetTemplate: "都市资产",
      promptTemplate: "都市分镜",
    }],
    baseTemplates: {
      script: "默认剧本",
      review: "默认审稿",
      revision: "默认修订",
      asset: "默认资产",
      storyboard: "默认分镜",
    },
    promptTemplates: {
      image_shot: "图片镜头",
      video_shot: "视频镜头",
      asset_card: "资产卡",
    },
    commercialTemplates: [
      { id: "tpl-commercial", category: "review", name: "商业验收", content: "验收模板", metaKey: "commercial" },
    ],
    novelApiBodyTemplateDefault: "API Body",
  });
}

test("template center defaults combine base, preset, prompt, commercial, and api templates", () => {
  const { defaultTemplateCenterState } = createHelpers();
  const state = defaultTemplateCenterState();
  const ids = state.templates.map((item) => item.id);

  assert.equal(state.activeCategory, "script");
  assert.equal(ids.includes("tpl-script-default"), true);
  assert.equal(ids.includes("tpl-urban-script"), true);
  assert.equal(ids.includes("tpl-prompt-image"), true);
  assert.equal(ids.includes("tpl-commercial"), true);
  assert.equal(ids.includes("tpl-api-default"), true);
  assert.equal(state.templates.find((item) => item.id === "tpl-api-default")?.content, "API Body");
});

test("template center normalization restores built-in template content", () => {
  const { normalizeTemplateCenterState, templateCenterForStorage } = createHelpers();
  const state = normalizeTemplateCenterState({
    activeCategory: "",
    templates: [
      { id: "tpl-script-default", category: "bad", name: "", content: "stale", metaKey: "old" },
      { id: "", category: "", name: "", content: "custom", metaKey: "" },
    ],
  });

  assert.equal(state.activeCategory, "script");
  assert.equal(state.templates[0].content, "默认剧本");
  assert.equal(state.templates[0].category, "bad");
  assert.equal(state.templates[1].id, "template-1");
  assert.equal(state.templates[1].category, "script");
  assert.equal(state.templates[1].name, "模板2");
  assert.deepEqual(templateCenterForStorage(state), state);
});

test("template category labels are stable", () => {
  assert.deepEqual(TEMPLATE_CATEGORY_OPTIONS.map(([key]) => key), ["script", "review", "asset", "storyboard", "prompt", "api"]);
  assert.equal(templateCategoryLabel("asset"), "资产模板");
  assert.equal(templateCategoryLabel("unknown"), "unknown");
  assert.equal(createHelpers().templateCategoryLabel("prompt"), "Prompt 模板");
});
