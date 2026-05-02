import {
  applyImageResultToShot,
  applyTextPackageToEpisode,
  applyVideoResultToShot,
  buildCommercialProjectModel,
  summarizeEpisodeProductionStatus,
} from "./commercial-project-model.js";
import {
  discardMediaRef,
  mediaRefToAssetImageItem,
  mediaRefToShotMediaItem,
  normalizeMediaRefs,
  primaryMediaRef,
  setPrimaryMediaRef,
  upsertMediaRef,
} from "./media-ref-model.js";
import {
  buildShotContinuityPrompt,
} from "./shot-continuity-prompt.js";
import {
  applyAssetConsistencyPlan,
} from "./asset-consistency.js";

export function createCommercialProject(input = {}) {
  if (hasLegacyProjectInputs(input)) {
    return normalizeCommercialProject(buildCommercialProjectModel(input));
  }
  return normalizeCommercialProject({
    id: input.id || input.projectId || "local-project",
    name: input.name || input.projectName || "未命名项目",
    activeEpisodeId: input.activeEpisodeId || input.episodes?.[0]?.id || "episode-1",
    episodes: Array.isArray(input.episodes) && input.episodes.length
      ? input.episodes
      : [createCommercialEpisode({ id: input.activeEpisodeId || "episode-1" })],
  });
}

export function createCommercialEpisode(input = {}) {
  const assets = normalizeEpisodeAssets(input.assets);
  const shots = normalizeEpisodeShots(input.shots);
  const tasks = Array.isArray(input.tasks) ? input.tasks : [];
  const timeline = normalizeEpisodeTimeline(input.timeline);
  return {
    id: input.id || "episode-1",
    title: input.title || input.name || "当前集",
    sourceText: input.sourceText || "",
    script: input.script || "",
    assets,
    assetCounts: summarizeAssetCounts(assets),
    shots,
    tasks,
    timeline,
    resources: Array.isArray(input.resources) ? input.resources : [],
    status: summarizeEpisodeStatus({
      script: input.script || "",
      assets,
      shots,
      tasks,
      timeline,
      failedExports: input.status?.failedExports || input.failedExports || 0,
    }),
    sourceNodeIds: {
      novel: input.sourceNodeIds?.novel || [],
      asset: input.sourceNodeIds?.asset || [],
      shot: input.sourceNodeIds?.shot || [],
    },
  };
}

export function normalizeCommercialProject(project = {}) {
  const episodes = (Array.isArray(project.episodes) && project.episodes.length ? project.episodes : [createCommercialEpisode()])
    .map(createCommercialEpisode);
  const activeEpisodeId = project.activeEpisodeId || episodes[0]?.id || "";
  const activeEpisode = episodes.find((episode) => episode.id === activeEpisodeId) || episodes[0] || null;
  return {
    id: project.id || "local-project",
    name: project.name || "未命名项目",
    activeEpisodeId: activeEpisode?.id || activeEpisodeId,
    episodes,
    activeEpisode,
    totals: {
      episodes: episodes.length,
      shots: episodes.reduce((sum, episode) => sum + episode.shots.length, 0),
      assets: episodes.reduce((sum, episode) => sum + episode.assets.length, 0),
      tasks: episodes.reduce((sum, episode) => sum + episode.tasks.length, 0),
    },
  };
}

export function selectActiveEpisode(project = {}) {
  return project.activeEpisode
    || (Array.isArray(project.episodes) ? project.episodes.find((episode) => episode.id === project.activeEpisodeId) || project.episodes[0] : null)
    || null;
}

export function updateEpisode(project = {}, episodeId = "", updater = (episode) => episode) {
  const normalized = normalizeCommercialProject(project);
  const targetId = episodeId || normalized.activeEpisodeId;
  const episodes = normalized.episodes.map((episode) => (
    episode.id === targetId ? createCommercialEpisode(updater(episode)) : episode
  ));
  return normalizeCommercialProject({
    ...normalized,
    episodes,
    activeEpisodeId: normalized.activeEpisodeId,
  });
}

export function applyTextPackageToProject(project = {}, episodeId = "", packageResult = {}) {
  return updateEpisode(project, episodeId, (episode) => applyTextPackageToEpisode(episode, packageResult));
}

export function applyImageResultToProject(project = {}, input = {}) {
  const episodeId = input.episodeId || project.activeEpisodeId || "";
  const result = input.result || input;
  return updateEpisode(project, episodeId, (episode) => {
    const updated = applyImageResultToShot(episode, input.shotId, result);
    return {
      ...updated,
      shots: (updated.shots || []).map((shot) => (
      String(shot.id || "") === String(input.shotId || "")
        ? projectShotWithMediaRefs({
          ...shot,
          mediaRefs: upsertMediaRef(shotMediaRefs(shot), {
            kind: "image",
            url: result.imageUrl || result.url || result.imagePath || result.path || "",
            localPath: result.imagePath || result.path || "",
            thumbnailUrl: result.imageThumbnailUrl || result.thumbnailUrl || "",
            thumbnailPath: result.imageThumbnailPath || result.thumbnailPath || "",
            primary: true,
          }),
        })
        : shot
      )),
    };
  });
}

export function applyVideoResultToProject(project = {}, input = {}) {
  const episodeId = input.episodeId || project.activeEpisodeId || "";
  const result = input.result || input;
  return updateEpisode(project, episodeId, (episode) => {
    const updated = applyVideoResultToShot(episode, input.shotId, result);
    return {
      ...updated,
      shots: (updated.shots || []).map((shot) => (
      String(shot.id || "") === String(input.shotId || "")
        ? projectShotWithMediaRefs({
          ...shot,
          mediaRefs: upsertMediaRef(shotMediaRefs(shot), {
            kind: "video",
            url: result.videoUrl || result.url || result.videoPath || result.path || "",
            localPath: result.videoPath || result.path || "",
            thumbnailUrl: result.videoThumbnailUrl || result.thumbnailUrl || "",
            thumbnailPath: result.videoThumbnailPath || result.thumbnailPath || "",
            primary: true,
          }),
        })
        : shot
      )),
    };
  });
}

