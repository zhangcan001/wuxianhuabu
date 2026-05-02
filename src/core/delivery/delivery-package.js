import {
  buildReviewGate,
} from "../review/review-system.js";

export function createDeliveryPackage(input = {}) {
  const files = normalizeDeliveryFiles(input.files);
  const outputSpec = normalizeOutputSpec(input.outputSpec || {});
  return {
    id: input.id || `delivery:${input.episodeId || "episode"}:${outputSpec.platform}`,
    projectId: input.projectId || "",
    episodeId: input.episodeId || "",
    platform: input.platform || outputSpec.platform,
    outputSpec,
    files,
    manifest: buildDeliveryManifest({ ...input, files, outputSpec }),
    checksum: input.checksum || checksumManifest(files),
    status: input.status || (files.length ? "ready" : "pending"),
    createdAt: input.createdAt || "",
  };
}

export function buildDeliveryReadinessReport(episode = {}, options = {}) {
  const shots = Array.isArray(episode.shots) ? episode.shots : [];
  const clips = Array.isArray(episode.timeline?.clips) ? episode.timeline.clips : [];
  const missingVideos = shots.filter((shot) => !Boolean(shot.video?.url || shot.videoResultUrl)).map((shot) => shot.id);
  const missingClips = shots
    .filter((shot) => !clips.some((clip) => clip.shotId === shot.id && (clip.mediaUrl || clip.media?.url)))
    .map((shot) => shot.id);
  const reviewGate = options.reviewGate || buildReviewGate(episode, options);
  const reviewPassed = options.skipReview || reviewGate.ok || (episode.reviews || []).some((review) => review.result === "approved");
  const blockers = [
    ...(missingVideos.length ? [{ type: "missing-videos", shotIds: missingVideos }] : []),
    ...(missingClips.length ? [{ type: "missing-timeline-clips", shotIds: missingClips }] : []),
    ...(!reviewPassed ? [{ type: "review-not-approved", issues: reviewGate.blockers || [] }] : []),
  ];
  return {
    episodeId: episode.id || "",
    ready: blockers.length === 0,
    blockers,
    totals: {
      shots: shots.length,
      clips: clips.length,
      missingVideos: missingVideos.length,
      missingClips: missingClips.length,
    },
  };
}

export function planDeliveryExport(project = {}, options = {}) {
  const episode = options.episode || project.activeEpisode || project.episodes?.find((item) => item.id === project.activeEpisodeId) || {};
  const readiness = buildDeliveryReadinessReport(episode, options);
  if (!readiness.ready) {
    return {
      ok: false,
      readiness,
      package: null,
      task: null,
    };
  }
  const deliveryPackage = createDeliveryPackage({
    projectId: project.id || "",
    episodeId: episode.id || "",
    outputSpec: options.outputSpec || project.productionBible?.outputSpec || {},
    files: buildEpisodeDeliveryFiles(episode),
  });
  return {
    ok: true,
    readiness,
    package: deliveryPackage,
    task: {
      id: `delivery:${episode.id || "episode"}`,
      type: "delivery.export",
      target: { type: "episode", id: episode.id || "" },
      status: "pending",
      priority: "normal",
      dependencies: [],
      provider: options.renderProvider || "tauri",
      input: {
        packageId: deliveryPackage.id,
        manifest: deliveryPackage.manifest,
        outputSpec: deliveryPackage.outputSpec,
      },
      output: {},
      cost: 0,
      logs: [],
    },
  };
}

function normalizeOutputSpec(spec = {}) {
  return {
    platform: spec.platform || "short-video",
    aspectRatio: spec.aspectRatio || "9:16",
    resolution: spec.resolution || "1080x1920",
    fps: spec.fps || 24,
    container: spec.container || "mp4",
  };
}

function normalizeDeliveryFiles(files = []) {
  return (Array.isArray(files) ? files : []).map((file, index) => ({
    id: file.id || `file-${index + 1}`,
    role: file.role || "media",
    path: file.path || file.url || "",
    mimeType: file.mimeType || "",
    size: Number(file.size || 0),
  })).filter((file) => file.path);
}

function buildDeliveryManifest(input = {}) {
  return {
    projectId: input.projectId || "",
    episodeId: input.episodeId || "",
    platform: input.outputSpec?.platform || input.platform || "short-video",
    fileCount: input.files?.length || 0,
    files: (input.files || []).map((file) => ({
      id: file.id,
      role: file.role,
      path: file.path,
    })),
    outputSpec: input.outputSpec || {},
  };
}

function buildEpisodeDeliveryFiles(episode = {}) {
  const clipFiles = (episode.timeline?.clips || [])
    .map((clip, index) => ({
      id: clip.id || `clip-${index + 1}`,
      role: "clip",
      path: clip.mediaUrl || clip.media?.url || "",
      mimeType: clip.mimeType || "",
      size: clip.size || 0,
    }))
    .filter((file) => file.path);
  return clipFiles;
}

function checksumManifest(files = []) {
  const text = (Array.isArray(files) ? files : []).map((file) => `${file.role}:${file.path}:${file.size}`).join("|");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }
  return `manifest-${Math.abs(hash)}`;
}
