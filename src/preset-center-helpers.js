export const PROMPT_MODEL_PRESETS = ["NanoBanana / Gemini", "开源模型", "Midjourney", "通用图像模型", "通用视频模型"];
export const STYLE_IMAGE_SYSTEM_OPTIONS = ["真人写实", "CG电影感", "动漫 / 二次元"];
export const STYLE_PRESET_LIBRARY = [
  {
    id: "style-cg-cinematic",
    name: "CG电影感",
    imageStyle: "CG电影感",
    defaultModelPreset: "NanoBanana / Gemini",
    targetModels: ["NanoBanana / Gemini", "开源模型", "Midjourney"],
    stylePrompt: "强调电影级体积光、稳定材质、硬边结构和可连续引用的角色/场景设定，整体氛围偏高完成度 CG 漫剧。",
    assetRule: "角色优先锁骨相、服装层次和主色块，场景优先锁空间纵深与主光源方向。",
    videoRule: "镜头运动保持克制，优先推拉摇移中的单一动作，避免高频抖动和无意义粒子。",
    negativeHints: "避免廉价塑料质感、五官漂移、材质糊成一片、光比失控。",
  },
  {
    id: "style-live-realism",
    name: "真人写实",
    imageStyle: "真人写实",
    defaultModelPreset: "NanoBanana / Gemini",
    targetModels: ["NanoBanana / Gemini", "开源模型", "通用视频模型"],
    stylePrompt: "按真实摄影逻辑组织人物皮肤、服装面料和环境光，强调可信尺度、真实光路和现场感。",
    assetRule: "角色卡必须锁定年龄感、肤质和服装磨损，场景卡明确真实材质和空间气味。",
    videoRule: "优先自然机位、纪实运镜和环境反馈，动作要有真实重心和反作用力。",
    negativeHints: "避免过度磨皮、塑料皮肤、超现实姿态和不合物理的高速动作。",
  },
  {
    id: "style-guoman",
    name: "国漫",
    imageStyle: "动漫 / 二次元",
    defaultModelPreset: "开源模型",
    targetModels: ["开源模型", "Midjourney", "NanoBanana / Gemini"],
    stylePrompt: "偏国漫分镜和宣传海报语感，角色轮廓清晰、配色饱和但不脏，动作线和氛围兼顾。",
    assetRule: "人物发型轮廓、服装纹样和武器结构必须固定，场景保持东方幻想空间识别度。",
    videoRule: "镜头强调起承转合和节奏点，动作瞬间清楚，少用写实抖动。",
    negativeHints: "避免欧美写实脸、颜色发灰、服装纹样忽有忽无、二次元五官崩坏。",
  },
  {
    id: "style-anime",
    name: "动漫感",
    imageStyle: "动漫 / 二次元",
    defaultModelPreset: "Midjourney",
    targetModels: ["Midjourney", "开源模型", "NanoBanana / Gemini"],
    stylePrompt: "保持二维角色设计感和清晰线稿逻辑，色彩更轻快，适合情绪化镜头和角色定妆。",
    assetRule: "先锁人物脸型、眼型、发色和服装大剪影，再补充场景气氛与道具识别点。",
    videoRule: "适合强姿态、强表情、清晰动作起点终点的镜头。",
    negativeHints: "避免厚重写实皮肤、光影过脏、角色线条忽粗忽细。",
  },
  {
    id: "style-cyber-night",
    name: "赛博夜景",
    imageStyle: "CG电影感",
    defaultModelPreset: "Midjourney",
    targetModels: ["Midjourney", "NanoBanana / Gemini", "开源模型"],
    stylePrompt: "偏高对比夜景、人工光源、潮湿反射面和城市科技感，强调空间层次和色温控制。",
    assetRule: "场景优先锁霓虹层次、屏幕光和湿地倒影，人物服装边缘与发光配件保持稳定。",
    videoRule: "运动镜头突出穿梭感，但主体和发光轮廓必须稳定。",
    negativeHints: "避免整张图只剩蓝紫色一团、霓虹泛滥导致主体丢失、夜景噪点过多。",
  },
  {
    id: "style-retro-suspense",
    name: "复古悬疑",
    imageStyle: "真人写实",
    defaultModelPreset: "开源模型",
    targetModels: ["开源模型", "NanoBanana / Gemini", "通用视频模型"],
    stylePrompt: "偏旧胶片和悬疑氛围，强调低饱和主色、局部暖光、陈旧材质和压迫空间。",
    assetRule: "重点锁定旧物件磨损、场景年代痕迹和角色服装版型。",
    videoRule: "适合缓推、静止凝视和突然信息揭示，不追求夸张运动。",
    negativeHints: "避免颜色过鲜、道具太新、光线过平、悬疑感被现代审美冲淡。",
  },
];

