export function buildQueueOperationsBoard(queue = []) {
  const jobs = Array.isArray(queue) ? queue : [];
  const failed = jobs.filter((job) => job.status === "failed");
  const groups = groupBy(jobs, (job) => job.shotId || job.targetId || job.sourceAssetToken || "未分组");
  const failureReasons = failed.reduce((acc, job) => {
    const reason = classifyFailure(job.error || job.resultSummary || job.message || "");
    acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {});
  return {
    total: jobs.length,
    pending: jobs.filter((job) => job.status === "pending").length,
    running: jobs.filter((job) => job.status === "running").length,
    failed: failed.length,
    done: jobs.filter((job) => job.status === "done").length,
    groups: Object.entries(groups).map(([key, items]) => ({ key, count: items.length, failed: items.filter((item) => item.status === "failed").length })),
    failureReasons,
    suggestedAction: failed.length ? suggestedQueueAction(failureReasons) : "continue",
  };
}

export function classifyFailure(message = "") {
  const text = String(message || "").toLowerCase();
  if (/401|403|unauthorized|forbidden|api key|鉴权|权限/.test(text)) return "auth";
  if (/timeout|timed out|network|econn|网络|超时/.test(text)) return "network";
  if (/quota|余额|额度|insufficient/.test(text)) return "quota";
  if (/field|path|json|字段|解析/.test(text)) return "schema";
  if (/file|path|missing|not found|文件|路径/.test(text)) return "file";
  if (/param|invalid|参数/.test(text)) return "params";
  return "unknown";
}

function suggestedQueueAction(reasons = {}) {
  if (reasons.auth) return "openSettings";
  if (reasons.schema) return "checkProviderMapping";
  if (reasons.network) return "retry";
  if (reasons.quota) return "switchProvider";
  if (reasons.file) return "repairMedia";
  return "retry";
}

function groupBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});
}
