export function buildProjectStudioActions(deps = {}) {
  const exitStudio = () => deps.setShowProjectStudio?.(false);
  return {
    generateText: deps.generateStudioTextPlan || noop,
    generateImages: () => deps.queueActiveEpisodeImages?.({ autoRun: true }),
    generateAssetImage: (asset, options = {}) => deps.queueActiveAssetImage?.(asset, { autoRun: true, ...options }),
    generateShotImage: (shot, options = {}) => deps.queueActiveShotImage?.(shot, { autoRun: true, ...options }),
    generateShotVideo: (shot, options = {}) => deps.queueActiveShotVideo?.(shot, { autoRun: true, ...options }),
    updateShotPrompt: deps.updateStudioShotPrompt || noop,
    rewriteShotPrompt: deps.rewriteStudioShotPrompt || noop,
    generateVideos: () => deps.queueActiveEpisodeVideos?.({ autoRun: true }),
    stopQueue: deps.stopGenerationQueue || noop,
    retryFailedJobs: deps.retryFailedJobs || noop,
    retryFailedShotJobs: deps.retryFailedShotJobs || noop,
    retryQueueJobs: deps.retryQueueJobs || noop,
    retryQueueJobsWithProvider: deps.retryQueueJobsWithProvider || noop,
    skipQueueJobs: deps.skipQueueJobs || noop,
    syncTimelineFromShots: deps.syncTimelineFromShots || noop,
    moveTimelineClip: deps.moveStudioTimelineClip || deps.moveTimelineClip || noop,
    updateTimelineClip: deps.updateStudioTimelineClip || deps.updateTimelineClip || noop,
    removeTimelineClip: deps.removeStudioTimelineClip || noop,
    updateTimelineClipDuration: deps.updateStudioTimelineClipDuration || noop,
    syncTimelineClipMedia: deps.syncStudioTimelineClipMedia || noop,
    setTimelineClipReviewStatus: deps.setStudioTimelineClipReviewStatus || deps.setTimelineClipReviewStatus || noop,
    setShotReviewStatus: deps.setShotReviewStatus || noop,
    relocateMediaRoot: deps.relocateMediaRoot || noop,
    repairLegacyTimelineFromBusiness: deps.repairLegacyTimelineFromBusiness || noop,
    repairBusinessTimelineFromLegacy: deps.repairBusinessTimelineFromLegacy || noop,
    setPrimaryAssetImage: deps.setPrimaryAssetImage || noop,
    discardAssetImageCandidate: deps.discardAssetImageCandidate || noop,
    setPrimaryShotMedia: deps.setPrimaryShotMedia || noop,
    discardShotMediaCandidate: deps.discardShotMediaCandidate || noop,
    queueMultiEpisodeDelivery: deps.queueMultiEpisodeDelivery || noop,
    exportAssetsAndStoryboard: deps.exportAssetsAndStoryboard || noop,
    runFullChainCheck: deps.runFullChainCheck || noop,
    runSystemSelfCheck: deps.runSystemSelfCheck || noop,
    repairMediaIntegrity: deps.repairMediaIntegrity || noop,
    repairAssetConsistency: deps.repairAssetConsistency || noop,
    focusMainChain: deps.focusMainChain || noop,
    openAdvancedCanvas: deps.openAdvancedCanvas || noop,
    openDashboard: () => {
      exitStudio();
      deps.setShowDashboard?.(true);
    },
    openQueue: () => deps.setShowQueue?.(true),
    openSettings: () => {
      exitStudio();
      deps.openSettingsPanel?.("root");
    },
    openPromptFactory: () => {
      exitStudio();
      deps.setShowPromptFactory?.(true);
    },
    openTimeline: () => deps.openProductionStudioView?.("timeline", "已打开生产工作台时间线。") || deps.setShowTimeline?.(true),
    runReview: deps.runProductionReview || noop,
    openExport: deps.planProductionDelivery || (() => deps.setShowExportCenter?.(true)),
    uploadShotImage: deps.uploadActiveShotImage || noop,
    uploadShotVideo: deps.uploadActiveShotVideo || noop,
    uploadAssetImage: deps.uploadActiveAssetImage || noop,
    importResources: deps.importProjectResources || noop,
    saveProject: deps.exportProject || noop,
    openProject: deps.openProjectFile || noop,
  };
}

function noop() {}