export function applyAssetImageResultToProject(project = {}, input = {}) {
  const episodeId = input.episodeId || project.activeEpisodeId || "";
  const assetId = input.assetId || input.targetId || "";
  const result = input.result || input;
  const imageResult = result.imagePath || result.imageUrl || result.path || result.url || "";
  const displayUrl = result.imageUrl || result.url || imageResult;
  return updateEpisode(project, episodeId, (episode) => ({
    ...applyAssetConsistencyPlan({
      ...episode,
      assets: (episode.assets || []).map((asset) => {
        const matches = [asset.id, asset.token, asset.name].some((value) => String(value || "") === String(assetId || ""));
        if (!matches) return asset;
        const imageItem = {
          kind: "image",
          url: displayUrl,
          localPath: result.imagePath || "",
          imageUrl: displayUrl,
          imagePath: result.imagePath || "",
          originalImageUrl: result.originalImageUrl || result.imageUrl || "",
          originalUrl: result.originalImageUrl || result.imageUrl || "",
          thumbnailUrl: result.imageThumbnailUrl || result.thumbnailUrl || "",
          thumbnailPath: result.imageThumbnailPath || result.thumbnailPath || "",
          primary: true,
        };
        const mediaRefs = imageResult
          ? upsertMediaRef(assetMediaRefs(asset), imageItem)
          : assetMediaRefs(asset);
        return projectAssetWithMediaRefs({
          ...asset,
          image: imageResult || asset.image || "",
          imageUrl: displayUrl || asset.imageUrl || "",
          imagePath: result.imagePath || asset.imagePath || "",
          originalImageUrl: result.originalImageUrl || asset.originalImageUrl || "",
          imageThumbnailUrl: result.imageThumbnailUrl || result.thumbnailUrl || asset.imageThumbnailUrl || "",
          imageThumbnailPath: result.imageThumbnailPath || result.thumbnailPath || asset.imageThumbnailPath || "",
          mediaRefs,
          discardedImageKeys: removeMatchingImageDiscardKeys(asset.discardedImageKeys, imageItem),
          lastImageSavedAt: result.savedAt || Date.now(),
        });
      }),
    }),
  }));
}

export function setAssetPrimaryImageInProject(project = {}, input = {}) {
  const episodeId = input.episodeId || project.activeEpisodeId || "";
  const assetId = input.assetId || input.targetId || "";
  const candidate = normalizeAssetImageCandidate(input.candidate || input.image || {}, 0);
  const primaryUrl = candidate.imageUrl || candidate.url || candidate.imagePath || "";
  if (!assetId || !primaryUrl) return normalizeCommercialProject(project);
  return updateEpisode(project, episodeId, (episode) => ({
    ...applyAssetConsistencyPlan({
      ...episode,
      assets: (episode.assets || []).map((asset) => {
        const matches = [asset.id, asset.token, asset.name].some((value) => String(value || "") === String(assetId || ""));
        if (!matches) return asset;
        const mediaRefs = setPrimaryMediaRef(assetMediaRefs(asset), {
          kind: "image",
          url: candidate.imageUrl || candidate.url || "",
          localPath: candidate.imagePath || candidate.path || "",
          thumbnailUrl: candidate.thumbnailUrl || candidate.imageThumbnailUrl || "",
          thumbnailPath: candidate.thumbnailPath || candidate.imageThumbnailPath || "",
        }, "image");
        return projectAssetWithMediaRefs({
          ...asset,
          image: candidate.imagePath || primaryUrl,
          imageUrl: primaryUrl,
          imagePath: candidate.imagePath || asset.imagePath || "",
          imageThumbnailUrl: candidate.thumbnailUrl || candidate.imageThumbnailUrl || asset.imageThumbnailUrl || "",
          imageThumbnailPath: candidate.thumbnailPath || candidate.imageThumbnailPath || asset.imageThumbnailPath || "",
          mediaRefs,
        });
      }),
    }),
  }));
}

export function discardAssetImageCandidateInProject(project = {}, input = {}) {
  const episodeId = input.episodeId || project.activeEpisodeId || "";
  const assetId = input.assetId || input.targetId || "";
  const candidate = normalizeAssetImageCandidate(input.candidate || input.image || {}, 0);
  if (!assetId || !(candidate.imageUrl || candidate.imagePath)) return normalizeCommercialProject(project);
  return updateEpisode(project, episodeId, (episode) => ({
    ...episode,
    assets: (episode.assets || []).map((asset) => {
      const matches = [asset.id, asset.token, asset.name].some((value) => String(value || "") === String(assetId || ""));
      if (!matches) return asset;
      const discardedImageKeys = mergeImageDiscardKeys(asset.discardedImageKeys, candidate);
      const mediaRefs = discardMediaRef(assetMediaRefs(asset), {
        kind: "image",
        url: candidate.imageUrl || candidate.url || "",
        localPath: candidate.imagePath || candidate.path || "",
      }, "image");
      const primary = primaryMediaRef(mediaRefs, "image");
      return projectAssetWithMediaRefs({
        ...asset,
        image: primary?.localPath || primary?.url || "",
        imageUrl: primary?.url || "",
        imagePath: primary?.localPath || "",
        imageThumbnailUrl: primary?.thumbnailUrl || "",
        imageThumbnailPath: primary?.thumbnailPath || "",
        mediaRefs,
        imageItems: [],
        images: [],
        discardedImageKeys,
      });
    }),
  }));
}

