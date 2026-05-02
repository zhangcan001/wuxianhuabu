import assert from "node:assert/strict";
import test from "node:test";

import {
  PROMPT_STYLE_PRESETS,
  PROMPT_TEMPLATE_LIBRARY,
  defaultPromptFactoryState,
  normalizePromptFactoryState,
  promptFactoryForStorage,
} from "../src/prompt-factory-state-helpers.js";

test("prompt factory defaults include core prompt templates and presets", () => {
  const state = defaultPromptFactoryState();

  assert.equal(state.sourceType, "shot");
  assert.equal(state.activeTemplate, "image_shot");
  assert.equal(state.stylePreset, PROMPT_STYLE_PRESETS[0]);
  assert.equal(state.modelPreset, "NanoBanana / Gemini");
  assert.equal(typeof state.templates.image_shot, "string");
  assert.equal(typeof state.templates.video_shot, "string");
  assert.equal(typeof state.templates.asset_card, "string");
  assert.equal(PROMPT_TEMPLATE_LIBRARY.image_shot.includes("{{modelPreset}}"), true);
});

test("prompt factory normalization preserves custom templates and falls back safely", () => {
  const state = normalizePromptFactoryState({
    sourceType: "",
    sourceId: "shot-1",
    activeTemplate: "",
    stylePreset: "",
    modelPreset: "",
    parameterPresetId: "param-1",
    templates: {
      image_shot: "custom image template",
      custom_template: "custom",
    },
    lastOutput: "output",
    history: "bad",
  });

  assert.equal(state.sourceType, "shot");
  assert.equal(state.sourceId, "shot-1");
  assert.equal(state.activeTemplate, "image_shot");
  assert.equal(state.stylePreset, "真人写实");
  assert.equal(state.modelPreset, "NanoBanana / Gemini");
  assert.equal(state.templates.image_shot, "custom image template");
  assert.equal(state.templates.custom_template, "custom");
  assert.deepEqual(state.history, []);
});

test("prompt factory storage caps history", () => {
  const history = Array.from({ length: 45 }, (_, index) => ({ id: `history-${index}` }));
  const state = promptFactoryForStorage({ history });

  assert.equal(state.history.length, 40);
  assert.equal(state.history[0].id, "history-0");
});
