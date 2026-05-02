const DEFAULT_CURRENCY = "CREDITS";

export const DEFAULT_PRODUCTION_RATE_CARD = {
  "asset.image": { estimatedCost: 0.04, unit: "image" },
  "shot.image": { estimatedCost: 0.06, unit: "image" },
  "shot.video": { estimatedCost: 0.8, unit: "clip" },
  "timeline.assemble": { estimatedCost: 0, unit: "local" },
  "review.quality-gate": { estimatedCost: 0, unit: "local" },
  "delivery.export": { estimatedCost: 0.02, unit: "export" },
};

export function estimateTaskCost(task = {}, options = {}) {
  if (task.provider === "upload" || task.input?.sourceMode === "upload") {
    return {
      taskId: task.id || "",
      taskType: task.type || "",
      providerId: "upload",
      target: task.target || null,
      currency: options.currency || DEFAULT_CURRENCY,
      unit: "manual",
      estimatedCost: 0,
      tokens: 0,
      source: "manual-upload",
    };
  }
  const rateCard = options.rateCard || DEFAULT_PRODUCTION_RATE_CARD;
  const rate = rateCard[task.type] || {};
  const providerRate = options.providerRateCard?.[task.provider || ""]?.[task.type] || {};
  const estimate = task.estimate || task.costEstimate || {};
  const estimatedCost = firstFiniteNumber(
    estimate.cost,
    estimate.estimatedCost,
    providerRate.cost,
    providerRate.estimatedCost,
    rate.cost,
    rate.estimatedCost,
    task.cost,
    0,
  );
  return {
    taskId: task.id || "",
    taskType: task.type || "",
    providerId: task.provider || providerRate.providerId || "",
    target: task.target || null,
    currency: options.currency || providerRate.currency || rate.currency || DEFAULT_CURRENCY,
    unit: estimate.unit || providerRate.unit || rate.unit || "task",
    estimatedCost,
    tokens: firstFiniteNumber(estimate.tokens, providerRate.tokens, rate.tokens, 0),
    source: estimate.source || providerRate.source || rate.source || "rate-card",
  };
}

export function buildCostLedger(events = [], options = {}) {
  const normalized = Array.isArray(events) ? events : [];
  const entries = normalized
    .map((event) => eventToCostEntry(event, options))
    .filter(Boolean);
  return summarizeCostEntries(entries, options);
}

export function buildTaskCostForecast(tasks = [], options = {}) {
  const entries = (Array.isArray(tasks) ? tasks : []).map((task) => ({
    id: `forecast:${task.id || ""}`,
    eventId: "",
    eventType: "production.cost.forecast",
    projectId: options.projectId || "",
    episodeId: options.episodeId || "",
    createdAt: options.createdAt || "",
    taskId: task.id || "",
    taskType: task.type || "",
    providerId: task.provider || "",
    target: task.target || null,
    currency: options.currency || DEFAULT_CURRENCY,
    estimatedCost: estimateTaskCost(task, options).estimatedCost,
    actualCost: 0,
    tokens: 0,
    status: task.status || "pending",
    source: "forecast",
  }));
  return summarizeCostEntries(entries, options);
}

export function buildProductionCostSummary(input = {}, options = {}) {
  const tasks = Array.isArray(input.tasks) ? input.tasks : [];
  const events = Array.isArray(input.events) ? input.events : [];
  const actual = buildCostLedger(events, options);
  const completedTaskIds = new Set(actual.entries.map((entry) => entry.taskId).filter(Boolean));
  const remainingTasks = tasks.filter((task) => !completedTaskIds.has(task.id) && task.status !== "done");
  const forecast = buildTaskCostForecast(remainingTasks, {
    ...options,
    projectId: input.projectId || options.projectId,
    episodeId: input.episodeId || options.episodeId,
  });
  const estimatedTotal = roundMoney(actual.totals.actualCost + forecast.totals.estimatedCost);
  return {
    currency: options.currency || actual.currency || forecast.currency || DEFAULT_CURRENCY,
    actual,
    forecast,
    totals: {
      actualCost: actual.totals.actualCost,
      estimatedRemainingCost: forecast.totals.estimatedCost,
      estimatedTotalCost: estimatedTotal,
      tokens: actual.totals.tokens + forecast.totals.tokens,
    },
    budget: summarizeBudget(estimatedTotal, options),
  };
}

