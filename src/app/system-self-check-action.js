import {
  runMiniProductionE2E,
} from "../domain/mini-production-e2e.js";

export function runSystemSelfCheckAction({
  runSelfCheck = runMiniProductionE2E,
  setShowDashboard,
  setProjectMessage,
} = {}) {
  const result = runSelfCheck();
  setShowDashboard?.(true);
  setProjectMessage?.(result.ok ? "系统自检通过：最小生产链路可跑通。" : "系统自检发现阻塞，请查看总控台。");
  return buildSystemSelfCheckResult(result);
}

export function buildSystemSelfCheckResult(result = {}) {
  return {
    title: result.ok ? "系统自检通过" : "系统自检失败",
    summary: result.ok ? "最小生产链路可跑通。" : `阻塞：${result.gate?.blockers?.join("、") || "未知"}`,
    result,
  };
}
