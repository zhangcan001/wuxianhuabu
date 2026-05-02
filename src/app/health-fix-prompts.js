export const NOVEL_CHARACTER_ASSET_SCHEMA = [
  "请只返回 JSON，不要 Markdown 代码块。结构如下：",
  "{",
  '  "characters": [{"name":"角色名称","role":"身份定位","ageFeeling":"年龄感","genderTemperament":"性别气质","appearance":"外貌特征","hair":"发型发色","face":"脸型与五官","bodyHabit":"体型与动作习惯","clothing":"服装体系","colorPalette":"核心配色","professionAttack":"职业/攻击特性","skillVisual":"核心技能视觉表现","weapons":"武器/常用道具","personality":"性格/风格","visualAnchor":"视觉基准锁定","visualLock":"视觉锁定","continuityRule":"连续性变化规则","referenceResources":"参考资源 token 串","evidenceSource":["来自第几场/哪段描述"],"nanoBananaPrompt":"NanoBanana / Gemini 图像版中文提示词，必须包含白底人物头部特写及三视图、横向排列、中间用黑色细线分割","openSourcePrompt":"开源模型版中文审美段落，必须包含白色纯背景、头部特写、正面/侧面/背面三视图、横向排版、黑色细线分割","midjourneyPrompt":"英文 Midjourney 提示词，必须包含 white background, head close-up, front/side/back turnaround, horizontal layout, thin black divider lines"}]',
  "}",
].join("\n");

export const NOVEL_SCENE_ASSET_SCHEMA = [
  "请只返回 JSON，不要 Markdown 代码块。结构如下：",
  "{",
  '  "scenes": [{"name":"场景名称","locationType":"地点属性","sceneFunction":"场景功能","timeOfDay":"时间","weather":"天气","lightStructure":"光源结构","colorTemperature":"主色温","materials":"地面/墙面/空气材质","architecture":"建筑与空间特征","landmarks":"视觉标识物","movementPath":"主空间动线","depthRelation":"纵深关系","visualAnchor":"视觉基准锁定","visualLock":"视觉锁定","continuityRule":"连续性变化规则","referenceResources":"参考资源 token 串","evidenceSource":["来自第几场/哪段描述"],"nanoBananaPrompt":"NanoBanana / Gemini 中文场景提示词，正向完整展示","openSourcePrompt":"开源模型版中文审美段落","midjourneyPrompt":"英文 Midjourney 场景提示词"}]',
  "}",
].join("\n");

export const NOVEL_PROP_ASSET_SCHEMA = [
  "请只返回 JSON，不要 Markdown 代码块。结构如下：",
  "{",
  '  "props": [{"name":"道具名称","dramaticFunction":"戏剧功能","form":"基础形态","material":"材质","sizeFeeling":"尺寸感","surfaceState":"颜色与表面状态","structureDetails":"结构细节","useMarks":"使用痕迹","powerFeeling":"危险性/神秘性/权力感","ownerConflict":"被谁使用或争夺","stageChange":"出场阶段变化","visualAnchor":"视觉基准锁定","visualLock":"视觉锁定","continuityRule":"连续性变化规则","referenceResources":"参考资源 token 串","evidenceSource":["来自第几场/哪段描述"],"nanoBananaPrompt":"NanoBanana / Gemini 中文道具提示词，正面完整展示","openSourcePrompt":"开源模型版中文审美段落","midjourneyPrompt":"英文 Midjourney 道具提示词"}]',
  "}",
].join("\n");

export function buildAssetLockFieldsHealthFixTemplate() {
  return [
    "你是影视资产连续性修复助手。",
    "请补全当前资产的 visualLock、continuityRule、evidenceSource，并从给定资源目录里选择最相关的 referenceResources。",
    "visualLock 要写稳定外观/材质/结构锚点；continuityRule 要写受伤、沾污、情绪升级或光线变化时哪些能变、哪些不能变；evidenceSource 要写当前资产主要依据的剧本/镜头证据；referenceResources 只能引用给定 token。",
    "只返回 JSON：{\"visualLock\":\"...\",\"continuityRule\":\"...\",\"evidenceSource\":[\"来自场次一...\"],\"referenceResources\":\"@资源_xxx @资源_yyy\"}",
  ].join("\n");
}