export const MODEL_PARAM_PRESET_LIBRARY = [
  {
    id: "param-image-banana-pro-4k",
    name: "Banana Pro 4K",
    kind: "image",
    modelPreset: "NanoBanana / Gemini",
    runtimeModel: "nano-banana-pro-4k-vip",
    imageSize: "4K",
    aspectRatio: "auto",
    quality: "高质量定稿",
    duration: "",
    motionStrength: "",
    bodyHints: "适合角色定妆、场景定稿、封面图和关键宣传图。",
    negativeHints: "避免低清、过度裁切、主体过小。",
  },
  {
    id: "param-image-banana-fast-1k",
    name: "Banana Fast 1K",
    kind: "image",
    modelPreset: "NanoBanana / Gemini",
    runtimeModel: "nano-banana-fast",
    imageSize: "1K",
    aspectRatio: "auto",
    quality: "快速预览",
    duration: "",
    motionStrength: "",
    bodyHints: "适合批量预览、镜头草图、先筛思路后再升质量。",
    negativeHints: "避免直接用于最终定稿，细节层次会偏薄。",
  },
  {
    id: "param-image-open-source-portrait",
    name: "开源模型角色定妆",
    kind: "image",
    modelPreset: "开源模型",
    runtimeModel: "flux / sdxl portrait",
    imageSize: "1536x1536",
    aspectRatio: "1:1",
    quality: "高细节角色卡",
    duration: "",
    motionStrength: "",
    bodyHints: "优先角色卡、资产卡和正面展示图，强调一致性和可训练感。",
    negativeHints: "避免构图过花、角度过偏，先锁正面完整展示。",
  },
  {
    id: "param-video-comfy-shot",
    name: "Comfy 镜头视频",
    kind: "video",
    modelPreset: "通用视频模型",
    runtimeModel: "ComfyUI video workflow",
    imageSize: "16:9",
    aspectRatio: "16:9",
    quality: "稳定镜头",
    duration: "4秒",
    motionStrength: "中",
    bodyHints: "适合标准镜头生产，动作单一、镜头运动克制、便于批处理。",
    negativeHints: "避免多段复杂动作和失控镜头抖动。",
  },
  {
    id: "param-video-comfy-cinematic",
    name: "Comfy 电影感长镜头",
    kind: "video",
    modelPreset: "通用视频模型",
    runtimeModel: "ComfyUI cinematic workflow",
    imageSize: "21:9",
    aspectRatio: "21:9",
    quality: "电影感镜头",
    duration: "6秒",
    motionStrength: "弱到中",
    bodyHints: "适合建立镜头、情绪镜头和慢推慢摇的电影感画面。",
    negativeHints: "避免高强度动作和突变式运镜。",
  },
];