export function setShotPrimaryMediaInProject(project = {}, input = {}) {
  const episodeId = input.episodeId || project.activeEpisodeId || "";
  const shotId = input.shotId || input.targetId || "";
  const kind = input.kind === "video" ? "video" : "image";
  const candidate = normalizeShotMediaCandidate(input.candidate || input.media || {}, 0, kind);
  const primaryUrl = candidate.url || candidate.imageUrl || candidate.videoUrl || candidate.path || "";
  if (!shotId || !primaryUrl) return normalizeCommercialProject(project);
  const nextProject = updateEpisode(project, episodeId, (episode) => ({
    ...episode,
    shots: (episode.shots || []).map((shot) => {
      if (String(shot.id || "") !== String(shotId)) return shot;
      const mediaRefs = setPrimaryMediaRef(shotMediaRefs(shot), {
        kind,
        url: candidate.url || candidate.imageUrl || candidate.videoUrl || "",
        localPath: candidate.path || candidate.imagePath || candidate.videoPath || "",
        thumbnailUrl: candidate.thumbnailUrl || "",
        thumbnailPath: candidate.thumbnailPath || "",
      }, kind);
      if (kind === "video") {
        return projectShotWithMediaRefs({
          ...shot,
          videoResult: candidate.videoUrl || candidate.url || primaryUrl,
          videoResultUrl: candidate.videoUrl || candidate.url || primaryUrl,
          videoUrl: candidate.videoUrl || candidate.url || primaryUrl,
          videoPath: candidate.videoPath || candidate.path || shot.videoPath || "",
          mediaRefs,
          lastQueueResult: candidate.videoUrl || candidate.url || primaryUrl,
        });
      }
      return projectShotWithMediaRefs({
        ...shot,
        imageResult: candidate.imageUrl || candidate.url || primaryUrl,
        imageResultUrl: candidate.imageUrl || candidate.url || primaryUrl,
        imageUrl: candidate.imageUrl || candidate.url || primaryUrl,
        imagePath: candidate.imagePath || candidate.path || shot.imagePath || "",
        imageThumbnailUrl: candidate.thumbnailUrl || shot.imageThumbnailUrl || "",
        imageThumbnailPath: candidate.thumbnailPath || shot.imageThumbnailPath || "",
        mediaRefs,
        lastQueueResult: candidate.imageUrl || candidate.url || primaryUrl,
      });
    }),
  }));
  return syncTimelineShotFromShotInProject(nextProject, {
    episodeId,
    shotId,
    createIfMissing: kind === "video",
  });
}

export function discardShotMediaCandidateInProject(project = {}, input = {}) {
  const episodeId = input.episodeId || project.activeEpisodeId || "";
  const shotId = input.shotId || input.targetId || "";
  const kind = input.kind === "video" ? "video" : "image";
  const candidate = normalizeShotMediaCandidate(input.candidate || input.media || {}, 0, kind);
  if (!shotId || !(candidate.url || candidate.path || candidate.imageUrl || candidate.videoUrl)) return normalizeCommercialProject(project);
  const nextProject = updateEpisode(project, episodeId, (episode) => ({
    ...episode,
    shots: (episode.shots || []).map((shot) => (
      String(shot.id || "") === String(shotId)
        ? projectShotWithMediaRefs(applyDiscardedShotMediaCandidate(shot, kind, candidate))
        : shot
    )),
  }));
  return syncTimelineShotFromShotInProject(nextProject, {
    episodeId,
    shotId,
    createIfMissing: kind === "video",
  });
}

export function updateShotReviewStatusInProject(project = {}, input = {}) {
  const episodeId = input.episodeId || project.activeEpisodeId || "";
  const shotId = input.shotId || input.targetId || "";
  if (!shotId) return normalizeCommercialProject(project);
  const nextProject = updateEpisode(project, episodeId, (episode) => {
    const reviewStatus = input.reviewStatus || "未审";
    const comment = input.comment || input.reviewComment || "";
    const reviewedAt = input.reviewedAt || new Date().toISOString();
    const repairTask = reviewStatus === "待修改"
      ? [{
        id: `review-repair:${shotId}:${Date.now()}`,
        type: "review.repair",
        targetType: "shot",
        targetId: shotId,
        shotId,
        status: "pending",
        reason: comment || input.reason || "审片退回",
        createdAt: reviewedAt,
      }]
      : [];
    const existingRepair = (episode.tasks || []).some((task) => task.type === "review.repair" && task.shotId === shotId && task.status !== "done");
    return {
      ...episode,
      shots: (episode.shots || []).map((shot) => (
        String(shot.id || "") === String(shotId)
          ? {
            ...shot,
            reviewStatus,
            reviewComment: comment || shot.reviewComment || "",
            reviewReason: input.reason || input.reviewReason || comment || shot.reviewReason || "",
            reviewRepairSuggestion: reviewStatus === "待修改" ? buildReviewRepairSuggestion(comment || input.reason || "") : shot.reviewRepairSuggestion || null,
            reviewHistory: [
              ...(Array.isArray(shot.reviewHistory) ? shot.reviewHistory : []),
              {
                status: reviewStatus,
                comment,
                reviewer: input.reviewer || "human",
                at: reviewedAt,
              },
            ].slice(-20),
            reviewer: input.reviewer || shot.reviewer || "human",
            reviewedAt,
          }
          : shot
      )),
      tasks: existingRepair ? episode.tasks : [...(episode.tasks || []), ...repairTask],
    };
  });
  return syncTimelineShotFromShotInProject(nextProject, {
    episodeId,
    shotId,
    createIfMissing: false,
  });
}

function buildReviewRepairSuggestion(reason = "") {
  const text = String(reason || "");
  const suggestions = [];
  if (/角色|人物|脸|服装|发型|一致/.test(text)) suggestions.push("检查资产定妆图和镜头提示词中的角色一致性");
  if (/运动|卡顿|节奏|镜头|转场|视频/.test(text)) suggestions.push("优先重刷视频，并同步到时间线片段");
  if (/画面|构图|光线|色彩|首帧|图片/.test(text)) suggestions.push("先重刷首帧图，再级联生成视频");
  if (!suggestions.length) suggestions.push("按退回原因重刷图片或视频，并复核时间线素材");
  return {
    reason: text,
    suggestions,
    image: suggestions.some((item) => /图片|首帧|资产/.test(item)),
    video: suggestions.some((item) => /视频|时间线|镜头/.test(item)),
    createdAt: new Date().toISOString(),
  };
}

export function syncTimelineFromShotsInProject(project = {}, input = {}) {
  const episodeId = input.episodeId || project.activeEpisodeId || "";
  return updateEpisode(project, episodeId, (episode) => {
    const existing = Array.isArray(episode.timeline?.clips) ? episode.timeline.clips : [];
    const clipByShotId = new Map(existing.map((clip) => [String(clip.shotId || ""), clip]));
    const nextClips = (episode.shots || []).map((shot, index) => {
      const shotId = String(shot.id || "");
      const current = clipByShotId.get(shotId) || {};
      return buildTimelineClipFromShot(shot, current, index, { createId: `clip-${shotId || index + 1}` });
    }).filter((clip) => clip.shotId);
    return {
      ...episode,
      timeline: {
        ...(episode.timeline || {}),
        clips: nextClips,
      },
    };
  });
}

