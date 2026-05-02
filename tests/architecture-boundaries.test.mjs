import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const root = process.cwd();

test("core production OS stays free of UI and runtime dependencies", () => {
  const offenders = listSourceFiles(join(root, "src", "core"))
    .filter((file) => {
      const content = readFileSync(file, "utf8");
      return /from\s+["']react["']|@tauri-apps|localStorage|document\.|window\./.test(content);
    })
    .map((file) => relative(root, file));

  assert.deepEqual(offenders, []);
});

test("new application services use project-production adapter path instead of legacy canvas adapter", () => {
  const offenders = listSourceFiles(join(root, "src", "application"))
    .filter((file) => readFileSync(file, "utf8").includes("adapters/legacy-canvas/commercial-production-adapter"))
    .map((file) => relative(root, file));

  assert.deepEqual(offenders, []);
});

test("product studio panels do not import legacy canvas adapters directly", () => {
  const offenders = listSourceFiles(join(root, "src", "product", "studio"))
    .filter((file) => readFileSync(file, "utf8").includes("adapters/legacy-canvas"))
    .map((file) => relative(root, file));

  assert.deepEqual(offenders, []);
});

test("project store depends on semantic project model modules", () => {
  const content = readFileSync(join(root, "src", "app", "project-store.js"), "utf8");

  assert.match(content, /project-task-model/);
  assert.match(content, /project-asset-model/);
  assert.match(content, /project-shot-model/);
  assert.match(content, /project-review-model/);
  assert.match(content, /project-timeline-model/);
});

test("project shell imports split studio panel entry points", () => {
  const content = readFileSync(join(root, "src", "product", "studio", "project-shell.jsx"), "utf8");

  assert.match(content, /asset-library-panel\.jsx/);
  assert.match(content, /delivery-panel\.jsx/);
  assert.match(content, /media-production-panel\.jsx/);
  assert.match(content, /review-panel\.jsx/);
  assert.match(content, /shot-table-panel\.jsx/);
  assert.match(content, /timeline-panel\.jsx/);
  assert.match(content, /activeViewRequest/);
});

test("main app lazy-loads the production studio shell", () => {
  const content = readFileSync(join(root, "src", "main.jsx"), "utf8");
  const lazyComponents = readFileSync(join(root, "src", "app", "lazy-components.jsx"), "utf8");

  assert.doesNotMatch(content, /import\s+\{\s*ProjectStudio\s*\}\s+from\s+["']\.\/project-studio\.jsx["']/);
  assert.match(content, /LazyProjectStudio/);
  assert.match(lazyComponents, /LazyProjectStudio/);
  assert.match(lazyComponents, /import\(["']\.\.\/project-studio\.jsx["']\)/);
});

test("main app delegates reusable UI boundaries to app module", () => {
  const content = readFileSync(join(root, "src", "main.jsx"), "utf8");
  const boundaries = readFileSync(join(root, "src", "app", "ui-boundaries.jsx"), "utf8");

  assert.match(content, /ui-boundaries\.jsx/);
  assert.doesNotMatch(content, /function PanelErrorFallback/);
  assert.doesNotMatch(content, /function GuardedPanel/);
  assert.doesNotMatch(content, /function NodeLoadingFallback/);
  assert.match(boundaries, /export function GuardedPanel/);
  assert.match(boundaries, /export function GuardedNode/);
  assert.match(boundaries, /export function PanelLoadingFallback/);
});

test("main app keeps legacy canvas behind compatibility mode", () => {
  const content = readFileSync(join(root, "src", "main.jsx"), "utf8");
  const workspaceNavigation = readFileSync(join(root, "src", "app", "workspace-navigation.js"), "utf8");
  const legacyCanvasShell = readFileSync(join(root, "src", "app", "legacy-canvas-shell.jsx"), "utf8");
  const legacyCanvasBanner = readFileSync(join(root, "src", "app", "legacy-canvas-banner.jsx"), "utf8");
  const lazyComponents = readFileSync(join(root, "src", "app", "lazy-components.jsx"), "utf8");
  const canvasNode = readFileSync(join(root, "src", "app", "canvas-node.jsx"), "utf8");
  const panelPropBuilders = readFileSync(join(root, "src", "app", "panel-prop-builders.js"), "utf8");

  assert.match(content, /showCompatibilityCanvas/);
  assert.match(legacyCanvasBanner, /compat-canvas-banner/);
  assert.match(legacyCanvasShell, /export function LegacyCanvasOverlay/);
  assert.match(legacyCanvasShell, /<svg className="edge-layer"/);
  assert.match(content, /onDoubleClick=\{showCompatibilityCanvas \? handleStageDoubleClick : undefined\}/);
  assert.match(content, /<LazyLegacyCanvasOverlay/);
  assert.match(lazyComponents, /LazyLegacyCanvasOverlay/);
  assert.match(canvasNode, /export function CanvasNode/);
  assert.match(canvasNode, /LazyShotListNode/);
  assert.match(content, /\{showCompatibilityCanvas && performanceSettings\.showMinimap && \(/);
  assert.match(content, /function openProductionStudio/);
  assert.match(content, /function openProductionStudioView/);
  assert.match(content, /function openNodeTargetInProductionStudio/);
  assert.match(content, /buildProjectStudioProps/);
  assert.match(panelPropBuilders, /activeViewRequest:\s*input\.studioViewRequest/);
  assert.match(content, /workspace-navigation\.js/);
  assert.match(content, /legacy-canvas-banner\.jsx/);
  assert.match(content, /panorama-runtime\.js/);
  assert.match(workspaceNavigation, /openAdvancedCanvasNavigation/);
  assert.match(workspaceNavigation, /openProductionStudioViewNavigation/);
  assert.match(workspaceNavigation, /openSettingsPanelNavigation/);
  assert.match(workspaceNavigation, /openWorkflowActionNavigation/);
  assert.match(workspaceNavigation, /focusMainChainNavigation/);
  assert.match(workspaceNavigation, /setShowCompatibilityCanvas\?\.\(false\)/);
  assert.doesNotMatch(content, /if \(actionKey === "review"\)/);
  assert.doesNotMatch(content, /if \(actionKey === "queue"\)/);
  assert.doesNotMatch(content, /setShowDashboard\(false\);\s*setShowHealth\(false\);/);
  assert.doesNotMatch(content, /setSettingsFocus\(focus\);\s*refreshGlobalApiConfigs\(\);/);
  assert.doesNotMatch(content, /function CanvasNode/);
  assert.doesNotMatch(content, /nodeComponent=\{CanvasNode\}/);
  assert.doesNotMatch(content, /let threeModulePromise/);
});

test("timeline panel is a real split panel and no longer re-exports production-panels", () => {
  const content = readFileSync(join(root, "src", "product", "studio", "timeline-panel.jsx"), "utf8");

  assert.doesNotMatch(content, /production-panels\.jsx/);
  assert.match(content, /export function TimelinePanel/);
});

test("review panel is a real split panel and no longer re-exports production-panels", () => {
  const content = readFileSync(join(root, "src", "product", "studio", "review-panel.jsx"), "utf8");

  assert.doesNotMatch(content, /production-panels\.jsx/);
  assert.match(content, /export function ReviewPanel/);
});

test("delivery panel is a real split panel and no longer re-exports production-panels", () => {
  const content = readFileSync(join(root, "src", "product", "studio", "delivery-panel.jsx"), "utf8");

  assert.doesNotMatch(content, /production-panels\.jsx/);
  assert.match(content, /export function DeliveryPanel/);
});

test("media production panel is a real split panel and uses shared primitives", () => {
  const content = readFileSync(join(root, "src", "product", "studio", "media-production-panel.jsx"), "utf8");

  assert.doesNotMatch(content, /production-panels\.jsx/);
  assert.match(content, /studio-panel-primitives\.jsx/);
  assert.match(content, /export function MediaProductionPanel/);
});

test("shot table panel is a real split panel and uses shared primitives", () => {
  const content = readFileSync(join(root, "src", "product", "studio", "shot-table-panel.jsx"), "utf8");

  assert.doesNotMatch(content, /production-panels\.jsx/);
  assert.match(content, /studio-panel-primitives\.jsx/);
  assert.match(content, /export function ShotTablePanel/);
});

test("asset library panel is a real split panel and uses shared primitives", () => {
  const content = readFileSync(join(root, "src", "product", "studio", "asset-library-panel.jsx"), "utf8");

  assert.doesNotMatch(content, /production-panels\.jsx/);
  assert.match(content, /studio-panel-primitives\.jsx/);
  assert.match(content, /export function AssetLibraryPanel/);
});

test("main app uses project repository for project persistence", () => {
  const content = readFileSync(join(root, "src", "main.jsx"), "utf8");
  const runtimeRepository = readFileSync(join(root, "src", "app", "project-runtime-repository.js"), "utf8");
  const persistenceHook = readFileSync(join(root, "src", "app", "use-project-persistence-effects.js"), "utf8");
  const restoreHook = readFileSync(join(root, "src", "app", "use-project-runtime-cache-restore.js"), "utf8");
  const storeHydrationHook = readFileSync(join(root, "src", "app", "use-project-store-hydration.js"), "utf8");
  const timelineProgressHook = readFileSync(join(root, "src", "app", "use-timeline-render-progress-listener.js"), "utf8");
  const debugTraceHook = readFileSync(join(root, "src", "app", "use-debug-trace-state.js"), "utf8");
  const runtimeIndexHook = readFileSync(join(root, "src", "app", "use-project-runtime-index-effects.js"), "utf8");
  const apiConfigHook = readFileSync(join(root, "src", "app", "use-global-api-config-state.js"), "utf8");
  const assetLibraryHook = readFileSync(join(root, "src", "app", "use-asset-library-effects.js"), "utf8");
  const keyboardHook = readFileSync(join(root, "src", "app", "use-canvas-keyboard-shortcuts.js"), "utf8");
  const timeoutCleanupHook = readFileSync(join(root, "src", "app", "use-timeout-ref-cleanup.js"), "utf8");

  assert.match(content, /createRuntimeProjectRepository/);
  assert.match(content, /useProjectRuntimeCacheRestore/);
  assert.match(content, /full-chain-check-action\.js/);
  assert.match(content, /system-self-check-action\.js/);
  assert.match(content, /production-media-queue-actions\.js/);
  assert.match(content, /panel-prop-builders\.js/);
  assert.match(content, /api-workspace-library\.js/);
  assert.match(content, /file-name-helpers\.js/);
  assert.match(content, /canvas-viewport-helpers\.js/);
  assert.match(content, /canvas-performance-helpers\.js/);
  assert.match(content, /project-search-helpers\.js/);
  assert.match(content, /project-shell-state-helpers\.js/);
  assert.match(content, /preset-center-helpers\.js/);
  assert.match(content, /prompt-factory-state-helpers\.js/);
  assert.match(content, /template-center-state-helpers\.js/);
  assert.match(content, /production-assist-helpers\.js/);
  assert.match(content, /text-format-helpers\.js/);
  assert.match(content, /saveProjectAction/);
  assert.match(content, /openProjectFileAction/);
  assert.match(content, /openRecentProjectAction/);
  assert.match(content, /importProjectContentAction/);
  assert.match(runtimeRepository, /createProjectRepository/);
  assert.match(persistenceHook, /cacheProjectWithFallback/);
  assert.match(restoreHook, /loadProjectCacheThroughRuntime/);
  assert.match(restoreHook, /projectRepository\.load/);
  assert.match(storeHydrationHook, /source: "legacy"/);
  assert.match(timelineProgressHook, /handleTimelineRenderEvent/);
  assert.match(debugTraceHook, /saveDebugTraceEnabled/);
  assert.match(debugTraceHook, /DEBUG_TRACE_EVENT/);
  assert.match(runtimeIndexHook, /buildProjectIndexPayload/);
  assert.match(runtimeIndexHook, /syncProjectIndexToSqliteAction/);
  assert.match(apiConfigHook, /loadBackendAiConfig/);
  assert.match(apiConfigHook, /loadNovelApiSettingsFromBackend/);
  assert.match(assetLibraryHook, /persistAssetLibrary/);
  assert.match(assetLibraryHook, /syncGeneratedImagesIntoAssets/);
  assert.match(keyboardHook, /addEventListener\("keydown"/);
  assert.match(keyboardHook, /duplicateNodes/);
  assert.match(timeoutCleanupHook, /clearTimeout/);
});

test("main app delegates queue and project path state to app hooks", () => {
  const content = readFileSync(join(root, "src", "main.jsx"), "utf8");

  assert.match(content, /useGenerationQueueState/);
  assert.match(content, /useProjectPathState/);
  assert.match(content, /useProjectPersistenceEffects/);
  assert.match(content, /useProjectRuntimeIndexEffects/);
  assert.match(content, /useGlobalApiConfigState/);
  assert.match(content, /useTimelineRenderProgressListener/);
  assert.match(content, /useStartupProjectGuide/);
  assert.match(content, /useProjectStoreHydration/);
  assert.match(content, /useDebugTraceState/);
  assert.match(content, /useAssetLibraryEffects/);
  assert.match(content, /useCanvasKeyboardShortcuts/);
  assert.match(content, /useTimeoutRefCleanup/);
  assert.match(content, /useLatestRef/);
  assert.doesNotMatch(content, /useState\(\s*initialProject\.generationQueue/);
  assert.doesNotMatch(content, /persistProjectPath\(localStorage,\s*PROJECT_PATH_KEY/);
  assert.doesNotMatch(content, /cacheProjectWithFallback/);
  assert.doesNotMatch(content, /setAutoSaveState\("待自动保存"\)/);
  assert.doesNotMatch(content, /loadProjectCacheThroughRuntime/);
  assert.doesNotMatch(content, /Failed to restore runtime project cache/);
  assert.doesNotMatch(content, /handleTimelineRenderEvent/);
  assert.doesNotMatch(content, /nodesRef\.current\s*=\s*nodes/);
  assert.doesNotMatch(content, /timelineRef\.current\s*=\s*timeline/);
  assert.doesNotMatch(content, /resourcesRef\.current\s*=\s*resources/);
  assert.doesNotMatch(content, /startupGuideShownRef/);
  assert.doesNotMatch(content, /已打开项目生产工作台，按顺序从小说生成到视频。/);
  assert.doesNotMatch(content, /projectStoreReducer\(current/);
  assert.doesNotMatch(content, /source: "legacy"/);
  assert.doesNotMatch(content, /saveDebugTraceEnabled/);
  assert.doesNotMatch(content, /DEBUG_TRACE_EVENT/);
  assert.doesNotMatch(content, /getDebugTraceEntries/);
  assert.doesNotMatch(content, /refreshMediaCacheIndexAction/);
  assert.doesNotMatch(content, /refreshProjectIndexSummaryAction/);
  assert.doesNotMatch(content, /syncProjectIndexToSqliteAction/);
  assert.doesNotMatch(content, /Project SQLite index sync failed/);
  assert.doesNotMatch(content, /PROJECT_INDEX_WRITE_DELAY_MS/);
  assert.doesNotMatch(content, /useState\(\(\) => loadApiWorkspaceLibrary\(\)\)/);
  assert.doesNotMatch(content, /Promise\.all\(\[\s*loadBackendAiConfig\(\),\s*loadNovelApiSettingsFromBackend\(\),/s);
  assert.doesNotMatch(content, /function persistAssetLibrary/);
  assert.doesNotMatch(content, /persistAssetLibrary\(assetIndex/);
  assert.doesNotMatch(content, /function normalizeApiWorkspaceLibrary/);
  assert.doesNotMatch(content, /function loadApiWorkspaceLibrary/);
  assert.doesNotMatch(content, /API_WORKSPACE_LIBRARY_KEY/);
  assert.doesNotMatch(content, /function safeFileName/);
  assert.doesNotMatch(content, /function shortPath/);
  assert.doesNotMatch(content, /function screenToWorld/);
  assert.doesNotMatch(content, /function worldToScreen/);
  assert.doesNotMatch(content, /function isCanvasZoomTarget/);
  assert.doesNotMatch(content, /function previewEdgePath/);
  assert.doesNotMatch(content, /function resolvePerformanceProfile/);
  assert.doesNotMatch(content, /function getNodeBounds/);
  assert.doesNotMatch(content, /function filterNodesInViewport/);
  assert.doesNotMatch(content, /function buildSearchEntries/);
  assert.doesNotMatch(content, /function nodeTypeLabel/);
  assert.doesNotMatch(content, /function searchNodeSubtitle/);
  assert.doesNotMatch(content, /function summarizeText/);
  assert.doesNotMatch(content, /function shortTitle/);
  assert.doesNotMatch(content, /function appendToken/);
  assert.doesNotMatch(content, /function splitGeminiPrompts/);
  assert.doesNotMatch(content, /function buildStoryboardPrompt/);
  assert.doesNotMatch(content, /function dedupeOrderedStrings/);
  assert.doesNotMatch(content, /function compactPromptText/);
  assert.doesNotMatch(content, /function escapeRegExp/);
  assert.doesNotMatch(content, /const DEFAULT_COLLABORATORS/);
  assert.doesNotMatch(content, /function defaultCollaborationState/);
  assert.doesNotMatch(content, /function normalizeCollaborationState/);
  assert.doesNotMatch(content, /function defaultArchiveState/);
  assert.doesNotMatch(content, /function normalizeArchiveState/);
  assert.doesNotMatch(content, /function defaultPerformanceSettings/);
  assert.doesNotMatch(content, /function normalizePerformanceSettings/);
  assert.doesNotMatch(content, /const STYLE_PRESET_LIBRARY/);
  assert.doesNotMatch(content, /const MODEL_PARAM_PRESET_LIBRARY/);
  assert.doesNotMatch(content, /const EXPORT_PRESET_LIBRARY/);
  assert.doesNotMatch(content, /function normalizeStylePresetDefinition/);
  assert.doesNotMatch(content, /function defaultStylePresetCenterState/);
  assert.doesNotMatch(content, /function normalizeStylePresetCenterState/);
  assert.doesNotMatch(content, /function normalizeModelParamPresetDefinition/);
  assert.doesNotMatch(content, /function defaultModelParamCenterState/);
  assert.doesNotMatch(content, /function normalizeModelParamCenterState/);
  assert.doesNotMatch(content, /function normalizeExportPresetDefinition/);
  assert.doesNotMatch(content, /function defaultExportPresetCenterState/);
  assert.doesNotMatch(content, /function normalizeExportPresetCenterState/);
  assert.doesNotMatch(content, /function buildModelParamPresetOptions/);
  assert.doesNotMatch(content, /function buildStylePresetRequestMeta/);
  assert.doesNotMatch(content, /COMMERCIAL_PROMPT_TEMPLATE_LIBRARY/);
  assert.doesNotMatch(content, /const PROMPT_TEMPLATE_LIBRARY/);
  assert.doesNotMatch(content, /const PROMPT_STYLE_PRESETS/);
  assert.doesNotMatch(content, /function defaultPromptFactoryState/);
  assert.doesNotMatch(content, /function normalizePromptFactoryState/);
  assert.doesNotMatch(content, /function promptFactoryForStorage/);
  assert.doesNotMatch(content, /const TEMPLATE_CATEGORY_OPTIONS/);
  assert.doesNotMatch(content, /function defaultTemplateCenterState/);
  assert.doesNotMatch(content, /function normalizeTemplateCenterState/);
  assert.doesNotMatch(content, /function templateCenterForStorage/);
  assert.doesNotMatch(content, /function templateCategoryLabel/);
  assert.doesNotMatch(content, /runMiniProductionE2E/);
  assert.doesNotMatch(content, /系统自检通过：最小生产链路可跑通。/);
  assert.doesNotMatch(content, /reviewer: "chain-check"/);
  assert.doesNotMatch(content, /全链路验证完成：还有/);
  assert.doesNotMatch(content, /Production OS 已加入图片队列/);
  assert.doesNotMatch(content, /Production OS 已加入视频队列/);
  assert.doesNotMatch(content, /businessModel=\{commercialProject\}/);
  assert.doesNotMatch(content, /<div className="compat-canvas-banner">/);
  assert.doesNotMatch(content, /<svg className="edge-layer"/);
  assert.doesNotMatch(content, /function buildDirectorImageSuggestion/);
  assert.doesNotMatch(content, /function buildDirectorVideoSuggestion/);
  assert.doesNotMatch(content, /function suggestCameraMove/);
  assert.doesNotMatch(content, /function suggestShotAction/);
  assert.doesNotMatch(content, /function inferTimelineBackfillShotStatus/);
  assert.doesNotMatch(content, /function inferTimelineBackfillReviewStatus/);
  assert.doesNotMatch(content, /function buildTimelineBackfillPatch/);
  assert.doesNotMatch(content, /function computeTimelineBackfillDiff/);
  assert.doesNotMatch(content, /useEffect/);
  assert.doesNotMatch(content, /addEventListener\("keydown"/);
  assert.doesNotMatch(content, /removeEventListener\("keydown"/);
});

test("main app stays under the current responsibility budget", () => {
  const content = readFileSync(join(root, "src", "main.jsx"), "utf8");
  const lines = content.split(/\r?\n/).length;

  assert.ok(lines <= 11500, `src/main.jsx has ${lines} lines; extract more app actions before adding new responsibilities`);
});

test("app action modules stay free of React and Tauri runtime imports", () => {
  const offenders = listSourceFiles(join(root, "src", "app"))
    .filter((file) => /(?:actions|runner|runtime|compatibility|service)\.(?:js|jsx|mjs)$/.test(file))
    .filter((file) => {
      const content = readFileSync(file, "utf8");
      return /from\s+["']react["']|@tauri-apps|document\.|window\./.test(content);
    })
    .map((file) => relative(root, file));

  assert.deepEqual(offenders, []);
});

test("new app orchestration modules own extracted main responsibilities", () => {
  const expected = [
    "project-queue-runner.js",
    "project-delivery-actions.js",
    "project-media-upload-actions.js",
    "project-canvas-compatibility.js",
    "project-repair-actions.js",
    "project-health-repair-actions.js",
    "project-health-fix-runner.js",
    "project-media-cache-actions.js",
    "project-index-actions.js",
    "use-project-runtime-index-effects.js",
    "use-global-api-config-state.js",
    "use-asset-library-effects.js",
    "use-canvas-keyboard-shortcuts.js",
    "use-timeout-ref-cleanup.js",
    "project-export-actions.js",
    "full-chain-check-action.js",
    "system-self-check-action.js",
    "production-media-queue-actions.js",
    "panel-prop-builders.js",
    "legacy-canvas-banner.jsx",
    "legacy-canvas-shell.jsx",
    "canvas-node.jsx",
    "panorama-runtime.js",
    "health-fix-prompts.js",
    "media-provider-runtime.js",
  ];
  const appFiles = new Set(listSourceFiles(join(root, "src", "app")).map((file) => relative(join(root, "src", "app"), file)));

  expected.forEach((file) => assert.equal(appFiles.has(file), true, `${file} should exist`));
});

function listSourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) return listSourceFiles(path);
    return /\.(js|jsx|mjs)$/.test(name) ? [path] : [];
  });
}
