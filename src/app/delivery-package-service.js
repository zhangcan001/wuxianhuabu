export function buildDeliveryPackageQueueJob(input = {}) {
  const episode = input.episode || {};
  const requestId = input.requestId || `package-${Date.now()}`;
  const packageFileName = input.packageFileName || safeName(`${episode.title || episode.name || "episode"}-delivery-package`);
  return {
    kind: "exportPackage",
    title: `${episode.title || episode.name || "当前集"} 工程包`,
    priority: "高",
    requestId,
    episodeId: episode.id || input.activeEpisodeId || "",
    episodeName: episode.title || episode.name || "当前集",
    packageFileName,
    packageContent: input.packageContent || "",
  };
}

export function buildDeliveryPackagePendingHistory(input = {}) {
  return {
    ...(input.packageEntry || {}),
    requestId: input.requestId || "",
    status: "pending",
    detail: "已加入工程包队列",
  };
}

function safeName(value = "") {
  return String(value || "delivery-package")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "") || "delivery-package";
}