export function eventToCostEntry(event = {}, options = {}) {
  const payload = event.payload || {};
  const estimate = payload.estimate || payload.costEstimate || {};
  const result = payload.result || {};
  const usage = result.usage || payload.usage || {};
  const explicitCost = payload.cost || payload.actualCost || result.cost || usage.cost;
  const estimatedCost = firstFiniteNumber(
    estimate.cost,
    estimate.estimatedCost,
    payload.estimatedCost,
    0,
  );
  const actualCost = firstFiniteNumber(
    explicitCost,
    event.type?.endsWith(".completed") ? estimatedCost : 0,
    0,
  );
  if (!estimatedCost && !actualCost && !payload.taskId && !payload.taskType) return null;
  return {
    id: `cost:${event.id || payload.taskId || ""}`,
    eventId: event.id || "",
    eventType: event.type || "",
    projectId: event.projectId || payload.projectId || "",
    episodeId: event.episodeId || payload.episodeId || "",
    createdAt: event.createdAt || "",
    taskId: payload.taskId || "",
    taskType: payload.taskType || "",
    providerId: payload.providerId || payload.provider || "",
    target: event.target || payload.target || null,
    currency: payload.currency || estimate.currency || options.currency || DEFAULT_CURRENCY,
    estimatedCost: roundMoney(estimatedCost),
    actualCost: roundMoney(actualCost),
    tokens: firstFiniteNumber(usage.tokens, usage.totalTokens, estimate.tokens, payload.tokens, 0),
    status: event.type?.includes("failed") ? "failed" : "completed",
    source: "event",
  };
}

export function summarizeCostEntries(entries = [], options = {}) {
  const normalized = Array.isArray(entries) ? entries : [];
  const currency = options.currency || normalized.find((entry) => entry.currency)?.currency || DEFAULT_CURRENCY;
  const totals = normalized.reduce((acc, entry) => {
    acc.estimatedCost += Number(entry.estimatedCost || 0);
    acc.actualCost += Number(entry.actualCost || 0);
    acc.tokens += Number(entry.tokens || 0);
    incrementCostBucket(acc.byProvider, entry.providerId || "unknown", entry);
    incrementCostBucket(acc.byTaskType, entry.taskType || "unknown", entry);
    return acc;
  }, {
    estimatedCost: 0,
    actualCost: 0,
    tokens: 0,
    byProvider: {},
    byTaskType: {},
  });
  return {
    currency,
    entries: normalized,
    totals: {
      estimatedCost: roundMoney(totals.estimatedCost),
      actualCost: roundMoney(totals.actualCost),
      tokens: totals.tokens,
      byProvider: roundBuckets(totals.byProvider),
      byTaskType: roundBuckets(totals.byTaskType),
    },
    budget: summarizeBudget(totals.actualCost, options),
  };
}

function summarizeBudget(cost = 0, options = {}) {
  const limit = firstFiniteNumber(options.budget, options.budgetLimit, 0);
  if (!limit) {
    return {
      limit: 0,
      remaining: 0,
      exceeded: false,
      usagePercent: 0,
    };
  }
  const usagePercent = Math.round((Number(cost || 0) / limit) * 100);
  return {
    limit,
    remaining: roundMoney(limit - Number(cost || 0)),
    exceeded: Number(cost || 0) > limit,
    usagePercent,
  };
}

function incrementCostBucket(bucket = {}, key = "unknown", entry = {}) {
  const current = bucket[key] || { estimatedCost: 0, actualCost: 0, count: 0 };
  bucket[key] = {
    estimatedCost: current.estimatedCost + Number(entry.estimatedCost || 0),
    actualCost: current.actualCost + Number(entry.actualCost || 0),
    count: current.count + 1,
  };
}

function roundBuckets(buckets = {}) {
  return Object.fromEntries(Object.entries(buckets).map(([key, value]) => [key, {
    estimatedCost: roundMoney(value.estimatedCost),
    actualCost: roundMoney(value.actualCost),
    count: value.count,
  }]));
}

function firstFiniteNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function roundMoney(value = 0) {
  return Math.round(Number(value || 0) * 10000) / 10000;
}
