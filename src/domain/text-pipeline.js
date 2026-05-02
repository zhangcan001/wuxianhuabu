import {
  buildLocalNovelPipeline,
  buildTextPipelineSyncPayloads,
} from "./text-local-builder.js";

export function createTextProductionPackage(input = {}, deps = {}) {
  const novelText = String(input.novelText || "").trim();
  if (!novelText) {
    return {
      ok: false,
      error: "请先粘贴小说、剧情梗概或已有剧本。",
      pipeline: null,
      assetPatch: null,
      shotPatch: null,
      metrics: [],
    };
  }

  const {
    buildNovelPipeline = buildLocalNovelPipeline,
    buildPipelineSyncPayloads = buildTextPipelineSyncPayloads,
    buildProjectName = defaultBuildProjectName,
    template = "",
    taskMode = "短剧漫剧",
    note = "文本生产",
    stage = "prompts",
  } = deps;

  const pipeline = {
    ...buildNovelPipeline(novelText, template),
    projectName: buildProjectName(taskMode, novelText),
    note,
    stage,
  };
  const { assetPatch, shotPatch, hasAssets, hasShots } = buildPipelineSyncPayloads(pipeline);
  const metrics = buildTextProductionMetrics(assetPatch, shotPatch);

  return {
    ok: true,
    error: "",
    novelText,
    pipeline,
    assetPatch,
    shotPatch,
    hasAssets: Boolean(hasAssets),
    hasShots: Boolean(hasShots),
    metrics,
    summary: "已完成到资产输出和镜头表提示词；图片生成未启动。",
  };
}

export function buildTextProductionMetrics(assetPatch = {}, shotPatch = {}) {
  return [
    { label: "角色", value: Array.isArray(assetPatch.characters) ? assetPatch.characters.length : 0 },
    { label: "场景", value: Array.isArray(assetPatch.scenes) ? assetPatch.scenes.length : 0 },
    { label: "道具", value: Array.isArray(assetPatch.props) ? assetPatch.props.length : 0 },
    { label: "镜头", value: Array.isArray(shotPatch.shots) ? shotPatch.shots.length : 0 },
  ];
}

export function applyTextProductionPackageToNodes(nodes = [], packageResult = {}, targetIds = {}) {
  if (!packageResult?.ok) return Array.isArray(nodes) ? nodes : [];
  const {
    novelNodeId = "",
    assetNodeId = "",
    shotNodeId = "",
  } = targetIds;
  return (Array.isArray(nodes) ? nodes : []).map((node) => {
    if (node.id === novelNodeId) {
      return {
        ...node,
        data: {
          ...node.data,
          novel: packageResult.novelText,
          pipeline: packageResult.pipeline,
          lastFactoryNote: packageResult.pipeline?.note || "",
        },
      };
    }
    if (node.id === assetNodeId) {
      return {
        ...node,
        data: {
          ...node.data,
          ...packageResult.assetPatch,
        },
      };
    }
    if (node.id === shotNodeId) {
      return {
        ...node,
        data: {
          ...node.data,
          ...packageResult.shotPatch,
        },
      };
    }
    return node;
  });
}

function defaultBuildProjectName(taskMode, novelText) {
  const firstLine = String(novelText || "").split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "未命名项目";
  return `${taskMode || "项目"}-${firstLine.slice(0, 18)}`;
}