export function syncTimelineShotFromShotInProject(project = {}, input = {}) {
  const episodeId = input.episodeId || project.activeEpisodeId || "";
  const shotId = input.shotId || input.targetId || "";
  if (!shotId) return normalizeCommercialProject(project);
  return updateEpisode(project, episodeId, (episode) => {
    const shots = Array.isArray(episode.shots) ? episode.shots : [];
    const shotIndex = shots.findIndex((shot) => String(shot.id || "") === String(shotId));
    const shot = shotIndex >= 0 ? shots[shotIndex] : null;
    if (!shot) return episode;
    const clips = Array.isArray(episode.timeline?.clips) ? episode.timeline.clips : [];
    const clipIndex = clips.findIndex((clip) => String(clip.shotId || "") === String(shotId));
    const hasVideo = Boolean(shot.videoUrl || shot.videoResultUrl || shot.videoResult || shot.videoPath);
    const shouldCreate = input.createIfMissing !== false && (hasVideo || input.createIfMissing === true);
    if (clipIndex < 0 && !shouldCreate) return episode;
    const nextClip = buildTimelineClipFromShot(shot, clipIndex >= 0 ? clips[clipIndex] : {}, clipIndex >= 0 ? clipIndex : clips.length, {
      createId: `clip-${shotId}`,
    });
    const nextClips = clipIndex >= 0
      ? clips.map((clip, index) => (index === clipIndex ? nextClip : clip))
      : [...clips, nextClip];
    return {
      ...episode,
      timeline: {
        ...(episode.timeline || {}),
        clips: nextClips.map((clip, order) => ({ ...clip, order })),
      },
    };
  });
}

export function replaceEpisodeTimelineInProject(project = {}, input = {}) {
  const episodeId = input.episodeId || project.activeEpisodeId || "";
  const clips = Array.isArray(input.timeline?.clips) ? input.timeline.clips : Array.isArray(input.clips) ? input.clips : [];
  return updateEpisode(project, episodeId, (episode) => ({
    ...episode,
    timeline: {
      ...(episode.timeline || {}),
      clips: clips.map((clip, index) => ({
        id: clip.id || clip.shotId || `clip-${index + 1}`,
        shotId: clip.shotId || "",
        sourceNodeId: clip.sourceNodeId || "",
        title: clip.title || clip.shotId || `片段${index + 1}`,
        scene: clip.scene || "",
        duration: clip.duration || "4秒",
        transition: clip.transition || "直切",
        mediaUrl: clip.mediaUrl || "",
        mediaType: clip.mediaType || "",
        approvalStatus: clip.approvalStatus || clip.reviewStatus || "待验收",
        reviewStatus: clip.reviewStatus || clip.approvalStatus || "待验收",
        approvalNote: clip.approvalNote || "",
        note: clip.note || "",
        order: index,
      })),
    },
  }));
}

export function updateTimelineClipInProject(project = {}, input = {}) {
  const episodeId = input.episodeId || project.activeEpisodeId || "";
  const clipId = input.clipId || input.id || "";
  if (!clipId) return normalizeCommercialProject(project);
  return updateEpisode(project, episodeId, (episode) => {
    const clips = Array.isArray(episode.timeline?.clips) ? episode.timeline.clips : [];
    const index = clips.findIndex((clip) => String(clip.id || clip.shotId || "") === String(clipId));
    if (index < 0) return episode;
    if (input.remove) {
      return {
        ...episode,
        timeline: {
          ...(episode.timeline || {}),
          clips: clips.filter((_, clipIndex) => clipIndex !== index).map((clip, order) => ({ ...clip, order })),
        },
      };
    }
    const patched = clips.map((clip, clipIndex) => (
      clipIndex === index ? { ...clip, ...(input.patch || {}) } : clip
    ));
    const moveBy = Number(input.moveBy || 0);
    if (moveBy) {
      const targetIndex = Math.max(0, Math.min(patched.length - 1, index + moveBy));
      const [item] = patched.splice(index, 1);
      patched.splice(targetIndex, 0, item);
    }
    return {
      ...episode,
      timeline: {
        ...(episode.timeline || {}),
        clips: patched.map((clip, order) => ({ ...clip, order })),
      },
    };
  });
}

export function applyTaskResultToProject(project = {}, input = {}) {
  const task = input.task || input.job || {};
  const result = input.result || {};
  if (task.type === "asset.image" || task.targetType === "asset") {
    return applyAssetImageResultToProject(project, {
      episodeId: task.episodeId || input.episodeId || project.activeEpisodeId || "",
      assetId: task.targetId || task.sourceAssetToken || input.assetId || "",
      result,
    });
  }
  if (task.kind === "image" || task.type === "shot.image") {
    const episodeId = task.episodeId || input.episodeId || project.activeEpisodeId || "";
    const shotId = task.shotId || task.targetId || input.shotId || "";
    const nextProject = applyImageResultToProject(project, {
      episodeId,
      shotId,
      result,
    });
    const reviewedProject = task.reviewRepair ? markShotRepairReadyForReview(nextProject, task) : nextProject;
    return syncTimelineShotFromShotInProject(reviewedProject, {
      episodeId,
      shotId,
      createIfMissing: false,
    });
  }
  if (task.kind === "video" || task.type === "shot.video") {
    const episodeId = task.episodeId || input.episodeId || project.activeEpisodeId || "";
    const shotId = task.shotId || task.targetId || input.shotId || "";
    const nextProject = applyVideoResultToProject(project, {
      episodeId,
      shotId,
      result,
    });
    const reviewedProject = task.reviewRepair ? markShotRepairReadyForReview(nextProject, task) : nextProject;
    return syncTimelineShotFromShotInProject(reviewedProject, {
      episodeId,
      shotId,
      createIfMissing: true,
    });
  }
  return normalizeCommercialProject(project);
}

