export const COMMAND_ACTIONS = [
  { key: "openProject", label: "打开工程", hint: "选择 .wxhb 工程文件", keywords: "open project file load" },
  { key: "saveProject", label: "保存工程", hint: "立即保存当前工程", keywords: "save project file write" },
  { key: "openDashboard", label: "总控台", hint: "项目总览与一键流程", keywords: "dashboard control overview" },
  { key: "openQueue", label: "生成队列", hint: "查看生成任务进度", keywords: "queue jobs generation tasks" },
  { key: "openTimeline", label: "时间线", hint: "排列镜头并挂接素材", keywords: "timeline shots edit" },
  { key: "openExport", label: "交付导出", hint: "推进到成片导出", keywords: "export deliver render" },
  { key: "openHealth", label: "项目体检", hint: "检查项目阻塞与风险", keywords: "health check risk audit" },
  { key: "openResources", label: "资源中心", hint: "项目资产与资源", keywords: "resources assets media library" },
  { key: "openPromptFactory", label: "Prompt 工厂", hint: "编辑镜头提示词", keywords: "prompt factory template" },
  { key: "openSettings", label: "API 设置", hint: "配置文本与媒体 API", keywords: "settings api configure profile" },
  { key: "openReviewCenter", label: "审稿反馈", hint: "查看与处理审稿", keywords: "review feedback approve" },
  { key: "openProductionHub", label: "成片工作台", hint: "查看成片生产", keywords: "production hub" },
  { key: "openArchive", label: "归档中心", hint: "归档当前项目状态", keywords: "archive snapshot history" },
];

export const NAV_ACTIONS = [
  { view: "overview", label: "切到总览", hint: "切换到生产总览", keywords: "navigate overview" },
  { view: "script", label: "切到剧本", hint: "切换到剧本工位", keywords: "navigate script" },
  { view: "shots", label: "切到镜头表", hint: "切换到镜头表", keywords: "navigate shots" },
  { view: "media", label: "切到媒体生产", hint: "切换到媒体生产", keywords: "navigate media" },
  { view: "assets", label: "切到资产库", hint: "切换到资产库", keywords: "navigate assets" },
  { view: "timeline", label: "切到时间线视图", hint: "切换到时间线视图", keywords: "navigate timeline" },
  { view: "review", label: "切到审片", hint: "切换到审片视图", keywords: "navigate review" },
  { view: "delivery", label: "切到交付", hint: "切换到交付视图", keywords: "navigate delivery" },
];

export function buildCommandPaletteItems({ actions = {}, navigateView } = {}) {
  const items = [];
  for (const action of COMMAND_ACTIONS) {
    const handler = actions[action.key];
    if (typeof handler !== "function") continue;
    items.push({
      key: `action:${action.key}`,
      label: action.label,
      hint: action.hint,
      keywords: `${action.label} ${action.keywords}`,
      run: () => handler(),
    });
  }
  if (typeof navigateView === "function") {
    for (const nav of NAV_ACTIONS) {
      items.push({
        key: `nav:${nav.view}`,
        label: nav.label,
        hint: nav.hint,
        keywords: `${nav.label} ${nav.keywords}`,
        run: () => navigateView(nav.view),
      });
    }
  }
  return items;
}

export function filterCommandPaletteItems(items, query) {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized) return items;
  return items.filter((item) => `${item.label} ${item.keywords || ""}`.toLowerCase().includes(normalized));
}
