import { useCallback, useEffect } from "react";

import {
  refreshMediaCacheIndexAction,
} from "./project-media-cache-actions.js";
import {
  refreshProjectIndexSummaryAction,
  syncProjectIndexToSqliteAction,
} from "./project-index-actions.js";
import {
  buildProjectIndexPayload,
} from "../project-sqlite-index-helpers.js";

const PROJECT_INDEX_WRITE_DELAY_MS = 1600;

export function useProjectRuntimeIndexEffects({
  isRuntimeAvailable = () => false,
  showResources = false,
  nodes = [],
  resources = [],
  generationQueue = [],
  timeline = [],
  exportHistory = [],
  productionEvents = [],
  mediaCacheReport = {},
  currentProjectPath = "",
  activeEpisodeId = "",
  listMediaCache = async () => ({}),
  readProjectIndexSummary = async () => null,
  syncProjectIndex = async () => null,
  setMediaCacheFiles = () => {},
  setProjectIndexSummary = () => {},
  logger = console,
} = {}) {
  const refreshMediaCacheIndex = useCallback(() => refreshMediaCacheIndexAction({
    listMediaCache,
    setMediaCacheFiles,
    logger,
  }), [listMediaCache, logger, setMediaCacheFiles]);

  const refreshProjectIndexSummary = useCallback(() => refreshProjectIndexSummaryAction({
    readProjectIndexSummary,
    setProjectIndexSummary,
    logger,
  }), [logger, readProjectIndexSummary, setProjectIndexSummary]);

  const syncProjectIndexToSqlite = useCallback((deletionAudit = []) => syncProjectIndexToSqliteAction({
    buildProjectIndexPayload,
    projectState: {
      activeEpisodeId,
      nodes,
      timeline,
      resources,
      generationQueue,
    },
    mediaCacheReport,
    currentProjectPath,
    deletionAudit,
    syncProjectIndex,
    setProjectIndexSummary,
  }), [
    activeEpisodeId,
    currentProjectPath,
    generationQueue,
    mediaCacheReport,
    nodes,
    resources,
    setProjectIndexSummary,
    syncProjectIndex,
    timeline,
  ]);

  useEffect(() => {
    if (!isRuntimeAvailable()) return;
    refreshMediaCacheIndex();
  }, [isRuntimeAvailable, refreshMediaCacheIndex]);

  useEffect(() => {
    if (!isRuntimeAvailable()) return;
    refreshProjectIndexSummary();
  }, [isRuntimeAvailable, refreshProjectIndexSummary]);

  useEffect(() => {
    if (!showResources || !isRuntimeAvailable()) return;
    refreshMediaCacheIndex();
  }, [isRuntimeAvailable, refreshMediaCacheIndex, showResources]);

  useEffect(() => {
    if (!isRuntimeAvailable()) return;
    const timer = window.setTimeout(() => {
      syncProjectIndexToSqlite().catch((error) => {
        logger?.warn?.("Project SQLite index sync failed", error);
      });
    }, PROJECT_INDEX_WRITE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [
    activeEpisodeId,
    currentProjectPath,
    exportHistory,
    generationQueue,
    isRuntimeAvailable,
    logger,
    mediaCacheReport,
    nodes,
    productionEvents,
    resources,
    syncProjectIndexToSqlite,
    timeline,
  ]);

  return {
    refreshMediaCacheIndex,
    refreshProjectIndexSummary,
    syncProjectIndexToSqlite,
  };
}