function markShotRepairReadyForReview(project = {}, task = {}) {
  const episodeId = task.episodeId || project.activeEpisodeId || "";
  const shotId = task.shotId || task.targetId || "";
  if (!shotId) return normalizeCommercialProject(project);
  return updateEpisode(project, episodeId, (episode) => ({
    ...episode,
    shots: (episode.shots || []).map((shot) => (
      String(shot.id || "") === String(shotId)
        ? {
          ...shot,
          reviewStatus: "待复审",
          reviewComment: task.reviewComment || shot.reviewComment || "返修素材已生成，等待复审",
          repairedAt: new Date().toISOString(),
        }
        : shot
    )),
    tasks: (episode.tasks || []).map((item) => (
      item.type === "review.repair" && String(item.shotId || item.targetId || "") === String(shotId) && item.status !== "done"
        ? { ...item, status: "done", doneAt: new Date().toISOString() }
        : item
    )),
  }));
}

export function selectEpisodeShot(project = {}, episodeId = "", shotId = "") {
  const normalized = normalizeCommercialProject(project);
  const targetEpisodeId = episodeId || normalized.activeEpisodeId;
  const episode = normalized.episodes.find((item) => item.id === targetEpisodeId) || normalized.activeEpisode;
  return (episode?.shots || []).find((shot) => shot.id === shotId) || null;
}

export function buildShotPatchFromBusinessShot(shot = {}) {
  const imageDisplayUrl = shot.imageUrl || shot.imageResultUrl || shot.imageResult || "";
  const videoDisplayUrl = shot.videoUrl || shot.videoResultUrl || shot.videoResult || "";
  return {
    status: shot.status || "待写",
    lastQueueResult: shot.lastQueueResult || shot.videoResultUrl || shot.imageResultUrl || "",
    imageResultUrl: imageDisplayUrl,
    videoResultUrl: videoDisplayUrl,
    imageUrl: shot.imageUrl || "",
    imagePath: shot.imagePath || "",
    imageThumbnailUrl: shot.imageThumbnailUrl || "",
    imageThumbnailPath: shot.imageThumbnailPath || "",
    videoUrl: shot.videoUrl || "",
    videoPath: shot.videoPath || "",
    resultDecision: "",
    resultDecisionAt: 0,
    reworkReason: "",
  };
}

export function queueEpisodeImageTasks(episode = {}, options = {}) {
  const providerMode = options.providerMode || "mock";
  const buildImageShotPrompt = options.buildImageShotPrompt || ((shot) => shot.imagePrompt || "");
  const resolveShotImageProviderMode = options.resolveShotImageProviderMode || ((shot) => shot.imageProviderMode || providerMode);
  const settings = options.settings || {};
  const assets = Array.isArray(options.assets) ? options.assets : episode.assets || [];
  return (Array.isArray(episode.shots) ? episode.shots : [])
    .filter((shot) => !String(shot.imageResultUrl || shot.imageResult || "").trim())
    .map((shot, index) => {
      const imageProviderMode = resolveShotImageProviderMode(shot, settings);
      const sourceNodeId = resolveShotSourceNodeId(episode, shot);
      const basePrompt = String(buildImageShotPrompt(shot) || "").trim();
      return {
        type: "shot.image",
        kind: "image",
        episodeId: episode.id || "",
        shotId: shot.id || "",
        sourceNodeId,
        title: `${shot.id || `镜头${index + 1}`}-图片`,
        prompt: buildShotContinuityPrompt(shot, assets, { basePrompt, kind: "image", enabled: options.continuityPrompt !== false }),
        imageProviderMode,
        providerMode: imageProviderMode === "custom" ? "api" : imageProviderMode,
        targetType: "shot",
        targetId: shot.id || "",
        queueStage: "shot-image",
        priority: options.priority || "中",
        imageRuntimeModel: shot.imageRuntimeModel || "",
        mainCharacterToken: shot.mainCharacterToken || "",
        mainSceneToken: shot.mainSceneToken || "",
        keyPropTokens: Array.isArray(shot.keyPropTokens) ? shot.keyPropTokens.filter(Boolean) : [],
        assetRefs: Array.isArray(shot.assetRefs) ? shot.assetRefs.filter(Boolean) : [],
        referenceResources: String(shot.referenceResources || ""),
        videoPrompt: String(shot.videoPrompt || ""),
        autoCascadeVideo: Boolean(String(shot.videoPrompt || "").trim()),
        offsetX: options.offsetX || 1180,
        offsetY: Number.isFinite(options.offsetY) ? options.offsetY : index * 290,
      };
    })
    .filter((task) => task.prompt);
}

export function queueEpisodeVideoTasks(episode = {}, options = {}) {
  const buildVideoShotPrompt = options.buildVideoShotPrompt || ((shot) => shot.videoPrompt || "");
  const providerMode = options.providerMode || "mock";
  const resolveShotVideoProviderMode = options.resolveShotVideoProviderMode || ((shot) => shot.videoProviderMode || providerMode);
  const settings = options.settings || {};
  const assets = Array.isArray(options.assets) ? options.assets : episode.assets || [];
  return (Array.isArray(episode.shots) ? episode.shots : [])
    .filter((shot) => !String(shot.videoResultUrl || shot.videoResult || "").trim())
    .map((shot, index) => {
      const videoProviderMode = resolveShotVideoProviderMode(shot, settings);
      const basePrompt = String(buildVideoShotPrompt(shot) || "").trim();
      return {
        type: "shot.video",
        kind: "video",
        episodeId: episode.id || "",
        shotId: shot.id || "",
        sourceNodeId: resolveShotSourceNodeId(episode, shot),
        title: `${shot.id || `镜头${index + 1}`}-视频`,
        prompt: buildShotContinuityPrompt(shot, assets, { basePrompt, kind: "video", enabled: options.continuityPrompt !== false }),
        videoProviderMode,
        providerMode: videoProviderMode === "custom" ? "api" : videoProviderMode,
        videoRuntimeModel: shot.videoRuntimeModel || "",
        videoModelPreset: shot.videoModelPreset || "",
        videoParamPreset: shot.videoParamPreset || "",
        videoAspectRatio: shot.videoAspectRatio || options.videoAspectRatio || "",
        mainCharacterToken: shot.mainCharacterToken || "",
        mainSceneToken: shot.mainSceneToken || "",
        keyPropTokens: Array.isArray(shot.keyPropTokens) ? shot.keyPropTokens.filter(Boolean) : [],
        assetRefs: Array.isArray(shot.assetRefs) ? shot.assetRefs.filter(Boolean) : [],
        referenceResources: String(shot.referenceResources || ""),
        targetType: "shot",
        targetId: shot.id || "",
        queueStage: "shot-video",
        priority: options.priority || "中",
        offsetX: options.offsetX || 1480,
        offsetY: Number.isFinite(options.offsetY) ? options.offsetY : index * 290,
      };
    })
    .filter((task) => task.videoProviderMode !== "upload")
    .filter((task) => task.prompt);
}

