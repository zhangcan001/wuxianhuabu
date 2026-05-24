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
    failureDetails: buildQueueFailureDetails(failed),
    suggestedAction: failed.length ? suggestedQueueAction(failureReasons) : "continue",
  };
}

export function buildQueueFailureDetails(failedJobs = []) {
  const jobs = Array.isArray(failedJobs) ? failedJobs.filter((job) => job?.status === "failed" || job?.error || job?.resultSummary) : [];
  const groups = groupBy(jobs, (job) => classifyFailure(job.error || job.resultSummary || job.message || ""));
  return Object.entries(groups).map(([reason, items]) => {
    const first = items[0] || {};
    return {
      reason,
      label: failureReasonLabel(reason),
      count: items.length,
      action: suggestedQueueAction({ [reason]: items.length }),
      actionLabel: failureActionLabel(suggestedQueueAction({ [reason]: items.length })),
      detail: failureReasonDetail(reason),
      examples: items.slice(0, 3).map((job) => ({
        id: job.id || "",
        title: job.title || job.shotId || job.targetId || job.sourceAssetToken || "失败任务",
        kind: job.kind || job.type || "",
        message: String(job.error || job.resultSummary || job.message || "未知错误").slice(0, 140),
      })),
    };
  }).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "zh-Hans-CN"));
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

function failureReasonLabel(reason = "") {
  return {
    auth: "鉴权失败",
    network: "网络或超时",
    quota: "额度不足",
    schema: "返回结构异常",
    file: "文件或路径缺失",
    params: "参数无效",
    unknown: "未知失败",
  }[reason] || "未知失败";
}

function failureReasonDetail(reason = "") {
  return {
    auth: "检查 API Key、账号权限或服务端鉴权配置。",
    network: "优先重试；如果持续失败，检查本地服务、代理或模型服务地址。",
    quota: "切换 Provider、降低批量规模，或补充账号额度后重试。",
    schema: "检查 Provider 映射和返回字段，必要时切到稳定接口。",
    file: "检查素材缓存、导入路径和时间线引用，先运行媒体完整性修复。",
    params: "检查提示词、尺寸、模型参数和 Provider 支持范围。",
    unknown: "先重试单条任务；仍失败时打开调试日志查看完整返回。",
  }[reason] || "先重试单条任务；仍失败时打开调试日志查看完整返回。";
}

function failureActionLabel(action = "") {
  return {
    openSettings: "打开 API 设置",
    checkProviderMapping: "检查映射",
    retry: "重试失败",
    switchProvider: "切换 Provider",
    repairMedia: "修复媒体",
    continue: "继续生产",
  }[action] || "重试失败";
}

function groupBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = getKey(item);
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});
}
