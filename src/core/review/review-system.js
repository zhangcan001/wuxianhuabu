import {
  createAssetRegistry,
  validateAssetContinuity,
} from "../asset-registry/asset-registry.js";

export function createReviewChecklist(input = {}) {
  const rules = Array.isArray(input.rules) && input.rules.length ? input.rules : defaultReviewRules();
  return rules.map((rule, index) => ({
    id: rule.id || `rule-${index + 1}`,
    label: rule.label || rule.id || `Rule ${index + 1}`,
    severity: rule.severity || "warning",
    target: rule.target || "episode",
  }));
}

export function runEpisodeReview(episode = {}, options = {}) {
  const checklist = createReviewChecklist({ rules: options.rules });
  const registry = createAssetRegistry({ assets: episode.assets || options.assets || [] });
  const issues = [
    ...reviewTextReadiness(episode, checklist),
    ...reviewAssetContinuity(episode, registry, checklist),
    ...reviewMediaReadiness(episode, checklist),
    ...reviewDeliveryFormat(episode, options.outputSpec || {}, checklist),
  ];
  const blockingIssues = issues.filter((issue) => issue.severity === "critical" || issue.severity === "error");
  return {
    id: options.id || `review:${episode.id || "episode"}`,
    target: { type: "episode", id: episode.id || "" },
    checklist,
    result: blockingIssues.length ? "changes-requested" : "approved",
    issues,
    revisionPlan: buildRevisionPlan(issues),
    approvedBy: blockingIssues.length ? "" : options.reviewer || "system",
    approvedAt: blockingIssues.length ? "" : options.reviewedAt || "",
  };
}

export function buildReviewGate(episode = {}, options = {}) {
  const review = options.review || runEpisodeReview(episode, options);
  return {
    ok: review.result === "approved",
    review,
    blockers: review.issues.filter((issue) => issue.severity === "critical" || issue.severity === "error"),
  };
}

export function applyReviewResultToEpisode(episode = {}, review = {}) {
  const reviews = [
    ...(Array.isArray(episode.reviews) ? episode.reviews.filter((item) => item.id !== review.id) : []),
    review,
  ];
  const approvedShotIds = new Set(
    review.result === "approved" ? (episode.shots || []).map((shot) => shot.id) : [],
  );
  return {
    ...episode,
    reviews,
    shots: (episode.shots || []).map((shot) => ({
      ...shot,
      reviewStatus: approvedShotIds.has(shot.id) ? "approved" : shot.reviewStatus || "pending",
    })),
  };
}

function reviewTextReadiness(episode = {}, checklist = []) {
  const issues = [];
  if (!String(episode.script || "").trim()) {
    issues.push(makeIssue("script-missing", "critical", "Script is missing", "Generate or import the episode script."));
  }
  if (!(episode.shots || []).length) {
    issues.push(makeIssue("shots-missing", "critical", "Shot breakdown is missing", "Generate shot breakdown before review."));
  }
  return issues;
}

function reviewAssetContinuity(episode = {}, registry = createAssetRegistry(), checklist = []) {
  const report = validateAssetContinuity(registry, episode.shots || []);
  return [
    ...report.missingRefs.map((item) => makeIssue("asset-ref-missing", "error", `${item.shotId} references missing asset ${item.token}`, "Create or relink the missing asset.", { shotId: item.shotId, token: item.token })),
    ...report.unlockedRefs.map((item) => makeIssue("asset-not-locked", "warning", `${item.shotId} references unlocked asset ${item.token}`, "Lock the asset visual identity before final delivery.", { shotId: item.shotId, token: item.token })),
  ];
}

function reviewMediaReadiness(episode = {}, checklist = []) {
  const issues = [];
  (episode.shots || []).forEach((shot) => {
    if (!Boolean(shot.image?.url || shot.imageResultUrl)) {
      issues.push(makeIssue("shot-image-missing", "error", `${shot.id} image is missing`, "Generate or attach the shot image.", { shotId: shot.id }));
    }
    if (!Boolean(shot.video?.url || shot.videoResultUrl)) {
      issues.push(makeIssue("shot-video-missing", "critical", `${shot.id} video is missing`, "Generate or attach the shot video.", { shotId: shot.id }));
    }
  });
  return issues;
}

function reviewDeliveryFormat(episode = {}, outputSpec = {}, checklist = []) {
  const issues = [];
  const aspectRatio = outputSpec.aspectRatio || "9:16";
  if (!["9:16", "16:9", "1:1"].includes(aspectRatio)) {
    issues.push(makeIssue("unsupported-aspect-ratio", "warning", `Unsupported aspect ratio ${aspectRatio}`, "Use a platform-ready delivery aspect ratio."));
  }
  const clips = episode.timeline?.clips || [];
  if ((episode.shots || []).length && clips.length < episode.shots.length) {
    issues.push(makeIssue("timeline-incomplete", "error", "Timeline has fewer clips than shots", "Backfill the timeline before export."));
  }
  return issues;
}

function buildRevisionPlan(issues = []) {
  if (!issues.length) return "Approved. No revision required.";
  return issues.map((issue, index) => `${index + 1}. ${issue.action}`).join("\n");
}

function makeIssue(code, severity, message, action, detail = {}) {
  return {
    code,
    severity,
    message,
    action,
    detail,
  };
}

function defaultReviewRules() {
  return [
    { id: "script-ready", label: "Script exists", severity: "critical" },
    { id: "asset-continuity", label: "Asset continuity", severity: "error" },
    { id: "shot-media-ready", label: "Shot media ready", severity: "critical" },
    { id: "timeline-complete", label: "Timeline complete", severity: "error" },
    { id: "delivery-format", label: "Delivery format", severity: "warning" },
  ];
}
