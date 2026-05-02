export const WORKFLOW_STAGE_DEFS = [
  { key: "novel", label: "剧本" },
  { key: "asset", label: "资产" },
  { key: "shot", label: "镜头" },
  { key: "review", label: "审稿" },
  { key: "timeline", label: "时间线" },
  { key: "export", label: "导出" },
];

export function buildWorkflowNavigator(active = {}) {
  const shots = active.shots || 0;
  const clips = active.timelineClips || 0;
  const stageStates = [
    {
      key: "novel",
      label: "剧本",
      done: (active.scripts || 0) > 0,
      detail: active.scripts ? "剧本节点已就位" : "缺少小说/剧本产出",
      action: "novel",
    },
    {
      key: "asset",
      label: "资产",
      done: (active.characters || 0) > 0 && (active.scenes || 0) > 0,
      detail: `人物 ${active.characters || 0} · 场景 ${active.scenes || 0}`,
      action: "asset",
    },
    {
      key: "shot",
      label: "镜头",
      done: shots > 0 && (active.promptReady || 0) >= shots,
      detail: shots ? `提示词 ${active.promptReady || 0}/${shots}` : "缺少镜头表",
      action: "shot",
    },
    {
      key: "review",
      label: "审稿",
      done: shots > 0 && !(active.pendingReview || 0) && !(active.autoFixPending || 0) && !(active.refreshPlanPending || 0),
      detail: `待审 ${active.pendingReview || 0} · 待修 ${active.autoFixPending || 0}`,
      action: "review",
    },
    {
      key: "timeline",
      label: "时间线",
      done: shots > 0 && clips >= shots && (active.timelineReady || 0) >= clips && !(active.timelineBackfillPending || 0),
      detail: clips ? `素材 ${active.timelineReady || 0}/${clips}` : "未排时间线",
      action: "timeline",
    },
    {
      key: "export",
      label: "导出",
      done: Boolean(active.exportReady) && !(active.failedExports || 0),
      detail: active.exportReady ? `失败导出 ${active.failedExports || 0}` : "未达导出门槛",
      action: "export",
    },
  ];
  let previousDone = true;
  const sequentialStages = stageStates.map((stage) => {
    const done = previousDone && stage.done;
    previousDone = done;
    return { ...stage, done };
  });
  const doneCount = sequentialStages.filter((stage) => stage.done).length;
  const nextStage = sequentialStages.find((stage) => !stage.done) || sequentialStages[sequentialStages.length - 1];
  const blockers = buildWorkflowNavigatorBlockers(active, nextStage).slice(0, 3);

  return {
    stages: sequentialStages,
    doneCount,
    total: stageStates.length,
    progress: stageStates.length ? Math.round((doneCount / stageStates.length) * 100) : 0,
    nextStage,
    blockers,
    readyToExport: Boolean(active.exportReady) && !(active.failedExports || 0),
  };
}

function buildWorkflowNavigatorBlockers(active, nextStage) {
  const blockers = [];
  const push = (label, tone = "warn") => blockers.push({ label, tone });
  if (!nextStage) return blockers;
  if (nextStage.key === "novel") push("先完成小说转剧本", "danger");
  if (nextStage.key === "asset") {
    if (!(active.characters || 0)) push("缺人物资产", "danger");
    if (!(active.scenes || 0)) push("缺场景资产", "danger");
  }
  if (nextStage.key === "shot") {
    if (!(active.shots || 0)) push("缺镜头表", "danger");
    else if ((active.promptReady || 0) < (active.shots || 0)) push(`缺提示词 ${(active.shots || 0) - (active.promptReady || 0)} 条`);
  }
  if (nextStage.key === "review") {
    if (active.pendingReview) push(`待审 ${active.pendingReview} 个`, "danger");
    if (active.autoFixPending) push(`待自动修改 ${active.autoFixPending} 个`);
    if (active.refreshPlanPending) push(`待刷新计划 ${active.refreshPlanPending} 个`);
  }
  if (nextStage.key === "timeline") {
    if (!(active.timelineClips || 0)) push("镜头未进时间线", "danger");
    if ((active.timelineClips || 0) > (active.timelineReady || 0)) push(`缺素材 ${(active.timelineClips || 0) - (active.timelineReady || 0)} 条`);
    if (active.timelineBackfillPending) push(`待回写 ${active.timelineBackfillPending} 条`);
  }
  if (nextStage.key === "export") {
    if (!active.exportReady) push("未达导出门槛", "danger");
    if (active.failedExports) push(`失败导出 ${active.failedExports} 条`);
  }
  return blockers;
}
