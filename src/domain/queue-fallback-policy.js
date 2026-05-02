import { classifyFailure } from "./queue-diagnostics.js";

export function buildQueueFallbackPlan(queue = []) {
  return (Array.isArray(queue) ? queue : [])
    .filter((job) => job.status === "failed")
    .map((job) => {
      const reason = classifyFailure(job.error || job.resultSummary || "");
      return {
        jobId: job.id || job.requestId,
        reason,
        action: fallbackAction(reason, job),
      };
    });
}

function fallbackAction(reason, job = {}) {
  if (reason === "network") return "retry";
  if (reason === "auth") return "openSettings";
  if (reason === "quota") return job.kind === "video" ? "switchToUpload" : "switchProvider";
  if (reason === "schema") return "openMappingDiagnostic";
  if (reason === "file") return "repairMedia";
  if (reason === "params") return "openPromptFactory";
  return "retry";
}
