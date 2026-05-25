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

export const LazyProjectDashboardPanel = lazyNamed(() => import("../panels/project-dashboard-panel.jsx"), "ProjectDashboardPanel");
export const LazyProjectStudio = lazyNamed(() => import("../project-studio.jsx"), "ProjectStudio");
export const LazySimpleWorkflowPanel = lazyNamed(() => import("../panels/simple-workflow-panel.jsx"), "SimpleWorkflowPanel");
export const LazyGenerationQueuePanel = lazyNamed(() => import("../panels/generation-queue-panel.jsx"), "GenerationQueuePanel");
export const LazyTimelinePanel = lazyNamed(() => import("../panels/timeline-panel.jsx"), "TimelinePanel");
export const LazyProjectHealthPanel = lazyNamed(() => import("../panels/project-health-panel.jsx"), "ProjectHealthPanel");
export const LazyProductionHubPanel = lazyNamed(() => import("../panels/production-hub-panel.jsx"), "ProductionHubPanel");
export const LazyArchiveCenterPanel = lazyNamed(() => import("../panels/archive-center-panel.jsx"), "ArchiveCenterPanel");
export const LazyExportCenterPanel = lazyNamed(() => import("../panels/export-center-panel.jsx"), "ExportCenterPanel");
export const LazyPromptFactoryPanel = lazyNamed(() => import("../management-panels.jsx"), "PromptFactoryPanel");
export const LazyTemplateCenterPanel = lazyNamed(() => import("../management-panels.jsx"), "TemplateCenterPanel");
export const LazyStylePresetCenterPanel = lazyNamed(() => import("../management-panels.jsx"), "StylePresetCenterPanel");
export const LazyModelParamCenterPanel = lazyNamed(() => import("../management-panels.jsx"), "ModelParamCenterPanel");
export const LazyExportPresetCenterPanel = lazyNamed(() => import("../management-panels.jsx"), "ExportPresetCenterPanel");
export const LazyDirectorAssistantPanel = lazyNamed(() => import("../management-panels.jsx"), "DirectorAssistantPanel");
export const LazyReviewCenterPanel = lazyNamed(() => import("../management-panels.jsx"), "ReviewCenterPanel");
export const LazyCollaborationCenterPanel = lazyNamed(() => import("../management-panels.jsx"), "CollaborationCenterPanel");
export const LazyGlobalAssetPanel = lazyNamed(() => import("../utility-panels.jsx"), "GlobalAssetPanel");
export const LazyProjectResourcePanel = lazyNamed(() => import("../utility-panels.jsx"), "ProjectResourcePanel");
export const LazyGlobalSearchPanel = lazyNamed(() => import("../utility-panels.jsx"), "GlobalSearchPanel");
export const LazyPromptPreviewPanel = lazyNamed(() => import("../utility-panels.jsx"), "PromptPreviewPanel");
export const LazySettingsPanel = lazyNamed(() => import("../utility-panels.jsx"), "SettingsPanel");
export const LazyDebugTracePanel = lazyNamed(() => import("../utility-panels.jsx"), "DebugTracePanel");
