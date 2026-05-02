export function buildLocalNovelPipeline(novelText, template = "") {
  const cleaned = cleanText(novelText);
  const paragraphs = splitParagraphs(cleaned);
  const characters = extractCharacters(cleaned);
  const scenes = extractScenes(cleaned, paragraphs);
  const props = extractProps(cleaned);
  const beats = buildBeats(paragraphs, scenes, characters);
  const characterAssets = characters.map((character, index) => buildCharacterAsset(character, cleaned, template, index));
  const sceneAssets = scenes.map((scene, index) => buildSceneAsset(scene, beats[index % beats.length], template));
  const propAssets = props.map((prop, index) => buildPropAsset(prop, beats[index % beats.length], template));
  const shots = buildShots(beats, characterAssets, sceneAssets, propAssets);
  const script = buildScript(beats, characters, template);
  const characterPrompts = formatAssets(characterAssets);
  const scenePrompts = formatAssets(sceneAssets);
  const propPrompts = formatAssets(propAssets);
  const videoPrompts = shots.map((shot) => `【${shot.id}｜${shot.scene}】\n${shot.videoPrompt}`).join("\n\n");
  const finalPrompts = [
    "【人物资产】",
    characterPrompts,
    "",
    "【场景资产】",
    scenePrompts,
    "",
    "【道具资产】",
    propPrompts,
    "",
    "【镜头提示词】",
    shots.map((shot) => `${shot.id}\n图片：${shot.imagePrompt}\n视频：${shot.videoPrompt}`).join("\n\n"),
  ].join("\n");
  return {
    script,
    characterPrompts,
    scenePrompts,
    propPrompts,
    videoPrompts,
    finalPrompts,
    characterAssets,
    sceneAssets,
    propAssets,
    shots,
  };
}

export function buildTextPipelineSyncPayloads(pipeline = {}) {
  const assetPatch = {
    characters: Array.isArray(pipeline.characterAssets) ? pipeline.characterAssets : [],
    scenes: Array.isArray(pipeline.sceneAssets) ? pipeline.sceneAssets : [],
    props: Array.isArray(pipeline.propAssets) ? pipeline.propAssets : [],
    displayName: "资产库",
  };
  const shotPatch = {
    shots: Array.isArray(pipeline.shots) ? pipeline.shots : [],
    displayName: "镜头表",
  };
  return {
    assetPatch,
    hasAssets: assetPatch.characters.length || assetPatch.scenes.length || assetPatch.props.length,
    shotPatch,
    hasShots: shotPatch.shots.length,
  };
}