export function buildHealthAssetSliceTemplate(targetCategory, assetTemplate) {
  if (targetCategory === "角色") return `${assetTemplate}\n\n当前只抽取人物资产。若给定 targetAsset，必须优先生成该角色，名称和 token 要与 targetAsset 对齐。必须输出角色资产卡和三套引擎提示词。`;
  if (targetCategory === "场景") return `${assetTemplate}\n\n当前只抽取场景资产。若给定 targetAsset，必须优先生成该场景，名称和 token 要与 targetAsset 对齐。必须输出场景资产卡和三套引擎提示词。`;
  return `${assetTemplate}\n\n当前只抽取道具资产。若给定 targetAsset，必须优先生成该道具，名称和 token 要与 targetAsset 对齐。必须输出道具资产卡和三套引擎提示词。`;
}

export function selectHealthAssetSliceSchema(targetCategory) {
  if (targetCategory === "角色") return NOVEL_CHARACTER_ASSET_SCHEMA;
  if (targetCategory === "场景") return NOVEL_SCENE_ASSET_SCHEMA;
  return NOVEL_PROP_ASSET_SCHEMA;
}

export function buildShotHealthFixTemplate(fixKind) {
  if (fixKind === "shot_image_prompt") {
    return [
      "你是 AI 图像分镜提示词修复助手。",
      "请为当前镜头生成或增强 imagePrompt。",
      "要求：优先引用 1-3 个最相关资产 token，按“主体 -> 场景/背景 -> 风格 -> 景别/机位 -> 光线/材质 -> 连续性锁定”的顺序写；只保留当前镜头必要信息；不要改写成剧情摘要。",
      "同时补全 mainFocus、openingFrame、continuityNote、riskControl，方便下游直接生成。",
      "只返回 JSON：{\"imagePrompt\":\"...\",\"mainFocus\":\"...\",\"openingFrame\":\"...\",\"continuityNote\":\"...\",\"riskControl\":\"...\",\"assetTokens\":[\"@角色_xxx\"]}",
    ].join("\n");
  }
  if (fixKind === "shot_video_prompt") {
    return [
      "你是 AI 视频分镜提示词修复助手。",
      "请为当前镜头生成或增强 videoPrompt。",
      "要求：按“镜头运动 : 建立环境。主体动作。关键表情或物理反馈。光线/风格。连续性锁定”的顺序写；包含 openingFrame -> action -> closingFrame；优先引用 1-3 个最相关资产 token；适合实际视频生成。",
      "同时补全 mainFocus、openingFrame、closingFrame、continuityNote、riskControl，避免动作断层和脸漂移。",
      "只返回 JSON：{\"videoPrompt\":\"...\",\"mainFocus\":\"...\",\"openingFrame\":\"...\",\"closingFrame\":\"...\",\"continuityNote\":\"...\",\"riskControl\":\"...\",\"assetTokens\":[\"@角色_xxx\"]}",
    ].join("\n");
  }
  if (fixKind === "shot_asset_refs") {
    return [
      "你是镜头连续性修复助手。",
      "请根据镜头内容和资产目录，选择最相关的 1-3 个资产 token，并重写 imagePrompt 与 videoPrompt，让它们显式包含这些 token。",
      "重写时避免重复堆砌设定，同一外观/场景信息不要在一条提示词里反复出现；优先保留稳定识别信息和当前镜头瞬间。",
      "不要瞎编不存在的 token。",
      "只返回 JSON：{\"imagePrompt\":\"...\",\"videoPrompt\":\"...\",\"assetTokens\":[\"@角色_xxx\"],\"mainFocus\":\"...\",\"openingFrame\":\"...\",\"closingFrame\":\"...\",\"continuityNote\":\"...\",\"riskControl\":\"...\"}",
    ].join("\n");
  }
  if (fixKind === "shot_reference_resources") {
    return [
      "你是镜头参考资源修复助手。",
      "请根据镜头内容和资源目录，挑选最相关的参考资源 token，生成 referenceResources 字段。",
      "优先选择图像、参考、文档类资源；不要瞎编不存在的 token。",
      "只返回 JSON：{\"referenceResources\":\"@资源_xxx @资源_yyy\"}",
    ].join("\n");
  }
  return "";
}