export const EXPORT_VIDEO_PRESET_OPTIONS = ["ultrafast", "superfast", "veryfast", "faster", "fast", "medium", "slow", "slower", "veryslow"];
export const EXPORT_PRESET_STAGE_OPTIONS = ["交付版", "审片版", "预告版", "自定义"];
export const EXPORT_PRESET_LIBRARY = [
  {
    id: "export-landscape-master",
    name: "横版成片",
    stageTag: "交付版",
    width: 1920,
    height: 1080,
    fps: 30,
    encodePreset: "veryfast",
    crf: 18,
    note: "标准横版交付，适合正式成片。",
  },
  {
    id: "export-portrait-master",
    name: "竖版成片",
    stageTag: "交付版",
    width: 1080,
    height: 1920,
    fps: 30,
    encodePreset: "veryfast",
    crf: 18,
    note: "适合短视频平台竖版发布。",
  },
  {
    id: "export-trailer-60fps",
    name: "高帧预告版",
    stageTag: "预告版",
    width: 1920,
    height: 1080,
    fps: 60,
    encodePreset: "fast",
    crf: 20,
    note: "适合预告片和节奏型混剪。",
  },
];

export function normalizeStylePresetDefinition(preset, index = 0) {
  const source = preset && typeof preset === "object" ? preset : {};
  return {
    id: source.id || `style-preset-${index + 1}`,
    name: source.name || `风格预设 ${index + 1}`,
    imageStyle: STYLE_IMAGE_SYSTEM_OPTIONS.includes(source.imageStyle) ? source.imageStyle : "CG电影感",
    defaultModelPreset: PROMPT_MODEL_PRESETS.includes(source.defaultModelPreset) ? source.defaultModelPreset : PROMPT_MODEL_PRESETS[0],
    targetModels: Array.isArray(source.targetModels) && source.targetModels.length
      ? source.targetModels.filter((item) => PROMPT_MODEL_PRESETS.includes(item))
      : [PROMPT_MODEL_PRESETS[0]],
    stylePrompt: source.stylePrompt || "",
    assetRule: source.assetRule || "",
    videoRule: source.videoRule || "",
    negativeHints: source.negativeHints || "",
  };
}

export function defaultStylePresetCenterState() {
  return {
    activePresetId: STYLE_PRESET_LIBRARY[0].id,
    presets: STYLE_PRESET_LIBRARY.map((item, index) => normalizeStylePresetDefinition(item, index)),
  };
}

export function normalizeStylePresetCenterState(state) {
  const source = state && typeof state === "object" ? state : defaultStylePresetCenterState();
  const presets = Array.isArray(source.presets) && source.presets.length
    ? source.presets.map((item, index) => normalizeStylePresetDefinition(item, index))
    : defaultStylePresetCenterState().presets;
  return {
    activePresetId: presets.some((item) => item.id === source.activePresetId) ? source.activePresetId : presets[0]?.id || "",
    presets,
  };
}

export function stylePresetCenterForStorage(state) {
  return normalizeStylePresetCenterState(state);
}

export function normalizeModelParamPresetDefinition(preset, index = 0) {
  const source = preset && typeof preset === "object" ? preset : {};
  return {
    id: source.id || `model-param-${index + 1}`,
    name: source.name || `参数预设 ${index + 1}`,
    kind: source.kind === "video" ? "video" : "image",
    modelPreset: PROMPT_MODEL_PRESETS.includes(source.modelPreset) ? source.modelPreset : PROMPT_MODEL_PRESETS[0],
    runtimeModel: source.runtimeModel || "",
    imageSize: source.imageSize || "",
    aspectRatio: source.aspectRatio || "",
    quality: source.quality || "",
    duration: source.duration || "",
    motionStrength: source.motionStrength || "",
    bodyHints: source.bodyHints || "",
    negativeHints: source.negativeHints || "",
  };
}

export function defaultModelParamCenterState() {
  return {
    activePresetId: MODEL_PARAM_PRESET_LIBRARY[0].id,
    presets: MODEL_PARAM_PRESET_LIBRARY.map((item, index) => normalizeModelParamPresetDefinition(item, index)),
  };
}