export function summarizeEpisodeStatus(input = {}) {
  const timeline = normalizeEpisodeTimeline(input.timeline);
  return summarizeEpisodeProductionStatus({
    script: input.script || "",
    assets: Array.isArray(input.assets) ? input.assets : [],
    shots: Array.isArray(input.shots) ? input.shots : [],
    tasks: Array.isArray(input.tasks) ? input.tasks : [],
    timelineClips: timeline.clips,
    failedExports: Number(input.failedExports || 0),
  });
}

function hasLegacyProjectInputs(input = {}) {
  return Array.isArray(input.nodes)
    || Array.isArray(input.generationQueue)
    || Boolean(input.timeline?.byEpisode)
    || Array.isArray(input.exportHistory);
}

function normalizeEpisodeAssets(assets = []) {
  return (Array.isArray(assets) ? assets : []).map((asset) => projectAssetWithMediaRefs(asset));
}

function normalizeEpisodeShots(shots = []) {
  return (Array.isArray(shots) ? shots : []).map((shot) => projectShotWithMediaRefs(shot));
}

function normalizeEpisodeTimeline(timeline = {}) {
  return {
    clips: Array.isArray(timeline.clips) ? timeline.clips : [],
  };
}

function summarizeAssetCounts(assets = []) {
  return {
    characters: assets.filter((asset) => asset.type === "character").length,
    scenes: assets.filter((asset) => asset.type === "scene").length,
    props: assets.filter((asset) => asset.type === "prop").length,
  };
}

function ensureAssetImageCandidates(asset = {}) {
  const existing = Array.isArray(asset.imageItems) ? asset.imageItems : [];
  const fallbackUrl = asset.imageUrl || asset.image || asset.imagePath || "";
  const fallback = fallbackUrl ? [{
    imageUrl: asset.imageUrl || fallbackUrl,
    imagePath: asset.imagePath || asset.image || "",
    thumbnailUrl: asset.imageThumbnailUrl || "",
    thumbnailPath: asset.imageThumbnailPath || "",
    primary: true,
  }] : [];
  return [...existing, ...fallback]
    .filter((item) => item?.imageUrl || item?.imagePath || item?.url)
    .map((item, index) => normalizeAssetImageCandidate(item, index, asset.imageUrl || fallbackUrl))
    .reduce((items, item) => {
      const key = item.imageUrl || item.imagePath || item.id;
      const index = items.findIndex((candidate) => (candidate.imageUrl || candidate.imagePath || candidate.id) === key);
      if (index >= 0) {
        items[index] = {
          ...items[index],
          ...item,
          primary: items[index].primary || item.primary,
          discarded: items[index].discarded || item.discarded,
        };
        return items;
      }
      return [...items, item];
    }, []);
}

function assetMediaRefs(asset = {}) {
  return normalizeMediaRefs([
    ...(Array.isArray(asset.mediaRefs) ? asset.mediaRefs : []),
    ...(Array.isArray(asset.imageItems) ? asset.imageItems : []),
    ...(Array.isArray(asset.images) ? asset.images.map((imageUrl) => ({ imageUrl })) : []),
    ...((asset.imageUrl || asset.imagePath || asset.image) ? [{
      imageUrl: asset.imageUrl || (isLocalPath(asset.image) ? "" : asset.image || ""),
      imagePath: asset.imagePath || (isLocalPath(asset.image) ? asset.image : ""),
      localPath: asset.imagePath || (isLocalPath(asset.image) ? asset.image : ""),
      thumbnailUrl: asset.imageThumbnailUrl || "",
      thumbnailPath: asset.imageThumbnailPath || "",
      originalUrl: asset.originalImageUrl || "",
      primary: true,
    }] : []),
  ], { kind: "image" });
}

function projectAssetWithMediaRefs(asset = {}) {
  const mediaRefs = assetMediaRefs(asset);
  const primary = primaryMediaRef(mediaRefs, "image");
  const imageItems = mediaRefs.filter((ref) => ref.kind === "image").map(mediaRefToAssetImageItem);
  return {
    ...asset,
    image: primary?.localPath || primary?.url || asset.image || "",
    imageUrl: primary?.url || asset.imageUrl || "",
    imagePath: primary?.localPath || asset.imagePath || "",
    originalImageUrl: primary?.originalUrl || asset.originalImageUrl || "",
    imageThumbnailUrl: primary?.thumbnailUrl || asset.imageThumbnailUrl || "",
    imageThumbnailPath: primary?.thumbnailPath || asset.imageThumbnailPath || "",
    mediaRefs,
    imageItems,
    images: imageItems.map((item) => item.imageUrl || item.imagePath).filter(Boolean),
  };
}

function ensureShotMediaCandidates(shot = {}, kind = "image") {
  const source = Array.isArray(kind === "video" ? shot.videoItems : shot.imageItems) ? (kind === "video" ? shot.videoItems : shot.imageItems) : [];
  const fallbackUrl = kind === "video"
    ? shot.videoUrl || shot.videoResultUrl || shot.videoResult || shot.videoPath || ""
    : shot.imageUrl || shot.imageResultUrl || shot.imageResult || shot.imagePath || "";
  const fallback = fallbackUrl ? [normalizeShotMediaCandidate({
    url: fallbackUrl,
    path: kind === "video" ? shot.videoPath || "" : shot.imagePath || "",
    imageUrl: kind === "image" ? shot.imageUrl || fallbackUrl : "",
    imagePath: kind === "image" ? shot.imagePath || "" : "",
    videoUrl: kind === "video" ? shot.videoUrl || fallbackUrl : "",
    videoPath: kind === "video" ? shot.videoPath || "" : "",
    thumbnailUrl: kind === "image" ? shot.imageThumbnailUrl || "" : shot.videoThumbnailUrl || "",
    thumbnailPath: kind === "image" ? shot.imageThumbnailPath || "" : "",
    primary: true,
  }, source.length, kind)] : [];
  return [...source, ...fallback]
    .filter((item) => item?.url || item?.path || item?.imageUrl || item?.videoUrl)
    .map((item, index) => normalizeShotMediaCandidate(item, index, kind))
    .reduce((items, item) => {
      const key = item.url || item.path || item.imageUrl || item.videoUrl || item.id;
      const index = items.findIndex((candidate) => (candidate.url || candidate.path || candidate.imageUrl || candidate.videoUrl || candidate.id) === key);
      if (index >= 0) {
        items[index] = {
          ...items[index],
          ...item,
          primary: items[index].primary || item.primary,
          discarded: items[index].discarded || item.discarded,
        };
        return items;
      }
      return [...items, item];
    }, []);
}

