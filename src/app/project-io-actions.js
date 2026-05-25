import {
  buildProjectOpenedMessage,
  buildProjectSavedMessage,
  openProjectThroughRuntime,
  openRecentProjectPath,
} from "../storage/project-file-helpers.js";
import {
  buildAppliedProjectState,
} from "../project-state-helpers.js";

function openedProjectMessage(path, migratedCount = 0) {
  return `${buildProjectOpenedMessage(path)}${migratedCount ? `，已迁移 ${migratedCount} 张内嵌图片` : ""}`;
}

export async function applyLoadedProjectAction({
  project,
  path = "",
  pushHistory = () => {},
  migrateLoadedProjectMedia = async (value) => ({ project: value, migratedCount: 0 }),
  applyEditorProjectState = () => {},
  appliedProjectOptions = {},
  traceAppEvent = () => {},
  setProjectMessage = () => {},
} = {}) {
  pushHistory();
  const migrated = await migrateLoadedProjectMedia(project, path || "project");
  const nextProject = migrated.project;
  applyEditorProjectState(buildAppliedProjectState(nextProject, path, appliedProjectOptions));
  traceAppEvent("project.apply", {
    path: path || "",
    nodeCount: nextProject.nodes?.length || 0,
    episodeCount: nextProject.episodes?.length || 0,
    clipCount: nextProject.timeline?.clips?.length || 0,
    migratedMediaCount: migrated.migratedCount,
  });
  if (migrated.migratedCount) {
    setProjectMessage(`已迁移 ${migrated.migratedCount} 张旧工程内嵌图片到本地缓存`);
  }
  return migrated;
}

export async function saveProjectAction({
  projectRepository,
  project,
  consistency,
  setCurrentProjectPath = () => {},
  setProjectMessage = () => {},
  traceAppEvent = () => {},
  refreshRecentProjects = () => {},
  nodeCount = 0,
  episodeCount = 0,
} = {}) {
  if (consistency && !consistency.ok) {
    setProjectMessage(`保存前一致性提示：${(consistency.issues || []).slice(0, 2).join("；")}`);
  }
  try {
    const result = await projectRepository.save(project);
    if (result.path) {
      setCurrentProjectPath(result.path);
      setProjectMessage(buildProjectSavedMessage(result.path));
      traceAppEvent("project.save.done", {
        path: result.path,
        nodeCount,
        episodeCount,
      });
      refreshRecentProjects();
    }
    return { ok: true, result };
  } catch (error) {
    traceAppEvent("project.save.failed", {
      error: String(error),
    });
    setProjectMessage(`保存失败：${String(error)}`);
    return { ok: false, error };
  }
}

export async function openProjectFileAction({
  tauriRuntime = false,
  openProjectFileImpl,
  fileInputRef,
  projectRepository,
  applyProject,
  setProjectMessage = () => {},
  traceAppEvent = () => {},
  refreshRecentProjects = () => {},
} = {}) {
  try {
    const result = await openProjectThroughRuntime({
      tauriRuntime,
      openProjectFileImpl,
      fileInputRef,
    });
    if (result.browserFallback || !result.content) return { ok: true, skipped: true, result };
    const loaded = await projectRepository.load({
      content: result.content,
      path: result.path || "",
      source: "dialog",
    });
    const migrated = await applyProject(loaded.project, result.path || "");
    setProjectMessage(openedProjectMessage(result.path, migrated?.migratedCount));
    traceAppEvent("project.open.done", {
      path: result.path || "",
      source: "dialog",
    });
    refreshRecentProjects();
    return { ok: true, result, migrated };
  } catch (error) {
    traceAppEvent("project.open.failed", {
      source: "dialog",
      error: String(error),
    });
    setProjectMessage(`打开失败：${String(error)}`);
    return { ok: false, error };
  }
}

export async function importProjectContentAction({
  content,
  projectRepository,
  applyProject,
  onError = () => {},
} = {}) {
  try {
    const loaded = await projectRepository.load({
      content,
      source: "browser-import",
    });
    await applyProject(loaded.project);
    return { ok: true };
  } catch (error) {
    onError(`导入失败：${error.message}`);
    return { ok: false, error };
  }
}

export async function openRecentProjectAction({
  path,
  openProjectFileAtPathImpl,
  projectRepository,
  applyProject,
  setProjectMessage = () => {},
  traceAppEvent = () => {},
  refreshRecentProjects = () => {},
} = {}) {
  if (!path) return { ok: true, skipped: true };
  try {
    const result = await openRecentProjectPath(path, {
      openProjectFileAtPathImpl,
    });
    if (!result.content) return { ok: true, skipped: true, result };
    const loaded = await projectRepository.load({
      content: result.content,
      path: result.path || path,
      source: "recent",
    });
    const nextPath = result.path || path;
    const migrated = await applyProject(loaded.project, nextPath);
    setProjectMessage(openedProjectMessage(nextPath, migrated?.migratedCount));
    traceAppEvent("project.open.done", {
      path: nextPath,
      source: "recent",
    });
    refreshRecentProjects();
    return { ok: true, result, migrated };
  } catch (error) {
    traceAppEvent("project.open.failed", {
      source: "recent",
      path,
      error: String(error),
    });
    setProjectMessage(`打开最近工程失败：${String(error)}`);
    refreshRecentProjects();
    return { ok: false, error };
  }
}