export function normalizeModelParamCenterState(state) {
  const source = state && typeof state === "object" ? state : defaultModelParamCenterState();
  const presets = Array.isArray(source.presets) && source.presets.length
    ? source.presets.map((item, index) => normalizeModelParamPresetDefinition(item, index))
    : defaultModelParamCenterState().presets;
  return {
    activePresetId: presets.some((item) => item.id === source.activePresetId) ? source.activePresetId : presets[0]?.id || "",
    presets,
  };
}

export function modelParamCenterForStorage(state) {
  return normalizeModelParamCenterState(state);
}

export function normalizeExportPresetDefinition(preset, index = 0) {
  const source = preset && typeof preset === "object" ? preset : {};
  const width = Math.max(320, Number(source.width || 1920) || 1920);
  const height = Math.max(320, Number(source.height || 1080) || 1080);
  const fps = Math.max(12, Math.min(60, Number(source.fps || 30) || 30));
  const encodePreset = EXPORT_VIDEO_PRESET_OPTIONS.includes(source.encodePreset) ? source.encodePreset : "veryfast";
  const crf = Math.max(12, Math.min(35, Number(source.crf || 18) || 18));
  return {
    id: source.id || `export-preset-${index + 1}`,
    name: source.name || `导出预设 ${index + 1}`,
    stageTag: EXPORT_PRESET_STAGE_OPTIONS.includes(source.stageTag) ? source.stageTag : "自定义",
    width,
    height,
    fps,
    encodePreset,
    crf,
    locked: Boolean(source.locked),
    note: source.note || "",
  };
}

export function defaultExportPresetCenterState() {
  return {
    activePresetId: EXPORT_PRESET_LIBRARY[0].id,
    presets: EXPORT_PRESET_LIBRARY.map((item, index) => normalizeExportPresetDefinition(item, index)),
  };
}

export function normalizeExportPresetCenterState(state) {
  const source = state && typeof state === "object" ? state : defaultExportPresetCenterState();
  const presets = Array.isArray(source.presets) && source.presets.length
    ? source.presets.map((item, index) => normalizeExportPresetDefinition(item, index))
    : defaultExportPresetCenterState().presets;
  return {
    activePresetId: presets.some((item) => item.id === source.activePresetId) ? source.activePresetId : presets[0]?.id || "",
    presets,
  };
}

export function exportPresetCenterForStorage(state) {
  return normalizeExportPresetCenterState(state);
}

export function findExportPresetById(exportPresetCenter, presetId) {
  const center = normalizeExportPresetCenterState(exportPresetCenter);
  return center.presets.find((item) => item.id === presetId) || center.presets[0] || null;
}

export function findModelParamPresetById(modelParamCenter, presetId) {
  const center = normalizeModelParamCenterState(modelParamCenter);
  return center.presets.find((item) => item.id === presetId) || null;
}

export function buildModelParamPresetOptions(modelParamCenter, templateKey, currentValue = "") {
  const center = normalizeModelParamCenterState(modelParamCenter);
  const kind = templateKey === "video_shot" ? "video" : "image";
  const presets = center.presets.filter((item) => item.kind === kind);
  const options = presets.map((item) => ({ id: item.id, label: item.name }));
  if (!options.length) options.push({ id: "", label: "未配置参数预设" });
  if (currentValue && !options.some((item) => item.id === currentValue)) options.unshift({ id: currentValue, label: currentValue });
  return [{ id: "", label: "不指定参数预设" }, ...options];
}

export function buildModelParamPresetSummary(preset) {
  if (!preset) return "";
  return [
    `${preset.kind === "video" ? "视频" : "图片"}参数`,
    preset.runtimeModel ? `执行模型：${preset.runtimeModel}` : "",
    preset.imageSize ? `尺寸：${preset.imageSize}` : "",
    preset.aspectRatio ? `画幅：${preset.aspectRatio}` : "",
    preset.quality ? `质量：${preset.quality}` : "",
    preset.duration ? `时长：${preset.duration}` : "",
    preset.motionStrength ? `运动强度：${preset.motionStrength}` : "",
    preset.bodyHints || "",
  ].filter(Boolean).join("；");
}