function cleanText(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitParagraphs(text) {
  const byLine = text.split(/\n+/).map((item) => item.trim()).filter(Boolean);
  if (byLine.length >= 3) return byLine.slice(0, 8);
  return text.split(/(?<=[。！？!?；;])/).map((item) => item.trim()).filter(Boolean).slice(0, 8);
}

function extractCharacters(text) {
  const names = new Map();
  const patterns = [
    /([\u4e00-\u9fa5A-Za-z0-9]{2,8})(?:说|问|喊|道|笑道|低声|回答|皱眉|看着|走向)/g,
    /“[^”]{1,40}”([\u4e00-\u9fa5A-Za-z0-9]{2,8})(?:说|问|道|喊)/g,
  ];
  patterns.forEach((pattern) => {
    for (const match of text.matchAll(pattern)) {
      const name = String(match[1] || "").replace(/[，。！？、：:；;“”]/g, "").trim();
      if (name && !/^(这时|然后|突然|但是|因为|一个|他们|我们|自己|所有人)$/.test(name)) {
        names.set(name, (names.get(name) || 0) + 1);
      }
    }
  });
  const sorted = [...names.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name).slice(0, 5);
  const fallback = sorted.length ? sorted : ["主角", "关键配角"];
  return fallback.map((name, index) => ({
    name,
    role: index === 0 ? "主角" : "关键关系人物",
    visual: inferCharacterVisual(text, name, index),
  }));
}

function inferCharacterVisual(text, name, index) {
  const context = collectContext(text, name);
  const gender = /她|少女|女人|母亲|女孩/.test(context) ? "女性" : /他|少年|男人|父亲|男孩/.test(context) ? "男性" : "中性角色";
  const age = /老人|白发|苍老/.test(context) ? "年长" : /少年|少女|学生|年轻/.test(context) ? "年轻" : "青年";
  const mood = /冷|怒|恨|杀|危险/.test(context) ? "压抑锐利" : /笑|温柔|暖|希望/.test(context) ? "温和明亮" : "克制坚定";
  const palettes = ["黑白青色点缀", "墨绿与银灰", "深红与炭黑", "浅蓝与米白", "紫灰与冷金"];
  return `${age}${gender}，${mood}气质，服装配色${palettes[index % palettes.length]}，适合漫剧角色设计`;
}

function extractScenes(text, paragraphs) {
  const candidates = [];
  const pattern = /(?:在|到|来到|走进|冲进|回到|进入)([\u4e00-\u9fa5A-Za-z0-9]{2,12})(?:里|中|前|后|外|旁|上|下|，|。|、|的)?/g;
  for (const match of text.matchAll(pattern)) {
    const place = String(match[1] || "").replace(/^(一个|那片|这座|那座)/, "");
    if (place && !candidates.includes(place)) candidates.push(place);
  }
  const fallback = ["主要室内场景", "关键冲突场景", "结尾转折场景"];
  return (candidates.length ? candidates : fallback).slice(0, 5).map((name, index) => ({
    name,
    description: paragraphs[index % Math.max(1, paragraphs.length)] || text.slice(0, 80),
  }));
}

function extractProps(text) {
  const props = [];
  const pattern = /(?:拿起|握住|掏出|递出|放下|举起|打开|关上|藏进|丢下|拔出|按下|点亮|戴上|摘下|捡起|收起)(?:一枚|一把|一个|一只|那枚|那把|那个|这枚|这把|这个)?([\u4e00-\u9fa5A-Za-z0-9]{2,10})/g;
  for (const match of text.matchAll(pattern)) {
    const name = String(match[1] || "").trim();
    if (!name || /^(自己|他们|我们|地方|房间|男人|女人|少年|少女)$/.test(name)) continue;
    if (!props.some((prop) => prop.name === name)) props.push({ name, description: collectContext(text, name) });
  }
  if (!props.length) {
    props.push({ name: "关键道具", description: "推动剧情转折的核心物件，适合在镜头中被角色手持或特写展示。" });
  }
  return props.slice(0, 5);
}

function buildBeats(paragraphs, scenes, characters) {
  const usable = paragraphs.length ? paragraphs : ["人物进入场景，冲突被触发，关系出现变化。"];
  return usable.slice(0, 6).map((paragraph, index) => {
    const scene = scenes[index % scenes.length];
    const speaker = characters[index % characters.length];
    const partner = characters[(index + 1) % characters.length] || speaker;
    return {
      index: index + 1,
      scene: scene.name,
      time: index === 0 ? "夜" : index === usable.length - 1 ? "黎明" : "连续时间",
      characters: unique([speaker.name, partner.name]),
      action: summarize(paragraph, 46),
      emotion: inferEmotion(paragraph),
      dialogue: extractDialogue(paragraph) || `${speaker.name}：${summarize(paragraph, 28)}`,
      camera: pickCamera(index),
    };
  });
}

function buildScript(beats, characters, template) {
  const header = [
    `剧本模板摘要：${summarize(template, 80)}`,
    `主要人物：${characters.map((item) => `${item.name}（${item.role}）`).join("、")}`,
  ];
  const body = beats.map((beat) => [
    `第${beat.index}场｜${beat.scene}｜${beat.time}`,
    `人物：${beat.characters.join("、")}`,
    `画面：${beat.action}`,
    "动作：人物围绕核心冲突推进，保留可视化动作，减少解释性旁白。",
    `对白：${beat.dialogue}`,
    `情绪：${beat.emotion}`,
    `镜头：${beat.camera}`,
  ].join("\n"));
  return [...header, "", ...body].join("\n\n");
}

function buildCharacterAsset(character, novelText, template, index) {
  const style = inferVisualStyle(template);
  const context = summarize(collectContext(novelText, character.name), 60);
  const visualLock = `${character.name}的发型轮廓、脸型、五官比例、肤色、主色和标志识别点保持稳定`;
  const continuityRule = "允许情绪、轻微受损或沾灰变化，但核心身份识别不能漂移。";
  const promptVariants = {
    nanoBanana: `${character.name}，${character.visual}，${context}，${style}，白色纯背景，头部特写与正面、侧面、背面三视图，角色资产设定图。视觉锁定：${visualLock}。连续性规则：${continuityRule}。`,
    openSource: `${character.name}角色资产展示，${character.visual}，${context}，${style}，同一角色三视图，五官比例和服装配色稳定。${visualLock}。${continuityRule}。`,
    midjourney: `${character.name}, character turnaround sheet, head close-up, front side back view, ${style}, stable face, stable costume, clean white background`,
  };
  return {
    name: character.name,
    kind: character.role,
    token: makeAssetToken("角色", character.name),
    meta: `角色定位：${context}`,
    prompt: formatPromptVariants(promptVariants),
    promptVariants,
    visualLock,
    continuityRule,
    evidenceSource: [`${character.name}人物上下文：${context}`],
  };
}

function buildSceneAsset(scene, beat, template) {
  const style = inferVisualStyle(template);
  const summary = summarize(scene.description, 70);
  const visualLock = `${scene.name}的空间朝向、主光方向、标识物和主要材质保持稳定`;
  const continuityRule = "允许昼夜、天气和破损变化，但空间结构、主光方向和标识物不能失真。";
  const promptVariants = {
    nanoBanana: `${scene.name}，${summary}，${style}，完整展示空间结构，前中远景层次清楚，主光方向和标识物稳定，场景资产设定图。视觉锁定：${visualLock}。连续性规则：${continuityRule}。`,
    openSource: `${scene.name}可复用场景资产，${summary}，${style}，空间动线、材质关系、主光方向和标识物清晰稳定。${visualLock}。${continuityRule}。`,
    midjourney: `${scene.name}, environment asset sheet, full scene establishment, ${style}, stable landmarks, clear spatial depth, locked key light`,
  };
  return {
    name: scene.name,
    kind: "场景",
    token: makeAssetToken("场景", scene.name),
    meta: `来源情节：${summary}`,
    prompt: formatPromptVariants(promptVariants),
    promptVariants,
    visualLock,
    continuityRule,
    evidenceSource: [`场景描述：${summary}`, beat?.action ? `关联动作：${summarize(beat.action, 30)}` : ""].filter(Boolean),
  };
}

function buildPropAsset(prop, beat, template) {
  const style = inferVisualStyle(template);
  const summary = summarize(prop.description, 70);
  const visualLock = `${prop.name}的轮廓、结构细节、关键材质和识别痕迹保持稳定`;
  const continuityRule = "允许磨损、沾灰、裂痕或能量激活变化，但主体轮廓和核心结构不能变化。";
  const promptVariants = {
    nanoBanana: `${prop.name}，${summary}，${style}，单体道具正面完整展示，结构比例清楚，材质和边缘细节明确。视觉锁定：${visualLock}。连续性规则：${continuityRule}。`,
    openSource: `${prop.name}可复用道具设定图，${summary}，${style}，结构、尺寸、材质、表面状态和识别细节清晰可读。${visualLock}。${continuityRule}。`,
    midjourney: `${prop.name}, prop asset sheet, single object, ${style}, clear structure, detailed material, clean background`,
  };
  return {
    name: prop.name,
    kind: "道具",
    token: makeAssetToken("道具", prop.name),
    meta: summary,
    prompt: formatPromptVariants(promptVariants),
    promptVariants,
    visualLock,
    continuityRule,
    evidenceSource: [`道具描述：${summary}`, beat?.scene ? `关联场景：${beat.scene}` : ""].filter(Boolean),
  };
}

function buildShots(beats, characterAssets, sceneAssets, propAssets) {
  return beats.map((beat) => {
    const characterTokens = beat.characters.map((name) => characterAssets.find((asset) => asset.name === name)?.token || makeAssetToken("角色", name));
    const sceneToken = sceneAssets.find((asset) => asset.name === beat.scene)?.token || makeAssetToken("场景", beat.scene);
    const propToken = propAssets.length ? propAssets[(beat.index - 1) % propAssets.length].token : "";
    const keyPropTokens = propToken ? [propToken] : [];
    const assetRefs = [sceneToken, ...characterTokens, ...keyPropTokens].filter(Boolean);
    const propPart = propToken ? `，${propToken}` : "";
    const shotSize = pickShotSize(beat.index);
    return {
      id: `S${String(beat.index).padStart(2, "0")}`,
      episode: "EP01",
      scene: beat.scene,
      characters: beat.characters,
      shotSize,
      camera: beat.camera,
      action: beat.action,
      dialogue: beat.dialogue,
      emotion: beat.emotion,
      duration: "4-6s",
      status: "待生成",
      mainCharacterToken: characterTokens[0] || "",
      mainSceneToken: sceneToken,
      keyPropTokens,
      assetRefs,
      imagePrompt: `${sceneToken}，${characterTokens.join("、")}${propPart}，${beat.action}，${shotSize}，${beat.emotion}，${beat.camera}，商业级漫剧画面，构图清晰，角色一致，禁止文字水印。`,
      videoPrompt: `${sceneToken}，${characterTokens.join("、")}${propPart}，${beat.camera}，人物动作：${beat.action}，对白情绪：${beat.dialogue}，${beat.emotion}，4-6秒，动作连续，镜头稳定，角色脸部一致。`,
    };
  });
}

function collectContext(text, keyword) {
  const index = text.indexOf(keyword);
  if (index < 0) return text.slice(0, 220);
  return text.slice(Math.max(0, index - 90), Math.min(text.length, index + 160));
}

function extractDialogue(text) {
  const match = String(text || "").match(/[“"](.*?)[”"]/);
  return match ? match[1].slice(0, 48) : "";
}

function inferEmotion(text) {
  if (/怒|恨|杀|吼|崩溃|绝望/.test(text)) return "爆发、压迫、紧张";
  if (/哭|泪|痛|失去|沉默/.test(text)) return "悲伤、克制、低落";
  if (/笑|暖|拥抱|希望|相信/.test(text)) return "温暖、释然、希望";
  if (/跑|追|逃|冲|撞/.test(text)) return "急促、危险、强节奏";
  return "悬念、克制、情绪推进";
}

function pickCamera(index) {
  return ["建立镜头，缓慢推进", "中景跟拍，轻微手持", "近景切表情，压缩景深", "低角度推镜，强化压迫", "环绕半圈，制造转折", "特写定格，留情绪余味"][index % 6];
}

function pickShotSize(index) {
  return ["全景", "中景", "近景", "特写", "低角度中景", "情绪特写"][(index - 1) % 6];
}

function inferVisualStyle(template) {
  if (/写实|电影|真人/.test(template)) return "写实电影风格";
  if (/国漫|漫画|动漫|二次元/.test(template)) return "高质量国漫动画风格";
  if (/3D|CG|建模/.test(template)) return "3D CG角色设定风格";
  return "商业级漫剧视觉风格";
}

function makeAssetToken(category, name) {
  return `@${category}_${String(name || "").replace(/\s+/g, "").replace(/[^\u4e00-\u9fa5A-Za-z0-9_-]/g, "") || "未命名"}`;
}

function formatAssets(assets) {
  return (assets || []).map((asset) => [
    `【${asset.name}｜${asset.kind}｜${asset.token}】`,
    asset.prompt || "",
    asset.visualLock ? `视觉锁定：${asset.visualLock}` : "",
    asset.continuityRule ? `连续性：${asset.continuityRule}` : "",
  ].filter(Boolean).join("\n")).join("\n\n");
}

function formatPromptVariants(variants) {
  return [
    variants.nanoBanana ? `【NanoBanana / Gemini 图像提示词（中文）】\n${variants.nanoBanana}` : "",
    variants.openSource ? `【开源模型版提示词（中文段落）】\n${variants.openSource}` : "",
    variants.midjourney ? `【Midjourney 提示词】\n${variants.midjourney}` : "",
  ].filter(Boolean).join("\n\n");
}

function summarize(text, maxLength) {
  const compact = String(text || "").replace(/\s+/g, "").replace(/[，。！？；：、,.!?;:]+$/g, "");
  return compact.length > maxLength ? `${compact.slice(0, maxLength)}...` : compact;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

