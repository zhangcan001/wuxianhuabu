import {
  saveProjectCacheThroughRuntime,
  saveProjectThroughRuntime,
} from "../storage/project-file-helpers.js";
import {
  createProjectRepository,
} from "./project-repository.js";

export function createRuntimeProjectRepository({
  parseProject,
  normalizeProject,
  cacheProjectPayload,
  stringifyProjectStoragePayload,
  projectSerializers,
  storage,
  storageKey,
  tauriRuntime,
  saveProjectFileImpl,
  saveProjectCacheImpl,
} = {}) {
  const isTauriRuntime = typeof tauriRuntime === "function" ? tauriRuntime : () => Boolean(tauriRuntime);
  return createProjectRepository({
    parseProject,
    normalizeProject,
    serializeProject: (project, options = {}) => (
      options.storage === "cache"
        ? JSON.stringify(cacheProjectPayload(project, options))
        : stringifyProjectStoragePayload(project, projectSerializers)
    ),
    save: ({ content }) => saveProjectThroughRuntime({
      content,
      tauriRuntime: isTauriRuntime(),
      saveProjectFileImpl,
    }),
    cache: ({ content, projectPath }) => {
      if (!isTauriRuntime()) {
        storage?.setItem?.(storageKey, content);
        return { cached: true };
      }
      return saveProjectCacheThroughRuntime({
        content,
        projectPath,
        tauriRuntime: true,
        saveProjectCacheImpl,
      });
    },
  });
}
