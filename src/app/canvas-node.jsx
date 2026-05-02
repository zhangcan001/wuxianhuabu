import React, { Suspense } from "react";
import { AssetTokenInsertRow, Counter, NodeHeader } from "../canvas-shared.jsx";
import {
  LazyAssetLibraryNode,
  LazyDirectorNode,
  LazyGeminiWebNode,
  LazyImageEditNode,
  LazyNovelPipelineNode,
  LazyResultNode,
  LazyShotListNode,
  LazySplitNode,
  LazyStoryboardNode,
  LazyTextNode,
  LazyUploadNode,
  LazyVr360Node,
} from "./lazy-components.jsx";
import { NodeLoadingFallback } from "./ui-boundaries.jsx";
import { PROMPT_CHIPS } from "./ui-constants.js";

export function CanvasNode({
  node,
  isDragging,
  highlighted,
  allNodes,
  selectedNodeIds,
  marqueeMode,
  shiftPressedRef,
  updateNode,
  selectNode,
  setDrag,
  setResize,
  createOutputNear,
  createManyOutputs,
  deleteNode,
  duplicateNode,
  openNodeMenu,
  startConnection,
  finishConnection,
  pushHistory,
  settings,
  textApiSettings,
  patchTextApiSettings,
  openSettings,
  stylePresetCenter,
  onOpenStylePresetCenter,
  viewRef,
  assetIndex,
  resourceIndex,
  openPromptPreview,
  addGenerationJobs,
  importShotsToTimeline,
  syncPipelineToLinkedNodes,
  sendImageToLinkedNode,
  appendShotsToNearestShotList,
  applyResultToNearestShot,
  handleResultShotAction,
  createPromptNodeFromAsset,
  locateResultForShot,
  runtime = {},
}) {
  const {
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
  } = runtime;

  const heavyNodeHelpers = {
    NodeHeader,
    Counter: (props) => <Counter {...props} clamp={clamp} />,
    NOVEL_TEMPLATE_DEFAULT: ACTIVE_NOVEL_TEMPLATE_DEFAULT,
    NOVEL_REVIEW_TEMPLATE_DEFAULT: ACTIVE_NOVEL_REVIEW_TEMPLATE_DEFAULT,
    NOVEL_REVISION_TEMPLATE_DEFAULT,
    NOVEL_ASSET_TEMPLATE_DEFAULT: ACTIVE_NOVEL_ASSET_TEMPLATE_DEFAULT,
    NOVEL_PROMPT_TEMPLATE_DEFAULT: ACTIVE_NOVEL_PROMPT_TEMPLATE_DEFAULT,
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
    buildNovelPipeline: buildLocalNovelPipeline,
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
  };
  const basicNodeHelpers = {
    NodeHeader,
    AssetTokenInsertRow,
    PROMPT_CHIPS,
    providerLabel,
    normalizeUploadNodeData,
    normalizeImageEditNodeData,
    normalizeGeminiWebNodeData,
    normalizeTextNodeData,
    expandAssetReferences,
    collapsePromptVariantsForTool,
    preparePromptForNode,
    currentProviderMode,
    testComfyConnection,
    testImageGeneration,
    shortTitle,
    runImageGeneration,
    makeGeneratedImage,
    appendToken,
    clamp,
    isTauriRuntime,
    splitGeminiPrompts,
    readClipboardImageAsDataUrl,
    readImage,
    persistImportedImage,
    imageUrlToBlob,
    safeFileName,
  };
  function beginDrag(event) {
    if (marqueeMode || event.shiftKey || event.getModifierState?.("Shift") || shiftPressedRef.current) return;
    if (event.target.closest("button,input,textarea,label,canvas,.director-interactive,.asset-drawer,.node-resize")) return;
    event.stopPropagation();
    pushHistory();
    const selectedIds = node.selected ? selectedNodeIds : [node.id];
    if (!node.selected) selectNode(node.id);
    const view = viewRef.current;
    setDrag({
      id: node.id,
      ids: selectedIds,
      ox: node.x,
      oy: node.y,
      origins: Object.fromEntries(selectedIds.map((id) => {
        const target = allNodes.find((item) => item.id === id);
        return [id, { x: target?.x ?? node.x, y: target?.y ?? node.y }];
      })),
      dx: event.clientX - (node.x * view.scale + view.x),
      dy: event.clientY - (node.y * view.scale + view.y),
    });
  }
  function beginResize(event) {
    if (event.button !== 0) return;
    event.stopPropagation();
    pushHistory();
    selectNode(node.id);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setResize({
      id: node.id,
      type: node.type,
      sx: event.clientX,
      sy: event.clientY,
      ow: node.width,
      oh: node.height,
    });
  }

  return (
    <article
      data-node-id={node.id}
      className={`node node-${node.type} ${node.selected ? "selected" : ""} ${isDragging ? "dragging" : ""} ${node.data.isGenerating ? "is-generating" : ""} ${highlighted ? "highlighted" : ""}`}
      style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
      onPointerDown={beginDrag}
      onContextMenu={(event) => openNodeMenu(node.id, event)}
    >
      <div className="node-tools">
        <button title="复制节点" onClick={() => duplicateNode(node.id)}>⧉</button>
        <button title="删除节点" onClick={() => deleteNode(node.id)}>×</button>
      </div>
      <span
        className="handle handle-in"
        onPointerUp={(event) => {
          event.stopPropagation();
          finishConnection(node.id);
        }}
      />
      <span
        className="handle handle-out"
        onPointerDown={(event) => startConnection(node.id, event)}
      />
      {node.type === "upload" && (
        <Suspense fallback={<NodeLoadingFallback label="上传节点载入中" />}>
          <LazyUploadNode node={node} updateNode={updateNode} onSendToLinkedNode={sendImageToLinkedNode} helpers={basicNodeHelpers} />
        </Suspense>
      )}
      {node.type === "imageEdit" && (
        <Suspense fallback={<NodeLoadingFallback label="AI生图节点载入中" />}>
          <LazyImageEditNode node={node} updateNode={updateNode} createOutputNear={createOutputNear} settings={settings} assetIndex={assetIndex} openPromptPreview={openPromptPreview} helpers={basicNodeHelpers} />
        </Suspense>
      )}
      {node.type === "geminiWeb" && (
        <Suspense fallback={<NodeLoadingFallback label="Gemini节点载入中" />}>
          <LazyGeminiWebNode node={node} updateNode={updateNode} createOutputNear={createOutputNear} assetIndex={assetIndex} openPromptPreview={openPromptPreview} helpers={basicNodeHelpers} />
        </Suspense>
      )}
      {node.type === "novelPipeline" && (
        <Suspense fallback={<NodeLoadingFallback label="小说工厂载入中" />}>
          <LazyNovelPipelineNode node={node} updateNode={updateNode} createOutputNear={createOutputNear} onSyncOutputs={syncPipelineToLinkedNodes} textApiSettings={textApiSettings} patchTextApiSettings={patchTextApiSettings} openSettings={openSettings} stylePresetCenter={stylePresetCenter} onOpenStylePresetCenter={onOpenStylePresetCenter} helpers={heavyNodeHelpers} />
        </Suspense>
      )}
      {node.type === "assetLibrary" && (
        <Suspense fallback={<NodeLoadingFallback label="资产库载入中" />}>
          <LazyAssetLibraryNode
            node={node}
            updateNode={updateNode}
            onCreatePromptNode={createPromptNodeFromAsset}
            assetIndex={assetIndex}
            resourceIndex={resourceIndex}
            helpers={{
              NodeHeader,
              AssetTokenInsertRow,
              assetListByTab,
              normalizeAsset,
              assetCategoryByTab,
              makeAssetToken,
              appendToken,
              addUniqueImage,
              readImage,
              persistImportedImage,
            }}
          />
        </Suspense>
      )}
      {node.type === "shotList" && (
        <Suspense fallback={<NodeLoadingFallback label="镜头表载入中" />}>
          <LazyShotListNode
            node={node}
            updateNode={updateNode}
            createOutputNear={createOutputNear}
            onSyncToTimeline={importShotsToTimeline}
            onLocateResultForShot={locateResultForShot}
            assetIndex={assetIndex}
            resourceIndex={resourceIndex}
            openPromptPreview={openPromptPreview}
            addGenerationJobs={(jobs) => addGenerationJobs(jobs)}
            helpers={{
              NodeHeader,
              AssetTokenInsertRow,
              normalizeShotRecord,
              buildShotQualityPatch,
              buildShotQualityReport,
              buildShotRiskProfile,
              buildShotTypeRouteSummary,
              suggestShotAssetBindingPatch,
              formatShotListMarkdown,
              buildImageShotPrompt,
              buildVideoShotPrompt,
              appendToken,
              currentProviderMode,
              settings,
              SHOT_STATUS_OPTIONS,
              REVIEW_STATUS_OPTIONS,
            }}
          />
        </Suspense>
      )}
      {node.type === "text" && (
        <Suspense fallback={<NodeLoadingFallback label="文本节点载入中" />}>
          <LazyTextNode node={node} updateNode={updateNode} helpers={basicNodeHelpers} />
        </Suspense>
      )}
      {node.type === "storyboard" && (
        <Suspense fallback={<NodeLoadingFallback label="分镜节点载入中" />}>
          <LazyStoryboardNode node={node} updateNode={updateNode} createOutputNear={createOutputNear} settings={settings} assetIndex={assetIndex} openPromptPreview={openPromptPreview} helpers={heavyNodeHelpers} />
        </Suspense>
      )}
      {node.type === "split" && (
        <Suspense fallback={<NodeLoadingFallback label="拆分节点载入中" />}>
          <LazySplitNode node={node} updateNode={updateNode} createManyOutputs={createManyOutputs} onCreateShotDrafts={appendShotsToNearestShotList} helpers={heavyNodeHelpers} />
        </Suspense>
      )}
      {node.type === "vr360" && (
        <Suspense fallback={<NodeLoadingFallback label="VR360 节点载入中" />}>
          <LazyVr360Node node={node} updateNode={updateNode} createOutputNear={createOutputNear} onSendToLinkedNode={sendImageToLinkedNode} helpers={heavyNodeHelpers} />
        </Suspense>
      )}
      {node.type === "director3d" && (
        <Suspense fallback={<NodeLoadingFallback label="3D导演台载入中" />}>
          <LazyDirectorNode
            node={node}
            updateNode={updateNode}
            createOutputNear={createOutputNear}
            helpers={{
              NodeHeader,
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
              clamp,
            }}
          />
        </Suspense>
      )}
      {node.type === "result" && (
        <Suspense fallback={<NodeLoadingFallback label="结果节点载入中" />}>
          <LazyResultNode node={node} createOutputNear={createOutputNear} onSendToLinkedNode={sendImageToLinkedNode} onApplyToNearestShot={applyResultToNearestShot} onHandleShotAction={handleResultShotAction} helpers={basicNodeHelpers} />
        </Suspense>
      )}
      <span className="node-resize" title="拖动缩放节点" onPointerDown={beginResize} />
    </article>
  );
}