function shotMediaRefs(shot = {}) {
  return normalizeMediaRefs([
    ...(Array.isArray(shot.mediaRefs) ? shot.mediaRefs : []),
    ...(Array.isArray(shot.imageItems) ? shot.imageItems.map((item) => ({ ...item, kind: "image" })) : []),
    ...(Array.isArray(shot.videoItems) ? shot.videoItems.map((item) => ({ ...item, kind: "video" })) : []),
    ...((shot.imageUrl || shot.imageResultUrl || shot.imageResult || shot.imagePath) ? [{
      kind: "image",
      imageUrl: shot.imageUrl || shot.imageResultUrl || shot.imageResult || "",
      imagePath: shot.imagePath || "",
      thumbnailUrl: shot.imageThumbnailUrl || "",
      thumbnailPath: shot.imageThumbnailPath || "",
      primary: true,
    }] : []),
    ...((shot.videoUrl || shot.videoResultUrl || shot.videoResult || shot.videoPath) ? [{
      kind: "video",
      videoUrl: shot.videoUrl || shot.videoResultUrl || shot.videoResult || "",
      videoPath: shot.videoPath || "",
      thumbnailUrl: shot.videoThumbnailUrl || "",
      thumbnailPath: shot.videoThumbnailPath || "",
      primary: true,
    }] : []),
  ]);
}

function projectShotWithMediaRefs(shot = {}) {
  const mediaRefs = shotMediaRefs(shot);
  const primaryImage = primaryMediaRef(mediaRefs, "image");
  const primaryVideo = primaryMediaRef(mediaRefs, "video");
  return {
    ...shot,
    mediaRefs,
    imageResult: primaryImage?.url || primaryImage?.localPath || shot.imageResult || "",
    imageResultUrl: shot.imageResultUrl || shot.imageResult || primaryImage?.localPath || primaryImage?.url || "",
    imageUrl: primaryImage?.url || shot.imageUrl || "",
    imagePath: primaryImage?.localPath || shot.imagePath || "",
    imageThumbnailUrl: primaryImage?.thumbnailUrl || shot.imageThumbnailUrl || "",
    imageThumbnailPath: primaryImage?.thumbnailPath || shot.imageThumbnailPath || "",
    videoResult: primaryVideo?.url || primaryVideo?.localPath || shot.videoResult || "",
    videoResultUrl: shot.videoResultUrl || shot.videoResult || primaryVideo?.localPath || primaryVideo?.url || "",
    videoUrl: primaryVideo?.url || shot.videoUrl || "",
    videoPath: primaryVideo?.localPath || shot.videoPath || "",
    videoThumbnailUrl: primaryVideo?.thumbnailUrl || shot.videoThumbnailUrl || "",
    videoThumbnailPath: primaryVideo?.thumbnailPath || shot.videoThumbnailPath || "",
    imageItems: mediaRefs.filter((ref) => ref.kind === "image").map(mediaRefToShotMediaItem),
    videoItems: mediaRefs.filter((ref) => ref.kind === "video").map(mediaRefToShotMediaItem),
  };
}

function normalizeShotMediaCandidate(item = {}, index = 0, kind = "image") {
  const url = item.url || item.imageUrl || item.videoUrl || item.path || "";
  const path = item.path || item.imagePath || item.videoPath || "";
  return {
    id: item.id || `shot-${kind}-${url || path || "candidate"}-${index}`,
    url,
    path,
    imageUrl: item.imageUrl || (kind === "image" ? url : ""),
    imagePath: item.imagePath || (kind === "image" ? path : ""),
    videoUrl: item.videoUrl || (kind === "video" ? url : ""),
    videoPath: item.videoPath || (kind === "video" ? path : ""),
    thumbnailUrl: item.thumbnailUrl || item.imageThumbnailUrl || item.videoThumbnailUrl || (kind === "image" ? url : ""),
    thumbnailPath: item.thumbnailPath || item.imageThumbnailPath || "",
    primary: Boolean(item.primary),
    discarded: Boolean(item.discarded),
    locked: Boolean(item.locked),
    createdAt: item.createdAt || item.savedAt || Date.now(),
  };
}

function sameShotMediaCandidate(left = {}, right = {}) {
  return ["url", "path", "imageUrl", "imagePath", "videoUrl", "videoPath", "id"].some((key) => (
    left[key] && right[key] && String(left[key]) === String(right[key])
  ));
}

function selectPrimaryShotMediaCandidate(items = [], shot = {}, kind = "image") {
  const currentUrl = kind === "video"
    ? shot.videoUrl || shot.videoResultUrl || shot.videoResult || shot.videoPath || ""
    : shot.imageUrl || shot.imageResultUrl || shot.imageResult || shot.imagePath || "";
  return items.find((item) => !item.discarded && item.primary)
    || items.find((item) => !item.discarded && [item.url, item.path, item.imageUrl, item.imagePath, item.videoUrl, item.videoPath].some((value) => (
      value && currentUrl && String(value) === String(currentUrl)
    )))
    || [...items].reverse().find((item) => !item.discarded)
    || null;
}

