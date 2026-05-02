import React, { Suspense, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  listenTimelineRenderProgress,
  deleteMediaCacheFiles as invokeDeleteMediaCacheFiles,
  openProjectFile as invokeOpenProjectFile,
  openProjectFileAtPath as invokeOpenProjectFileAtPath,
  loadProjectCache as invokeLoadProjectCache,
  listMediaCache as invokeListMediaCache,
  readProjectIndexSummary as invokeReadProjectIndexSummary,
  renderTimelineVideo as invokeRenderTimelineVideo,
  saveDeliveryPackage as invokeSaveDeliveryPackage,
  saveExportFile as invokeSaveExportFile,
  saveImageToDownloads as invokeSaveImageToDownloads,
  saveProjectCache as invokeSaveProjectCache,
  saveProjectFile as invokeSaveProjectFile,
  saveProjectFileToPath as invokeSaveProjectFileToPath,
  searchProjectIndex as invokeSearchProjectIndex,
  syncProjectIndex as invokeSyncProjectIndex,
} from "./tauri-bridge-helpers.js";
import {
  filterNodesInViewport,
  getNodeBounds,
  resolvePerformanceProfile,
} from "./canvas-performance-helpers.js";
import {
  clamp,
  cssEscape,
  isCanvasZoomTarget,
  isMarqueeTarget,
  isPanSurfaceTarget,
  positiveModulo,
  screenToWorld,
  worldToScreen,
} from "./canvas-viewport-helpers.js";
import {
  loadApiWorkspaceLibrary,
} from "./api-workspace-library.js";
import {
  safeFileName,
  shortPath,
} from "./file-name-helpers.js";
import {
  buildSearchEntries,
  nodeTypeLabel,
  searchNodeSubtitle,
  shortTitle,
  summarizeText,
} from "./project-search-helpers.js";
import {
  ARCHIVE_STAGE_OPTIONS,
  archiveStateForStorage,
  collaborationStateForStorage,
  defaultArchiveState,
  defaultCollaborationMemberLabel,
  defaultCollaborationState,
  defaultPerformanceSettings,
  normalizeArchiveState,
  normalizeCollaborationState,
  normalizePerformanceSettings,
  performanceSettingsForStorage,
} from "./project-shell-state-helpers.js";
import {
  EXPORT_PRESET_STAGE_OPTIONS,
  EXPORT_VIDEO_PRESET_OPTIONS,
  PROMPT_MODEL_PRESETS,
  STYLE_IMAGE_SYSTEM_OPTIONS,
  applyShotModelParamPreset,
  buildModelParamPresetOptions,
  buildModelParamPresetSummary,
  buildModelParamRequestMeta,
  buildModelPresetOptions,
  buildStylePresetRequestMeta,
  buildStylePresetSelectOptions,
  defaultExportPresetCenterState,
  defaultModelParamCenterState,
  defaultStylePresetCenterState,
  exportPresetCenterForStorage,
  findExportPresetById,
  findModelParamPresetById,
  findStylePresetById,
  findStylePresetByName,
  modelParamCenterForStorage,
  normalizeExportPresetDefinition,
  normalizeExportPresetCenterState,
  normalizeModelParamPresetDefinition,
  normalizeModelParamCenterState,
  normalizeStylePresetDefinition,
  normalizeStylePresetCenterState,
  stylePresetCenterForStorage,
} from "./preset-center-helpers.js";
import {
  PROMPT_STYLE_PRESETS,
  PROMPT_TEMPLATE_LIBRARY,
  defaultPromptFactoryState,
  normalizePromptFactoryState,
  promptFactoryForStorage,
} from "./prompt-factory-state-helpers.js";
import {
  TEMPLATE_CATEGORY_OPTIONS,
  createTemplateCenterStateHelpers,
} from "./template-center-state-helpers.js";
import {
  createProductionAssistHelpers,
} from "./production-assist-helpers.js";
import {
  appendToken,
  buildStoryboardPrompt,
  compactPromptText,
  dedupeOrderedStrings,
  escapeRegExp,
  splitGeminiPrompts,
} from "./text-format-helpers.js";
import {
  appendDraftShotsToList,
  applyResultToShotList,
  buildAssetPromptPayload,
  buildPipelineSyncPayloads,
  buildTimelineSourceFromShotRecord,
  findNearestNodeInEpisode,
} from "./canvas-action-helpers.js";
import {
  materializeLegacyCanvasFromBusinessProject,
  mergeAdvancedCanvasProjection,
  reduceCanvasNodeEditToProjectStore,
  reduceProjectStoreWithCanvasCompatibility,
} from "./app/project-canvas-compatibility.js";
import {
  applyCanvasNodeToProject,
} from "./domain/canvas-reverse-sync.js";
import {
  buildQueueAssetSuccessPatch,
  buildQueueResultNodePayload,
  buildQueueShotSuccessPatch,
  buildTimelineShotPatchFromQueue,
  patchShotQueueState,
} from "./canvas-queue-helpers.js";
import {
  normalizeGeminiWebNodeData,
  normalizeImageEditNodeData,
  normalizeTextNodeData,
  normalizeUploadNodeData,
} from "./node-action-helpers.js";
import {
  createProjectCachePayload,
  exportHistoryForStorage,
  generationQueueForStorage,
  normalizeExportHistoryState,
  normalizeGenerationQueueState,
  normalizeProductionEventsState,
  sanitizeNodeForStorage,
  sanitizeSettingsForStorage,
  stringifyProjectStoragePayload,
  upsertExportHistoryEntry,
} from "./project-storage-helpers.js";
import {
  createGenerationJobs,
} from "./queue-state-helpers.js";
import { runProjectGenerationQueue } from "./app/project-queue-runner.js";
import {
  useDebugTraceState,
} from "./app/use-debug-trace-state.js";
import {
  useAssetLibraryEffects,
} from "./app/use-asset-library-effects.js";
import {
  useCanvasKeyboardShortcuts,
} from "./app/use-canvas-keyboard-shortcuts.js";
import {
  useGenerationQueueState,
} from "./app/use-generation-queue-state.js";
import {
  useGlobalApiConfigState,
} from "./app/use-global-api-config-state.js";
import {
  useLatestRef,
} from "./app/use-latest-ref.js";
import {
  useProjectPathState,
} from "./app/use-project-path-state.js";
import {
  useProjectPersistenceEffects,
} from "./app/use-project-persistence-effects.js";
import {
  useProjectRuntimeCacheRestore,
} from "./app/use-project-runtime-cache-restore.js";
import {
  useProjectRuntimeIndexEffects,
} from "./app/use-project-runtime-index-effects.js";
import {
  useProjectStoreHydration,
} from "./app/use-project-store-hydration.js";
import {
  useStartupProjectGuide,
} from "./app/use-startup-project-guide.js";
import {
  useTimelineRenderProgressListener,
} from "./app/use-timeline-render-progress-listener.js";
import {
  useTimeoutRefCleanup,
} from "./app/use-timeout-ref-cleanup.js";
import {
  NOVEL_CHARACTER_ASSET_SCHEMA,
  NOVEL_PROP_ASSET_SCHEMA,
  NOVEL_SCENE_ASSET_SCHEMA,
  buildAssetLockFieldsHealthFixTemplate,
  buildHealthAssetSliceTemplate,
  buildShotHealthFixTemplate,
  selectHealthAssetSliceSchema,
} from "./app/health-fix-prompts.js";
import {
  buildArchiveReportFromState,
  compareQueueJobs,
  makeFixableHealthFinding,
  makeHealthFinding,
  queueKindLabel,
  queueStatusLabel,
  summarizeEpisodeTotals,
  summarizeQueue,
} from "./project-report-helpers.js";
import {
  applyImageApiKeyVault,
  applyNovelApiKeyVault,
  forgetApiKeyInVault,
  hasSavedApiKey,
  loadApiKeyVaultFromStorage,
  rememberApiKeyInVault,
} from "./storage-helpers.js";
import {
  parseProjectContent,
} from "./project-file-helpers.js";
import {
  computeRedoState,
  computeUndoState,
  createEditorSnapshot,
  normalizeRestoredSnapshot,
  pushHistoryState,
  structuredCloneSafe,
} from "./history-helpers.js";
import {
  buildClearedProjectState,
} from "./project-state-helpers.js";
import {
  createProjectStoreState,
} from "./app/project-store.js";
import {
  buildProjectStudioActions,
} from "./app/project-studio-actions.js";
import {
  exportAssetsAndStoryboardAction,
} from "./app/project-production-export.js";
import {
  buildDirectRenderHistoryEntry,
  buildTimelineRenderBlockMessage,
  queueDeliveryPackageJobsAction,
  queueEpisodeRenderAction,
  queueMultiEpisodeDeliveryAction,
  planProductionDeliveryAction,
  queueProjectRenderBatchAction,
} from "./app/project-delivery-actions.js";
import {
  checkImageTaskPreflight,
  checkMediaProviderConfig,
  checkTextTaskPreflight,
  checkVideoTaskPreflight,
  isLocalTextMode,
} from "./app/production-preflight.js";
import {
  businessTimelineClipsToLegacyEpisodeTimeline,
  buildStudioPackageHistoryEntry,
  buildStudioDeliveryOutputSpec,
  buildProjectConsistencyReport,
  buildDeliveryManifestValidationReport,
  buildMediaRelocationPlan,
  buildProjectMigrationReport,
  buildMultiEpisodeDeliverySummary,
  buildDesktopUploadPersistenceChecklist,
  buildTimelineClipMediaPatchFromShot,
  buildStudioDeliveryPackageContent,
  readFileAsDataUrlFallback,
  resolveUploadFilePath,
  shouldWarnBrowserLargeVideoUpload,
} from "./app/studio-media-helpers.js";
import {
  prepareImageQueueCommand,
  prepareStudioTextCommand,
  prepareVideoQueueCommand,
} from "./app/project-command-handlers.js";
import {
  createStudioTextPlanPackage,
} from "./app/project-text-plan-actions.js";
import {
  createProjectCommandService,
} from "./app/project-command-service.js";
import {
  applyLoadedProjectAction,
  importProjectContentAction,
  openProjectFileAction,
  openRecentProjectAction,
  saveProjectAction,
} from "./app/project-io-actions.js";
import {
  deleteProjectResourceAction,
  importProjectResourcesAction,
  updateProjectResourceAction,
} from "./app/project-resource-actions.js";
import {
  clearFinishedJobsAction,
  clearGenerationQueueAction,
  removeQueueJobAction,
  reprioritizeJobAction,
  retryExportJobsAction,
  retryFailedJobsAction,
  retryFailedShotJobsAction,
  retryQueueJobAction,
  retryQueueJobsAction,
} from "./app/project-queue-actions.js";
import {
  createRuntimeProjectRepository,
} from "./app/project-runtime-repository.js";
import {
  planImageQueueJobsFromProductionService,
  planVideoQueueJobsFromProductionService,
} from "./app/production-task-planner.js";
import {
  commitPlannedQueueJobs,
  createProductionCommandContext,
} from "./app/production-commands.js";
import {
  migrateProjectEmbeddedImages,
} from "./project-media-migration-helpers.js";
import {
  buildMediaCacheCleanupReport,
  buildMediaCacheReport,
} from "./project-media-index-helpers.js";
import {
  buildProjectResourceIndex,
  expandResourceReferences,
  formatBytes,
  formatReferencePath,
  normalizeProjectResource,
  parseDurationSeconds,
  resourceForStorage,
  resourceKindLabel,
  resourceKindShort,
  resourceMatchesQuery,
  walkStringFields,
} from "./project-resource-helpers.js";
import {
  buildEpisodeExportBundle,
  buildEpisodeRenderRequest,
  buildEpisodeTimelineSources,
  buildProjectArchiveBundle,
  buildProjectExportSummary,
  buildPublishingPlan,
  buildRenderHistoryOptions,
  buildRenderOptionsFromExportPreset,
  createRenderRequestId,
  createTimelineClip,
  defaultTimelineState,
  formatTimelineText,
  getEpisodeTimeline,
  normalizeTimelineClip,
  normalizeTimelineState,
  pickTimelineResultUrl,
  timelineForStorage,
} from "./project-timeline-helpers.js";
import {
  buildDashboardWorkflowFocus,
  buildWorkflowFocusContext,
} from "./workflow-focus-helpers.js";
import {
  buildWorkflowNavigator,
} from "./workflow-experience-helpers.js";
import {
  COMMERCIAL_TEMPLATE_CENTER_ITEMS,
} from "./commercial-template-library.js";
import {
  ACTIVE_NOVEL_ASSET_TEMPLATE_DEFAULT,
  ACTIVE_NOVEL_PROMPT_TEMPLATE_DEFAULT,
  ACTIVE_NOVEL_REVIEW_TEMPLATE_DEFAULT,
  ACTIVE_NOVEL_TEMPLATE_DEFAULT,
  CINEFORGE_REVIEW_THRESHOLD,
  NOVEL_API_BODY_TEMPLATE_DEFAULT,
  NOVEL_API_PROVIDERS,
  NOVEL_FACTORY_SCHEMA,
  NOVEL_PLANNING_SCHEMA,
  NOVEL_REVIEW_SCHEMA,
  NOVEL_REVISION_SCHEMA,
  NOVEL_REVISION_TEMPLATE_DEFAULT,
  NOVEL_SCRIPT_SCHEMA,
  NOVEL_TASK_MODES,
  NOVEL_TEMPLATE_PRESETS,
  QUEUE_PRIORITY_OPTIONS,
  REVIEW_STATUS_OPTIONS,
  SHOT_REVIEW_TEMPLATE_DEFAULT,
  SHOT_REVISION_SCHEMA,
  SHOT_STATUS_OPTIONS,
  TIMELINE_CLIP_REVIEW_SCHEMA,
  normalizeNovelBodyTemplate,
} from "./app/novel-factory-config.js";
import {
  buildPendingReviewBatchSummary,
  buildReviewClosureSummary,
  collectReviewableTargets,
  runBatchRefreshPlans,
  runBatchReviewAndRevise,
} from "./review-workflow-helpers.js";
import {
  buildExportDeliverableResult,
  buildFailedExportRetrySummary,
  buildTimelineBackfillBatchSummary,
  buildTimelineClosureSummary,
  runBatchTimelineApprovals,
  summarizeTimelineApprovalBatch,
} from "./delivery-workflow-helpers.js";
import {
  buildAssetRefreshEvidence,
  collectShotTouchedTokens,
  executeShotRefreshPlanAction,
  refreshAssetsFromRevision,
  autoReviseShotFromReviewAction,
  repairRejectedTimelineClipAction,
} from "./review-action-helpers.js";
import {
  createTextProductionPackage,
} from "./domain/text-pipeline.js";
import {
  buildLocalNovelPipeline,
} from "./domain/text-local-builder.js";
import {
  buildAssetImageJobs,
  buildShotImageJobs,
} from "./domain/image-pipeline.js";
import {
  buildProviderHealthReport,
} from "./domain/provider-health.js";
import {
  runProviderLiveCheck,
} from "./domain/provider-live-check.js";
import {
  buildQueueOperationsBoard,
} from "./domain/queue-diagnostics.js";
import {
  buildEnhancedDeliveryGate,
} from "./domain/delivery-gate.js";
import {
  buildCanvasWriteGuard,
} from "./domain/canvas-write-guard.js";
import {
  createCommercialProject,
} from "./domain/project-model.js";
import {
  recoverTimelineGapsAction,
  relocateMediaRootAction,
  repairAssetConsistencyAction,
  repairBusinessTimelineFromLegacyAction,
  repairLegacyTimelineFromBusinessAction,
  repairMediaIntegrityAction,
  runMissingMediaBatchAction,
  runRejectedTimelineRepairBatchAction,
} from "./app/project-repair-actions.js";
import {
  buildHealthFindingKey,
  filterHealthRemainingKeys,
  fixHealthFindingAction,
  fixHealthFindingsBatchAction,
  prependHealthRepairLog,
  reconcileHealthRepairAction,
} from "./app/project-health-repair-actions.js";
import {
  runShotBindingPatchHealthFix,
  runTimelineImportHealthFix,
} from "./app/project-health-fix-runner.js";
import {
  createMediaProviderRuntime,
  currentProviderMode,
  normalizeImageProviderMode,
  normalizeVideoProviderMode,
  resolveImageJobSettings,
  resolveShotImageProviderMode,
  resolveShotVideoProviderMode,
  resolveVideoJobSettings,
} from "./app/media-provider-runtime.js";
import {
  deleteSelectedMediaCacheFilesAction,
  exportMediaCacheCleanupReportAction,
} from "./app/project-media-cache-actions.js";
import {
  openProjectIndexSearchResultAction,
  rebuildProjectIndexAction,
  searchProjectIndexAction,
} from "./app/project-index-actions.js";
import {
  appendExportHistoryAction,
  copyExportPresetSummaryAction,
  exportEpisodeCoverAction,
  requeueExportHistoryItemAction,
  requeueExportHistoryItemsAction,
  saveDeliveryPackageArtifactAction,
  saveExportArtifactAction,
} from "./app/project-export-actions.js";
import {
  buildCascadedVideoJobsAfterImage,
  buildShotVideoJob,
  shouldPreferVideoForShot,
} from "./domain/video-pipeline.js";
import {
  buildAutopilotPauseResult,
  buildAutopilotStartMessage,
  buildTextProductionCompleteResult,
  describeAutopilotPauseReason,
  isTextProductionMode,
  isTextProductionReady,
  resolveProductionMode,
} from "./domain/orchestrator.js";
import {
  createProductionAppService,
} from "./application/services/production-app-service.js";
import {
  buildAssetImageUploadAction,
  buildShotImageUploadAction,
  buildShotVideoUploadAction,
  selectUploadShotTarget,
} from "./app/project-media-upload-actions.js";
import {
  runSystemSelfCheckAction,
} from "./app/system-self-check-action.js";
import {
  runFullChainCheckAction,
} from "./app/full-chain-check-action.js";
import {
  queueEpisodeMediaAction,
} from "./app/production-media-queue-actions.js";
import {
  buildProjectStudioProps,
} from "./app/panel-prop-builders.js";
import {
  CanvasNode,
} from "./app/canvas-node.jsx";
import {
  LegacyCanvasBanner,
  LegacyCanvasOverlay,
} from "./app/legacy-canvas-shell.jsx";
import {
  appendPipelineSyncAction,
  buildPipelineSyncExecutionPlan,
  buildPipelineSyncQueueMessage,
  buildPipelineSyncTracePayload,
} from "./domain/pipeline-sync.js";
import {
  appendLinkedEdge,
  buildManyOutputPlans,
  buildLinkedTimelineShots,
  buildNodeSyncOutcome,
  buildCreateOutputPayload,
  buildResultShotActionLabel,
  findResultNodeForShot,
  linkedNodeLabel,
  planPipelineNodeSync,
  planShotListAppend,
} from "./node-link-helpers.js";
import {
  clearDebugTraceEntries,
  emitDebugTrace,
} from "./debug-trace-helpers.js";
import {
  buildNovelChatCompletionsUrl,
  createBrowserTextDownload,
  detectComfyPromptNodeId,
  detectComfyWorkflowFormat,
  formatCustomImageApiError,
  isTauriRuntime,
  loadBackendServiceHelpers,
  summarizeCustomImageApiDiagnostic,
  validateCustomImageApiSettings,
} from "./app/runtime-helpers.js";
import {
  LazyArchiveCenterPanel,
  LazyCollaborationCenterPanel,
  LazyDebugTracePanel,
  LazyDirectorAssistantPanel,
  LazyExportCenterPanel,
  LazyExportPresetCenterPanel,
  LazyGenerationQueuePanel,
  LazyGlobalAssetPanel,
  LazyGlobalSearchPanel,
  LazyMinimapPanel,
  LazyModelParamCenterPanel,
  LazyProductionHubPanel,
  LazyProjectDashboardPanel,
  LazyProjectHealthPanel,
  LazyProjectResourcePanel,
  LazyProjectStudio,
  LazyPromptFactoryPanel,
  LazyPromptPreviewPanel,
  LazyReviewCenterPanel,
  LazySettingsPanel,
  LazySimpleWorkflowPanel,
  LazyStylePresetCenterPanel,
  LazyTemplateCenterPanel,
  LazyTimelinePanel,
  UiErrorBoundary,
} from "./app/lazy-components.jsx";
import {
  AppErrorFallback,
  GuardedNode,
  GuardedPanel,
  PanelLoadingFallback,
} from "./app/ui-boundaries.jsx";
import {
  NODE_MENU,
} from "./app/ui-constants.js";
import {
  createDefaultSettings,
  createNode,
  nodeMinSize,
} from "./app/node-factory.js";
import {
  API_BASE,
  API_KEY_VAULT_KEY,
  ASSET_LIBRARY_KEY,
  AUTOPILOT_MAX_ROUNDS,
  DEBUG_TRACE_KEY,
  NOVEL_API_SETTINGS_KEY,
  PROJECT_AUTOSAVE_DELAY_MS,
  PROJECT_CACHE_WRITE_DELAY_MS,
  PROJECT_PATH_KEY,
  QUEUE_AUTO_RETRY_LIMIT,
  STORAGE_KEY,
} from "./app/app-constants.js";
import {
  openAdvancedCanvasNavigation,
  focusMainChainNavigation,
  openNodeTargetInProductionStudioNavigation,
  openProductionStudioNavigation,
  openProductionStudioViewNavigation,
  openSettingsPanelNavigation,
  openWorkflowActionNavigation,
} from "./app/workspace-navigation.js";
import "./styles.css";

const DEFAULT_MANNEQUINS = [
  { id: 1, color: "#e53935", x: -2.4, z: 0, pose: "stand" },
  { id: 2, color: "#20c060", x: 2.4, z: 0, pose: "stand" },
];

const POSE_PRESETS = {
  stand: { label: "站立", leftArm: 8, rightArm: -8, leftLeg: 2, rightLeg: -2, bodyLean: 0 },
  walk: { label: "行走", leftArm: -34, rightArm: 30, leftLeg: 24, rightLeg: -22, bodyLean: -3 },
  run: { label: "奔跑", leftArm: -62, rightArm: 54, leftLeg: 42, rightLeg: -38, bodyLean: -12 },
  point: { label: "指向", leftArm: 8, rightArm: -88, leftLeg: 4, rightLeg: -6, bodyLean: 0 },
  sit: { label: "坐姿", leftArm: 16, rightArm: -16, leftLeg: 72, rightLeg: -72, bodyLean: 6 },
  fight: { label: "对峙", leftArm: -58, rightArm: 62, leftLeg: -18, rightLeg: 18, bodyLean: -8 },
};

let nextNodeId = 1;

const {
  defaultTemplateCenterState,
  normalizeTemplateCenterState,
  templateCenterForStorage,
  templateCategoryLabel,
} = createTemplateCenterStateHelpers({
  novelTemplatePresets: NOVEL_TEMPLATE_PRESETS,
  baseTemplates: {
    script: ACTIVE_NOVEL_TEMPLATE_DEFAULT,
    review: ACTIVE_NOVEL_REVIEW_TEMPLATE_DEFAULT,
    revision: NOVEL_REVISION_TEMPLATE_DEFAULT,
    asset: ACTIVE_NOVEL_ASSET_TEMPLATE_DEFAULT,
    storyboard: ACTIVE_NOVEL_PROMPT_TEMPLATE_DEFAULT,
  },
  promptTemplates: PROMPT_TEMPLATE_LIBRARY,
  commercialTemplates: COMMERCIAL_TEMPLATE_CENTER_ITEMS,
  novelApiBodyTemplateDefault: NOVEL_API_BODY_TEMPLATE_DEFAULT,
});

const {
  buildDirectorImageSuggestion,
  buildDirectorVideoSuggestion,
  suggestCameraMove,
  suggestShotAction,
  inferTimelineBackfillShotStatus,
  inferTimelineBackfillReviewStatus,
  buildTimelineBackfillPatch,
  computeTimelineBackfillDiff,
} = createProductionAssistHelpers({
  extractAssetTokens,
  normalizeShotRecord,
});

function App() {
  const stageRef = useRef(null);
  const worldRef = useRef(null);
  const edgeLayerRef = useRef(null);
  const fileInputRef = useRef(null);
  const resourceInputRef = useRef(null);
  const initialProject = useMemo(loadSavedProject, []);
  const [view, setView] = useState(initialProject.view);
  const [nodes, setNodes] = useState(initialProject.nodes);
  const [edges, setEdges] = useState(initialProject.edges);
  const [settings, setSettings] = useState(initialProject.settings);
  const [resources, setResources] = useState(initialProject.resources);
  const [timeline, setTimeline] = useState(initialProject.timeline);
  const [promptFactory, setPromptFactory] = useState(initialProject.promptFactory);
  const [templateCenter, setTemplateCenter] = useState(initialProject.templateCenter);
  const [stylePresetCenter, setStylePresetCenter] = useState(initialProject.stylePresetCenter);
  const [modelParamCenter, setModelParamCenter] = useState(initialProject.modelParamCenter);
  const [exportPresetCenter, setExportPresetCenter] = useState(initialProject.exportPresetCenter);
  const [collaborationState, setCollaborationState] = useState(initialProject.collaborationState);
  const [archiveState, setArchiveState] = useState(initialProject.archiveState);
  const [exportHistory, setExportHistory] = useState(initialProject.exportHistory || []);
  const [performanceSettings, setPerformanceSettings] = useState(initialProject.performanceSettings);
  const [textApiSettings, setTextApiSettings] = useState(loadNovelApiSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsFocus, setSettingsFocus] = useState("image");
  const {
    apiWorkspaceLibrary,
    setApiWorkspaceLibrary,
    refreshGlobalApiConfigs,
  } = useGlobalApiConfigState({
    showSettings,
    loadApiWorkspaceLibrary,
    loadBackendAiConfig,
    loadNovelApiSettingsFromBackend,
    setSettings,
    setTextApiSettings,
  });
  const [showGlobalAssets, setShowGlobalAssets] = useState(false);
  const [showResources, setShowResources] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showDebugTracePanel, setShowDebugTracePanel] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showProjectStudio, setShowProjectStudio] = useState(true);
  const [showCompatibilityCanvas, setShowCompatibilityCanvas] = useState(false);
  const [studioViewRequest, setStudioViewRequest] = useState({ view: "overview", token: 0 });
  const [showSimpleFlow, setShowSimpleFlow] = useState(false);
  const [hudCollapsed, setHudCollapsed] = useState(false);
  const [hudDock, setHudDock] = useState("bottom");
  const [promptPreview, setPromptPreview] = useState(null);
  const [showQueue, setShowQueue] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [timelineFocusClipId, setTimelineFocusClipId] = useState("");
  const [showHealth, setShowHealth] = useState(false);
  const [healthFixingKeys, setHealthFixingKeys] = useState([]);
  const [healthRepairLog, setHealthRepairLog] = useState([]);
  const [healthRemainingKeys, setHealthRemainingKeys] = useState([]);
  const [marqueeMode, setMarqueeMode] = useState(false);
  const [showPromptFactory, setShowPromptFactory] = useState(false);
  const [showTemplateCenter, setShowTemplateCenter] = useState(false);
  const [showStylePresetCenter, setShowStylePresetCenter] = useState(false);
  const [showModelParamCenter, setShowModelParamCenter] = useState(false);
  const [showExportPresetCenter, setShowExportPresetCenter] = useState(false);
  const [showDirectorAssistant, setShowDirectorAssistant] = useState(false);
  const [showReviewCenter, setShowReviewCenter] = useState(false);
  const [reviewCenterFocusTargetId, setReviewCenterFocusTargetId] = useState("");
  const [showCollaborationCenter, setShowCollaborationCenter] = useState(false);
  const [showProductionHub, setShowProductionHub] = useState(false);
  const [showArchiveCenter, setShowArchiveCenter] = useState(false);
  const [showExportCenter, setShowExportCenter] = useState(false);
  const [productionEvents, setProductionEvents] = useState(initialProject.productionEvents || []);
  const [projectMessage, setProjectMessage] = useState("");
  const {
    generationQueue,
    setGenerationQueue,
    queueRunning,
    setQueueRunning,
    queueRunningRef,
    queueStopRef,
    generationQueueRef,
  } = useGenerationQueueState(initialProject.generationQueue || [], {
    onRecoveredJobs: (recoveredCount) => setProjectMessage(`已恢复 ${recoveredCount} 个未完成任务，可直接继续执行队列。`),
  });
  const [episodes, setEpisodes] = useState(initialProject.episodes);
  const [activeEpisodeId, setActiveEpisodeId] = useState(initialProject.activeEpisodeId);
  const [projectStoreState, setProjectStoreState] = useState(() => createProjectStoreState(initialProject.businessProject, {
    source: initialProject.businessProject ? "loaded" : "",
  }));
  const [currentProjectPath, setCurrentProjectPath] = useProjectPathState(localStorage, PROJECT_PATH_KEY);
  const {
    debugTraceEnabled,
    setDebugTraceEnabled,
    debugTraceEntries,
    setDebugTraceEntries,
  } = useDebugTraceState({
    storage: localStorage,
    storageKey: DEBUG_TRACE_KEY,
    sink: typeof window !== "undefined" ? window : null,
  });
  const [mediaCacheFiles, setMediaCacheFiles] = useState([]);
  const [projectIndexSummary, setProjectIndexSummary] = useState(null);
  const [menu, setMenu] = useState(null);
  const [nodeMenu, setNodeMenu] = useState(null);
  const [edgeMenu, setEdgeMenu] = useState(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState("");
  const [highlightedNodeId, setHighlightedNodeId] = useState("");
  const [drag, setDrag] = useState(null);
  const [resize, setResize] = useState(null);
  const [connectionDrag, setConnectionDrag] = useState(null);
  const [pan, setPan] = useState(null);
  const [selectionBox, setSelectionBox] = useState(null);
  const [history, setHistory] = useState({ past: [], future: [] });
  const autopilotRunningRef = useRef(false);
  const activeRenderRequestRef = useRef("");
  const projectStoreStateRef = useRef(projectStoreState);
  const viewRef = useLatestRef(view, syncCanvasViewStyles);
  const panFrameRef = useRef(0);
  const panDraftRef = useRef(null);
  const dragFrameRef = useRef(0);
  const dragDraftRef = useRef(null);
  const nodesRef = useLatestRef(nodes);
  const timelineRef = useLatestRef(timeline);
  const resourcesRef = useLatestRef(resources);
  const episodesRef = useLatestRef(episodes);
  const activeEpisodeIdRef = useLatestRef(activeEpisodeId);
  const textApiSettingsRef = useLatestRef(textApiSettings);
  const healthRemainingKeysRef = useLatestRef(healthRemainingKeys);
  const shiftPressedRef = useRef(false);
  const highlightedNodeTimerRef = useRef(0);

  const selectedNode = nodes.find((node) => node.selected && isNodeVisibleInEpisode(node, activeEpisodeId, episodes));
  const viewportCenter = useMemo(() => screenToWorld(window.innerWidth / 2, window.innerHeight / 2, view), [view]);
  const assetIndex = useMemo(() => collectGlobalAssets(nodes), [nodes]);
  const resourceIndex = useMemo(() => buildProjectResourceIndex(resources, nodes, episodes, activeEpisodeId, { nodeTypeLabel }), [resources, nodes, episodes, activeEpisodeId]);
  const episodeTimeline = useMemo(() => getEpisodeTimeline(timeline, activeEpisodeId, { defaultEpisodeTimeline }), [timeline, activeEpisodeId]);
  const visibleNodes = useMemo(() => nodes.filter((node) => isNodeVisibleInEpisode(node, activeEpisodeId, episodes)), [nodes, activeEpisodeId, episodes]);
  const panelCount = [showSettings, showGlobalAssets, showResources, showSearch, showDebugTracePanel, showDashboard, showHealth, showPromptFactory, showTemplateCenter, showStylePresetCenter, showModelParamCenter, showExportPresetCenter, showDirectorAssistant, showReviewCenter, showCollaborationCenter, showProductionHub, showArchiveCenter, showTimeline, showQueue, Boolean(promptPreview)].filter(Boolean).length;
  const performanceProfile = useMemo(() => resolvePerformanceProfile(performanceSettings, visibleNodes.length, edges.length, panelCount), [performanceSettings, visibleNodes.length, edges.length, panelCount]);
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const nodeByIdRef = useLatestRef(nodeById);
  const selectedNodeIds = useMemo(() => nodes.filter((node) => node.selected).map((node) => node.id), [nodes]);
  const renderNodes = useMemo(() => filterNodesInViewport(visibleNodes, view, performanceProfile), [visibleNodes, view, performanceProfile]);
  const renderNodeIds = useMemo(() => new Set(renderNodes.map((node) => node.id)), [renderNodes]);
  const visibleEdges = useMemo(() => {
    const filtered = edges.filter((edge) => renderNodeIds.has(edge.source) && renderNodeIds.has(edge.target));
    return performanceProfile === "lite" ? filtered.slice(0, 260) : filtered;
  }, [edges, renderNodeIds, performanceProfile]);
  const projectSummary = useMemo(() => buildProjectSummary(nodes, edges, episodes, activeEpisodeId, generationQueue, resources, timeline, collaborationState, archiveState, exportHistory), [nodes, edges, episodes, activeEpisodeId, generationQueue, resources, timeline, collaborationState, archiveState, exportHistory]);
  const legacyCommercialProject = useMemo(() => createCommercialProject({
    projectId: currentProjectPath || "local-project",
    projectName: currentProjectPath ? shortPath(currentProjectPath) : "本地项目",
    episodes,
    activeEpisodeId,
    nodes,
    generationQueue,
    resources,
    timeline,
    exportHistory,
  }), [currentProjectPath, episodes, activeEpisodeId, nodes, generationQueue, resources, timeline, exportHistory]);
  const commercialProject = projectStoreState.project || legacyCommercialProject;
  const productionAppService = useMemo(() => createProductionAppService(), []);
  const projectCommandService = useMemo(() => createProjectCommandService({
    getProject: () => projectStoreStateRef.current?.project || commercialProject,
    getEvents: () => productionEvents,
    commitProjectStoreAction,
    productionAppService,
    setProductionEvents,
  }), [commercialProject, productionAppService, productionEvents]);
  const productionCommandContext = useMemo(() => createProductionCommandContext({
    commercialProject,
    productionAppService,
    projectCommandService,
    productionEvents,
    setProductionEvents,
    addGenerationJobs: addGenerationJobsAndMaybeRun,
    setProjectMessage,
  }), [commercialProject, productionAppService, projectCommandService, productionEvents]);
  const projectRepository = useMemo(() => createRuntimeProjectRepository({
    parseProject: parseProjectContent,
    normalizeProject,
    cacheProjectPayload,
    stringifyProjectStoragePayload,
    projectSerializers,
    storage: localStorage,
    storageKey: STORAGE_KEY,
    tauriRuntime: isTauriRuntime,
    saveProjectFileImpl: invokeSaveProjectFile,
    saveProjectCacheImpl: invokeSaveProjectCache,
  }), []);
  const {
    recentProjects,
    setRecentProjects,
    autoSaveState,
    setAutoSaveState,
  } = useProjectPersistenceEffects({
    projectRepository,
    currentProjectPath,
    currentProjectSnapshot,
    projectPayload,
    setProjectMessage,
    isRuntimeAvailable: isTauriRuntime,
    saveProjectFileToPath: invokeSaveProjectFileToPath,
    loadRecentProjects,
    cacheDelayMs: PROJECT_CACHE_WRITE_DELAY_MS,
    autoSaveDelayMs: PROJECT_AUTOSAVE_DELAY_MS,
    cacheDeps: [
      nodes,
      edges,
      view,
      settings,
      episodes,
      activeEpisodeId,
      resources,
      timeline,
      promptFactory,
      templateCenter,
      stylePresetCenter,
      modelParamCenter,
      exportPresetCenter,
      collaborationState,
      archiveState,
      exportHistory,
      performanceSettings,
      generationQueue,
      commercialProject,
      productionEvents,
    ],
    autoSaveDeps: [
      nodes,
      edges,
      settings,
      episodes,
      activeEpisodeId,
      resources,
      timeline,
      promptFactory,
      templateCenter,
      stylePresetCenter,
      modelParamCenter,
      exportPresetCenter,
      collaborationState,
      archiveState,
      exportHistory,
      performanceSettings,
      generationQueue,
      productionEvents,
    ],
  });
  useProjectRuntimeCacheRestore({
    projectRepository,
    isRuntimeAvailable: isTauriRuntime,
    loadProjectCacheImpl: invokeLoadProjectCache,
    migrateLoadedProjectMedia,
    applyEditorProjectState,
    appliedProjectOptions: {
      inferNextNodeId,
      defaultTimelineState,
      defaultPromptFactoryState,
      defaultTemplateCenterState,
      defaultStylePresetCenterState,
      defaultModelParamCenterState,
      defaultExportPresetCenterState,
      defaultCollaborationState,
      defaultArchiveState,
      defaultPerformanceSettings,
    },
    setProjectMessage,
  });
  useTimelineRenderProgressListener({
    isRuntimeAvailable: isTauriRuntime,
    listenTimelineRenderProgress,
    activeRenderRequestRef,
    setGenerationQueue,
    setProjectMessage,
  });
  const projectConsistencyReport = useMemo(() => buildProjectConsistencyReport({
    businessProject: commercialProject,
    timeline,
    nodes,
  }), [commercialProject, timeline, nodes]);
  const projectMigrationReport = useMemo(() => buildProjectMigrationReport({
    businessProject: commercialProject,
    timeline,
    nodes,
  }), [commercialProject, timeline, nodes]);
  const deliveryManifestReport = useMemo(() => buildDeliveryManifestValidationReport({
    businessProject: commercialProject,
  }), [commercialProject]);
  const multiEpisodeDeliverySummary = useMemo(() => buildMultiEpisodeDeliverySummary(commercialProject), [commercialProject]);
  const desktopUploadChecklist = useMemo(() => buildDesktopUploadPersistenceChecklist({
    businessProject: commercialProject,
    exportHistory,
    currentProjectPath,
  }), [commercialProject, exportHistory, currentProjectPath]);
  const productionState = useMemo(() => productionAppService.buildState({
    commercialProject,
    adapterOptions: {
      outputSpec: { platform: "short-video", aspectRatio: "9:16" },
      includePendingReview: true,
    },
    taskOptions: {
      imageProvider: normalizeImageProviderMode(currentProviderMode(settings)),
    },
    events: productionEvents,
    queue: generationQueue,
    consistencyReport: projectConsistencyReport,
    migrationReport: projectMigrationReport,
    deliveryManifestReport,
    securityReport: { strict: true },
  }), [productionAppService, commercialProject, settings, productionEvents, generationQueue, projectConsistencyReport, projectMigrationReport, deliveryManifestReport]);
  const productionDashboard = productionState.dashboard;
  const projectHealth = useMemo(() => buildProjectHealthReport(nodes, edges, episodes, activeEpisodeId, generationQueue, resources, timeline), [nodes, edges, episodes, activeEpisodeId, generationQueue, resources, timeline]);
  const workflowNavigator = useMemo(() => buildWorkflowNavigator(projectSummary.active || {}), [projectSummary]);
  const activeHudWorkspace = useMemo(
    () => apiWorkspaceLibrary.workspaces.find((item) => item.id === apiWorkspaceLibrary.activeWorkspaceId) || null,
    [apiWorkspaceLibrary],
  );
  const mediaCacheReport = useMemo(() => buildMediaCacheReport({
    nodes,
    resources,
    timeline,
    generationQueue,
    exportHistory,
  }, mediaCacheFiles), [nodes, resources, timeline, generationQueue, exportHistory, mediaCacheFiles]);
  const providerHealthReport = useMemo(() => buildProviderHealthReport(settings, {
    usesGemini: nodes.some((node) => node.type === "geminiWeb"),
    geminiProfileReady: isTauriRuntime(),
  }), [settings, nodes]);
  const queueOperationsBoard = useMemo(() => buildQueueOperationsBoard(generationQueue), [generationQueue]);
  const enhancedDeliveryGate = useMemo(() => buildEnhancedDeliveryGate(commercialProject?.activeEpisode || {}, {
    outputSpec: { aspectRatio: "9:16", resolution: "1080x1920", fps: 25 },
    requireCover: false,
    requireSubtitles: false,
    requireVoice: false,
  }), [commercialProject]);
  const projectStudioActions = useMemo(() => buildProjectStudioActions({
    generateStudioTextPlan,
      updateStudioShotPrompt,
      rewriteStudioShotPrompt,
      queueActiveEpisodeImages,
      queueActiveAssetImage,
      queueActiveShotImage,
      queueActiveShotVideo,
    queueActiveEpisodeVideos,
      stopGenerationQueue,
      uploadActiveShotImage,
      uploadActiveShotVideo,
      uploadActiveAssetImage,
      retryFailedJobs,
      retryFailedShotJobs,
      retryQueueJobs,
      retryQueueJobsWithProvider,
      skipQueueJobs,
      syncTimelineFromShots,
      moveStudioTimelineClip,
      updateStudioTimelineClip,
      removeStudioTimelineClip,
      updateStudioTimelineClipDuration,
      syncStudioTimelineClipMedia,
      setStudioTimelineClipReviewStatus,
      setShotReviewStatus,
      setPrimaryAssetImage,
      discardAssetImageCandidate,
      setPrimaryShotMedia,
      discardShotMediaCandidate,
      queueMultiEpisodeDelivery,
      exportAssetsAndStoryboard,
      relocateMediaRoot,
      repairLegacyTimelineFromBusiness,
      repairBusinessTimelineFromLegacy,
      repairMediaIntegrity,
      runFullChainCheck,
      runSystemSelfCheck,
      repairAssetConsistency,
      focusMainChain,
      runProductionReview,
      planProductionDelivery,
      openProductionStudioView,
      importProjectResources: () => resourceInputRef.current?.click(),
    openAdvancedCanvas,
    setShowProjectStudio,
    setShowDashboard,
    setShowQueue,
    openSettingsPanel,
    setShowPromptFactory,
    setShowTimeline,
    setShowExportCenter,
    exportProject,
    openProjectFile,
  }), [
    generateStudioTextPlan,
      updateStudioShotPrompt,
      rewriteStudioShotPrompt,
      queueActiveEpisodeImages,
      queueActiveAssetImage,
      queueActiveShotImage,
      queueActiveShotVideo,
    queueActiveEpisodeVideos,
      stopGenerationQueue,
      uploadActiveShotImage,
      uploadActiveShotVideo,
      uploadActiveAssetImage,
      retryFailedJobs,
      retryFailedShotJobs,
      retryQueueJobs,
      retryQueueJobsWithProvider,
      skipQueueJobs,
      syncTimelineFromShots,
      moveStudioTimelineClip,
      updateStudioTimelineClip,
      removeStudioTimelineClip,
      updateStudioTimelineClipDuration,
      syncStudioTimelineClipMedia,
      setStudioTimelineClipReviewStatus,
      setShotReviewStatus,
      setPrimaryAssetImage,
      discardAssetImageCandidate,
      setPrimaryShotMedia,
      discardShotMediaCandidate,
      queueMultiEpisodeDelivery,
      exportAssetsAndStoryboard,
      relocateMediaRoot,
      repairLegacyTimelineFromBusiness,
      repairBusinessTimelineFromLegacy,
      repairMediaIntegrity,
      runFullChainCheck,
      runSystemSelfCheck,
      repairAssetConsistency,
    focusMainChain,
    runProductionReview,
    planProductionDelivery,
    openProductionStudioView,
    resourceInputRef,
    openAdvancedCanvas,
    setShowProjectStudio,
    setShowDashboard,
    setShowQueue,
    openSettingsPanel,
    setShowPromptFactory,
    setShowTimeline,
    setShowExportCenter,
    exportProject,
    openProjectFile,
  ]);
  const reviewBoardReport = useMemo(() => buildReviewBoardReport(nodes, episodes, activeEpisodeId), [nodes, episodes, activeEpisodeId]);
  const reviewWorkflow = useMemo(() => buildReviewCenterWorkflow(projectSummary, activeEpisodeId), [projectSummary, activeEpisodeId]);
  const reviewRefreshPlanCount = useMemo(() => reviewBoardReport.targets.filter((item) => item.shotId && item.autoRevisionReport?.assetRefreshPlan?.length).length, [reviewBoardReport]);
  const startupGuidePending = useMemo(() => !nodes.length && !resources.length && !episodeTimeline.clips.length, [nodes.length, resources.length, episodeTimeline.clips.length]);
  useStartupProjectGuide({
    pending: startupGuidePending,
    setShowCompatibilityCanvas,
    setShowProjectStudio,
    setProjectMessage,
  });
  useProjectStoreHydration({
    legacyCommercialProject,
    projectStoreState,
    projectStoreStateRef,
    setProjectStoreState,
  });

  useAssetLibraryEffects({
    assetIndex,
    nodes,
    setNodes,
    syncGeneratedImagesIntoAssets,
    syncBusinessCanvasNodesToProjectStore,
    assetForStorage,
    storage: localStorage,
    storageKey: ASSET_LIBRARY_KEY,
  });

  const {
    refreshMediaCacheIndex,
    syncProjectIndexToSqlite,
  } = useProjectRuntimeIndexEffects({
    isRuntimeAvailable: isTauriRuntime,
    showResources,
    nodes,
    resources,
    generationQueue,
    timeline,
    exportHistory,
    productionEvents,
    mediaCacheReport,
    currentProjectPath,
    activeEpisodeId,
    listMediaCache: invokeListMediaCache,
    readProjectIndexSummary: invokeReadProjectIndexSummary,
    syncProjectIndex: invokeSyncProjectIndex,
    setMediaCacheFiles,
    setProjectIndexSummary,
    logger: console,
  });

  async function rebuildProjectIndex(deletionAudit = []) {
    return rebuildProjectIndexAction({
      isRuntimeAvailable: isTauriRuntime,
      syncProjectIndexToSqlite,
      setProjectMessage,
      deletionAudit,
    });
  }

  async function searchProjectIndexFromSqlite(query) {
    return searchProjectIndexAction({
      isRuntimeAvailable: isTauriRuntime,
      searchProjectIndex: invokeSearchProjectIndex,
      query,
      limit: 40,
    });
  }

  function openProjectIndexSearchResult(item) {
    return openProjectIndexSearchResultAction({
      item,
      setActiveEpisodeId,
      setTimelineFocusClipId,
      setShowTimeline,
      setProjectMessage,
      locateNode,
      clipboard: navigator.clipboard,
    });
  }

  async function exportMediaCacheCleanupReport(reviewDecisions = {}, deletionAudit = []) {
    return exportMediaCacheCleanupReportAction({
      buildMediaCacheCleanupReport,
      reportInput: {
        nodes,
        resources,
        timeline,
        generationQueue,
        exportHistory,
      },
      mediaCacheFiles,
      reviewDecisions,
      deletionAudit,
      saveExportArtifact,
      fileName: `${safeFileName(episodes.find((item) => item.id === activeEpisodeId)?.name || "project")}-media-cache-report.json`,
    });
  }

  async function deleteSelectedMediaCacheFiles(paths = []) {
    return deleteSelectedMediaCacheFilesAction({
      paths,
      deleteMediaCacheFiles: invokeDeleteMediaCacheFiles,
      refreshMediaCacheIndex,
    });
  }

  function openSettingsPanel(focus = "image") {
    return openSettingsPanelNavigation({
      focus,
      setSettingsFocus,
      refreshGlobalApiConfigs,
      setShowSettings,
    });
  }

  function openWorkflowAction(actionKey = "", nodeId = "") {
    openWorkflowActionNavigation({
      actionKey,
      nodeId,
      openNodeTargetInProductionStudio,
      openAdvancedCanvas,
      locateNode,
      openProductionStudioView,
      setShowQueue,
      setShowHealth,
      setShowDashboard,
      schedule: (callback) => window.setTimeout(callback, 0),
    });
  }

  function openNodeTargetInProductionStudio(nodeId = "", actionKey = "") {
    return openNodeTargetInProductionStudioNavigation({
      nodeId,
      actionKey,
      nodes,
      nodesRef,
      openProductionStudioView,
    });
  }

  function patchTextApiSettings(patch) {
    setTextApiSettings((current) => {
      const next = { ...current, apiKeyClear: false, ...patch };
      saveNovelApiSettings(next);
      return { ...next, apiKeySaved: !next.apiKeyClear && (next.apiKeySaved || Boolean(next.apiKey)) };
    });
  }

  async function applyApiWorkspacePreset(workspaceId) {
    const library = loadApiWorkspaceLibrary();
    setApiWorkspaceLibrary(library);
    const nextActiveId = String(workspaceId || "");
    const workspace = library.workspaces.find((item) => item.id === nextActiveId);
    if (!workspace) {
      setProjectMessage("已取消整套工作配置绑定");
      return;
    }
    patchTextApiSettings(workspace.textSettings || {});
    const nextMediaSettings = { ...settings, ...(workspace.mediaSettings || {}) };
    setSettings((current) => ({ ...current, ...(workspace.mediaSettings || {}) }));
    try {
      await saveBackendAiConfig(nextMediaSettings);
      setProjectMessage(`已切换工作配置：${workspace.name}`);
    } catch (error) {
      setProjectMessage(`工作配置已切换，但图片/视频保存失败：${String(error)}`);
    }
  }

  function traceAppEvent(event, payload = {}) {
    emitDebugTrace({
      enabled: debugTraceEnabled,
      event,
      payload,
    });
  }

  function snapshot() {
    return createEditorSnapshot({
      nodes,
      edges,
      view,
      resources,
      timeline,
      promptFactory,
      templateCenter,
      stylePresetCenter,
      modelParamCenter,
      collaborationState,
      archiveState,
      performanceSettings,
      businessProject: commercialProject,
      productionEvents,
      episodes,
      activeEpisodeId,
    });
  }

  function pushHistory() {
    const item = snapshot();
    setHistory((current) => pushHistoryState(current, item));
  }

  function restoreSnapshot(item) {
    const restored = normalizeRestoredSnapshot(item, {
      normalizeTimelineState,
      normalizePromptFactoryState,
      normalizeTemplateCenterState,
      normalizeStylePresetCenterState,
      normalizeModelParamCenterState,
      normalizeCollaborationState,
      normalizeArchiveState,
      normalizePerformanceSettings,
      defaultEpisodes,
      inferNextNodeId,
    });
    setNodes(restored.nodes);
    setEdges(restored.edges);
    setView(restored.view);
    setResources(restored.resources);
    setTimeline(restored.timeline);
    setPromptFactory(restored.promptFactory);
    setTemplateCenter(restored.templateCenter);
    setStylePresetCenter(restored.stylePresetCenter);
    setModelParamCenter(restored.modelParamCenter);
    setCollaborationState(restored.collaborationState);
    setArchiveState(restored.archiveState);
    setPerformanceSettings(restored.performanceSettings);
    if (Object.prototype.hasOwnProperty.call(restored, "businessProject")) {
      const nextStoreState = createProjectStoreState(restored.businessProject, {
        source: restored.businessProject ? "history" : "",
      });
      projectStoreStateRef.current = nextStoreState;
      setProjectStoreState(nextStoreState);
    }
    if (Object.prototype.hasOwnProperty.call(restored, "productionEvents")) setProductionEvents(restored.productionEvents);
    setEpisodes(restored.episodes);
    setActiveEpisodeId(restored.activeEpisodeId);
    nextNodeId = restored.nextNodeId;
    setMenu(null);
    setDrag(null);
    setResize(null);
    setPan(null);
  }

  function applyEditorProjectState(nextState) {
    if (Object.prototype.hasOwnProperty.call(nextState, "nextNodeId")) nextNodeId = nextState.nextNodeId;
    if (Object.prototype.hasOwnProperty.call(nextState, "nodes")) setNodes(nextState.nodes);
    if (Object.prototype.hasOwnProperty.call(nextState, "edges")) setEdges(nextState.edges);
    if (Object.prototype.hasOwnProperty.call(nextState, "view")) setView(nextState.view);
    if (Object.prototype.hasOwnProperty.call(nextState, "settings")) setSettings(nextState.settings);
    if (Object.prototype.hasOwnProperty.call(nextState, "resources")) setResources(nextState.resources);
    if (Object.prototype.hasOwnProperty.call(nextState, "timeline")) setTimeline(nextState.timeline);
    if (Object.prototype.hasOwnProperty.call(nextState, "promptFactory")) setPromptFactory(nextState.promptFactory);
    if (Object.prototype.hasOwnProperty.call(nextState, "templateCenter")) setTemplateCenter(nextState.templateCenter);
    if (Object.prototype.hasOwnProperty.call(nextState, "stylePresetCenter")) setStylePresetCenter(nextState.stylePresetCenter);
    if (Object.prototype.hasOwnProperty.call(nextState, "modelParamCenter")) setModelParamCenter(nextState.modelParamCenter);
    if (Object.prototype.hasOwnProperty.call(nextState, "exportPresetCenter")) setExportPresetCenter(nextState.exportPresetCenter);
    if (Object.prototype.hasOwnProperty.call(nextState, "collaborationState")) setCollaborationState(nextState.collaborationState);
    if (Object.prototype.hasOwnProperty.call(nextState, "archiveState")) setArchiveState(nextState.archiveState);
    if (Object.prototype.hasOwnProperty.call(nextState, "exportHistory")) setExportHistory(nextState.exportHistory);
    if (Object.prototype.hasOwnProperty.call(nextState, "performanceSettings")) setPerformanceSettings(nextState.performanceSettings);
    if (Object.prototype.hasOwnProperty.call(nextState, "generationQueue")) setGenerationQueue(nextState.generationQueue);
    if (Object.prototype.hasOwnProperty.call(nextState, "productionEvents")) setProductionEvents(nextState.productionEvents);
    if (Object.prototype.hasOwnProperty.call(nextState, "queueRunning")) {
      queueRunningRef.current = nextState.queueRunning;
      setQueueRunning(nextState.queueRunning);
    }
    if (Object.prototype.hasOwnProperty.call(nextState, "activeRenderRequestId")) {
      activeRenderRequestRef.current = nextState.activeRenderRequestId;
    }
    if (Object.prototype.hasOwnProperty.call(nextState, "episodes")) setEpisodes(nextState.episodes);
    if (Object.prototype.hasOwnProperty.call(nextState, "activeEpisodeId")) setActiveEpisodeId(nextState.activeEpisodeId);
    if (Object.prototype.hasOwnProperty.call(nextState, "menu")) setMenu(nextState.menu);
    if (Object.prototype.hasOwnProperty.call(nextState, "nodeMenu")) setNodeMenu(nextState.nodeMenu);
    if (Object.prototype.hasOwnProperty.call(nextState, "edgeMenu")) setEdgeMenu(nextState.edgeMenu);
    if (Object.prototype.hasOwnProperty.call(nextState, "currentProjectPath")) setCurrentProjectPath(nextState.currentProjectPath);
    if (Object.prototype.hasOwnProperty.call(nextState, "autoSaveState")) setAutoSaveState(nextState.autoSaveState);
    if (Object.prototype.hasOwnProperty.call(nextState, "businessProject")) {
      const nextStoreState = createProjectStoreState(nextState.businessProject, {
        source: nextState.businessProject ? "loaded" : "",
      });
      projectStoreStateRef.current = nextStoreState;
      setProjectStoreState(nextStoreState);
    }
  }

  function commitProjectStoreAction(action, options = {}) {
    const compatibility = reduceProjectStoreWithCanvasCompatibility({
      storeState: projectStoreStateRef.current,
      action,
      nodes: nodesRef.current || [],
      edges,
      materializeCanvas: options.materializeCanvas,
    });
    const nextStoreState = compatibility.storeState;
    projectStoreStateRef.current = nextStoreState;
    setProjectStoreState(nextStoreState);
    if (compatibility.materialized) {
      setNodes(compatibility.nodes);
      setEdges(compatibility.edges);
    }
    return nextStoreState;
  }

  function syncBusinessCanvasNodesToProjectStore(nextNodes = [], previousNodes = []) {
    const previousById = new Map((Array.isArray(previousNodes) ? previousNodes : []).map((node) => [node.id, node]));
    let nextStoreState = projectStoreStateRef.current;
    let changed = false;
    (Array.isArray(nextNodes) ? nextNodes : []).forEach((node) => {
      if (previousById.get(node.id) === node) return;
      const reduced = reduceCanvasNodeEditToProjectStore({
        storeState: nextStoreState,
        node,
      });
      if (reduced !== nextStoreState) {
        nextStoreState = reduced;
        changed = true;
      }
    });
    if (!changed) return false;
    projectStoreStateRef.current = nextStoreState;
    setProjectStoreState(nextStoreState);
    return true;
  }

  function syncLegacyCanvasFromBusinessProject(project = null) {
    if (!project) return;
    const canvas = materializeLegacyCanvasFromBusinessProject(project, nodesRef.current || [], edges);
    setNodes(canvas.nodes);
    setEdges(canvas.edges);
  }

  function undo() {
    setHistory((current) => {
      const result = computeUndoState(current, snapshot());
      if (!result.snapshotToRestore) return current;
      restoreSnapshot(result.snapshotToRestore);
      return result.history;
    });
  }

  function redo() {
    setHistory((current) => {
      const result = computeRedoState(current, snapshot());
      if (!result.snapshotToRestore) return current;
      restoreSnapshot(result.snapshotToRestore);
      return result.history;
    });
  }

  function locateNode(id) {
    const node = nodes.find((item) => item.id === id);
    if (!node) return;
    if (highlightedNodeTimerRef.current) {
      window.clearTimeout(highlightedNodeTimerRef.current);
      highlightedNodeTimerRef.current = 0;
    }
    const episodeId = node.data?.episodeId || episodes[0]?.id || "episode-1";
    if (episodeId !== activeEpisodeId) setActiveEpisodeId(episodeId);
    setNodes((current) => current.map((item) => ({ ...item, selected: item.id === id })));
    setSelectedEdgeId("");
    setHighlightedNodeId(id);
    highlightedNodeTimerRef.current = window.setTimeout(() => {
      setHighlightedNodeId((current) => (current === id ? "" : current));
      highlightedNodeTimerRef.current = 0;
    }, 1800);
    setView((current) => ({
      ...current,
      x: window.innerWidth / 2 - (node.x + node.width / 2) * current.scale,
      y: window.innerHeight / 2 - (node.y + node.height / 2) * current.scale,
    }));
    setShowSearch(false);
    setShowGlobalAssets(false);
  }

  useTimeoutRefCleanup(highlightedNodeTimerRef);

  function focusShotInNode(nodeId, shotId = "") {
    if (!nodeId) return;
    locateNode(nodeId);
    if (!shotId) return;
    updateNode(nodeId, { focusShotId: shotId }, { skipHistory: true });
  }

  function autoArrangeCanvas() {
    if (!visibleNodes.length) return;
    pushHistory();
    const columns = {
      novelPipeline: 0,
      upload: 0,
      imageEdit: 1,
      storyboard: 1,
      assetLibrary: 2,
      shotList: 3,
      split: 4,
      vr360: 4,
      director3d: 4,
      text: 5,
      result: 6,
    };
    const counters = {};
    const ordered = [...visibleNodes].sort((a, b) => (columns[a.type] ?? 7) - (columns[b.type] ?? 7) || a.y - b.y || a.x - b.x);
    const arranged = new Map(ordered.map((node) => {
      const col = columns[node.type] ?? 7;
      const row = counters[col] || 0;
      counters[col] = row + 1;
      return [node.id, {
        ...node,
        x: col * 560,
        y: row * 360,
        selected: false,
      }];
    }));
    setNodes((current) => current.map((node) => arranged.get(node.id) || node));
    setView({ x: 90, y: 90, scale: 0.78 });
  }

  function createEpisode() {
    pushHistory();
    const nextIndex = episodes.length + 1;
    const id = `episode-${Date.now()}`;
    const episode = { id, name: `第 ${nextIndex} 集`, note: "" };
    setEpisodes((current) => [...current, episode]);
    setActiveEpisodeId(id);
    setNodes((current) => current.map((node) => ({ ...node, selected: false })));
    setView({ x: 90, y: 90, scale: 0.82 });
    setProjectMessage(`已创建${episode.name}`);
  }

  function updateEpisode(id, patch) {
    setEpisodes((current) => current.map((episode) => (episode.id === id ? { ...episode, ...patch } : episode)));
  }

  function switchEpisode(id) {
    setActiveEpisodeId(id);
    setNodes((current) => current.map((node) => ({ ...node, selected: false })));
    setSelectedEdgeId("");
    setNodeMenu(null);
    setEdgeMenu(null);
    setMenu(null);
  }

  function duplicateActiveEpisode() {
    const sourceEpisode = episodes.find((episode) => episode.id === activeEpisodeId) || episodes[0];
    const sourceNodes = nodes.filter((node) => (node.data?.episodeId || episodes[0]?.id || "episode-1") === sourceEpisode.id);
    if (!sourceEpisode || !sourceNodes.length) return;
    pushHistory();
    const id = `episode-${Date.now()}`;
    const nodeIdMap = new Map();
    const clonedNodes = sourceNodes.map((node, index) => {
      const newId = `node-${nextNodeId++}`;
      nodeIdMap.set(node.id, newId);
      return {
        ...structuredCloneSafe(node),
        id: newId,
        x: node.x + 80,
        y: node.y + 80 + index * 4,
        selected: false,
        data: { ...(structuredCloneSafe(node.data) || {}), episodeId: id },
      };
    });
    const clonedEdges = edges
      .filter((edge) => nodeIdMap.has(edge.source) && nodeIdMap.has(edge.target))
      .map((edge, index) => ({
        ...edge,
        id: `edge-${nodeIdMap.get(edge.source)}-${nodeIdMap.get(edge.target)}-${Date.now()}-${index}`,
        source: nodeIdMap.get(edge.source),
        target: nodeIdMap.get(edge.target),
      }));
    const episode = { id, name: `${sourceEpisode.name} 副本`, note: sourceEpisode.note || "" };
    setEpisodes((current) => [...current, episode]);
    setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), ...clonedNodes]);
    setEdges((current) => [...current, ...clonedEdges]);
    setActiveEpisodeId(id);
    setProjectMessage(`已复制为${episode.name}`);
  }

  function addGenerationJobs(jobs) {
    if (!jobs.length) return;
    const normalizedJobs = normalizeGenerationJobsForCurrentSettings(jobs);
    setGenerationQueue((current) => [
      ...current,
      ...createGenerationJobs(normalizedJobs),
    ]);
    setShowQueue(true);
  }

  function normalizeGenerationJobsForCurrentSettings(jobs = []) {
    const globalImageMode = normalizeImageProviderMode(currentProviderMode(settings));
    return (Array.isArray(jobs) ? jobs : []).map((job) => {
      if (job?.kind !== "image") return job;
      const jobMode = normalizeImageProviderMode(job.imageProviderMode || job.providerMode);
      const imageProviderMode = jobMode === "inherit" ? globalImageMode : jobMode;
      return {
        ...job,
        imageProviderMode,
        providerMode: imageProviderMode === "custom" ? "api" : imageProviderMode,
        queueToolLabel: imageProviderMode === "comfy" ? "ComfyUI" : imageProviderMode === "custom" ? "API" : "本地模拟",
      };
    });
  }

  function addGenerationJobsAndMaybeRun(jobs, options = {}) {
    addGenerationJobs(jobs);
    if (options.autoRun) {
      queueStopRef.current = false;
      window.setTimeout(() => {
        runGenerationQueue();
      }, 80);
    }
  }

  function appendExportHistory(entry) {
    return appendExportHistoryAction({
      entry,
      setExportHistory,
      upsertExportHistoryEntry,
    });
  }

  function patchExportPresetCenter(patch) {
    setExportPresetCenter((current) => normalizeExportPresetCenterState({
      ...current,
      ...patch,
    }));
  }

  function patchActiveExportPreset(patch) {
    setExportPresetCenter((current) => {
      const normalized = normalizeExportPresetCenterState(current);
      const presets = normalized.presets.map((item) => (
        item.id === normalized.activePresetId ? normalizeExportPresetDefinition({ ...item, ...patch }) : item
      ));
      return normalizeExportPresetCenterState({
        ...normalized,
        presets,
      });
    });
  }

  function applyExportPresetToExportCenter(presetId) {
    const preset = findExportPresetById(exportPresetCenter, presetId);
    if (!preset) return;
    patchExportPresetCenter({ activePresetId: preset.id });
    openProductionStudioView("delivery", `已切换导出预设：${preset.name}`);
  }

  async function copyExportPresetSummary(presetId) {
    const preset = findExportPresetById(exportPresetCenter, presetId);
    return copyExportPresetSummaryAction({
      preset,
      clipboard: navigator.clipboard,
    });
  }

  async function exportExportPresetBundle(scope = "selected", presetId = "") {
    const normalized = normalizeExportPresetCenterState(exportPresetCenter);
    const presets = scope === "all"
      ? normalized.presets
      : normalized.presets.filter((item) => item.id === (presetId || normalized.activePresetId));
    if (!presets.length) {
      setProjectMessage("当前没有可导出的导出预设。");
      return;
    }
    const bundle = {
      type: "wuxianhuabu-export-presets",
      version: 1,
      exportedAt: new Date().toISOString(),
      presets,
    };
    const fileName = scope === "all" ? "export-presets.bundle.json" : `${safeFileName(presets[0].name || "export-preset")}.json`;
    await saveExportArtifact(fileName, "json", JSON.stringify(bundle, null, 2));
  }

  function importExportPresetBundle(rawText, mode = "merge") {
    const text = String(rawText || "").trim();
    if (!text) {
      setProjectMessage("请先粘贴导出预设 JSON。");
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      setProjectMessage(`导入失败：${error.message || String(error)}`);
      return;
    }
    const sourcePresets = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.presets)
        ? parsed.presets
        : [];
    if (!sourcePresets.length) {
      setProjectMessage("导入内容里没有找到导出预设。");
      return;
    }
    const imported = sourcePresets.map((item, index) => normalizeExportPresetDefinition({
      ...item,
      id: `export-preset-${Date.now()}-${index + 1}`,
      locked: false,
    }, index));
    setExportPresetCenter((current) => {
      if (mode === "replace") {
        return normalizeExportPresetCenterState({
          activePresetId: imported[0]?.id || "",
          presets: imported,
        });
      }
      const normalized = normalizeExportPresetCenterState(current);
      return normalizeExportPresetCenterState({
        activePresetId: imported[0]?.id || normalized.activePresetId,
        presets: [...normalized.presets, ...imported],
      });
    });
    setShowExportPresetCenter(true);
    setProjectMessage(mode === "replace" ? `已覆盖导入 ${imported.length} 套导出预设` : `已导入 ${imported.length} 套导出预设`);
  }

  function clearFinishedJobs() {
    clearFinishedJobsAction({ setGenerationQueue });
  }

  function appendHealthRepairLog(entry) {
    setHealthRepairLog((current) => prependHealthRepairLog(current, entry));
  }

  function syncHealthRemainingKeys(refreshedReport, preferredKeys = null) {
    setHealthRemainingKeys((current) => filterHealthRemainingKeys(refreshedReport, current, preferredKeys));
  }

  function buildCurrentHealthReport() {
    return buildProjectHealthReport(
      nodesRef.current || [],
      edges,
      episodesRef.current || [],
      activeEpisodeIdRef.current || activeEpisodeId,
      generationQueue,
      resourcesRef.current || [],
      timelineRef.current || defaultTimelineState(),
    );
  }

  async function fixHealthFinding(finding) {
    return fixHealthFindingAction({
      finding,
      pushHistory,
      autoFixHealthFinding,
      appendHealthRepairLog,
      setHealthFixingKeys,
      setProjectMessage,
    });
  }

  async function fixHealthFindingsBatch(findings) {
    return fixHealthFindingsBatchAction({
      findings,
      fixHealthFinding,
      buildRefreshedReport: buildCurrentHealthReport,
      syncHealthRemainingKeys,
      appendHealthRepairLog,
      setProjectMessage,
      getEpisodeName: () => episodesRef.current.find((item) => item.id === activeEpisodeIdRef.current)?.name || "当前集",
    });
  }

  function clearGenerationQueue() {
    clearGenerationQueueAction({
      setGenerationQueue,
      queueRunning: queueRunningRef.current,
    });
  }

  function stopGenerationQueue() {
    if (!queueRunningRef.current) return false;
    queueStopRef.current = true;
    setShowQueue(true);
    setProjectMessage("已请求停止批量生成，当前任务结束后会停止。");
    traceAppEvent("queue.run.stop_requested", {});
    return true;
  }

  function removeQueueJob(jobId) {
    removeQueueJobAction({
      jobId,
      setGenerationQueue,
    });
  }

  function updateTimelineEpisode(episodeId, updater, options = {}) {
    let nextEpisodeTimeline = null;
    setTimeline((current) => {
      const normalized = normalizeTimelineState(current, activeEpisodeId, { defaultEpisodeTimeline });
      const currentEpisode = normalized.byEpisode[episodeId] || defaultEpisodeTimeline();
      nextEpisodeTimeline = updater(currentEpisode);
      return {
        ...normalized,
        byEpisode: {
          ...normalized.byEpisode,
          [episodeId]: nextEpisodeTimeline,
        },
      };
    });
    if (options.syncBusiness !== false && nextEpisodeTimeline) {
      projectCommandService.replaceEpisodeTimeline({
        episodeId,
        timeline: nextEpisodeTimeline,
      });
    }
  }

  function importShotsToTimeline(shots) {
    if (!shots.length) {
      setProjectMessage("当前集还没有可导入时间线的镜头");
      return;
    }
    pushHistory();
    updateTimelineEpisode(activeEpisodeId, (episodeTimelineState) => {
      const existing = new Map(episodeTimelineState.clips.map((clip) => [`${clip.sourceNodeId || ""}::${clip.shotId}`, clip]));
      const appended = [];
      const nextClips = episodeTimelineState.clips.map((clip) => {
        const matched = shots.find((shot) => `${shot.sourceNodeId || ""}::${shot.shotId}` === `${clip.sourceNodeId || ""}::${clip.shotId}`);
        return matched ? normalizeTimelineClip({ ...clip, ...matched }) : clip;
      });
      shots.forEach((shot, index) => {
        const key = `${shot.sourceNodeId || ""}::${shot.shotId}`;
        if (!existing.has(key)) appended.push(createTimelineClip(shot, index));
      });
      return { ...episodeTimelineState, clips: [...nextClips, ...appended] };
    });
    openProductionStudioView("timeline", `已同步 ${shots.length} 个镜头到生产工作台时间线`);
  }

  function importShotsToTimelineByEpisode(episodeId, shots, options = {}) {
    if (!shots.length) return false;
    updateTimelineEpisode(episodeId, (episodeTimelineState) => {
      const existing = new Map(episodeTimelineState.clips.map((clip) => [`${clip.sourceNodeId || ""}::${clip.shotId}`, clip]));
      const appended = [];
      const nextClips = episodeTimelineState.clips.map((clip) => {
        const matched = shots.find((shot) => `${shot.sourceNodeId || ""}::${shot.shotId}` === `${clip.sourceNodeId || ""}::${clip.shotId}`);
        return matched ? normalizeTimelineClip({ ...clip, ...matched }) : clip;
      });
      shots.forEach((shot, index) => {
        const key = `${shot.sourceNodeId || ""}::${shot.shotId}`;
        if (!existing.has(key)) appended.push(createTimelineClip(shot, index));
      });
      return { ...episodeTimelineState, clips: [...nextClips, ...appended] };
    });
    if (!options.silent) {
      openProductionStudioView("timeline", `已同步 ${shots.length} 个镜头到生产工作台时间线`);
    }
    return true;
  }

  function patchShotRecord(sourceNodeId, shotId, patch) {
    let changed = false;
    setNodes((current) => {
      const nextNodes = current.map((node) => {
        if (node.id !== sourceNodeId || node.type !== "shotList") return node;
        const shots = Array.isArray(node.data?.shots) ? node.data.shots : [];
        const nextShots = shots.map((shot, index) => {
          const normalized = normalizeShotRecord(shot, index);
          if (normalized.id !== shotId) return shot;
          changed = true;
          return { ...shot, ...patch };
        });
        return changed ? { ...node, data: { ...(node.data || {}), shots: nextShots } } : node;
      });
      if (changed) syncBusinessCanvasNodesToProjectStore(nextNodes, current);
      return nextNodes;
    });
    return changed;
  }

  function resolveResultShotTarget(sourceId, resultNodeData = {}) {
    const target = findNearestNodeByType(sourceId, "shotList");
    if (!target) return null;
    const currentShots = Array.isArray(target.data?.shots) ? target.data.shots : [];
    if (!currentShots.length) return { target, shotId: "", shot: null, currentShots };
    const noteText = `${resultNodeData.note || ""} ${resultNodeData.displayName || ""}`;
    const explicitShotId = String(resultNodeData.targetShotId || "").trim().toUpperCase();
    const inferredShotId = explicitShotId || noteText.match(/\bS\d{2,}\b/i)?.[0]?.toUpperCase() || "";
    const isVideo = Boolean(resultNodeData.videoPath || resultNodeData.videoUrl);
    const preferredStatus = isVideo
      ? ["待生视频", "待修改", "已生成", "已确认", "完成"]
      : ["待生图", "待修改", "待生视频", "已生成", "已确认", "完成"];
    const normalizedShots = currentShots.map((shot, index) => normalizeShotRecord(shot, index));
    const matchedShot = inferredShotId
      ? normalizedShots.find((shot) => shot.id === inferredShotId)
      : normalizedShots.find((shot) => preferredStatus.includes(shot.status || "待写")) || normalizedShots[0] || null;
    return {
      target,
      shotId: matchedShot?.id || inferredShotId || "",
      shot: matchedShot,
      currentShots,
    };
  }

  function buildResultDecisionShotPatch(currentShot, resultNodeData = {}, action = "apply") {
    const applied = applyResultToShotList({
      currentShots: [currentShot],
      resultNodeData,
      normalizeShotRecord,
    }).patchedShot || currentShot;
    const resultUrl = resultNodeData.videoPath || resultNodeData.imagePath || resultNodeData.videoUrl || resultNodeData.imageUrl || "";
    const decisionBase = {
      ...applied,
      resultDecision: action,
      resultDecisionAt: Date.now(),
      lastQueueResult: resultUrl || applied.lastQueueResult || "",
    };
    if (action === "confirm") {
      return {
        ...decisionBase,
        status: "已确认",
        reviewStatus: "已通过",
      };
    }
    if (action === "complete") {
      return {
        ...decisionBase,
        status: "完成",
        reviewStatus: "已通过",
      };
    }
    if (action === "rework") {
      return {
        ...decisionBase,
        status: "待修改",
        reviewStatus: "待修改",
        reworkReason: String(resultNodeData.generationError || resultNodeData.note || "当前结果已标记待重做"),
        rejectedResultUrl: resultUrl || currentShot.rejectedResultUrl || "",
      };
    }
    return decisionBase;
  }

  function patchAssetRecord(sourceNodeId, assetToken, category, patch) {
    let changed = false;
    setNodes((current) => {
      const nextNodes = current.map((node) => {
        if (node.id !== sourceNodeId || node.type !== "assetLibrary") return node;
        const key = category === "角色" ? "characters" : category === "场景" ? "scenes" : "props";
        const items = Array.isArray(node.data?.[key]) ? node.data[key] : [];
        const nextItems = items.map((item) => {
          const normalized = normalizeAsset(item, category, sourceNodeId);
          if (normalized.token !== assetToken) return item;
          changed = true;
          const nextImageItem = normalizeAssetImageItem({
            imageUrl: patch.imageUrl,
            imagePath: patch.imagePath,
            originalImageUrl: patch.originalImageUrl,
            thumbnailUrl: patch.imageThumbnailUrl,
            thumbnailPath: patch.imageThumbnailPath,
          });
          const discardedImageKeys = removeDiscardedAssetImageKeys(normalized.discardedImageKeys, nextImageItem);
          const mergedItems = addUniqueAssetImageItems(normalized.imageItems || [], nextImageItem)
            .map((candidate) => ({
              ...candidate,
              primary: Boolean(patch.imageUrl && candidate.imageUrl === patch.imageUrl),
            }));
          const mergedImages = addUniqueImage(normalized.images || [], ...(patch.images || []), patch.imageUrl);
          return {
            ...normalized,
            ...patch,
            images: mergedImages,
            imageItems: mergedItems,
            discardedImageKeys,
            imageUrl: patch.imageUrl || normalized.imageUrl || mergedImages[mergedImages.length - 1] || "",
          };
        });
        if (!changed) return node;
        return { ...node, data: { ...(node.data || {}), [key]: nextItems } };
      });
      if (changed) syncBusinessCanvasNodesToProjectStore(nextNodes, current);
      return nextNodes;
    });
    return changed;
  }

  function markAssetProgressFromQueue(job, result) {
    if (!job?.sourceNodeId || !job?.sourceAssetToken || !job?.assetCategory) return false;
    const imageUrl = result?.imageUrl || result?.imagePath || "";
    if (!imageUrl) return false;
    return patchAssetRecord(job.sourceNodeId, job.sourceAssetToken, job.assetCategory, buildQueueAssetSuccessPatch(result));
  }

  function getEpisodeNodesForHealthFix(episodeId) {
    const currentNodes = nodesRef.current || [];
    const currentEpisodes = episodesRef.current || [];
    const fallback = currentEpisodes[0]?.id || "episode-1";
    return currentNodes.filter((node) => (node.data?.episodeId || fallback) === episodeId);
  }

  function getEpisodeFixAnchorNode(episodeId) {
    const episodeNodes = getEpisodeNodesForHealthFix(episodeId);
    return episodeNodes.find((node) => node.type === "novelPipeline")
      || episodeNodes.find((node) => node.type === "assetLibrary")
      || episodeNodes.find((node) => node.type === "shotList")
      || episodeNodes[0]
      || null;
  }

  function getEpisodeScriptSourceForHealthFix(episodeId) {
    const episodeNodes = getEpisodeNodesForHealthFix(episodeId);
    const pipelineNode = episodeNodes.find((node) => node.type === "novelPipeline");
    const pipeline = pipelineNode?.data?.pipeline || null;
    const scriptBody = String(
      pipeline?.finalScript
      || pipeline?.revisedScript
      || pipeline?.script
      || pipelineNode?.data?.novel
      || ""
    ).trim();
    if (scriptBody) {
      return {
        scriptBody,
        imageStyle: String(pipelineNode?.data?.imageStyle || "CG电影感"),
        assetTemplate: String(pipelineNode?.data?.assetTemplate || ACTIVE_NOVEL_ASSET_TEMPLATE_DEFAULT),
        sourceNodeId: pipelineNode?.id || getEpisodeFixAnchorNode(episodeId)?.id || "",
      };
    }
    const shotNode = episodeNodes.find((node) => node.type === "shotList");
    const shotSummary = (shotNode?.data?.shots || [])
      .map((shot, index) => {
        const normalized = normalizeShotRecord(shot, index);
        return [
          normalized.id,
          normalized.scene,
          normalized.action,
          normalized.imagePrompt,
          normalized.videoPrompt,
        ].filter(Boolean).join("｜");
      })
      .filter(Boolean)
      .join("\n");
    return {
      scriptBody: shotSummary,
      imageStyle: "CG电影感",
      assetTemplate: ACTIVE_NOVEL_ASSET_TEMPLATE_DEFAULT,
      sourceNodeId: shotNode?.id || getEpisodeFixAnchorNode(episodeId)?.id || "",
    };
  }

  function mergeAssetsIntoEpisodeLibrary(episodeId, nextAssets = {}) {
    const anchor = getEpisodeFixAnchorNode(episodeId);
    const currentNodes = nodesRef.current || [];
    const currentEpisodes = episodesRef.current || [];
    const fallback = currentEpisodes[0]?.id || "episode-1";
    const existingLibrary = currentNodes.find((node) => node.type === "assetLibrary" && (node.data?.episodeId || fallback) === episodeId);
    const normalizeList = (items, category) => dedupeAssets((Array.isArray(items) ? items : []).map((item) => normalizeAsset(item, category, existingLibrary?.id || "")));
    const mergeList = (current, incoming, category, sourceId = "") => {
      const byToken = new Map((Array.isArray(current) ? current : []).map((item) => {
        const normalized = normalizeAsset(item, category, sourceId);
        return [normalized.token, normalized];
      }));
      (Array.isArray(incoming) ? incoming : []).forEach((item) => {
        const normalized = normalizeAsset(item, category, sourceId);
        const previous = byToken.get(normalized.token);
        byToken.set(normalized.token, previous ? {
          ...previous,
          ...normalized,
          images: addUniqueImage(previous.images || [], ...(normalized.images || []), normalized.imageUrl),
          rejectedImages: addUniqueImage(previous.rejectedImages || [], ...(normalized.rejectedImages || [])),
          imageUrl: previous.imageUrl || normalized.imageUrl || "",
          prompt: normalized.prompt || previous.prompt || "",
          promptVariants: normalizeAssetPromptVariants({
            ...(previous.promptVariants || {}),
            ...(normalized.promptVariants || {}),
          }),
          visualLock: normalized.visualLock || previous.visualLock || "",
          continuityRule: normalized.continuityRule || previous.continuityRule || "",
          referenceResources: normalized.referenceResources || previous.referenceResources || "",
          evidenceSource: dedupeOrderedStrings([...(previous.evidenceSource || []), ...(normalized.evidenceSource || [])]),
        } : normalized);
      });
      return [...byToken.values()];
    };

    if (existingLibrary) {
      updateNode(existingLibrary.id, {
        characters: mergeList(existingLibrary.data?.characters, nextAssets.characters, "角色", existingLibrary.id),
        scenes: mergeList(existingLibrary.data?.scenes, nextAssets.scenes, "场景", existingLibrary.id),
        props: mergeList(existingLibrary.data?.props, nextAssets.props, "道具", existingLibrary.id),
      });
      if (anchor?.id && anchor.id !== existingLibrary.id) ensureLinkedEdge(anchor.id, existingLibrary.id);
      return existingLibrary.id;
    }

    const payload = {
      characters: normalizeList(nextAssets.characters, "角色"),
      scenes: normalizeList(nextAssets.scenes, "场景"),
      props: normalizeList(nextAssets.props, "道具"),
      episodeId,
    };
    if (anchor?.id) return createOutputNear(anchor.id, "assetLibrary", "资产库", payload);
    const position = viewportCenter;
    return addNode("assetLibrary", position, { displayName: "资产库", ...payload, episodeId });
  }

  async function waitForHealthRepairCommit() {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => {
      if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
        window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
        return;
      }
      setTimeout(resolve, 34);
    });
  }

  async function reconcileHealthRepair(finding) {
    return reconcileHealthRepairAction({
      finding,
      refreshGeneratedImagesIntoAssets: () => setNodes((current) => {
        const nextNodes = syncGeneratedImagesIntoAssets(current);
        if (nextNodes !== current) syncBusinessCanvasNodesToProjectStore(nextNodes, current);
        return nextNodes;
      }),
      waitForCommit: waitForHealthRepairCommit,
      buildRefreshedReport: buildCurrentHealthReport,
      getRemainingKeys: () => healthRemainingKeysRef.current,
      syncHealthRemainingKeys,
      appendHealthRepairLog,
    });
  }

  function buildHealthFixApiConfig(input, template, schema = "返回 JSON") {
    const currentSettings = textApiSettingsRef.current || {};
    const apiProvider = currentSettings.apiProvider || "openai";
    const providerPreset = NOVEL_API_PROVIDERS[apiProvider] || NOVEL_API_PROVIDERS.openai;
    const apiBaseUrl = currentSettings.apiBaseUrl || providerPreset.baseUrl;
    const apiUrl = currentSettings.apiUrl || buildNovelChatCompletionsUrl(apiBaseUrl);
    return {
      apiUrl,
      apiBaseUrl,
      apiProvider,
      apiKey: currentSettings.apiKey || "",
      authType: currentSettings.authType || providerPreset.authType || "bearer",
      headersJson: currentSettings.headersJson || "",
      model: currentSettings.apiModel || providerPreset.model || "gpt-4o-mini",
      bodyTemplate: normalizeNovelBodyTemplate(currentSettings.bodyTemplate, providerPreset),
      responsePath: currentSettings.responsePath || providerPreset.responsePath || "choices.0.message.content",
      novel: input,
      input,
      template,
      schema,
    };
  }

  function parseHealthFixJson(text, note = "体检修复") {
    const cleaned = stripJsonFence(text);
    try {
      return { ...parseJsonObjectLoose(cleaned), raw: cleaned, note };
    } catch {
      return { raw: cleaned, note };
    }
  }

  function buildEpisodeAssetCatalog(episodeId) {
    const currentNodes = nodesRef.current || [];
    const currentEpisodes = episodesRef.current || [];
    const fallback = currentEpisodes[0]?.id || "episode-1";
    const currentNodeById = new Map(currentNodes.map((node) => [node.id, node]));
    return collectGlobalAssets(currentNodes).items
      .filter((asset) => {
        const sourceNode = asset.sourceId ? currentNodeById.get(asset.sourceId) : null;
        return (sourceNode?.data?.episodeId || fallback) === episodeId;
      })
      .map((asset) => ({
        name: asset.name,
        category: asset.category,
        token: asset.token,
        prompt: summarizeText(asset.prompt || "", 120),
        meta: asset.meta || "",
      }));
  }

  async function autoFixHealthFinding(finding) {
    const fix = finding?.fix;
    if (!fix?.kind) return;
    const currentSettings = textApiSettingsRef.current || {};
    if ((currentSettings.factoryMode || "local") !== "api") {
      throw new Error("请先把小说工厂切到 API 模式，才能自动修复体检问题。");
    }
    if (!String(currentSettings.apiKey || "").trim()) {
      throw new Error("请先在统一 API 设置里填写文本 API Key。");
    }
    if (fix.kind === "asset_lock_fields") {
      const episodeId = finding.episodeId || activeEpisodeIdRef.current;
      const assetNode = fix.sourceNodeId ? nodeByIdRef.current.get(fix.sourceNodeId) : null;
      const category = fix.category || "角色";
      const key = category === "角色" ? "characters" : category === "场景" ? "scenes" : "props";
      const asset = (assetNode?.data?.[key] || []).map((item) => normalizeAsset(item, category, fix.sourceNodeId || "")).find((item) => item.token === fix.assetToken);
      if (!asset) throw new Error("没有找到需要修复的资产。");
      const currentResourceIndex = buildProjectResourceIndex(resourcesRef.current || [], nodesRef.current || [], episodesRef.current || [], episodeId, { nodeTypeLabel });
      const resourcesForEpisode = (currentResourceIndex.items || [])
        .filter((item) => !item.episodeId || item.episodeId === episodeId)
        .map((item) => ({ token: item.token, name: item.name, kind: item.kind, note: item.note || "" }));
      const input = JSON.stringify({
        goal: "补齐资产的视觉锁定、连续性规则和参考资源绑定",
        asset: {
          name: asset.name,
          category: asset.category,
          token: asset.token,
          prompt: asset.prompt || "",
          meta: asset.meta || "",
          visualLock: asset.visualLock || "",
          continuityRule: asset.continuityRule || "",
          evidenceSource: Array.isArray(asset.evidenceSource) ? asset.evidenceSource : [],
          referenceResources: asset.referenceResources || "",
        },
        resources: resourcesForEpisode,
      }, null, 2);
      const template = buildAssetLockFieldsHealthFixTemplate();
      const result = await runNovelFactoryApi(buildHealthFixApiConfig(input, template), parseHealthFixJson);
      const patch = {
        visualLock: String(result.visualLock || asset.visualLock || ""),
        continuityRule: String(result.continuityRule || asset.continuityRule || ""),
        evidenceSource: Array.isArray(result.evidenceSource) ? result.evidenceSource : (result.evidenceSource ? [String(result.evidenceSource)] : asset.evidenceSource || []),
        referenceResources: String(result.referenceResources || asset.referenceResources || ""),
      };
      if (!patch.visualLock && !patch.continuityRule && !patch.referenceResources && !(patch.evidenceSource || []).length) throw new Error("API 没有返回可用资产修复内容。");
      patchAssetRecord(fix.sourceNodeId, fix.assetToken, category, patch);
      await waitForHealthRepairCommit();
      await reconcileHealthRepair(finding);
      setProjectMessage(`已自动修复并通过复检：${finding.text}`);
      return;
    }
    if (fix.kind === "episode_character_assets" || fix.kind === "episode_scene_assets" || fix.kind === "episode_prop_assets" || fix.kind === "shot_bound_asset") {
      const episodeId = finding.episodeId || activeEpisodeIdRef.current;
      const source = getEpisodeScriptSourceForHealthFix(episodeId);
      if (!String(source.scriptBody || "").trim()) throw new Error("当前集没有足够的剧本或镜头信息，无法自动补资产。");
      const sourceNode = fix.sourceNodeId ? nodeByIdRef.current.get(fix.sourceNodeId) : null;
      const targetShot = fix.shotId
        ? (sourceNode?.data?.shots || []).map((item, index) => normalizeShotRecord(item, index)).find((item) => item.id === fix.shotId)
        : null;
      const boundCategory = fix.category || parseAssetTokenCategory(fix.assetToken);
      const targetCategory = fix.kind === "episode_character_assets"
        ? "角色"
        : fix.kind === "episode_scene_assets"
          ? "场景"
          : fix.kind === "episode_prop_assets"
            ? "道具"
            : (boundCategory || "角色");
      const assetInput = JSON.stringify({
        imageStyle: source.imageStyle,
        styleReference: "如用户未上传参考图，则按 imageStyle 锁定整体风格。",
        scriptBody: source.scriptBody,
        focusShot: targetShot ? {
          id: targetShot.id,
          scene: targetShot.scene,
          action: targetShot.action || "",
          emotion: targetShot.emotion || "",
          mainCharacterToken: targetShot.mainCharacterToken || "",
          mainSceneToken: targetShot.mainSceneToken || "",
          keyPropTokens: targetShot.keyPropTokens || [],
          assetRefs: targetShot.assetRefs || [],
          imagePrompt: targetShot.imagePrompt || "",
          videoPrompt: targetShot.videoPrompt || "",
        } : null,
        targetAsset: fix.assetToken ? {
          token: fix.assetToken,
          category: targetCategory,
          name: parseAssetTokenName(fix.assetToken),
        } : null,
      }, null, 2);
      const template = buildHealthAssetSliceTemplate(targetCategory, source.assetTemplate);
      const schema = selectHealthAssetSliceSchema(targetCategory);
      const result = await runNovelFactoryApi(buildHealthFixApiConfig(assetInput, template, schema), parseNovelAssetSliceOutput);
      const targetToken = String(fix.assetToken || "").trim();
      const targetName = parseAssetTokenName(targetToken);
      const normalizeGeneratedAssets = (items, category) => (Array.isArray(items) ? items : []).map((item) => (
        targetToken
          ? { ...item, name: item.name || targetName || parseAssetTokenName(item.token), token: targetToken }
          : item
      ));
      const characters = targetCategory === "角色" ? normalizeGeneratedAssets(result.characterAssets || [], "角色") : [];
      const scenes = targetCategory === "场景" ? normalizeGeneratedAssets(result.sceneAssets || [], "场景") : [];
      const props = targetCategory === "道具" ? normalizeGeneratedAssets(result.propAssets || [], "道具") : [];
      if (targetCategory === "角色" && !characters.length) throw new Error("API 没有返回可用角色资产。");
      if (targetCategory === "场景" && !scenes.length) throw new Error("API 没有返回可用场景资产。");
      if (targetCategory === "道具" && !props.length) throw new Error("API 没有返回可用道具资产。");
      mergeAssetsIntoEpisodeLibrary(episodeId, { characters, scenes, props });
      await waitForHealthRepairCommit();
      await reconcileHealthRepair(finding);
      setProjectMessage(`已自动补齐并通过复检：${finding.text}`);
      return;
    }
    if (fix.kind === "episode_timeline_import") {
      await runTimelineImportHealthFix({
        finding,
        getEpisodeNodesForHealthFix,
        buildTimelineSourceFromShotRecord,
        normalizeShotRecord,
        importShotsToTimelineByEpisode,
        waitForHealthRepairCommit,
        reconcileHealthRepair,
        setShowTimeline,
        setProjectMessage,
        activeEpisodeId: activeEpisodeIdRef.current,
        nodes: nodesRef.current || [],
        resources: resourcesRef.current || [],
        episodes: episodesRef.current || [],
        nodeTypeLabel,
        buildProjectResourceIndex,
        pickTimelineResultUrl,
        expandResourceReferences,
      });
      return;
    }
    if (fix.kind === "shot_binding_patch") {
      await runShotBindingPatchHealthFix({
        finding,
        fix,
        getNodeById: (nodeId) => nodeByIdRef.current.get(nodeId),
        normalizeShotRecord,
        collectGlobalAssets,
        suggestShotAssetBindingPatch,
        patchShotRecord,
        waitForHealthRepairCommit,
        reconcileHealthRepair,
        setProjectMessage,
        nodes: nodesRef.current || [],
      });
      return;
    }

    const sourceNode = fix.sourceNodeId ? nodeByIdRef.current.get(fix.sourceNodeId) : null;
    const episodeId = finding.episodeId || sourceNode?.data?.episodeId || activeEpisodeIdRef.current;
    const shot = (sourceNode?.data?.shots || []).map((item, index) => normalizeShotRecord(item, index)).find((item) => item.id === fix.shotId);
    if (!shot) throw new Error("没有找到对应镜头。");
    const assets = buildEpisodeAssetCatalog(episodeId);
    const currentResourceIndex = buildProjectResourceIndex(resourcesRef.current || [], nodesRef.current || [], episodesRef.current || [], episodeId, { nodeTypeLabel });
    const resourcesForEpisode = (currentResourceIndex.items || [])
      .filter((item) => !item.episodeId || item.episodeId === episodeId)
      .map((item) => ({ token: item.token, name: item.name, kind: item.kind, note: item.note || "" }));
    const baseInput = {
      goal: finding.text,
      shot: {
        id: shot.id,
        scene: shot.scene,
        shotSize: shot.shotSize,
        duration: shot.duration,
        action: shot.action || "",
        cameraMove: shot.cameraMove || "",
        imagePrompt: shot.imagePrompt || "",
        videoPrompt: shot.videoPrompt || "",
        referenceResources: shot.referenceResources || "",
      },
      assets,
      resources: resourcesForEpisode,
    };

    const template = buildShotHealthFixTemplate(fix.kind);
    if (!template) return;
    const result = await runNovelFactoryApi(buildHealthFixApiConfig(JSON.stringify(baseInput, null, 2), template), parseHealthFixJson);
    const patch = {};
    if (fix.kind === "shot_image_prompt" || fix.kind === "shot_asset_refs") patch.imagePrompt = String(result.imagePrompt || shot.imagePrompt || "");
    if (fix.kind === "shot_video_prompt" || fix.kind === "shot_asset_refs") patch.videoPrompt = String(result.videoPrompt || shot.videoPrompt || "");
    if (fix.kind === "shot_reference_resources") patch.referenceResources = String(result.referenceResources || shot.referenceResources || "");
    if (fix.kind !== "shot_reference_resources") {
      if (String(result.mainFocus || "").trim()) patch.mainFocus = String(result.mainFocus).trim();
      if (String(result.openingFrame || "").trim()) patch.openingFrame = String(result.openingFrame).trim();
      if (String(result.closingFrame || "").trim()) patch.closingFrame = String(result.closingFrame).trim();
      if (String(result.continuityNote || "").trim()) patch.continuityNote = String(result.continuityNote).trim();
      if (String(result.riskControl || "").trim()) patch.riskControl = String(result.riskControl).trim();
    }
    if (fix.kind === "shot_asset_refs") {
      patch.assetRefs = Array.isArray(result.assetTokens)
        ? result.assetTokens.filter(Boolean)
        : extractAssetTokens(`${result.imagePrompt || ""} ${result.videoPrompt || ""}`);
    }
    if (!Object.keys(patch).length) throw new Error("API 没有返回可用修复内容。");
    patchShotRecord(fix.sourceNodeId, fix.shotId, patch);
    await waitForHealthRepairCommit();
    if (patch.imagePrompt || patch.videoPrompt || patch.referenceResources) upsertTimelineClipFromShot(fix.sourceNodeId, { ...shot, ...patch }, { silent: true });
    await waitForHealthRepairCommit();
    await reconcileHealthRepair(finding);
    setProjectMessage(`已自动修复并通过复检：${finding.text}`);
  }

  function buildTimelineSourceFromShot(sourceNodeId, shot) {
    const sourceNode = nodeById.get(sourceNodeId);
    return buildTimelineSourceFromShotRecord({
      sourceNodeId,
      shot,
      sourceNode,
      activeEpisodeId,
      nodes,
      resourceIndex,
      pickTimelineResultUrl,
      expandResourceReferences,
    });
  }

  function upsertTimelineClipFromShot(sourceNodeId, shot, options = {}) {
    if (!sourceNodeId || !shot?.id) return null;
    const source = buildTimelineSourceFromShot(sourceNodeId, shot);
    updateTimelineEpisode(source.episodeId, (episodeTimelineState) => {
      const index = episodeTimelineState.clips.findIndex((clip) => clip.shotId === source.shotId && (clip.sourceNodeId || "") === (sourceNodeId || ""));
      if (index < 0) {
        return { ...episodeTimelineState, clips: [...episodeTimelineState.clips, createTimelineClip(source, episodeTimelineState.clips.length)] };
      }
      return {
        ...episodeTimelineState,
        clips: episodeTimelineState.clips.map((clip, clipIndex) => (clipIndex === index ? normalizeTimelineClip({ ...clip, ...source }) : clip)),
      };
    });
    if (!options.silent) {
      openProductionStudioView("timeline", `已同步镜头 ${shot.id} 到生产工作台时间线`);
    }
    return source;
  }

  function patchTimelineClip(episodeId, clipId, patch) {
    updateTimelineEpisode(episodeId, (episodeTimelineState) => ({
      ...episodeTimelineState,
      clips: episodeTimelineState.clips.map((clip) => (clip.id === clipId ? normalizeTimelineClip({ ...clip, ...patch }) : clip)),
    }));
  }

  function moveTimelineClip(episodeId, clipId, direction) {
    updateTimelineEpisode(episodeId, (episodeTimelineState) => {
      const index = episodeTimelineState.clips.findIndex((clip) => clip.id === clipId);
      if (index < 0) return episodeTimelineState;
      const target = clamp(index + direction, 0, episodeTimelineState.clips.length - 1);
      if (target === index) return episodeTimelineState;
      const next = [...episodeTimelineState.clips];
      const [clip] = next.splice(index, 1);
      next.splice(target, 0, clip);
      return { ...episodeTimelineState, clips: next };
    });
  }

  function duplicateTimelineClip(episodeId, clipId) {
    updateTimelineEpisode(episodeId, (episodeTimelineState) => {
      const index = episodeTimelineState.clips.findIndex((clip) => clip.id === clipId);
      if (index < 0) return episodeTimelineState;
      const source = episodeTimelineState.clips[index];
      const copy = normalizeTimelineClip({
        ...source,
        id: `${source.id || source.shotId || "clip"}-copy-${Date.now()}`,
        title: `${source.title || source.shotId || "片段"} 副本`,
      }, index + 1);
      const next = [...episodeTimelineState.clips];
      next.splice(index + 1, 0, copy);
      return { ...episodeTimelineState, clips: next };
    });
  }

  function sortTimelineClipsByShotId(episodeId) {
    updateTimelineEpisode(episodeId, (episodeTimelineState) => ({
      ...episodeTimelineState,
      clips: [...episodeTimelineState.clips].sort((left, right) => String(left.shotId || left.title || "").localeCompare(String(right.shotId || right.title || ""), "zh-Hans-CN", { numeric: true })),
    }));
  }

  function patchTimelineClips(episodeId, clipIds = [], patch = {}) {
    const idSet = new Set(clipIds);
    updateTimelineEpisode(episodeId, (episodeTimelineState) => ({
      ...episodeTimelineState,
      clips: episodeTimelineState.clips.map((clip) => (idSet.has(clip.id) ? normalizeTimelineClip({ ...clip, ...patch }) : clip)),
    }));
  }

  function removeTimelineClip(episodeId, clipId) {
    updateTimelineEpisode(episodeId, (episodeTimelineState) => ({
      ...episodeTimelineState,
      clips: episodeTimelineState.clips.filter((clip) => clip.id !== clipId),
    }));
  }

  function findShotByTimelineClip(clip) {
    if (!clip?.shotId) return null;
    const directNode = clip.sourceNodeId ? nodeById.get(clip.sourceNodeId) : null;
    if (directNode?.type === "shotList") {
      const directShot = (directNode.data?.shots || []).map((shot, index) => normalizeShotRecord(shot, index)).find((shot) => shot.id === clip.shotId);
      if (directShot) return { node: directNode, shot: directShot };
    }
    const episodeId = directNode?.data?.episodeId || activeEpisodeId;
    for (const node of nodes) {
      if (node.type !== "shotList" || (node.data?.episodeId || activeEpisodeId) !== episodeId) continue;
      const match = (node.data?.shots || []).map((shot, index) => normalizeShotRecord(shot, index)).find((shot) => shot.id === clip.shotId);
      if (match) return { node, shot: match };
    }
    return null;
  }

  function locateShotFromTimelineClip(clip) {
    const linked = findShotByTimelineClip(clip);
    if (!linked?.node?.id) {
      setProjectMessage("没有找到对应的镜头节点");
      return;
    }
    setShowTimeline(false);
    locateNode(linked.node.id);
    setProjectMessage(`已定位到镜头 ${linked.shot.id}`);
  }

  function findTimelineClipById(episodeId, clipId) {
    return (getEpisodeTimeline(timelineRef.current, episodeId, { defaultEpisodeTimeline }).clips || []).find((item) => item.id === clipId) || null;
  }

  function queueGenerationForTimelineClip(clip, options = {}) {
    const linked = findShotByTimelineClip(clip);
    if (!linked?.node || !linked?.shot) {
      if (!options.silent) setProjectMessage("没有找到对应镜头，暂时无法发起生成");
      return false;
    }
    if (String(clip.mediaUrl || "").trim()) {
      if (!options.silent) setProjectMessage(`${clip.title || clip.shotId} 已经有素材了`);
      return false;
    }
    const shot = linked.shot;
    const preferVideo = shouldPreferVideoForShot(shot);
    const kind = preferVideo ? "video" : "image";
    const videoJob = preferVideo
      ? buildShotVideoJob(linked.node.id, shot, {
        buildVideoShotPrompt: (item) => buildVideoShotPrompt(item, assetIndex, resourceIndex),
      })
      : null;
    const prompt = preferVideo ? videoJob?.prompt : buildImageShotPrompt(shot, assetIndex, resourceIndex);
    if (!String(prompt || "").trim()) {
      if (!options.silent) setProjectMessage(`${shot.id} 还没有可用的${kind === "video" ? "视频" : "图片"}提示词`);
      return false;
    }
    addGenerationJobs(preferVideo ? [videoJob] : [{
      sourceNodeId: linked.node.id,
      shotId: shot.id,
      title: `${shot.id}-图片`,
      kind,
      prompt,
      imageProviderMode: resolveShotImageProviderMode(shot, settings),
      imageRuntimeModel: shot.imageRuntimeModel || "",
      offsetX: 1180,
      offsetY: 0,
    }]);
    if (!options.silent) setProjectMessage(`已为 ${shot.id} 加入${kind === "video" ? "视频" : "图片"}生成队列`);
    return true;
  }

  function syncTimelineClipFromSource(episodeId, clipId, options = {}) {
    const episodeTimelineState = getEpisodeTimeline(timelineRef.current, episodeId, { defaultEpisodeTimeline });
    const clip = (episodeTimelineState.clips || []).find((item) => item.id === clipId);
    if (!clip) return false;
    const linked = findShotByTimelineClip(clip);
    if (!linked?.node || !linked?.shot) return false;
    const source = buildTimelineSourceFromShot(linked.node.id, linked.shot);
    patchTimelineClip(episodeId, clipId, {
      ...source,
      id: clip.id,
      transition: clip.transition || source.transition || "直切",
      note: String(clip.note || "").trim() || String(source.note || "").trim(),
      mediaUrl: String(source.mediaUrl || "").trim() || String(clip.mediaUrl || "").trim(),
      mediaType: String(source.mediaUrl || "").trim() ? source.mediaType : clip.mediaType,
    });
    if (!options.silent) setProjectMessage(`已同步 ${clip.title || clip.shotId} 的源镜头内容`);
    return true;
  }

  function syncTimelineClipsFromSource(episodeId, clipIds = [], options = {}) {
    const targets = Array.isArray(clipIds) ? clipIds.filter(Boolean) : [];
    let count = 0;
    targets.forEach((clipId) => {
      if (syncTimelineClipFromSource(episodeId, clipId, { silent: true })) count += 1;
    });
    if (!options.silent) setProjectMessage(count ? `已同步 ${count} 条时间线片段` : "当前筛选没有可同步的源镜头");
    return count;
  }

  function inferShotStatusFromTimelineClip(clip, currentShot) {
    return inferTimelineBackfillShotStatus(clip, currentShot);
  }

  function inferShotReviewStatusFromTimelineClip(clip, currentShot) {
    return inferTimelineBackfillReviewStatus(clip, currentShot);
  }

  function buildShotPatchFromTimelineClip(clip, currentShot, options = {}) {
    return buildTimelineBackfillPatch(clip, currentShot, options);
  }

  function patchShotsFromTimelineClips(episodeId, clipIds = [], options = {}) {
    const targets = (Array.isArray(clipIds) ? clipIds : [])
      .map((clipId) => findTimelineClipById(episodeId, clipId))
      .filter(Boolean);
    let synced = 0;
    let missingLink = 0;
    let skipped = 0;
    let comments = 0;
    const syncedClipIds = [];
    targets.forEach((clip) => {
      const linked = findShotByTimelineClip(clip);
      if (!linked?.node?.id || !linked?.shot?.id) {
        missingLink += 1;
        return;
      }
      const diff = computeTimelineBackfillDiff(clip, linked.shot, options);
      if (!diff.needsBackfill) {
        skipped += 1;
        return;
      }
      if (diff.addsComment) {
        comments += 1;
      }
      patchShotRecord(linked.node.id, linked.shot.id, diff.patch);
      synced += 1;
      syncedClipIds.push(clip.id);
    });
    if (!options.silent) {
      if (synced) {
        setProjectMessage(`已把 ${synced} 条时间线结果回写到镜头表${missingLink ? `，${missingLink} 条未关联镜头` : ""}`);
      } else if (missingLink) {
        setProjectMessage(`有 ${missingLink} 条时间线未关联镜头，暂时无法回写`);
      } else {
        setProjectMessage("当前筛选没有需要回写的镜头");
      }
    }
    return { processed: targets.length, synced, missingLink, skipped, comments, syncedClipIds, approvalOnly: Boolean(options.approvalOnly) };
  }

  function patchShotFromTimelineClip(episodeId, clipId, options = {}) {
    return patchShotsFromTimelineClips(episodeId, [clipId], options);
  }

  function prepareTimelineClipsForExport(episodeId, clipIds = [], options = {}) {
    const targets = (Array.isArray(clipIds) ? clipIds : [])
      .map((clipId) => findTimelineClipById(episodeId, clipId))
      .filter(Boolean);
    let synced = 0;
    let queued = 0;
    let blocked = 0;
    targets.forEach((clip) => {
      if (syncTimelineClipFromSource(episodeId, clip.id, { silent: true })) synced += 1;
      const latestClip = findTimelineClipById(episodeId, clip.id) || clip;
      if (!String(latestClip.mediaUrl || "").trim()) {
        if (queueGenerationForTimelineClip(latestClip, { silent: true })) queued += 1;
        else blocked += 1;
      }
    });
    const remaining = {
      media: targets.filter((clip) => !String((findTimelineClipById(episodeId, clip.id) || clip).mediaUrl || "").trim()).length,
      exportReady: targets.filter((clip) => {
        const latest = findTimelineClipById(episodeId, clip.id) || clip;
        return Boolean(String(latest.mediaUrl || "").trim()) && String(latest.approvalStatus || "待验收") === "已通过";
      }).length,
    };
    if (!options.silent) {
      setProjectMessage(
        targets.length
          ? `已推进 ${targets.length} 条时间线：同步 ${synced} · 入队 ${queued}${blocked ? ` · 阻塞 ${blocked}` : ""}`
          : "当前筛选没有可推进的时间线片段"
      );
    }
    return { processed: targets.length, synced, queued, blocked, remaining };
  }

  function getTimelineClipStatus(clip) {
    if (String(clip.mediaUrl || "").trim()) return "已挂素材";
    const linked = findShotByTimelineClip(clip);
    if (!linked?.shot) return "未关联镜头";
    return linked.shot.status || "待写";
  }

  function exportTimelineText(episodeId) {
    const episode = episodes.find((item) => item.id === episodeId);
    const timelineState = getEpisodeTimeline(timeline, episodeId, { defaultEpisodeTimeline });
    const text = formatTimelineText(episode?.name || "当前集", timelineState);
    const id = `node-${nextNodeId++}`;
    const position = {
      x: viewportCenter.x + 420,
      y: viewportCenter.y - 180,
    };
    const base = createNode("text", id, position, {
      displayName: `${episode?.name || "当前集"} 时间线`,
      text,
      width: 520,
      height: 420,
      episodeId,
    });
    setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), base]);
    setProjectMessage("已导出时间线清单到画布");
  }

  function patchPromptFactory(patch) {
    setPromptFactory((current) => normalizePromptFactoryState({ ...current, ...patch }));
  }

  function patchTemplateCenter(patch) {
    setTemplateCenter((current) => normalizeTemplateCenterState({ ...current, ...patch }));
  }

  function patchStylePresetCenter(patch) {
    setStylePresetCenter((current) => normalizeStylePresetCenterState({ ...current, ...patch }));
  }

  function patchModelParamCenter(patch) {
    setModelParamCenter((current) => normalizeModelParamCenterState({ ...current, ...patch }));
  }

  function patchCollaborationState(patch) {
    setCollaborationState((current) => normalizeCollaborationState({ ...current, ...patch }));
  }

  function patchArchiveState(patch) {
    setArchiveState((current) => normalizeArchiveState({ ...current, ...patch }));
  }

  function appendCollaborationActivity(activity) {
    setCollaborationState((current) => normalizeCollaborationState({
      ...current,
      activities: [
        {
          id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          createdAt: Date.now(),
          actor: current.activeMemberName || current.members?.[0]?.name || "导演",
          ...activity,
        },
        ...(current.activities || []),
      ].slice(0, 200),
    }));
  }

  function createArchiveSnapshot(label = "手动快照", stage = "开发中") {
    const active = buildProjectSummary(nodes, edges, episodes, activeEpisodeId, generationQueue, resources, timeline, collaborationState, archiveState, exportHistory).active || {};
    const snapshot = {
      id: `snapshot-${Date.now()}`,
      label,
      stage,
      episodeId: activeEpisodeId,
      episodeName: active.name || episodes.find((item) => item.id === activeEpisodeId)?.name || "当前集",
      createdAt: Date.now(),
      metrics: {
        nodes: active.nodes || 0,
        shots: active.shots || 0,
        resources: active.resources || 0,
        timelineClips: active.timelineClips || 0,
      },
      note: archiveState.deliveryNote || "",
      summary: `节点 ${active.nodes || 0} · 镜头 ${active.shots || 0} · 资源 ${active.resources || 0} · 时间线 ${active.timelineClips || 0}`,
      payload: projectPayload(),
    };
    setArchiveState((current) => normalizeArchiveState({
      ...current,
      snapshots: [snapshot, ...(current.snapshots || [])].slice(0, 40),
      milestoneIds: stage === "交付版" || stage === "归档"
        ? [snapshot.id, ...(current.milestoneIds || []).filter((item) => item !== snapshot.id)].slice(0, 20)
        : current.milestoneIds,
    }));
    setProjectMessage(`已创建项目快照：${label}`);
  }

  function applyStylePresetToPromptFactory(presetId) {
    const preset = findStylePresetById(stylePresetCenter, presetId);
    if (!preset) return;
    setPromptFactory((current) => normalizePromptFactoryState({
      ...current,
      stylePreset: preset.name,
      modelPreset: preset.defaultModelPreset || current.modelPreset,
    }));
    setProjectMessage(`已将风格预设应用到 Prompt 工厂：${preset.name}`);
  }

  function applyStylePresetToNovelPipelines(presetId) {
    const preset = findStylePresetById(stylePresetCenter, presetId);
    if (!preset) return;
    let hitCount = 0;
    setNodes((current) => current.map((node) => {
      if (node.type !== "novelPipeline" || (node.data?.episodeId || activeEpisodeId) !== activeEpisodeId) return node;
      hitCount += 1;
      return {
        ...node,
        data: {
          ...node.data,
          stylePreset: preset.name,
          imageStyle: preset.imageStyle || node.data?.imageStyle || "CG电影感",
        },
      };
    }));
    setProjectMessage(hitCount ? `已将 ${preset.name} 应用到当前集 ${hitCount} 个小说工厂节点` : "当前集还没有小说工厂节点");
  }

  function applyModelParamPresetToPromptFactory(presetId) {
    const preset = findModelParamPresetById(modelParamCenter, presetId);
    if (!preset) return;
    setPromptFactory((current) => normalizePromptFactoryState({
      ...current,
      parameterPresetId: preset.id,
      modelPreset: preset.modelPreset || current.modelPreset,
    }));
    setProjectMessage(`已将参数预设应用到 Prompt 工厂：${preset.name}`);
  }

  function applyModelParamPresetToShots(presetId) {
    const preset = findModelParamPresetById(modelParamCenter, presetId);
    if (!preset) return;
    let hitCount = 0;
    setNodes((current) => current.map((node) => {
      if (node.type !== "shotList" || (node.data?.episodeId || activeEpisodeId) !== activeEpisodeId) return node;
      const nextShots = (node.data.shots || []).map((shot, index) => {
        const normalized = normalizeShotRecord(shot, index);
        hitCount += 1;
        return applyShotModelParamPreset(normalized, preset);
      });
      return { ...node, data: { ...node.data, shots: nextShots } };
    }));
    setProjectMessage(hitCount ? `已将 ${preset.name} 应用到当前集 ${hitCount} 个镜头` : "当前集还没有镜头表");
  }

  async function applyModelParamPresetToAiSettings(presetId) {
    const preset = findModelParamPresetById(modelParamCenter, presetId);
    if (!preset) return;
    const nextSettings = {
      ...settings,
      customModel: preset.runtimeModel || settings.customModel,
      comfyTimeoutSeconds: preset.kind === "video"
        ? String(Math.max(parseDurationSeconds(preset.duration || "4秒") * 120, Number(settings.comfyTimeoutSeconds) || 600))
        : settings.comfyTimeoutSeconds,
    };
    setSettings(nextSettings);
    try {
      await saveBackendAiConfig(nextSettings);
      setProjectMessage(`已将参数预设写入 AI 设置：${preset.name}`);
    } catch (error) {
      setProjectMessage(`参数预设已写入界面，但保存 AI 设置失败：${String(error)}`);
    }
  }

  function applyDirectorPromptSuggestion(suggestion) {
    if (!suggestion?.nodeId || !suggestion?.shotId) return;
    setNodes((current) => current.map((node) => {
      if (node.id !== suggestion.nodeId || node.type !== "shotList") return node;
      const nextShots = (node.data.shots || []).map((shot, index) => {
        const normalized = normalizeShotRecord(shot, index);
        if (normalized.id !== suggestion.shotId) return shot;
        return {
          ...normalized,
          [suggestion.field]: suggestion.value,
        };
      });
      return { ...node, data: { ...node.data, shots: nextShots } };
    }));
    setProjectMessage(`已应用导演建议到 ${suggestion.shotId}`);
  }

  function applyDirectorShotSuggestion(suggestion) {
    if (!suggestion?.nodeId || !suggestion?.shotId || !suggestion.patch) return;
    setNodes((current) => current.map((node) => {
      if (node.id !== suggestion.nodeId || node.type !== "shotList") return node;
      const nextShots = (node.data.shots || []).map((shot, index) => {
        const normalized = normalizeShotRecord(shot, index);
        if (normalized.id !== suggestion.shotId) return shot;
        return {
          ...normalized,
          ...suggestion.patch,
        };
      });
      return { ...node, data: { ...node.data, shots: nextShots } };
    }));
    setProjectMessage(`已应用导演建议到 ${suggestion.shotId}`);
  }

  function addReviewComment(target) {
    const text = String(target?.text || "").trim();
    if (!text) {
      setProjectMessage("评注内容不能为空");
      return;
    }
    const comment = {
      id: `review-${Date.now()}`,
      author: String(target.author || collaborationState.activeMemberName || "导演").trim() || "导演",
      text,
      createdAt: Date.now(),
    };
    setNodes((current) => current.map((node) => {
      if (node.id !== target.nodeId) return node;
      if (target.shotId && node.type === "shotList") {
        const nextShots = (node.data.shots || []).map((shot, index) => {
          const normalized = normalizeShotRecord(shot, index);
          if (normalized.id !== target.shotId) return shot;
          return {
            ...normalized,
            reviewStatus: target.reviewStatus || normalized.reviewStatus || "待修改",
            reviewComments: [...(normalized.reviewComments || []), comment],
          };
        });
        return { ...node, data: { ...node.data, shots: nextShots } };
      }
      return {
        ...node,
        data: {
          ...node.data,
          reviewComments: [...(Array.isArray(node.data?.reviewComments) ? node.data.reviewComments : []), comment],
        },
      };
    }));
    appendCollaborationActivity({
      type: "comment",
      title: target.shotId ? `为 ${target.shotId} 添加评注` : "添加节点评注",
      detail: text.slice(0, 120),
      nodeId: target.nodeId,
      shotId: target.shotId || "",
      episodeId: activeEpisodeId,
    });
    setProjectMessage(target.shotId ? `已添加镜头评注：${target.shotId}` : "已添加节点评注");
  }

  function updateShotReviewStatus(target) {
    if (!target?.nodeId || !target?.shotId) return;
    setNodes((current) => current.map((node) => {
      if (node.id !== target.nodeId || node.type !== "shotList") return node;
      const nextShots = (node.data.shots || []).map((shot, index) => {
        const normalized = normalizeShotRecord(shot, index);
        return normalized.id === target.shotId ? { ...normalized, reviewStatus: target.reviewStatus } : shot;
      });
      return { ...node, data: { ...node.data, shots: nextShots } };
    }));
    appendCollaborationActivity({
      type: "review_status",
      title: `更新 ${target.shotId} 审稿状态`,
      detail: target.reviewStatus,
      nodeId: target.nodeId,
      shotId: target.shotId,
      episodeId: activeEpisodeId,
    });
    setProjectMessage(`已更新审稿状态：${target.shotId} · ${target.reviewStatus}`);
  }

  function buildShotReviewApiInput(target) {
    const episodeId = activeEpisodeIdRef.current || activeEpisodeId;
    const currentNodes = nodesRef.current || [];
    const currentEpisodes = episodesRef.current || [];
    const fallback = currentEpisodes[0]?.id || "episode-1";
    const episodeNodes = currentNodes.filter((node) => (node.data?.episodeId || fallback) === episodeId);
    const shotNode = currentNodes.find((node) => node.id === target.nodeId && node.type === "shotList");
    if (!shotNode) throw new Error("没有找到镜头表节点");
    const shots = (shotNode.data?.shots || []).map((shot, index) => normalizeShotRecord(shot, index));
    const shotIndex = shots.findIndex((shot) => shot.id === target.shotId);
    if (shotIndex < 0) throw new Error("没有找到要审稿的镜头");
    const shot = shots[shotIndex];
    const relatedTokens = dedupeOrderedStrings([
      ...(shot.assetRefs || []),
      shot.mainCharacterToken,
      shot.mainSceneToken,
      ...((shot.keyPropTokens || []).filter(Boolean)),
    ]);
    const relatedAssets = collectGlobalAssets(episodeNodes).items
      .filter((asset) => relatedTokens.length ? relatedTokens.includes(asset.token) : true)
      .slice(0, 8)
      .map((asset) => ({
        token: asset.token,
        name: asset.name,
        kind: asset.kind,
        visualLock: asset.visualLock || "",
        continuityRule: asset.continuityRule || "",
        prompt: asset.prompt || "",
      }));
    const novelNode = episodeNodes.find((node) => node.type === "novelPipeline");
    return JSON.stringify({
      episodeName: currentEpisodes.find((item) => item.id === episodeId)?.name || "当前集",
      reviewGoal: "判断这个镜头是否已经可以继续进入生图、视频和时间线交付",
      scriptContext: String(novelNode?.data?.revisedScript || novelNode?.data?.script || "").slice(0, 4000),
      previousShot: shotIndex > 0 ? shots[shotIndex - 1] : null,
      currentShot: shot,
      nextShot: shotIndex < shots.length - 1 ? shots[shotIndex + 1] : null,
      localQuality: buildShotQualityReport(shot),
      relatedAssets,
      existingComments: (shot.reviewComments || []).map((item) => ({
        author: item.author || "导演",
        text: item.text || "",
      })),
    }, null, 2);
  }

  function buildTimelineClipReviewApiInput(clip) {
    const episodeId = activeEpisodeIdRef.current || activeEpisodeId;
    const currentNodes = nodesRef.current || [];
    const currentEpisodes = episodesRef.current || [];
    const episode = currentEpisodes.find((item) => item.id === episodeId) || currentEpisodes[0] || { name: "当前集" };
    const linked = findShotByTimelineClip(clip);
    const shot = linked?.shot ? normalizeShotRecord(linked.shot) : null;
    const relatedTokens = shot ? dedupeOrderedStrings([
      ...(shot.assetRefs || []),
      shot.mainCharacterToken,
      shot.mainSceneToken,
      ...((shot.keyPropTokens || []).filter(Boolean)),
    ]).filter(Boolean) : [];
    const relatedAssets = collectGlobalAssets(currentNodes).items
      .filter((asset) => relatedTokens.length ? relatedTokens.includes(asset.token) : false)
      .slice(0, 8)
      .map((asset) => ({
        token: asset.token,
        name: asset.name,
        kind: asset.kind,
        visualLock: asset.visualLock || "",
        continuityRule: asset.continuityRule || "",
      }));
    const clipChecklist = {
      hasMedia: Boolean(String(clip?.mediaUrl || "").trim()),
    };
    return JSON.stringify({
      episodeName: episode.name || "当前集",
      reviewGoal: "判断当前时间线片段是否已经可以进入成片导出，若不行请明确给出通过/退回和修改建议。",
      currentClip: {
        id: clip.id,
        shotId: clip.shotId || "",
        title: clip.title || "",
        scene: clip.scene || "",
        duration: clip.duration || "",
        transition: clip.transition || "",
        mediaUrl: clip.mediaUrl || "",
        mediaType: clip.mediaType || "",
        approvalStatus: clip.approvalStatus || "待验收",
        approvalNote: clip.approvalNote || "",
        note: clip.note || "",
      },
      checklist: clipChecklist,
      linkedShot: shot,
      linkedShotQuality: shot ? buildShotQualityReport(shot) : null,
      relatedAssets,
      approvalRule: {
        pass: "素材、节奏和连续性都已达标，可直接进入导出。",
        reject: "存在明显素材问题、连续性问题、节奏问题或审稿未闭环问题。",
      },
    }, null, 2);
  }

  function inferApiReviewStatus(review) {
    const score = Number(review?.score || 0);
    const failed = String(review?.status || "").toLowerCase() === "failed";
    const mustFix = (review?.issues || []).some((item) => /必须|严重|阻塞/.test(`${item.level || ""} ${item.problem || ""}`));
    const blockers = Array.isArray(review?.productionBlockers) && review.productionBlockers.length > 0;
    return failed || mustFix || blockers || (score > 0 && score < 75) ? "待修改" : "已通过";
  }

  function inferTimelineApprovalStatus(review) {
    const explicit = String(review?.approvalStatus || "").trim();
    if (["已通过", "退回修改", "待验收"].includes(explicit)) return explicit;
    const score = Number(review?.score || 0);
    const failed = String(review?.status || "").toLowerCase() === "failed";
    const mustFix = (review?.issues || []).some((item) => /必须|严重|阻塞|退回/.test(`${item.level || ""} ${item.problem || ""}`));
    return failed || mustFix || (score > 0 && score < 80) ? "退回修改" : "已通过";
  }

  function formatTimelineApprovalNote(review) {
    const head = [
      `时间线验收 · 总分 ${review?.score || "未给分"} · ${review?.status || "未判定"}`,
      review?.summary || "",
      review?.nextAction ? `下一步：${review.nextAction}` : "",
    ].filter(Boolean);
    const issues = (review?.issues || []).slice(0, 4).map((item, index) => `${index + 1}. 【${item.level || "建议"}】${item.target || "当前片段"}：${item.problem || ""}${item.suggestion ? `；建议：${item.suggestion}` : ""}`);
    return [...head, ...issues].join("\n");
  }

  function formatApiReviewComment(review) {
    const lines = [
      `API审稿 · 总分 ${review?.score || "未给分"} · ${review?.status || "未判定"}`,
      review?.summary || "",
    ].filter(Boolean);
    (review?.issues || []).slice(0, 6).forEach((item, index) => {
      lines.push(`${index + 1}. 【${item.level || "建议"}】${item.target || "当前镜头"}：${item.problem || ""}${item.suggestion ? `；建议：${item.suggestion}` : ""}`);
    });
    if (review?.revisionInstruction) lines.push(`修订指令：${review.revisionInstruction}`);
    return lines.join("\n");
  }

  function buildShotRevisionApiInput(target, review) {
    const episodeId = activeEpisodeIdRef.current || activeEpisodeId;
    const currentNodes = nodesRef.current || [];
    const currentEpisodes = episodesRef.current || [];
    const fallback = currentEpisodes[0]?.id || "episode-1";
    const episodeNodes = currentNodes.filter((node) => (node.data?.episodeId || fallback) === episodeId);
    const sourceNode = currentNodes.find((node) => node.id === target.nodeId && node.type === "shotList");
    if (!sourceNode) throw new Error("没有找到镜头表节点");
    const shots = (sourceNode.data?.shots || []).map((shot, index) => normalizeShotRecord(shot, index));
    const shotIndex = shots.findIndex((shot) => shot.id === target.shotId);
    if (shotIndex < 0) throw new Error("没有找到需要自动修改的镜头");
    const shot = shots[shotIndex];
    const currentResourceIndex = buildProjectResourceIndex(resourcesRef.current || [], currentNodes, currentEpisodes, episodeId, { nodeTypeLabel });
    const resourcesForEpisode = (currentResourceIndex.items || [])
      .filter((item) => !item.episodeId || item.episodeId === episodeId)
      .slice(0, 20)
      .map((item) => ({ token: item.token, name: item.name, kind: item.kind, note: item.note || "" }));
    const relatedTokens = dedupeOrderedStrings([
      ...(shot.assetRefs || []),
      shot.mainCharacterToken,
      shot.mainSceneToken,
      ...((shot.keyPropTokens || []).filter(Boolean)),
    ]);
    const relatedAssets = collectGlobalAssets(episodeNodes).items
      .filter((asset) => relatedTokens.length ? relatedTokens.includes(asset.token) : true)
      .slice(0, 10)
      .map((asset) => ({
        token: asset.token,
        name: asset.name,
        kind: asset.kind,
        prompt: asset.prompt || "",
        visualLock: asset.visualLock || "",
        continuityRule: asset.continuityRule || "",
        referenceResources: asset.referenceResources || "",
      }));
    return JSON.stringify({
      goal: "根据审稿意见直接修改当前镜头，并让修改后的结果可继续进入生图、视频和时间线交付",
      currentShot: shot,
      previousShot: shotIndex > 0 ? shots[shotIndex - 1] : null,
      nextShot: shotIndex < shots.length - 1 ? shots[shotIndex + 1] : null,
      review,
      relatedAssets,
      resources: resourcesForEpisode,
      defaultQualityPatch: buildShotQualityPatch(shot),
    }, null, 2);
  }

  function buildShotRevisionTemplate() {
    return [
      "你是商业级漫剧镜头修订导演。",
      "请严格根据给定 review 的 revisionInstruction、issues、productionBlockers 直接修改当前镜头。",
      "",
      "【修订原则】",
      "1. 只能修当前镜头，不要重写整集。",
      "2. 必须优先处理 must fix / blocker / 待修改项。",
      "3. 输出 patch 时优先保证：叙事清晰、主体唯一、资产锁定、动作可执行、图片/视频提示词可直接生成。",
      "4. 如果主角色、主场景、关键道具需要调整，必须同步更新 mainCharacterToken、mainSceneToken、keyPropTokens、assetRefs。",
      "5. imagePrompt 和 videoPrompt 要按生产可执行口径重写，不能空泛。",
      "6. 如果 referenceResources 需要更新，也要一并返回。",
      "7. changeLog、fixedIssues、assetRefreshPlan 要明确写出这次修了什么，以及后续哪些数据需要跟进刷新。",
      "",
      "【输出要求】",
      "1. 严格按 JSON Schema 输出。",
      "2. patch 只返回有价值的最终字段，不要返回解释文字。",
      "3. 如果某字段无需修改，可不返回；但 imagePrompt、videoPrompt、mainFocus、openingFrame、continuityNote、riskControl 尽量返回完整版本。",
    ].join("\n");
  }

  function normalizeShotRevisionPatch(shot, patch) {
    const merged = normalizeShotRecord({
      ...shot,
      ...(patch && typeof patch === "object" ? patch : {}),
    });
    const qualityPatch = buildShotQualityPatch(merged);
    const nextImagePrompt = String(
      patch?.imagePrompt
      || merged.imagePrompt
      || buildImageShotPrompt({ ...merged, ...qualityPatch }, assetIndex, resourceIndex)
      || "",
    );
    const nextVideoPrompt = String(
      patch?.videoPrompt
      || merged.videoPrompt
      || buildVideoShotPrompt({ ...merged, ...qualityPatch }, assetIndex, resourceIndex)
      || "",
    );
    return {
      ...patch,
      shotType: String(patch?.shotType || merged.shotType || qualityPatch.shotType || ""),
      mainCharacterToken: String(patch?.mainCharacterToken || merged.mainCharacterToken || ""),
      mainSceneToken: String(patch?.mainSceneToken || merged.mainSceneToken || ""),
      keyPropTokens: Array.isArray(patch?.keyPropTokens) ? patch.keyPropTokens.filter(Boolean) : merged.keyPropTokens || [],
      assetRefs: Array.isArray(patch?.assetRefs) ? dedupeOrderedStrings(patch.assetRefs.filter(Boolean)) : merged.assetRefs || [],
      referenceResources: String(patch?.referenceResources || merged.referenceResources || ""),
      mainFocus: String(patch?.mainFocus || merged.mainFocus || qualityPatch.mainFocus || ""),
      frameIntent: String(patch?.frameIntent || merged.frameIntent || qualityPatch.frameIntent || ""),
      openingFrame: String(patch?.openingFrame || merged.openingFrame || qualityPatch.openingFrame || ""),
      closingFrame: String(patch?.closingFrame || merged.closingFrame || qualityPatch.closingFrame || ""),
      continuityNote: String(patch?.continuityNote || merged.continuityNote || qualityPatch.continuityNote || ""),
      riskControl: String(patch?.riskControl || merged.riskControl || qualityPatch.riskControl || ""),
      negativePrompt: String(patch?.negativePrompt || merged.negativePrompt || qualityPatch.negativePrompt || ""),
      imagePrompt: nextImagePrompt,
      videoPrompt: nextVideoPrompt,
      reviewStatus: "待修改",
    };
  }

  function refreshEpisodeAssetsFromShot(target, shot, revision) {
    const currentEpisodes = episodesRef.current || [];
    const fallback = currentEpisodes[0]?.id || "episode-1";
    const episodeId = activeEpisodeIdRef.current || activeEpisodeId;
    const currentNodes = nodesRef.current || [];
    return refreshAssetsFromRevision(target, shot, revision, {
      dedupeOrderedStrings,
      collectShotTouchedTokens: (currentShot) => collectShotTouchedTokens(currentShot, { dedupeOrderedStrings }),
      parseAssetTokenCategory,
      patchAssetRecord: (token, category, patch) => {
        let changed = false;
        currentNodes.forEach((node) => {
          if (node.type !== "assetLibrary" || (node.data?.episodeId || fallback) !== episodeId) return;
          if (patchAssetRecord(node.id, token, category, patch)) changed = true;
        });
        return changed;
      },
    });
  }

  function executeShotRefreshPlan(target, options = {}) {
    const result = executeShotRefreshPlanAction(target, {
      ...options,
      dedupeOrderedStrings,
      inferShotRefreshPlanFromPatch,
      episodeId: activeEpisodeId,
      getShotByTarget: ({ nodeId, shotId }) => {
        const sourceNode = nodeByIdRef.current.get(nodeId);
        return (sourceNode?.data?.shots || []).map((item, index) => normalizeShotRecord(item, index)).find((item) => item.id === shotId) || null;
      },
      collectShotTouchedTokens: (currentShot) => collectShotTouchedTokens(currentShot, { dedupeOrderedStrings }),
      patchAssetRecordForShotTokens: (tokens, shot) => {
        const currentEpisodes = episodesRef.current || [];
        const fallback = currentEpisodes[0]?.id || "episode-1";
        const episodeId = activeEpisodeIdRef.current || activeEpisodeId;
        const currentNodes = nodesRef.current || [];
        let count = 0;
        currentNodes.forEach((node) => {
          if (node.type !== "assetLibrary" || (node.data?.episodeId || fallback) !== episodeId) return;
          tokens.forEach((token) => {
            const category = parseAssetTokenCategory(token);
            if (!category) return;
            const changed = patchAssetRecord(node.id, token, category, {
              evidenceSource: buildAssetRefreshEvidence(shot, target, { dedupeOrderedStrings }),
            });
            if (changed) count += 1;
          });
        });
        return count;
      },
      rebuildShotPrompts: (shot) => {
        const patch = buildShotQualityPatch(shot);
        const nextPatch = {
          ...patch,
          imagePrompt: buildImageShotPrompt({ ...shot, ...patch }, assetIndex, resourceIndex),
          videoPrompt: buildVideoShotPrompt({ ...shot, ...patch }, assetIndex, resourceIndex),
        };
        return patchShotRecord(target.nodeId, target.shotId, nextPatch) ? 1 : 0;
      },
      buildShotQualityReport,
      syncTimelineFromShot: (currentTarget, currentShot) => {
        let timelineUpdated = 0;
        upsertTimelineClipFromShot(currentTarget.nodeId, currentShot, { silent: true });
        timelineUpdated += 1;
        return { timelineUpdated };
      },
      patchShotRecord,
      appendCollaborationActivity,
    });
    setProjectMessage(`已执行刷新计划：${target.shotId} · 资产 ${result.assetCount} · 提示词 ${result.promptUpdated} · 时间线 ${result.timelineUpdated}`);
    return result;
  }

  async function autoReviseShotFromReview(target, review, options = {}) {
    const result = await autoReviseShotFromReviewAction(target, review, {
      ...options,
      episodeId: activeEpisodeId,
      getShotByTarget: ({ nodeId, shotId }) => {
        const sourceNode = nodeByIdRef.current.get(nodeId);
        return (sourceNode?.data?.shots || []).map((item, index) => normalizeShotRecord(item, index)).find((item) => item.id === shotId) || null;
      },
      runRevision: (currentTarget, currentReview) => runNovelFactoryApi(
        buildHealthFixApiConfig(buildShotRevisionApiInput(currentTarget, currentReview), buildShotRevisionTemplate(), SHOT_REVISION_SCHEMA),
        parseShotRevisionOutput,
      ),
      normalizeShotRevisionPatch,
      inferShotRefreshPlanFromPatch,
      patchShotRecord,
      normalizeShotRecord,
      upsertTimelineClipFromShot,
      refreshAssetsFromRevision: (currentTarget, revisedShot, revision) => refreshEpisodeAssetsFromShot(currentTarget, revisedShot, revision),
      appendCollaborationActivity,
      runFinalReview: (currentTarget) => runApiReviewForShot(currentTarget, { silent: true }),
    });
    setProjectMessage(options.skipFinalReview ? `已按审稿意见自动修改：${target.shotId}` : `已按审稿意见自动修改并复审：${target.shotId}`);
    return result;
  }

  function applyApiReviewResults(results) {
    if (!Array.isArray(results) || !results.length) return;
    const resultMap = new Map(results.map((item) => [`${item.nodeId}:${item.shotId}`, item]));
    setNodes((current) => current.map((node) => {
      if (node.type !== "shotList") return node;
      let changed = false;
      const nextShots = (node.data?.shots || []).map((shot, index) => {
        const normalized = normalizeShotRecord(shot, index);
        const hit = resultMap.get(`${node.id}:${normalized.id}`);
        if (!hit) return shot;
        changed = true;
        return {
          ...normalized,
          reviewStatus: hit.reviewStatus,
          reviewComments: [...(normalized.reviewComments || []), hit.comment],
        };
      });
      return changed ? { ...node, data: { ...node.data, shots: nextShots } } : node;
    }));
  }

  async function runApiReviewForShot(target, options = {}) {
    if (!target?.nodeId || !target?.shotId) throw new Error("请选择一个镜头后再审稿");
    const currentSettings = textApiSettingsRef.current || {};
    if ((currentSettings.factoryMode || "local") !== "api") {
      throw new Error("请先在 API 控制台把文本 API 切到“启用 API”");
    }
    if (!String(currentSettings.apiKey || "").trim()) {
      throw new Error("请先在 API 控制台填写文本 API Key");
    }
    if (!options.silent) setProjectMessage(`正在 API 审稿：${target.shotId}`);
    const review = await runNovelFactoryApi(
      buildHealthFixApiConfig(buildShotReviewApiInput(target), SHOT_REVIEW_TEMPLATE_DEFAULT, NOVEL_REVIEW_SCHEMA),
      parseNovelReviewOutput,
    );
    const comment = {
      id: `review-api-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      author: "API审稿",
      text: formatApiReviewComment(review),
      createdAt: Date.now(),
    };
    const reviewStatus = inferApiReviewStatus(review);
    applyApiReviewResults([{ nodeId: target.nodeId, shotId: target.shotId, reviewStatus, comment }]);
    appendCollaborationActivity({
      type: "review_api",
      title: `API 审稿 ${target.shotId}`,
      detail: `${reviewStatus} · ${review.summary || "已回填审稿意见"}`.slice(0, 120),
      nodeId: target.nodeId,
      shotId: target.shotId,
      episodeId: activeEpisodeId,
    });
    if (!options.silent) setProjectMessage(`API 审稿完成：${target.shotId} · ${reviewStatus}`);
    return review;
  }

  async function runApiReviewForEpisode() {
    const targets = reviewBoardReport.targets.filter((item) => item.shotId && !["已通过", "搁置"].includes(item.reviewStatus || "未审"));
    if (!targets.length) {
      setProjectMessage("当前集没有需要继续 API 审稿的镜头");
      return { reviewed: 0, pendingFix: 0, passed: reviewBoardReport.summary.passed };
    }
    const results = [];
    for (let index = 0; index < targets.length; index += 1) {
      const target = targets[index];
      setProjectMessage(`批量 API 审稿中 ${index + 1}/${targets.length} · ${target.shotId}`);
      const review = await runNovelFactoryApi(
        buildHealthFixApiConfig(buildShotReviewApiInput(target), SHOT_REVIEW_TEMPLATE_DEFAULT, NOVEL_REVIEW_SCHEMA),
        parseNovelReviewOutput,
      );
      results.push({
        nodeId: target.nodeId,
        shotId: target.shotId,
        reviewStatus: inferApiReviewStatus(review),
        comment: {
          id: `review-api-${Date.now()}-${index}`,
          author: "API审稿",
          text: formatApiReviewComment(review),
          createdAt: Date.now() + index,
        },
      });
    }
    applyApiReviewResults(results);
    appendCollaborationActivity({
      type: "review_api_batch",
      title: "批量 API 审稿当前集",
      detail: `共处理 ${results.length} 个镜头`,
      episodeId: activeEpisodeId,
    });
    const pendingFix = results.filter((item) => item.reviewStatus === "待修改").length;
    const passed = results.filter((item) => item.reviewStatus === "已通过").length;
    setProjectMessage(`批量 API 审稿完成：${results.length} 个镜头，待修改 ${pendingFix} 个，已通过 ${passed} 个`);
    return { reviewed: results.length, pendingFix, passed };
  }

  async function runApiReviewAndReviseShot(target) {
    const review = await runApiReviewForShot(target, { silent: true });
    const reviewStatus = inferApiReviewStatus(review);
    if (reviewStatus === "已通过") {
      setProjectMessage(`当前镜头已通过审稿，无需自动修改：${target.shotId}`);
      return { review, revised: false };
    }
    const result = await autoReviseShotFromReview(target, review);
    return { ...result, revised: true };
  }

  async function runApiReviewAndReviseEpisode() {
    const targets = collectReviewableTargets(reviewBoardReport);
    if (!targets.length) {
      setProjectMessage("当前集没有需要自动修改的镜头");
      return { reviewed: 0, revised: 0, passed: reviewBoardReport.summary.passed };
    }
    const result = await runBatchReviewAndRevise(targets, {
      onProgress: ({ index, total, target }) => {
        setProjectMessage(`审稿并自动修改中 ${index + 1}/${total} · ${target.shotId}`);
      },
      runReview: (target) => runApiReviewForShot(target, { silent: true }),
      inferReviewStatus: inferApiReviewStatus,
      runRevise: (target, review) => autoReviseShotFromReview(target, review, { skipFinalReview: false }),
      getRefreshedReport: () => buildReviewBoardReport(nodesRef.current || [], episodesRef.current || [], activeEpisodeIdRef.current || activeEpisodeId),
    });
    setProjectMessage(`审稿自动修改完成：已审 ${result.reviewed} 个，已改 ${result.revised} 个，待修改 ${result.pendingFix || 0} 个`);
    return {
      reviewed: result.reviewed,
      revised: result.revised,
      pendingFix: result.pendingFix || 0,
      passed: result.passed || 0,
    };
  }

  async function runShotRefreshPlan(target) {
    return executeShotRefreshPlan(target);
  }

  async function runEpisodeRefreshPlans() {
    const targets = reviewBoardReport.targets.filter((item) => item.shotId);
    const result = await runBatchRefreshPlans(targets, {
      getShotForTarget: (target) => {
        const sourceNode = nodeByIdRef.current.get(target.nodeId);
        return (sourceNode?.data?.shots || []).map((item, shotIndex) => normalizeShotRecord(item, shotIndex)).find((item) => item.id === target.shotId);
      },
      onProgress: ({ handled, target }) => {
        setProjectMessage(`执行刷新计划中 ${handled} · ${target.shotId}`);
      },
      executePlan: (target) => executeShotRefreshPlan(target),
    });
    setProjectMessage(`批量刷新计划完成：镜头 ${result.handled} 个，资产 ${result.assetCount}，提示词 ${result.promptUpdated}，时间线 ${result.timelineUpdated}`);
    return result;
  }

  async function runEpisodeReviewClosure() {
    const pendingTargets = collectReviewableTargets(reviewBoardReport);
    const reviewResult = await runApiReviewAndReviseEpisode();
    const refreshResult = await runEpisodeRefreshPlans();
    const refreshed = buildReviewBoardReport(nodesRef.current || [], episodesRef.current || [], activeEpisodeIdRef.current || activeEpisodeId);
    const summary = buildReviewClosureSummary(pendingTargets, reviewResult, refreshResult, refreshed);
    setProjectMessage(`审稿闭环完成：已审 ${summary.reviewed} 个，已改 ${summary.revised} 个，已刷 ${summary.refreshHandled} 个，剩余待审 ${summary.unreviewed}，待修改 ${summary.pendingFix}`);
    return summary;
  }

  async function runEpisodePendingReviewBatch() {
    const targets = collectReviewableTargets(reviewBoardReport);
    if (!targets.length) {
      setProjectMessage("当前集没有待继续审稿的镜头");
      return { reviewed: 0, pendingFix: 0, passed: reviewBoardReport.summary.passed || 0, reviewedShots: [] };
    }
    const result = await runApiReviewForEpisode();
    return buildPendingReviewBatchSummary(targets, result, reviewBoardReport.summary.passed || 0);
  }

  async function runEpisodePendingRefreshBatch() {
    return runEpisodeRefreshPlans();
  }

  async function runApiReviewForTimelineClip(clipId, options = {}) {
    const episodeId = activeEpisodeIdRef.current || activeEpisodeId;
    const currentSettings = textApiSettingsRef.current || {};
    if ((currentSettings.factoryMode || "local") !== "api") {
      throw new Error("请先在 API 控制台把文本 API 切到“启用 API”");
    }
    if (!String(currentSettings.apiKey || "").trim()) {
      throw new Error("请先在 API 控制台填写文本 API Key");
    }
    const clip = findTimelineClipById(episodeId, clipId);
    if (!clip) throw new Error("没有找到要验收的时间线片段");
    if (!options.silent) setProjectMessage(`正在 API 验收时间线：${clip.title || clip.shotId || clip.id}`);
    const review = await runNovelFactoryApi(
      buildHealthFixApiConfig(buildTimelineClipReviewApiInput(clip), SHOT_REVIEW_TEMPLATE_DEFAULT, TIMELINE_CLIP_REVIEW_SCHEMA),
      parseTimelineClipReviewOutput,
    );
    const approvalStatus = inferTimelineApprovalStatus(review);
    const approvalNote = String(review?.approvalNote || "").trim() || formatTimelineApprovalNote(review);
    patchTimelineClip(episodeId, clipId, {
      approvalStatus,
      approvalNote,
    });
    const backfill = patchShotFromTimelineClip(episodeId, clipId, { silent: true, approvalOnly: false });
    if (!options.silent) setProjectMessage(`时间线验收完成：${clip.title || clip.shotId || clip.id} · ${approvalStatus}`);
    return {
      clipId,
      title: clip.title || clip.shotId || clip.id,
      shotId: clip.shotId || "",
      approvalStatus,
      approvalNote,
      review,
      backfill,
    };
  }

  async function runEpisodePendingTimelineApprovalBatch() {
    const episodeId = activeEpisodeIdRef.current || activeEpisodeId;
    const episodeTimeline = getEpisodeTimeline(timelineRef.current, episodeId, { defaultEpisodeTimeline });
    const targets = (episodeTimeline.clips || []).filter((clip) => String(clip.approvalStatus || "待验收") === "待验收");
    if (!targets.length) {
      setProjectMessage("当前集没有待验收的时间线片段");
      return { reviewed: 0, passed: 0, rejected: 0, backfilled: 0, clips: [] };
    }
    const results = await runBatchTimelineApprovals(targets, {
      onProgress: ({ index, total, clip }) => {
        setProjectMessage(`时间线 API 验收中 ${index + 1}/${total} · ${clip.title || clip.shotId || clip.id}`);
      },
      runApproval: (clip) => runApiReviewForTimelineClip(clip.id, { silent: true }),
    });
    const summary = summarizeTimelineApprovalBatch(results);
    setProjectMessage(`时间线批量验收完成：已审 ${summary.reviewed} 条，已通过 ${summary.passed} 条，退回 ${summary.rejected} 条`);
    return summary;
  }

  async function repairRejectedTimelineClip(clipId, options = {}) {
    const episodeId = activeEpisodeIdRef.current || activeEpisodeId;
    const result = await repairRejectedTimelineClipAction(clipId, {
      dedupeOrderedStrings,
      findTimelineClipById: (currentClipId) => findTimelineClipById(episodeId, currentClipId),
      patchTimelineClip: (currentClipId, patch) => patchTimelineClip(episodeId, currentClipId, patch),
      queueGenerationForTimelineClip,
      findShotByTimelineClip,
      patchShotRecord,
      patchShotFromTimelineClip: (currentClipId, innerOptions) => patchShotFromTimelineClip(episodeId, currentClipId, innerOptions),
    });
    if (!options.silent) {
      const summary = [`自动修复：${result.actions.join(" / ") || "无动作"}`];
      if (result.queued) summary.push(`重入队 ${result.queued}`);
      if (result.shot) summary.push(`回送镜头 ${result.shot}`);
      setProjectMessage(`已修复退回片段：${result.title} · ${summary.join(" · ")}`);
    }
    return result;
  }

  async function runEpisodeRejectedTimelineRepairBatch() {
    const episodeId = activeEpisodeIdRef.current || activeEpisodeId;
    const episodeTimeline = getEpisodeTimeline(timelineRef.current, episodeId, { defaultEpisodeTimeline });
    return runRejectedTimelineRepairBatchAction({
      episodeTimeline,
      setProjectMessage,
      runRepair: (clip) => repairRejectedTimelineClip(clip.id, { silent: true }),
    });
  }

  async function runEpisodeTimelineBackfillBatch(options = {}) {
    const episodeId = activeEpisodeIdRef.current || activeEpisodeId;
    const episodeTimeline = getEpisodeTimeline(timelineRef.current, episodeId, { defaultEpisodeTimeline });
    const clipIds = (episodeTimeline.clips || []).map((clip) => clip.id);
    if (!clipIds.length) {
      if (!options.silent) setProjectMessage("当前集还没有时间线片段可回写");
      return { processed: 0, synced: 0, skipped: 0, missingLink: 0, comments: 0, clips: [] };
    }
    const result = patchShotsFromTimelineClips(episodeId, clipIds, { ...options, silent: true });
    if (!options.silent) {
      setProjectMessage(
        result.synced
          ? `已把 ${result.synced} 条时间线结果回写到镜头表${result.missingLink ? `，${result.missingLink} 条未关联` : ""}`
          : result.missingLink
            ? `有 ${result.missingLink} 条时间线未关联镜头，暂时无法回写`
            : "当前集时间线与镜头表已经是最新同步状态"
      );
    }
    return buildTimelineBackfillBatchSummary(episodeTimeline.clips || [], result);
  }

  async function runEpisodeMissingMediaBatch() {
    const episodeId = activeEpisodeIdRef.current || activeEpisodeId;
    const episodeTimeline = getEpisodeTimeline(timelineRef.current, episodeId, { defaultEpisodeTimeline });
    return runMissingMediaBatchAction({
      episodeTimeline,
      queueGenerationForTimelineClip,
      setShowQueue,
      setProjectMessage,
    });
  }

  async function runEpisodeFailedExportBatch() {
    const episodeId = activeEpisodeIdRef.current || activeEpisodeId;
    const failed = normalizeExportHistoryState(exportHistory).filter((item) => item.status === "failed" && (!item.episodeId || item.episodeId === episodeId));
    if (!failed.length) {
      setProjectMessage("当前集没有失败导出需要重跑");
      return { retried: 0, target: (episodesRef.current || []).find((item) => item.id === episodeId)?.name || "当前集" };
    }
    retryExportJobs("failed");
    return buildFailedExportRetrySummary(failed, (episodesRef.current || []).find((item) => item.id === episodeId)?.name || "当前集");
  }

  async function runEpisodeTimelineClosure() {
    const episodeId = activeEpisodeIdRef.current || activeEpisodeId;
    let imported = 0;
    let importedSources = [];
    const episodeTimeline = getEpisodeTimeline(timelineRef.current, episodeId, { defaultEpisodeTimeline });
    if (!(episodeTimeline.clips || []).length) {
      const resourceIndexForEpisode = buildProjectResourceIndex(resourcesRef.current || [], nodesRef.current || [], episodesRef.current || [], episodeId, { nodeTypeLabel });
      const sources = buildEpisodeTimelineSources(nodesRef.current || [], episodeId, resourceIndexForEpisode, {
        normalizeShotRecord,
        pickTimelineResultUrl,
        expandResourceReferences,
      });
      if (sources.length) {
        importShotsToTimelineByEpisode(episodeId, sources, { silent: true });
        imported = sources.length;
        importedSources = sources;
      }
    }
    const latestTimeline = getEpisodeTimeline(timelineRef.current, episodeId, { defaultEpisodeTimeline });
    const clipIds = (latestTimeline.clips || []).map((clip) => clip.id);
    const prepare = prepareTimelineClipsForExport(episodeId, clipIds, { silent: true });
    const backfill = await runEpisodeTimelineBackfillBatch({ silent: true });
    const summary = buildTimelineClosureSummary({
      imported,
      importedSources,
      episodeTimeline: latestTimeline,
      prepare,
      backfill,
    });
    setProjectMessage(`时间线顺推完成：导入 ${summary.imported} 条，同步 ${summary.synced} 条，回写 ${summary.backfilled} 条，入队 ${summary.queued} 条`);
    return summary;
  }

  async function runEpisodeToTimelineDeliverable() {
    const reviewClosure = await runEpisodeReviewClosure();
    const timelineClosure = await runEpisodeTimelineClosure();
    return {
      ...reviewClosure,
      ...timelineClosure,
    };
  }

  async function runEpisodeToExportDeliverable() {
    const episodeId = activeEpisodeIdRef.current || activeEpisodeId;
    const pipelineResult = await runEpisodeToTimelineDeliverable();
    const approvalResult = await runEpisodePendingTimelineApprovalBatch();
    const refreshedSummary = buildProjectSummary(
      nodesRef.current || [],
      edges,
      episodesRef.current || [],
      episodeId,
      generationQueue,
      resourcesRef.current || [],
      timelineRef.current || defaultTimelineState(),
      collaborationState,
      archiveState,
      exportHistory,
    );
    const active = refreshedSummary.active || {};
    if (!active.exportReady) {
      setProjectMessage(`当前集还没达到导出门槛：剩余待素材 ${pipelineResult.remaining?.media || 0}`);
      return buildExportDeliverableResult({
        pipelineResult,
        approvalResult,
        exportReady: false,
        queuedRenders: 0,
        queuedRenderLabels: [],
      });
    }
    const episode = (episodesRef.current || []).find((item) => item.id === episodeId);
    const episodeTimeline = getEpisodeTimeline(timelineRef.current, episodeId, { defaultEpisodeTimeline });
    const resourceIndexForEpisode = buildProjectResourceIndex(resourcesRef.current || [], nodesRef.current || [], episodesRef.current || [], episodeId, { nodeTypeLabel });
    let queuedRenders = 0;
    const queuedRenderLabels = [];
    queueEpisodeRender(episode, episodeTimeline, resourceIndexForEpisode, { aspectRatio: "16:9" });
    queuedRenders += 1;
    queuedRenderLabels.push("横版 MP4");
    queueEpisodeRender(episode, episodeTimeline, resourceIndexForEpisode, { aspectRatio: "9:16" });
    queuedRenders += 1;
    queuedRenderLabels.push("竖版 MP4");
    const exportBundle = buildEpisodeExportBundle(episode, episodeTimeline, buildPromptFactoryShotSources(nodesRef.current || [], episodeId), resourceIndexForEpisode, {
      defaultEpisodeTimeline,
      formatTimelineText,
      buildPublishingPlan,
      normalizeShotRecord,
      buildShotQualityReport,
      extractAssetTokens,
      buildProjectArchiveBundle,
      parseDurationSeconds,
      safeFileName,
    });
    setProjectMessage(`已推进到可导出并入队 ${queuedRenders} 个成片版本`);
    return buildExportDeliverableResult({
      pipelineResult,
      approvalResult,
      exportReady: true,
      queuedRenders,
      queuedRenderLabels,
    });
  }

  function applyTemplateCenterTemplate(templateId) {
    const template = (templateCenter.templates || []).find((item) => item.id === templateId);
    if (!template) {
      setProjectMessage("没有找到要应用的模板");
      return;
    }
    if (template.category === "prompt") {
      setPromptFactory((current) => normalizePromptFactoryState({
        ...current,
        templates: {
          ...(current.templates || {}),
          [template.metaKey || "image_shot"]: template.content,
        },
      }));
      setProjectMessage(`已应用 Prompt 模板：${template.name}`);
      return;
    }
    setNodes((current) => current.map((node) => {
      if ((node.data?.episodeId || activeEpisodeId) !== activeEpisodeId) return node;
      if (node.type !== "novelPipeline") return node;
      const patch = template.category === "script" ? { scriptTemplate: template.content, template: template.content }
        : template.category === "review" ? { reviewTemplate: template.content }
        : template.category === "asset" ? { assetTemplate: template.content }
        : template.category === "storyboard" ? { promptTemplate: template.content }
        : {};
      return Object.keys(patch).length ? { ...node, data: { ...node.data, ...patch } } : node;
    }));
    setProjectMessage(`已应用模板：${template.name}`);
  }

  function exportTemplateCenterTemplate(templateId) {
    const template = (templateCenter.templates || []).find((item) => item.id === templateId);
    if (!template) return;
    const id = `node-${nextNodeId++}`;
    const base = createNode("text", id, { x: viewportCenter.x + 460, y: viewportCenter.y - 180 }, {
      displayName: `${template.name} 模板`,
      text: `# ${template.name}\n\n分类：${templateCategoryLabel(template.category)}\n\n${template.content}`,
      width: 560,
      height: 420,
      episodeId: activeEpisodeId,
    });
    setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), base]);
    setProjectMessage(`已导出模板：${template.name}`);
  }

  async function saveExportArtifact(fileName, extension, content) {
    return saveExportArtifactAction({
      fileName,
      extension,
      content,
      isRuntimeAvailable: isTauriRuntime,
      saveExportFile: invokeSaveExportFile,
      createBrowserTextDownload,
      appendExportHistory,
      setProjectMessage,
      activeEpisodeId,
      episodeName: episodes.find((item) => item.id === activeEpisodeId)?.name || "当前集",
    });
  }

  async function saveDeliveryPackageArtifact(fileName, packageContent, options = {}) {
    return saveDeliveryPackageArtifactAction({
      fileName,
      packageContent,
      options,
      isRuntimeAvailable: isTauriRuntime,
      saveDeliveryPackage: invokeSaveDeliveryPackage,
      saveExportArtifact,
      appendExportHistory,
      setProjectMessage,
      activeEpisodeId,
      episodeName: episodes.find((item) => item.id === activeEpisodeId)?.name || "当前集",
    });
  }

  async function exportEpisodeCover(imageUrl, episodeName) {
    return exportEpisodeCoverAction({
      imageUrl,
      episodeName,
      saveImageToDownloads: invokeSaveImageToDownloads,
      safeFileName,
      appendExportHistory,
      setProjectMessage,
      activeEpisodeId,
    });
  }

  function getTimelineRenderBlockMessage(episodeTimeline, options = {}) {
    return buildTimelineRenderBlockMessage(episodeTimeline, {
      ...options,
      parseDurationSeconds,
    });
  }

  async function renderEpisodeVideo(episode, episodeTimeline, resourceIndex, options = {}) {
    const blockMessage = getTimelineRenderBlockMessage(episodeTimeline, options);
    if (blockMessage) {
      setProjectMessage(blockMessage);
      return;
    }
    const requestId = options.requestId || createRenderRequestId(`render-${episode?.id || activeEpisodeId}`);
    const request = buildEpisodeRenderRequest(episode, episodeTimeline, resourceIndex, {
      ...options,
      requestId,
      parseDurationSeconds,
      createRenderRequestId,
    });
    if (!request.clips.length) {
      setProjectMessage("当前时间线没有可用素材，至少需要一个已挂素材的片段。");
      return;
    }
    if (!isTauriRuntime()) {
      setProjectMessage("真实成片导出需要桌面版运行，并且本机已安装 ffmpeg。");
      return;
    }
    try {
      activeRenderRequestRef.current = requestId;
      appendExportHistory(buildDirectRenderHistoryEntry({
        requestId,
        status: "running",
        episode,
        activeEpisodeId,
        options,
        request,
      }));
      setProjectMessage("正在导出 MP4 成片...");
      const result = await invokeRenderTimelineVideo(request);
      appendExportHistory(buildDirectRenderHistoryEntry({
        requestId,
        status: "done",
        episode,
        activeEpisodeId,
        options,
        request,
        path: result.path,
      }));
      setProjectMessage(`成片已导出：${result.path}`);
    } catch (error) {
      appendExportHistory(buildDirectRenderHistoryEntry({
        requestId,
        status: "failed",
        episode,
        activeEpisodeId,
        options,
        request,
        error,
      }));
      setProjectMessage(`成片导出失败：${String(error)}`);
      throw error;
    } finally {
      if (activeRenderRequestRef.current === requestId) activeRenderRequestRef.current = "";
    }
  }

  function queueEpisodeRender(episode, episodeTimeline, resourceIndex, options = {}) {
    return queueEpisodeRenderAction({
      episode,
      episodeTimeline,
      resourceIndex,
      options,
      activeEpisodeId,
      parseDurationSeconds,
      createRenderRequestId,
      addGenerationJobs,
      appendExportHistory,
      setProjectMessage,
    });
  }

  function queueProjectRenderBatch(resourceIndex, options = {}) {
    return queueProjectRenderBatchAction({
      episodes,
      timeline,
      defaultEpisodeTimeline,
      resourceIndex,
      options,
      activeEpisodeId,
      parseDurationSeconds,
      createRenderRequestId,
      getEpisodeTimeline,
      addGenerationJobs,
      appendExportHistory,
      setProjectMessage,
    });
  }

  function queueMultiEpisodeDelivery(options = {}) {
    return queueMultiEpisodeDeliveryAction({
      commercialProject,
      options,
      resourceIndex,
      buildStudioDeliveryOutputSpec,
      queueProjectRenderBatch,
      buildPackageEntry: buildStudioPackageHistoryEntry,
      buildPackageContent: buildStudioDeliveryPackageContent,
      safeFileName,
      activeEpisodeId,
      addGenerationJobs,
      appendExportHistory,
      setShowQueue,
      scheduleRunQueue: () => window.setTimeout(() => runGenerationQueue(), 0),
    });
  }

  function generatePromptFactoryOutput(request) {
    const output = buildPromptFactoryOutput({
      ...promptFactory,
      ...request,
      styleMeta: buildStylePresetRequestMeta(stylePresetCenter, request.stylePreset, request.modelPreset),
      modelParamMeta: buildModelParamRequestMeta(modelParamCenter, request.parameterPresetId || promptFactory.parameterPresetId),
    });
    const historyItem = {
      id: `prompt-history-${Date.now()}`,
      createdAt: Date.now(),
      sourceType: request.sourceType,
      sourceId: request.sourceId,
      templateKey: request.templateKey,
      stylePreset: request.stylePreset,
      modelPreset: request.modelPreset,
      parameterPresetId: request.parameterPresetId || promptFactory.parameterPresetId || "",
      output,
      title: request.title || request.sourceId || "Prompt 结果",
    };
    setPromptFactory((current) => normalizePromptFactoryState({
      ...current,
      stylePreset: request.stylePreset,
      modelPreset: request.modelPreset,
      parameterPresetId: request.parameterPresetId || current.parameterPresetId || "",
      activeTemplate: request.templateKey,
      lastOutput: output,
      history: [historyItem, ...(current.history || [])].slice(0, 40),
    }));
    if (request.sourceType === "shot" && request.payload?.sourceNodeId && request.sourceId && output) {
      const sourceNodeId = String(request.payload.sourceNodeId || "").trim();
      const shotId = String(request.sourceId || "").trim();
      const templateKey = String(request.templateKey || "").trim();
      const promptField = templateKey === "video_shot"
        ? "videoPrompt"
        : templateKey === "image_shot"
          ? "imagePrompt"
          : "";
      if (promptField) {
        const patch = { [promptField]: output };
        if (patchShotRecord(sourceNodeId, shotId, patch)) {
          const sourceNode = (nodesRef.current || []).find((node) => node.id === sourceNodeId);
          const currentShot = (sourceNode?.data?.shots || [])
            .map((shot, index) => normalizeShotRecord(shot, index))
            .find((shot) => shot.id === shotId);
          if (currentShot) upsertTimelineClipFromShot(sourceNodeId, { ...currentShot, ...patch }, { silent: true });
          setProjectMessage(`Prompt 工厂已回写 ${shotId} 的${promptField === "videoPrompt" ? "视频" : "图片"}提示词`);
        }
      }
    }
    return output;
  }

function retryQueueJob(jobId) {
  retryQueueJobAction({
    jobId,
    setGenerationQueue,
  });
}

  function retryQueueJobs(jobIds = []) {
    retryQueueJobsAction({
      jobIds,
      setGenerationQueue,
      setProjectMessage,
    });
  }

  function refineShotPrompt(prompt = "", scene = "", additions = "") {
    const base = String(prompt || scene || "镜头").trim();
    const extra = String(additions || "").trim();
    if (!extra || base.includes(extra)) return base;
    return `${base}；优化要求：${extra}`;
  }

  function retryQueueJobsWithProvider(jobIds = [], providerMode = "") {
    const ids = Array.from(new Set((Array.isArray(jobIds) ? jobIds : [jobIds]).filter(Boolean)));
    const provider = String(providerMode || "").trim();
    if (!ids.length || !provider) {
      setProjectMessage("没有可切换 Provider 的失败任务。");
      return { matched: 0 };
    }
    let matched = 0;
    setGenerationQueue((current) => current.map((job) => {
      if (!ids.includes(job.id)) return job;
      matched += 1;
      const isVideo = job.kind === "video" || job.type === "shot.video";
      return {
        ...job,
        status: "pending",
        error: "",
        progress: null,
        attempts: 0,
        providerMode: provider === "custom" ? "api" : provider,
        imageProviderMode: isVideo ? job.imageProviderMode : provider,
        videoProviderMode: isVideo ? provider : job.videoProviderMode,
        resultSummary: `已切换到 ${provider}，等待重试`,
        updatedAt: Date.now(),
      };
    }));
    setShowQueue(true);
    setProjectMessage(matched ? `已切换并重试 ${matched} 个任务：${provider}` : "没有找到可切换的任务。");
    return { matched };
  }

  function skipQueueJobs(jobIds = []) {
    const ids = Array.from(new Set((Array.isArray(jobIds) ? jobIds : [jobIds]).filter(Boolean)));
    if (!ids.length) {
      setProjectMessage("没有可跳过的任务。");
      return { matched: 0 };
    }
    let matched = 0;
    setGenerationQueue((current) => current.map((job) => {
      if (!ids.includes(job.id)) return job;
      matched += 1;
      return {
        ...job,
        status: "cancelled",
        error: "",
        progress: null,
        resultSummary: "已跳过，等待手动补齐或重新排队",
        updatedAt: Date.now(),
      };
    }));
    setProjectMessage(matched ? `已跳过 ${matched} 个任务` : "没有找到可跳过的任务。");
    return { matched };
  }

  function updateStudioShotPrompt(shot = {}, patch = {}) {
    const shotId = shot.id || patch.shotId || "";
    if (!shotId) return { ok: false };
    const nextPatch = {
      imagePrompt: String(patch.imagePrompt ?? shot.imagePrompt ?? "").trim(),
      videoPrompt: String(patch.videoPrompt ?? shot.videoPrompt ?? "").trim(),
    };
    pushHistory();
    commitProjectStoreAction({
      type: "updateEpisode",
      episodeId: activeEpisodeIdRef.current || activeEpisodeId,
      updater: (episode) => ({
        ...episode,
        shots: (episode.shots || []).map((item) => (
          String(item.id || "") === String(shotId)
            ? { ...item, ...nextPatch, prompt: { ...(item.prompt || {}), image: nextPatch.imagePrompt, video: nextPatch.videoPrompt } }
            : item
        )),
      }),
    }, { materializeCanvas: true });
    setProjectMessage(`已保存 ${shotId} 的提示词`);
    return { ok: true, shotId, patch: nextPatch };
  }

  function rewriteStudioShotPrompt(shot = {}, kind = "image") {
    const shotId = shot.id || "";
    if (!shotId) return { ok: false };
    const base = String(kind === "video" ? shot.videoPrompt : shot.imagePrompt || "").trim();
    const scene = shot.scene || shot.title || shotId;
    const imagePrompt = kind === "image"
      ? refineShotPrompt(base, scene, "画面构图、角色一致性、光线、景别、细节完整")
      : shot.imagePrompt || "";
    const videoPrompt = kind === "video"
      ? refineShotPrompt(base, scene, "镜头运动、节奏、角色动作、时长、转场自然")
      : shot.videoPrompt || "";
    return updateStudioShotPrompt(shot, { imagePrompt, videoPrompt });
  }

  function retryFailedShotJobs() {
    retryFailedShotJobsAction({
      setGenerationQueue,
      setShowQueue,
      setProjectMessage,
    });
  }

  function retryFailedJobs() {
    retryFailedJobsAction({
      setGenerationQueue,
      setProjectMessage,
    });
  }

  function setPrimaryAssetImage(asset = {}, candidate = {}) {
    const assetId = asset.id || asset.token || asset.name || "";
    if (!assetId) return;
    pushHistory();
    commitProjectStoreAction({
      type: "setAssetPrimaryImage",
      episodeId: activeEpisodeIdRef.current || activeEpisodeId,
      assetId,
      candidate,
    }, { materializeCanvas: true });
    setProjectMessage(`已设为主图：${asset.name || asset.token || assetId}`);
  }

  function discardAssetImageCandidate(asset = {}, candidate = {}) {
    const assetId = asset.id || asset.token || asset.name || "";
    if (!assetId) return;
    pushHistory();
    commitProjectStoreAction({
      type: "discardAssetImageCandidate",
      episodeId: activeEpisodeIdRef.current || activeEpisodeId,
      assetId,
      candidate,
    }, { materializeCanvas: true });
    setProjectMessage(`已废弃候选图：${asset.name || asset.token || assetId}`);
  }

  function setPrimaryShotMedia(shot = {}, kind = "image", candidate = {}) {
    const shotId = shot.id || candidate.shotId || "";
    if (!shotId) return;
    pushHistory();
    commitProjectStoreAction({
      type: "setShotPrimaryMedia",
      episodeId: activeEpisodeIdRef.current || activeEpisodeId,
      shotId,
      kind,
      candidate,
    }, { materializeCanvas: true });
    setProjectMessage(`已切换${kind === "video" ? "视频" : "图片"}主版本：${shotId}`);
  }

  function discardShotMediaCandidate(shot = {}, kind = "image", candidate = {}) {
    const shotId = shot.id || candidate.shotId || "";
    if (!shotId) return;
    pushHistory();
    commitProjectStoreAction({
      type: "discardShotMediaCandidate",
      episodeId: activeEpisodeIdRef.current || activeEpisodeId,
      shotId,
      kind,
      candidate,
    }, { materializeCanvas: true });
    setProjectMessage(`已废弃${kind === "video" ? "视频" : "图片"}候选版本：${shotId}`);
  }

  function reprioritizeJob(jobId, priority) {
    reprioritizeJobAction({
      jobId,
      priority,
      setGenerationQueue,
    });
  }

  function retryExportJobs(scope = "all") {
    retryExportJobsAction({
      scope,
      setGenerationQueue,
      setShowQueue,
      setProjectMessage,
    });
  }

  function locateQueueJob(jobId) {
    const job = generationQueue.find((item) => item.id === jobId);
    if (!job) {
      setProjectMessage("没有找到对应的队列任务");
      return null;
    }
    if (job.sourceNodeId && job.shotId) {
      focusShotInNode(job.sourceNodeId, job.shotId);
      setShowQueue(false);
      setProjectMessage(`已定位到镜头 ${job.shotId}`);
      return { mode: "shot", nodeId: job.sourceNodeId, shotId: job.shotId };
    }
    if (job.sourceNodeId) {
      locateNode(job.sourceNodeId);
      setShowQueue(false);
      setProjectMessage("已定位到任务来源节点");
      return { mode: "node", nodeId: job.sourceNodeId, shotId: "" };
    }
    return null;
  }

  function recoverActiveEpisodeTimelineGaps() {
    const episodeId = activeEpisodeIdRef.current || activeEpisodeId;
    const episodeTimeline = getEpisodeTimeline(timelineRef.current, episodeId, { defaultEpisodeTimeline });
    const result = recoverTimelineGapsAction({
      episodeTimeline,
      episodeId,
      prepareTimelineClipsForExport,
      setProjectMessage,
    });
    if (!result.processed && !result.synced && !result.queued) return { ...result, blocked: 0, remaining: { media: 0, exportReady: 0 } };
    openProductionStudioView("timeline", "已恢复时间线缺口，正在查看生产工作台时间线。");
    return result;
  }

  function requeueExportHistoryItem(itemId) {
    return requeueExportHistoryItemAction({
      itemId,
      exportHistory,
      episodes,
      timeline,
      resourceIndex,
      getEpisodeTimeline,
      defaultEpisodeTimeline,
      queueEpisodeRender,
      setProjectMessage,
    });
  }

  function requeueExportHistoryItems(itemIds = []) {
    return requeueExportHistoryItemsAction({
      itemIds,
      exportHistory,
      episodes,
      timeline,
      resourceIndex,
      getEpisodeTimeline,
      defaultEpisodeTimeline,
      queueEpisodeRender,
      setProjectMessage,
    });
  }

  function queueActiveExportPreset(episodeId, scope = "single") {
    const preset = findExportPresetById(exportPresetCenter, exportPresetCenter.activePresetId);
    if (!preset) {
      setProjectMessage("当前没有可用的导出预设。");
      return;
    }
    const options = buildRenderOptionsFromExportPreset(preset);
    if (scope === "batch") {
      queueProjectRenderBatch(resourceIndex, options);
      return;
    }
    const targetEpisodeId = episodeId || activeEpisodeId;
    const episode = episodes.find((item) => item.id === targetEpisodeId);
    if (!episode) {
      setProjectMessage("没有找到要导出的集。");
      return;
    }
    queueEpisodeRender(episode, getEpisodeTimeline(timeline, targetEpisodeId, { defaultEpisodeTimeline }), resourceIndex, options);
  }

  async function renderActiveExportPreset(episodeId) {
    const preset = findExportPresetById(exportPresetCenter, exportPresetCenter.activePresetId);
    if (!preset) {
      setProjectMessage("当前没有可用的导出预设。");
      return;
    }
    const targetEpisodeId = episodeId || activeEpisodeId;
    const episode = episodes.find((item) => item.id === targetEpisodeId);
    if (!episode) {
      setProjectMessage("没有找到要导出的集。");
      return;
    }
    await renderEpisodeVideo(episode, getEpisodeTimeline(timeline, targetEpisodeId, { defaultEpisodeTimeline }), resourceIndex, buildRenderOptionsFromExportPreset(preset));
  }

  function markShotProgressFromQueue(job, patch) {
    if (!job?.sourceNodeId || !job?.shotId) return;
    setNodes((current) => patchShotQueueState(current, job, patch, normalizeShotRecord));
  }

  function buildBusinessQueueResultPatch(job, result) {
    const sourceEpisodeId = job?.sourceNodeId ? nodeById.get(job.sourceNodeId)?.data?.episodeId : "";
    const episodeId = job?.episodeId || sourceEpisodeId || activeEpisodeIdRef.current || activeEpisodeId;
    const shotId = job?.shotId || job?.targetId || "";
    if (!shotId || !episodeId) return null;
    return projectCommandService.commitTaskResult({
      job: {
        ...job,
        episodeId,
        shotId,
        targetId: job.targetId || shotId,
      },
      result,
    }).patch;
  }

async function runGenerationQueue() {
    return runProjectGenerationQueue({
      queueRunningRef,
      queueStopRef,
      generationQueue,
      setGenerationQueue,
      setQueueRunning,
      setShowQueue,
      setProjectMessage,
      traceAppEvent,
      compareQueueJobs,
      autoRetryLimit: QUEUE_AUTO_RETRY_LIMIT,
      settings,
      episodes,
      activeEpisodeId,
      safeFileName,
      isDesktopRuntime: isTauriRuntime,
      appendExportHistory,
      buildRenderHistoryOptions,
      invokeRenderTimelineVideo,
      saveDeliveryPackageArtifact,
      runImageGeneration,
      runVideoGeneration,
      resolveImageJobSettings,
      resolveVideoJobSettings,
      createOutputNear,
      markAssetProgressFromQueue,
      markShotProgressFromQueue,
      buildBusinessQueueResultPatch,
      getSourceNode: (sourceNodeId) => nodeById.get(sourceNodeId),
      normalizeShotRecord,
      upsertTimelineClipFromShot,
      buildCascadedVideoJobsAfterImage,
      shortTitle,
    });
  }

  function addNode(type, position = viewportCenter, extras = {}) {
    pushHistory();
    if (["imageEdit", "storyboard", "shotList", "novelPipeline"].includes(type)) refreshGlobalApiConfigs();
    const id = `node-${nextNodeId++}`;
    const base = createNode(type, id, position, { ...extras, episodeId: extras.episodeId || activeEpisodeId });
    setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), base]);
    setMenu(null);
    return id;
  }

  function findEpisodeNodeByType(type, episodeId = activeEpisodeId) {
    return nodesRef.current.find((node) => node.type === type && isNodeVisibleInEpisode(node, episodeId, episodesRef.current || episodes));
  }

  function locateFirstEpisodeNodeByType(type, episodeId = activeEpisodeId) {
    const target = findEpisodeNodeByType(type, episodeId);
    if (!target?.id) return "";
    locateNode(target.id);
    return target.id;
  }

  function bootstrapEpisodeWorkspace(mode = "novel", options = {}) {
    const episodeId = activeEpisodeIdRef.current || activeEpisodeId;
    const center = viewportCenter;
    const novelText = String(options.novelText || "").trim();
    let novelNode = findEpisodeNodeByType("novelPipeline", episodeId);
    let assetNode = findEpisodeNodeByType("assetLibrary", episodeId);
    let shotNode = findEpisodeNodeByType("shotList", episodeId);
    let created = 0;

    if (!novelNode && (mode === "novel" || mode === "full")) {
      const novelId = addNode("novelPipeline", { x: center.x - 760, y: center.y - 280 }, { episodeId, ...(novelText ? { novel: novelText } : {}) });
      novelNode = { id: novelId, x: center.x - 760, y: center.y - 280, width: 1080, height: 760, data: { episodeId, ...(novelText ? { novel: novelText } : {}) } };
      created += 1;
    }

    if (!assetNode && ["novel", "asset", "full"].includes(mode)) {
      const assetPosition = novelNode
        ? { x: novelNode.x + novelNode.width + 160, y: novelNode.y + 56 }
        : { x: center.x + 220, y: center.y - 180 };
      const assetId = addNode("assetLibrary", assetPosition, { episodeId });
      assetNode = { id: assetId, x: assetPosition.x, y: assetPosition.y, width: 480, height: 560, data: { episodeId } };
      created += 1;
    }

    if (!shotNode && ["novel", "shot", "full"].includes(mode)) {
      const shotPosition = assetNode
        ? { x: assetNode.x + assetNode.width + 180, y: assetNode.y + 40 }
        : novelNode
          ? { x: novelNode.x + novelNode.width + 360, y: novelNode.y + 260 }
          : { x: center.x + 620, y: center.y - 120 };
      const shotId = addNode("shotList", shotPosition, { episodeId });
      shotNode = { id: shotId, x: shotPosition.x, y: shotPosition.y, width: 760, height: 640, data: { episodeId } };
      created += 1;
    }

    if (novelNode?.id && assetNode?.id) ensureLinkedEdge(novelNode.id, assetNode.id);
    if (assetNode?.id && shotNode?.id) ensureLinkedEdge(assetNode.id, shotNode.id);
    else if (novelNode?.id && shotNode?.id) ensureLinkedEdge(novelNode.id, shotNode.id);

    if (novelText && novelNode?.id) {
      setNodes((current) => current.map((node) => (
        node.id === novelNode.id ? { ...node, data: { ...node.data, novel: novelText } } : node
      )));
    }

    const focusId = shotNode?.id || assetNode?.id || novelNode?.id || "";
    if (focusId) locateNode(focusId);
    if (options.openDashboard !== false) setShowDashboard(true);
    setProjectMessage(novelText
      ? "小说已写入起步流程，可以直接后台自动生产。"
      : created > 0
        ? `已补齐起步流程节点 ${created} 个，可以直接开始生产。`
        : "当前集的起步流程节点已经齐了，可以直接按总控台顺序推进。");
    return { created, novelNodeId: novelNode?.id || "", assetNodeId: assetNode?.id || "", shotNodeId: shotNode?.id || "" };
  }

  async function submitSimpleNovelFlow(novelText, options = {}) {
    const episodeId = activeEpisodeIdRef.current || activeEpisodeId;
    if (!options.skipPreflight) {
      const preflight = checkTextTaskPreflight({ sourceText: novelText, textApiSettings });
      if (!preflight.ok) {
        notifyTaskBlocked(preflight.message, "text");
        return { title: "文字任务未启动", summary: preflight.message };
      }
      if (!isLocalTextMode(textApiSettings)) {
        const live = await runProviderLiveCheck({
          "文本 API": () => pingTextApiProvider(textApiSettings),
        }, { timeoutMs: 6000 });
        if (!live.ok) {
          const summary = `文本 API 连接失败，文字任务已停止：${live.failed[0]?.detail || "无法连接文本供应商"}`;
          notifyTaskBlocked(summary, "text");
          return { title: "文字任务未启动", summary };
        }
      }
    }
    const createLocalStudioTextPackage = (text) => createTextProductionPackage({
      novelText: text,
    }, {
      buildProjectName: buildCineForgeProjectName,
      template: ACTIVE_NOVEL_TEMPLATE_DEFAULT,
      taskMode: "短剧漫剧",
      note: "新手流程本地文本生产 · 已按模板1/2/3/4本地整理",
      stage: "prompts",
    });
    const createApiStudioTextPackage = async (text) => {
      const apiPipeline = await runStudioTemplateChain(text);
      return createTextProductionPackage({
        novelText: text,
      }, {
        buildNovelPipeline: () => apiPipeline,
        buildProjectName: (taskMode, sourceText) => apiPipeline.projectName || buildCineForgeProjectName(taskMode, sourceText),
        template: ACTIVE_NOVEL_TEMPLATE_DEFAULT,
        taskMode: "短剧漫剧",
        note: apiPipeline.note || "小说工厂 API 文本生产",
        stage: "prompts",
      });
    };
    const textPackage = await createStudioTextPlanPackage({
      sourceText: novelText,
      textApiSettings,
      createLocalPackage: createLocalStudioTextPackage,
      createApiPackage: createApiStudioTextPackage,
    });
    const initialCommand = prepareStudioTextCommand({
      sourceText: novelText,
      episodeId,
      createTextPackage: () => textPackage,
    });
    if (!initialCommand.shouldBootstrap) {
      setProjectMessage("请先粘贴小说或剧情梗概。");
      return initialCommand.result;
    }
    const result = bootstrapEpisodeWorkspace("novel", { novelText: initialCommand.text, openDashboard: false });
    const command = prepareStudioTextCommand({
      sourceText: initialCommand.text,
      episodeId,
      bootstrapResult: result,
      createTextPackage: () => initialCommand.textPackage,
    });
    if (!command.ok) {
      setProjectMessage(command.message);
      return command.result;
    }
    const action = command.action;
    if (action.storeAction) {
      projectCommandService.commitTextPackage({ action: action.storeAction, materializeCanvas: true });
    }
    setShowSimpleFlow(true);
    setProjectMessage(command.message);
    return command.result;
  }

  function guideWorkflowStep(stepKey = "novel") {
    const episodeId = activeEpisodeIdRef.current || activeEpisodeId;
    const summary = buildProjectSummary(
      nodesRef.current || [],
      edges,
      episodesRef.current || [],
      episodeId,
      generationQueue,
      resourcesRef.current || [],
      timelineRef.current || defaultTimelineState(),
      collaborationState,
      archiveState,
      exportHistory,
    ).active || {};
    const shotNodeId = summary.shotNodeId || findEpisodeNodeByType("shotList", episodeId)?.id || "";
    const assetNodeId = summary.assetNodeId || findEpisodeNodeByType("assetLibrary", episodeId)?.id || "";
    const novelNodeId = summary.novelNodeId || findEpisodeNodeByType("novelPipeline", episodeId)?.id || "";
    const reviewReport = buildReviewBoardReport(nodesRef.current || [], episodesRef.current || [], episodeId);
    const timelineState = getEpisodeTimeline(timelineRef.current, episodeId, { defaultEpisodeTimeline });
    const focus = buildWorkflowFocusContext(stepKey, summary, reviewReport, timelineState);

    if (stepKey === "novel") {
      if (!novelNodeId) bootstrapEpisodeWorkspace("novel", { openDashboard: false });
      openProductionStudioView("script", "已定位到生产工作台：剧本方案。");
      return;
    }
    if (stepKey === "asset") {
      if (!assetNodeId) bootstrapEpisodeWorkspace("novel", { openDashboard: false });
      openProductionStudioView("assets", "已定位到生产工作台：资产库。");
      return;
    }
    if (stepKey === "shot" || stepKey === "prompt") {
      if (!(focus.shotNodeId || shotNodeId)) bootstrapEpisodeWorkspace("shot", { openDashboard: false });
      openProductionStudioView("shots", "已定位到生产工作台：镜头表。");
      return;
    }
    if (stepKey === "review") {
      if (!(focus.shotNodeId || shotNodeId)) bootstrapEpisodeWorkspace("shot", { openDashboard: false });
      setReviewCenterFocusTargetId(focus.reviewTargetId || "");
      openProductionStudioView("review", "已定位到生产工作台：审片。");
      return;
    }
    if (stepKey === "timeline") {
      setTimelineFocusClipId(focus.clipId || "");
      openProductionStudioView("timeline", "已定位到生产工作台：时间线。");
      return;
    }
    if (stepKey === "export") {
      if (!summary.exportReady) {
        if (!summary.timelineClips || summary.timelineReady < summary.timelineClips || summary.timelineTextReady < summary.timelineClips) {
          setTimelineFocusClipId(focus.clipId || "");
          openProductionStudioView("timeline", "交付前请先检查生产工作台时间线。");
        } else {
          setReviewCenterFocusTargetId(focus.reviewTargetId || "");
          openProductionStudioView("review", "交付前请先完成生产工作台审片。");
        }
      } else {
        openProductionStudioView("delivery", "已定位到生产工作台：交付。");
      }
      return;
    }
    openProductionStudioView("overview", "已定位到生产工作台总览。");
  }

  async function continueWorkflowFromDashboard() {
    const episodeId = activeEpisodeIdRef.current || activeEpisodeId;
    const summary = buildProjectSummary(
      nodesRef.current || [],
      edges,
      episodesRef.current || [],
      episodeId,
      generationQueue,
      resourcesRef.current || [],
      timelineRef.current || defaultTimelineState(),
      collaborationState,
      archiveState,
      exportHistory,
    ).active || {};
    const shots = summary.shots || 0;
    const timelineClips = summary.timelineClips || 0;
    const promptCoverage = shots ? ((summary.promptReady || 0) / shots) : 0;
    const timelineMediaCoverage = timelineClips ? ((summary.timelineReady || 0) / timelineClips) : 0;
    const novelReady = (summary.scripts || 0) > 0;
    const assetReady = (summary.characters || 0) > 0 && (summary.scenes || 0) > 0;
    const shotReady = shots > 0 && promptCoverage === 1;
    const reviewReady = shots > 0 && (summary.pendingReview || 0) === 0 && (summary.autoFixPending || 0) === 0 && (summary.refreshPlanPending || 0) === 0;
    const timelineReady = shots > 0 && timelineClips >= shots && timelineMediaCoverage === 1 && (summary.timelineBackfillPending || 0) === 0;
    const exportReady = Boolean(summary.exportReady) && (summary.failedExports || 0) === 0;
    const shotStageBoard = summary.shotStageBoard || {};
    const timelineStageBoard = summary.timelineStageBoard || {};
    const failedShotJobs = (generationQueue || []).filter((job) => (
      job.status === "failed"
      && job.kind !== "exportVideo"
      && (!job.sourceNodeId || ((nodesRef.current || []).find((node) => node.id === job.sourceNodeId)?.data?.episodeId || episodeId) === episodeId)
    ));

    if (!novelReady) {
      guideWorkflowStep("novel");
      return {
        title: "已定位到剧本工位",
        summary: "先完成小说转剧本，这一步还需要你确认创作方向。",
        stepKey: "novel",
        details: ["判断依据：当前集还没有稳定剧本产出。", "下一步：在小说工厂完成规划和剧本生成。"],
      };
    }
    if (!assetReady) {
      guideWorkflowStep("asset");
      return {
        title: "已定位到资产工位",
        summary: "下一步先把人物和场景资产锁稳。",
        stepKey: "asset",
        details: [
          `判断依据：人物 ${summary.characters || 0} 个，场景 ${summary.scenes || 0} 个。`,
          "下一步：优先把主角色和主场景资产补齐。",
        ],
      };
    }
    if (!shotReady) {
      guideWorkflowStep("shot");
      return {
        title: "已定位到镜头工位",
        summary: "下一步先补齐镜头表和图片/视频提示词。",
        stepKey: "shot",
        details: [
          `判断依据：镜头 ${shots || 0} 条，提示词完成 ${summary.promptReady || 0}/${shots || 0}。`,
          "下一步：优先把缺提示词的镜头补满。",
        ],
      };
    }
    if (failedShotJobs.length) {
      retryFailedShotJobs();
      return {
        title: "已优先恢复失败镜头任务",
        summary: `当前集有 ${failedShotJobs.length} 个失败镜头任务，已全部重新排队。`,
        stepKey: "timeline",
        metrics: [
          { label: "失败镜头", value: failedShotJobs.length },
          { label: "待生图", value: shotStageBoard.pendingImage || 0 },
          { label: "待生视频", value: shotStageBoard.pendingVideo || 0 },
          { label: "待修改", value: shotStageBoard.pendingFix || 0 },
        ],
        details: [
          `判断依据：队列中有 ${failedShotJobs.length} 个失败镜头任务。`,
          "执行动作：先恢复失败镜头，避免后续时间线一直卡在旧失败结果上。",
          `下一步：继续处理待生图 ${shotStageBoard.pendingImage || 0}、待生视频 ${shotStageBoard.pendingVideo || 0}。`,
        ],
      };
    }
    if (!reviewReady) {
      if ((summary.pendingReview || 0) > 0) {
        const result = await runEpisodePendingReviewBatch();
        return {
          title: "已优先清未审镜头",
          summary: `已审 ${result.reviewed || 0} 个，待修改 ${result.pendingFix || 0} 个，已通过 ${result.passed || 0} 个。`,
          stepKey: "review",
          metrics: [
            { label: "已审", value: result.reviewed || 0 },
            { label: "待修改", value: result.pendingFix || 0 },
            { label: "已通过", value: result.passed || 0 },
            { label: "待刷新", value: summary.refreshPlanPending || 0 },
          ],
          details: [
            `判断依据：当前还有 ${summary.pendingReview || 0} 个未审镜头。`,
            "执行动作：先清未审镜头，让后面的自动修改有明确输入。",
            `下一步：继续处理待修改 ${result.pendingFix || 0} 个、待刷新 ${summary.refreshPlanPending || 0} 个。`,
          ],
        };
      }
      if ((summary.refreshPlanPending || 0) > 0) {
        const result = await runEpisodePendingRefreshBatch();
        return {
          title: "已优先执行刷新计划",
          summary: `已处理 ${result.handled || 0} 个镜头，更新资产 ${result.assetCount || 0} 项，提示词 ${result.promptUpdated || 0} 条。`,
          stepKey: "review",
          metrics: [
            { label: "处理镜头", value: result.handled || 0 },
            { label: "资产更新", value: result.assetCount || 0 },
            { label: "提示词", value: result.promptUpdated || 0 },
            { label: "时间线", value: result.timelineUpdated || 0 },
          ],
          details: [
            `判断依据：当前还有 ${summary.refreshPlanPending || 0} 个刷新计划未执行。`,
            "执行动作：先回刷资产、提示词和时间线，避免后续推进用到旧数据。",
            `下一步：继续检查待修改 ${shotStageBoard.pendingFix || 0} 个镜头是否已清空。`,
          ],
        };
      }
      const result = await runEpisodeReviewClosure();
      return {
        title: "已自动跑完审稿闭环",
        summary: `已审 ${result.reviewed || 0} 个，已改 ${result.revised || 0} 个，已刷新 ${result.refreshHandled || 0} 个。`,
        stepKey: "review",
        metrics: [
          { label: "已审", value: result.reviewed || 0 },
          { label: "已改", value: result.revised || 0 },
          { label: "已刷新", value: result.refreshHandled || 0 },
          { label: "待修改", value: result.pendingFix || 0 },
        ],
        details: [
          "判断依据：审稿闭环还没有真正清零。",
          "执行动作：把审稿、自动修改和刷新计划一起跑完一轮。",
          `下一步：继续检查时间线缺口，当前缺素材 ${timelineStageBoard.missingMedia || 0}。`,
        ],
      };
    }
    if ((timelineStageBoard.missingMedia || 0) > 0) {
      const result = await runEpisodeMissingMediaBatch();
      return {
        title: "已优先补时间线缺素材",
        summary: `已为 ${result.queued || 0} 条缺素材片段加入生成队列。`,
        stepKey: "timeline",
        metrics: [
          { label: "缺素材", value: timelineStageBoard.missingMedia || 0 },
          { label: "已入队", value: result.queued || 0 },
          { label: "待验收", value: timelineStageBoard.pendingApproval || 0 },
          { label: "待生视频", value: shotStageBoard.pendingVideo || 0 },
        ],
        details: [
          `判断依据：时间线还有 ${timelineStageBoard.missingMedia || 0} 条片段没挂素材。`,
          "执行动作：先把缺素材片段重新送入生成队列。",
          `下一步：继续处理待验收 ${timelineStageBoard.pendingApproval || 0} 条、待生视频 ${shotStageBoard.pendingVideo || 0} 条。`,
        ],
      };
    }
    if ((summary.timelineBackfillPending || 0) > 0) {
      const result = await runEpisodeTimelineBackfillBatch();
      return {
        title: "已优先把时间线结果回写镜头表",
        summary: `已回写 ${result.synced || 0} 条镜头，跳过 ${result.skipped || 0} 条无变化片段。`,
        stepKey: "timeline",
        metrics: [
          { label: "待回写", value: summary.timelineBackfillPending || 0 },
          { label: "已回写", value: result.synced || 0 },
          { label: "未关联", value: result.missingLink || 0 },
          { label: "新增记录", value: result.comments || 0 },
        ],
        details: [
          `判断依据：当前还有 ${summary.timelineBackfillPending || 0} 条时间线结果没同步回镜头表。`,
          "执行动作：先把时间线里的验收和素材结果回写到镜头表，保证状态统一。",
          `下一步：继续处理待验收 ${timelineStageBoard.pendingApproval || 0} 条、待生视频 ${shotStageBoard.pendingVideo || 0} 条。`,
        ],
      };
    }
    if ((timelineStageBoard.pendingApproval || 0) > 0) {
      const result = await runEpisodePendingTimelineApprovalBatch();
      return {
        title: "已优先执行时间线验收",
        summary: `已验收 ${result.reviewed || 0} 条，已通过 ${result.passed || 0} 条，退回 ${result.rejected || 0} 条。`,
        stepKey: "timeline",
        metrics: [
          { label: "待验收", value: timelineStageBoard.pendingApproval || 0 },
          { label: "已通过", value: result.passed || 0 },
          { label: "退回修改", value: result.rejected || 0 },
          { label: "回写镜头", value: result.backfilled || 0 },
        ],
        details: [
          `判断依据：当前还有 ${timelineStageBoard.pendingApproval || 0} 条时间线片段待验收。`,
          "执行动作：用 API 批量判断当前片段是否可导出，并把验收结果回写到镜头表。",
          `下一步：继续处理退回修改 ${result.rejected || 0} 条，或直接进入导出检查。`,
        ],
      };
    }
    if ((timelineStageBoard.rejected || 0) > 0) {
      const result = await runEpisodeRejectedTimelineRepairBatch();
      return {
        title: "已优先修复退回片段",
        summary: `已修复 ${result.repaired || 0} 条退回片段，重入队 ${result.queued || 0}。`,
        stepKey: "timeline",
        metrics: [
          { label: "退回片段", value: timelineStageBoard.rejected || 0 },
          { label: "重入队", value: result.queued || 0 },
        ],
        details: [
          `判断依据：当前还有 ${timelineStageBoard.rejected || 0} 条时间线片段处于退回修改。`,
          "执行动作：按退回备注自动决定补文字轨、重生成素材或回送镜头链路，并改回待验收。",
          `下一步：继续复验待验收 ${timelineStageBoard.pendingApproval || 0} 条，或等待重生成结果。`,
        ],
      };
    }
    if (!timelineReady) {
      const result = await runEpisodeToTimelineDeliverable();
      return {
        title: "已自动顺推到视频生产",
        summary: `导入 ${result.imported || 0} 条，同步 ${result.synced || 0} 条，回写 ${result.backfilled || 0} 条，入队 ${result.queued || 0} 条。`,
        stepKey: "timeline",
        metrics: [
          { label: "导入", value: result.imported || 0 },
          { label: "同步", value: result.synced || 0 },
          { label: "回写镜头", value: result.backfilled || 0 },
          { label: "入队", value: result.queued || 0 },
          { label: "待素材", value: result.remaining?.media || 0 },
        ],
        details: [
          "判断依据：视频时间线素材还没达到可交付状态。",
          "执行动作：把镜头顺推到时间线，补齐图片/视频素材，并把时间线结果回写到镜头表。",
          `下一步：继续清掉待素材 ${result.remaining?.media || 0}。`,
        ],
      };
    }
    if (!exportReady) {
      if ((summary.failedExports || 0) > 0) {
        const result = await runEpisodeFailedExportBatch();
        return {
          title: "已优先恢复失败导出",
          summary: `${result.target || "当前集"} 共重试 ${result.retried || 0} 条失败导出。`,
          stepKey: "export",
          metrics: [
            { label: "失败导出", value: result.retried || 0 },
            { label: "已完成", value: shotStageBoard.completed || 0 },
            { label: "已通过片段", value: timelineStageBoard.approved || 0 },
            { label: "待验收", value: timelineStageBoard.pendingApproval || 0 },
          ],
          details: [
            `判断依据：当前还有 ${summary.failedExports || 0} 条失败导出。`,
            "执行动作：先恢复失败导出，避免最终交付被旧错误卡住。",
            `下一步：继续确认待验收 ${timelineStageBoard.pendingApproval || 0} 条片段。`,
          ],
        };
      }
      const result = await runEpisodeToExportDeliverable();
      return {
        title: result.exportReady ? "已推进到可导出" : "已推进到导出前最后缺口",
        summary: result.exportReady
          ? `已验收 ${result.reviewedApprovals || 0} 条并入队 ${result.queuedRenders || 0} 个成片版本。`
          : `待素材 ${result.remaining?.media || 0}。`,
        stepKey: "export",
        metrics: [
          { label: "验收片段", value: result.reviewedApprovals || 0 },
          { label: "通过验收", value: result.passedApprovals || 0 },
          { label: "退回修改", value: result.rejectedApprovals || 0 },
          { label: "入队版本", value: result.queuedRenders || 0 },
          { label: "待素材", value: result.remaining?.media || 0 },
        ],
        details: [
          "判断依据：主流程基本完成，但还没完全过导出门槛。",
          result.exportReady ? "执行动作：已经补跑时间线验收，并把成片版本送入导出队列。" : "执行动作：先把导出前最后缺口清到位。",
          result.exportReady
            ? `下一步：直接去成片导出查看 ${result.queuedRenders || 0} 个入队版本。`
            : `下一步：继续处理待素材 ${result.remaining?.media || 0}。`,
        ],
      };
    }
    guideWorkflowStep("export");
    return {
      title: "当前集已进入导出阶段",
      summary: "所有主流程门槛都满足了，直接去成片导出即可。",
      stepKey: "export",
      details: ["判断依据：文本、分镜图片、视频时间线和导出前检查都已达标。", "下一步：直接查看视频导出输出。"],
    };
  }

  function buildAutopilotSummarySnapshot() {
    return buildProjectSummary(
      nodesRef.current || [],
      edges,
      episodesRef.current || [],
      activeEpisodeIdRef.current || activeEpisodeId,
      generationQueueRef.current || [],
      resourcesRef.current || [],
      timelineRef.current || defaultTimelineState(),
      collaborationState,
      archiveState,
      exportHistory,
    ).active || {};
  }

  function buildAutopilotSignature(summary = {}) {
    const queue = generationQueueRef.current || [];
    return [
      summary.scripts || 0,
      summary.characters || 0,
      summary.scenes || 0,
      summary.shots || 0,
      summary.promptReady || 0,
      summary.pendingReview || 0,
      summary.autoFixPending || 0,
      summary.refreshPlanPending || 0,
      summary.timelineClips || 0,
      summary.timelineReady || 0,
      summary.timelineBackfillPending || 0,
      summary.timelineStageBoard?.missingMedia || 0,
      summary.timelineStageBoard?.pendingApproval || 0,
      summary.timelineStageBoard?.rejected || 0,
      summary.exportReady ? 1 : 0,
      queue.filter((job) => job.status === "pending").length,
      queue.filter((job) => job.status === "running").length,
      queue.filter((job) => job.status === "failed").length,
    ].join("|");
  }

  async function autoBackfillTimelineAfterQueue() {
    const summary = buildAutopilotSummarySnapshot();
    if ((summary.timelineBackfillPending || 0) <= 0) return null;
    const result = await runEpisodeTimelineBackfillBatch({ silent: true });
    if (result?.synced) setProjectMessage(`队列结果已自动回填：${result.synced} 条时间线结果同步到镜头表。`);
    return result;
  }

  async function runBackgroundAutopilot(options = {}) {
    const productionMode = resolveProductionMode(options);
    const textOnly = isTextProductionMode(productionMode);
    if (autopilotRunningRef.current) {
      setShowDashboard(true);
      setProjectMessage("后台自动生产已经在运行中，不会重复启动第二条生产线。");
      return {
        title: "后台自动生产运行中",
        summary: "已有一条后台生产线正在推进，请等待当前任务完成或暂停。",
        metrics: [
          { label: "待队列", value: generationQueueRef.current.filter((job) => job.status === "pending").length },
          { label: "运行中", value: generationQueueRef.current.filter((job) => job.status === "running").length },
        ],
      };
    }
    autopilotRunningRef.current = true;
    if (!textOnly) setShowDashboard(true);
    setProjectMessage(buildAutopilotStartMessage(productionMode));
    const receipts = [];
    let stableRounds = 0;
    let previousSignature = "";
    try {
      for (let round = 1; round <= AUTOPILOT_MAX_ROUNDS; round += 1) {
        const pendingBefore = generationQueueRef.current.filter((job) => job.status === "pending" || job.status === "running").length;
        if (pendingBefore > 0 && !textOnly) {
          setProjectMessage(`后台自动生产：正在执行生成队列 ${pendingBefore} 个任务...`);
          await runGenerationQueue();
          await sleep(180);
          await autoBackfillTimelineAfterQueue();
        }

        const summary = buildAutopilotSummarySnapshot();
        const signature = buildAutopilotSignature(summary);
        if (textOnly && isTextProductionReady(summary)) {
          setProjectMessage("文本生产完成：资产输出、镜头表和图片/视频提示词已就绪，未自动生成图片。");
          return buildTextProductionCompleteResult(summary, receipts, {
            summary: "已完成到资产输出和镜头表提示词；图片和视频生成保持未自动启动。",
          });
        }
        if (summary.exportReady && !(summary.failedExports || 0)) {
          openProductionStudioView("delivery", `后台自动生产完成：${receipts.length ? receipts.map((item) => item.title).slice(-3).join(" / ") : "当前集已可导出"}`);
          return {
            title: "后台自动生产完成",
            summary: "当前集已达到导出门槛，可以直接查看成片导出。",
            metrics: [
              { label: "推进轮次", value: round - 1 },
              { label: "执行步骤", value: receipts.length },
              { label: "待队列", value: generationQueueRef.current.filter((job) => job.status === "pending").length },
            ],
            details: receipts.map((item) => item.summary || item.title).filter(Boolean).slice(-6),
          };
        }

        const result = await continueWorkflowFromDashboard();
        if (result) receipts.push(result);
        await sleep(220);

        const nextSummary = buildAutopilotSummarySnapshot();
        const nextSignature = buildAutopilotSignature(nextSummary);
        const pendingAfter = textOnly ? 0 : generationQueueRef.current.filter((job) => job.status === "pending" || job.status === "running").length;
        const failed = textOnly ? 0 : generationQueueRef.current.filter((job) => job.status === "failed").length;
        if (textOnly && isTextProductionReady(nextSummary)) {
          setProjectMessage("文本生产完成：已停在资产和镜头表阶段，没有进入图片生成。");
          return buildTextProductionCompleteResult(nextSummary, receipts);
        }
        stableRounds = nextSignature === previousSignature || nextSignature === signature ? stableRounds + 1 : 0;
        previousSignature = nextSignature;
        setProjectMessage(`后台自动生产第 ${round} 轮：${result?.summary || "已推进"}${pendingAfter ? `，待执行队列 ${pendingAfter}` : ""}${failed ? `，失败 ${failed}` : ""}`);

        if (!pendingAfter && result?.stepKey === "novel" && /API|剧本|小说/.test(`${result.summary || ""} ${result.details?.join(" ") || ""}`)) break;
        if (!pendingAfter && stableRounds >= 2) break;
      }

      const finalSummary = buildAutopilotSummarySnapshot();
      const failed = textOnly ? 0 : generationQueueRef.current.filter((job) => job.status === "failed").length;
      const pending = textOnly ? 0 : generationQueueRef.current.filter((job) => job.status === "pending" || job.status === "running").length;
      const pauseReason = describeAutopilotPauseReason(finalSummary, pending, failed);
      setProjectMessage(textOnly ? `文本生产已暂停：${pauseReason}` : `后台自动生产已暂停：${pauseReason}`);
      return buildAutopilotPauseResult({
        mode: productionMode,
        summary: finalSummary,
        pending,
        failed,
        receipts,
        pauseReason,
      });
    } finally {
      autopilotRunningRef.current = false;
    }
  }

  function updateNode(id, patch, options = {}) {
    const guard = buildCanvasWriteGuard({ patch, viaCommandService: options.viaCommandService === true });
    if (!guard.ok && !options.skipGuardMessage) {
      setProjectMessage(guard.warning);
    }
    if (!options.skipHistory) pushHistory();
    setNodes((current) => current.map((node) => {
      if (node.id !== id) return node;
      const nextNode = { ...node, data: { ...node.data, ...patch } };
      const nextStoreState = reduceCanvasNodeEditToProjectStore({
        storeState: projectStoreStateRef.current,
        node: nextNode,
      });
      if (nextStoreState !== projectStoreStateRef.current) {
        projectStoreStateRef.current = nextStoreState;
        setProjectStoreState(nextStoreState);
      }
      return nextNode;
    }));
  }

  function selectNode(id) {
    setNodes((current) => current.map((node) => ({ ...node, selected: node.id === id })));
    setSelectedEdgeId("");
    setNodeMenu(null);
    setEdgeMenu(null);
  }

  function selectNodesByIds(ids = []) {
    const selectedIds = new Set(ids);
    setNodes((current) => current.map((node) => ({ ...node, selected: selectedIds.has(node.id) })));
    setSelectedEdgeId("");
    setNodeMenu(null);
    setEdgeMenu(null);
  }

  function getSelectedNodeIds() {
    return selectedNodeIds;
  }

  function deleteNode(id) {
    pushHistory();
    setNodes((current) => current.filter((node) => node.id !== id));
    setEdges((current) => current.filter((edge) => edge.source !== id && edge.target !== id));
    setNodeMenu(null);
  }

  function deleteEdge(id) {
    pushHistory();
    setEdges((current) => current.filter((edge) => edge.id !== id));
    setSelectedEdgeId("");
    setEdgeMenu(null);
  }

  function duplicateNode(id) {
    duplicateNodes([id]);
    setNodeMenu(null);
  }

  function duplicateNodes(ids = []) {
    const selectedIds = [...new Set((ids || []).filter(Boolean))];
    if (!selectedIds.length) return [];
    const sourceNodes = nodes.filter((node) => selectedIds.includes(node.id));
    if (!sourceNodes.length) return [];
    pushHistory();
    const nodeIdMap = new Map();
    const clonedNodes = sourceNodes.map((node, index) => {
      const newId = `node-${nextNodeId++}`;
      nodeIdMap.set(node.id, newId);
      return {
        ...structuredCloneSafe(node),
        id: newId,
        x: node.x + 48,
        y: node.y + 48 + index * 4,
        selected: true,
        data: { ...(structuredCloneSafe(node.data) || {}), episodeId: node.data?.episodeId || activeEpisodeId },
      };
    });
    const clonedEdges = edges
      .filter((edge) => nodeIdMap.has(edge.source) && nodeIdMap.has(edge.target))
      .map((edge, index) => ({
        ...edge,
        id: `edge-${nodeIdMap.get(edge.source)}-${nodeIdMap.get(edge.target)}-${Date.now()}-${index}`,
        source: nodeIdMap.get(edge.source),
        target: nodeIdMap.get(edge.target),
      }));
    setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), ...clonedNodes]);
    setEdges((current) => [...current, ...clonedEdges]);
    setSelectedEdgeId("");
    setProjectMessage(selectedIds.length > 1 ? `已复制 ${selectedIds.length} 个节点` : "已复制节点");
    return clonedNodes.map((node) => node.id);
  }

  function selectNodesInScreenRect(box) {
    if (!box) return;
    const currentView = viewRef.current;
    const left = Math.min(box.sx, box.cx);
    const right = Math.max(box.sx, box.cx);
    const top = Math.min(box.sy, box.cy);
    const bottom = Math.max(box.sy, box.cy);
    const ids = visibleNodes
      .filter((node) => {
        const screenLeft = node.x * currentView.scale + currentView.x;
        const screenTop = node.y * currentView.scale + currentView.y;
        const screenRight = screenLeft + node.width * currentView.scale;
        const screenBottom = screenTop + node.height * currentView.scale;
        return screenRight >= left && screenLeft <= right && screenBottom >= top && screenTop <= bottom;
      })
      .map((node) => node.id);
    selectNodesByIds(ids);
    if (ids.length) setProjectMessage(`已框选 ${ids.length} 个节点`);
  }

  function sendResultToSplit(id) {
    const node = nodes.find((item) => item.id === id);
    const imageUrl = node?.data?.imageUrl;
    if (!imageUrl) return;
    const meta = node.data.storyboardMeta || {};
    createOutputNear(id, "split", "分镜拆分", {
      imageUrl,
      rows: meta.rows || 2,
      cols: meta.cols || 2,
      displayName: "分镜拆分",
    });
    setNodeMenu(null);
  }

  function connectFromLast(newId) {
    const source = selectedNode?.id;
    if (!source || source === newId) return;
    setEdges((current) => [...current, { id: `edge-${source}-${newId}-${Date.now()}`, source, target: newId }]);
  }

  function startConnection(sourceId, event) {
    event.preventDefault();
    event.stopPropagation();
    const source = nodes.find((node) => node.id === sourceId);
    if (!source) return;
    const from = worldToScreen(source.x + source.width, source.y + source.height / 2, view);
    setConnectionDrag({
      sourceId,
      from,
      to: { x: event.clientX, y: event.clientY },
    });
    setSelectedEdgeId("");
    setMenu(null);
    setNodeMenu(null);
    setEdgeMenu(null);
  }

  function finishConnection(targetId) {
    if (!connectionDrag || connectionDrag.sourceId === targetId) return;
    const exists = edges.some((edge) => edge.source === connectionDrag.sourceId && edge.target === targetId);
    if (exists) {
      setConnectionDrag(null);
      return;
    }
    pushHistory();
    setEdges((current) => [
      ...current,
      { id: `edge-${connectionDrag.sourceId}-${targetId}-${Date.now()}`, source: connectionDrag.sourceId, target: targetId },
    ]);
    setConnectionDrag(null);
  }

  function clearProject() {
    pushHistory();
    applyEditorProjectState(buildClearedProjectState({
      defaultTimelineState,
      defaultPromptFactoryState,
      defaultTemplateCenterState,
      defaultStylePresetCenterState,
      defaultModelParamCenterState,
      defaultExportPresetCenterState,
      defaultCollaborationState,
      defaultArchiveState,
      defaultPerformanceSettings,
      defaultEpisodes,
    }));
  }

  function projectPayload() {
    return stringifyProjectStoragePayload(currentProjectSnapshot(), projectSerializers);
  }

  function currentProjectSnapshot() {
    return {
      nodes,
      edges,
      view,
      settings,
      episodes,
      activeEpisodeId,
      resources,
      timeline,
      promptFactory,
      templateCenter,
      stylePresetCenter,
      modelParamCenter,
      exportPresetCenter,
      collaborationState,
      archiveState,
      exportHistory,
      performanceSettings,
      generationQueue,
      businessProject: commercialProject,
      productionEvents,
    };
  }

  async function exportProject() {
    const consistency = buildProjectConsistencyReport({
      businessProject: commercialProject,
      timeline,
      nodes,
    });
    await saveProjectAction({
      projectRepository,
      project: currentProjectSnapshot(),
      consistency,
      setCurrentProjectPath,
      setProjectMessage,
      traceAppEvent,
      refreshRecentProjects: () => loadRecentProjects().then(setRecentProjects),
      nodeCount: nodes.length,
      episodeCount: episodes.length,
    });
  }

  async function applyProject(project, path = "") {
    return applyLoadedProjectAction({
      project,
      path,
      pushHistory,
      migrateLoadedProjectMedia,
      applyEditorProjectState,
      appliedProjectOptions: {
        inferNextNodeId,
        defaultTimelineState,
        defaultPromptFactoryState,
        defaultTemplateCenterState,
        defaultStylePresetCenterState,
        defaultModelParamCenterState,
        defaultExportPresetCenterState,
        defaultCollaborationState,
        defaultArchiveState,
        defaultPerformanceSettings,
      },
      traceAppEvent,
      setProjectMessage,
    });
  }

  async function openProjectFile() {
    await openProjectFileAction({
      tauriRuntime: isTauriRuntime(),
      openProjectFileImpl: invokeOpenProjectFile,
      fileInputRef,
      projectRepository,
      applyProject,
      setProjectMessage,
      traceAppEvent,
      refreshRecentProjects: () => loadRecentProjects().then(setRecentProjects),
    });
  }

  function importProject(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      await importProjectContentAction({
        content: reader.result,
        projectRepository,
        applyProject,
        onError: (message) => alert(message),
      });
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  async function importProjectResources(event) {
    const files = Array.from(event.target.files || []);
    try {
      await importProjectResourcesAction({
        files,
        activeEpisodeId,
        summarizeText,
        persistMediaAsset: persistImportedMediaAsset,
        pushHistory,
        setResources,
        setShowResources,
        openResourceWorkbench: () => openProductionStudioView("assets", "资源已导入，已回到生产工作台资产库。"),
        setProjectMessage,
      });
    } finally {
      event.target.value = "";
    }
  }

  function updateProjectResource(resourceId, patch) {
    updateProjectResourceAction({
      resourceId,
      patch,
      setResources,
    });
  }

  function deleteProjectResource(resourceId) {
    deleteProjectResourceAction({
      resourceId,
      pushHistory,
      setResources,
    });
  }

  async function openRecentProject(path) {
    await openRecentProjectAction({
      path,
      openProjectFileAtPathImpl: invokeOpenProjectFileAtPath,
      projectRepository,
      applyProject,
      setProjectMessage,
      traceAppEvent,
      refreshRecentProjects: () => loadRecentProjects().then(setRecentProjects),
    });
  }

  function createOutputNear(sourceId, type, label, data = {}) {
    const source = nodes.find((node) => node.id === sourceId);
    const hasExplicitOffset = Object.prototype.hasOwnProperty.call(data || {}, "__offsetY");
    const autoOffsetY = type === "result" && !hasExplicitOffset
      ? edges.filter((edge) => edge.source === sourceId).reduce((count, edge) => {
        const target = nodeById.get(edge.target);
        return target?.type === "result" ? count + 1 : count;
      }, 0) * 290
      : undefined;
    const nextOutput = buildCreateOutputPayload(source, viewportCenter, activeEpisodeId, type, label, {
      ...data,
      ...(typeof autoOffsetY === "number" ? { __offsetY: autoOffsetY } : {}),
    });
    const id = addNode(type, nextOutput.position, nextOutput.payload);
    setEdges((current) => [...current, { id: `edge-${sourceId}-${id}-${Date.now()}`, source: sourceId, target: id }]);
    return id;
  }

  function ensureLinkedEdge(sourceId, targetId) {
    setEdges((current) => appendLinkedEdge(current, sourceId, targetId));
  }

  function findNearestNodeByType(sourceId, targetTypes) {
    return findNearestNodeInEpisode({
      sourceId,
      nodeById,
      nodes,
      targetTypes,
      activeEpisodeId,
    });
  }

  function syncPipelineToLinkedNodes(sourceId, pipeline, options = {}) {
    if (!pipeline) return;
    let actions = [];
    const productionJobs = [];
    const { assetPatch, hasAssets, shotPatch, hasShots } = buildPipelineSyncPayloads(pipeline);
    const sourceNode = nodeById.get(sourceId);
    const sourceEpisodeId = sourceNode?.data?.episodeId || activeEpisodeId;
    const syncPlan = buildPipelineSyncExecutionPlan({
      assetTarget: findNearestNodeByType(sourceId, "assetLibrary"),
      assetPatch,
      hasAssets,
      shotTarget: findNearestNodeByType(sourceId, "shotList"),
      shotPatch,
      hasShots,
      options,
    });
    if (syncPlan.asset) {
      const assetNodeId = applyPipelineSyncNode(sourceId, syncPlan.asset, "资产库");
      actions = appendPipelineSyncAction(actions, syncPlan.asset.message);
      if (syncPlan.asset.shouldQueueImages && assetNodeId) {
        const assetJobs = buildAssetGenerationJobs(assetNodeId, syncPlan.asset.patch, settings);
        if (assetJobs.length) {
          productionJobs.push(...assetJobs);
          actions = appendPipelineSyncAction(actions, buildPipelineSyncQueueMessage("asset", assetJobs.length));
        }
      }
    }
    if (syncPlan.shot) {
      const shotNodeId = applyPipelineSyncNode(sourceId, syncPlan.shot, "镜头表", { skipHistory: true });
      const syncedShots = (syncPlan.shot.patch.shots || []).map((shot, index) => normalizeShotRecord(shot, index));
      actions = appendPipelineSyncAction(actions, syncPlan.shot.message);
      if (syncPlan.shot.shouldSyncTimeline && shotNodeId) {
        const timelineShots = buildLinkedTimelineShots({
          shots: syncPlan.shot.patch.shots || [],
          shotNodeId,
          sourceEpisodeId,
          nodes: nodesRef.current || [],
          resources: resourcesRef.current || [],
          episodes: episodesRef.current || [],
          normalizeShotRecord,
          buildTimelineSourceFromShotRecord,
          buildProjectResourceIndex,
          pickTimelineResultUrl,
          expandResourceReferences,
        });
        if (timelineShots.length) {
          importShotsToTimelineByEpisode(sourceEpisodeId, timelineShots, { silent: true });
          actions = appendPipelineSyncAction(actions, "时间线已同步");
        }
      }
      if (syncPlan.shot.shouldQueueImages && shotNodeId && syncedShots.length) {
        const queueJobs = buildShotImageJobs(shotNodeId, syncedShots, {
          settings,
          assets: commercialProject?.activeEpisode?.assets || [],
          buildImageShotPrompt: (shot) => buildImageShotPrompt(shot, assetIndex, resourceIndex),
          resolveShotImageProviderMode,
        });
        if (queueJobs.length) {
          productionJobs.push(...queueJobs);
          actions = appendPipelineSyncAction(actions, buildPipelineSyncQueueMessage("shot", queueJobs.length));
        }
      }
    }
    if (productionJobs.length) {
      addGenerationJobsAndMaybeRun(productionJobs, { autoRun: options.autoRunQueue });
    }
    traceAppEvent("node.link.sync", buildPipelineSyncTracePayload(sourceId, syncPlan, actions, options));
    if (actions.length) setProjectMessage(actions.join(" · "));
  }

  function applyPipelineSyncNode(sourceId, plan, label, createOptions = {}) {
    if (!plan) return "";
    if (plan.mode === "updated") {
      updateNode(plan.targetId, plan.patch);
      ensureLinkedEdge(sourceId, plan.targetId);
      return plan.targetId;
    }
    return createOutputNear(sourceId, plan.targetType, label, plan.patch, createOptions);
  }

  function buildAssetGenerationJobs(assetNodeId, assetPatch = {}, baseSettings = {}) {
    const providerMode = normalizeImageProviderMode(currentProviderMode(baseSettings));
    return buildAssetImageJobs(assetNodeId, assetPatch, {
      providerMode,
      normalizeAsset,
      buildAssetPromptPayload,
    });
  }

  function getActiveEpisodeShotEntries() {
    const episodeId = activeEpisodeIdRef.current || activeEpisodeId;
    return (nodesRef.current || [])
      .filter((node) => node.type === "shotList" && isNodeVisibleInEpisode(node, episodeId, episodesRef.current || episodes))
      .flatMap((node) => (node.data?.shots || []).map((shot, index) => ({
        node,
        shot: normalizeShotRecord(shot, index),
      })));
  }

    function getActiveBusinessShotEntries() {
      const businessShots = commercialProject?.activeEpisode?.shots || [];
      if (!businessShots.length) return getActiveEpisodeShotEntries();
      const fallbackShotNode = findEpisodeNodeByType("shotList", commercialProject?.activeEpisode?.id || activeEpisodeId);
      return businessShots
        .map((shot, index) => ({
          node: { id: shot.sourceNodeId || fallbackShotNode?.id || "" },
          shot: normalizeShotRecord(shot, index),
        }))
        .filter(({ node }) => node.id);
    }

    async function uploadActiveShotImage(imageUrl = "", context = {}) {
      const sourceUrl = String(imageUrl || "").trim();
      if (!sourceUrl) throw new Error("请先选择一张本地图片。");
      const entries = getActiveBusinessShotEntries();
      const target = selectUploadShotTarget(entries, { shotId: context.shotId, kind: "image" });
      if (!target?.shot?.id) throw new Error("当前集还没有可回填图片的镜头，请先生成文本方案。");
      const persisted = await persistImportedImage({
        imageUrl: sourceUrl,
        fileName: context.fileName || `${target.shot.id}-upload-image`,
      });
      const uploadAction = buildShotImageUploadAction({
        projectId: commercialProject?.id || "",
        episodeId: commercialProject?.activeEpisode?.id || activeEpisodeId,
        target,
        persisted,
        sourceUrl,
      });
      const { job, result, media } = uploadAction;
      if (job.sourceNodeId && nodeById.has(job.sourceNodeId)) {
        createOutputNear(
          job.sourceNodeId,
          "result",
          job.title,
          buildQueueResultNodePayload(job, result),
        );
      }
      const applied = projectCommandService.commitUploadedMedia({
        job,
        result,
        media,
        events: productionEvents,
      });
      markShotProgressFromQueue(job, applied.patch || buildQueueShotSuccessPatch(job, result));
      syncLegacyCanvasFromBusinessProject(applied.project);
      if (job.sourceNodeId && target.shot) {
        upsertTimelineClipFromShot(
          job.sourceNodeId,
          buildTimelineShotPatchFromQueue(job, result, target.shot),
          { silent: true },
        );
      }
      setProjectMessage(`已上传图片并回填到 ${target.shot.id}`);
      return {
        title: "图片已上传",
        summary: `已把本地图片回填到 ${target.shot.id}。`,
        metrics: [{ label: "镜头", value: target.shot.id }],
      };
    }

    async function uploadActiveShotVideo(videoUrl = "", context = {}) {
      if (shouldWarnBrowserLargeVideoUpload(context.file)) {
        setProjectMessage("浏览器模式会读取大视频作为临时数据，建议使用桌面版上传 200MB 以上视频。");
      }
      const filePath = resolveUploadFilePath(context.file);
      const sourceUrl = String(videoUrl || context.mediaPath || filePath || "").trim();
      if (!sourceUrl && !context.file) throw new Error("请先选择一个本地视频。");
      const entries = getActiveBusinessShotEntries();
      const target = selectUploadShotTarget(entries, { shotId: context.shotId, kind: "video" });
      if (!target?.shot?.id) throw new Error("当前集还没有可回填视频的镜头，请先生成文本方案。");
      const persisted = await persistImportedMediaAsset({
        mediaUrl: sourceUrl,
        mediaFile: context.file || null,
        mediaType: "video",
        fileName: context.fileName || `${target.shot.id}-upload-video`,
      });
      const uploadAction = buildShotVideoUploadAction({
        projectId: commercialProject?.id || "",
        episodeId: commercialProject?.activeEpisode?.id || activeEpisodeId,
        target,
        persisted,
        sourceUrl,
      });
      const { job, result, media } = uploadAction;
      if (job.sourceNodeId && nodeById.has(job.sourceNodeId)) {
        createOutputNear(
          job.sourceNodeId,
          "result",
          job.title,
          buildQueueResultNodePayload(job, result),
        );
      }
      const applied = projectCommandService.commitUploadedMedia({
        job,
        result,
        media,
        events: productionEvents,
      });
      markShotProgressFromQueue(job, applied.patch || buildQueueShotSuccessPatch(job, result));
      if (job.sourceNodeId && target.shot) {
        upsertTimelineClipFromShot(
          job.sourceNodeId,
          buildTimelineShotPatchFromQueue(job, result, target.shot),
          { silent: true },
        );
      }
      setProjectMessage(`已上传视频并回填到 ${target.shot.id}`);
      return {
        title: "视频已上传",
        summary: `已把本地视频回填到 ${target.shot.id}。`,
        metrics: [{ label: "镜头", value: target.shot.id }],
      };
    }

    async function uploadActiveAssetImage(asset = {}, imageUrl = "", context = {}) {
      const sourceUrl = String(imageUrl || "").trim();
      if (!sourceUrl) throw new Error("请先选择一张本地图片。");
      const targetId = String(asset.id || asset.token || asset.name || "").trim();
      if (!targetId) throw new Error("当前资产缺少 id、token 或名称，无法回填图片。");
      const persisted = await persistImportedImage({
        imageUrl: sourceUrl,
        fileName: context.fileName || `${asset.name || asset.token || targetId}-asset-upload`,
      });
      const uploadAction = buildAssetImageUploadAction({
        projectId: commercialProject?.id || "",
        episodeId: commercialProject?.activeEpisode?.id || activeEpisodeId,
        asset,
        targetId,
        persisted,
        sourceUrl,
      });
      const { job, result, media } = uploadAction;
      if (job.sourceNodeId) {
        patchAssetRecord(job.sourceNodeId, job.sourceAssetToken, job.assetCategory, {
          imageUrl: result.imageUrl || "",
          imagePath: result.imagePath || "",
          originalImageUrl: result.originalImageUrl || "",
          imageThumbnailUrl: result.imageThumbnailUrl || "",
          imageThumbnailPath: result.imageThumbnailPath || "",
          lastImageSavedAt: Date.now(),
        });
      }
      const applied = projectCommandService.commitUploadedMedia({
        job,
        result,
        media,
        events: productionEvents,
      });
      syncLegacyCanvasFromBusinessProject(applied.project);
      setProjectMessage(`已上传资产定妆图：${asset.name || asset.token || targetId}`);
      return {
        title: "资产图已上传",
        summary: `已把本地图片设为 ${asset.name || asset.token || targetId} 的定妆图。`,
        metrics: [{ label: "资产", value: asset.name || asset.token || targetId }],
      };
    }
  
    async function queueActiveEpisodeImages(options = {}) {
    const providerMode = normalizeImageProviderMode(options.providerMode || currentProviderMode(settings));
    return queueEpisodeMediaAction({
      mediaKind: "image",
      providerMode,
      options,
      checkPreflight: () => checkImageTaskPreflight(commercialProject),
      notifyTaskBlocked,
      ensureProviderReady,
      uploadSummary: providerMode === "upload"
        ? "当前已切换为本地上传，请在镜头表或媒体生产页选择图片文件。"
        : "",
      setProjectMessage,
      planProductionJobs: () => planImageQueueJobsFromProductionService({
        productionAppService,
        commercialProject,
        providerMode,
        events: productionEvents,
      }),
      productionCommandContext,
      commitPlannedQueueJobs,
      setShowQueue,
      buildLegacyJobs: () => {
        const businessEpisode = commercialProject?.activeEpisode;
        const entries = getActiveBusinessShotEntries()
          .filter(({ shot }) => !String(shot.imageResultUrl || "").trim());
        const jobs = entries.flatMap(({ node, shot }) => buildShotImageJobs(node.id, [shot], {
          settings,
          assets: businessEpisode?.assets || [],
          buildImageShotPrompt: (item) => item.imagePrompt || buildImageShotPrompt(item, assetIndex, resourceIndex),
          resolveShotImageProviderMode,
        }));
        return { businessEpisode, entries, jobs };
      },
      prepareCommand: ({ businessEpisode, entries, jobs }) => prepareImageQueueCommand({
        episode: businessEpisode,
        businessOptions: {
          requireSourceNode: true,
          settings,
          buildImageShotPrompt: (item) => item.imagePrompt || buildImageShotPrompt(item, assetIndex, resourceIndex),
          resolveShotImageProviderMode,
        },
        legacyJobs: jobs,
        legacyEntryCount: entries.length,
      }),
      addGenerationJobsAndMaybeRun,
    });
  }

  async function queueActiveAssetImage(asset = {}, options = {}) {
    const targetId = String(asset.id || asset.token || asset.name || "").trim();
    if (!targetId) {
      const result = {
        title: "资产缺少标识",
        summary: "当前资产缺少 id、token 或名称，无法定位生成任务。",
      };
      setProjectMessage(result.summary);
      return result;
    }
    const providerMode = normalizeImageProviderMode(options.providerMode || currentProviderMode(settings));
    const preflight = checkImageTaskPreflight(commercialProject, { asset });
    if (!preflight.ok) {
      notifyTaskBlocked(preflight.message);
      return { title: "资产图未入队", summary: preflight.message };
    }
    if (!(await ensureProviderReady("image", providerMode))) {
      return { title: "资产图未入队", summary: "图片供应商连接或配置未通过体检。" };
    }
    const productionPlan = planImageQueueJobsFromProductionService({
      productionAppService,
      commercialProject,
      providerMode,
      events: productionEvents,
    });
    const jobs = (productionPlan.jobs || []).filter((job) => (
      job.type === "asset.image"
      && [job.targetId, job.sourceAssetToken, job.sourceAssetName, job.title]
        .some((value) => String(value || "").includes(targetId))
    ));
    const prompt = String(asset.canonicalPrompt || asset.prompt || asset.visualLock || asset.description || asset.name || asset.token || "").trim();
    const fallbackJobs = jobs.length || !prompt ? jobs : [{
      type: "asset.image",
      kind: "image",
      episodeId: commercialProject?.activeEpisode?.id || commercialProject?.activeEpisodeId || "",
      targetType: "asset",
      targetId,
      sourceAssetToken: asset.token || "",
      sourceAssetName: asset.name || "",
      assetCategory: asset.typeLabel || asset.category || asset.type || "资产",
      title: `${asset.name || asset.token || targetId}-定妆图`,
      prompt,
      providerMode,
      imageProviderMode: providerMode,
      priority: "高",
      queueStage: "asset-image",
    }];
    if (!fallbackJobs.length) {
      const summary = `没有找到 ${asset.name || asset.token || "该资产"} 的可执行资产图任务，请检查资产提示词或图片供应商模式。`;
      setProjectMessage(summary);
      return { title: "资产图未入队", summary };
    }
    commitPlannedQueueJobs(productionCommandContext, { ...productionPlan, jobs: fallbackJobs }, {
      autoRun: options.autoRun !== false,
      message: `已加入 ${asset.name || asset.token || targetId} 的资产图任务。`,
    });
    setShowQueue(true);
    const summary = `已加入 ${asset.name || asset.token || targetId} 的资产图任务。`;
    return {
      title: "资产图任务已入队",
      summary,
      metrics: [{ label: "资产图", value: fallbackJobs.length }],
    };
  }

  async function queueActiveShotImage(shot = {}, options = {}) {
    const shotId = String(shot.id || "").trim();
    if (!shotId) {
      const summary = "当前镜头缺少编号，无法加入图片生成任务。";
      setProjectMessage(summary);
      return { title: "镜头图片未入队", summary };
    }
    const providerMode = normalizeImageProviderMode(options.providerMode || currentProviderMode(settings));
    const preflight = checkImageTaskPreflight(commercialProject, { shot });
    if (!preflight.ok) {
      notifyTaskBlocked(preflight.message);
      return { title: "镜头图片未入队", summary: preflight.message };
    }
    if (!(await ensureProviderReady("image", providerMode))) {
      return { title: "图片任务未入队", summary: "图片供应商连接或配置未通过体检。" };
    }
    if (providerMode === "upload") {
      const summary = `${shotId} 已切换为本地上传，请选择图片文件。`;
      setProjectMessage(summary);
      return { title: "等待上传", summary };
    }
    const productionPlan = planImageQueueJobsFromProductionService({
      productionAppService,
      commercialProject,
      providerMode,
      events: productionEvents,
    });
    const plannedJobs = (productionPlan.jobs || []).filter((job) => (
      job.type === "shot.image" && (job.shotId === shotId || job.targetId === shotId)
    ));
    const target = getActiveBusinessShotEntries().find((entry) => entry.shot.id === shotId) || null;
    const fallbackJobs = plannedJobs.length || !target
      ? plannedJobs
      : buildShotImageJobs(target.node.id, [target.shot], {
        settings,
        assets: commercialProject?.activeEpisode?.assets || [],
        buildImageShotPrompt: (item) => item.imagePrompt || buildImageShotPrompt(item, assetIndex, resourceIndex),
        resolveShotImageProviderMode: () => providerMode,
      });
    if (!fallbackJobs.length) {
      const summary = `${shotId} 没有可执行的图片任务，请检查图片提示词或供应商模式。`;
      setProjectMessage(summary);
      return { title: "镜头图片未入队", summary };
    }
    const queueJobs = options.reviewComment
      ? fallbackJobs.map((job) => ({ ...job, reviewRepair: true, reviewComment: options.reviewComment }))
      : fallbackJobs;
    if (options.reviewComment) {
      projectCommandService.updateShotReviewStatus({
        episodeId: commercialProject?.activeEpisode?.id || activeEpisodeId,
        shotId,
        reviewStatus: "返修中",
        comment: options.reviewComment,
        reviewer: "studio",
        reviewedAt: new Date().toISOString(),
      });
    }
    commitPlannedQueueJobs(productionCommandContext, { ...productionPlan, jobs: queueJobs }, {
      autoRun: options.autoRun !== false,
      message: `已加入 ${shotId} 的图片生成任务。`,
    });
    setShowQueue(true);
    const summary = `已加入 ${shotId} 的图片生成任务。`;
    return { title: "镜头图片已入队", summary, metrics: [{ label: "图片任务", value: fallbackJobs.length }] };
  }

  async function queueActiveShotVideo(shot = {}, options = {}) {
    const shotId = String(shot.id || "").trim();
    if (!shotId) {
      const summary = "当前镜头缺少编号，无法加入视频生成任务。";
      setProjectMessage(summary);
      return { title: "镜头视频未入队", summary };
    }
    const providerMode = normalizeVideoProviderMode(options.providerMode || currentProviderMode(settings));
    const preflight = checkVideoTaskPreflight(commercialProject, { shot });
    if (!preflight.ok) {
      notifyTaskBlocked(preflight.message);
      return { title: "镜头视频未入队", summary: preflight.message };
    }
    if (!(await ensureProviderReady("video", providerMode))) {
      return { title: "视频任务未入队", summary: "视频供应商连接或配置未通过体检。" };
    }
    if (providerMode === "upload") {
      const summary = `${shotId} 已切换为本地上传，请选择视频文件。`;
      setProjectMessage(summary);
      return { title: "等待上传", summary };
    }
    const productionPlan = planVideoQueueJobsFromProductionService({
      productionAppService,
      commercialProject,
      providerMode,
      events: productionEvents,
    });
    const plannedJobs = (productionPlan.jobs || []).filter((job) => (
      job.type === "shot.video" && (job.shotId === shotId || job.targetId === shotId)
    ));
    const target = getActiveBusinessShotEntries().find((entry) => entry.shot.id === shotId) || null;
    const fallbackJobs = plannedJobs.length || !target
      ? plannedJobs
      : [buildShotVideoJob(target.node.id, target.shot, {
        settings,
        buildVideoShotPrompt: (item) => item.videoPrompt || buildVideoShotPrompt(item, assetIndex, resourceIndex),
        resolveShotVideoProviderMode: () => providerMode,
      })].filter(Boolean);
    if (!fallbackJobs.length) {
      const summary = `${shotId} 没有可执行的视频任务，请检查视频提示词或供应商模式。`;
      setProjectMessage(summary);
      return { title: "镜头视频未入队", summary };
    }
    const queueJobs = options.reviewComment
      ? fallbackJobs.map((job) => ({ ...job, reviewRepair: true, reviewComment: options.reviewComment }))
      : fallbackJobs;
    if (options.reviewComment) {
      projectCommandService.updateShotReviewStatus({
        episodeId: commercialProject?.activeEpisode?.id || activeEpisodeId,
        shotId,
        reviewStatus: "返修中",
        comment: options.reviewComment,
        reviewer: "studio",
        reviewedAt: new Date().toISOString(),
      });
    }
    commitPlannedQueueJobs(productionCommandContext, { ...productionPlan, jobs: queueJobs }, {
      autoRun: options.autoRun !== false,
      message: `已加入 ${shotId} 的视频生成任务。`,
    });
    setShowQueue(true);
    const summary = `已加入 ${shotId} 的视频生成任务。`;
    return { title: "镜头视频已入队", summary, metrics: [{ label: "视频任务", value: fallbackJobs.length }] };
  }

  async function queueActiveEpisodeVideos(options = {}) {
      const providerMode = normalizeVideoProviderMode(options.providerMode || currentProviderMode(settings));
      return queueEpisodeMediaAction({
        mediaKind: "video",
        providerMode,
        options,
        checkPreflight: () => checkVideoTaskPreflight(commercialProject),
        notifyTaskBlocked,
        ensureProviderReady,
        setProjectMessage,
        planProductionJobs: () => planVideoQueueJobsFromProductionService({
          productionAppService,
          commercialProject,
          providerMode,
          events: productionEvents,
        }),
        productionCommandContext,
        commitPlannedQueueJobs,
        setShowQueue,
        buildLegacyJobs: () => {
          const businessEpisode = commercialProject?.activeEpisode;
          const entries = getActiveBusinessShotEntries()
            .filter(({ shot }) => !String(shot.videoResultUrl || "").trim());
          const jobs = entries
            .map(({ node, shot }) => buildShotVideoJob(node.id, shot, {
              settings,
              buildVideoShotPrompt: (item) => item.videoPrompt || buildVideoShotPrompt(item, assetIndex, resourceIndex),
              resolveShotVideoProviderMode,
            }))
            .filter(Boolean);
          return { businessEpisode, entries, jobs };
        },
        prepareCommand: ({ businessEpisode, entries, jobs }) => prepareVideoQueueCommand({
          episode: businessEpisode,
          businessOptions: {
            requireSourceNode: true,
            settings,
            buildVideoShotPrompt: (item) => item.videoPrompt || buildVideoShotPrompt(item, assetIndex, resourceIndex),
            resolveShotVideoProviderMode,
          },
          legacyJobs: jobs,
          legacyEntryCount: entries.length,
        }),
        addGenerationJobsAndMaybeRun,
      });
  }

  async function ensureProviderReady(kind = "image", providerMode = "") {
    const config = checkMediaProviderConfig(settings, { kind, providerMode });
    if (!config.ok) {
      notifyTaskBlocked(config.message, kind === "video" ? "video" : "image");
      return false;
    }
    if (["upload", "mock", "inherit"].includes(String(providerMode || "").toLowerCase())) return true;
    const blockers = providerHealthReport?.blockers || [];
    const targetKeys = providerMode === "comfy"
      ? ["comfy"]
      : kind === "video"
        ? ["video"]
        : ["image", "customImage"];
    const blocker = blockers.find((item) => targetKeys.includes(item.key));
    if (blocker) {
      notifyTaskBlocked(`模型服务体检未通过：${blocker.message}`, kind === "video" ? "video" : "image");
      return false;
    }
    const live = await runProviderLiveCheck({
      [providerMode === "comfy" ? "ComfyUI" : `${kind === "video" ? "视频" : "图片"} API`]: () => pingMediaProvider(settings, providerMode),
    }, { timeoutMs: 6000 });
    if (live.ok) return true;
    notifyTaskBlocked(`模型服务连接失败，任务已停止：${live.failed[0]?.detail || "无法连接供应商"}`, kind === "video" ? "video" : "image");
    return false;
  }

  async function pingMediaProvider(currentSettings = {}, providerMode = "") {
    if (providerMode === "comfy") {
      const detail = await testComfyConnection(currentSettings);
      return { ok: true, detail };
    }
    return pingHttpEndpoint(currentSettings.customApiUrl, {
      allowClientErrors: true,
      headers: buildApiPingHeaders(currentSettings.customApiKey || currentSettings.imageApiKey || currentSettings.videoApiKey || ""),
    });
  }

  async function pingHttpEndpoint(url = "", options = {}) {
    const target = String(url || "").trim();
    if (!target) throw new Error("未配置服务地址");
    const response = await fetch(target, {
      method: "GET",
      headers: options.headers || {},
    });
    const reachable = options.allowClientErrors ? response.status < 500 && ![401, 403].includes(response.status) : response.ok;
    if (!reachable) throw new Error(`HTTP ${response.status}`);
    return { ok: true, detail: `HTTP ${response.status}` };
  }

  function buildApiPingHeaders(apiKey = "") {
    const key = String(apiKey || "").trim();
    return key ? { Authorization: `Bearer ${key}` } : {};
  }

  function notifyTaskBlocked(message = "", settingsFocus = "") {
    const text = message || "任务前置检查未通过，已停止执行。";
    setProjectMessage(text);
    if (settingsFocus) openSettingsPanel(settingsFocus);
    if (typeof window !== "undefined" && typeof window.alert === "function") {
      window.setTimeout(() => window.alert(text), 0);
    }
  }

  function runProductionReview() {
    const result = productionAppService.runReview({
      commercialProject,
      events: productionEvents,
      reviewOptions: {
        outputSpec: productionState.project?.productionBible?.outputSpec || { aspectRatio: "9:16" },
        reviewer: "system",
        reviewedAt: new Date().toISOString(),
      },
    });
    setProductionEvents(result.events || productionEvents);
    const issueCount = result.review?.issues?.length || 0;
    const approved = result.review?.result === "approved";
    openProductionStudioView("review", approved
      ? "Production OS 审片通过：当前集达到交付质检标准。"
      : `Production OS 审片完成：发现 ${issueCount} 个问题，已打开生产工作台审片。`);
    return {
      title: approved ? "审片通过" : "审片需修改",
      summary: approved ? "当前集通过 Production OS 审片门禁。" : `发现 ${issueCount} 个问题，请按返修计划处理。`,
      metrics: [{ label: "问题", value: issueCount }],
    };
  }

  function setShotReviewStatus(shot = {}, reviewStatus = "已通过", options = {}) {
    const shotId = shot.id || options.shotId || "";
    if (!shotId) return null;
    pushHistory();
    const result = projectCommandService.updateShotReviewStatus({
      episodeId: commercialProject?.activeEpisode?.id || activeEpisodeId,
      shotId,
      reviewStatus,
      comment: options.comment || "",
      reviewer: options.reviewer || "studio",
      reviewedAt: new Date().toISOString(),
    });
    setProjectMessage(`已更新审片状态：${shotId} · ${reviewStatus}`);
    return result;
  }

  function syncTimelineFromShots() {
    pushHistory();
    const result = projectCommandService.syncTimelineFromShots({
      episodeId: commercialProject?.activeEpisode?.id || activeEpisodeId,
    });
    syncLegacyTimelineFromBusinessProject(result.project, commercialProject?.activeEpisode?.id || activeEpisodeId);
    setProjectMessage("已按商业模型把镜头视频同步到时间线。");
    return result;
  }

  function moveStudioTimelineClip(clip = {}, moveBy = 0) {
    const result = projectCommandService.updateTimelineClip({
      episodeId: commercialProject?.activeEpisode?.id || activeEpisodeId,
      clipId: clip.id || clip.shotId || "",
      moveBy,
    });
    syncLegacyTimelineFromBusinessProject(result.project, commercialProject?.activeEpisode?.id || activeEpisodeId);
    setProjectMessage(`已调整时间线片段顺序：${clip.title || clip.shotId || clip.id}`);
    return result;
  }

  function updateStudioTimelineClipDuration(clip = {}, duration = "") {
    const result = projectCommandService.updateTimelineClip({
      episodeId: commercialProject?.activeEpisode?.id || activeEpisodeId,
      clipId: clip.id || clip.shotId || "",
      patch: { duration: duration || "4秒" },
    });
    syncLegacyTimelineFromBusinessProject(result.project, commercialProject?.activeEpisode?.id || activeEpisodeId);
    setProjectMessage(`已更新时间线时长：${clip.title || clip.shotId || clip.id}`);
    return result;
  }

  function updateStudioTimelineClip(clip = {}, patch = {}) {
    const result = projectCommandService.updateTimelineClip({
      episodeId: commercialProject?.activeEpisode?.id || activeEpisodeId,
      clipId: clip.id || clip.shotId || "",
      patch,
    });
    syncLegacyTimelineFromBusinessProject(result.project, commercialProject?.activeEpisode?.id || activeEpisodeId);
    setProjectMessage(`已更新时间线片段：${clip.title || clip.shotId || clip.id}`);
    return result;
  }

  function removeStudioTimelineClip(clip = {}) {
    const result = projectCommandService.updateTimelineClip({
      episodeId: commercialProject?.activeEpisode?.id || activeEpisodeId,
      clipId: clip.id || clip.shotId || "",
      remove: true,
    });
    syncLegacyTimelineFromBusinessProject(result.project, commercialProject?.activeEpisode?.id || activeEpisodeId);
    setProjectMessage(`已删除时间线片段：${clip.title || clip.shotId || clip.id}`);
    return result;
  }

  function syncStudioTimelineClipMedia(clip = {}) {
    const shot = (commercialProject?.activeEpisode?.shots || []).find((item) => String(item.id || "") === String(clip.shotId || ""));
    const patch = buildTimelineClipMediaPatchFromShot(shot);
    if (!patch) {
      setProjectMessage(`镜头 ${clip.shotId || clip.id} 还没有可同步素材。`);
      return null;
    }
    pushHistory();
    const result = projectCommandService.updateTimelineClip({
      episodeId: commercialProject?.activeEpisode?.id || activeEpisodeId,
      clipId: clip.id || clip.shotId || "",
      patch,
    });
    syncLegacyTimelineFromBusinessProject(result.project, commercialProject?.activeEpisode?.id || activeEpisodeId);
    setProjectMessage(`已同步片段素材：${clip.title || clip.shotId || clip.id}`);
    return result;
  }

  function setStudioTimelineClipReviewStatus(clip = {}, reviewStatus = "已通过") {
    pushHistory();
    const result = projectCommandService.updateTimelineClip({
      episodeId: commercialProject?.activeEpisode?.id || activeEpisodeId,
      clipId: clip.id || clip.shotId || "",
      patch: { reviewStatus, approvalStatus: reviewStatus },
    });
    syncLegacyTimelineFromBusinessProject(result.project, commercialProject?.activeEpisode?.id || activeEpisodeId);
    setProjectMessage(`已更新时间线验收：${clip.title || clip.shotId || clip.id} · ${reviewStatus}`);
    return result;
  }

  function syncLegacyTimelineFromBusinessProject(project = null, episodeId = activeEpisodeId) {
    const episode = project?.episodes?.find((item) => item.id === episodeId) || project?.activeEpisode || null;
    if (!episode) return;
    const legacyEpisodeTimeline = businessTimelineClipsToLegacyEpisodeTimeline(episode.timeline?.clips || []);
    updateTimelineEpisode(episode.id || episodeId, () => legacyEpisodeTimeline, { syncBusiness: false });
  }

  function repairLegacyTimelineFromBusiness() {
    return repairLegacyTimelineFromBusinessAction({
      commercialProject,
      activeEpisodeId,
      pushHistory,
      syncLegacyTimelineFromBusinessProject,
      setProjectMessage,
    });
  }

  function repairBusinessTimelineFromLegacy() {
    return repairBusinessTimelineFromLegacyAction({
      commercialProject,
      activeEpisodeId,
      timeline,
      defaultEpisodeTimeline,
      getEpisodeTimeline,
      pushHistory,
      projectCommandService,
      setProjectMessage,
    });
  }

  function relocateMediaRoot(oldRoot = "", newRoot = "") {
    return relocateMediaRootAction({
      commercialProject,
      oldRoot,
      newRoot,
      buildMediaRelocationPlan,
      projectCommandService,
      pushHistory,
      syncLegacyTimelineFromBusinessProject,
      activeEpisodeId,
      setProjectMessage,
    });
  }

  function repairAssetConsistency() {
    return repairAssetConsistencyAction({
      commercialProject,
      activeEpisodeId,
      projectCommandService,
      setProjectMessage,
    });
  }

  function repairMediaIntegrity() {
    return repairMediaIntegrityAction({
      commercialProject,
      activeEpisodeId,
      projectCommandService,
      syncLegacyTimelineFromBusinessProject,
      setProjectMessage,
    });
  }

  function runFullChainCheck() {
    return runFullChainCheckAction({
      syncTimelineFromShots,
      productionAppService,
      projectStoreStateRef,
      commercialProject,
      productionEvents,
      productionState,
      buildStudioDeliveryOutputSpec,
      setProductionEvents,
      openProductionStudioView,
    });
  }

  function runSystemSelfCheck() {
    return runSystemSelfCheckAction({
      setShowDashboard,
      setProjectMessage,
    });
  }

  function focusMainChain() {
    return focusMainChainNavigation({
      setShowDashboard,
      setShowHealth,
      setShowGlobalAssets,
      setShowResources,
      setShowSearch,
      setShowDebugTracePanel,
      setShowPromptFactory,
      setShowTemplateCenter,
      setShowStylePresetCenter,
      setShowModelParamCenter,
      setShowExportPresetCenter,
      setShowDirectorAssistant,
      setShowReviewCenter,
      setShowCollaborationCenter,
      setShowProductionHub,
      setShowArchiveCenter,
      setShowTimeline,
      setShowQueue,
      openProductionStudioView,
    });
  }

  async function planProductionDelivery(options = {}) {
    return planProductionDeliveryAction({
      options,
      commercialProject,
      activeEpisodeId,
      productionEvents,
      productionAppService,
      projectCommandService,
      resourceIndex,
      buildStudioDeliveryOutputSpec,
      buildStudioPackageHistoryEntry,
      buildStudioDeliveryPackageContent,
      queueEpisodeRender,
      queueDeliveryPackageJobs: queueDeliveryPackageJobsAction,
      safeFileName,
      setProductionEvents,
      setProjectMessage,
      openProductionStudioView,
      addGenerationJobs,
      appendExportHistory,
      setShowQueue,
      scheduleRunQueue: () => window.setTimeout(() => runGenerationQueue(), 0),
    });
  }

  async function exportAssetsAndStoryboard() {
    return exportAssetsAndStoryboardAction({
      commercialProject,
      activeEpisodeId,
      timeline,
      resources,
      getEpisodeTimeline,
      defaultEpisodeTimeline,
      safeFileName,
      saveExportArtifact,
      setProjectMessage,
      openProductionStudioView,
    });
  }

  function openAdvancedCanvas() {
    openAdvancedCanvasNavigation({
      commercialProject,
      nodes,
      nodesRef,
      edges,
      viewportCenter,
      mergeAdvancedCanvasProjection,
      setNodes,
      setEdges,
      setShowCompatibilityCanvas,
      setShowProjectStudio,
      setProjectMessage,
    });
  }

  function openProductionStudio(message = "已返回生产工作台。") {
    openProductionStudioNavigation({
      projectStoreStateRef,
      syncLegacyCanvasFromBusinessProject,
      setShowCompatibilityCanvas,
      setShowProjectStudio,
      setProjectMessage,
      message,
    });
  }

  function openProductionStudioView(view = "overview", message = "已定位到生产工作台。") {
    openProductionStudioViewNavigation({
      view,
      message,
      setStudioViewRequest,
      openProductionStudio,
    });
  }

  async function generateStudioTextPlan(sourceText) {
    const preflight = checkTextTaskPreflight({ sourceText, textApiSettings });
    if (!preflight.ok) {
      notifyTaskBlocked(preflight.message, "text");
      return { title: "文字任务未启动", summary: preflight.message };
    }
    if (!isLocalTextMode(textApiSettings)) {
      const live = await runProviderLiveCheck({
        "文本 API": () => pingTextApiProvider(textApiSettings),
      }, { timeoutMs: 6000 });
      if (!live.ok) {
        const summary = `文本 API 连接失败，文字任务已停止：${live.failed[0]?.detail || "无法连接文本供应商"}`;
        notifyTaskBlocked(summary, "text");
        return { title: "文字任务未启动", summary };
      }
    }
    return submitSimpleNovelFlow(sourceText, { autoRun: false, skipPreflight: true });
  }

  async function runStudioTemplateChain(sourceText) {
    setProjectMessage("正在执行模板 1/4：小说转剧本...");
    const scriptStep = await runNovelFactoryApi(
      buildHealthFixApiConfig(buildStudioTemplateInput(sourceText), ACTIVE_NOVEL_TEMPLATE_DEFAULT, "严格按模板1输出 JSON"),
      parseNovelScriptPackageOutput,
    );
    setProjectMessage("正在执行模板 2/4：提示词评价...");
    const reviewStep = await runNovelFactoryApi(
      buildHealthFixApiConfig(JSON.stringify({
        projectId: currentProjectPath || activeEpisodeIdRef.current || "local-project",
        scriptPackage: scriptStep.scriptPackage,
      }, null, 2), ACTIVE_NOVEL_REVIEW_TEMPLATE_DEFAULT, "严格按模板2输出 JSON"),
      parseNovelReviewPackageOutput,
    );
    setProjectMessage("正在执行模板 3/4：资产提取...");
    const assetStep = await runNovelFactoryApi(
      buildHealthFixApiConfig(JSON.stringify({
        projectId: currentProjectPath || activeEpisodeIdRef.current || "local-project",
        scriptPackage: scriptStep.scriptPackage,
        reviewPackage: reviewStep.reviewPackage,
        gatePackage: reviewStep.gatePackage,
        assetExtractionBrief: reviewStep.gatePackage?.assetExtractionBrief,
      }, null, 2), ACTIVE_NOVEL_ASSET_TEMPLATE_DEFAULT, "严格按模板3输出 JSON"),
      parseNovelAssetRegistryOutput,
    );
    setProjectMessage("正在执行模板 4/4：分镜提示词...");
    const storyboardStep = await runNovelFactoryApi(
      buildHealthFixApiConfig(JSON.stringify({
        projectId: currentProjectPath || activeEpisodeIdRef.current || "local-project",
        scriptPackage: scriptStep.scriptPackage,
        gatePackage: reviewStep.gatePackage,
        storyboardBrief: reviewStep.gatePackage?.storyboardBrief,
        assetRegistry: assetStep.assetRegistry,
        targetRenderer: "generic",
        shotDurationPolicy: "e15_author_timeline",
      }, null, 2), ACTIVE_NOVEL_PROMPT_TEMPLATE_DEFAULT, "严格按模板4输出 JSON"),
      parseNovelStoryboardPackageOutput,
    );
    return buildPipelineFromTemplateChain({
      sourceText,
      scriptStep,
      reviewStep,
      assetStep,
      storyboardStep,
    });
  }

  function buildStudioTemplateInput(sourceText) {
    return JSON.stringify({
      projectId: currentProjectPath || activeEpisodeIdRef.current || "local-project",
      mode: "novel",
      duration: "短剧漫剧默认时长",
      episodes: "当前集",
      inputSummary: sourceText,
      stylePreset: "项目默认风格",
      genre: "短剧漫剧",
      audience: "短视频观众",
      tone: "高密度、可视化、强钩子",
      ending: "保留尾钩",
      previousReviewPackage: null,
    }, null, 2);
  }

  async function pingTextApiProvider(currentSettings = {}) {
    const providerPreset = NOVEL_API_PROVIDERS[currentSettings.apiProvider] || NOVEL_API_PROVIDERS.openai;
    const apiUrl = currentSettings.apiUrl || buildNovelChatCompletionsUrl(currentSettings.apiBaseUrl || providerPreset.baseUrl);
    return pingHttpEndpoint(apiUrl, {
      allowClientErrors: true,
      headers: buildTextApiPingHeaders(currentSettings),
    });
  }

  function buildTextApiPingHeaders(currentSettings = {}) {
    const headers = { "Content-Type": "application/json" };
    const key = String(currentSettings.apiKey || "").trim();
    if (!key) return headers;
    if ((currentSettings.authType || "bearer") === "x-api-key") return { ...headers, "x-api-key": key };
    return { ...headers, Authorization: `Bearer ${key}` };
  }

  function sendImageToLinkedNode(sourceId, targetType, payload) {
    const target = findNearestNodeByType(sourceId, targetType);
    const plan = planPipelineNodeSync(target, targetType, payload, linkedNodeLabel(targetType));
    if (plan.mode === "updated") {
      updateNode(plan.targetId, plan.patch);
      ensureLinkedEdge(sourceId, plan.targetId);
      return buildNodeSyncOutcome("updated", plan.targetId);
    }
    const targetId = createOutputNear(sourceId, targetType, linkedNodeLabel(targetType), plan.patch);
    return buildNodeSyncOutcome("created", targetId);
  }

  function appendShotsToNearestShotList(sourceId, draftShots, displayName = "镜头表") {
    const target = findNearestNodeByType(sourceId, "shotList");
    const plan = planShotListAppend(target, draftShots);
    if (!plan) return null;
    if (target) {
      const { appended, shots } = appendDraftShotsToList({
        currentShots: plan.currentShots,
        draftShots: plan.normalizedDrafts,
        normalizeShotRecord,
      });
      updateNode(target.id, { shots, displayName });
      ensureLinkedEdge(sourceId, target.id);
      return buildNodeSyncOutcome("updated", target.id, { count: appended.length });
    }
    const createdId = createOutputNear(sourceId, "shotList", displayName, { shots: plan.normalizedDrafts });
    return buildNodeSyncOutcome("created", createdId, { count: plan.normalizedDrafts.length });
  }

  function applyResultToNearestShot(sourceId, resultNodeData = {}) {
    const resolved = resolveResultShotTarget(sourceId, resultNodeData);
    if (!resolved?.target) return null;
    const { target, currentShots } = resolved;
    if (!currentShots.length) return null;
    const { patchedShotId, patchedShot, shots: nextShots } = applyResultToShotList({
      currentShots,
      resultNodeData,
      normalizeShotRecord,
    });
    if (!patchedShotId) return null;
    updateNode(target.id, { shots: nextShots });
    ensureLinkedEdge(sourceId, target.id);
    if (patchedShot) upsertTimelineClipFromShot(target.id, patchedShot, { silent: true });
    updateNode(sourceId, {
      adoptedShotId: patchedShotId,
      adoptionState: "applied",
      adoptionLabel: "已回填镜头",
      adoptionUpdatedAt: Date.now(),
    }, { skipHistory: true });
    return buildNodeSyncOutcome("updated", target.id, { shotId: patchedShotId });
  }

  function handleResultShotAction(action, sourceId, resultNodeData = {}) {
    const resolved = resolveResultShotTarget(sourceId, resultNodeData);
    if (!resolved?.target) return null;
    const { target, shot, shotId } = resolved;
    if (action === "locate") {
      locateNode(target.id);
      if (shotId) setProjectMessage(`已定位到镜头表 ${target.data?.displayName || "镜头表"}，请查看镜头 ${shotId}`);
      return buildNodeSyncOutcome("located", target.id, { shotId });
    }
    if (!shot || !shotId) return null;
    const patch = buildResultDecisionShotPatch(shot, resultNodeData, action);
    const changed = patchShotRecord(target.id, shotId, patch);
    if (!changed) return null;
    ensureLinkedEdge(sourceId, target.id);
    upsertTimelineClipFromShot(target.id, patch, { silent: true });
    const label = buildResultShotActionLabel(action);
    updateNode(sourceId, {
      adoptedShotId: shotId,
      adoptionState: action,
      adoptionLabel: label,
      adoptionUpdatedAt: Date.now(),
    }, { skipHistory: true });
    setProjectMessage(`${label}：${shotId}`);
    return buildNodeSyncOutcome("updated", target.id, { shotId, action });
  }

  function locateResultForShot(sourceNodeId, shotId) {
    if (!sourceNodeId || !shotId) return null;
    const sourceNode = nodeById.get(sourceNodeId);
    const episodeId = sourceNode?.data?.episodeId || activeEpisodeId;
    const target = findResultNodeForShot(nodes, shotId, episodeId);
    if (!target) return null;
    locateNode(target.id);
    setProjectMessage(`已定位结果节点：${shotId}`);
    return { nodeId: target.id, shotId };
  }

  function createPromptNodeFromAsset(sourceId, asset, mode = "image", options = {}) {
    if (!asset) return null;
    const payload = buildAssetPromptPayload(asset, mode, options);
    if (mode.startsWith("image")) {
      const targetTypes = mode === "image-gemini"
        ? "geminiWeb"
        : "imageEdit";
      const target = findNearestNodeByType(sourceId, targetTypes);
      if (target) {
        updateNode(target.id, {
          ...payload.patch,
          displayName: payload.label,
          prompt: String(payload.patch?.prompt || ""),
          assetPromptSeed: String(payload.patch?.assetPromptSeed || payload.patch?.prompt || ""),
          sourceAssetToken: String(payload.patch?.sourceAssetToken || ""),
          sourceAssetName: String(payload.patch?.sourceAssetName || ""),
          sourceAssetVariant: String(payload.patch?.sourceAssetVariant || ""),
        });
        ensureLinkedEdge(sourceId, target.id);
        return buildNodeSyncOutcome("updated", target.id);
      }
      const createdId = createOutputNear(sourceId, payload.nodeType, payload.label, payload.patch);
      return buildNodeSyncOutcome("created", createdId);
    }
    const target = findNearestNodeByType(sourceId, "text");
    if (target) {
      updateNode(target.id, { ...payload.patch, displayName: payload.label });
      ensureLinkedEdge(sourceId, target.id);
      return buildNodeSyncOutcome("updated", target.id);
    }
    const createdId = createOutputNear(sourceId, payload.nodeType, payload.label, payload.patch);
    return buildNodeSyncOutcome("created", createdId);
  }

  function createManyOutputs(sourceId, outputs) {
    const source = nodes.find((node) => node.id === sourceId);
    if (!source) return [];
    pushHistory();
    const plan = buildManyOutputPlans({
      sourceNode: source,
      outputs,
      activeEpisodeId,
      nextNodeId,
      createNode,
    });
    nextNodeId = plan.nextNodeId;
    setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), ...plan.createdNodes]);
    setEdges((current) => [...current, ...plan.createdEdges]);
    return plan.ids;
  }

  useCanvasKeyboardShortcuts({
    nodes,
    selectedEdgeId,
    shiftPressedRef,
    undo,
    redo,
    pushHistory,
    setNodes,
    setEdges,
    deleteEdge,
    duplicateNodes,
  });

  function handleStageDoubleClick(event) {
    if (event.target !== stageRef.current && !event.target.classList.contains("canvas-bg")) return;
    const point = screenToWorld(event.clientX, event.clientY, view);
    setMenu({ screenX: event.clientX, screenY: event.clientY, world: point });
    setNodeMenu(null);
    setEdgeMenu(null);
  }

  function handleStageContextMenu(event) {
    event.preventDefault();
    const point = screenToWorld(event.clientX, event.clientY, view);
    setMenu({ screenX: event.clientX, screenY: event.clientY, world: point });
    setNodeMenu(null);
    setEdgeMenu(null);
  }

  function handleWheel(event) {
    if (!isCanvasZoomTarget(event.target, stageRef.current)) return;
    event.preventDefault();
    pushHistory();
    const currentView = viewRef.current;
    const nextScale = clamp(currentView.scale * (event.deltaY > 0 ? 0.9 : 1.1), 0.12, 1.8);
    const before = screenToWorld(event.clientX, event.clientY, currentView);
    const nextView = {
      scale: nextScale,
      x: event.clientX - before.x * nextScale,
      y: event.clientY - before.y * nextScale,
    };
    viewRef.current = nextView;
    setView(nextView);
  }

  function beginPan(event) {
    const shiftPressed = event.shiftKey || event.getModifierState?.("Shift") || shiftPressedRef.current;
    if (marqueeMode || shiftPressed) {
      if (event.button !== 0 || !isMarqueeTarget(event.target, stageRef.current)) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setSelectionBox({ sx: event.clientX, sy: event.clientY, cx: event.clientX, cy: event.clientY });
      setMenu(null);
      setNodeMenu(null);
      setEdgeMenu(null);
      setSelectedEdgeId("");
      return;
    }
    if (event.button !== 0 || !isPanSurfaceTarget(event.target, stageRef.current)) return;
    pushHistory();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const currentView = viewRef.current;
    panDraftRef.current = { ...currentView };
    setPan({ sx: event.clientX, sy: event.clientY, ox: currentView.x, oy: currentView.y });
    setMenu(null);
    setNodeMenu(null);
    setEdgeMenu(null);
    setSelectedEdgeId("");
  }

  function onPointerMove(event) {
    if (stageRef.current && !pan && !drag && !resize) {
      stageRef.current.style.setProperty("--cursor-x", `${event.clientX}px`);
      stageRef.current.style.setProperty("--cursor-y", `${event.clientY}px`);
    }
    if (connectionDrag) {
      setConnectionDrag((current) => current ? { ...current, to: { x: event.clientX, y: event.clientY } } : null);
      return;
    }
    if (selectionBox) {
      setSelectionBox((current) => current ? { ...current, cx: event.clientX, cy: event.clientY } : null);
      return;
    }
    if (pan) {
      const nextView = {
        ...viewRef.current,
        x: pan.ox + event.clientX - pan.sx,
        y: pan.oy + event.clientY - pan.sy,
      };
      viewRef.current = nextView;
      panDraftRef.current = nextView;
      if (!panFrameRef.current) {
        panFrameRef.current = window.requestAnimationFrame(() => {
          panFrameRef.current = 0;
          syncCanvasViewStyles(panDraftRef.current || viewRef.current, pan);
        });
      }
    }
    if (resize) {
      const currentView = viewRef.current;
      const dx = (event.clientX - resize.sx) / currentView.scale;
      const dy = (event.clientY - resize.sy) / currentView.scale;
      const [minWidth, minHeight] = nodeMinSize(resize.type);
      setNodes((current) =>
        current.map((node) =>
          node.id === resize.id
            ? {
                ...node,
                width: Math.round(clamp(resize.ow + dx, minWidth, 1200)),
                height: Math.round(clamp(resize.oh + dy, minHeight, 1100)),
              }
            : node,
        ),
      );
    }
    if (drag) {
      const currentView = viewRef.current;
      const anchorX = (event.clientX - drag.dx - currentView.x) / currentView.scale;
      const anchorY = (event.clientY - drag.dy - currentView.y) / currentView.scale;
      const dx = anchorX - drag.ox;
      const dy = anchorY - drag.oy;
      const next = {
        id: drag.id,
        ids: drag.ids || [drag.id],
        anchorX,
        anchorY,
        ox: drag.ox,
        oy: drag.oy,
        positions: (drag.ids || [drag.id]).map((id) => ({
          id,
          x: (drag.origins?.[id]?.x ?? drag.ox) + dx,
          y: (drag.origins?.[id]?.y ?? drag.oy) + dy,
          ox: drag.origins?.[id]?.x ?? drag.ox,
          oy: drag.origins?.[id]?.y ?? drag.oy,
        })),
      };
      dragDraftRef.current = next;
      if (!dragFrameRef.current) {
        dragFrameRef.current = window.requestAnimationFrame(() => {
          dragFrameRef.current = 0;
          syncDraggedNodeStyle(dragDraftRef.current);
        });
      }
    }
  }

  function endPointer(event) {
    if (event?.currentTarget?.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setConnectionDrag(null);
    if (selectionBox) {
      const width = Math.abs(selectionBox.cx - selectionBox.sx);
      const height = Math.abs(selectionBox.cy - selectionBox.sy);
      if (width > 6 || height > 6) selectNodesInScreenRect(selectionBox);
      setSelectionBox(null);
      if (marqueeMode) setProjectMessage("框选完成，可拖动整组、复制或删除");
    }
    const finalDrag = dragDraftRef.current;
    dragDraftRef.current = null;
    if (dragFrameRef.current) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = 0;
    }
    if (finalDrag) {
      clearDraggedNodeStyle(finalDrag);
      setNodes((current) =>
        current.map((node) =>
          finalDrag.positions?.some((item) => item.id === node.id)
            ? {
                ...node,
                x: finalDrag.positions.find((item) => item.id === node.id)?.x ?? node.x,
                y: finalDrag.positions.find((item) => item.id === node.id)?.y ?? node.y,
              }
            : node,
        ),
      );
    }
    setDrag(null);
    setResize(null);
    setPan(null);
    if (panFrameRef.current) {
      window.cancelAnimationFrame(panFrameRef.current);
      panFrameRef.current = 0;
    }
    const finalPanView = panDraftRef.current;
    panDraftRef.current = null;
    if (finalPanView) {
      clearFastPanStyles();
      setView(finalPanView);
    }
  }

  function syncCanvasViewStyles(nextView, activePan = null) {
    if (!nextView) return;
    if (worldRef.current) {
      worldRef.current.style.transform = `translate(${nextView.x}px, ${nextView.y}px) scale(${nextView.scale})`;
    }
    if (stageRef.current) {
      const bg = stageRef.current.querySelector(".canvas-bg");
      if (bg) {
        bg.style.backgroundPosition = `${nextView.x}px ${nextView.y}px`;
        bg.style.backgroundSize = "auto";
      }
    }
    if (edgeLayerRef.current) {
      if (activePan) {
        edgeLayerRef.current.style.transform = `translate(${nextView.x - activePan.ox}px, ${nextView.y - activePan.oy}px)`;
      } else {
        edgeLayerRef.current.style.transform = "";
      }
    }
  }

  function clearFastPanStyles() {
    if (edgeLayerRef.current) edgeLayerRef.current.style.transform = "";
  }

  function syncDraggedNodeStyle(draft) {
    if (!draft || !worldRef.current) return;
    (draft.positions || []).forEach((item) => {
      const nodeElement = worldRef.current.querySelector(`[data-node-id="${cssEscape(item.id)}"]`);
      if (!nodeElement) return;
      const dx = item.x - item.ox;
      const dy = item.y - item.oy;
      nodeElement.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(1.012)`;
    });
    syncConnectedEdgeStyles(draft);
  }

  function clearDraggedNodeStyle(draft) {
    if (!draft || !worldRef.current) return;
    (draft.positions || []).forEach((item) => {
      const nodeElement = worldRef.current.querySelector(`[data-node-id="${cssEscape(item.id)}"]`);
      if (nodeElement) nodeElement.style.transform = "";
    });
  }

  function syncConnectedEdgeStyles(draft) {
    if (!draft || !edgeLayerRef.current) return;
    const currentView = viewRef.current;
    const positionMap = new Map((draft.positions || []).map((item) => [item.id, item]));
    visibleEdges.forEach((edge) => {
      if (!positionMap.has(edge.source) && !positionMap.has(edge.target)) return;
      const sourceBase = nodeById.get(edge.source);
      const targetBase = nodeById.get(edge.target);
      if (!sourceBase || !targetBase) return;
      const sourceDraft = positionMap.get(edge.source);
      const targetDraft = positionMap.get(edge.target);
      const source = sourceDraft ? { ...sourceBase, x: sourceDraft.x, y: sourceDraft.y } : sourceBase;
      const target = targetDraft ? { ...targetBase, x: targetDraft.x, y: targetDraft.y } : targetBase;
      const a = worldToScreen(source.x + source.width, source.y + source.height / 2, currentView);
      const b = worldToScreen(target.x, target.y + target.height / 2, currentView);
      const mid = Math.max(70, Math.abs(b.x - a.x) / 2);
      const path = edgeLayerRef.current.querySelector(`[data-edge-id="${cssEscape(edge.id)}"]`);
      if (path) path.setAttribute("d", `M ${a.x} ${a.y} C ${a.x + mid} ${a.y}, ${b.x - mid} ${b.y}, ${b.x} ${b.y}`);
    });
  }

  const utilityPanelHelpers = {
    assetListByTab,
    makeAssetToken,
    assetCategoryByTab,
    resourceListByTab,
    resourceMatchesQuery,
    formatBytes,
    resourceKindShort,
    resourceKindLabel,
    buildSearchEntries,
    analyzePromptReferences,
    expandAssetReferences,
    saveBackendAiConfig,
    NOVEL_API_PROVIDERS,
    NOVEL_API_BODY_TEMPLATE_DEFAULT,
    NOVEL_FACTORY_SCHEMA,
    buildNovelChatCompletionsUrl,
    diagnoseCustomImageApi: async (...args) => {
      const { diagnoseCustomImageApi } = await loadBackendServiceHelpers();
      return diagnoseCustomImageApi(...args);
    },
    runNovelFactoryApi,
    normalizeNovelBodyTemplate,
    summarizeCustomImageApiDiagnostic,
    validateCustomImageApiSettings,
    formatCustomImageApiError,
    detectComfyPromptNodeId,
    detectComfyWorkflowFormat,
    testComfyConnection,
    testComfyImage,
    testComfyVideo,
    testCustomApi,
    currentProviderMode,
    readTextFile,
  };
  const canvasNodeRuntime = {
    ACTIVE_NOVEL_TEMPLATE_DEFAULT,
    ACTIVE_NOVEL_REVIEW_TEMPLATE_DEFAULT,
    NOVEL_REVISION_TEMPLATE_DEFAULT,
    ACTIVE_NOVEL_ASSET_TEMPLATE_DEFAULT,
    ACTIVE_NOVEL_PROMPT_TEMPLATE_DEFAULT,
    NOVEL_TEMPLATE_PRESETS,
    NOVEL_TASK_MODES,
    NOVEL_API_PROVIDERS,
    NOVEL_API_BODY_TEMPLATE_DEFAULT,
    NOVEL_FACTORY_SCHEMA,
    NOVEL_SCRIPT_SCHEMA,
    NOVEL_PLANNING_SCHEMA,
    NOVEL_REVIEW_SCHEMA,
    NOVEL_REVISION_SCHEMA,
    NOVEL_CHARACTER_ASSET_SCHEMA,
    NOVEL_SCENE_ASSET_SCHEMA,
    NOVEL_PROP_ASSET_SCHEMA,
    CINEFORGE_REVIEW_THRESHOLD,
    STYLE_IMAGE_SYSTEM_OPTIONS,
    buildNovelChatCompletionsUrl,
    normalizeNovelBodyTemplate,
    buildStylePresetSelectOptions,
    findStylePresetByName,
    runNovelFactoryApi,
    parseNovelPlanningOutput,
    parseNovelScriptOutput,
    parseNovelReviewOutput,
    parseNovelRevisionOutput,
    parseNovelAssetSliceOutput,
    parseNovelFactoryOutput,
    buildLocalNovelPipeline,
    buildPipelineFromAssets,
    formatAssetPrompts,
    formatNovelPlanning,
    formatNovelReview,
    buildNovelRevisionInput,
    buildLocalScriptReview,
    makeLocalTaskId,
    buildCineForgeProjectName,
    labelNovelStage,
    expandAssetReferences,
    collapsePromptVariantsForTool,
    preparePromptForNode,
    buildStoryboardPrompt,
    runImageGeneration,
    providerLabel,
    currentProviderMode,
    makeStoryboardImage,
    readImage,
    splitImageToFrames,
    renderPerspectiveFromPanorama,
    makeVrGrid,
    createPanoramaScene,
    clamp,
    normalizeUploadNodeData,
    normalizeImageEditNodeData,
    normalizeGeminiWebNodeData,
    normalizeTextNodeData,
    testComfyConnection,
    testImageGeneration,
    shortTitle,
    makeGeneratedImage,
    appendToken,
    isTauriRuntime,
    splitGeminiPrompts,
    readClipboardImageAsDataUrl,
    persistImportedImage,
    imageUrlToBlob,
    safeFileName,
    assetListByTab,
    normalizeAsset,
    assetCategoryByTab,
    makeAssetToken,
    addUniqueImage,
    normalizeShotRecord,
    buildShotQualityPatch,
    buildShotQualityReport,
    buildShotRiskProfile,
    buildShotTypeRouteSummary,
    suggestShotAssetBindingPatch,
    formatShotListMarkdown,
    buildImageShotPrompt,
    buildVideoShotPrompt,
    SHOT_STATUS_OPTIONS,
    REVIEW_STATUS_OPTIONS,
    DEFAULT_MANNEQUINS,
    POSE_PRESETS,
    normalizeMannequins,
    normalizeDirectorCamera,
    normalizeMannequin,
    makeDirectorImage,
    makeDirectorDepthImage,
    makeDirectorPoseImage,
    projectDirectorPoint,
    positiveModulo,
  };

  return (
    <main
      className={`app ${pan ? "is-panning" : ""} ${showCompatibilityCanvas ? "compat-canvas-open" : "production-primary"} perf-${performanceProfile}`}
      ref={stageRef}
      onDoubleClick={showCompatibilityCanvas ? handleStageDoubleClick : undefined}
      onContextMenu={showCompatibilityCanvas ? handleStageContextMenu : undefined}
      onWheel={showCompatibilityCanvas ? handleWheel : undefined}
      onPointerDown={showCompatibilityCanvas ? beginPan : undefined}
      onPointerMove={showCompatibilityCanvas ? onPointerMove : undefined}
      onPointerUp={showCompatibilityCanvas ? endPointer : undefined}
      onPointerLeave={showCompatibilityCanvas ? endPointer : undefined}
    >
      <LegacyCanvasOverlay
        show={showCompatibilityCanvas}
        selectionBox={selectionBox}
        edgeLayerRef={edgeLayerRef}
        visibleEdges={visibleEdges}
        nodeById={nodeById}
        view={view}
        selectedEdgeId={selectedEdgeId}
        selectEdge={(edgeId) => {
          setSelectedEdgeId(edgeId);
          setNodes((current) => current.map((node) => ({ ...node, selected: false })));
          setMenu(null);
          setNodeMenu(null);
          setEdgeMenu(null);
        }}
        openEdgeMenu={(edgeId, event) => {
          setSelectedEdgeId(edgeId);
          setEdgeMenu({ edgeId, screenX: event.clientX, screenY: event.clientY });
          setNodeMenu(null);
          setMenu(null);
        }}
        connectionDrag={connectionDrag}
        worldRef={worldRef}
        renderNodes={renderNodes}
        guardNode={GuardedNode}
        nodeComponent={CanvasNode}
        nodeRuntime={canvasNodeRuntime}
        nodeMenuItems={NODE_MENU}
        drag={drag}
        highlightedNodeId={highlightedNodeId}
        nodes={nodes}
        selectedNodeIds={selectedNodeIds}
        marqueeMode={marqueeMode}
        shiftPressedRef={shiftPressedRef}
        updateNode={updateNode}
        selectNode={selectNode}
        setDrag={setDrag}
        setResize={setResize}
        addNode={addNode}
        connectFromLast={connectFromLast}
        createOutputNear={createOutputNear}
        createManyOutputs={createManyOutputs}
        deleteNode={deleteNode}
        duplicateNode={duplicateNode}
        openNodeMenu={(nodeId, event) => {
          event.preventDefault();
          event.stopPropagation();
          selectNode(nodeId);
          setNodeMenu({ nodeId, screenX: event.clientX, screenY: event.clientY });
          setMenu(null);
          setEdgeMenu(null);
        }}
        startConnection={startConnection}
        finishConnection={finishConnection}
        pushHistory={pushHistory}
        settings={settings}
        textApiSettings={textApiSettings}
        patchTextApiSettings={patchTextApiSettings}
        openSettings={openSettingsPanel}
        stylePresetCenter={stylePresetCenter}
        onOpenStylePresetCenter={() => setShowStylePresetCenter(true)}
        viewRef={viewRef}
        assetIndex={assetIndex}
        openPromptPreview={(payload) => setPromptPreview(payload)}
        addGenerationJobs={(jobs) => addGenerationJobsAndMaybeRun(jobs, { autoRun: true })}
        resourceIndex={resourceIndex}
        importShotsToTimeline={importShotsToTimeline}
        syncPipelineToLinkedNodes={syncPipelineToLinkedNodes}
        sendImageToLinkedNode={sendImageToLinkedNode}
        appendShotsToNearestShotList={appendShotsToNearestShotList}
        applyResultToNearestShot={applyResultToNearestShot}
        handleResultShotAction={handleResultShotAction}
        createPromptNodeFromAsset={createPromptNodeFromAsset}
        locateResultForShot={locateResultForShot}
        visibleNodes={visibleNodes}
        activeEpisodeName={episodes.find((episode) => episode.id === activeEpisodeId)?.name}
        menu={menu}
        nodeMenu={nodeMenu}
        edgeMenu={edgeMenu}
        sendResultToSplit={sendResultToSplit}
        deleteEdge={deleteEdge}
      />
      {showCompatibilityCanvas && (
        <LegacyCanvasBanner
          onReturnToStudio={() => {
            openProductionStudio("已返回生产工作台，并按商业模型刷新兼容投影。");
          }}
        />
      )}
      {showProjectStudio && (
        <Suspense fallback={<PanelLoadingFallback label="正在打开生产工作台" />}>
          <LazyProjectStudio {...buildProjectStudioProps({
            commercialProject,
            productionDashboard,
            exportHistory,
            projectConsistencyReport,
            projectMigrationReport,
            deliveryManifestReport,
            multiEpisodeDeliverySummary,
            mediaCacheReport,
            desktopUploadChecklist,
            providerHealthReport,
            queueOperationsBoard,
            enhancedDeliveryGate,
            productionState,
            resourceIndex,
            generationQueue,
            queueRunning,
            projectMessage,
            studioViewRequest,
            projectStudioActions,
          })} />
        </Suspense>
      )}
      <div className={`hud ${hudCollapsed ? "collapsed" : ""} ${hudDock === "top" ? "dock-top" : "dock-bottom"}`}>
        <div className="hud-main">
          <strong>火山AI漫剧</strong>
          {!hudCollapsed && <span>{projectSummary.activeEpisode?.name || "当前集"} · {projectSummary.active.nodes} 节点 · {projectSummary.active.shots} 镜头</span>}
          <button onClick={() => setHudCollapsed((value) => !value)}>{hudCollapsed ? "展开" : "收起"}</button>
          <button onClick={() => setHudDock((value) => (value === "bottom" ? "top" : "bottom"))}>{hudDock === "bottom" ? "置顶" : "置底"}</button>
        </div>
        {!hudCollapsed && (
          <div className="hud-workflow-strip">
            <div className="hud-workflow-head">
              <strong>流程 {workflowNavigator.progress}%</strong>
              <span>下一步：{workflowNavigator.nextStage?.label || "完成"} · {workflowNavigator.nextStage?.detail || "暂无阻塞"}</span>
            </div>
            <div className="hud-workflow-steps">
              {workflowNavigator.stages.map((stage) => (
                <button key={stage.key} className={stage.done ? "done" : stage.key === workflowNavigator.nextStage?.key ? "active" : ""} onClick={() => guideWorkflowStep(stage.key)}>
                  <span>{stage.label}</span>
                </button>
              ))}
            </div>
            <div className="hud-workflow-actions">
              <button className="primary" onClick={() => continueWorkflowFromDashboard()}>智能继续</button>
              <button onClick={() => guideWorkflowStep(workflowNavigator.nextStage?.key || "video")}>打开当前工位</button>
              {workflowNavigator.blockers.length ? workflowNavigator.blockers.map((item, index) => (
                <span key={`${item.label}-${index}`} className={`pill ${item.tone === "danger" ? "timeline-pill-danger" : "pill-warn"}`}>{item.label}</span>
              )) : <span className="pill pill-ok">当前阶段无明显阻塞</span>}
            </div>
          </div>
        )}
        {!hudCollapsed && (
          <div className="hud-actions">
            <div className="hud-group">
              <select className="episode-select" value={activeEpisodeId} onChange={(event) => switchEpisode(event.target.value)}>
                {episodes.map((episode) => <option key={episode.id} value={episode.id}>{episode.name}</option>)}
              </select>
              <button onClick={createEpisode}>新建集</button>
              <button onClick={duplicateActiveEpisode} disabled={!visibleNodes.length}>复制本集</button>
            </div>
            <div className="hud-group">
              <button className="primary" onClick={() => openProductionStudio()}>生产工作台</button>
              <button onClick={openAdvancedCanvas}>{showCompatibilityCanvas ? "刷新兼容画布" : "兼容画布"}</button>
              <button onClick={() => setShowSimpleFlow(true)}>侧边生产台</button>
              <button onClick={() => setShowDashboard(true)}>高级总控台</button>
              <button onClick={() => setShowPromptFactory(true)}>提示词工厂</button>
              <button onClick={() => openProductionStudioView("assets", "已打开生产工作台资产库。")}>资产库</button>
              <button onClick={() => setShowQueue(true)}>图片生成队列 {generationQueue.filter((job) => job.kind === "image").length}</button>
              <button onClick={() => setShowQueue(true)}>视频生成队列 {generationQueue.filter((job) => job.kind === "video").length}</button>
              <button onClick={() => openProductionStudioView("timeline", "已打开生产工作台时间线。")}>视频时间线 {episodeTimeline.clips.length}</button>
              <button onClick={() => setShowSettings(true)}>API设置</button>
            </div>
            <div className="hud-group">
              <select value={performanceSettings.mode || "auto"} onChange={(event) => setPerformanceSettings(normalizePerformanceSettings({ ...performanceSettings, mode: event.target.value }))}>
                <option value="auto">性能 自动</option>
                <option value="quality">性能 高质</option>
                <option value="lite">性能 流畅</option>
              </select>
              {showCompatibilityCanvas && (
                <button onClick={() => setPerformanceSettings(normalizePerformanceSettings({ ...performanceSettings, showMinimap: !performanceSettings.showMinimap }))}>{performanceSettings.showMinimap ? "隐藏小地图" : "显示小地图"}</button>
              )}
              <button onClick={() => setShowDebugTracePanel(true)}>日志面板 {debugTraceEntries.length}</button>
              <button
                className={debugTraceEnabled ? "active" : ""}
                onClick={() => setDebugTraceEnabled((value) => !value)}
                title="打开后会把关键运行链路写入控制台，并挂到 window.__WUXIAN_TRACE__"
              >
                {debugTraceEnabled ? "调试日志 开" : "调试日志 关"}
              </button>
            </div>
            {showCompatibilityCanvas && (
              <div className="hud-group">
                <button
                  className={marqueeMode ? "active" : ""}
                  onClick={() => setMarqueeMode((value) => !value)}
                  title="打开后，左键拖拽画布即框选节点"
                >
                  {marqueeMode ? "框选模式 开" : "框选模式 关"}
                </button>
                <button onClick={undo} disabled={!history.past.length}>撤销</button>
                <button onClick={redo} disabled={!history.future.length}>重做</button>
                <button onClick={autoArrangeCanvas}>整理画布</button>
              </div>
            )}
            <div className="hud-group">
              <select
                className="workspace-quick-select"
                value={apiWorkspaceLibrary.activeWorkspaceId || ""}
                onChange={(event) => applyApiWorkspacePreset(event.target.value)}
                title="快速切换整套文本+图片/视频工作配置"
              >
                <option value="">工作配置 · 当前临时组合</option>
                {apiWorkspaceLibrary.workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name} · {workspace.textSettings?.apiModel || workspace.textSettings?.apiProvider || "文本"} / {workspace.mediaSettings?.customModel || workspace.mediaSettings?.providerMode || "媒体"}
                  </option>
                ))}
              </select>
              {activeHudWorkspace ? (
                <span className="hud-workspace-pill" title={`${summarizeHudTextSettings(activeHudWorkspace.textSettings || {})}\n${summarizeHudMediaSettings(activeHudWorkspace.mediaSettings || {})}`}>
                  {activeHudWorkspace.name}
                </span>
              ) : (
                <span className="hud-workspace-pill muted">未绑定工作配置</span>
              )}
              <button onClick={() => openSettingsPanel("root")}>管理配置</button>
            </div>
            <div className="hud-group">
              <button onClick={() => openSettingsPanel("image")}>API控制台</button>
              <button onClick={() => resourceInputRef.current?.click()}>导入资源</button>
              <button onClick={exportProject}>保存工程</button>
              <button onClick={openProjectFile}>打开工程</button>
            </div>
            {isTauriRuntime() && (
              <select className="recent-select" value="" onChange={(event) => openRecentProject(event.target.value)}>
                <option value="">最近工程</option>
                {recentProjects.map((path) => <option key={path} value={path}>{shortPath(path)}</option>)}
              </select>
            )}
            <button onClick={clearProject}>清空</button>
          </div>
        )}
        <input ref={fileInputRef} hidden type="file" accept="application/json" onChange={importProject} />
        <input ref={resourceInputRef} hidden type="file" multiple accept="image/*,video/*,.txt,.md,.json,.doc,.docx,.pdf" onChange={importProjectResources} />
      </div>
      {(projectMessage || autoSaveState || currentProjectPath) && (
        <div className="project-toast">
          {projectMessage || autoSaveState || (currentProjectPath ? `当前工程：${currentProjectPath}` : "")}
        </div>
      )}
      {showCompatibilityCanvas && performanceSettings.showMinimap && (
        <Suspense fallback={null}>
          <LazyMinimapPanel
            nodes={visibleNodes}
            view={view}
            selectedNodeId={selectedNode?.id || ""}
            profile={performanceProfile}
            helpers={{ getNodeBounds }}
          />
        </Suspense>
      )}
      {showSettings && (
        <GuardedPanel title="API控制台" onClose={() => setShowSettings(false)} resetKey={`settings-${settingsFocus}`}>
          <Suspense fallback={<PanelLoadingFallback label="正在打开 API 控制台" />}>
            <LazySettingsPanel
              settings={settings}
              setSettings={setSettings}
              textApiSettings={textApiSettings}
              patchTextApiSettings={patchTextApiSettings}
              focusSection={settingsFocus}
              onBackToRoot={() => setSettingsFocus("root")}
              onClose={() => setShowSettings(false)}
              helpers={utilityPanelHelpers}
            />
          </Suspense>
        </GuardedPanel>
      )}
      {showDebugTracePanel && (
        <GuardedPanel title="调试日志" onClose={() => setShowDebugTracePanel(false)} resetKey={`debug-trace-${debugTraceEntries.length}-${debugTraceEnabled ? "on" : "off"}`}>
          <Suspense fallback={<PanelLoadingFallback label="正在打开调试日志" />}>
            <LazyDebugTracePanel
              enabled={debugTraceEnabled}
              entries={debugTraceEntries}
              onToggleEnabled={() => setDebugTraceEnabled((value) => !value)}
              onClear={() => {
                const nextEntries = clearDebugTraceEntries(typeof window !== "undefined" ? window : null);
                setDebugTraceEntries(nextEntries);
              }}
              onClose={() => setShowDebugTracePanel(false)}
            />
          </Suspense>
        </GuardedPanel>
      )}
      {showDashboard && (
        <GuardedPanel title="项目总控台" onClose={() => setShowDashboard(false)} resetKey="dashboard">
          <Suspense fallback={<PanelLoadingFallback label="正在打开项目总控台" />}>
            <LazyProjectDashboardPanel
              summary={projectSummary}
              workflowFocus={buildDashboardWorkflowFocus(projectSummary.active || {}, reviewBoardReport, episodeTimeline)}
              activeEpisodeId={activeEpisodeId}
              textApiReady={(textApiSettings.factoryMode || "local") === "api" && Boolean(String(textApiSettings.apiKey || "").trim() || textApiSettings.apiKeySaved)}
              imageApiReady={Boolean(String(settings.customApiKey || "").trim() || settings.customApiKeySaved || settings.comfyEnabled)}
              onSelectEpisode={switchEpisode}
              onUpdateEpisode={updateEpisode}
              onCreateEpisode={createEpisode}
              onDuplicateEpisode={duplicateActiveEpisode}
              onBootstrapNovelFlow={() => bootstrapEpisodeWorkspace("novel")}
              onBootstrapShotFlow={() => bootstrapEpisodeWorkspace("shot")}
              onGuideWorkflowStep={guideWorkflowStep}
              onContinueWorkflow={continueWorkflowFromDashboard}
              onRunAutopilot={runBackgroundAutopilot}
              onLocate={(nodeId) => openWorkflowAction("", nodeId)}
              onOpenSettings={() => openSettingsPanel("text")}
              onOpenQueue={() => setShowQueue(true)}
              onOpenHealth={() => setShowHealth(true)}
              onOpenResources={() => openProductionStudioView("assets", "已从总控台打开生产工作台资产库。")}
              onOpenTimeline={() => openProductionStudioView("timeline", "已从总控台打开生产工作台时间线。")}
              onOpenCollaboration={() => setShowCollaborationCenter(true)}
              onOpenArchive={() => setShowArchiveCenter(true)}
              onOpenExport={() => openProductionStudioView("delivery", "已从总控台打开生产工作台交付。")}
              onOpenPromptFactory={() => setShowPromptFactory(true)}
              onOpenReviewCenter={() => openProductionStudioView("review", "已从总控台打开生产工作台审片。")}
              onRunReviewClosure={runEpisodeReviewClosure}
              onRunTimelineClosure={runEpisodeToTimelineDeliverable}
              onRunExportClosure={runEpisodeToExportDeliverable}
              onRunPendingReviewBatch={runEpisodePendingReviewBatch}
              onRunPendingRefreshBatch={runEpisodePendingRefreshBatch}
              onRunPendingTimelineApprovalBatch={runEpisodePendingTimelineApprovalBatch}
              onRunRejectedTimelineRepairBatch={runEpisodeRejectedTimelineRepairBatch}
              onRunTimelineBackfillBatch={runEpisodeTimelineBackfillBatch}
              onRunMissingMediaBatch={runEpisodeMissingMediaBatch}
              onRunFailedExportBatch={runEpisodeFailedExportBatch}
              onClose={() => setShowDashboard(false)}
            />
          </Suspense>
        </GuardedPanel>
      )}
      {showSimpleFlow && (
        <GuardedPanel title="项目生产台" onClose={() => setShowSimpleFlow(false)} resetKey={`simple-flow-${activeEpisodeId}-${generationQueue.length}-${queueRunning ? "running" : "idle"}`}>
          <Suspense fallback={<PanelLoadingFallback label="正在打开项目生产台" />}>
            <LazySimpleWorkflowPanel
              summary={projectSummary}
              activeEpisodeId={activeEpisodeId}
              queue={generationQueue}
              queueRunning={queueRunning}
              projectMessage={projectMessage}
              textApiReady={(textApiSettings.factoryMode || "local") === "api" && Boolean(String(textApiSettings.apiKey || "").trim() || textApiSettings.apiKeySaved)}
              imageApiReady={Boolean(String(settings.customApiKey || "").trim() || settings.customApiKeySaved || settings.comfyEnabled)}
              onBootstrapNovelFlow={() => bootstrapEpisodeWorkspace("novel")}
              onSubmitNovel={submitSimpleNovelFlow}
              onGenerateImages={queueActiveEpisodeImages}
              onGenerateVideos={queueActiveEpisodeVideos}
              onRunAutopilot={runBackgroundAutopilot}
              onContinueWorkflow={continueWorkflowFromDashboard}
              onOpenSettings={() => openSettingsPanel("root")}
              onOpenTextSettings={() => openSettingsPanel("text")}
              onOpenMediaSettings={() => openSettingsPanel("image")}
              onOpenDashboard={() => openProductionStudioView("overview", "已打开生产工作台总览。")}
              onOpenQueue={() => setShowQueue(true)}
              onOpenPromptFactory={() => setShowPromptFactory(true)}
              onOpenTimeline={() => openProductionStudioView("timeline", "已打开生产工作台时间线。")}
              onOpenExport={() => openProductionStudioView("delivery", "已打开生产工作台交付。")}
              onClose={() => setShowSimpleFlow(false)}
            />
          </Suspense>
        </GuardedPanel>
      )}
      {showHealth && (
        <GuardedPanel title="项目体检" onClose={() => setShowHealth(false)} resetKey={`health-${activeEpisodeId}`}>
          <Suspense fallback={<PanelLoadingFallback label="正在打开项目体检" />}>
            <LazyProjectHealthPanel
              report={projectHealth}
              activeEpisodeId={activeEpisodeId}
              onSelectEpisode={switchEpisode}
              onLocate={(nodeId) => openWorkflowAction("", nodeId)}
              onAutoFix={fixHealthFinding}
              onAutoFixBatch={fixHealthFindingsBatch}
              fixingKeys={healthFixingKeys}
              repairLog={healthRepairLog}
              remainingKeys={healthRemainingKeys}
              onClose={() => setShowHealth(false)}
            />
          </Suspense>
        </GuardedPanel>
      )}
      {showPromptFactory && (
        <GuardedPanel title="Prompt 工厂" onClose={() => setShowPromptFactory(false)} resetKey={`prompt-factory-${activeEpisodeId}`}>
          <Suspense fallback={<PanelLoadingFallback label="正在打开 Prompt 工厂" />}>
            <LazyPromptFactoryPanel
              state={promptFactory}
              stylePresetCenter={stylePresetCenter}
              modelParamCenter={modelParamCenter}
              shots={buildPromptFactoryShotSources(nodes, activeEpisodeId)}
              assets={assetIndex.items}
              onPatchState={patchPromptFactory}
              onGenerate={generatePromptFactoryOutput}
              onOpenStylePresetCenter={() => setShowStylePresetCenter(true)}
              onOpenModelParamCenter={() => setShowModelParamCenter(true)}
              buildStylePresetSelectOptions={buildStylePresetSelectOptions}
              findStylePresetByName={findStylePresetByName}
              buildModelPresetOptions={buildModelPresetOptions}
              buildModelParamPresetOptions={buildModelParamPresetOptions}
              findModelParamPresetById={findModelParamPresetById}
              buildModelParamPresetSummary={buildModelParamPresetSummary}
              onClose={() => setShowPromptFactory(false)}
            />
          </Suspense>
        </GuardedPanel>
      )}
      {showTemplateCenter && (
        <GuardedPanel title="模板系统" onClose={() => setShowTemplateCenter(false)} resetKey={`template-${templateCenter.templates?.length || 0}`}>
          <Suspense fallback={<PanelLoadingFallback label="正在打开模板系统" />}>
            <LazyTemplateCenterPanel
              state={templateCenter}
              onPatchState={patchTemplateCenter}
              onApplyTemplate={applyTemplateCenterTemplate}
              onExportTemplate={exportTemplateCenterTemplate}
              templateCategoryLabel={templateCategoryLabel}
              templateCategoryOptions={TEMPLATE_CATEGORY_OPTIONS}
              onClose={() => setShowTemplateCenter(false)}
            />
          </Suspense>
        </GuardedPanel>
      )}
      {showStylePresetCenter && (
        <GuardedPanel title="风格预设" onClose={() => setShowStylePresetCenter(false)} resetKey={`style-preset-${stylePresetCenter.presets?.length || 0}`}>
          <Suspense fallback={<PanelLoadingFallback label="正在打开风格预设" />}>
            <LazyStylePresetCenterPanel
              state={stylePresetCenter}
              onPatchState={patchStylePresetCenter}
              onApplyToPromptFactory={applyStylePresetToPromptFactory}
              onApplyToNovelPipelines={applyStylePresetToNovelPipelines}
              normalizeStylePresetDefinition={normalizeStylePresetDefinition}
              promptModelPresets={PROMPT_MODEL_PRESETS}
              styleImageSystemOptions={STYLE_IMAGE_SYSTEM_OPTIONS}
              onClose={() => setShowStylePresetCenter(false)}
            />
          </Suspense>
        </GuardedPanel>
      )}
      {showModelParamCenter && (
        <GuardedPanel title="参数预设" onClose={() => setShowModelParamCenter(false)} resetKey={`model-param-${modelParamCenter.presets?.length || 0}`}>
          <Suspense fallback={<PanelLoadingFallback label="正在打开参数预设" />}>
            <LazyModelParamCenterPanel
              state={modelParamCenter}
              onPatchState={patchModelParamCenter}
              onApplyToPromptFactory={applyModelParamPresetToPromptFactory}
              onApplyToShots={applyModelParamPresetToShots}
              onApplyToAiSettings={applyModelParamPresetToAiSettings}
              normalizeModelParamPresetDefinition={normalizeModelParamPresetDefinition}
              promptModelPresets={PROMPT_MODEL_PRESETS}
              buildModelParamPresetSummary={buildModelParamPresetSummary}
              onClose={() => setShowModelParamCenter(false)}
            />
          </Suspense>
        </GuardedPanel>
      )}
      {showExportPresetCenter && (
        <GuardedPanel title="导出预设" onClose={() => setShowExportPresetCenter(false)} resetKey={`export-preset-${exportPresetCenter.presets?.length || 0}`}>
          <Suspense fallback={<PanelLoadingFallback label="正在打开导出预设" />}>
            <LazyExportPresetCenterPanel
              state={exportPresetCenter}
              onPatchState={patchExportPresetCenter}
              onApplyToExportCenter={applyExportPresetToExportCenter}
              onCopyPresetSummary={copyExportPresetSummary}
              onExportPresetFile={(presetId) => exportExportPresetBundle("selected", presetId)}
              onExportAllPresetFiles={() => exportExportPresetBundle("all")}
              onImportPresets={importExportPresetBundle}
              normalizeExportPresetDefinition={normalizeExportPresetDefinition}
              exportVideoPresetOptions={EXPORT_VIDEO_PRESET_OPTIONS}
              exportPresetStageOptions={EXPORT_PRESET_STAGE_OPTIONS}
              onClose={() => setShowExportPresetCenter(false)}
            />
          </Suspense>
        </GuardedPanel>
      )}
      {showDirectorAssistant && (
        <GuardedPanel title="导演助手" onClose={() => setShowDirectorAssistant(false)} resetKey={`director-assistant-${activeEpisodeId}`}>
          <Suspense fallback={<PanelLoadingFallback label="正在打开导演助手" />}>
            <LazyDirectorAssistantPanel
              report={buildDirectorAssistantReport(nodes, episodes, activeEpisodeId, assetIndex, resourceIndex, timeline)}
              onApplyPromptSuggestion={applyDirectorPromptSuggestion}
              onApplyShotSuggestion={applyDirectorShotSuggestion}
              onLocate={(nodeId) => openWorkflowAction("", nodeId)}
              onClose={() => setShowDirectorAssistant(false)}
            />
          </Suspense>
        </GuardedPanel>
      )}
      {showReviewCenter && (
        <GuardedPanel title="审稿反馈" onClose={() => setShowReviewCenter(false)} resetKey={`review-${activeEpisodeId}`}>
          <Suspense fallback={<PanelLoadingFallback label="正在打开审稿反馈" />}>
            <LazyReviewCenterPanel
              report={reviewBoardReport}
              collaborationState={collaborationState}
              reviewWorkflow={reviewWorkflow}
              focusTargetId={reviewCenterFocusTargetId}
              onAddComment={addReviewComment}
              onUpdateShotReviewStatus={updateShotReviewStatus}
              onRunApiReview={runApiReviewForShot}
              onRunBatchApiReview={runApiReviewForEpisode}
              onRunApiReviewAndRevise={runApiReviewAndReviseShot}
              onRunBatchApiReviewAndRevise={runApiReviewAndReviseEpisode}
              onRunRefreshPlan={runShotRefreshPlan}
              onRunBatchRefreshPlan={runEpisodeRefreshPlans}
              refreshPlanCount={reviewRefreshPlanCount}
              onContinueCurrentStep={() => openWorkflowAction(reviewWorkflow.currentActionKey, reviewBoardReport.targets.find((item) => item.shotId)?.nodeId || "")}
              onGoNextStep={() => openWorkflowAction(reviewWorkflow.nextActionKey)}
              onOpenApiSettings={() => openSettingsPanel("text")}
              onLocate={(nodeId) => openWorkflowAction("", nodeId)}
              reviewStatusOptions={REVIEW_STATUS_OPTIONS}
              onClose={() => setShowReviewCenter(false)}
            />
          </Suspense>
        </GuardedPanel>
      )}
      {showCollaborationCenter && (
        <GuardedPanel title="协作中心" onClose={() => setShowCollaborationCenter(false)} resetKey={`collaboration-${collaborationState.members?.length || 0}-${collaborationState.history?.length || 0}`}>
          <Suspense fallback={<PanelLoadingFallback label="正在打开协作中心" />}>
            <LazyCollaborationCenterPanel
              state={collaborationState}
              report={buildCollaborationReport(nodes, episodes, activeEpisodeId, collaborationState)}
              onPatchState={patchCollaborationState}
              onLocate={(nodeId) => openWorkflowAction("", nodeId)}
              onClose={() => setShowCollaborationCenter(false)}
            />
          </Suspense>
        </GuardedPanel>
      )}
      {showProductionHub && (
        <GuardedPanel title="生产闭环" onClose={() => setShowProductionHub(false)} resetKey={`production-hub-${activeEpisodeId}`}>
          <Suspense fallback={<PanelLoadingFallback label="正在打开生产闭环" />}>
            <LazyProductionHubPanel
              report={buildProductionHubReport(nodes, episodes, activeEpisodeId, resources, timeline, generationQueue, exportHistory)}
              onOpenDashboard={() => openProductionStudioView("overview", "已打开生产工作台总览。")}
              onOpenHealth={() => setShowHealth(true)}
              onOpenResources={() => openProductionStudioView("assets", "已从生产闭环打开生产工作台资产库。")}
              onOpenPromptFactory={() => setShowPromptFactory(true)}
              onOpenReviewCenter={() => openProductionStudioView("review", "已从生产闭环打开生产工作台审片。")}
              onOpenTimeline={() => openProductionStudioView("timeline", "已从生产闭环打开生产工作台时间线。")}
              onOpenExportCenter={() => openProductionStudioView("delivery", "已从生产闭环打开生产工作台交付。")}
              onOpenQueue={() => setShowQueue(true)}
              onLocate={(nodeId) => openWorkflowAction("", nodeId)}
              onClose={() => setShowProductionHub(false)}
            />
          </Suspense>
        </GuardedPanel>
      )}
      {showArchiveCenter && (
        <GuardedPanel title="归档中心" onClose={() => setShowArchiveCenter(false)} resetKey={`archive-${archiveState.snapshots?.length || 0}`}>
          <Suspense fallback={<PanelLoadingFallback label="正在打开归档中心" />}>
            <LazyArchiveCenterPanel
              state={archiveState}
              report={buildArchiveReport(archiveState, episodes, activeEpisodeId)}
              onPatchState={patchArchiveState}
              onCreateSnapshot={createArchiveSnapshot}
              onExportFile={saveExportArtifact}
              archiveStageOptions={ARCHIVE_STAGE_OPTIONS}
              exportBaseName={safeFileName(buildArchiveReport(archiveState, episodes, activeEpisodeId).episodeName || "project")}
              onClose={() => setShowArchiveCenter(false)}
            />
          </Suspense>
        </GuardedPanel>
      )}
      {showExportCenter && (
        <GuardedPanel title="成片导出" onClose={() => setShowExportCenter(false)} resetKey={`export-${activeEpisodeId}`}>
          <Suspense fallback={<PanelLoadingFallback label="正在打开成片导出" />}>
            <LazyExportCenterPanel
              episode={episodes.find((item) => item.id === activeEpisodeId)}
              episodes={episodes}
              timeline={episodeTimeline}
              exportBundle={buildEpisodeExportBundle(episodes.find((item) => item.id === activeEpisodeId), episodeTimeline, buildPromptFactoryShotSources(nodes, activeEpisodeId), resourceIndex, {
                defaultEpisodeTimeline,
                formatTimelineText,
                buildPublishingPlan,
                normalizeShotRecord,
                buildShotQualityReport,
                extractAssetTokens,
                buildProjectArchiveBundle,
                parseDurationSeconds,
                safeFileName,
              })}
              projectExportSummary={buildProjectExportSummary(episodes, timeline, { getEpisodeTimeline, parseDurationSeconds, defaultEpisodeTimeline })}
              exportHistory={exportHistory}
              exportPresetCenter={exportPresetCenter}
              activeExportPreset={findExportPresetById(exportPresetCenter, exportPresetCenter.activePresetId)}
              onExportFile={saveExportArtifact}
              onExportCover={exportEpisodeCover}
              onRenderVideo={(options) => renderEpisodeVideo(episodes.find((item) => item.id === activeEpisodeId), episodeTimeline, resourceIndex, options)}
              onQueueRender={(options) => queueEpisodeRender(episodes.find((item) => item.id === activeEpisodeId), episodeTimeline, resourceIndex, options)}
              onQueueBatchRender={(options) => queueProjectRenderBatch(resourceIndex, options)}
              onRenderPreset={() => renderActiveExportPreset(activeEpisodeId)}
              onQueuePreset={() => queueActiveExportPreset(activeEpisodeId, "single")}
              onQueueBatchPreset={() => queueActiveExportPreset(activeEpisodeId, "batch")}
              onSelectExportPreset={(presetId) => patchExportPresetCenter({ activePresetId: presetId })}
              onPatchExportPreset={patchActiveExportPreset}
              onOpenExportPresetCenter={() => setShowExportPresetCenter(true)}
              onQueueEpisodeRender={(episodeId, options) => {
                const episode = episodes.find((item) => item.id === episodeId);
                if (!episode) return;
                queueEpisodeRender(episode, getEpisodeTimeline(timeline, episodeId, { defaultEpisodeTimeline }), resourceIndex, options);
              }}
              onRetryExportJobs={retryExportJobs}
              onRequeueHistoryItem={requeueExportHistoryItem}
              onRequeueHistoryItems={requeueExportHistoryItems}
              exportBaseName={safeFileName(episodes.find((item) => item.id === activeEpisodeId)?.name || "timeline")}
              onClose={() => setShowExportCenter(false)}
            />
          </Suspense>
        </GuardedPanel>
      )}
      {showTimeline && (
        <GuardedPanel title="时间线" onClose={() => setShowTimeline(false)} resetKey={`timeline-${activeEpisodeId}-${episodeTimeline.clips.length}`}>
          <Suspense fallback={<PanelLoadingFallback label="正在打开时间线" />}>
            <LazyTimelinePanel
              episode={episodes.find((item) => item.id === activeEpisodeId)}
              timeline={episodeTimeline}
              availableShots={buildEpisodeTimelineSources(nodes, activeEpisodeId, resourceIndex, {
                normalizeShotRecord,
                pickTimelineResultUrl,
                expandResourceReferences,
              })}
              focusClipId={timelineFocusClipId}
              totalDurationSeconds={episodeTimeline.clips.reduce((sum, clip) => sum + parseDurationSeconds(clip.duration), 0)}
              onImportShots={(shots) => importShotsToTimeline(shots)}
              onPatchClip={(clipId, patch) => patchTimelineClip(activeEpisodeId, clipId, patch)}
              onPatchClips={(clipIds, patch) => patchTimelineClips(activeEpisodeId, clipIds, patch)}
              onMoveClip={(clipId, direction) => moveTimelineClip(activeEpisodeId, clipId, direction)}
              onDuplicateClip={(clipId) => duplicateTimelineClip(activeEpisodeId, clipId)}
              onSortClips={() => sortTimelineClipsByShotId(activeEpisodeId)}
              onRemoveClip={(clipId) => removeTimelineClip(activeEpisodeId, clipId)}
              onLocateShot={locateShotFromTimelineClip}
              onGenerateClip={queueGenerationForTimelineClip}
              onSyncClip={(clipId) => syncTimelineClipFromSource(activeEpisodeId, clipId)}
              onSyncClips={(clipIds) => syncTimelineClipsFromSource(activeEpisodeId, clipIds)}
              onPatchShotFromClip={(clipId, options) => patchShotFromTimelineClip(activeEpisodeId, clipId, options)}
              onPatchShotsFromClips={(clipIds, options) => patchShotsFromTimelineClips(activeEpisodeId, clipIds, options)}
              onPrepareClips={(clipIds) => prepareTimelineClipsForExport(activeEpisodeId, clipIds)}
              getClipStatus={getTimelineClipStatus}
              onExport={() => exportTimelineText(activeEpisodeId)}
              onClose={() => setShowTimeline(false)}
            />
          </Suspense>
        </GuardedPanel>
      )}
      {showResources && (
        <GuardedPanel title="资源中心" onClose={() => setShowResources(false)} resetKey={`resources-${resourceIndex.items.length}`}>
          <Suspense fallback={<PanelLoadingFallback label="正在打开资源中心" />}>
            <LazyProjectResourcePanel
              resourceIndex={resourceIndex}
              episodes={episodes}
              activeEpisodeId={activeEpisodeId}
              activeEpisodeName={episodes.find((item) => item.id === activeEpisodeId)?.name || "当前集"}
              exportBundle={buildEpisodeExportBundle(episodes.find((item) => item.id === activeEpisodeId), episodeTimeline, buildPromptFactoryShotSources(nodes, activeEpisodeId), resourceIndex, {
                defaultEpisodeTimeline,
                formatTimelineText,
                buildPublishingPlan,
                normalizeShotRecord,
                buildShotQualityReport,
                extractAssetTokens,
                buildProjectArchiveBundle,
                parseDurationSeconds,
                safeFileName,
              })}
              projectExportSummary={buildProjectExportSummary(episodes, timeline, { getEpisodeTimeline, parseDurationSeconds, defaultEpisodeTimeline })}
              exportHistory={exportHistory}
              mediaCacheReport={mediaCacheReport}
              projectIndexSummary={projectIndexSummary}
              onImport={() => resourceInputRef.current?.click()}
              onRefreshMediaCache={refreshMediaCacheIndex}
              onRebuildProjectIndex={rebuildProjectIndex}
              onSearchProjectIndex={searchProjectIndexFromSqlite}
              onExportMediaCacheReport={exportMediaCacheCleanupReport}
              onDeleteMediaCacheFiles={deleteSelectedMediaCacheFiles}
              onUpdateResource={updateProjectResource}
              onDeleteResource={deleteProjectResource}
              onExportFile={saveExportArtifact}
              onExportCover={exportEpisodeCover}
              exportBaseName={safeFileName(episodes.find((item) => item.id === activeEpisodeId)?.name || "timeline")}
              onOpenExportCenter={() => openProductionStudioView("delivery", "已打开生产工作台交付。")}
              onLocateNode={locateNode}
              onClose={() => setShowResources(false)}
              helpers={utilityPanelHelpers}
            />
          </Suspense>
        </GuardedPanel>
      )}
      {showGlobalAssets && (
        <GuardedPanel title="全局资产库" onClose={() => setShowGlobalAssets(false)} resetKey={`assets-${assetIndex.items.length}`}>
          <Suspense fallback={<PanelLoadingFallback label="正在打开全局资产库" />}>
            <LazyGlobalAssetPanel assetIndex={assetIndex} onClose={() => setShowGlobalAssets(false)} helpers={utilityPanelHelpers} />
          </Suspense>
        </GuardedPanel>
      )}
      {showSearch && (
        <GuardedPanel title="全局搜索" onClose={() => setShowSearch(false)} resetKey={`search-${nodes.length}-${assetIndex.items.length}-${resourceIndex.items.length}`}>
          <Suspense fallback={<PanelLoadingFallback label="正在打开全局搜索" />}>
            <LazyGlobalSearchPanel
              nodes={nodes}
              assetIndex={assetIndex}
              resourceIndex={resourceIndex}
              projectIndexSummary={projectIndexSummary}
              onSearchProjectIndex={searchProjectIndexFromSqlite}
              onOpenIndexResult={openProjectIndexSearchResult}
              onLocate={(nodeId) => openWorkflowAction("", nodeId)}
              onClose={() => setShowSearch(false)}
              helpers={utilityPanelHelpers}
            />
          </Suspense>
        </GuardedPanel>
      )}
      {showQueue && (
        <GuardedPanel title="生成队列" onClose={() => setShowQueue(false)} resetKey={`queue-${generationQueue.length}-${queueRunning ? "running" : "idle"}`}>
          <Suspense fallback={<PanelLoadingFallback label="正在打开生成队列" />}>
            <LazyGenerationQueuePanel
              jobs={generationQueue}
              running={queueRunning}
              onRun={runGenerationQueue}
              onStop={stopGenerationQueue}
              onClear={clearGenerationQueue}
              onClearFinished={clearFinishedJobs}
              onRetryFailed={retryFailedJobs}
              onRetryFailedShots={retryFailedShotJobs}
              onRetryAllExports={() => retryExportJobs("all")}
              onRetryFailedExports={() => retryExportJobs("failed")}
              onRetryJob={retryQueueJob}
              onRemoveJob={removeQueueJob}
              onReprioritizeJob={reprioritizeJob}
              onLocateJob={locateQueueJob}
              onRecoverTimelineGaps={recoverActiveEpisodeTimelineGaps}
              onOpenTimeline={() => openProductionStudioView("timeline", "已从队列打开生产工作台时间线。")}
              activeEpisodeName={episodes.find((item) => item.id === activeEpisodeId)?.name || "当前集"}
              timelineGapCount={Math.max(0, (projectSummary.active?.timelineClips || 0) - (projectSummary.active?.timelineReady || 0))}
              queuePriorityOptions={QUEUE_PRIORITY_OPTIONS}
              queueStatusLabel={queueStatusLabel}
              queueKindLabel={queueKindLabel}
              compareQueueJobs={compareQueueJobs}
              shortTitle={shortTitle}
              onClose={() => setShowQueue(false)}
            />
          </Suspense>
        </GuardedPanel>
      )}
      {promptPreview && (
        <GuardedPanel title="提示词预览" onClose={() => setPromptPreview(null)} resetKey={promptPreview.nodeId || promptPreview.title || "prompt-preview"}>
          <Suspense fallback={<PanelLoadingFallback label="正在打开提示词预览" />}>
            <LazyPromptPreviewPanel preview={promptPreview} assetIndex={assetIndex} onClose={() => setPromptPreview(null)} helpers={utilityPanelHelpers} />
          </Suspense>
        </GuardedPanel>
      )}
    </main>
  );
}

let threeModulePromise = null;
let panoramaHelpersPromise = null;

async function loadThreeModule() {
  if (!threeModulePromise) threeModulePromise = import("three");
  return threeModulePromise;
}

async function loadPanoramaHelpers() {
  if (!panoramaHelpersPromise) panoramaHelpersPromise = import("./panorama-helpers.js");
  return panoramaHelpersPromise;
}

async function renderPerspectiveFromPanorama(...args) {
  const helpers = await loadPanoramaHelpers();
  return helpers.renderPerspectiveFromPanorama(...args);
}

async function makeVrGrid(...args) {
  const helpers = await loadPanoramaHelpers();
  return helpers.makeVrGrid(...args);
}

async function createPanoramaScene(canvas, imageSrc, options = {}) {
  const THREE = await loadThreeModule();
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(options.pixelRatio || 1);
  renderer.setClearColor(0x020506, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(76, 1, 0.1, 1200);
  camera.rotation.order = "YXZ";

  const geometry = new THREE.SphereGeometry(500, 96, 64);
  const material = new THREE.MeshBasicMaterial({ color: 0x05090b, side: THREE.BackSide });
  scene.add(new THREE.Mesh(geometry, material));

  let texture = null;
  let disposed = false;
  let view = { yaw: 0, pitch: 0, fov: 76 };

  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin("anonymous");
  loader.load(
    imageSrc,
    (loadedTexture) => {
      if (disposed) {
        loadedTexture.dispose();
        return;
      }
      loadedTexture.colorSpace = THREE.SRGBColorSpace;
      loadedTexture.minFilter = THREE.LinearFilter;
      loadedTexture.magFilter = THREE.LinearFilter;
      texture = loadedTexture;
      material.map = texture;
      material.color.set(0xffffff);
      material.needsUpdate = true;
      api.resize();
      api.render();
      options.onReady?.();
    },
    undefined,
    () => options.onError?.("图片加载失败，请检查链接或上传本地图片"),
  );

  const api = {
    setView(nextView) {
      view = { ...view, ...nextView };
      camera.fov = view.fov || 76;
      camera.rotation.y = view.yaw || 0;
      camera.rotation.x = clamp(view.pitch || 0, -1.45, 1.45);
      camera.updateProjectionMatrix();
    },
    resize() {
      const width = Math.max(1, canvas.clientWidth || canvas.width || 1);
      const height = Math.max(1, canvas.clientHeight || canvas.height || 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },
    render() {
      api.resize();
      renderer.render(scene, camera);
    },
    dispose() {
      disposed = true;
      texture?.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
    },
  };

  return api;
}

function defaultSettings() {
  return createDefaultSettings(applyApiKeyVaultToImageSettings);
}

function loadSavedProject() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let project = raw ? normalizeProject(JSON.parse(raw)) : normalizeProject({});
    project = restorePersistedAssets(project);
    nextNodeId = inferNextNodeId(project.nodes);
    return project;
  } catch {
    const project = restorePersistedAssets(normalizeProject({}));
    nextNodeId = inferNextNodeId(project.nodes);
    return project;
  }
}

function loadApiKeyVault() {
  return loadApiKeyVaultFromStorage({ storage: localStorage, storageKey: API_KEY_VAULT_KEY, tauriRuntime: isTauriRuntime() });
}

function rememberApiKey(kind, value) {
  rememberApiKeyInVault(kind, value, { storage: localStorage, storageKey: API_KEY_VAULT_KEY, tauriRuntime: isTauriRuntime() });
}

function forgetApiKey(kind) {
  forgetApiKeyInVault(kind, { storage: localStorage, storageKey: API_KEY_VAULT_KEY, tauriRuntime: isTauriRuntime() });
}

function applyApiKeyVaultToImageSettings(settings) {
  return applyImageApiKeyVault(settings, loadApiKeyVault());
}

function applyApiKeyVaultToNovelSettings(settings) {
  return applyNovelApiKeyVault(settings, loadApiKeyVault());
}

function summarizeHudTextSettings(settings = {}) {
  const mode = settings.factoryMode === "api" ? "API" : "本地";
  return `${mode} · ${settings.apiProvider || "openai"} · ${settings.apiModel || "未填模型"}`;
}

function summarizeHudMediaSettings(settings = {}) {
  const mode = currentProviderMode(settings);
  if (mode === "comfy") {
    return `ComfyUI · ${settings.comfyBaseUrl || "未填地址"}`;
  }
  if (mode === "custom") {
    return `HTTP API · ${settings.customModel || settings.customApiKind || "未填模型"}`;
  }
  return "本地模拟";
}

function loadNovelApiSettings() {
  try {
    const raw = localStorage.getItem(NOVEL_API_SETTINGS_KEY);
    const settings = raw ? JSON.parse(raw) : {};
    const preset = NOVEL_API_PROVIDERS[settings.apiProvider] || NOVEL_API_PROVIDERS.openai;
    return applyApiKeyVaultToNovelSettings({
      ...settings,
      bodyTemplate: normalizeNovelBodyTemplate(settings.bodyTemplate, preset),
    });
  } catch {
    return applyApiKeyVaultToNovelSettings({});
  }
}

async function loadNovelApiSettingsFromBackend() {
  const { loadNovelApiSettingsFromBackend: loadNovelApiSettingsFromBackendImpl } = await loadBackendServiceHelpers();
  return loadNovelApiSettingsFromBackendImpl({
    loadNovelApiSettings,
    applyNovelApiKeyVault: applyApiKeyVaultToNovelSettings,
    normalizeNovelBodyTemplate,
    novelApiProviders: NOVEL_API_PROVIDERS,
  });
}

async function saveNovelApiSettings(settings) {
  const { saveNovelApiSettings: saveNovelApiSettingsImpl } = await loadBackendServiceHelpers();
  return saveNovelApiSettingsImpl(settings, {
    forgetApiKey,
    rememberApiKey,
    hasSavedApiKey,
    loadApiKeyVault,
    normalizeNovelBodyTemplate,
    novelApiProviders: NOVEL_API_PROVIDERS,
    novelFactorySchema: NOVEL_FACTORY_SCHEMA,
    storage: localStorage,
    storageKey: NOVEL_API_SETTINGS_KEY,
  });
}

function loadPersistedAssetLibrary() {
  try {
    const raw = localStorage.getItem(ASSET_LIBRARY_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return {
      characters: Array.isArray(data.characters) ? data.characters.map((asset) => normalizeAsset(asset, "角色")) : [],
      scenes: Array.isArray(data.scenes) ? data.scenes.map((asset) => normalizeAsset(asset, "场景")) : [],
      props: Array.isArray(data.props) ? data.props.map((asset) => normalizeAsset(asset, "道具")) : [],
    };
  } catch {
    return { characters: [], scenes: [], props: [] };
  }
}

function restorePersistedAssets(project) {
  if (project.nodes.some((node) => node.type === "assetLibrary")) return project;
  const saved = loadPersistedAssetLibrary();
  if (!saved.characters.length && !saved.scenes.length && !saved.props.length) return project;
  const episodeId = project.activeEpisodeId || project.episodes?.[0]?.id || "episode-1";
  const assetNode = createNode("assetLibrary", "node-restored-assets", { x: 80, y: 80 }, {
    displayName: "资产库",
    characters: saved.characters,
    scenes: saved.scenes,
    props: saved.props,
    episodeId,
  });
  assetNode.selected = false;
  return {
    ...project,
    nodes: [assetNode, ...project.nodes],
  };
}

function defaultEpisodes() {
  return [{ id: "episode-1", name: "第 1 集", note: "" }];
}

function normalizeProject(project) {
  const episodes = normalizeEpisodes(project.episodes);
  const activeEpisodeId = episodes.some((episode) => episode.id === project.activeEpisodeId) ? project.activeEpisodeId : episodes[0].id;
  const nodes = Array.isArray(project.nodes) ? project.nodes.map((node) => ({
    ...node,
    data: { ...(node.data || {}), episodeId: node.data?.episodeId || activeEpisodeId },
  })) : [];
  const businessProject = reconcileLoadedBusinessProjectFromCanvas(
    project.businessProject ? createCommercialProject(project.businessProject) : null,
    nodes,
  );
  const canvas = materializeLegacyCanvasFromBusinessProject(businessProject, nodes, Array.isArray(project.edges) ? project.edges : []);
  return {
    nodes: canvas.nodes,
    edges: canvas.edges,
    view: project.view && typeof project.view.scale === "number" ? project.view : { x: 0, y: 0, scale: 1 },
    settings: applyApiKeyVaultToImageSettings({ ...defaultSettings(), ...sanitizeSettingsForStorage(project.settings || {}) }),
    resources: normalizeProjectResources(project.resources, activeEpisodeId),
    timeline: normalizeTimelineState(project.timeline, activeEpisodeId, { defaultEpisodeTimeline }),
    promptFactory: normalizePromptFactoryState(project.promptFactory),
    templateCenter: normalizeTemplateCenterState(project.templateCenter),
    stylePresetCenter: normalizeStylePresetCenterState(project.stylePresetCenter),
    modelParamCenter: normalizeModelParamCenterState(project.modelParamCenter),
    exportPresetCenter: normalizeExportPresetCenterState(project.exportPresetCenter),
    collaborationState: normalizeCollaborationState(project.collaborationState),
    archiveState: normalizeArchiveState(project.archiveState),
    exportHistory: normalizeExportHistoryState(project.exportHistory),
    performanceSettings: normalizePerformanceSettings(project.performanceSettings),
    generationQueue: normalizeGenerationQueueState(project.generationQueue),
    productionEvents: normalizeProductionEventsState(project.productionEvents),
    episodes,
    activeEpisodeId,
    businessProject,
  };
}

function reconcileLoadedBusinessProjectFromCanvas(project = null, nodes = []) {
  if (!project) return null;
  return (Array.isArray(nodes) ? nodes : [])
    .filter((node) => ["novelPipeline", "assetLibrary", "shotList"].includes(node.type))
    .reduce((current, node) => applyCanvasNodeToProject(current, node), project);
}

function normalizeEpisodes(episodes) {
  const source = Array.isArray(episodes) && episodes.length ? episodes : defaultEpisodes();
  return source.map((episode, index) => ({
    id: episode.id || `episode-${index + 1}`,
    name: episode.name || `第 ${index + 1} 集`,
    note: episode.note || "",
  }));
}

function cacheProjectPayload(project, options = {}) {
  return createProjectCachePayload(project, projectSerializers, options);
}

const projectSerializers = {
  resource: resourceForStorage,
  timeline: timelineForStorage,
  promptFactory: promptFactoryForStorage,
  templateCenter: templateCenterForStorage,
  stylePresetCenter: stylePresetCenterForStorage,
  modelParamCenter: modelParamCenterForStorage,
  exportPresetCenter: exportPresetCenterForStorage,
  collaborationState: collaborationStateForStorage,
  archiveState: archiveStateForStorage,
  performanceSettings: performanceSettingsForStorage,
};

function inferNextNodeId(nodes) {
  const maxId = nodes.reduce((max, node) => {
    const match = String(node.id || "").match(/node-(\d+)/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return maxId + 1;
}

function providerLabel(settings) {
  const mode = currentProviderMode(settings);
  if (mode === "custom") return settings.customModel || "自定义 API";
  if (mode === "comfy") return "ComfyUI";
  return "Nano Banana 2";
}

  async function runImageGeneration(settings, prompt) {
    return createMediaProviderRuntime({
      runCustomApiGeneration,
      runCustomVideoApiGeneration,
      runComfyGeneration,
      makeGeneratedImage,
      enqueueComfyGeneration,
    }).runImageGeneration(settings, prompt);
  }

  async function runVideoGeneration(settings, prompt) {
    return createMediaProviderRuntime({
      runCustomApiGeneration,
      runCustomVideoApiGeneration,
      runComfyGeneration,
      makeGeneratedImage,
      enqueueComfyGeneration,
    }).runVideoGeneration(settings, prompt);
  }

let comfyGenerationChain = Promise.resolve();

function enqueueComfyGeneration(task) {
  const run = comfyGenerationChain.catch(() => {}).then(task);
  comfyGenerationChain = run.catch(() => {});
  return run;
}

async function loadBackendAiConfig() {
  const { loadBackendAiConfig: loadBackendAiConfigImpl } = await loadBackendServiceHelpers();
  return loadBackendAiConfigImpl({
    apiBase: API_BASE,
    applyImageApiKeyVault: applyApiKeyVaultToImageSettings,
  });
}

async function saveBackendAiConfig(settings) {
  const { saveBackendAiConfig: saveBackendAiConfigImpl } = await loadBackendServiceHelpers();
  return saveBackendAiConfigImpl(settings, {
    apiBase: API_BASE,
    forgetApiKey,
    rememberApiKey,
  });
}

async function loadRecentProjects() {
  const { loadRecentProjects: loadRecentProjectsImpl } = await loadBackendServiceHelpers();
  return loadRecentProjectsImpl();
}

async function runCustomApiGeneration(settings, prompt) {
  const { runCustomApiGeneration: runCustomApiGenerationImpl } = await loadBackendServiceHelpers();
  return runCustomApiGenerationImpl(settings, prompt, { apiBase: API_BASE });
}

async function runCustomVideoApiGeneration(settings, prompt) {
  const result = await runCustomApiGeneration(settings, prompt);
  const videoUrl = result.videoUrl || result.videoPath || (/(\.mp4|\.webm|\.mov)(\?|#|$)/i.test(result.imageUrl || "") ? result.imageUrl : "");
  if (videoUrl) {
    return {
      ...result,
      videoUrl,
      videoPath: result.videoPath || "",
      note: result.note || "API 视频",
    };
  }
  return {
    ...result,
    imageUrl: result.imageUrl || makeGeneratedImage(`API 视频预览\n${prompt}`),
    note: result.note || "API 视频接口返回了预览图，请检查结果字段是否指向视频 URL。",
  };
}

async function runNovelFactoryApi(config, parser = parseNovelFactoryOutput) {
  const { runNovelFactoryApi: runNovelFactoryApiImpl } = await loadBackendServiceHelpers();
  return runNovelFactoryApiImpl(config, parser, {
    novelApiProviders: NOVEL_API_PROVIDERS,
    normalizeNovelBodyTemplate,
    novelTemplateDefault: ACTIVE_NOVEL_TEMPLATE_DEFAULT,
    novelFactorySchema: NOVEL_FACTORY_SCHEMA,
  });
}

function parseNovelFactoryOutput(text, note = "小说工厂 API") {
  const cleaned = stripJsonFence(text);
  try {
    const data = parseJsonObjectLoose(cleaned);
    const characterAssets = normalizePromptAssets(data.characters, "角色");
    const sceneAssets = normalizePromptAssets(data.scenes, "场景");
    const propAssets = normalizePromptAssets(data.props || data.items || data.objects, "道具");
    const directShots = normalizeFactoryShots(data.shots);
    const shots = directShots.length ? directShots : deriveFactoryShotsFromPromptText(data);
    const characterPrompts = characterAssets.map((asset) => `【${asset.name}｜${asset.kind}】\n${asset.prompt}`).join("\n\n");
    const scenePrompts = sceneAssets.map((asset) => `【${asset.name}｜${asset.kind}】\n${asset.prompt}`).join("\n\n");
    const propPrompts = propAssets.map((asset) => `【${asset.name}｜${asset.kind}】\n${asset.prompt}`).join("\n\n");
    const videoPrompts = data.videoPrompts || shots.map((shot) => `${shot.id}：${shot.videoPrompt}`).join("\n");
    const finalPrompts = data.finalPrompts || [
      "【人物3视图及面部特写提示词】",
      characterPrompts,
      "",
      "【场景提示词】",
      scenePrompts,
      "",
      "【道具提示词】",
      propPrompts,
      "",
      "【AI视频提示词】",
      videoPrompts,
    ].join("\n");
    return {
      script: data.script || cleaned,
      characterPrompts,
      scenePrompts,
      propPrompts,
      videoPrompts,
      finalPrompts,
      characterAssets,
      sceneAssets,
      propAssets,
      shots,
      raw: cleaned,
      note,
    };
  } catch {
    const local = buildLocalNovelPipeline(cleaned, ACTIVE_NOVEL_TEMPLATE_DEFAULT);
    return { ...local, script: cleaned, raw: cleaned, note: `${note} · 文本回退解析` };
  }
}

function parseNovelScriptPackageOutput(text, note = "模板1 小说转剧本") {
  const cleaned = stripJsonFence(text);
  try {
    const data = parseJsonObjectLoose(cleaned);
    const scriptPackage = data.scriptPackage || data;
    return {
      scriptPackage,
      script: scriptPackage.finalScript || scriptPackage.script || cleaned,
      projectName: scriptPackage.projectName || "",
      raw: cleaned,
      note,
    };
  } catch {
    return { scriptPackage: { finalScript: cleaned }, script: cleaned, projectName: "", raw: cleaned, note: `${note} · 文本回退解析` };
  }
}

function parseNovelReviewPackageOutput(text, note = "模板2 提示词评价") {
  const cleaned = stripJsonFence(text);
  try {
    const data = parseJsonObjectLoose(cleaned);
    const gatePackage = data.gatePackage || null;
    const reviewPackage = gatePackage || data.reviewPackage || data;
    return {
      reviewPackage,
      gatePackage,
      review: normalizeNovelReviewFromReviewPackage(reviewPackage, note, cleaned),
      raw: cleaned,
      note,
    };
  } catch {
    const review = normalizeNovelReview({ summary: cleaned }, `${note} · 文本回退解析`, cleaned);
    return { reviewPackage: { summary: cleaned }, gatePackage: null, review, raw: cleaned, note: `${note} · 文本回退解析` };
  }
}

function parseNovelAssetRegistryOutput(text, note = "模板3 资产提取") {
  const cleaned = stripJsonFence(text);
  try {
    const data = parseJsonObjectLoose(cleaned);
    const assetRegistry = data.assetRegistry || data;
    const assets = Array.isArray(assetRegistry.assets) ? assetRegistry.assets.map(normalizeLinkedAssetCard).filter(Boolean) : [];
    return {
      assetRegistry,
      characterAssets: assets.filter((asset) => asset.category === "角色"),
      sceneAssets: assets.filter((asset) => asset.category === "场景"),
      propAssets: assets.filter((asset) => asset.category === "道具"),
      raw: cleaned,
      note,
    };
  } catch {
    return { assetRegistry: { assets: [] }, characterAssets: [], sceneAssets: [], propAssets: [], raw: cleaned, note: `${note} · 文本回退解析` };
  }
}

function parseNovelStoryboardPackageOutput(text, note = "模板4 分镜提示词") {
  const cleaned = stripJsonFence(text);
  try {
    const data = parseJsonObjectLoose(cleaned);
    const storyboardPackage = data.storyboardPackage || data;
    const shots = normalizeLinkedStoryboardShots(storyboardPackage.shots || []);
    return {
      storyboardPackage,
      shots,
      raw: cleaned,
      note,
    };
  } catch {
    return { storyboardPackage: { shots: [] }, shots: [], raw: cleaned, note: `${note} · 文本回退解析` };
  }
}

function buildPipelineFromTemplateChain({ sourceText = "", scriptStep = {}, reviewStep = {}, assetStep = {}, storyboardStep = {} } = {}) {
  const characterAssets = assetStep.characterAssets || [];
  const sceneAssets = assetStep.sceneAssets || [];
  const propAssets = assetStep.propAssets || [];
  const shots = storyboardStep.shots || [];
  return {
    script: scriptStep.script || "",
    projectName: scriptStep.projectName || scriptStep.scriptPackage?.projectName || buildCineForgeProjectName("novel", sourceText),
    review: reviewStep.review || null,
    reviewPackage: reviewStep.reviewPackage || null,
    gatePackage: reviewStep.gatePackage || null,
    assetRegistry: assetStep.assetRegistry || null,
    storyboardPackage: storyboardStep.storyboardPackage || null,
    characterAssets,
    sceneAssets,
    propAssets,
    characterPrompts: formatAssetPrompts(characterAssets),
    scenePrompts: formatAssetPrompts(sceneAssets),
    propPrompts: formatAssetPrompts(propAssets),
    videoPrompts: shots.map((shot) => `${shot.id}：${shot.videoPrompt || ""}`).join("\n"),
    finalPrompts: [
      "【模板1 剧本】",
      scriptStep.script || "",
      "",
      "【模板2 评价】",
      formatNovelReview(reviewStep.review),
      "",
      "【模板3 资产提示词】",
      "【人物资产】",
      formatAssetPrompts(characterAssets),
      "",
      "【场景资产】",
      formatAssetPrompts(sceneAssets),
      "",
      "【道具资产】",
      formatAssetPrompts(propAssets),
      "",
      "【模板4 分镜提示词】",
      shots.map((shot) => `${shot.id}\n图片：${shot.imagePrompt || ""}\n视频：${shot.videoPrompt || ""}`).join("\n\n"),
    ].join("\n"),
    shots,
    raw: JSON.stringify({
      scriptPackage: scriptStep.scriptPackage || null,
      reviewPackage: reviewStep.reviewPackage || null,
      gatePackage: reviewStep.gatePackage || null,
      assetRegistry: assetStep.assetRegistry || null,
      storyboardPackage: storyboardStep.storyboardPackage || null,
    }, null, 2),
    note: "小说工厂 API · 已按模板1/2/3/4整理",
    stage: "prompts_ready",
  };
}

function normalizeNovelReviewFromReviewPackage(reviewPackage = {}, note = "模板2 提示词评价", raw = "") {
  if (reviewPackage?.gateDecision) {
    return normalizeNovelGatePackage(reviewPackage, note, raw);
  }
  const scoreSummary = reviewPackage.scoreSummary || {};
  const dimensionScores = Array.isArray(reviewPackage.dimensionScores) ? reviewPackage.dimensionScores : [];
  return normalizeNovelReview({
    score: scoreSummary.rawTotal,
    status: scoreSummary.status,
    summary: reviewPackage.commercialReadiness || "",
    dimensions: dimensionScores.map((item) => ({
      name: item.dimension,
      score: item.score,
      maxScore: 100,
      comment: item.reason,
    })),
    issues: Array.isArray(reviewPackage.keyProblems) ? reviewPackage.keyProblems.map((item) => ({
      level: item.priority || "建议",
      target: item.sceneRefs?.join("、") || "全文",
      problem: item.problem || item.evidence || "",
      suggestion: item.fix || "",
    })) : [],
    shouldAutoRevise: Boolean(reviewPackage.handoffDecision?.toRewrite),
    revisionInstruction: reviewPackage.revisionInstruction || "",
    commercialReadiness: reviewPackage.commercialReadiness || "",
    productionBlockers: Array.isArray(reviewPackage.productionBlockers)
      ? reviewPackage.productionBlockers.map((item) => typeof item === "string" ? item : `${item.priority || ""} ${item.type || ""} ${item.impact || item.fix || ""}`.trim())
      : [],
    keepList: Array.isArray(reviewPackage.keepList) ? reviewPackage.keepList : [],
  }, note, raw);
}

function normalizeNovelGatePackage(gatePackage = {}, note = "模板2 提示词评价", raw = "") {
  const gateDecision = gatePackage.gateDecision || {};
  const blockingIssues = Array.isArray(gateDecision.blockingIssues) ? gateDecision.blockingIssues : [];
  const assetReady = Boolean(gateDecision.assetExtractionReady);
  const storyboardReady = Boolean(gateDecision.storyboardReady);
  const needsRepair = Boolean(gateDecision.needsScriptRepair) || blockingIssues.some((item) => item.priority === "P0" || item.priority === "P1");
  const ready = assetReady && storyboardReady && !needsRepair && blockingIssues.length === 0;
  const issueLines = blockingIssues.map((item) => `${item.priority || "建议"} ${item.ref || "全文"} ${item.problem || ""} ${item.fixInstruction || ""}`.trim()).filter(Boolean);
  return normalizeNovelReview({
    score: ready ? 100 : (assetReady || storyboardReady ? 60 : 0),
    status: ready ? "passed" : "needs_repair",
    summary: [
      `资产提取：${assetReady ? "就绪" : "未就绪"}`,
      `分镜生成：${storyboardReady ? "就绪" : "未就绪"}`,
      `剧本修复：${needsRepair ? "需要" : "不需要"}`,
    ].join("；"),
    dimensions: [
      { name: "资产提取交接", score: assetReady ? 100 : 0, maxScore: 100, comment: gatePackage.assetExtractionBrief?.instructionForTemplate3 || "" },
      { name: "分镜生成交接", score: storyboardReady ? 100 : 0, maxScore: 100, comment: gatePackage.storyboardBrief?.instructionForTemplate4 || "" },
    ],
    issues: blockingIssues.map((item) => ({
      level: item.priority || "建议",
      target: item.ref || "全文",
      problem: item.problem || item.type || "",
      suggestion: item.fixInstruction || "",
    })),
    shouldAutoRevise: needsRepair,
    revisionInstruction: issueLines.join("\n"),
    commercialReadiness: ready ? "ready" : (needsRepair ? "needs_script_repair" : "needs_work"),
    productionBlockers: issueLines,
    keepList: [
      assetReady ? "assetExtractionBrief 已就绪" : "",
      storyboardReady ? "storyboardBrief 已就绪" : "",
    ].filter(Boolean),
  }, note, raw);
}

function normalizeLinkedAssetCard(entry = {}, index = 0) {
  const card = entry.assetCard || entry;
  const promptOutput = entry.promptOutput || card.promptOutput || {};
  const typeLabel = linkedAssetTypeLabel(card.assetType);
  const name = card.assetName || card.name || card.token || `${typeLabel}${index + 1}`;
  const promptVariants = {
    nanoBanana: promptOutput.nano_gemini || promptOutput.nanoBanana || promptOutput.gemini || "",
    openSource: promptOutput.open_model || promptOutput.openSource || "",
    midjourney: promptOutput.midjourney || promptOutput.mj || "",
  };
  const prompt = [
    buildAssetPromptPackage(promptVariants),
    promptOutput.chatgpt_image2 ? `【ChatGPT Image 2】\n${promptOutput.chatgpt_image2}` : "",
  ].filter(Boolean).join("\n\n");
  return normalizeAsset({
    id: card.assetId || `${typeLabel}-${index + 1}`,
    name,
    kind: typeLabel,
    token: card.token || makeAssetToken(typeLabel, name),
    meta: [
      card.coreFacts?.identity,
      card.coreFacts?.function,
      card.styleProfile?.renderSystem,
      card.viewSpec,
    ].filter(Boolean).join(" · "),
    prompt: prompt || Object.values(promptOutput).filter(Boolean).join("\n\n") || JSON.stringify(card.coreFacts || {}),
    promptVariants,
    visualLock: Array.isArray(card.visualLock) ? card.visualLock.join("；") : card.visualLock || "",
    continuityRule: formatLinkedContinuityRule(card.continuityRule),
    referenceResources: card.referenceResources || "",
    evidenceSource: card.evidenceSource || card.linkedRefs?.sourceEvidence || [],
    cineForge: { ...card, promptOutput },
  }, typeLabel);
}

function linkedAssetTypeLabel(value = "") {
  const text = String(value || "").toLowerCase();
  if (text.includes("character")) return "角色";
  if (text.includes("scene")) return "场景";
  if (text.includes("prop")) return "道具";
  if (/角色|场景|道具/.test(String(value || ""))) return String(value || "");
  return "资产";
}

function formatLinkedContinuityRule(rule = "") {
  if (!rule || typeof rule !== "object") return String(rule || "");
  return [
    Array.isArray(rule.immutable) && rule.immutable.length ? `不可变：${rule.immutable.join("、")}` : "",
    Array.isArray(rule.variable) && rule.variable.length ? `可变：${rule.variable.join("、")}` : "",
    Array.isArray(rule.stageVariants) && rule.stageVariants.length ? `阶段变化：${rule.stageVariants.map((item) => item.description || item.variantId || "").filter(Boolean).join("；")}` : "",
  ].filter(Boolean).join("；");
}

function normalizeLinkedStoryboardShots(items = []) {
  return (Array.isArray(items) ? items : []).map((shot, index) => {
    const assetRefs = flattenStoryboardAssetRefs(shot.assetRefs);
    return {
      id: shot.shotId || shot.id || `S${String(index + 1).padStart(2, "0")}`,
      episode: shot.episodeId || "EP01",
      scene: shot.sceneId || shot.title || "",
      title: shot.title || "",
      scriptContent: shot.scriptContent || "",
      storyFunction: shot.storyFunction || "",
      frameIntent: shot.frameIntent || "",
      characters: assetRefs.characters,
      shotSize: shot.shotType || "",
      camera: shot.camera || "",
      openingFrame: shot.openingFrame || "",
      action: typeof shot.action === "object" ? JSON.stringify(shot.action, null, 2) : shot.action || "",
      closingFrame: shot.closingFrame || "",
      transition: shot.transition || "",
      dialogue: shot.sound?.voice || "",
      sound: typeof shot.sound === "object" ? JSON.stringify(shot.sound, null, 2) : shot.sound || "",
      mainCharacterToken: assetRefs.characters[0] || "",
      mainSceneToken: assetRefs.scenes[0] || "",
      keyPropTokens: assetRefs.props,
      assetRefs: [...assetRefs.characters, ...assetRefs.scenes, ...assetRefs.props, ...assetRefs.other],
      continuityLocks: Array.isArray(shot.continuityLocks) ? shot.continuityLocks : [],
      imagePrompt: shot.imagePrompt || shot.mainPrompt || "",
      videoPrompt: shot.videoPrompt || "",
      mainPrompt: shot.mainPrompt || "",
      compulsoryDeclaration: shot.compulsoryDeclaration || "",
      qualityBaseline: shot.qualityBaseline || "",
      status: "待生成",
      storyboard: shot,
    };
  });
}

function flattenStoryboardAssetRefs(assetRefs = {}) {
  if (Array.isArray(assetRefs)) return { characters: [], scenes: [], props: [], other: assetRefs.filter(Boolean) };
  return {
    characters: Array.isArray(assetRefs.characters) ? assetRefs.characters.filter(Boolean) : [],
    scenes: Array.isArray(assetRefs.scenes) ? assetRefs.scenes.filter(Boolean) : [],
    props: Array.isArray(assetRefs.props) ? assetRefs.props.filter(Boolean) : [],
    other: Array.isArray(assetRefs.other) ? assetRefs.other.filter(Boolean) : [],
  };
}

function deriveFactoryShotsFromPromptText(data = {}) {
  const sourceText = extractVideoPromptSectionText(data);
  if (!sourceText.trim()) return [];
  const blocks = sourceText
    .split(/\n\s*\n+/)
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  return blocks
    .map((block, index) => parseFactoryShotBlock(block, index))
    .filter(Boolean);
}

function extractVideoPromptSectionText(data = {}) {
  const finalPrompts = String(data.finalPrompts || "").trim();
  const videoPrompts = String(data.videoPrompts || "").trim();
  const marker = "【AI视频提示词】";
  if (finalPrompts.includes(marker)) {
    return finalPrompts.slice(finalPrompts.indexOf(marker) + marker.length).trim();
  }
  return videoPrompts;
}

function parseFactoryShotBlock(block, index) {
  const lines = String(block || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return null;
  const header = lines[0];
  const shotIdMatch = header.match(/\bS(\d{2,})\b/i) || block.match(/\bS(\d{2,})\b/i);
  const shotNumberMatch = header.match(/视频镜头\s*(\d+)/) || block.match(/视频镜头\s*(\d+)/);
  const shotId = shotIdMatch
    ? `S${String(shotIdMatch[1]).padStart(2, "0")}`
    : shotNumberMatch
      ? `S${String(shotNumberMatch[1]).padStart(2, "0")}`
      : `S${String(index + 1).padStart(2, "0")}`;
  const scene = header.match(/｜([^】\n]+)/)?.[1]?.trim()
    || header.replace(/^[【\[]?视频镜头\s*\d+[^\n】]*[】\]]?/g, "").replace(/^[S]\d{2,}\s*[：:]/i, "").trim();
  const promptLine = lines.find((line) => /^AI视频提示词[:：]/.test(line));
  const negativeLine = lines.find((line) => /^负面提示词[:：]/.test(line));
  const videoPrompt = promptLine
    ? promptLine.replace(/^AI视频提示词[:：]\s*/, "").trim()
    : lines.slice(1).filter((line) => !/^负面提示词[:：]/.test(line)).join("，").trim();
  if (!videoPrompt) return null;
  return {
    id: shotId,
    scene,
    shotSize: "中景",
    duration: "4秒",
    videoPrompt,
    negativePrompt: negativeLine ? negativeLine.replace(/^负面提示词[:：]\s*/, "").trim() : "",
    assetRefs: extractAssetTokens(videoPrompt),
    status: "待生成",
  };
}

function parseNovelScriptOutput(text, note = "小说工厂 API") {
  const cleaned = stripJsonFence(text);
  try {
    const data = parseJsonObjectLoose(cleaned);
    return {
      script: data.script || data.revisedScript || data.text || cleaned,
      raw: cleaned,
      note,
    };
  } catch {
    return { script: cleaned, raw: cleaned, note: `${note} · 文本回退解析` };
  }
}

function parseNovelPlanningOutput(text, note = "小说工厂 API") {
  const cleaned = stripJsonFence(text);
  try {
    const data = parseJsonObjectLoose(cleaned);
    return {
      plan: {
        projectName: data.projectName || data.title || "",
        logline: data.logline || data.summary || "",
        characters: Array.isArray(data.characters) ? data.characters : [],
        plotOutline: Array.isArray(data.plotOutline) ? data.plotOutline : (Array.isArray(data.outline) ? data.outline : []),
        writingBrief: data.writingBrief || data.brief || cleaned,
        suspenseMap: Array.isArray(data.suspenseMap) ? data.suspenseMap : [],
        visualAnchorMap: data.visualAnchorMap && typeof data.visualAnchorMap === "object" ? data.visualAnchorMap : {},
        sceneFunctionMap: Array.isArray(data.sceneFunctionMap) ? data.sceneFunctionMap : [],
        adaptationRiskMap: Array.isArray(data.adaptationRiskMap) ? data.adaptationRiskMap : [],
        hookEscalationPlan: Array.isArray(data.hookEscalationPlan) ? data.hookEscalationPlan : [],
        beatSheet: Array.isArray(data.beatSheet) ? data.beatSheet : [],
        dialogueStrategy: data.dialogueStrategy && typeof data.dialogueStrategy === "object" ? data.dialogueStrategy : {},
      },
      raw: cleaned,
      note,
    };
  } catch {
    return {
      plan: {
        projectName: "",
        logline: "",
        characters: [],
        plotOutline: [],
        writingBrief: cleaned,
        suspenseMap: [],
        visualAnchorMap: {},
        sceneFunctionMap: [],
        adaptationRiskMap: [],
        hookEscalationPlan: [],
        beatSheet: [],
        dialogueStrategy: {},
      },
      raw: cleaned,
      note: `${note} · 文本回退解析`,
    };
  }
}

function parseNovelReviewOutput(text, note = "小说工厂 API") {
  const cleaned = stripJsonFence(text);
  try {
    const data = parseJsonObjectLoose(cleaned);
    if (data.gatePackage || data.reviewPackage?.gateDecision || data.gateDecision) {
      const reviewPackage = data.gatePackage || data.reviewPackage || data;
      return normalizeNovelReviewFromReviewPackage(reviewPackage, note, cleaned);
    }
    return normalizeNovelReview(data, note, cleaned);
  } catch {
    return normalizeNovelReview({ summary: cleaned, issues: [{ level: "建议", target: "全文", problem: "API 返回了非 JSON 文本", suggestion: cleaned }] }, `${note} · 文本回退解析`, cleaned);
  }
}

function parseNovelRevisionOutput(text, note = "小说工厂 API") {
  const cleaned = stripJsonFence(text);
  try {
    const data = parseJsonObjectLoose(cleaned);
    return {
      revisedScript: data.revisedScript || data.script || data.text || cleaned,
      changeLog: Array.isArray(data.changeLog) ? data.changeLog : [],
      fixedIssues: Array.isArray(data.fixedIssues) ? data.fixedIssues : [],
      remainingRisks: Array.isArray(data.remainingRisks) ? data.remainingRisks : [],
      assetRefreshPlan: Array.isArray(data.assetRefreshPlan) ? data.assetRefreshPlan : [],
      raw: cleaned,
      note: data.note || note,
    };
  } catch {
    return { revisedScript: cleaned, changeLog: [], fixedIssues: [], remainingRisks: [], assetRefreshPlan: [], raw: cleaned, note: `${note} · 文本回退解析` };
  }
}

function parseShotRevisionOutput(text, note = "小说工厂 API") {
  const cleaned = stripJsonFence(text);
  try {
    const data = parseJsonObjectLoose(cleaned);
    return {
      patch: data.patch && typeof data.patch === "object" ? data.patch : {},
      changeLog: Array.isArray(data.changeLog) ? data.changeLog : [],
      fixedIssues: Array.isArray(data.fixedIssues) ? data.fixedIssues : [],
      assetRefreshPlan: Array.isArray(data.assetRefreshPlan) ? data.assetRefreshPlan : [],
      summary: data.summary || "",
      raw: cleaned,
      note,
    };
  } catch {
    return { patch: {}, changeLog: [], fixedIssues: [], assetRefreshPlan: [], summary: cleaned, raw: cleaned, note: `${note} · 文本回退解析` };
  }
}

function parseTimelineClipReviewOutput(text, note = "小说工厂 API") {
  const cleaned = stripJsonFence(text);
  try {
    const data = parseJsonObjectLoose(cleaned);
    return {
      score: Number(data.score || 0),
      status: String(data.status || "").trim() || "unknown",
      summary: String(data.summary || "").trim(),
      approvalStatus: String(data.approvalStatus || "").trim(),
      approvalNote: String(data.approvalNote || "").trim(),
      issues: Array.isArray(data.issues) ? data.issues.map((item) => ({
        level: String(item?.level || "").trim() || "建议",
        target: String(item?.target || "").trim() || "当前片段",
        problem: String(item?.problem || "").trim(),
        suggestion: String(item?.suggestion || "").trim(),
      })) : [],
      shouldRegenerate: Boolean(data.shouldRegenerate),
      nextAction: String(data.nextAction || "").trim(),
      raw: cleaned,
      note,
    };
  } catch {
    return {
      score: 0,
      status: "fallback",
      summary: cleaned,
      approvalStatus: "",
      approvalNote: "",
      issues: [{ level: "建议", target: "当前片段", problem: "API 返回了非 JSON 文本", suggestion: cleaned }],
      shouldRegenerate: false,
      nextAction: "",
      raw: cleaned,
      note: `${note} · 文本回退解析`,
    };
  }
}

function parseNovelAssetSliceOutput(text, note = "小说工厂 API") {
  const cleaned = stripJsonFence(text);
  try {
    const data = parseJsonObjectLoose(cleaned);
    return {
      characterAssets: normalizeCineForgeAssets(data.characters, "角色"),
      sceneAssets: normalizeCineForgeAssets(data.scenes, "场景"),
      propAssets: normalizeCineForgeAssets(data.props, "道具"),
      raw: cleaned,
      note,
    };
  } catch {
    return { characterAssets: [], sceneAssets: [], propAssets: [], raw: cleaned, note: `${note} · 文本回退解析` };
  }
}

function normalizeCineForgeAssets(items, fallbackKind) {
  return (Array.isArray(items) ? items : []).map((item, index) => {
    const name = String(item.name || `${fallbackKind}${index + 1}`).trim();
    const promptVariants = buildAssetPromptVariants(item);
    const promptPackage = buildAssetPromptPackage(promptVariants);
    const prompt = promptPackage || item.aiPrompt || item.prompt || [
      item.appearance,
      item.ageFeeling,
      item.genderTemperament,
      item.hair,
      item.face,
      item.bodyHabit,
      item.clothing,
      item.professionAttack,
      item.skillVisual,
      item.personality,
      item.colorPalette,
      item.visualAnchor,
      item.continuityRule,
      item.atmosphere,
      item.materials,
      item.landmarks,
      item.locationType,
      item.sceneFunction,
      item.lightStructure,
      item.architecture,
      item.movementPath,
      item.depthRelation,
      item.dramaticFunction,
      item.form,
      item.material,
      item.sizeFeeling,
      item.surfaceState,
      item.structureDetails,
      item.useMarks,
      item.powerFeeling,
      item.ownerConflict,
      item.stageChange,
    ].filter(Boolean).join("，");
    const meta = [
      item.role,
      item.timeOfDay,
      item.atmosphere,
      item.dramaticFunction,
      item.visualAnchor,
    ].filter(Boolean).join(" · ");
    const evidenceSource = Array.isArray(item.evidenceSource)
      ? item.evidenceSource.filter(Boolean).map((entry) => String(entry).trim()).filter(Boolean)
      : String(item.evidenceSource || "").trim()
        ? [String(item.evidenceSource || "").trim()]
        : [];
    return normalizeAsset({
      id: item.id || `${fallbackKind}-${index + 1}`,
      name,
      kind: item.kind || fallbackKind,
      token: item.token || makeAssetToken(fallbackKind, name),
      meta,
      prompt,
      promptVariants,
      visualLock: item.visualLock || item.visualAnchor || "",
      continuityRule: item.continuityRule || item.stageChange || "",
      referenceResources: item.referenceResources || "",
      evidenceSource,
      cineForge: item,
    }, fallbackKind);
  }).filter((asset) => asset.name && asset.prompt);
}

function buildAssetPromptVariants(item) {
  const prompts = item?.prompts || item?.promptVersions || {};
  return {
    nanoBanana: String(item?.nanoBananaPrompt || item?.geminiPrompt || prompts.nanoBanana || prompts.gemini || prompts.nanoBananaGemini || "").trim(),
    openSource: String(item?.openSourcePrompt || prompts.openSource || prompts.opensource || "").trim(),
    midjourney: String(item?.midjourneyPrompt || item?.mjPrompt || prompts.midjourney || prompts.mj || "").trim(),
  };
}

function normalizeAssetPromptVariants(value) {
  return {
    nanoBanana: String(value?.nanoBanana || value?.gemini || value?.nanoBananaPrompt || "").trim(),
    openSource: String(value?.openSource || value?.openSourcePrompt || "").trim(),
    midjourney: String(value?.midjourney || value?.midjourneyPrompt || value?.mj || "").trim(),
  };
}

function extractAssetPromptVariantsFromText(text) {
  const source = String(text || "");
  const labels = [
    ["nanoBanana", "NanoBanana / Gemini 图像提示词（中文）"],
    ["openSource", "开源模型版提示词（中文段落）"],
    ["midjourney", "Midjourney 提示词"],
  ];
  const readSection = (label) => {
    const marker = `【${label}】`;
    const start = source.indexOf(marker);
    if (start < 0) return "";
    const contentStart = start + marker.length;
    let end = source.length;
    labels.forEach(([, otherLabel]) => {
      if (otherLabel === label) return;
      const nextIndex = source.indexOf(`【${otherLabel}】`, contentStart);
      if (nextIndex >= 0 && nextIndex < end) end = nextIndex;
    });
    return source.slice(contentStart, end).trim();
  };
  return {
    nanoBanana: readSection("NanoBanana / Gemini 图像提示词（中文）"),
    openSource: readSection("开源模型版提示词（中文段落）"),
    midjourney: readSection("Midjourney 提示词"),
  };
}

function buildAssetPromptPackage(item) {
  const variants = item?.nanoBanana !== undefined || item?.openSource !== undefined || item?.midjourney !== undefined
    ? normalizeAssetPromptVariants(item)
    : buildAssetPromptVariants(item);
  const nano = variants.nanoBanana;
  const open = variants.openSource;
  const mj = variants.midjourney;
  if (!nano && !open && !mj) return "";
  return [
    nano ? `【NanoBanana / Gemini 图像提示词（中文）】\n${nano}` : "",
    open ? `【开源模型版提示词（中文段落）】\n${open}` : "",
    mj ? `【Midjourney 提示词】\n${mj}` : "",
  ].filter(Boolean).join("\n\n");
}

function buildPipelineFromAssets(script, characterAssets, sceneAssets, propAssets, note = "CineForge 资产抽取") {
  return {
    script,
    characterAssets,
    sceneAssets,
    propAssets,
    characterPrompts: formatAssetPrompts(characterAssets),
    scenePrompts: formatAssetPrompts(sceneAssets),
    propPrompts: formatAssetPrompts(propAssets),
    videoPrompts: "",
    finalPrompts: [
      "【人物资产】",
      formatAssetPrompts(characterAssets),
      "",
      "【场景资产】",
      formatAssetPrompts(sceneAssets),
      "",
      "【道具资产】",
      formatAssetPrompts(propAssets),
    ].join("\n"),
    shots: [],
    raw: "",
    note,
  };
}

function formatAssetPrompts(assets) {
  return (assets || []).map((asset) => [
    `【${asset.name}｜${asset.kind}｜${asset.token}】`,
    asset.prompt || "",
    asset.visualLock ? `视觉锁定：${asset.visualLock}` : "",
    asset.continuityRule ? `连续性：${asset.continuityRule}` : "",
    asset.evidenceSource?.length ? `证据来源：${asset.evidenceSource.join("；")}` : "",
  ].filter(Boolean).join("\n")).join("\n\n");
}

function formatNovelPlanning(plan) {
  if (!plan) return "";
  const visualAnchorLines = Object.entries(plan.visualAnchorMap || {}).flatMap(([key, list]) => {
    const items = Array.isArray(list) ? list : [];
    if (!items.length) return [];
    return [`- ${key}：${items.join("；")}`];
  });
  const dialogueStrategyLines = Object.entries(plan.dialogueStrategy || {}).flatMap(([key, value]) => {
    if (!String(value || "").trim()) return [];
    return [`- ${key}：${value}`];
  });
  return [
    `项目：${plan.projectName || "未命名"}`,
    `一句话：${plan.logline || "无"}`,
    "",
    "人物：",
    ...(Array.isArray(plan.characters) && plan.characters.length ? plan.characters.map((item) => `- ${item.name || "人物"}：${item.role || ""} ${item.motivation || ""}`.trim()) : ["- 暂无"]),
    "",
    "剧情节点：",
    ...(Array.isArray(plan.plotOutline) && plan.plotOutline.length ? plan.plotOutline.map((item, index) => `${index + 1}. ${typeof item === "string" ? item : JSON.stringify(item)}`) : ["1. 暂无"]),
    "",
    "写作规划：",
    plan.writingBrief || "",
    "",
    "悬念地图：",
    ...(Array.isArray(plan.suspenseMap) && plan.suspenseMap.length
      ? plan.suspenseMap.map((item, index) => `${index + 1}. ${item.scene || `场次${index + 1}`}｜问题：${item.question || "未写"}｜延迟：${item.delay || "无"}｜兑现：${item.payoff || "无"}`)
      : ["1. 暂无"]),
    "",
    "视觉锚点：",
    ...(visualAnchorLines.length ? visualAnchorLines : ["- 暂无"]),
    "",
    "场次功能：",
    ...(Array.isArray(plan.sceneFunctionMap) && plan.sceneFunctionMap.length
      ? plan.sceneFunctionMap.map((item) => `- ${item.scene || "未命名场次"}：${item.function || "未写"}`)
      : ["- 暂无"]),
    "",
    "改编风险：",
    ...(Array.isArray(plan.adaptationRiskMap) && plan.adaptationRiskMap.length
      ? plan.adaptationRiskMap.map((item) => `- ${item.risk || "未命名风险"}：${item.strategy || "未写规避策略"}`)
      : ["- 暂无"]),
    "",
    "钩子升级：",
    ...(Array.isArray(plan.hookEscalationPlan) && plan.hookEscalationPlan.length ? plan.hookEscalationPlan.map((item, index) => `${index + 1}. ${item}`) : ["1. 暂无"]),
    "",
    "Beat Sheet：",
    ...(Array.isArray(plan.beatSheet) && plan.beatSheet.length
      ? plan.beatSheet.map((item, index) => `${index + 1}. ${item.scene || `场次${index + 1}`}｜开场：${item.openingImage || "无"}｜变化：${item.turn || "无"}｜尾钩：${item.closingHook || "无"}`)
      : ["1. 暂无"]),
    "",
    "台词策略：",
    ...(dialogueStrategyLines.length ? dialogueStrategyLines : ["- 暂无"]),
  ].join("\n");
}

function normalizeNovelReview(data, note, raw = "") {
  const dimensions = Array.isArray(data.dimensions) ? data.dimensions.map((item, index) => ({
    name: item.name || `维度${index + 1}`,
    score: item.score ?? "",
    maxScore: item.maxScore ?? item.max ?? "",
    comment: item.comment || item.suggestion || "",
  })) : [];
  const issues = Array.isArray(data.issues) ? data.issues.map((item) => ({
    level: item.level || item.severity || "建议",
    target: item.target || item.scene || "全文",
    problem: item.problem || item.issue || "",
    suggestion: item.suggestion || item.fix || "",
  })) : [];
  return {
    score: data.score ?? data.totalScore ?? "",
    status: data.status || "",
    summary: data.summary || data.comment || "",
    dimensions,
    issues,
    shouldAutoRevise: Boolean(data.shouldAutoRevise ?? data.autoRevise ?? issues.length),
    revisionInstruction: data.revisionInstruction || data.revision || data.rewriteInstruction || "",
    executionPriority: Array.isArray(data.executionPriority) ? data.executionPriority : [],
    commercialReadiness: data.commercialReadiness || "",
    recommendedFormat: data.recommendedFormat || data.releaseFormat || "",
    productionBlockers: Array.isArray(data.productionBlockers) ? data.productionBlockers : [],
    keepList: Array.isArray(data.keepList) ? data.keepList : [],
    rewriteExample: data.rewriteExample || "",
    raw,
    note,
  };
}

function formatNovelReview(review) {
  if (!review) return "";
  const lines = [
    `总分：${review.score || "未给分"}`,
    `状态：${review.status === "passed" ? "通过" : review.status === "failed" ? "需优化" : "未判定"}`,
    `总体评价：${review.summary || "无"}`,
    `建议自动修改：${review.shouldAutoRevise ? "是" : "否"}`,
  ];
  if (review.commercialReadiness) lines.push(`商业就绪度：${review.commercialReadiness}`);
  if (review.recommendedFormat) lines.push(`推荐发布形态：${review.recommendedFormat}`);
  if (review.dimensions?.length) {
    lines.push("", "分项评分：");
    review.dimensions.forEach((item) => {
      const score = item.maxScore ? `${item.score}/${item.maxScore}` : item.score;
      lines.push(`- ${item.name}：${score || "未给分"} ${item.comment || ""}`.trim());
    });
  }
  if (review.issues?.length) {
    lines.push("", "修改意见：");
    review.issues.forEach((item, index) => {
      lines.push(`${index + 1}. 【${item.level}】${item.target}：${item.problem}${item.suggestion ? `；建议：${item.suggestion}` : ""}`);
    });
  }
  if (review.productionBlockers?.length) {
    lines.push("", "生产阻塞项：");
    review.productionBlockers.forEach((item, index) => {
      lines.push(`${index + 1}. ${item}`);
    });
  }
  if (review.keepList?.length) {
    lines.push("", "必须保留：");
    review.keepList.forEach((item, index) => {
      lines.push(`${index + 1}. ${item}`);
    });
  }
  if (review.executionPriority?.length) {
    lines.push("", "执行优先级：");
    review.executionPriority.forEach((item, index) => {
      lines.push(`${index + 1}. ${item}`);
    });
  }
  if (review.revisionInstruction) lines.push("", "自动修订指令：", review.revisionInstruction);
  if (review.rewriteExample) lines.push("", "改写示范：", review.rewriteExample);
  return lines.join("\n");
}

function buildNovelRevisionInput(script, review) {
  return JSON.stringify({
    sourceScript: script || "",
    review: {
      score: review?.score || "",
      status: review?.status || "",
      summary: review?.summary || "",
      dimensions: Array.isArray(review?.dimensions) ? review.dimensions : [],
      issues: Array.isArray(review?.issues) ? review.issues : [],
      shouldAutoRevise: Boolean(review?.shouldAutoRevise),
      revisionInstruction: review?.revisionInstruction || "",
      executionPriority: Array.isArray(review?.executionPriority) ? review.executionPriority : [],
      commercialReadiness: review?.commercialReadiness || "",
      recommendedFormat: review?.recommendedFormat || "",
      productionBlockers: Array.isArray(review?.productionBlockers) ? review.productionBlockers : [],
      keepList: Array.isArray(review?.keepList) ? review.keepList : [],
      rewriteExample: review?.rewriteExample || "",
    },
    executionRule: "必须优先修复 productionBlockers 与必须修改项；保留 keepList；修订后若资产或镜头提示词可能失效，要在 assetRefreshPlan 中明确指出。",
  }, null, 2);
}

function buildLocalScriptReview(script) {
  const lengthScore = Math.min(35, Math.max(12, Math.round(script.length / 120)));
  const hasScenes = /场|地点|画面|镜头/.test(script);
  const hasDialogue = /对白|：|"/.test(script);
  const score = Math.min(100, lengthScore + (hasScenes ? 28 : 8) + (hasDialogue ? 22 : 8) + 15);
  return normalizeNovelReview({
    score,
    commercialReadiness: hasScenes && hasDialogue ? "needs_work" : "blocked",
    recommendedFormat: "连续短剧 / 漫剧章节",
    summary: "本地规则仅做结构完整性质检，正式生产建议使用 API 评价模板。",
    dimensions: [
      { name: "StoryProgress", score: hasScenes ? 82 : 58, maxScore: 100, comment: hasScenes ? "具备场景或镜头信息" : "缺少明确场景/镜头信息" },
      { name: "CharacterEmotion", score: 72, maxScore: 100, comment: "本地规则无法深入判断人物情绪弧线" },
      { name: "DialogueQuality", score: hasDialogue ? 80 : 56, maxScore: 100, comment: hasDialogue ? "存在对白或角色发言" : "对白不足" },
      { name: "PaceControl", score: 70, maxScore: 100, comment: "节奏需由 API 进一步判断" },
      { name: "Readability", score: 72, maxScore: 100, comment: "追读力已有基础，可继续加强钩子" },
      { name: "AntiAI", score: 74, maxScore: 100, comment: "本地规则仅做粗略判断" },
      { name: "FormatCompliance", score: hasScenes ? 84 : 62, maxScore: 100, comment: hasScenes ? "格式基本可用" : "格式信息不足" },
    ],
    issues: [
      { level: "建议", target: "全文", problem: "本地评价无法理解剧情细节", suggestion: "接入 API 后按评价模板生成逐场修改意见" },
    ],
    productionBlockers: hasScenes ? [] : ["场景信息不足，无法稳定拆镜与抽资产"],
    keepList: hasDialogue ? ["保留已有对白基础"] : [],
    rewriteExample: "示例：把解释型对白改成角色行动和短句反击，再补一个结尾钩子。",
    shouldAutoRevise: false,
    revisionInstruction: "接入 API 后，根据所有必须修改项重写完整剧本。",
  }, "本地规则");
}

function makeLocalTaskId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildCineForgeProjectName(mode, sourceText) {
  const prefix = NOVEL_TASK_MODES[mode] || "小说转剧本";
  const firstLine = String(sourceText || "").split(/\r?\n/).find((line) => line.trim())?.trim() || "草稿";
  return `${prefix} - ${firstLine.slice(0, 18)}`;
}

function labelNovelStage(stage) {
  const labels = {
    draft: "草稿",
    ready: "剧本就绪",
    reviewed_passed: "审稿通过",
    reviewed_failed: "需优化",
    assets_ready: "资产就绪",
    prompts_ready: "提示词就绪",
  };
  return labels[stage] || stage || "草稿";
}

function normalizePromptAssets(items, fallbackKind) {
  return (Array.isArray(items) ? items : []).map((item, index) => {
    const promptVariants = normalizeAssetPromptVariants(item.promptVariants || buildAssetPromptVariants(item));
    const evidenceSource = Array.isArray(item.evidenceSource)
      ? item.evidenceSource.filter(Boolean).map((entry) => String(entry).trim()).filter(Boolean)
      : String(item.evidenceSource || "").trim()
        ? [String(item.evidenceSource || "").trim()]
        : [];
    return {
      id: item.id || `${fallbackKind}-${index + 1}`,
      name: item.name || `${fallbackKind}${index + 1}`,
      kind: item.kind || fallbackKind,
      token: item.token || makeAssetToken(fallbackKind, item.name || `${fallbackKind}${index + 1}`),
      meta: item.meta || item.description || "",
      prompt: buildAssetPromptPackage(promptVariants) || item.prompt || item.aiPrompt || item.description || "",
      promptVariants,
      visualLock: item.visualLock || item.visualAnchor || "",
      continuityRule: item.continuityRule || item.stageChange || "",
      referenceResources: item.referenceResources || "",
      evidenceSource,
      cineForge: item,
    };
  }).filter((item) => item.prompt.trim());
}

function normalizeFactoryShots(items) {
  return (Array.isArray(items) ? items : []).map((shot, index) => ({
    id: shot.id || `S${String(index + 1).padStart(2, "0")}`,
    scene: shot.scene || shot.mount || "",
    characters: shot.characters || shot.character || "",
    action: shot.action || shot.picture || shot.openingFrame || shot.mainPrompt || "",
    camera: shot.camera || "",
    dialogue: shot.dialogue || shot.nailLines || "",
    sound: shot.sound || "",
    assetRefs: Array.isArray(shot.assetRefs) ? shot.assetRefs : [],
    shotSize: shot.shotSize || shot.size || "中景",
    duration: shot.duration || "4秒",
    imagePrompt: shot.imagePrompt || shot.mainPrompt || shot.reference || "",
    videoPrompt: shot.videoPrompt || [
      shot.openingFrame,
      shot.action,
      shot.closingFrame,
      shot.camera,
      shot.transition,
      shot.compulsoryDeclaration,
      shot.qualityBaseline,
    ].filter(Boolean).join("，"),
    status: shot.status || "待生成",
  }));
}

function stripJsonFence(text) {
  return String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function parseJsonObjectLoose(text) {
  const cleaned = stripJsonFence(text);
  try {
    return JSON.parse(cleaned);
  } catch (firstError) {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {}
    }
    throw firstError;
  }
}

async function testCustomApi(settings) {
  try {
    const result = await runCustomApiGeneration(settings, "一只在霓虹城市里看星星的白猫");
    alert(`测试成功：已获取图片\n${result.imageUrl.slice(0, 120)}...`);
  } catch (error) {
    alert(`测试失败：${formatCustomImageApiError(error)}`);
  }
}

async function testImageGeneration(settings, prompt = "一只在霓虹城市里看星星的白猫") {
  return runImageGeneration(settings, prompt);
}

async function testComfyConnection(settings) {
  const { testComfyConnection: testComfyConnectionImpl } = await loadBackendServiceHelpers();
  return testComfyConnectionImpl(settings);
}

async function runComfyGeneration(settings, prompt, kind = "image") {
  const { runComfyGeneration: runComfyGenerationImpl } = await loadBackendServiceHelpers();
  return runComfyGenerationImpl(settings, prompt, kind);
}

async function testComfyImage(settings) {
  try {
    const result = await runComfyGeneration(settings, "一张商业级国漫角色半身像，清晰五官，电影光影", "image");
    alert(`ComfyUI 生图成功：\n${(result.imageUrl || "").slice(0, 160)}`);
  } catch (error) {
    alert(`ComfyUI 生图失败：${error.message}`);
  }
}

async function testComfyVideo(settings) {
  try {
    const result = await runComfyGeneration(settings, "角色缓慢转身看向镜头，镜头轻微推进，4秒，动作连续，画面稳定", "video");
    alert(`ComfyUI 视频成功：\n${(result.videoUrl || result.imageUrl || "").slice(0, 160)}`);
  } catch (error) {
    alert(`ComfyUI 视频失败：${error.message}`);
  }
}

function readTextFile(event, done) {
  const file = event.target.files?.[0];
  if (!file) return;
  const input = event.target;
  const reader = new FileReader();
  reader.onload = () => {
    done(String(reader.result || ""));
    input.value = "";
  };
  reader.onerror = () => {
    alert("文件读取失败");
    input.value = "";
  };
  reader.readAsText(file, "utf-8");
}

function readImage(event, done, maxDimension = 2048) {
  const file = event.target.files?.[0];
  if (!file) return;
  const input = event.target;
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    try {
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
      const width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
      const height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: false });
      context.fillStyle = "#050505";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      Promise.resolve(done(canvas.toDataURL("image/jpeg", 0.9), { fileName: file.name, file }))
        .catch((error) => console.warn("Image handler failed", error));
    } catch (error) {
      console.warn("Image compression failed, using original file", error);
      readImageAsDataUrl(file, done);
    } finally {
      URL.revokeObjectURL(objectUrl);
      input.value = "";
    }
  };
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    readImageAsDataUrl(file, done);
    input.value = "";
  };
  image.src = objectUrl;
}

function readImageAsDataUrl(file, done) {
  const reader = new FileReader();
  reader.onload = () => {
    Promise.resolve(done(reader.result, { fileName: file.name, file }))
      .catch((error) => console.warn("Image handler failed", error));
  };
  reader.readAsDataURL(file);
}

async function persistImportedMediaAsset({ mediaUrl = "", mediaPath = "", mediaFile = null, mediaType = "image", fileName = "" }) {
  const { persistMediaAssetReference } = await loadBackendServiceHelpers();
  let sourceUrl = String(mediaUrl || "").trim();
  let sourcePath = String(mediaPath || "").trim();
  if (!sourceUrl && !sourcePath && mediaFile) {
    sourcePath = resolveUploadFilePath(mediaFile);
    sourceUrl = sourcePath || await readFileAsDataUrlFallback(mediaFile, `${mediaType === "video" ? "视频" : "媒体"}读取失败`);
  }
  return persistMediaAssetReference({
    mediaUrl: sourceUrl,
    mediaPath: sourcePath,
    mediaType,
    fileName: fileName || "imported-media",
  });
}

async function persistImportedImage({ imageUrl = "", imagePath = "", fileName = "" }) {
  const persisted = await persistImportedMediaAsset({
    mediaUrl: imageUrl,
    mediaPath: imagePath,
    mediaType: "image",
    fileName: fileName || "imported-image",
  });
  return {
    imageUrl: persisted.mediaUrl,
    imagePath: persisted.mediaPath,
    originalImageUrl: persisted.originalMediaUrl || String(imageUrl || "").trim(),
    imageThumbnailUrl: persisted.thumbnailUrl,
    imageThumbnailPath: persisted.thumbnailPath,
  };
}

async function migrateLoadedProjectMedia(project, source = "project") {
  return migrateProjectEmbeddedImages(project, {
    enabled: isTauriRuntime(),
    persistImage: persistImportedImage,
    fileNamePrefix: `project-migration-${safeFileName(source || "project")}`,
  });
}

async function readClipboardImageAsDataUrl() {
  if (!navigator.clipboard?.read) {
    throw new Error("当前环境不支持直接读取剪贴板图片，请下载 Gemini 图片后上传。");
  }
  const items = await navigator.clipboard.read();
  for (const item of items) {
    const imageType = item.types.find((type) => type.startsWith("image/"));
    if (!imageType) continue;
    const blob = await item.getType(imageType);
    return blobToDataUrl(blob);
  }
  throw new Error("剪贴板里没有图片。请先在 Gemini 结果上复制图片。");
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(blob);
  });
}

function isNodeVisibleInEpisode(node, activeEpisodeId, episodes) {
  const fallback = episodes[0]?.id || "episode-1";
  return (node.data?.episodeId || fallback) === activeEpisodeId;
}

function buildProjectSummary(nodes, edges, episodes, activeEpisodeId, generationQueue, resources = [], timeline = defaultTimelineState(), collaborationState = defaultCollaborationState(), archiveState = defaultArchiveState(), exportHistory = []) {
  const fallback = episodes[0]?.id || "episode-1";
  const resourceIndex = buildProjectResourceIndex(resources, nodes, episodes, activeEpisodeId, { nodeTypeLabel });
  const assetIndex = collectGlobalAssets(nodes);
  const timelineState = normalizeTimelineState(timeline, activeEpisodeId);
  const collab = normalizeCollaborationState(collaborationState);
  const archive = normalizeArchiveState(archiveState);
  const milestones = new Set(archive.milestoneIds || []);
  const normalizedExportHistory = normalizeExportHistoryState(exportHistory);
  const episodeSummaries = episodes.map((episode) => {
    const episodeNodes = nodes.filter((node) => (node.data?.episodeId || fallback) === episode.id);
    const nodeIds = new Set(episodeNodes.map((node) => node.id));
    const episodeEdges = edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));
    const novelNodes = episodeNodes.filter((node) => node.type === "novelPipeline");
    const assetNodes = episodeNodes.filter((node) => node.type === "assetLibrary");
    const shotNodes = episodeNodes.filter((node) => node.type === "shotList");
    const characters = assetNodes.reduce((sum, node) => sum + (node.data.characters?.length || 0), 0);
    const scenes = assetNodes.reduce((sum, node) => sum + (node.data.scenes?.length || 0), 0);
    const props = assetNodes.reduce((sum, node) => sum + (node.data.props?.length || 0), 0);
    const shots = shotNodes.flatMap((node) => node.data.shots || []);
    const completedShots = shots.filter((shot) => /完成|已生成|采用|done/i.test(shot.status || "")).length;
    const pendingReview = shots.filter((shot) => !["已通过", "搁置"].includes(shot.reviewStatus || "未审")).length;
    const promptReady = shots.filter((shot) => String(shot.imagePrompt || "").trim() && String(shot.videoPrompt || "").trim()).length;
    const imagesReady = shots.filter((shot) => String(shot.imageResultUrl || "").trim() || ["待生视频", "已生成", "已确认", "完成"].includes(shot.status || "")).length;
    const videosReady = shots.filter((shot) => String(shot.videoResultUrl || "").trim() || ["已生成", "已确认", "完成"].includes(shot.status || "")).length;
    const autoFixPending = shots.filter((shot) => {
      const report = shot?.autoRevisionReport && typeof shot.autoRevisionReport === "object" ? shot.autoRevisionReport : null;
      return !["已通过", "搁置"].includes(shot.reviewStatus || "未审")
        && Array.isArray(report?.fixedIssues)
        && report.fixedIssues.length > 0;
    }).length;
    const refreshPlanPending = shots.filter((shot) => Array.isArray(shot?.autoRevisionReport?.assetRefreshPlan) && shot.autoRevisionReport.assetRefreshPlan.length > 0).length;
    const episodeResources = resources.filter((resource) => !resource.episodeId || resource.episodeId === episode.id);
    const weakAssets = assetIndex.items.filter((asset) => (asset.sourceId && nodeIds.has(asset.sourceId)) && asset.missingFields?.length);
    const issues = buildEpisodeIssues(episodeNodes, shots, characters, scenes, episodeResources, resourceIndex.missingRefs.filter((item) => item.episodeId === episode.id || !item.episodeId), weakAssets);
    const snapshotCount = (archive.snapshots || []).filter((item) => !item.episodeId || item.episodeId === episode.id).length;
    const milestoneCount = (archive.snapshots || []).filter((item) => (!item.episodeId || item.episodeId === episode.id) && milestones.has(item.id)).length;
    const failedExports = normalizedExportHistory.filter((item) => item.status === "failed" && (!item.episodeId || item.episodeId === episode.id)).length;
    const episodeTimeline = timelineState.byEpisode[episode.id] || defaultEpisodeTimeline();
    const normalizedShotEntries = shotNodes.flatMap((node) => (node.data.shots || []).map((shot, index) => ({
      sourceNodeId: node.id,
      shot: normalizeShotRecord(shot, index),
    })));
    const timelineReady = (episodeTimeline.clips || []).filter((clip) => String(clip.mediaUrl || "").trim()).length;
    const reviewPassed = shots.filter((shot) => ["已通过", "搁置"].includes(shot.reviewStatus || "未审")).length;
    const timelineBackfillPending = (episodeTimeline.clips || []).reduce((sum, clip) => {
      const linked = normalizedShotEntries.find((entry) => (
        entry.shot.id === clip.shotId
        && (!clip.sourceNodeId || clip.sourceNodeId === entry.sourceNodeId)
      )) || normalizedShotEntries.find((entry) => entry.shot.id === clip.shotId) || null;
      if (!linked?.shot) return sum;
      return sum + (computeTimelineBackfillDiff(clip, linked.shot).needsBackfill ? 1 : 0);
    }, 0);
    const shotStageBoard = {
      draft: shots.filter((shot) => (shot.status || "待写") === "待写").length,
      pendingImage: shots.filter((shot) => (shot.status || "") === "待生图").length,
      pendingVideo: shots.filter((shot) => (shot.status || "") === "待生视频").length,
      pendingFix: shots.filter((shot) => (shot.status || "") === "待修改").length,
      generated: shots.filter((shot) => (shot.status || "") === "已生成").length,
      confirmed: shots.filter((shot) => (shot.status || "") === "已确认").length,
      completed: shots.filter((shot) => (shot.status || "") === "完成").length,
    };
    const timelineStageBoard = {
      missingMedia: (episodeTimeline.clips || []).filter((clip) => !String(clip.mediaUrl || "").trim()).length,
      pendingApproval: (episodeTimeline.clips || []).filter((clip) => String(clip.approvalStatus || "待验收") === "待验收").length,
      rejected: (episodeTimeline.clips || []).filter((clip) => String(clip.approvalStatus || "") === "退回修改").length,
      approved: (episodeTimeline.clips || []).filter((clip) => String(clip.approvalStatus || "") === "已通过").length,
    };
    const exportReady = Boolean(episodeTimeline.clips?.length)
      && timelineReady === (episodeTimeline.clips || []).length
      && reviewPassed === shots.length
      && promptReady === shots.length
      && shots.length > 0;
    const keyNodes = episodeNodes
      .filter((node) => ["novelPipeline", "assetLibrary", "shotList", "result"].includes(node.type))
      .slice(0, 12)
      .map((node) => ({ id: node.id, kind: nodeTypeLabel(node.type), title: node.data.displayName || nodeTypeLabel(node.type) }));
    return {
      ...episode,
      nodes: episodeNodes.length,
      edges: episodeEdges.length,
      scripts: novelNodes.length,
      shotLists: shotNodes.length,
      results: episodeNodes.filter((node) => node.type === "result").length,
      resources: episodeResources.length,
      timelineClips: episodeTimeline.clips?.length || 0,
      timelineReady,
      characters,
      scenes,
      props,
      shots: shots.length,
      completedShots,
      imagesReady,
      videosReady,
      pendingReview,
      promptReady,
      autoFixPending,
      refreshPlanPending,
      timelineBackfillPending,
      reviewPassed,
      shotStageBoard,
      timelineStageBoard,
      exportReady,
      snapshots: snapshotCount,
      milestones: milestoneCount,
      failedExports,
      novelNodeId: novelNodes[0]?.id || "",
      assetNodeId: assetNodes[0]?.id || "",
      shotNodeId: shotNodes[0]?.id || "",
      issues,
      keyNodes,
    };
  });
  const queue = summarizeQueue(generationQueue);
  const totals = summarizeEpisodeTotals(episodeSummaries);
  return {
    episodes: episodeSummaries,
    activeEpisode: episodeSummaries.find((episode) => episode.id === activeEpisodeId) || episodeSummaries[0],
    active: episodeSummaries.find((episode) => episode.id === activeEpisodeId) || episodeSummaries[0] || {},
    totals,
    queue,
    collaboration: {
      members: (collab.members || []).length,
      activities: (collab.activities || []).length,
      latestActor: collab.activities?.[0]?.actor || collab.activeMemberName || "",
    },
    archive: {
      snapshots: (archive.snapshots || []).length,
      milestones: (archive.snapshots || []).filter((item) => milestones.has(item.id)).length,
      deliveryNote: Boolean(String(archive.deliveryNote || "").trim()),
    },
  };
}

function buildProjectHealthReport(nodes, edges, episodes, activeEpisodeId, generationQueue, resources = [], timeline = defaultTimelineState()) {
  const fallback = episodes[0]?.id || "episode-1";
  const assetIndex = collectGlobalAssets(nodes);
  const resourceIndex = buildProjectResourceIndex(resources, nodes, episodes, activeEpisodeId, { nodeTypeLabel });
  const timelineState = normalizeTimelineState(timeline, activeEpisodeId);
  const findings = [];

  episodes.forEach((episode) => {
    const episodeNodes = nodes.filter((node) => (node.data?.episodeId || fallback) === episode.id);
    const nodeIds = new Set(episodeNodes.map((node) => node.id));
    const shotNodes = episodeNodes.filter((node) => node.type === "shotList");
    const shots = shotNodes.flatMap((node) => (node.data.shots || []).map((shot, index) => ({ ...normalizeShotRecord(shot, index), sourceNodeId: node.id })));
    const episodeTimeline = timelineState.byEpisode[episode.id] || defaultEpisodeTimeline();
    const episodeAssets = assetIndex.items.filter((asset) => nodeIds.has(asset.sourceId));
    const episodeResources = resources.filter((resource) => !resource.episodeId || resource.episodeId === episode.id);

    if (!episodeAssets.filter((asset) => asset.category === "角色").length) {
      findings.push(makeFixableHealthFinding("严重", "资产", "缺少角色资产", episode, shotNodes[0]?.id || episodeNodes[0]?.id, "当前集至少需要一个可稳定引用的角色资产。", { kind: "episode_character_assets", episodeId: episode.id }));
    }
    if (!episodeAssets.filter((asset) => asset.category === "场景").length) {
      findings.push(makeFixableHealthFinding("严重", "资产", "缺少场景资产", episode, shotNodes[0]?.id || episodeNodes[0]?.id, "镜头无法稳定绑定空间时，连续性很容易漂。", { kind: "episode_scene_assets", episodeId: episode.id }));
    }
    episodeAssets.filter((asset) => asset.missingFields?.length).forEach((asset) => {
      findings.push(makeFixableHealthFinding("警告", "资产", `${asset.name} 锁定不完整`, episode, asset.sourceId, asset.missingFields.join("、"), {
        kind: "asset_lock_fields",
        sourceNodeId: asset.sourceId,
        assetToken: asset.token,
        category: asset.category,
        episodeId: episode.id,
      }));
    });
    episodeAssets.filter((asset) => !asset.referenceCount).forEach((asset) => {
      findings.push(makeHealthFinding("建议", "资产", `${asset.name} 还未被镜头引用`, episode, asset.sourceId, "建议把核心角色、场景、道具绑定到镜头表里。"));
    });
    shots.forEach((shot) => {
      const imageRefs = analyzePromptReferences(shot.imagePrompt || "", assetIndex);
      const videoRefs = analyzePromptReferences(shot.videoPrompt || "", assetIndex);
      const quality = buildShotQualityReport(shot);
      const bindingSuggestion = suggestShotAssetBindingPatch(shot, assetIndex);
      if (!String(shot.imagePrompt || "").trim()) findings.push(makeFixableHealthFinding("严重", "镜头", `${shot.id} 缺少图片提示词`, episode, shot.sourceNodeId, "当前镜头无法进入图像生成。", { kind: "shot_image_prompt", shotId: shot.id, sourceNodeId: shot.sourceNodeId }));
      if (!String(shot.videoPrompt || "").trim()) findings.push(makeFixableHealthFinding("严重", "镜头", `${shot.id} 缺少视频提示词`, episode, shot.sourceNodeId, "当前镜头无法进入视频生成。", { kind: "shot_video_prompt", shotId: shot.id, sourceNodeId: shot.sourceNodeId }));
      if ((shot.imagePrompt || "").trim().length > 0 && (shot.imagePrompt || "").trim().length < 24) findings.push(makeFixableHealthFinding("警告", "镜头", `${shot.id} 图片提示词过短`, episode, shot.sourceNodeId, "建议补充资产引用、景别、主焦点和环境信息。", { kind: "shot_image_prompt", shotId: shot.id, sourceNodeId: shot.sourceNodeId }));
      if ((shot.videoPrompt || "").trim().length > 0 && (shot.videoPrompt || "").trim().length < 24) findings.push(makeFixableHealthFinding("警告", "镜头", `${shot.id} 视频提示词过短`, episode, shot.sourceNodeId, "建议补充动作过程、镜头运动和结束状态。", { kind: "shot_video_prompt", shotId: shot.id, sourceNodeId: shot.sourceNodeId }));
      if (!imageRefs.tokens.length && !videoRefs.tokens.length) findings.push(makeFixableHealthFinding("警告", "镜头", `${shot.id} 未绑定资产引用`, episode, shot.sourceNodeId, "建议至少绑定角色或场景资产，避免镜头漂移。", { kind: "shot_asset_refs", shotId: shot.id, sourceNodeId: shot.sourceNodeId }));
      if (imageRefs.missing.length || videoRefs.missing.length) findings.push(makeHealthFinding("严重", "镜头", `${shot.id} 存在失效资产引用`, episode, shot.sourceNodeId, [...imageRefs.missing, ...videoRefs.missing].join("、")));
      if (!String(shot.mainCharacterToken || "").trim() && bindingSuggestion.mainCharacterToken) findings.push(makeFixableHealthFinding("建议", "镜头", `${shot.id} 可自动补主角色绑定`, episode, shot.sourceNodeId, bindingSuggestion.mainCharacterToken, { kind: "shot_binding_patch", shotId: shot.id, sourceNodeId: shot.sourceNodeId, episodeId: episode.id }));
      if (!String(shot.mainSceneToken || "").trim() && bindingSuggestion.mainSceneToken) findings.push(makeFixableHealthFinding("建议", "镜头", `${shot.id} 可自动补主场景绑定`, episode, shot.sourceNodeId, bindingSuggestion.mainSceneToken, { kind: "shot_binding_patch", shotId: shot.id, sourceNodeId: shot.sourceNodeId, episodeId: episode.id }));
      if (!(shot.keyPropTokens || []).length && (bindingSuggestion.keyPropTokens || []).length) findings.push(makeFixableHealthFinding("建议", "镜头", `${shot.id} 可自动补关键道具绑定`, episode, shot.sourceNodeId, bindingSuggestion.keyPropTokens.join("、"), { kind: "shot_binding_patch", shotId: shot.id, sourceNodeId: shot.sourceNodeId, episodeId: episode.id }));
      const mainCharacterAsset = shot.mainCharacterToken ? assetIndex.byToken.get(shot.mainCharacterToken) : null;
      const mainSceneAsset = shot.mainSceneToken ? assetIndex.byToken.get(shot.mainSceneToken) : null;
      if (shot.mainCharacterToken && !mainCharacterAsset) {
        findings.push(makeFixableHealthFinding("严重", "资产", `${shot.id} 主角色绑定资产缺失`, episode, shot.sourceNodeId, shot.mainCharacterToken, {
          kind: "shot_bound_asset",
          shotId: shot.id,
          sourceNodeId: shot.sourceNodeId,
          assetToken: shot.mainCharacterToken,
          category: "角色",
          episodeId: episode.id,
        }));
      } else if (mainCharacterAsset?.missingFields?.length) {
        findings.push(makeFixableHealthFinding("警告", "资产", `${shot.id} 主角色资产锁定不完整`, episode, mainCharacterAsset.sourceId || shot.sourceNodeId, mainCharacterAsset.missingFields.join("、"), {
          kind: "asset_lock_fields",
          sourceNodeId: mainCharacterAsset.sourceId || shot.sourceNodeId,
          assetToken: mainCharacterAsset.token,
          category: "角色",
          episodeId: episode.id,
        }));
      }
      if (shot.mainSceneToken && !mainSceneAsset) {
        findings.push(makeFixableHealthFinding("严重", "资产", `${shot.id} 主场景绑定资产缺失`, episode, shot.sourceNodeId, shot.mainSceneToken, {
          kind: "shot_bound_asset",
          shotId: shot.id,
          sourceNodeId: shot.sourceNodeId,
          assetToken: shot.mainSceneToken,
          category: "场景",
          episodeId: episode.id,
        }));
      } else if (mainSceneAsset?.missingFields?.length) {
        findings.push(makeFixableHealthFinding("警告", "资产", `${shot.id} 主场景资产锁定不完整`, episode, mainSceneAsset.sourceId || shot.sourceNodeId, mainSceneAsset.missingFields.join("、"), {
          kind: "asset_lock_fields",
          sourceNodeId: mainSceneAsset.sourceId || shot.sourceNodeId,
          assetToken: mainSceneAsset.token,
          category: "场景",
          episodeId: episode.id,
        }));
      }
      (shot.keyPropTokens || []).forEach((token) => {
        const propAsset = assetIndex.byToken.get(token);
        if (!propAsset) {
          findings.push(makeFixableHealthFinding("警告", "资产", `${shot.id} 关键道具绑定资产缺失`, episode, shot.sourceNodeId, token, {
            kind: "shot_bound_asset",
            shotId: shot.id,
            sourceNodeId: shot.sourceNodeId,
            assetToken: token,
            category: "道具",
            episodeId: episode.id,
          }));
          return;
        }
        if (propAsset.missingFields?.length) {
          findings.push(makeFixableHealthFinding("警告", "资产", `${shot.id} 关键道具资产锁定不完整`, episode, propAsset.sourceId || shot.sourceNodeId, `${token}：${propAsset.missingFields.join("、")}`, {
            kind: "asset_lock_fields",
            sourceNodeId: propAsset.sourceId || shot.sourceNodeId,
            assetToken: propAsset.token,
            category: "道具",
            episodeId: episode.id,
          }));
        }
      });
      if (!String(shot.referenceResources || "").trim()) findings.push(makeFixableHealthFinding("建议", "镜头", `${shot.id} 未绑定参考资源`, episode, shot.sourceNodeId, "关键镜头建议绑定定妆图、场景参考或风格资源。", { kind: "shot_reference_resources", shotId: shot.id, sourceNodeId: shot.sourceNodeId }));
      if (quality.score < 72) findings.push(makeHealthFinding(quality.score < 55 ? "严重" : "警告", "镜头", `${shot.id} 质量分偏低（${quality.score}）`, episode, shot.sourceNodeId, quality.summary));
      if (!["已通过", "搁置"].includes(shot.reviewStatus || "未审")) findings.push(makeHealthFinding("建议", "镜头", `${shot.id} 尚未通过审稿`, episode, shot.sourceNodeId, `当前状态：${shot.reviewStatus || "未审"}`));
    });
    for (let index = 1; index < shots.length; index += 1) {
      const previous = shots[index - 1];
      const current = shots[index];
      if (previous.status === "完成" && ["待写", "待生图"].includes(current.status)) {
        findings.push(makeHealthFinding("警告", "镜头", `${previous.id} 到 ${current.id} 状态衔接异常`, episode, current.sourceNodeId, "前一镜已完成，但后一镜仍处在较早阶段。"));
      }
    }
    if (!episodeTimeline.clips.length && shots.length) {
      findings.push(makeFixableHealthFinding("警告", "时间线", "镜头已具备但尚未进入时间线", episode, shotNodes[0]?.id, "建议把当前集镜头导入时间线，开始整理成片结构。", { kind: "episode_timeline_import", episodeId: episode.id }));
    }
    episodeTimeline.clips.forEach((clip) => {
      if (!clip.mediaUrl) findings.push(makeHealthFinding("警告", "时间线", `${clip.title} 还未挂素材`, episode, clip.sourceNodeId || "", "建议先完成图片或视频生成，再回填到时间线。"));
    });
    const unresolvedForExport = shots.filter((shot) => {
      const quality = buildShotQualityReport(shot);
      return quality.score < 72 || !["已通过", "搁置"].includes(shot.reviewStatus || "未审");
    }).length;
    if (episodeTimeline.clips.length && unresolvedForExport) {
      findings.push(makeHealthFinding("警告", "导出", `当前集仍有 ${unresolvedForExport} 个镜头未达到交付门槛`, episode, shotNodes[0]?.id || "", "建议先在镜头表处理质量分和审稿状态，再进入导出。"));
    }
    if (!episodeResources.length) findings.push(makeHealthFinding("建议", "资源", "当前集还没有项目资源", episode, episodeNodes[0]?.id || "", "建议至少导入参考图、配乐或脚本文档。"));
  });

  const duplicateCharacterNames = findDuplicateCharacterNames(assetIndex.characters);
  duplicateCharacterNames.forEach((group) => {
    findings.push(makeHealthFinding("警告", "资产", `角色命名可能重复：${group.join(" / ")}`, null, assetIndex.byToken.get(makeAssetToken("角色", group[0]))?.sourceId || "", "建议统一角色命名，减少引用歧义。"));
  });
  resourceIndex.missingRefs.forEach((item) => {
    findings.push({
      level: "严重",
      category: "资源",
      text: `缺失资源引用 ${item.token}`,
      detail: `${item.nodeTitle} · ${item.path}`,
      nodeId: item.nodeId,
      episodeId: item.episodeId || "",
      episodeName: episodes.find((episode) => episode.id === item.episodeId)?.name || "全项目",
    });
  });
  generationQueue.filter((job) => job.status === "failed").forEach((job) => {
    findings.push(makeHealthFinding("警告", "队列", `${job.title || "生成任务"} 失败`, episodes.find((episode) => episode.id === activeEpisodeId) || null, job.sourceNodeId || "", job.error || "请检查 API、提示词或网络连接。"));
  });

  const critical = findings.filter((item) => item.level === "严重").length;
  const warning = findings.filter((item) => item.level === "警告").length;
  const info = findings.filter((item) => item.level === "建议").length;
  const totalFindings = findings.length;
  const coverage = `${Math.max(0, 100 - critical * 8 - warning * 4 - info * 2)}%`;
  return {
    findings,
    summary: { critical, warning, info, totalFindings, coverage },
  };
}

function buildDirectorAssistantReport(nodes, episodes, activeEpisodeId, assetIndex, resourceIndex, timeline = defaultTimelineState()) {
  const fallback = episodes[0]?.id || "episode-1";
  const episode = episodes.find((item) => item.id === activeEpisodeId) || episodes[0] || { id: activeEpisodeId, name: "当前集" };
  const shotNodes = nodes.filter((node) => node.type === "shotList" && (node.data?.episodeId || fallback) === activeEpisodeId);
  const shots = shotNodes.flatMap((node) => (node.data.shots || []).map((shot, index) => ({ ...normalizeShotRecord(shot, index), nodeId: node.id })));
  const episodeTimeline = normalizeTimelineState(timeline, activeEpisodeId).byEpisode[activeEpisodeId] || defaultEpisodeTimeline();
  const timelineShotIds = new Set((episodeTimeline.clips || []).map((clip) => clip.shotId));
  const weakShots = [];
  const suggestions = [];

  shots.forEach((shot) => {
    const imageRefs = analyzePromptReferences(shot.imagePrompt || "", assetIndex);
    const videoRefs = analyzePromptReferences(shot.videoPrompt || "", assetIndex);
    const quality = buildShotQualityReport(shot);
    const weaknesses = [];
    if (!String(shot.imagePrompt || "").trim()) weaknesses.push("缺少图片提示词");
    if (!String(shot.videoPrompt || "").trim()) weaknesses.push("缺少视频提示词");
    if (!String(shot.action || "").trim()) weaknesses.push("缺少动作描述");
    if (!String(shot.cameraMove || "").trim()) weaknesses.push("缺少镜头运动");
    if (!imageRefs.tokens.length && !videoRefs.tokens.length) weaknesses.push("没有资产引用");
    if (!String(shot.referenceResources || "").trim()) weaknesses.push("没有参考资源");
    if (quality.score < 72) weaknesses.push(`质量分仅 ${quality.score} 分`);
    if (weaknesses.length) {
      weakShots.push({
        shotId: shot.id,
        nodeId: shot.nodeId,
        scene: shot.scene,
        level: quality.score < 55 || weaknesses.length >= 4 ? "严重" : "警告",
        text: `${shot.id} 仍不够可拍`,
        detail: weaknesses.join("、"),
      });
    }

    if (!String(shot.imagePrompt || "").trim()) {
      const prompt = buildDirectorImageSuggestion(shot, assetIndex);
      suggestions.push({
        kindLabel: "图片补全",
        title: "补图片提示词",
        shotId: shot.id,
        nodeId: shot.nodeId,
        field: "imagePrompt",
        value: prompt,
        summary: `${shot.id} 需要更稳定的图片提示词`,
        detail: "我按当前镜头信息补了一版可直接继续修改的图片提示词。",
        preview: prompt.slice(0, 120),
      });
    }
    if (!String(shot.videoPrompt || "").trim()) {
      const prompt = buildDirectorVideoSuggestion(shot, assetIndex);
      suggestions.push({
        kindLabel: "视频补全",
        title: "补视频提示词",
        shotId: shot.id,
        nodeId: shot.nodeId,
        field: "videoPrompt",
        value: prompt,
        summary: `${shot.id} 需要更完整的视频提示词`,
        detail: "我补上了开场状态、动作过程、镜头运动和结束点。",
        preview: prompt.slice(0, 120),
      });
    }
    if (!String(shot.cameraMove || "").trim()) {
      suggestions.push({
        kindLabel: "运镜建议",
        title: "补镜头运动",
        shotId: shot.id,
        nodeId: shot.nodeId,
        patch: { cameraMove: suggestCameraMove(shot) },
        summary: `${shot.id} 建议补一个明确运镜`,
        detail: "镜头运动缺失时，视频生成会更容易发散。",
        preview: suggestCameraMove(shot),
      });
    }
    if (!String(shot.action || "").trim()) {
      suggestions.push({
        kindLabel: "动作建议",
        title: "补动作描述",
        shotId: shot.id,
        nodeId: shot.nodeId,
        patch: { action: suggestShotAction(shot) },
        summary: `${shot.id} 建议补动作锚点`,
        detail: "镜头动作写清楚，后面图像和视频都更稳。",
        preview: suggestShotAction(shot),
      });
    }
    if (quality.score < 88) {
      suggestions.push({
        kindLabel: "质量修复",
        title: "补齐质量骨架",
        shotId: shot.id,
        nodeId: shot.nodeId,
        patch: quality.recommendedPatch,
        summary: `${shot.id} 建议补主焦点、开收画面和连续性`,
        detail: quality.summary,
        preview: `质量 ${quality.score} 分 · ${quality.summary}`,
      });
    }
  });

  const beats = [];
  if (shots.length >= 3) {
    const emptyActionCount = shots.filter((shot) => !String(shot.action || "").trim()).length;
    if (emptyActionCount >= Math.ceil(shots.length * 0.4)) {
      beats.push({ level: "警告", kind: "动作节奏", text: "当前集很多镜头没有动作锚点", detail: `共 ${emptyActionCount} 个镜头缺动作，建议先补关键行为。` });
    }
    const missingTimeline = shots.filter((shot) => !timelineShotIds.has(shot.id)).length;
    if (missingTimeline >= Math.ceil(shots.length * 0.5)) {
      beats.push({ level: "建议", kind: "成片节奏", text: "大部分镜头还没有进入时间线", detail: `还有 ${missingTimeline} 个镜头没进时间线，建议先排出节奏骨架。` });
    }
    const lowAssetBinding = shots.filter((shot) => {
      const refs = analyzePromptReferences(`${shot.imagePrompt || ""} ${shot.videoPrompt || ""}`, assetIndex);
      return refs.tokens.length === 0;
    }).length;
    if (lowAssetBinding >= Math.ceil(shots.length * 0.4)) {
      beats.push({ level: "警告", kind: "一致性", text: "镜头资产绑定偏少", detail: `有 ${lowAssetBinding} 个镜头没绑资产，连续性风险会明显变高。` });
    }
  }

  return {
    episodeName: episode.name,
    weakShots,
    suggestions,
    beats,
    coverage: {
      totalShots: shots.length,
      healthyShots: Math.max(0, shots.length - weakShots.length),
      assetBoundShots: shots.filter((shot) => analyzePromptReferences(`${shot.imagePrompt || ""} ${shot.videoPrompt || ""}`, assetIndex).tokens.length > 0).length,
      timelineShots: shots.filter((shot) => timelineShotIds.has(shot.id)).length,
      averageShotScore: shots.length ? Math.round(shots.reduce((sum, shot) => sum + buildShotQualityReport(shot).score, 0) / shots.length) : 0,
    },
  };
}

function buildReviewBoardReport(nodes, episodes, activeEpisodeId) {
  const fallback = episodes[0]?.id || "episode-1";
  const episode = episodes.find((item) => item.id === activeEpisodeId) || episodes[0] || { name: "当前集" };
  const episodeNodes = nodes.filter((node) => (node.data?.episodeId || fallback) === activeEpisodeId);
  const targets = [];
  let nodeComments = 0;
  let shotComments = 0;
  let pendingFix = 0;
  let passed = 0;
  let unreviewed = 0;
  let reviewableShots = 0;
  let refreshPlans = 0;

  episodeNodes.forEach((node) => {
    const comments = Array.isArray(node.data?.reviewComments) ? node.data.reviewComments : [];
    nodeComments += comments.length;
    if (["novelPipeline", "assetLibrary", "shotList", "result"].includes(node.type)) {
      targets.push({
        id: `node:${node.id}`,
        nodeId: node.id,
        shotId: "",
        kindLabel: `${nodeTypeLabel(node.type)}节点`,
        title: node.data?.displayName || nodeTypeLabel(node.type),
        subtitle: searchNodeSubtitle(node) || "节点级评注",
        comments,
        commentCount: comments.length,
        reviewStatus: "",
      });
    }
    if (node.type === "shotList") {
      (node.data.shots || []).forEach((shot, index) => {
        const normalized = normalizeShotRecord(shot, index);
        const shotReviewComments = Array.isArray(normalized.reviewComments) ? normalized.reviewComments : [];
        shotComments += shotReviewComments.length;
        reviewableShots += 1;
        if (normalized.reviewStatus === "未审") unreviewed += 1;
        if (normalized.reviewStatus === "待修改") pendingFix += 1;
        if (normalized.reviewStatus === "已通过") passed += 1;
        if (normalized.autoRevisionReport?.assetRefreshPlan?.length) refreshPlans += 1;
        targets.push({
          id: `shot:${node.id}:${normalized.id}`,
          nodeId: node.id,
          shotId: normalized.id,
          kindLabel: "镜头审稿",
          title: normalized.id,
          subtitle: `${normalized.scene || "未填场景"} · ${normalized.status || "待写"}`,
          comments: shotReviewComments,
          commentCount: shotReviewComments.length,
          reviewStatus: normalized.reviewStatus || "未审",
          autoRevisionReport: normalized.autoRevisionReport || null,
        });
      });
    }
  });

  return {
    episodeName: episode.name || "当前集",
    targets,
    summary: {
      nodeComments,
      shotComments,
      pendingFix,
      unreviewed,
      passed,
      reviewableShots,
      refreshPlans,
    },
  };
}

function buildReviewCenterWorkflow(summary, activeEpisodeId) {
  const active = summary?.episodes?.find((episode) => episode.id === activeEpisodeId) || summary?.episodes?.[0] || null;
  if (!active) {
    return {
      canAdvance: false,
      headline: "当前还没有可审稿的内容",
      description: "先建立剧本和镜头表，审稿中心才会进入可执行状态。",
      currentActionLabel: "先去生成镜头表",
      currentActionKey: "prompt",
      nextActionLabel: "进入下一步",
      nextActionKey: "prompt",
    };
  }
  const pendingReview = Number(active.pendingReview || 0);
  const hasShots = Number(active.shots || 0) > 0;
  const canAdvance = hasShots && pendingReview === 0;
  const nextAction = !active.timelineClips
    ? {
      label: "进入下一步：排时间线",
      actionKey: "timeline",
      description: "审稿通过后，下一步就是把镜头导入时间线并开始补素材。",
    }
    : active.timelineReady < active.timelineClips
      ? {
        label: "进入下一步：补时间线素材",
        actionKey: "timeline",
        description: "时间线已存在，但素材还没挂齐，继续在时间线里推进。",
      }
      : {
        label: "进入下一步：视频导出",
        actionKey: "export",
        description: "当前集已经具备继续导出的条件，可以去导出横版或竖版视频。",
      };
  if (!hasShots) {
    return {
      canAdvance: false,
      headline: "当前集还没有镜头可审",
      description: "先生成镜头表和提示词，审稿中心才能开始工作。",
      currentActionLabel: "先去生成镜头表",
      currentActionKey: "prompt",
      nextActionLabel: nextAction.label,
      nextActionKey: nextAction.actionKey,
    };
  }
  if (!canAdvance) {
    return {
      canAdvance: false,
      headline: `当前还有 ${pendingReview} 个镜头没通过审稿`,
      description: "先让 API 审一遍，再把标成“待修改”的镜头定位去修。待审和待修改清零后，右侧按钮会自动放行下一步。",
      currentActionLabel: "去镜头表修镜头",
      currentActionKey: "prompt",
      nextActionLabel: nextAction.label,
      nextActionKey: nextAction.actionKey,
    };
  }
  return {
    canAdvance: true,
    headline: "审稿已清空阻塞，可以继续往下走",
    description: nextAction.description,
    currentActionLabel: "回看当前镜头",
    currentActionKey: "review",
    nextActionLabel: nextAction.label,
    nextActionKey: nextAction.actionKey,
  };
}

function buildCollaborationReport(nodes, episodes, activeEpisodeId, collaborationState) {
  const board = buildReviewBoardReport(nodes, episodes, activeEpisodeId);
  const state = normalizeCollaborationState(collaborationState);
  return {
    episodeName: board.episodeName,
    activities: state.activities || [],
    summary: {
      members: (state.members || []).length,
      activities: (state.activities || []).length,
      pendingFix: board.summary.pendingFix,
      latestActor: state.activities?.[0]?.actor || state.activeMemberName || "",
    },
  };
}

function buildProductionHubReport(nodes, episodes, activeEpisodeId, resources, timeline, generationQueue, exportHistory = []) {
  const fallback = episodes[0]?.id || "episode-1";
  const episode = episodes.find((item) => item.id === activeEpisodeId) || episodes[0] || { id: activeEpisodeId, name: "当前集" };
  const episodeNodes = nodes.filter((node) => (node.data?.episodeId || fallback) === activeEpisodeId);
  const novelNode = episodeNodes.find((node) => node.type === "novelPipeline");
  const assetNode = episodeNodes.find((node) => node.type === "assetLibrary");
  const shotNode = episodeNodes.find((node) => node.type === "shotList");
  const timelineState = normalizeTimelineState(timeline, activeEpisodeId).byEpisode[activeEpisodeId] || defaultEpisodeTimeline();
  const shots = episodeNodes
    .filter((node) => node.type === "shotList")
    .flatMap((node) => (node.data.shots || []).map((shot, index) => ({ ...normalizeShotRecord(shot, index), nodeId: node.id })));
  const assets = collectGlobalAssets(episodeNodes).items;
  const resourcesCount = resources.filter((resource) => !resource.episodeId || resource.episodeId === activeEpisodeId).length;
  const generated = shots.filter((shot) => /完成|已生成|已确认/i.test(shot.status || "")).length;
  const withPrompt = shots.filter((shot) => String(shot.imagePrompt || "").trim() && String(shot.videoPrompt || "").trim()).length;
  const timelineReady = timelineState.clips.filter((clip) => clip.mediaUrl).length;
  const averageShotScore = shots.length ? Math.round(shots.reduce((sum, shot) => sum + buildShotQualityReport(shot).score, 0) / shots.length) : 0;
  const approvedShots = shots.filter((shot) => ["已通过", "搁置"].includes(shot.reviewStatus || "未审")).length;
  const weakShots = shots
    .map((shot) => ({ shot, report: buildShotQualityReport(shot) }))
    .filter((item) => item.report.score < 72)
    .sort((a, b) => a.report.score - b.report.score);
  const unreviewedShots = shots.filter((shot) => !["已通过", "搁置"].includes(shot.reviewStatus || "未审"));
  const failedExports = normalizeExportHistoryState(exportHistory).filter((item) => item.status === "failed" && (!item.episodeId || item.episodeId === activeEpisodeId));
  const exportReady = timelineState.clips.length && timelineReady === timelineState.clips.length && approvedShots === shots.length && averageShotScore >= 72;
  const totalChecks = 6;
  let passedChecks = 0;
  if (novelNode) passedChecks += 1;
  if (assets.length) passedChecks += 1;
  if (shots.length) passedChecks += 1;
  if (withPrompt === shots.length && shots.length) passedChecks += 1;
  if (timelineState.clips.length > 0) passedChecks += 1;
  if (exportReady) passedChecks += 1;
  const coverage = Math.round((passedChecks / totalChecks) * 100);

  const stages = [
    {
      key: "script",
      label: novelNode ? "就绪" : "缺失",
      level: novelNode ? "建议" : "严重",
      status: novelNode ? "ready" : "missing",
      title: "剧本生产",
      metric: novelNode ? "已建立" : "未建立",
      detail: novelNode ? "当前集已经有小说工厂节点，可以继续向资产和镜头推进。" : "当前集还没有小说工厂节点，生产链还没起步。",
      actionKey: "dashboard",
      nodeId: novelNode?.id || "",
    },
    {
      key: "asset",
      label: assets.length ? "就绪" : "缺失",
      level: assets.length ? "建议" : "严重",
      status: assets.length ? "ready" : "missing",
      title: "资产层",
      metric: `${assets.length} 个`,
      detail: assets.length ? "角色、场景、道具已经进入资产层。" : "还没有形成稳定资产，后续镜头容易漂移。",
      actionKey: "resources",
      nodeId: assetNode?.id || "",
    },
    {
      key: "shot",
      label: shots.length ? "进行中" : "缺失",
      level: shots.length ? "警告" : "严重",
      status: shots.length ? "progress" : "missing",
      title: "镜头层",
      metric: `${shots.length} 镜头`,
      detail: shots.length ? `其中 ${withPrompt} 个镜头图片/视频提示词已成对齐，平均质量 ${averageShotScore} 分，审稿通过 ${approvedShots}/${shots.length}。` : "还没有镜头表，没法进入批量生产。",
      actionKey: "prompt",
      nodeId: shotNode?.id || "",
    },
    {
      key: "resource",
      label: resourcesCount ? "就绪" : "偏弱",
      level: resourcesCount ? "建议" : "警告",
      status: resourcesCount ? "ready" : "weak",
      title: "资源参考",
      metric: `${resourcesCount} 个`,
      detail: resourcesCount ? "项目资源已经进场，可继续做参考绑定。" : "参考资源偏少，角色和场景锁定会吃亏。",
      actionKey: "resources",
      nodeId: "",
    },
    {
      key: "timeline",
      label: timelineState.clips.length ? "进行中" : "缺失",
      level: timelineState.clips.length ? "建议" : "警告",
      status: timelineState.clips.length ? "progress" : "missing",
      title: "时间线",
      metric: `${timelineState.clips.length} 片段`,
      detail: timelineState.clips.length ? `其中 ${timelineReady} 个片段已挂素材。` : "还没有把镜头带入时间线。",
      actionKey: "timeline",
      nodeId: "",
    },
    {
      key: "export",
      label: exportReady ? "可导出" : "待补",
      level: exportReady ? "建议" : "警告",
      status: exportReady ? "ready" : "weak",
      title: "发布导出",
      metric: exportReady ? "已具备" : "未完成",
      detail: exportReady ? "当前集已经可以走成片导出和发布准备。" : "需要同时满足素材齐备、镜头均分达标、镜头审稿通过，才能进入导出。",
      actionKey: "export",
      nodeId: "",
    },
  ];

  const nextAction =
    !novelNode ? { label: "先建立剧本节点", description: "先在当前集建立小说工厂节点，把生产链起起来。", actionKey: "dashboard", nodeId: "" }
    : !assets.length ? { label: "先补资产", description: "当前最缺的是稳定资产，建议先做角色/场景/道具资产。", actionKey: "resources", nodeId: assetNode?.id || novelNode.id }
    : !shots.length ? { label: "先生成镜头表", description: "资产就绪后，下一步应进入镜头拆分和镜头提示词。", actionKey: "prompt", nodeId: shotNode?.id || novelNode.id }
    : withPrompt < shots.length ? { label: "先补齐镜头提示词", description: "还有镜头没有完成图片/视频提示词，先补齐再批量生产。", actionKey: "prompt", nodeId: shotNode?.id || "" }
    : timelineState.clips.length === 0 ? { label: "导入时间线", description: "镜头已经能生产，下一步建议导入时间线排节奏。", actionKey: "timeline", nodeId: shotNode?.id || "" }
    : timelineReady < timelineState.clips.length ? { label: "补齐时间线素材", description: "时间线已建立，但片段素材还没挂全，先补齐结果。", actionKey: "queue", nodeId: "" }
    : approvedShots < shots.length ? { label: "先过镜头审稿", description: "还有镜头没通过审稿，先在镜头表或审稿中心处理。", actionKey: "review", nodeId: shotNode?.id || "" }
    : averageShotScore < 72 ? { label: "先修弱镜头", description: "镜头平均质量分还没过线，建议先在镜头表执行一键修镜头。", actionKey: "prompt", nodeId: shotNode?.id || "" }
    : { label: "进入发布导出", description: "当前集已经具备发布准备条件，可以开始导出横竖版和归档包。", actionKey: "export", nodeId: "" };

  const blockerGroups = [
    {
      key: "weakShots",
      title: "弱镜头",
      count: weakShots.length,
      actionKey: "review",
      nodeId: shotNode?.id || "",
      detail: weakShots.length ? weakShots.slice(0, 6).map((item) => `${item.shot.id}(${item.report.score}分)`) : [],
      description: weakShots.length ? "先处理评分最低的镜头，能最快拉高交付稳定性。" : "当前没有弱镜头。",
      tone: weakShots.length ? "warn" : "ok",
    },
    {
      key: "unreviewed",
      title: "未审镜头",
      count: unreviewedShots.length,
      actionKey: "review",
      nodeId: shotNode?.id || "",
      detail: unreviewedShots.length ? unreviewedShots.slice(0, 6).map((shot) => `${shot.id}(${shot.reviewStatus || "未审"})`) : [],
      description: unreviewedShots.length ? "这些镜头还没进入通过状态，导出门槛会被卡住。" : "当前镜头审稿状态已清空阻塞。",
      tone: unreviewedShots.length ? "warn" : "ok",
    },
    {
      key: "timelineMedia",
      title: "时间线待素材",
      count: Math.max(0, timelineState.clips.length - timelineReady),
      actionKey: "timeline",
      nodeId: "",
      detail: timelineState.clips.filter((clip) => !String(clip.mediaUrl || "").trim()).slice(0, 6).map((clip) => clip.title || clip.shotId || "未命名片段"),
      description: timelineState.clips.length ? "时间线素材没挂齐时，成片导出和封面提取都会受影响。" : "当前集还没有时间线片段。",
      tone: timelineState.clips.length && timelineReady === timelineState.clips.length ? "ok" : "warn",
    },
    {
      key: "failedExports",
      title: "失败导出",
      count: failedExports.length,
      actionKey: "export",
      nodeId: "",
      detail: failedExports.slice(0, 6).map((item) => item.title || item.detail || item.type || "导出任务"),
      description: failedExports.length ? "这些导出失败记录可以直接在导出中心恢复，不必手动重建。" : "当前没有失败导出。",
      tone: failedExports.length ? "danger" : "ok",
    },
  ];

  const quickActions = [
    { key: "review", label: "打开审稿反馈", actionKey: "review", count: weakShots.length + unreviewedShots.length, detail: `弱镜头 ${weakShots.length} · 未审 ${unreviewedShots.length}` },
    { key: "timeline", label: "打开视频时间线", actionKey: "timeline", count: Math.max(0, timelineState.clips.length - timelineReady), detail: `待素材 ${Math.max(0, timelineState.clips.length - timelineReady)}` },
    { key: "export", label: "打开成片导出", actionKey: "export", count: failedExports.length, detail: failedExports.length ? `失败导出 ${failedExports.length}` : "交付套餐与恢复台" },
    { key: "queue", label: "打开生成队列", actionKey: "queue", count: generationQueue.filter((job) => job.status === "pending" || job.status === "running").length, detail: `待执行 ${generationQueue.filter((job) => job.status === "pending").length} · 运行中 ${generationQueue.filter((job) => job.status === "running").length}` },
  ];

  return {
    episodeName: episode.name || "当前集",
    coverage,
    summary: {
      scripts: episodeNodes.filter((node) => node.type === "novelPipeline").length,
      assets: assets.length,
      shots: shots.length,
      generated,
      averageShotScore,
      approvedShots,
    },
    stages,
    nextAction,
    blockerGroups,
    quickActions,
  };
}

function buildArchiveReport(archiveState, episodes, activeEpisodeId) {
  return buildArchiveReportFromState(normalizeArchiveState(archiveState), episodes, activeEpisodeId);
}

function findDuplicateCharacterNames(characters) {
  const groups = new Map();
  characters.forEach((character) => {
    const key = normalizeNameKey(character.name);
    if (!key) return;
    const list = groups.get(key) || [];
    list.push(character.name);
    groups.set(key, list);
  });
  return [...groups.values()].filter((names) => new Set(names).size > 1);
}

function normalizeNameKey(value) {
  return String(value || "").trim().replace(/\s+/g, "").toLowerCase();
}

function buildEpisodeIssues(nodes, shots, characters, scenes, resources = [], missingResourceRefs = [], weakAssets = []) {
  const issues = [];
  if (!nodes.some((node) => node.type === "novelPipeline")) issues.push({ level: "建议", text: "缺少小说转剧本节点" });
  if (!resources.length) issues.push({ level: "资源", text: "缺少项目资源中心内容" });
  if (!characters) issues.push({ level: "资产", text: "缺少人物资产库" });
  if (!scenes) issues.push({ level: "资产", text: "缺少场景资产库" });
  if (weakAssets.length) issues.push({ level: "一致性", text: `${weakAssets.length} 个资产缺少锁定信息` });
  if (!shots.length) issues.push({ level: "镜头", text: "缺少镜头表" });
  const missingImage = shots.filter((shot) => !String(shot.imagePrompt || "").trim()).length;
  const missingVideo = shots.filter((shot) => !String(shot.videoPrompt || "").trim()).length;
  if (missingImage) issues.push({ level: "提示词", text: `${missingImage} 个镜头缺少图片提示词` });
  if (missingVideo) issues.push({ level: "提示词", text: `${missingVideo} 个镜头缺少 AI 视频提示词` });
  if (missingResourceRefs.length) issues.push({ level: "资源", text: `${missingResourceRefs.length} 处资源引用缺失` });
  if (shots.length && !nodes.some((node) => node.type === "result")) issues.push({ level: "生产", text: "镜头尚未生成图片结果" });
  return issues.slice(0, 8);
}

function collectGlobalAssets(nodes) {
  const characters = [];
  const scenes = [];
  const props = [];
  nodes
    .filter((node) => node.type === "assetLibrary")
    .forEach((node) => {
      (node.data.characters || []).forEach((asset) => {
        characters.push(normalizeAsset(asset, "角色", node.id));
      });
      (node.data.scenes || []).forEach((asset) => {
        scenes.push(normalizeAsset(asset, "场景", node.id));
      });
      (node.data.props || []).forEach((asset) => {
        props.push(normalizeAsset(asset, "道具", node.id));
      });
    });
  const dedupedCharacters = dedupeAssets(characters);
  const dedupedScenes = dedupeAssets(scenes);
  const dedupedProps = dedupeAssets(props);
  const items = [...dedupedCharacters, ...dedupedScenes, ...dedupedProps];
  const usage = collectAssetUsage(nodes, items);
  const enrichedItems = items.map((asset) => ({
    ...asset,
    references: usage.byToken.get(asset.token) || [],
    referenceCount: (usage.byToken.get(asset.token) || []).length,
    missingFields: assetConsistencyGaps(asset),
  }));
  const byToken = new Map(enrichedItems.map((asset) => [asset.token, asset]));
  return {
    characters: enrichedItems.filter((asset) => asset.category === "角色"),
    scenes: enrichedItems.filter((asset) => asset.category === "场景"),
    props: enrichedItems.filter((asset) => asset.category === "道具"),
    items: enrichedItems,
    byToken,
    unused: enrichedItems.filter((asset) => !asset.referenceCount),
    weakLocks: enrichedItems.filter((asset) => assetConsistencyGaps(asset).length),
    missingRefs: usage.missing,
  };
}

function syncGeneratedImagesIntoAssets(nodes) {
  const resultNodes = nodes.filter((node) => (
    node.type === "result"
    && node.data?.imageUrl
    && (node.data?.sourcePrompt || node.data?.sourceAssetToken)
  ));
  if (!resultNodes.length) return nodes;
  const imageByToken = new Map();
  resultNodes.forEach((node) => {
    const explicitTokens = dedupeOrderedStrings([
      String(node.data.sourceAssetToken || "").trim(),
      ...extractAssetTokens(node.data.sourcePrompt),
    ]);
    explicitTokens.forEach((token) => {
      const list = imageByToken.get(token) || [];
      const item = normalizeAssetImageItem({
        imageUrl: node.data.imageUrl,
        imagePath: node.data.imagePath,
        originalImageUrl: node.data.originalImageUrl,
        thumbnailUrl: node.data.imageThumbnailUrl,
        thumbnailPath: node.data.imageThumbnailPath,
      });
      if (!list.some((entry) => entry.imageUrl === item.imageUrl)) list.push(item);
      imageByToken.set(token, list);
    });
  });
  if (!imageByToken.size) return nodes;

  let changed = false;
  const nextNodes = nodes.map((node) => {
    if (node.type !== "assetLibrary") return node;
    const data = { ...(node.data || {}) };
    ["characters", "scenes", "props"].forEach((key) => {
      const category = key === "characters" ? "角色" : key === "scenes" ? "场景" : "道具";
      const assets = Array.isArray(data[key]) ? data[key] : [];
      const nextAssets = assets.map((asset) => {
        const normalized = normalizeAsset(asset, category, node.id);
        const images = imageByToken.get(normalized.token);
        if (!images?.length) return asset;
        const activeImages = images.filter((image) => !isDiscardedAssetImage(normalized, image));
        if (!activeImages.length) return asset;
        const mergedItems = addUniqueAssetImageItems(normalized.imageItems || [], ...activeImages);
        if (
          mergedItems.length === (normalized.imageItems || []).length
          && normalized.imageUrl === (mergedItems[mergedItems.length - 1]?.imageUrl || "")
          && normalized.imagePath === (mergedItems[mergedItems.length - 1]?.imagePath || "")
        ) return asset;
        const latestImage = activeImages[activeImages.length - 1] || mergedItems[mergedItems.length - 1] || null;
        changed = true;
        return {
          ...normalized,
          imageUrl: latestImage?.imageUrl || normalized.imageUrl || "",
          imagePath: latestImage?.imagePath || normalized.imagePath || "",
          originalImageUrl: latestImage?.originalImageUrl || normalized.originalImageUrl || "",
          imageThumbnailUrl: latestImage?.thumbnailUrl || normalized.imageThumbnailUrl || "",
          imageThumbnailPath: latestImage?.thumbnailPath || normalized.imageThumbnailPath || "",
          imageItems: mergedItems.map((item) => ({
            ...item,
            primary: Boolean(latestImage?.imageUrl && item.imageUrl === latestImage.imageUrl),
          })),
          images: mergedItems.map((item) => item.imageUrl).filter(Boolean),
          lastImageSavedAt: Date.now(),
        };
      });
      data[key] = nextAssets;
    });
    return { ...node, data };
  });
  return changed ? nextNodes : nodes;
}

function addUniqueImage(images, ...nextImages) {
  const seen = new Set();
  return [...images, ...nextImages].filter((image) => {
    if (!image || seen.has(image)) return false;
    seen.add(image);
    return true;
  }).slice(-8);
}

function normalizeAssetImageItem(item) {
  if (!item) return null;
  if (typeof item === "string") {
    const imageUrl = String(item).trim();
    if (!imageUrl) return null;
    return {
      imageUrl: isLocalMediaPath(imageUrl) ? convertFileSrc(imageUrl) : imageUrl,
      imagePath: isLocalMediaPath(imageUrl) ? imageUrl : "",
      originalImageUrl: "",
      thumbnailUrl: "",
      thumbnailPath: "",
    };
  }
  const rawImageUrl = String(item.imageUrl || item.url || "").trim();
  const imagePath = String(item.imagePath || item.path || (isLocalMediaPath(rawImageUrl) ? rawImageUrl : "")).trim();
  const originalImageUrl = String(item.originalImageUrl || item.originalUrl || "").trim();
  const rawThumbnailUrl = String(item.thumbnailUrl || item.imageThumbnailUrl || "").trim();
  const thumbnailPath = String(item.thumbnailPath || item.imageThumbnailPath || (isLocalMediaPath(rawThumbnailUrl) ? rawThumbnailUrl : "")).trim();
  if (!rawImageUrl && !imagePath) return null;
  return {
    imageUrl: rawImageUrl && !isLocalMediaPath(rawImageUrl) ? rawImageUrl : (imagePath ? convertFileSrc(imagePath) : ""),
    imagePath,
    originalImageUrl,
    thumbnailUrl: rawThumbnailUrl && !isLocalMediaPath(rawThumbnailUrl) ? rawThumbnailUrl : (thumbnailPath ? convertFileSrc(thumbnailPath) : ""),
    thumbnailPath,
  };
}

function isLocalMediaPath(value = "") {
  const text = String(value || "").trim();
  return /^[a-zA-Z]:[\\/]/.test(text) || text.startsWith("\\\\") || text.startsWith("/");
}

function addUniqueAssetImageItems(items, ...nextItems) {
  const seen = new Set();
  return [...items, ...nextItems]
    .map((item) => normalizeAssetImageItem(item))
    .filter((item) => {
      if (!item?.imageUrl) return false;
      if (seen.has(item.imageUrl)) return false;
      seen.add(item.imageUrl);
      return true;
    })
    .slice(-8);
}

function assetImageKeys(item = {}) {
  return [
    item.imageUrl,
    item.url,
    item.imagePath,
    item.path,
    item.id,
  ].map((value) => String(value || "").trim()).filter(Boolean);
}

function isDiscardedAssetImage(asset = {}, item = {}) {
  const discarded = new Set([
    ...(Array.isArray(asset.discardedImageKeys) ? asset.discardedImageKeys : []),
    ...(Array.isArray(asset.rejectedImageItems) ? asset.rejectedImageItems.flatMap(assetImageKeys) : []),
    ...(Array.isArray(asset.rejectedImages) ? asset.rejectedImages : []),
  ].map((value) => String(value || "").trim()).filter(Boolean));
  if (!discarded.size) return false;
  return assetImageKeys(item).some((key) => discarded.has(key));
}

function removeDiscardedAssetImageKeys(current = [], item = {}) {
  const nextKeys = new Set(assetImageKeys(item));
  if (!nextKeys.size) return Array.isArray(current) ? current : [];
  return (Array.isArray(current) ? current : []).filter((key) => !nextKeys.has(String(key || "")));
}

function assetListByTab(tab, source) {
  if (tab === "scenes") return source.scenes || [];
  if (tab === "props") return source.props || [];
  return source.characters || [];
}

function assetCategoryByTab(tab) {
  if (tab === "scenes") return "场景";
  if (tab === "props") return "道具";
  return "角色";
}

function resourceListByTab(tab, source) {
  if (!source) return [];
  if (tab === "images") return source.images || [];
  if (tab === "videos") return source.videos || [];
  if (tab === "scripts") return source.scripts || [];
  if (tab === "templates") return source.templates || [];
  if (tab === "docs") return source.docs || [];
  if (tab === "references") return source.references || [];
  return source.items || [];
}

function normalizeProjectResources(resources, fallbackEpisodeId) {
  return (Array.isArray(resources) ? resources : []).map((resource, index) => normalizeProjectResource(resource, fallbackEpisodeId, index));
}

function defaultEpisodeTimeline() {
  return { clips: [] };
}

function buildPromptFactoryShotSources(nodes, activeEpisodeId) {
  const sources = [];
  nodes
    .filter((node) => node.type === "shotList" && (node.data?.episodeId || activeEpisodeId) === activeEpisodeId)
    .forEach((node) => {
      (node.data.shots || []).forEach((shot, index) => {
        const normalized = normalizeShotRecord(shot, index);
        sources.push({
          ...normalized,
          sourceNodeId: node.id,
        });
      });
    });
  return sources;
}

function buildPromptFactoryOutput(request) {
  const payload = request.payload || {};
  const template = (request.templates?.[request.templateKey] || PROMPT_TEMPLATE_LIBRARY[request.templateKey] || "").trim();
  const styleMeta = request.styleMeta || {};
  if (!template) return "";
  const assetBasePrompt = request.sourceType === "asset"
    ? selectAssetPromptVariant(
      {
        prompt: payload.prompt || "",
        promptVariants: payload.promptVariants || {},
        cineForge: payload.cineForge || {},
      },
      {
        modelPreset: request.modelPreset || "",
        providerName: request.providerName || "",
        providerMode: request.providerMode || "",
        runtimeModel: request.runtimeModel || "",
        tool: request.tool || "",
        kind: payload.kind || payload.category || "",
      },
    )
    : "";
  const values = request.sourceType === "asset"
    ? {
      title: payload.name || request.title || "",
      category: payload.category || payload.kind || "",
      basePrompt: assetBasePrompt || payload.prompt || "",
      visualLock: payload.visualLock || "",
      continuityRule: payload.continuityRule || "",
      evidenceSource: Array.isArray(payload.evidenceSource) ? payload.evidenceSource.join("；") : (payload.evidenceSource || ""),
      referenceResources: payload.referenceResources || "",
      stylePreset: request.stylePreset || "",
      modelPreset: request.modelPreset || "",
      parameterGuide: (request.modelParamMeta || {}).parameterGuide || "",
      imageStyle: styleMeta.imageStyle || "",
      styleGuide: styleMeta.styleGuide || "",
      assetGuide: styleMeta.assetGuide || "",
      videoGuide: styleMeta.videoGuide || "",
      modelGuide: styleMeta.modelGuide || "",
      negativeHints: styleMeta.negativeHints || "",
      focus: payload.meta || "稳定识别与连续性",
      scene: "",
      assetRefs: payload.token || "",
      action: "",
      cameraMove: "",
      duration: "",
    }
    : {
      title: payload.id || request.title || "",
      scene: payload.scene || "",
      basePrompt: request.templateKey === "video_shot" ? (payload.videoPrompt || "") : (payload.imagePrompt || ""),
      assetRefs: Array.isArray(payload.assetRefs) ? payload.assetRefs.join("、") : extractAssetTokens(`${payload.imagePrompt || ""} ${payload.videoPrompt || ""}`).join("、"),
      referenceResources: payload.referenceResources || "",
      action: payload.action || "",
      cameraMove: payload.cameraMove || payload.camera || "",
      duration: payload.duration || "",
      stylePreset: request.stylePreset || "",
      modelPreset: request.modelPreset || "",
      parameterGuide: (request.modelParamMeta || {}).parameterGuide || "",
      imageStyle: styleMeta.imageStyle || "",
      styleGuide: styleMeta.styleGuide || "",
      assetGuide: styleMeta.assetGuide || "",
      videoGuide: styleMeta.videoGuide || "",
      modelGuide: styleMeta.modelGuide || "",
      negativeHints: styleMeta.negativeHints || "",
      focus: payload.shotSize || "主体动作和焦点",
      category: "镜头",
      visualLock: "",
      continuityRule: "",
      evidenceSource: "",
    };
  return fillPromptFactoryTemplate(template, values);
}

function fillPromptFactoryTemplate(template, values) {
  let output = String(template || "");
  Object.entries(values || {}).forEach(([key, value]) => {
    output = output.replaceAll(`{{${key}}}`, String(value || ""));
  });
  return output.replace(/\n{3,}/g, "\n\n").trim();
}

function normalizeAsset(asset, category, sourceId = "") {
  const name = String(asset.name || category).trim();
  const imageItems = addUniqueAssetImageItems(
    Array.isArray(asset.imageItems) ? asset.imageItems : [],
    ...(Array.isArray(asset.images) ? asset.images : []),
    {
      imageUrl: asset.imageUrl,
      imagePath: asset.imagePath,
      originalImageUrl: asset.originalImageUrl,
      thumbnailUrl: asset.imageThumbnailUrl,
      thumbnailPath: asset.imageThumbnailPath,
    },
  );
  const rejectedImageItems = addUniqueAssetImageItems(
    Array.isArray(asset.rejectedImageItems) ? asset.rejectedImageItems : [],
    ...(Array.isArray(asset.rejectedImages) ? asset.rejectedImages : []),
  );
  const primaryImage = normalizeAssetImageItem({
    imageUrl: asset.imageUrl,
    imagePath: asset.imagePath,
    originalImageUrl: asset.originalImageUrl,
    thumbnailUrl: asset.imageThumbnailUrl,
    thumbnailPath: asset.imageThumbnailPath,
  }) || imageItems[0] || null;
  const evidenceSource = Array.isArray(asset.evidenceSource)
    ? asset.evidenceSource.filter(Boolean).map((entry) => String(entry).trim()).filter(Boolean)
    : String(asset.evidenceSource || "").trim()
      ? [String(asset.evidenceSource || "").trim()]
      : [];
  return {
    ...asset,
    name,
    category,
    sourceId,
    token: asset.token || makeAssetToken(category, name),
    prompt: asset.prompt || "",
    promptVariants: normalizeAssetPromptVariants({
      ...extractAssetPromptVariantsFromText(asset.prompt || ""),
      ...(asset.cineForge || {}),
      ...(asset.promptVariants || {}),
    }),
    visualLock: asset.visualLock || asset.visualAnchor || "",
    continuityRule: asset.continuityRule || asset.stageChange || "",
    referenceResources: asset.referenceResources || "",
    evidenceSource,
    approved: asset.approved !== false,
    preferredVariant: String(asset.preferredVariant || "").trim(),
    aliases: asset.aliases || "",
    imageUrl: primaryImage?.imageUrl || "",
    imagePath: primaryImage?.imagePath || "",
    originalImageUrl: primaryImage?.originalImageUrl || "",
    imageThumbnailUrl: primaryImage?.thumbnailUrl || "",
    imageThumbnailPath: primaryImage?.thumbnailPath || "",
    mediaRefs: Array.isArray(asset.mediaRefs) ? asset.mediaRefs : [],
    imageItems,
    rejectedImageItems,
    images: imageItems.map((item) => item.imageUrl).filter(Boolean),
    rejectedImages: rejectedImageItems.map((item) => item.imageUrl).filter(Boolean),
    discardedImageKeys: Array.isArray(asset.discardedImageKeys) ? asset.discardedImageKeys : [],
  };
}

function assetForStorage(asset) {
  return {
    name: asset.name || "",
    kind: asset.kind || "",
    category: asset.category || "",
    token: asset.token || "",
    prompt: asset.prompt || "",
    promptVariants: normalizeAssetPromptVariants(asset.promptVariants || {}),
    visualLock: asset.visualLock || "",
    continuityRule: asset.continuityRule || "",
    referenceResources: asset.referenceResources || "",
    evidenceSource: Array.isArray(asset.evidenceSource) ? asset.evidenceSource : [],
    approved: asset.approved !== false,
    preferredVariant: asset.preferredVariant || "",
    aliases: asset.aliases || "",
    meta: asset.meta || "",
    imageUrl: asset.imageUrl || "",
    imagePath: asset.imagePath || "",
    originalImageUrl: asset.originalImageUrl || "",
    imageThumbnailUrl: asset.imageThumbnailUrl || "",
    imageThumbnailPath: asset.imageThumbnailPath || "",
    mediaRefs: Array.isArray(asset.mediaRefs) ? asset.mediaRefs : [],
    imageItems: Array.isArray(asset.imageItems) ? asset.imageItems : [],
    rejectedImageItems: Array.isArray(asset.rejectedImageItems) ? asset.rejectedImageItems : [],
    discardedImageKeys: Array.isArray(asset.discardedImageKeys) ? asset.discardedImageKeys : [],
    images: Array.isArray(asset.images) ? asset.images : [],
    rejectedImages: Array.isArray(asset.rejectedImages) ? asset.rejectedImages : [],
    lastImageSavedAt: asset.lastImageSavedAt || 0,
  };
}

function dedupeAssets(assets) {
  const seen = new Set();
  return assets.filter((asset) => {
    if (seen.has(asset.token)) return false;
    seen.add(asset.token);
    return true;
  });
}

function collectAssetUsage(nodes, assets) {
  const byToken = new Map((assets || []).map((asset) => [asset.token, []]));
  const knownTokens = new Set(byToken.keys());
  const missing = [];
  nodes.forEach((node) => {
    walkStringFields(node.data || {}, [], (text, path) => {
      extractAssetTokens(text).forEach((token) => {
        const reference = {
          token,
          nodeId: node.id,
          nodeTitle: node.data?.displayName || nodeTypeLabel(node.type),
          nodeType: node.type,
          path: formatReferencePath(path),
        };
        if (knownTokens.has(token)) byToken.get(token).push(reference);
        else missing.push(reference);
      });
    });
  });
  return { byToken, missing };
}

function assetConsistencyGaps(asset) {
  const gaps = [];
  if (!String(asset.prompt || "").trim()) gaps.push("缺少主提示词");
  if (!String(asset.visualLock || "").trim()) gaps.push("缺少视觉锁定");
  if (!String(asset.continuityRule || "").trim()) gaps.push("缺少连续性规则");
  if (!(Array.isArray(asset.evidenceSource) ? asset.evidenceSource.length : String(asset.evidenceSource || "").trim())) gaps.push("缺少证据来源");
  if (asset.category === "角色" && !asset.imageUrl && !(asset.images || []).length) gaps.push("缺少角色参考图");
  return gaps;
}

function makeAssetToken(category, name) {
  return `@${category}_${String(name).replace(/\s+/g, "").replace(/[^\u4e00-\u9fa5A-Za-z0-9_-]/g, "") || "未命名"}`;
}

function parseAssetTokenCategory(token) {
  const match = String(token || "").match(/^@(角色|场景|道具|风格)_/);
  return match?.[1] || "";
}

function parseAssetTokenName(token) {
  return String(token || "").replace(/^@(角色|场景|道具|风格)_/, "").trim();
}

function inferAssetPromptVariant(options = {}) {
  const explicit = String(options.variant || "").trim().toLowerCase();
  if (["nanobanana", "nano", "gemini"].includes(explicit)) return "nanoBanana";
  if (["opensource", "open_source", "open"].includes(explicit)) return "openSource";
  if (["midjourney", "mj"].includes(explicit)) return "midjourney";
  if (options.tool === "geminiWeb") return "nanoBanana";
  if (options.tool === "midjourney") return "midjourney";
  const hint = [
    options.modelPreset,
    options.runtimeModel,
    options.providerMode,
    options.providerName,
    options.kind,
  ].filter(Boolean).join(" ").toLowerCase();
  if (/midjourney|\bmj\b/.test(hint)) return "midjourney";
  if (/comfy|开源|flux|sdxl|stable diffusion|wanx|wan 2\.1|invoke|local/.test(hint)) return "openSource";
  if (/banana|gemini|gpt-image|doubao|seedream|即梦|jimeng|通用图像模型|通用视频模型/.test(hint)) return "nanoBanana";
  return "";
}

function selectAssetPromptVariant(asset, options = {}) {
  const variants = normalizeAssetPromptVariants({
    ...extractAssetPromptVariantsFromText(asset?.prompt || ""),
    ...(asset?.cineForge || {}),
    ...(asset?.promptVariants || {}),
  });
  const explicitPreferred = String(asset?.preferredVariant || "").trim();
  const lockedPreferred = asset?.approved && explicitPreferred && variants[explicitPreferred];
  const preferred = inferAssetPromptVariant(options);
  const orderedKeys = lockedPreferred
    ? [explicitPreferred, preferred, "nanoBanana", "openSource", "midjourney"].filter(Boolean)
    : preferred
      ? [preferred, "nanoBanana", "openSource", "midjourney"]
      : ["nanoBanana", "openSource", "midjourney"];
  const picked = orderedKeys.map((key) => variants[key]).find((value) => String(value || "").trim());
  return picked || asset?.prompt || "";
}

function collapsePromptVariantsForTool(text, options = {}) {
  const variants = extractAssetPromptVariantsFromText(text);
  if (!variants.nanoBanana && !variants.openSource && !variants.midjourney) return String(text || "");
  const preferred = inferAssetPromptVariant(options);
  const orderedKeys = preferred
    ? [preferred, "nanoBanana", "openSource", "midjourney"]
    : ["nanoBanana", "openSource", "midjourney"];
  const picked = orderedKeys.map((key) => variants[key]).find((value) => String(value || "").trim());
  return picked || String(text || "");
}

function buildPromptPreparationOptions(settings, overrides = {}) {
  const providerMode = overrides.providerMode || currentProviderMode(settings || {});
  const runtimeModel = overrides.runtimeModel ?? settings?.customModel ?? "";
  const defaultModelPreset = providerMode === "comfy" ? "开源模型" : (runtimeModel || "");
  return {
    tool: overrides.tool || "",
    kind: overrides.kind || "",
    variant: overrides.variant || "",
    providerMode,
    runtimeModel,
    providerName: overrides.providerName || "",
    modelPreset: overrides.modelPreset || defaultModelPreset,
  };
}

function preparePromptForNode(text, assetIndex, settings, overrides = {}) {
  const options = buildPromptPreparationOptions(settings, overrides);
  const collapsed = collapsePromptVariantsForTool(text, options);
  const expanded = expandAssetReferences(collapsed, assetIndex, options);
  return {
    options,
    basePrompt: collapsed,
    expandedPrompt: expanded,
  };
}

function expandAssetReferences(text, assetIndex, options = {}) {
  if (!text || !assetIndex?.items?.length) return text;
  let expanded = String(text);
  assetIndex.items.forEach((asset) => {
    const escaped = escapeRegExp(asset.token);
    const selectedPrompt = selectAssetPromptVariant(asset, options);
    const details = [
      selectedPrompt,
      asset.approved ? "当前资产已锁定定稿" : "",
      asset.visualLock ? `视觉锁定：${asset.visualLock}` : "",
      asset.continuityRule ? `连续性：${asset.continuityRule}` : "",
      asset.imageUrl ? `当前主图：${asset.imageUrl}` : "",
      asset.referenceResources ? `参考资源：${asset.referenceResources}` : "",
    ].filter(Boolean).join("；");
    expanded = expanded.replace(new RegExp(`${escaped}(?![\\u4e00-\\u9fa5A-Za-z0-9_-])`, "g"), `${asset.token}：${details}`);
  });
  return expanded;
}

function analyzePromptReferences(text, assetIndex) {
  const tokens = extractAssetTokens(text);
  const used = [];
  const missing = [];
  tokens.forEach((token) => {
    const asset = assetIndex?.byToken?.get(token);
    if (asset) used.push(asset);
    else missing.push(token);
  });
  return { tokens, used, missing };
}

function extractAssetTokens(text) {
  const matches = String(text || "").match(/@(角色|场景|道具|风格)_[\u4e00-\u9fa5A-Za-z0-9_-]+/g) || [];
  return [...new Set(matches)];
}

function formatShotListMarkdown(shots, assetIndex, resourceIndex) {
  const lines = ["# 镜头表", ""];
  shots.forEach((shot) => {
    const normalized = normalizeShotRecord(shot);
    lines.push(`## ${normalized.id}｜${normalized.scene}｜${normalized.status || "待写"}`);
    lines.push(`人物：${(shot.characters || []).join("、")}`);
    lines.push(`景别：${normalized.shotSize || ""}`);
    lines.push(`运镜：${normalized.cameraMove || normalized.camera || ""}`);
    lines.push(`动作：${normalized.action || ""}`);
    lines.push(`时长：${normalized.duration || ""}`);
    if (normalized.referenceResources) lines.push(`参考资源：${normalized.referenceResources}`);
    if (normalized.negativePrompt) lines.push(`负面提示词：${normalized.negativePrompt}`);
    lines.push(`图片提示词：${buildImageShotPrompt(normalized, assetIndex, resourceIndex)}`);
    lines.push(`AI视频提示词：${buildVideoShotPrompt(normalized, assetIndex, resourceIndex)}`);
    lines.push("");
  });
  return lines.join("\n");
}

function normalizeShotRecord(shot, index = 0) {
  const rawAssetRefs = Array.isArray(shot?.assetRefs)
    ? shot.assetRefs.filter(Boolean)
    : extractAssetTokens(`${shot?.imagePrompt || ""} ${shot?.videoPrompt || ""}`);
  const inferredMainCharacterToken = String(shot?.mainCharacterToken || "").trim() || rawAssetRefs.find((token) => token.startsWith("@角色_")) || "";
  const inferredMainSceneToken = String(shot?.mainSceneToken || "").trim() || rawAssetRefs.find((token) => token.startsWith("@场景_")) || "";
  const keyPropTokens = Array.isArray(shot?.keyPropTokens)
    ? shot.keyPropTokens.filter(Boolean)
    : rawAssetRefs.filter((token) => token.startsWith("@道具_"));
  const assetRefs = dedupeOrderedStrings([
    ...rawAssetRefs,
    inferredMainCharacterToken,
    inferredMainSceneToken,
    ...keyPropTokens,
  ]);
  const referenceResources = String(shot?.referenceResources || "").trim();
  return {
    ...shot,
    id: shot?.id || `S${String(index + 1).padStart(2, "0")}`,
    shotType: shot?.shotType || "",
    scene: shot?.scene || "",
    status: shot?.status || "待写",
    duration: shot?.duration || "",
    shotSize: shot?.shotSize || "",
    mainFocus: shot?.mainFocus || "",
    frameIntent: shot?.frameIntent || "",
    openingFrame: shot?.openingFrame || "",
    closingFrame: shot?.closingFrame || "",
    continuityNote: shot?.continuityNote || "",
    riskControl: shot?.riskControl || "",
    cameraMove: shot?.cameraMove || shot?.camera || "",
    mainCharacterToken: inferredMainCharacterToken,
    mainSceneToken: inferredMainSceneToken,
    keyPropTokens,
    assetRefs,
    negativePrompt: shot?.negativePrompt || "",
    referenceResources,
    imagePrompt: shot?.imagePrompt || "",
    videoPrompt: shot?.videoPrompt || "",
    imageProviderMode: normalizeImageProviderMode(shot?.imageProviderMode || shot?.imageCallMode || shot?.imageProvider || ""),
    imageParamPreset: shot?.imageParamPreset || "",
    imageModelPreset: shot?.imageModelPreset || "",
    imageRuntimeModel: shot?.imageRuntimeModel || "",
    imageSize: shot?.imageSize || "",
    imageAspectRatio: shot?.imageAspectRatio || "",
    imageQuality: shot?.imageQuality || "",
    videoParamPreset: shot?.videoParamPreset || "",
    videoModelPreset: shot?.videoModelPreset || "",
    videoRuntimeModel: shot?.videoRuntimeModel || "",
    videoAspectRatio: shot?.videoAspectRatio || "",
    motionStrength: shot?.motionStrength || "",
    reviewStatus: shot?.reviewStatus || "未审",
    resultDecision: shot?.resultDecision || "",
    resultDecisionAt: Number(shot?.resultDecisionAt) || 0,
    reworkReason: shot?.reworkReason || "",
    rejectedResultUrl: shot?.rejectedResultUrl || "",
    reviewComments: Array.isArray(shot?.reviewComments) ? shot.reviewComments : [],
    autoRevisionReport: shot?.autoRevisionReport && typeof shot.autoRevisionReport === "object" ? {
      summary: shot.autoRevisionReport.summary || "",
      changeLog: Array.isArray(shot.autoRevisionReport.changeLog) ? shot.autoRevisionReport.changeLog : [],
      fixedIssues: Array.isArray(shot.autoRevisionReport.fixedIssues) ? shot.autoRevisionReport.fixedIssues : [],
      assetRefreshPlan: Array.isArray(shot.autoRevisionReport.assetRefreshPlan) ? shot.autoRevisionReport.assetRefreshPlan : [],
      executedRefreshPlan: Array.isArray(shot.autoRevisionReport.executedRefreshPlan) ? shot.autoRevisionReport.executedRefreshPlan : [],
      refreshSummary: shot.autoRevisionReport.refreshSummary || "",
      refreshCompletedAt: shot.autoRevisionReport.refreshCompletedAt || 0,
      updatedAt: shot.autoRevisionReport.updatedAt || 0,
    } : null,
  };
}

function inferShotMainFocus(shot) {
  const scene = String(shot?.scene || "").trim();
  const action = String(shot?.action || "").trim();
  const mainCharacterToken = String(shot?.mainCharacterToken || "").trim();
  if (mainCharacterToken) return `${mainCharacterToken}在${scene || "当前场景"}中的关键动作`;
  const characters = Array.isArray(shot?.characters) ? shot.characters.filter(Boolean) : [];
  if (characters.length) return `${characters[0]}在${scene || "当前场景"}中的关键动作`;
  if (action) return summarizeText(action, 26);
  if (scene) return `${scene}中的核心视觉信息`;
  return "当前镜头的唯一主焦点";
}

function inferShotRefreshPlanFromPatch(previousShot, nextShot, revision = null) {
  const previous = normalizeShotRecord(previousShot || {});
  const next = normalizeShotRecord(nextShot || {});
  const plan = [];
  const touchedTokens = dedupeOrderedStrings([
    next.mainCharacterToken,
    next.mainSceneToken,
    ...(Array.isArray(next.keyPropTokens) ? next.keyPropTokens : []),
    ...(Array.isArray(next.assetRefs) ? next.assetRefs : []),
  ]).filter(Boolean);

  if (previous.mainCharacterToken !== next.mainCharacterToken || previous.mainSceneToken !== next.mainSceneToken) {
    plan.push("刷新主角色与主场景绑定，并复检连续性。");
  }
  if (JSON.stringify(previous.keyPropTokens || []) !== JSON.stringify(next.keyPropTokens || [])) {
    plan.push("刷新关键道具绑定，并校正镜头内道具连续性。");
  }
  if (previous.referenceResources !== next.referenceResources && String(next.referenceResources || "").trim()) {
    plan.push("刷新参考资源绑定，让后续生图/生视频沿用最新参考。");
  }
  if (
    previous.imagePrompt !== next.imagePrompt
    || previous.videoPrompt !== next.videoPrompt
    || previous.mainFocus !== next.mainFocus
    || previous.openingFrame !== next.openingFrame
    || previous.closingFrame !== next.closingFrame
  ) {
    plan.push("重建当前镜头图片提示词、视频提示词与开收画面。");
  }
  if (
    previous.duration !== next.duration
  ) {
    plan.push("回刷时间线片段、图片提示词与视频提示词。");
  }
  if (
    previous.continuityNote !== next.continuityNote
    || previous.riskControl !== next.riskControl
    || previous.frameIntent !== next.frameIntent
  ) {
    plan.push("按新的连续性说明和风险控制重新同步镜头生产骨架。");
  }
  if (!plan.length && touchedTokens.length) {
    plan.push("同步相关资产证据，并复检当前镜头与时间线。");
  }
  if (Array.isArray(revision?.assetRefreshPlan) && revision.assetRefreshPlan.length) {
    return dedupeOrderedStrings([...revision.assetRefreshPlan, ...plan]);
  }
  return dedupeOrderedStrings(plan);
}

function inferShotFrameIntent(shot) {
  const action = String(shot?.action || "").trim();
  const emotion = String(shot?.emotion || "").trim();
  if (/揭露|发现|看见|露出|出现|显现/.test(action)) return "转折揭示";
  if (/冲|追|打|撞|扑|拔|推开|奔跑|逃/.test(action)) return "叙事推进";
  if (/哭|笑|沉默|抬眼|握紧|迟疑|颤抖/.test(`${action} ${emotion}`)) return "情绪强调";
  if (/爆发|反击|坠落|觉醒|开枪|击中/.test(action)) return "爆点兑现";
  return "建立";
}

function inferShotTemplateType(shot) {
  const explicit = String(shot?.shotType || "").trim();
  if (explicit) return explicit;
  const action = String(shot?.action || "").trim();
  const emotion = String(shot?.emotion || "").trim();
  const shotSize = String(shot?.shotSize || "").trim();
  if (/全景|远景/.test(shotSize) || /建立|环境|空间|到达|进入/.test(`${action} ${emotion}`)) return "建立镜头";
  if (/对话|争执|交谈|回应|说|问|答|低声/.test(action)) return "对话镜头";
  if (/冲|追|打|撞|扑|逃|反击|坠落|开枪|拔刀|奔跑/.test(action)) return "动作镜头";
  if (/特写|近景/.test(shotSize) || /哭|笑|沉默|迟疑|颤抖|抬眼|握紧|崩溃/.test(`${action} ${emotion}`)) return "情绪特写";
  return "叙事推进镜头";
}

function buildShotTypeStrategyPatch(shot) {
  const shotType = inferShotTemplateType(shot);
  const strategies = {
    "建立镜头": {
      imageParamPreset: "建立镜头默认",
      imageAspectRatio: "16:9",
      imageQuality: "高",
      videoParamPreset: "建立镜头默认",
      videoAspectRatio: "16:9",
      motionStrength: "弱到中",
    },
    "对话镜头": {
      imageParamPreset: "对话镜头默认",
      imageAspectRatio: "16:9",
      imageQuality: "高",
      videoParamPreset: "对话镜头默认",
      videoAspectRatio: "16:9",
      motionStrength: "弱",
    },
    "动作镜头": {
      imageParamPreset: "动作镜头默认",
      imageAspectRatio: "16:9",
      imageQuality: "高",
      videoParamPreset: "动作镜头默认",
      videoAspectRatio: "16:9",
      motionStrength: "中到强",
    },
    "情绪特写": {
      imageParamPreset: "情绪特写默认",
      imageAspectRatio: "3:4",
      imageQuality: "高",
      videoParamPreset: "情绪特写默认",
      videoAspectRatio: "9:16",
      motionStrength: "弱",
    },
    "叙事推进镜头": {
      imageParamPreset: "叙事推进默认",
      imageAspectRatio: "16:9",
      imageQuality: "高",
      videoParamPreset: "叙事推进默认",
      videoAspectRatio: "16:9",
      motionStrength: "中",
    },
  };
  const strategy = strategies[shotType] || strategies["叙事推进镜头"];
  return {
    shotType,
    imageParamPreset: shot.imageParamPreset || strategy.imageParamPreset,
    imageAspectRatio: shot.imageAspectRatio || strategy.imageAspectRatio,
    imageQuality: shot.imageQuality || strategy.imageQuality,
    videoParamPreset: shot.videoParamPreset || strategy.videoParamPreset,
    videoAspectRatio: shot.videoAspectRatio || strategy.videoAspectRatio,
    motionStrength: shot.motionStrength || strategy.motionStrength,
  };
}

function buildShotTypeNegativePrompt(shot, mode = "image") {
  const shotType = inferShotTemplateType(shot);
  const base = mode === "video"
    ? ["画面闪烁", "脸部崩坏", "服装跳变", "文字水印"]
    : ["文字水印", "低清晰度", "角色不一致", "构图混乱"];
  const typed = {
    "建立镜头": mode === "video"
      ? ["空间错位", "镜头乱摇", "建筑结构漂移", "光向跳变"]
      : ["空间透视错误", "主光方向混乱", "场景标识物丢失", "空间关系不清"],
    "对话镜头": mode === "video"
      ? ["视线不对", "口型节奏失真", "双人站位跳变", "背景抢戏"]
      : ["视线关系错误", "人物抢焦", "表情不连贯", "背景喧宾夺主"],
    "动作镜头": mode === "video"
      ? ["多手多脚", "动作断层", "受力方向错误", "运动轨迹漂移"]
      : ["肢体结构错误", "动作定格失真", "受力点不清", "多主体抢焦"],
    "情绪特写": mode === "video"
      ? ["脸漂", "微表情跳变", "无意义大动作", "镜头晃动过强"]
      : ["脸部失真", "眼神漂移", "皮肤质感崩坏", "背景过强"],
    "叙事推进镜头": mode === "video"
      ? ["信息点过多", "主焦点漂移", "镜头变化过量", "节奏断裂"]
      : ["信息堆叠", "主焦点不明", "背景信息过量", "画面叙事失焦"],
  }[shotType] || [];
  return dedupeOrderedStrings([...base, ...typed]).join("，");
}

function buildShotTypeRouteSummary(shot) {
  const normalized = normalizeShotRecord(shot);
  const patch = buildShotTypeStrategyPatch(normalized);
  const shotType = patch.shotType || inferShotTemplateType(normalized);
  const routeMap = {
    "建立镜头": {
      image: "优先空间建立、主光方向、主体站位，弱化表演细枝末节。",
      video: "先稳稳建立空间，再引入主体变化，镜头运动保持克制。",
      focus: "空间关系 > 主体位置 > 光源结构",
    },
    "对话镜头": {
      image: "优先视线关系、表情状态和说话方压迫感，背景不抢戏。",
      video: "优先口型/视线承接和微表情，限制额外大动作。",
      focus: "说话关系 > 表情 > 视线",
    },
    "动作镜头": {
      image: "优先唯一动作瞬间、受力方向和清晰姿态，不堆多动作。",
      video: "优先动作起点-中段-终点闭合，镜头服务动作，不乱摇。",
      focus: "动作路径 > 受力点 > 结尾姿态",
    },
    "情绪特写": {
      image: "优先脸部稳定、眼神和微表情，背景退后。",
      video: "优先情绪停顿、呼吸和轻微镜头变化，不做大幅运动。",
      focus: "表情 > 眼神 > 情绪余波",
    },
    "叙事推进镜头": {
      image: "优先当前信息点，构图清楚，避免信息平铺。",
      video: "围绕单一叙事点推进，镜头和动作变化适中。",
      focus: "主信息点 > 当前动作 > 场景反馈",
    },
  };
  const route = routeMap[shotType] || routeMap["叙事推进镜头"];
  return {
    shotType,
    imageRoute: route.image,
    videoRoute: route.video,
    focusRoute: route.focus,
    imagePreset: patch.imageParamPreset || "",
    videoPreset: patch.videoParamPreset || "",
    imageAspectRatio: patch.imageAspectRatio || "",
    videoAspectRatio: patch.videoAspectRatio || "",
    motionStrength: patch.motionStrength || "",
  };
}

function inferShotOpeningFrame(shot) {
  const scene = String(shot?.scene || "").trim() || "当前场景";
  const focus = String(shot?.mainFocus || "").trim() || inferShotMainFocus(shot);
  const shotSize = String(shot?.shotSize || "").trim() || "中景";
  return `${shotSize}，${scene}先被建立，画面主焦点是${focus}，主体与空间关系一眼可读。`;
}

function inferShotClosingFrame(shot) {
  const action = String(shot?.action || "").trim();
  const emotion = String(shot?.emotion || "").trim();
  if (action) return `动作停在“${summarizeText(action, 24)}”完成后的瞬间，留下${emotion || "下一镜需要承接的情绪"}。`;
  return "结尾停在可被下一镜直接承接的稳定姿态或情绪余波上。";
}

function inferShotContinuityNote(shot) {
  const scene = String(shot?.mainSceneToken || shot?.scene || "").trim();
  const mainCharacterToken = String(shot?.mainCharacterToken || "").trim();
  const keyPropTokens = Array.isArray(shot?.keyPropTokens) ? shot.keyPropTokens.filter(Boolean) : [];
  const focus = String(shot?.mainFocus || "").trim() || inferShotMainFocus(shot);
  const bindings = [mainCharacterToken, ...keyPropTokens].filter(Boolean).join("、");
  return `保持${scene || "场景"}空间朝向、${bindings || "主体"}的位置关系与外观稳定，下一镜继续承接${focus}。`;
}

function inferShotRiskControl(shot) {
  const refs = Array.isArray(shot?.assetRefs) ? shot.assetRefs.filter(Boolean) : [];
  const mainCharacterToken = String(shot?.mainCharacterToken || "").trim();
  const mainSceneToken = String(shot?.mainSceneToken || "").trim();
  const risks = [];
  if (!refs.length) risks.push("补充资产 token，避免角色和场景漂移");
  if (!mainCharacterToken) risks.push("明确主角色绑定，减少主角脸和服装漂移");
  if (!mainSceneToken) risks.push("明确主场景绑定，避免空间关系跳变");
  if (!String(shot?.openingFrame || "").trim()) risks.push("明确开场画面，避免模型自行发散");
  if (!String(shot?.closingFrame || "").trim()) risks.push("明确收尾状态，避免动作断层");
  if (!String(shot?.cameraMove || shot?.camera || "").trim()) risks.push("限定镜头运动，避免无意义乱动");
  if (!String(shot?.action || shot?.cameraMove || "").trim()) risks.push("补充动作与镜头运动，增强镜头可执行性");
  return risks.join("；") || "保持单主体、单主动作、单主焦点，避免脸漂移、空间错位和多肢体。";
}

function suggestShotAssetBindingPatch(shot, assetIndex = null) {
  const normalized = normalizeShotRecord(shot);
  const byNameAndCategory = new Map();
  (assetIndex?.items || []).forEach((asset) => {
    const key = `${asset.category}:${normalizeNameKey(asset.name)}`;
    if (!byNameAndCategory.has(key)) byNameAndCategory.set(key, asset);
  });
  const findAsset = (category, name) => {
    if (!name) return null;
    return byNameAndCategory.get(`${category}:${normalizeNameKey(name)}`) || null;
  };
  const inferredMainCharacterToken = normalized.mainCharacterToken
    || normalized.assetRefs.find((token) => token.startsWith("@角色_"))
    || (Array.isArray(normalized.characters) ? normalized.characters.map((name) => findAsset("角色", name)?.token).find(Boolean) : "")
    || "";
  const inferredMainSceneToken = normalized.mainSceneToken
    || normalized.assetRefs.find((token) => token.startsWith("@场景_"))
    || findAsset("场景", normalized.scene)?.token
    || "";
  const inferredPropTokens = dedupeOrderedStrings([
    ...(Array.isArray(normalized.keyPropTokens) ? normalized.keyPropTokens : []),
    ...normalized.assetRefs.filter((token) => token.startsWith("@道具_")),
  ]);
  const assetRefs = dedupeOrderedStrings([
    ...normalized.assetRefs,
    inferredMainCharacterToken,
    inferredMainSceneToken,
    ...inferredPropTokens,
  ]);
  return {
    mainCharacterToken: inferredMainCharacterToken,
    mainSceneToken: inferredMainSceneToken,
    keyPropTokens: inferredPropTokens,
    assetRefs,
  };
}

function buildShotQualityPatch(shot) {
  const normalized = normalizeShotRecord(shot);
  const bindingPatch = suggestShotAssetBindingPatch(normalized);
  const strategyPatch = buildShotTypeStrategyPatch(normalized);
  const negativePrompt = normalized.negativePrompt || buildShotTypeNegativePrompt(normalized, "image");
  const mainFocus = normalized.mainFocus || inferShotMainFocus(normalized);
  const frameIntent = normalized.frameIntent || inferShotFrameIntent(normalized);
  const openingFrame = normalized.openingFrame || inferShotOpeningFrame({ ...normalized, mainFocus });
  const closingFrame = normalized.closingFrame || inferShotClosingFrame(normalized);
  const continuityNote = normalized.continuityNote || inferShotContinuityNote({ ...normalized, mainFocus });
  const riskControl = normalized.riskControl || inferShotRiskControl({ ...normalized, openingFrame, closingFrame });
  return {
    ...bindingPatch,
    ...strategyPatch,
    negativePrompt,
    mainFocus,
    frameIntent,
    openingFrame,
    closingFrame,
    continuityNote,
    riskControl,
  };
}

function buildShotQualityReport(shot) {
  const normalized = normalizeShotRecord(shot);
  const refs = Array.isArray(normalized.assetRefs) ? normalized.assetRefs.filter(Boolean) : [];
  const imageSeed = buildShotBindingPromptSeed(normalized, "image");
  const videoSeed = buildShotBindingPromptSeed(normalized, "video");
  let score = 100;
  const issues = [];
  const warnings = [];
  if (!String(normalized.imagePrompt || "").trim() && !imageSeed) {
    score -= 18;
    issues.push("缺少图片提示词");
  }
  if (!String(normalized.videoPrompt || "").trim() && !videoSeed) {
    score -= 18;
    issues.push("缺少视频提示词");
  }
  if (!refs.length) {
    score -= 12;
    issues.push("没有资产引用");
  }
  if (!String(normalized.mainCharacterToken || "").trim()) {
    score -= 10;
    issues.push("没有绑定主角色");
  }
  if (!String(normalized.mainSceneToken || "").trim()) {
    score -= 8;
    warnings.push("没有绑定主场景");
  }
  if (!String(normalized.openingFrame || "").trim()) {
    score -= 8;
    warnings.push("缺少 opening frame");
  }
  if (!String(normalized.closingFrame || "").trim()) {
    score -= 8;
    warnings.push("缺少 closing frame");
  }
  if (!String(normalized.mainFocus || "").trim()) {
    score -= 7;
    warnings.push("主焦点不明确");
  }
  if (!String(normalized.continuityNote || "").trim()) {
    score -= 7;
    warnings.push("缺少连续性说明");
  }
  if (!String(normalized.riskControl || "").trim()) {
    score -= 7;
    warnings.push("缺少风险控制");
  }
  if ((normalized.imagePrompt || "").trim().length > 0 && (normalized.imagePrompt || "").trim().length < 24) {
    score -= 5;
    warnings.push("图片提示词过短");
  }
  if ((normalized.videoPrompt || "").trim().length > 0 && (normalized.videoPrompt || "").trim().length < 24) {
    score -= 5;
    warnings.push("视频提示词过短");
  }
  score = Math.max(0, Math.min(100, score));
  return {
    score,
    level: score >= 88 ? "稳" : score >= 72 ? "可用" : score >= 55 ? "偏弱" : "危险",
    issues,
    warnings,
    recommendedPatch: buildShotQualityPatch(normalized),
    summary: issues[0] || warnings[0] || "镜头质量稳定",
  };
}

function buildShotRiskProfile(shot) {
  const normalized = normalizeShotRecord(shot);
  const tokens = Array.isArray(normalized.assetRefs) ? normalized.assetRefs.filter(Boolean) : [];
  const actionText = String(normalized.action || "").trim();
  const cameraText = String(normalized.cameraMove || normalized.camera || "").trim();
  const openingFrame = String(normalized.openingFrame || "").trim();
  const closingFrame = String(normalized.closingFrame || "").trim();
  const promptImage = String(normalized.imagePrompt || "").trim();
  const promptVideo = String(normalized.videoPrompt || "").trim();
  const promptSeedText = `${promptImage} ${promptVideo}`.trim();
  const issues = [];
  const warnings = [];
  let score = 0;

  if (!String(normalized.mainCharacterToken || "").trim()) {
    score += 18;
    issues.push("未绑定主角色");
  }
  if (!String(normalized.mainSceneToken || "").trim()) {
    score += 14;
    issues.push("未绑定主场景");
  }
  if (!tokens.length) {
    score += 15;
    issues.push("没有资产引用");
  }
  if (!openingFrame) {
    score += 10;
    warnings.push("缺 opening frame");
  }
  if (!closingFrame) {
    score += 10;
    warnings.push("缺 closing frame");
  }
  if (!String(normalized.mainFocus || "").trim()) {
    score += 8;
    warnings.push("主焦点不明确");
  }
  if (!String(normalized.continuityNote || "").trim()) {
    score += 8;
    warnings.push("缺连续性说明");
  }
  if (!String(normalized.riskControl || "").trim()) {
    score += 8;
    warnings.push("缺风险控制");
  }
  if (!promptSeedText) {
    score += 12;
    issues.push("生成提示词还没补齐");
  } else if (promptSeedText.length < 36) {
    score += 7;
    warnings.push("提示词过短");
  }
  const actionSegments = actionText
    .split(/[，。,；;、\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (actionSegments.length >= 3) {
    score += 9;
    warnings.push("动作过多，建议拆镜");
  }
  if (!cameraText) {
    score += 5;
    warnings.push("镜头运动未定义");
  }
  const level = score >= 56 ? "高风险" : score >= 28 ? "中风险" : "低风险";
  const recommendation = level === "高风险"
    ? "先补绑定、补开收尾和风险控制，再生成。"
    : level === "中风险"
      ? "建议先跑一键修镜头或自动补骨架。"
      : "可以直接进入生成。";

  return {
    score,
    level,
    issues,
    warnings,
    recommendation,
    blockerCount: issues.length,
    warningCount: warnings.length,
    readyToGenerate: level === "低风险" || (issues.length === 0 && score < 36),
  };
}

function buildShotExecutionSummary(shot, qualityPatch, mode = "image") {
  const normalized = normalizeShotRecord(shot);
  const shotType = inferShotTemplateType(normalized);
  const route = buildShotTypeRouteSummary(normalized);
  const bindingSummary = dedupeOrderedStrings([
    normalized.mainCharacterToken ? `主角色：${normalized.mainCharacterToken}` : "",
    normalized.mainSceneToken ? `主场景：${normalized.mainSceneToken}` : "",
    normalized.keyPropTokens?.length ? `关键道具：${normalized.keyPropTokens.join("、")}` : "",
  ]).join(" · ");
  const lines = dedupeOrderedStrings([
    shotType ? `镜头类型：${shotType}` : "",
    route.focusRoute ? `类型路由：${route.focusRoute}` : "",
    bindingSummary ? `资产绑定：${bindingSummary}` : "",
    normalized.imageParamPreset ? `图片策略：${normalized.imageParamPreset}` : "",
    mode === "video" && normalized.videoParamPreset ? `视频策略：${normalized.videoParamPreset}` : "",
    qualityPatch.frameIntent ? `${mode === "video" ? "镜头意图" : "画面意图"}：${qualityPatch.frameIntent}` : "",
    qualityPatch.mainFocus ? `主焦点：${qualityPatch.mainFocus}` : "",
    qualityPatch.openingFrame ? `${mode === "video" ? "Opening Frame" : "定格要求"}：${qualityPatch.openingFrame}` : "",
    mode === "video" && qualityPatch.closingFrame ? `Closing Frame：${qualityPatch.closingFrame}` : "",
    qualityPatch.continuityNote ? `连续性：${qualityPatch.continuityNote}` : "",
    normalized.cameraMove ? `镜头运动：${normalized.cameraMove}` : "",
    normalized.duration ? `时长：${normalized.duration}` : "",
    mode === "image" && route.imageRoute ? `图片路由：${route.imageRoute}` : "",
    mode === "video" && route.videoRoute ? `视频路由：${route.videoRoute}` : "",
  ]);
  return lines.join("\n");
}

function buildShotPromptEnvelope(base, shot, qualityPatch, resourceIndex, mode = "image") {
  const normalized = normalizeShotRecord(shot);
  const parts = dedupeOrderedStrings([
    compactPromptText(base),
    buildShotExecutionSummary(normalized, qualityPatch, mode),
    mode === "image" ? buildImageParamSummary(normalized) : buildVideoParamSummary(normalized),
    normalized.referenceResources ? `参考资源：${expandResourceReferences(normalized.referenceResources, resourceIndex)}` : "",
    qualityPatch.riskControl ? `风险控制：${qualityPatch.riskControl}` : "",
    mode === "image" && (qualityPatch.negativePrompt || normalized.negativePrompt) ? `避免：${qualityPatch.negativePrompt || normalized.negativePrompt}` : "",
    mode === "video" ? `避免：${buildShotTypeNegativePrompt(normalized, "video")}` : "",
  ]);
  return compactPromptText(parts.join("\n"));
}

function buildShotBindingPromptSeed(shot, mode = "image") {
  const normalized = normalizeShotRecord(shot);
  const shotType = inferShotTemplateType(normalized);
  const route = buildShotTypeRouteSummary(normalized);
  const characterToken = normalized.mainCharacterToken || "";
  const sceneToken = normalized.mainSceneToken || "";
  const propTokens = Array.isArray(normalized.keyPropTokens) ? normalized.keyPropTokens.filter(Boolean) : [];
  const fallbackRefs = Array.isArray(normalized.assetRefs) ? normalized.assetRefs.filter(Boolean) : [];
  const refs = dedupeOrderedStrings([sceneToken, characterToken, ...propTokens, ...fallbackRefs]);
  const action = String(normalized.action || "").trim();
  const emotion = String(normalized.emotion || "").trim();
  const shotSize = String(normalized.shotSize || "").trim() || "中景";
  const cameraMove = String(normalized.cameraMove || normalized.camera || "").trim();
  const duration = String(normalized.duration || "").trim() || "4秒";
  const frameIntent = String(normalized.frameIntent || "").trim() || inferShotFrameIntent(normalized);
  const focus = String(normalized.mainFocus || "").trim() || inferShotMainFocus(normalized);
  const imageTypeDirective = {
    "建立镜头": "正向完整展示空间结构、主光方向与主体站位，让观众先认清地点与关系，避免人物表演过满。",
    "对话镜头": "优先保证对话关系、视线关系和说话节奏清楚，主体控制在一到两人，避免背景抢戏。",
    "动作镜头": "优先明确唯一主动作、受力方向和关键瞬间，不要出现多余肢体或并行动作。",
    "情绪特写": "优先锁定表情、眼神和微动作，镜头靠近主体，背景只做情绪陪衬。",
    "叙事推进镜头": "优先突出当前信息推进点，让观众马上看懂此刻发生了什么，避免无关视觉支线。",
  }[shotType] || "优先突出当前镜头唯一主焦点，避免信息分散。";
  const videoTypeDirective = {
    "建立镜头": "镜头节奏平稳，先建立空间再进入人物变化，禁止突然大幅运动。",
    "对话镜头": "动作克制，重点落在视线、说话节奏和微表情承接，避免镜头抢台词。",
    "动作镜头": "动作路径清楚，镜头服务动作，不做过量乱摇，只表现一段核心动作。",
    "情绪特写": "镜头运动尽量少，重点保住表情层次和情绪停顿，避免表情跳变。",
    "叙事推进镜头": "围绕单一信息点推进，动作和镜头变化都不要过量，结尾要能承接下一镜。",
  }[shotType] || "镜头变化保持克制，围绕单一信息点推进。";
  if (mode === "video") {
    return compactPromptText([
      refs.length ? `使用${refs.join("、")}建立同一镜头连续性。` : "",
      `镜头类型：${shotType}。`,
      sceneToken ? `${sceneToken}保持空间朝向稳定。` : "",
      characterToken ? `${characterToken}作为唯一主角色。` : "",
      propTokens.length ? `${propTokens.join("、")}作为关键道具必须稳定出现。` : "",
      action ? `主体动作：${action}。` : "主体动作保持单一、连续、可执行。",
      emotion ? `情绪反馈：${emotion}。` : "",
      cameraMove ? `镜头运动：${cameraMove}。` : "",
      `镜头意图：${frameIntent}。`,
      `主焦点：${focus}。`,
      `时长：${duration}。`,
      route.focusRoute ? `路由优先级：${route.focusRoute}。` : "",
      videoTypeDirective,
      "优先保持脸部、服装、空间结构和道具比例稳定。",
    ].join(""));
  }
  return compactPromptText([
    `镜头类型：${shotType}`,
    route.focusRoute ? `路由优先级：${route.focusRoute}` : "",
    refs.join("，"),
    action,
    shotSize,
    emotion,
    cameraMove,
    `画面意图：${frameIntent}`,
    `主焦点：${focus}`,
    imageTypeDirective,
    "商业级漫剧画面，主体单一，构图清晰，角色一致，空间稳定，禁止文字水印。",
  ].filter(Boolean).join("，"));
}

function buildImageShotPrompt(shot, assetIndex, resourceIndex) {
  const basePrompt = String(shot.imagePrompt || "").trim() || buildShotBindingPromptSeed(shot, "image");
  const { expandedPrompt } = preparePromptForNode(basePrompt, assetIndex, null, {
    modelPreset: shot.imageModelPreset || "",
    runtimeModel: shot.imageRuntimeModel || "",
    kind: "image",
  });
  const qualityPatch = buildShotQualityPatch(shot);
  const base = expandResourceReferences(expandedPrompt, resourceIndex);
  return buildShotPromptEnvelope(base, shot, qualityPatch, resourceIndex, "image");
}

function buildVideoShotPrompt(shot, assetIndex, resourceIndex) {
  const basePrompt = String(shot.videoPrompt || "").trim() || buildShotBindingPromptSeed(shot, "video");
  const { expandedPrompt } = preparePromptForNode(basePrompt, assetIndex, null, {
    modelPreset: shot.videoModelPreset || "通用视频模型",
    runtimeModel: shot.videoRuntimeModel || "",
    kind: "video",
  });
  const qualityPatch = buildShotQualityPatch(shot);
  const base = expandResourceReferences(expandedPrompt, resourceIndex);
  return buildShotPromptEnvelope(base, shot, qualityPatch, resourceIndex, "video");
}

function buildImageParamSummary(shot) {
  const parts = [
    shot.imageProviderMode === "custom" ? "图片调用：API" : shot.imageProviderMode === "comfy" ? "图片调用：ComfyUI" : "",
    shot.imageParamPreset ? `图片参数预设：${shot.imageParamPreset}` : "",
    shot.imageModelPreset ? `图片模型：${shot.imageModelPreset}` : "",
    shot.imageRuntimeModel ? `执行模型：${shot.imageRuntimeModel}` : "",
    shot.imageSize ? `尺寸：${shot.imageSize}` : "",
    shot.imageAspectRatio ? `画幅：${shot.imageAspectRatio}` : "",
    shot.imageQuality ? `质量：${shot.imageQuality}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "";
}

function buildVideoParamSummary(shot) {
  const parts = [
    shot.videoParamPreset ? `视频参数预设：${shot.videoParamPreset}` : "",
    shot.videoModelPreset ? `视频模型：${shot.videoModelPreset}` : "",
    shot.videoRuntimeModel ? `执行模型：${shot.videoRuntimeModel}` : "",
    shot.videoAspectRatio ? `画幅：${shot.videoAspectRatio}` : "",
    shot.motionStrength ? `运动强度：${shot.motionStrength}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "";
}

async function imageUrlToBlob(imageUrl) {
  if (imageUrl.startsWith("data:")) {
    const [meta, base64] = imageUrl.split(",");
    const mime = meta.match(/data:(.*?);base64/)?.[1] || "image/png";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`图片读取失败：HTTP ${response.status}`);
  return response.blob();
}

async function splitImageToFrames(imageUrl, rows, cols) {
  const { splitImageToFrames: splitImageToFramesImpl } = await loadBackendServiceHelpers();
  return splitImageToFramesImpl(imageUrl, rows, cols);
}

function makeCanvas(width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  draw(ctx, width, height);
  return canvas.toDataURL("image/png");
}

function makeGeneratedImage(prompt) {
  return makeCanvas(900, 580, (ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, "#0dd4c8");
    gradient.addColorStop(0.5, "#2367d8");
    gradient.addColorStop(1, "#10b981");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillRect(54, 54, w - 108, h - 108);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 42px sans-serif";
    ctx.fillText("AI 图片", 90, 130);
    ctx.font = "28px sans-serif";
    wrapText(ctx, prompt, 90, 190, w - 180, 40);
  });
}

function makeStoryboardImage(rows, cols, frames) {
  return makeCanvas(900, 900, (ctx, w, h) => {
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, w, h);
    const cellW = w / cols;
    const cellH = h / rows;
    frames.forEach((frame, index) => {
      const x = (index % cols) * cellW;
      const y = Math.floor(index / cols) * cellH;
      ctx.fillStyle = index % 2 ? "#1b1d22" : "#15171c";
      ctx.fillRect(x + 8, y + 8, cellW - 16, cellH - 16);
      ctx.strokeStyle = "#22d3ee";
      ctx.strokeRect(x + 8, y + 8, cellW - 16, cellH - 16);
      ctx.fillStyle = "#dbeafe";
      ctx.font = "bold 28px sans-serif";
      ctx.fillText(`分镜 ${index + 1}`, x + 34, y + 54);
      ctx.font = "22px sans-serif";
      wrapText(ctx, frame || "依据之前的内容进行推测", x + 34, y + 96, cellW - 68, 32);
    });
  });
}

function normalizeDirectorCamera(camera = {}) {
  return {
    yaw: typeof camera.yaw === "number" ? camera.yaw : 0,
    pitch: typeof camera.pitch === "number" ? camera.pitch : 12,
    zoom: typeof camera.zoom === "number" ? camera.zoom : 1,
  };
}

function normalizeMannequins(mannequins) {
  return mannequins.map(normalizeMannequin);
}

function normalizeMannequin(man) {
  const preset = POSE_PRESETS[man.pose] || POSE_PRESETS.stand;
  return {
    id: man.id,
    color: man.color || "#22d3ee",
    x: typeof man.x === "number" ? man.x : 0,
    z: typeof man.z === "number" ? man.z : 0,
    turn: typeof man.turn === "number" ? man.turn : 0,
    pose: man.pose || "stand",
    leftArm: typeof man.leftArm === "number" ? man.leftArm : preset.leftArm,
    rightArm: typeof man.rightArm === "number" ? man.rightArm : preset.rightArm,
    leftLeg: typeof man.leftLeg === "number" ? man.leftLeg : preset.leftLeg,
    rightLeg: typeof man.rightLeg === "number" ? man.rightLeg : preset.rightLeg,
    bodyLean: typeof man.bodyLean === "number" ? man.bodyLean : preset.bodyLean,
  };
}

function projectDirectorPoint(point, camera) {
  const yaw = ((camera.yaw || 0) * Math.PI) / 180;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const rx = point.x * cos - point.z * sin;
  const rz = point.x * sin + point.z * cos;
  const pitch = camera.pitch || 0;
  const zoom = camera.zoom || 1;
  return {
    left: clamp(50 + rx * 8.5 * zoom, 8, 92),
    top: clamp(52 + rz * 5.8 * zoom - pitch * 0.24, 18, 88),
    depth: rz,
    scale: clamp((1 + rz * 0.035) * zoom, 0.72, 1.22),
  };
}

function makeDirectorImage(mannequins, camera = { yaw: 0, pitch: 12, zoom: 1 }) {
  const normalized = normalizeMannequins(mannequins);
  return makeCanvas(1000, 620, (ctx, w, h) => {
    ctx.fillStyle = "#08090b";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,.14)";
    for (let i = 0; i < 18; i += 1) {
      const y = 300 + i * 20 - camera.pitch * 2;
      ctx.beginPath();
      ctx.moveTo(0, y + Math.sin((camera.yaw + i * 8) * Math.PI / 180) * 30);
      ctx.lineTo(w, y + i * 10 - Math.sin((camera.yaw + i * 8) * Math.PI / 180) * 30);
      ctx.stroke();
    }
    normalized
      .sort((a, b) => projectDirectorPoint(a, camera).depth - projectDirectorPoint(b, camera).depth)
      .forEach((man) => {
      const projected = projectDirectorPoint(man, camera);
      const x = (projected.left / 100) * w;
      const baseY = (projected.top / 100) * h + 90 * projected.scale;
      const scale = projected.scale;
      ctx.fillStyle = man.color;
      ctx.beginPath();
      ctx.arc(x, baseY - 170 * scale, 24 * scale, 0, Math.PI * 2);
      ctx.fill();
      drawLimb(ctx, x - 18 * scale, baseY - 130 * scale, 56 * scale, man.leftArm - 8, man.color, 10 * scale);
      drawLimb(ctx, x + 18 * scale, baseY - 130 * scale, 56 * scale, man.rightArm + 8, man.color, 10 * scale);
      ctx.save();
      ctx.translate(x, baseY - 112 * scale);
      ctx.rotate((man.bodyLean * Math.PI) / 180);
      ctx.fillRect(-20 * scale, 0, 40 * scale, 82 * scale);
      ctx.restore();
      drawLimb(ctx, x - 12 * scale, baseY - 32 * scale, 72 * scale, man.leftLeg, man.color, 9 * scale);
      drawLimb(ctx, x + 12 * scale, baseY - 32 * scale, 72 * scale, man.rightLeg, man.color, 9 * scale);
    });
  });
}

function makeDirectorDepthImage(mannequins, camera = { yaw: 0, pitch: 12, zoom: 1 }) {
  const normalized = normalizeMannequins(mannequins);
  return makeCanvas(1000, 620, (ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, "#050505");
    gradient.addColorStop(0.42, "#2c2c2c");
    gradient.addColorStop(1, "#777777");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 18; i += 1) {
      const y = 300 + i * 20 - camera.pitch * 2;
      const shade = Math.round(clamp(60 + i * 8, 40, 188));
      ctx.strokeStyle = `rgb(${shade}, ${shade}, ${shade})`;
      ctx.beginPath();
      ctx.moveTo(0, y + Math.sin((camera.yaw + i * 8) * Math.PI / 180) * 30);
      ctx.lineTo(w, y + i * 10 - Math.sin((camera.yaw + i * 8) * Math.PI / 180) * 30);
      ctx.stroke();
    }

    normalized
      .sort((a, b) => projectDirectorPoint(a, camera).depth - projectDirectorPoint(b, camera).depth)
      .forEach((man) => {
        const projected = projectDirectorPoint(man, camera);
        const joints = getDirectorPoseJoints(man, camera, w, h);
        const depthShade = Math.round(clamp(205 - (projected.depth + 4) * 20, 38, 230));
        ctx.fillStyle = `rgb(${depthShade}, ${depthShade}, ${depthShade})`;
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineCap = "round";
        ctx.lineWidth = 24 * projected.scale;
        drawDepthBone(ctx, joints.neck, joints.leftHand);
        drawDepthBone(ctx, joints.neck, joints.rightHand);
        drawDepthBone(ctx, joints.hip, joints.leftFoot);
        drawDepthBone(ctx, joints.hip, joints.rightFoot);
        ctx.lineWidth = 42 * projected.scale;
        drawDepthBone(ctx, joints.neck, joints.hip);
        ctx.beginPath();
        ctx.arc(joints.head.x, joints.head.y, 24 * projected.scale, 0, Math.PI * 2);
        ctx.fill();
      });
  });
}

function makeDirectorPoseImage(mannequins, camera = { yaw: 0, pitch: 12, zoom: 1 }) {
  const normalized = normalizeMannequins(mannequins);
  return makeCanvas(1000, 620, (ctx, w, h) => {
    ctx.fillStyle = "#030405";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(34, 211, 238, 0.16)";
    for (let i = 0; i < 16; i += 1) {
      const y = 320 + i * 18 - camera.pitch * 1.6;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y + i * 8);
      ctx.stroke();
    }

    normalized
      .sort((a, b) => projectDirectorPoint(a, camera).depth - projectDirectorPoint(b, camera).depth)
      .forEach((man) => {
        const projected = projectDirectorPoint(man, camera);
        const joints = getDirectorPoseJoints(man, camera, w, h);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = Math.max(5, 7 * projected.scale);
        ctx.strokeStyle = "#ecfeff";
        drawPoseBone(ctx, joints.head, joints.neck);
        drawPoseBone(ctx, joints.neck, joints.hip);
        drawPoseBone(ctx, joints.neck, joints.leftHand);
        drawPoseBone(ctx, joints.neck, joints.rightHand);
        drawPoseBone(ctx, joints.hip, joints.leftFoot);
        drawPoseBone(ctx, joints.hip, joints.rightFoot);

        ctx.fillStyle = man.color;
        Object.values(joints).forEach((joint) => {
          ctx.beginPath();
          ctx.arc(joint.x, joint.y, Math.max(6, 8 * projected.scale), 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.fillStyle = "#c8f7ff";
        ctx.font = `${Math.round(20 * projected.scale)}px sans-serif`;
        ctx.fillText(`#${man.id} ${POSE_PRESETS[man.pose]?.label || "站立"}`, joints.head.x + 18, joints.head.y - 8);
      });
  });
}

function getDirectorPoseJoints(man, camera, width, height) {
  const projected = projectDirectorPoint(man, camera);
  const x = (projected.left / 100) * width;
  const baseY = (projected.top / 100) * height + 90 * projected.scale;
  const scale = projected.scale;
  const lean = ((man.bodyLean || 0) * Math.PI) / 180;
  const shoulder = { x: x + Math.sin(lean) * 18 * scale, y: baseY - 126 * scale };
  const hip = { x: x + Math.sin(lean) * 32 * scale, y: baseY - 36 * scale };
  return {
    head: { x, y: baseY - 170 * scale },
    neck: shoulder,
    hip,
    leftHand: limbEnd(shoulder.x - 18 * scale, shoulder.y + 2 * scale, 64 * scale, man.leftArm - 8),
    rightHand: limbEnd(shoulder.x + 18 * scale, shoulder.y + 2 * scale, 64 * scale, man.rightArm + 8),
    leftFoot: limbEnd(hip.x - 12 * scale, hip.y, 78 * scale, man.leftLeg),
    rightFoot: limbEnd(hip.x + 12 * scale, hip.y, 78 * scale, man.rightLeg),
  };
}

function limbEnd(x, y, length, angle) {
  const radians = (angle * Math.PI) / 180;
  return { x: x + Math.sin(radians) * length, y: y + Math.cos(radians) * length };
}

function drawDepthBone(ctx, from, to) {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

function drawPoseBone(ctx, from, to) {
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}

function drawLimb(ctx, x, y, length, angle, color, width) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.fillStyle = color;
  ctx.fillRect(-width / 2, 0, width, length);
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const chars = Array.from(text);
  let line = "";
  chars.forEach((char) => {
    const test = line + char;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = char;
      y += lineHeight;
    } else {
      line = test;
    }
  });
  if (line) ctx.fillText(line, x, y);
}

createRoot(document.getElementById("root")).render(
  <UiErrorBoundary
    label="app-root"
    fallback={({ error, reset }) => (
      <AppErrorFallback error={error} onRetry={reset} />
    )}
  >
    <App />
  </UiErrorBoundary>
);
