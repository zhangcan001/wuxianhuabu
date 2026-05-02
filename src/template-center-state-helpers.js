export const TEMPLATE_CATEGORY_OPTIONS = [
  ["script", "剧本模板"],
  ["review", "审稿模板"],
  ["asset", "资产模板"],
  ["storyboard", "分镜模板"],
  ["prompt", "Prompt 模板"],
  ["api", "API 预设模板"],
];

export function createTemplateCenterStateHelpers(config = {}) {
  function defaultTemplateCenterState() {
    const presetTemplates = (config.novelTemplatePresets || []).flatMap((preset) => ([
      { id: `tpl-${preset.id}-script`, category: "script", name: `${preset.name} · 剧本模板`, content: preset.scriptTemplate, metaKey: preset.genre },
      { id: `tpl-${preset.id}-review`, category: "review", name: `${preset.name} · 审稿模板`, content: preset.reviewTemplate, metaKey: preset.genre },
      { id: `tpl-${preset.id}-asset`, category: "asset", name: `${preset.name} · 资产模板`, content: preset.assetTemplate, metaKey: preset.genre },
      { id: `tpl-${preset.id}-storyboard`, category: "storyboard", name: `${preset.name} · 分镜提示模板`, content: preset.promptTemplate, metaKey: preset.genre },
    ]));
    const baseTemplates = config.baseTemplates || {};
    const promptTemplates = config.promptTemplates || {};
    return {
      activeCategory: "script",
      templates: [
        { id: "tpl-script-default", category: "script", name: "CineForge 剧本模板", content: baseTemplates.script || "", metaKey: "" },
        { id: "tpl-review-default", category: "review", name: "CineForge 审稿模板", content: baseTemplates.review || "", metaKey: "" },
        { id: "tpl-revision-default", category: "review", name: "CineForge 自动修订模板", content: baseTemplates.revision || "", metaKey: "revision" },
        { id: "tpl-asset-default", category: "asset", name: "CineForge 资产模板", content: baseTemplates.asset || "", metaKey: "" },
        { id: "tpl-storyboard-default", category: "storyboard", name: "CineForge 分镜提示模板", content: baseTemplates.storyboard || "", metaKey: "" },
        ...presetTemplates,
        { id: "tpl-prompt-image", category: "prompt", name: "图像镜头模板", content: promptTemplates.image_shot || "", metaKey: "image_shot" },
        { id: "tpl-prompt-video", category: "prompt", name: "视频镜头模板", content: promptTemplates.video_shot || "", metaKey: "video_shot" },
        { id: "tpl-prompt-asset", category: "prompt", name: "资产卡模板", content: promptTemplates.asset_card || "", metaKey: "asset_card" },
        ...(config.commercialTemplates || []),
        { id: "tpl-api-default", category: "api", name: "小说工厂 API Body 模板", content: config.novelApiBodyTemplateDefault || "", metaKey: "novel_api_body" },
      ],
    };
  }

  function normalizeTemplateCenterState(state) {
    const source = state && typeof state === "object" ? state : defaultTemplateCenterState();
    const defaultTemplates = defaultTemplateCenterState();
    const defaultTemplatesById = new Map(defaultTemplates.templates.map((item) => [item.id, item]));
    return {
      activeCategory: source.activeCategory || "script",
      templates: Array.isArray(source.templates) && source.templates.length
        ? source.templates.map((item, index) => ({
          id: item.id || `template-${index}`,
          category: item.category || "script",
          name: item.name || `模板${index + 1}`,
          content: defaultTemplatesById.get(item.id)?.content || item.content || "",
          metaKey: item.metaKey || "",
        }))
        : defaultTemplates.templates,
    };
  }

  function templateCenterForStorage(state) {
    return normalizeTemplateCenterState(state);
  }

  return {
    defaultTemplateCenterState,
    normalizeTemplateCenterState,
    templateCenterForStorage,
    templateCategoryLabel,
  };
}

export function templateCategoryLabel(category) {
  return Object.fromEntries(TEMPLATE_CATEGORY_OPTIONS)[category] || category;
}
