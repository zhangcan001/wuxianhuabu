export function buildProjectStudioProps(input = {}) {
  return {
    businessModel: input.commercialProject,
    productionDashboard: input.productionDashboard,
    exportHistory: input.exportHistory,
    consistencyReport: input.projectConsistencyReport,
    migrationReport: input.projectMigrationReport,
    deliveryManifestReport: input.deliveryManifestReport,
    multiEpisodeDeliverySummary: input.multiEpisodeDeliverySummary,
    mediaCacheReport: input.mediaCacheReport,
    desktopUploadChecklist: input.desktopUploadChecklist,
    providerHealthReport: input.providerHealthReport,
    queueOperationsBoard: input.queueOperationsBoard,
    enhancedDeliveryGate: input.enhancedDeliveryGate,
    productionTaskStore: input.productionState?.taskStore,
    resourceIndex: input.resourceIndex,
    queue: input.generationQueue,
    queueRunning: input.queueRunning,
    projectMessage: input.projectMessage,
    activeViewRequest: input.studioViewRequest,
    actions: input.projectStudioActions,
  };
}
