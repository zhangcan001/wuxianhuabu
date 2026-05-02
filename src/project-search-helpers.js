export function shortTitle(text) {
  return String(text || "").replace(/\s+/g, " ").slice(0, 16) || "结果图片";
}

export function summarizeText(text, maxLength) {
  const compact = String(text || "").replace(/\s+/g, "").replace(/[，。！？；：、,.!?;:]+$/g, "");
  return compact.length > maxLength ? `${compact.slice(0, maxLength)}...` : compact;
}

export function buildSearchEntries(nodes = [], assetIndex = {}, resourceIndex = {}) {
  const nodeEntries = nodes.map((node) => ({
    id: node.id,
    nodeId: node.id,
    kind: nodeTypeLabel(node.type),
    title: node.data?.displayName || node.type,
    subtitle: summarizeText(searchNodeSubtitle(node), 80),
  }));
  const assetEntries = (assetIndex.items || []).map((asset) => ({
    id: asset.token,
    nodeId: asset.sourceId,
    kind: `${asset.category}资产`,
    title: asset.name,
    subtitle: `${asset.token} ${asset.meta || ""}`,
  }));
  const shotEntries = nodes
    .filter((node) => node.type === "shotList")
    .flatMap((node) => (node.data?.shots || []).map((shot) => ({
      id: `${node.id}-${shot.id}`,
      nodeId: node.id,
      kind: "镜头",
      title: `${shot.id} ${shot.scene}`,
      subtitle: `${shot.status || "待生成"} ${shot.action || ""}`,
    })));
  const resourceEntries = (resourceIndex.items || []).map((resource) => ({
    id: resource.id,
    nodeId: resource.references?.[0]?.nodeId || "",
    kind: "项目资源",
    title: resource.name,
    subtitle: `${resource.token} ${resource.scene || ""} ${resource.shot || ""} ${resource.tags || ""} ${resource.note || ""}`,
  }));
  return [...nodeEntries, ...assetEntries, ...shotEntries, ...resourceEntries];
}

export function nodeTypeLabel(type) {
  return {
    upload: "上传",
    imageEdit: "AI生图",
    geminiWeb: "Gemini网页",
    novelPipeline: "小说工厂",
    assetLibrary: "资产库",
    shotList: "镜头表",
    text: "文本",
    storyboard: "分镜",
    split: "拆分",
    vr360: "VR360",
    director3d: "导演台",
    result: "结果",
  }[type] || type;
}

export function searchNodeSubtitle(node = {}) {
  const data = node.data || {};
  if (node.type === "text") return data.text || "";
  if (node.type === "imageEdit") return data.prompt || "";
  if (node.type === "assetLibrary") return `${data.characters?.length || 0}人物 ${data.scenes?.length || 0}场景 ${data.props?.length || 0}道具`;
  if (node.type === "shotList") return `${data.shots?.length || 0}镜头`;
  if (node.type === "geminiWeb") return data.prompt || "";
  if (node.type === "novelPipeline") return data.novel || "";
  return data.note || data.displayName || "";
}
