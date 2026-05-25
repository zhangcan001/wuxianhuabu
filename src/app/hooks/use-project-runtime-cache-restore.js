import { useEffect, useRef } from "react";

import {
  loadProjectCacheThroughRuntime,
} from "../../storage/project-file-helpers.js";
import {
  applyLoadedProjectAction,
} from "../project-io-actions.js";

export function useProjectRuntimeCacheRestore({
  projectRepository,
  isRuntimeAvailable = () => false,
  loadProjectCacheImpl,
  migrateLoadedProjectMedia = async (project) => ({ project, migratedCount: 0 }),
  applyEditorProjectState = () => {},
  appliedProjectOptions = {},
  setProjectMessage = () => {},
  logger = console,
} = {}) {
  const portsRef = useRef({
    isRuntimeAvailable,
    loadProjectCacheImpl,
    migrateLoadedProjectMedia,
    applyEditorProjectState,
    appliedProjectOptions,
    setProjectMessage,
    logger,
  });

  useEffect(() => {
    portsRef.current = {
      isRuntimeAvailable,
      loadProjectCacheImpl,
      migrateLoadedProjectMedia,
      applyEditorProjectState,
      appliedProjectOptions,
      setProjectMessage,
      logger,
    };
  });

  useEffect(() => {
    const ports = portsRef.current;
    if (!ports.isRuntimeAvailable()) return undefined;
    let cancelled = false;
    loadProjectCacheThroughRuntime({
      tauriRuntime: true,
      loadProjectCacheImpl: ports.loadProjectCacheImpl,
    }).then(async (result) => {
      if (cancelled || !result?.content) return;
      try {
        const { project } = await projectRepository.load({
          content: result.content,
          path: result.projectPath || "",
          source: "runtime-cache",
        });
        if (!project || cancelled) return;
        const migrated = await applyLoadedProjectAction({
          project,
          path: result.projectPath || "",
          pushHistory: () => {},
          migrateLoadedProjectMedia: (loadedProject) => ports.migrateLoadedProjectMedia(loadedProject, "cache"),
          applyEditorProjectState: ports.applyEditorProjectState,
          appliedProjectOptions: ports.appliedProjectOptions,
        });
        if (cancelled) return;
        const migrationSuffix = migrated.migratedCount ? `，并迁移 ${migrated.migratedCount} 张内嵌图片` : "";
        ports.setProjectMessage(result.projectPath
          ? `已从本地恢复缓存草稿：${result.projectPath}${migrationSuffix}`
          : `已从本地恢复缓存草稿${migrationSuffix}`);
      } catch (error) {
        ports.logger?.warn?.("Failed to restore runtime project cache", error);
      }
    }).catch((error) => {
      ports.logger?.warn?.("Failed to load runtime project cache", error);
    });
    return () => {
      cancelled = true;
    };
  }, [projectRepository]);
}