function applyDiscardedShotMediaCandidate(shot = {}, kind = "image", candidate = {}) {
  const key = kind === "video" ? "videoItems" : "imageItems";
  const nextItems = ensureShotMediaCandidates(shot, kind)
    .filter((item) => !sameShotMediaCandidate(item, candidate));
  const nextPrimary = selectPrimaryShotMediaCandidate(nextItems, shot, kind);
  const markedItems = nextItems.map((item) => ({
    ...item,
    primary: sameShotMediaCandidate(item, nextPrimary || {}),
    discarded: false,
  }));
  if (kind === "video") {
    const nextUrl = nextPrimary?.videoUrl || nextPrimary?.url || "";
    const nextPath = nextPrimary?.videoPath || nextPrimary?.path || "";
    return {
      ...shot,
      videoResult: nextUrl,
      videoResultUrl: nextUrl,
      videoUrl: nextUrl,
      videoPath: nextPath,
      videoThumbnailUrl: nextPrimary?.thumbnailUrl || "",
      videoThumbnailPath: nextPrimary?.thumbnailPath || "",
      [key]: markedItems,
      mediaRefs: [],
      lastQueueResult: nextPath || nextUrl || (shot.imagePath || shot.imageUrl || ""),
    };
  }
  const nextUrl = nextPrimary?.imageUrl || nextPrimary?.url || "";
  const nextPath = nextPrimary?.imagePath || nextPrimary?.path || "";
  return {
    ...shot,
    imageResult: nextUrl,
    imageResultUrl: nextUrl,
    imageUrl: nextUrl,
    imagePath: nextPath,
    imageThumbnailUrl: nextPrimary?.thumbnailUrl || "",
    imageThumbnailPath: nextPrimary?.thumbnailPath || "",
    [key]: markedItems,
    mediaRefs: [],
    lastQueueResult: nextPath || nextUrl || (shot.videoPath || shot.videoUrl || ""),
  };
}

function normalizeAssetImageCandidate(item = {}, index = 0, primaryUrl = "") {
  const imageUrl = item.imageUrl || item.url || item.image || item.path || "";
  const imagePath = item.imagePath || item.path || "";
  const thumbnailUrl = item.thumbnailUrl || item.imageThumbnailUrl || item.imageUrl || imageUrl;
  return {
    id: item.id || `${imageUrl || imagePath || "candidate"}-${index}`,
    imageUrl,
    imagePath,
    thumbnailUrl,
    thumbnailPath: item.thumbnailPath || item.imageThumbnailPath || "",
    originalImageUrl: item.originalImageUrl || "",
    primary: Boolean(item.primary || (primaryUrl && imageUrl === primaryUrl)),
    discarded: Boolean(item.discarded),
    locked: Boolean(item.locked),
    createdAt: item.createdAt || item.savedAt || Date.now(),
  };
}

function selectPrimaryAssetImageCandidate(items = [], asset = {}) {
  const currentUrl = asset.imageUrl || asset.image || asset.imagePath || "";
  return items.find((item) => !item.discarded && item.primary)
    || items.find((item) => !item.discarded && [item.imageUrl, item.imagePath, item.url, item.path].some((value) => (
      value && currentUrl && String(value) === String(currentUrl)
    )))
    || [...items].reverse().find((item) => !item.discarded)
    || null;
}

function isLocalPath(value = "") {
  const text = String(value || "");
  return /^[a-zA-Z]:[\\/]/.test(text) || /^\\\\/.test(text) || text.startsWith("/");
}

function assetImageDiscardKeys(candidate = {}) {
  return [
    candidate.imageUrl,
    candidate.url,
    candidate.imagePath,
    candidate.path,
    candidate.id,
  ].map((value) => String(value || "").trim()).filter(Boolean);
}

function mergeImageDiscardKeys(current = [], candidate = {}) {
  return Array.from(new Set([
    ...(Array.isArray(current) ? current : []),
    ...assetImageDiscardKeys(candidate),
  ].filter(Boolean)));
}

function removeMatchingImageDiscardKeys(current = [], candidate = {}) {
  const nextKeys = new Set(assetImageDiscardKeys(candidate));
  if (!nextKeys.size) return Array.isArray(current) ? current : [];
  return (Array.isArray(current) ? current : []).filter((key) => !nextKeys.has(String(key || "")));
}

function sameAssetImageCandidate(left = {}, right = {}) {
  const leftUrl = left.imageUrl || left.url || "";
  const rightUrl = right.imageUrl || right.url || "";
  if (leftUrl && rightUrl && String(leftUrl) === String(rightUrl)) return true;
  const leftPath = left.imagePath || left.path || "";
  const rightPath = right.imagePath || right.path || "";
  if (leftPath && rightPath && String(leftPath) === String(rightPath)) return true;
  const leftId = left.id || "";
  const rightId = right.id || "";
  return Boolean(leftId && rightId && String(leftId) === String(rightId));
}

function resolveShotSourceNodeId(episode = {}, shot = {}) {
  return shot.sourceNodeId
    || episode.sourceNodeIds?.shot?.[0]
    || (episode.id ? `episode-${episode.id}-shots` : "");
}

function buildTimelineClipFromShot(shot = {}, current = {}, order = 0, options = {}) {
  const shotId = String(shot.id || current.shotId || "");
  const videoUrl = shot.videoUrl || shot.videoResultUrl || shot.videoResult || current.videoUrl || "";
  const videoPath = shot.videoPath || current.videoPath || "";
  const imageUrl = shot.imageUrl || shot.imageResultUrl || shot.imageResult || current.imageUrl || "";
  const imagePath = shot.imagePath || current.imagePath || "";
  const mediaUrl = videoUrl || current.mediaUrl || "";
  const mediaPath = videoPath || current.mediaPath || "";
  return {
    ...current,
    id: current.id || options.createId || `clip-${shotId || order + 1}`,
    shotId,
    sourceNodeId: current.sourceNodeId || shot.sourceNodeId || "",
    title: current.title || shot.title || shot.scene || shotId || `片段${order + 1}`,
    scene: current.scene || shot.scene || "",
    duration: current.duration || shot.duration || "4s",
    transition: current.transition || "直切",
    mediaUrl,
    mediaPath,
    videoUrl,
    videoPath,
    imageUrl,
    imagePath,
    mediaType: videoUrl || videoPath ? "video" : current.mediaType || "",
    reviewStatus: shot.reviewStatus || current.reviewStatus || current.approvalStatus || "待验收",
    approvalStatus: shot.reviewStatus || current.approvalStatus || current.reviewStatus || "待验收",
    approvalNote: current.approvalNote || shot.reviewComment || shot.reworkReason || "",
    note: current.note || shot.referenceResources || "",
    order,
  };
}