export function buildModelParamRequestMeta(modelParamCenter, presetId) {
  const preset = findModelParamPresetById(modelParamCenter, presetId);
  return {
    parameterGuide: preset ? buildModelParamPresetSummary(preset) : "",
  };
}

export function applyShotModelParamPreset(shot, preset) {
  if (!preset) return shot;
  if (preset.kind === "video") {
    return {
      ...shot,
      videoParamPreset: preset.name,
      videoModelPreset: preset.modelPreset || shot.videoModelPreset || "",
      videoRuntimeModel: preset.runtimeModel || shot.videoRuntimeModel || "",
      videoAspectRatio: preset.aspectRatio || shot.videoAspectRatio || "",
      duration: preset.duration || shot.duration || "",
      motionStrength: preset.motionStrength || shot.motionStrength || "",
    };
  }
  return {
    ...shot,
    imageParamPreset: preset.name,
    imageModelPreset: preset.modelPreset || shot.imageModelPreset || "",
    imageRuntimeModel: preset.runtimeModel || shot.imageRuntimeModel || "",
    imageSize: preset.imageSize || shot.imageSize || "",
    imageAspectRatio: preset.aspectRatio || shot.imageAspectRatio || "",
    imageQuality: preset.quality || shot.imageQuality || "",
  };
}

export function findStylePresetById(stylePresetCenter, presetId) {
  const center = normalizeStylePresetCenterState(stylePresetCenter);
  return center.presets.find((item) => item.id === presetId) || null;
}

export function findStylePresetByName(stylePresetCenter, stylePresetName) {
  const center = normalizeStylePresetCenterState(stylePresetCenter);
  return center.presets.find((item) => item.name === stylePresetName) || null;
}

export function buildStylePresetSelectOptions(stylePresetCenter, currentValue = "") {
  const center = normalizeStylePresetCenterState(stylePresetCenter);
  const options = center.presets.map((item) => item.name);
  if (currentValue && !options.includes(currentValue)) options.unshift(currentValue);
  return options;
}

export function buildModelPresetOptions(stylePresetCenter, preset, currentValue = "") {
  const center = normalizeStylePresetCenterState(stylePresetCenter);
  const options = new Set(PROMPT_MODEL_PRESETS);
  (center.presets || []).forEach((item) => {
    (item.targetModels || []).forEach((model) => options.add(model));
    if (item.defaultModelPreset) options.add(item.defaultModelPreset);
  });
  const list = preset?.targetModels?.length
    ? [...new Set([...preset.targetModels, preset.defaultModelPreset, ...PROMPT_MODEL_PRESETS])]
    : [...options];
  if (currentValue && !list.includes(currentValue)) list.unshift(currentValue);
  return list.filter(Boolean);
}

export function buildStylePresetRequestMeta(stylePresetCenter, stylePresetName, modelPreset) {
  const preset = findStylePresetByName(stylePresetCenter, stylePresetName);
  if (!preset) {
    return {
      imageStyle: "",
      styleGuide: "",
      assetGuide: "",
      videoGuide: "",
      modelGuide: modelPreset || "",
      negativeHints: "",
    };
  }
  const targetModels = preset.targetModels?.length ? preset.targetModels.join("、") : preset.defaultModelPreset || modelPreset || "";
  return {
    imageStyle: preset.imageStyle || "",
    styleGuide: preset.stylePrompt || "",
    assetGuide: preset.assetRule || "",
    videoGuide: preset.videoRule || "",
    modelGuide: `当前模型 ${modelPreset || preset.defaultModelPreset || ""}；推荐模型 ${preset.defaultModelPreset || ""}；适配模型 ${targetModels}`.trim(),
    negativeHints: preset.negativeHints || "",
  };
}
