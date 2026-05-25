import { createNode } from "./node-factory.js";

const DEMO_NOVEL_TEXT = `第一集 · 雪夜灯下

冬月初九，长安城落了第一场雪。
苏微站在书肆门外，借一盏宫灯的余光，把母亲留下的半阙残词又默念了一遍。
雪粒细细地打在她的青衫上，转眼就化了。

"姑娘，"灯下那位戴乌纱帽的少年放下书卷，"你站在这里，已经一炷香了。"
苏微抬头，他的眉眼像极了昨夜她在梦里见过的人。
"——你也读这卷《长安春》？"

少年笑了。"我写的。"`;

const DEMO_EPISODE_ID = "episode-1";

const DEMO_PROMPT = "雪夜，长安老书肆门口，少女苏微身穿青衫立于灯下，仰望屋檐上的灯笼，光影柔和，国风工笔画风格";

function makeDemoNovelNode(id) {
  return createNode(
    "novelPipeline",
    id,
    { x: -540, y: -380 },
    {
      episodeId: DEMO_EPISODE_ID,
      novel: DEMO_NOVEL_TEXT,
      displayName: "示例小说 · 雪夜灯下",
    },
  );
}

function makeDemoShotListNode(id) {
  return createNode(
    "shotList",
    id,
    { x: 660, y: -380 },
    {
      episodeId: DEMO_EPISODE_ID,
      displayName: "示例分镜表",
      shots: [
        {
          id: "demo-shot-1",
          order: 1,
          summary: "苏微在雪中站在书肆门外，借灯光读残词",
          camera: "近景，仰拍灯笼方向",
          action: "苏微抬头，雪粒落在青衫上",
          prompt: DEMO_PROMPT,
          status: "已分镜",
        },
        {
          id: "demo-shot-2",
          order: 2,
          summary: "少年抬眼，与苏微视线相接",
          camera: "中景，侧脸特写",
          action: "少年放下书卷，目光投向门外",
          prompt: "戴乌纱帽的青年坐在书案前，提笔，目光温和望向门外，烛火映在他的脸上，工笔画风",
          status: "待写",
        },
        {
          id: "demo-shot-3",
          order: 3,
          summary: "苏微推门入内，雪花随她飘进店里",
          camera: "全景",
          action: "苏微推开门，少年起身相迎",
          prompt: "苏微推开木门，雪花飘入古朴书肆，灯笼摇曳，少年起身相迎，工笔画风",
          status: "待写",
        },
      ],
    },
  );
}

function makeDemoAssetLibraryNode(id) {
  return createNode(
    "assetLibrary",
    id,
    { x: -540, y: 460 },
    {
      episodeId: DEMO_EPISODE_ID,
      displayName: "示例资产库",
      assets: [
        { id: "demo-asset-1", name: "苏微", type: "character", note: "青衫少女，长发，眉眼清冷" },
        { id: "demo-asset-2", name: "少年", type: "character", note: "戴乌纱帽，书生气，眼神温和" },
        { id: "demo-asset-3", name: "雪夜书肆", type: "scene", note: "长安城老书肆，门外大雪，挂红灯笼" },
      ],
    },
  );
}

function makeDemoGuideTextNode(id) {
  return createNode(
    "text",
    id,
    { x: 660, y: 460 },
    {
      episodeId: DEMO_EPISODE_ID,
      displayName: "新手提示",
      width: 520,
      height: 240,
      text: [
        "✨ 这是一个示例项目，已经塞好了：",
        "• 小说工厂（左上）— 已粘贴一段示例文本，可点'解析为分镜'",
        "• 分镜表（右上）— 已有 3 个示例镜头",
        "• 资产库（左下）— 列了 2 位角色 + 1 个场景",
        "",
        "下一步：在分镜表里点任意一行的'生成图片'，体验完整流程。",
        "未配置 API 时会落到'本地模拟'通道，仍会生成占位图。",
      ].join("\n"),
    },
  );
}

export function buildExampleProjectPayload() {
  return {
    nodes: [
      makeDemoNovelNode("demo-node-1"),
      makeDemoShotListNode("demo-node-2"),
      makeDemoAssetLibraryNode("demo-node-3"),
      makeDemoGuideTextNode("demo-node-4"),
    ],
    edges: [],
    view: { x: 0, y: 0, scale: 0.55 },
    episodes: [{ id: DEMO_EPISODE_ID, name: "第 1 集", note: "示例项目 · 雪夜灯下" }],
    activeEpisodeId: DEMO_EPISODE_ID,
    settings: { providerMode: "mock" },
  };
}

export const EXAMPLE_PROJECT_TITLE = "雪夜灯下（示例）";
export const EXAMPLE_PROJECT_NEXT_NODE_ID = 5;
