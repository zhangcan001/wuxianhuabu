import React, { lazy } from "react";

function lazyNamed(loader, name) {
  return lazy(async () => {
    const mod = await loader();
    return { default: mod[name] };
  });
}

export class UiErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[UI Error Boundary]", this.props.label || "unknown", error, info);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return this.props.fallback({
        error: this.state.error,
        reset: this.reset,
      });
    }
    return this.props.children;
  }
}

export const LazyProjectDashboardPanel = lazyNamed(() => import("../lazy-panels.jsx"), "ProjectDashboardPanel");
export const LazyProjectStudio = lazyNamed(() => import("../project-studio.jsx"), "ProjectStudio");
export const LazyLegacyCanvasOverlay = lazyNamed(() => import("./legacy-canvas-shell.jsx"), "LegacyCanvasOverlay");
export const LazySimpleWorkflowPanel = lazyNamed(() => import("../lazy-panels.jsx"), "SimpleWorkflowPanel");
export const LazyGenerationQueuePanel = lazyNamed(() => import("../lazy-panels.jsx"), "GenerationQueuePanel");
export const LazyTimelinePanel = lazyNamed(() => import("../lazy-panels.jsx"), "TimelinePanel");
export const LazyProjectHealthPanel = lazyNamed(() => import("../lazy-panels.jsx"), "ProjectHealthPanel");
export const LazyProductionHubPanel = lazyNamed(() => import("../lazy-panels.jsx"), "ProductionHubPanel");
export const LazyArchiveCenterPanel = lazyNamed(() => import("../lazy-panels.jsx"), "ArchiveCenterPanel");
export const LazyExportCenterPanel = lazyNamed(() => import("../lazy-panels.jsx"), "ExportCenterPanel");
export const LazyPromptFactoryPanel = lazyNamed(() => import("../management-panels.jsx"), "PromptFactoryPanel");
export const LazyTemplateCenterPanel = lazyNamed(() => import("../management-panels.jsx"), "TemplateCenterPanel");
export const LazyStylePresetCenterPanel = lazyNamed(() => import("../management-panels.jsx"), "StylePresetCenterPanel");
export const LazyModelParamCenterPanel = lazyNamed(() => import("../management-panels.jsx"), "ModelParamCenterPanel");
export const LazyExportPresetCenterPanel = lazyNamed(() => import("../management-panels.jsx"), "ExportPresetCenterPanel");
export const LazyDirectorAssistantPanel = lazyNamed(() => import("../management-panels.jsx"), "DirectorAssistantPanel");
export const LazyReviewCenterPanel = lazyNamed(() => import("../management-panels.jsx"), "ReviewCenterPanel");
export const LazyCollaborationCenterPanel = lazyNamed(() => import("../management-panels.jsx"), "CollaborationCenterPanel");
export const LazyNovelPipelineNode = lazyNamed(() => import("../heavy-nodes.jsx"), "NovelPipelineNode");
export const LazyStoryboardNode = lazyNamed(() => import("../heavy-nodes.jsx"), "StoryboardNode");
export const LazySplitNode = lazyNamed(() => import("../heavy-nodes.jsx"), "SplitNode");
export const LazyVr360Node = lazyNamed(() => import("../heavy-nodes.jsx"), "Vr360Node");
export const LazyShotListNode = lazyNamed(() => import("../canvas-heavy-nodes.jsx"), "ShotListNode");
export const LazyAssetLibraryNode = lazyNamed(() => import("../canvas-heavy-nodes.jsx"), "AssetLibraryNode");
export const LazyDirectorNode = lazyNamed(() => import("../canvas-heavy-nodes.jsx"), "DirectorNode");
export const LazyUploadNode = lazyNamed(() => import("../basic-nodes.jsx"), "UploadNode");
export const LazyImageEditNode = lazyNamed(() => import("../basic-nodes.jsx"), "ImageEditNode");
export const LazyGeminiWebNode = lazyNamed(() => import("../basic-nodes.jsx"), "GeminiWebNode");
export const LazyTextNode = lazyNamed(() => import("../basic-nodes.jsx"), "TextNode");
export const LazyResultNode = lazyNamed(() => import("../basic-nodes.jsx"), "ResultNode");
export const LazyGlobalAssetPanel = lazyNamed(() => import("../utility-panels.jsx"), "GlobalAssetPanel");
export const LazyProjectResourcePanel = lazyNamed(() => import("../utility-panels.jsx"), "ProjectResourcePanel");
export const LazyGlobalSearchPanel = lazyNamed(() => import("../utility-panels.jsx"), "GlobalSearchPanel");
export const LazyPromptPreviewPanel = lazyNamed(() => import("../utility-panels.jsx"), "PromptPreviewPanel");
export const LazySettingsPanel = lazyNamed(() => import("../utility-panels.jsx"), "SettingsPanel");
export const LazyDebugTracePanel = lazyNamed(() => import("../utility-panels.jsx"), "DebugTracePanel");
export const LazyMinimapPanel = lazyNamed(() => import("../minimap-panel.jsx"), "MinimapPanel");
