import {
  appendProductionEvent,
} from "../../core/events/production-events.js";
import {
  runProviderRequest,
} from "../../core/providers/provider-gateway.js";

export async function executeProductionTask(input = {}) {
  const task = input.task || {};
  const providerRequest = buildProviderRequest(task, input);
  const result = await runProviderRequest(input.gateway, providerRequest);
  const eventType = result.ok ? "production.task.completed" : "production.task.failed";
  const events = appendProductionEvent(input.events || [], eventType, {
    projectId: input.projectId || "",
    episodeId: input.episodeId || providerRequest.episodeId || "",
    taskId: task.id || "",
    taskType: task.type || "",
    target: task.target || null,
    providerId: result.providerId || "",
    estimate: result.estimate || null,
    cost: result.ok ? inferActualCost(result) : 0,
    result: result.ok ? result.output : null,
    error: result.ok ? "" : result.error?.message || "",
  }, {
    projectId: input.projectId || "",
    episodeId: input.episodeId || providerRequest.episodeId || "",
    target: task.target || null,
    actor: input.actor || "task-runner",
    now: input.now,
  });
  return {
    ok: result.ok,
    taskId: task.id || "",
    providerId: result.providerId || "",
    output: result.output || null,
    error: result.error || null,
    events,
    taskPatch: result.ok
      ? { status: "done", output: result.output || {}, error: "" }
      : { status: "failed", error: result.error?.message || "Task failed" },
  };
}

function inferActualCost(result = {}) {
  const output = result.output || {};
  const usage = output.usage || {};
  const estimate = result.estimate || {};
  const values = [output.cost, usage.cost, estimate.actualCost, estimate.cost, estimate.estimatedCost];
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function buildProviderRequest(task = {}, input = {}) {
  const capability = capabilityForTaskType(task.type);
  return {
    type: task.type || "",
    capability,
    providerId: input.providerId || task.provider || "",
    episodeId: input.episodeId || inferEpisodeId(task.id),
    taskId: task.id || "",
    target: task.target || null,
    input: {
      ...(task.input || {}),
      prompt: task.input?.prompt || "",
    },
  };
}

function capabilityForTaskType(type = "") {
  if (type.includes("video")) return "video";
  if (type.includes("image")) return "image";
  if (type.includes("render") || type.includes("delivery")) return "render";
  if (type.includes("review")) return "review";
  return "text";
}

function inferEpisodeId(taskId = "") {
  const parts = String(taskId || "").split(":");
  return parts.length >= 3 ? parts[1] : "";
}
