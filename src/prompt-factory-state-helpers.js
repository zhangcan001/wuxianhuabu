import { COMMERCIAL_PROMPT_TEMPLATE_LIBRARY } from "./commercial-template-library.js";
import { PROMPT_MODEL_PRESETS } from "./preset-center-helpers.js";

export const PROMPT_STYLE_PRESETS = ["真人写实", "CG电影感", "国漫", "动漫感", "赛博夜景", "复古悬疑"];

export const PROMPT_TEMPLATE_LIBRARY = {
  image_shot: "使用以下镜头信息生成适合 {{modelPreset}} 的图片提示词。\n在内部按 <task>、<context>、<constraints>、<output> 理解信息，但最终只输出成品提示词。\n请按这个顺序组织：主体(subject) -> 场景与背景(context) -> 风格(style) -> 景别与机位(camera/framing) -> 光线与材质(lighting/material) -> 连续性锁定(continuity lock)。\n风格：{{stylePreset}}\n图像体系：{{imageStyle}}\n风格说明：{{styleGuide}}\n模型策略：{{modelGuide}}\n参数预设：{{parameterGuide}}\n镜头：{{title}}\n场景：{{scene}}\n资产：{{assetRefs}}\n参考资源：{{referenceResources}}\n补充要求：突出{{focus}}，保留连续性，避免漂移，只写当前镜头必要信息。\n如果存在参考图/上一镜结果，只补当前镜头变化，不重复全量重写角色和场景。\n正向规避：{{negativeHints}}\n原始镜头提示：{{basePrompt}}",
  video_shot: "使用以下镜头信息生成适合 {{modelPreset}} 的视频提示词。\n在内部按 <task>、<context>、<constraints>、<output> 理解信息，但最终只输出成品提示词。\n请按这个顺序组织：镜头运动(camera movement) : 建立环境(establishing scene)。主体动作(subject action)。关键表情/物理反馈(detail)。光线/风格(style & lighting)。连续性锁定(continuity lock)。\n风格：{{stylePreset}}\n图像体系：{{imageStyle}}\n风格说明：{{styleGuide}}\n视频策略：{{videoGuide}}\n模型策略：{{modelGuide}}\n参数预设：{{parameterGuide}}\n镜头：{{title}}\n场景：{{scene}}\n动作：{{action}}\n镜头运动：{{cameraMove}}\n时长：{{duration}}\n资产：{{assetRefs}}\n参考资源：{{referenceResources}}\n补充要求：优先单主体、单主动作、单主镜头意图；若已有参考图，只写运动与变化。\n正向规避：{{negativeHints}}\n原始视频提示：{{basePrompt}}",
  asset_card: "基于以下资产信息生成 {{modelPreset}} 版本资产提示词。\n在内部按 <task>、<context>、<constraints>、<output> 理解信息，但最终只输出成品提示词。\n请按这个顺序组织：主体(subject) -> 背景/用途(context) -> 风格(style) -> 视角/展示方式(view) -> 光线与材质(lighting/material) -> 视觉锁定(visual lock) -> 连续性规则(continuity rule)。\n风格：{{stylePreset}}\n图像体系：{{imageStyle}}\n风格说明：{{styleGuide}}\n资产策略：{{assetGuide}}\n模型策略：{{modelGuide}}\n参数预设：{{parameterGuide}}\n资产名称：{{title}}\n类别：{{category}}\n基础提示：{{basePrompt}}\n视觉锁定：{{visualLock}}\n连续性：{{continuityRule}}\n证据来源：{{evidenceSource}}\n参考资源：{{referenceResources}}\n正向规避：{{negativeHints}}\n输出要求：保持识别度、结构稳定、材质稳定、可跨镜头复用，先写稳定识别信息，再写风格化信息。",
  ...COMMERCIAL_PROMPT_TEMPLATE_LIBRARY,
};

export function defaultPromptFactoryState() {
  return {
    sourceType: "shot",
    sourceId: "",
    activeTemplate: "image_shot",
    stylePreset: PROMPT_STYLE_PRESETS[0],
    modelPreset: PROMPT_MODEL_PRESETS[0],
    parameterPresetId: "",
    templates: { ...PROMPT_TEMPLATE_LIBRARY },
    lastOutput: "",
    history: [],
  };
}

export function normalizePromptFactoryState(state) {
  const source = state && typeof state === "object" ? state : defaultPromptFactoryState();
  return {
    sourceType: source.sourceType || "shot",
    sourceId: source.sourceId || "",
    activeTemplate: source.activeTemplate || "image_shot",
    stylePreset: source.stylePreset || PROMPT_STYLE_PRESETS[0],
    modelPreset: source.modelPreset || PROMPT_MODEL_PRESETS[0],
    parameterPresetId: source.parameterPresetId || "",
    templates: { ...PROMPT_TEMPLATE_LIBRARY, ...(source.templates || {}) },
    lastOutput: source.lastOutput || "",
    history: Array.isArray(source.history) ? source.history : [],
  };
}

export function promptFactoryForStorage(state) {
  const normalized = normalizePromptFactoryState(state);
  return {
    ...normalized,
    history: normalized.history.slice(0, 40),
  };
}
