export function selectReadyEpisodesForBatchDelivery(project = {}) {
  return (Array.isArray(project.episodes) ? project.episodes : []).filter((episode) => {
    const shots = Array.isArray(episode.shots) ? episode.shots : [];
    const reviewBlocked = shots.some((shot) => !["已通过", "搁置"].includes(shot.reviewStatus || "未审"));
    const timelineClips = Array.isArray(episode.timeline?.clips) ? episode.timeline.clips : [];
    const timelineBlocked = timelineClips.length
      ? timelineClips.some((clip) => !String(clip.mediaUrl || clip.videoUrl || "").trim())
      : shots.some((shot) => !String(shot.videoUrl || shot.videoPath || shot.videoResultUrl || shot.videoResult || "").trim());
    return shots.length > 0 && !reviewBlocked && !timelineBlocked;
  });
}

export function buildBatchDeliveryPackagePlans(input = {}) {
  const {
    project = {},
    outputSpec = {},
    now = () => Date.now(),
    buildPackageEntry,
    buildPackageContent,
    safeFileName = (value) => String(value || "episode-delivery-package"),
  } = input;
  return selectReadyEpisodesForBatchDelivery(project).map((episode, index) => {
    const stamp = now();
    const deliveryPackage = {
      id: `pkg-${episode.id || index + 1}-${stamp}`,
      episodeId: episode.id || "",
      title: `${episode.title || episode.name || "episode"} 工程包`,
    };
    const requestId = `package-${episode.id || index + 1}-${stamp}`;
    return {
      episode,
      requestId,
      deliveryPackage,
      packageEntry: buildPackageEntry?.({ episode, deliveryPackage }) || {},
      packageContent: buildPackageContent?.({
        businessProject: project,
        episode,
        deliveryPackage,
        outputSpec,
      }) || "",
      packageFileName: safeFileName(`${episode.title || episode.name || episode.id || "episode"}-delivery-package`),
    };
  });
}
