import assert from "node:assert/strict";
import test from "node:test";

import {
  EXPORT_PRESET_STAGE_OPTIONS,
  EXPORT_VIDEO_PRESET_OPTIONS,
  PROMPT_MODEL_PRESETS,
  STYLE_IMAGE_SYSTEM_OPTIONS,
  applyShotModelParamPreset,
  buildModelParamPresetOptions,
  buildModelParamPresetSummary,
  buildModelParamRequestMeta,
  buildModelPresetOptions,
  buildStylePresetRequestMeta,
  buildStylePresetSelectOptions,
  defaultExportPresetCenterState,
  defaultModelParamCenterState,
  defaultStylePresetCenterState,
  exportPresetCenterForStorage,
  findExportPresetById,
  findStylePresetByName,
  modelParamCenterForStorage,
  normalizeExportPresetCenterState,
  normalizeModelParamCenterState,
  normalizeStylePresetCenterState,
  stylePresetCenterForStorage,
} from "../src/preset-center-helpers.js";

test("preset libraries expose expected option lists", () => {
  assert.equal(PROMPT_MODEL_PRESETS[0], "NanoBanana / Gemini");
  assert.deepEqual(STYLE_IMAGE_SYSTEM_OPTIONS, ["真人写实", "CG电影感", "动漫 / 二次元"]);
  assert.equal(EXPORT_VIDEO_PRESET_OPTIONS.includes("veryfast"), true);
  assert.deepEqual(EXPORT_PRESET_STAGE_OPTIONS, ["交付版", "审片版", "预告版", "自定义"]);
});

test("style preset center normalizes invalid presets and builds request metadata", () => {
  const defaults = defaultStylePresetCenterState();
  assert.equal(defaults.activePresetId, "style-cg-cinematic");
  assert.equal(defaults.presets[0].name, "CG电影感");

  const center = normalizeStylePresetCenterState({
    activePresetId: "custom-style",
    presets: [{
      id: "custom-style",
      name: "自定义风格",
      imageStyle: "bad",
      defaultModelPreset: "unknown",
      targetModels: ["Midjourney", "unknown"],
      stylePrompt: "风格说明",
      assetRule: "资产规则",
      videoRule: "视频规则",
      negativeHints: "规避项",
    }],
  });

  assert.equal(center.presets[0].imageStyle, "CG电影感");
  assert.equal(center.presets[0].defaultModelPreset, "NanoBanana / Gemini");
  assert.deepEqual(center.presets[0].targetModels, ["Midjourney"]);
  assert.deepEqual(stylePresetCenterForStorage(center), center);
  assert.deepEqual(buildStylePresetSelectOptions(center, "临时风格"), ["临时风格", "自定义风格"]);

  const meta = buildStylePresetRequestMeta(center, "自定义风格", "Midjourney");
  assert.equal(meta.imageStyle, "CG电影感");
  assert.equal(meta.styleGuide, "风格说明");
  assert.equal(meta.modelGuide.includes("当前模型 Midjourney"), true);
  assert.deepEqual(buildModelPresetOptions(center, center.presets[0]).slice(0, 2), ["Midjourney", "NanoBanana / Gemini"]);
  assert.equal(findStylePresetByName(center, "自定义风格")?.id, "custom-style");
});

test("model parameter center filters by media kind and applies shot fields", () => {
  const defaults = defaultModelParamCenterState();
  assert.equal(defaults.activePresetId, "param-image-banana-pro-4k");

  const center = normalizeModelParamCenterState({
    activePresetId: "video",
    presets: [
      { id: "image", name: "图片参数", kind: "image", modelPreset: "bad", runtimeModel: "image-model" },
      { id: "video", name: "视频参数", kind: "video", modelPreset: "通用视频模型", runtimeModel: "video-model", duration: "5秒", motionStrength: "强" },
    ],
  });

  assert.equal(center.presets[0].modelPreset, "NanoBanana / Gemini");
  assert.deepEqual(modelParamCenterForStorage(center), center);
  assert.deepEqual(buildModelParamPresetOptions(center, "video_shot", "external"), [
    { id: "", label: "不指定参数预设" },
    { id: "external", label: "external" },
    { id: "video", label: "视频参数" },
  ]);
  assert.equal(buildModelParamPresetSummary(center.presets[1]), "视频参数；执行模型：video-model；时长：5秒；运动强度：强");
  assert.equal(buildModelParamRequestMeta(center, "video").parameterGuide.includes("video-model"), true);

  const shot = applyShotModelParamPreset({ title: "镜头", duration: "3秒" }, center.presets[1]);
  assert.equal(shot.videoParamPreset, "视频参数");
  assert.equal(shot.videoRuntimeModel, "video-model");
  assert.equal(shot.duration, "5秒");
});

test("export preset center clamps numeric ranges and falls back to first preset", () => {
  const defaults = defaultExportPresetCenterState();
  assert.equal(defaults.activePresetId, "export-landscape-master");

  const center = normalizeExportPresetCenterState({
    activePresetId: "bad",
    presets: [{
      id: "custom-export",
      name: "自定义导出",
      stageTag: "unknown",
      width: 100,
      height: 120,
      fps: 99,
      encodePreset: "unknown",
      crf: 99,
      locked: true,
      note: "备注",
    }],
  });

  assert.equal(center.activePresetId, "custom-export");
  assert.equal(center.presets[0].stageTag, "自定义");
  assert.equal(center.presets[0].width, 320);
  assert.equal(center.presets[0].height, 320);
  assert.equal(center.presets[0].fps, 60);
  assert.equal(center.presets[0].encodePreset, "veryfast");
  assert.equal(center.presets[0].crf, 35);
  assert.deepEqual(exportPresetCenterForStorage(center), center);
  assert.equal(findExportPresetById(center, "missing")?.id, "custom-export");
});
