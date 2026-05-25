import { useEffect, useRef, useState } from "react";

import {
  cacheProjectWithFallback,
} from "../project-cache-service.js";

export function useProjectPersistenceEffects({
  projectRepository,
  currentProjectPath = "",
  currentProjectSnapshot = () => ({}),
  projectPayload = () => "",
  setProjectMessage = () => {},
  isRuntimeAvailable = () => false,
  saveProjectFileToPath = async () => ({}),
  loadRecentProjects = async () => [],
  cacheDelayMs = 900,
  autoSaveDelayMs = 2000,
  cacheDeps = [],
  autoSaveDeps = [],
  logger = console,
} = {}) {
  const [recentProjects, setRecentProjects] = useState([]);
  const [autoSaveState, setAutoSaveState] = useState("");
  const snapshotRef = useRef(currentProjectSnapshot);
  const payloadRef = useRef(projectPayload);
  const runtimeRef = useRef(isRuntimeAvailable);
  const loadRecentProjectsRef = useRef(loadRecentProjects);

  useEffect(() => {
    snapshotRef.current = currentProjectSnapshot;
    payloadRef.current = projectPayload;
    runtimeRef.current = isRuntimeAvailable;
    loadRecentProjectsRef.current = loadRecentProjects;
  });

  useEffect(() => {
    if (!runtimeRef.current()) return;
    loadRecentProjectsRef.current().then(setRecentProjects);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      cacheProjectWithFallback({
        projectRepository,
        project: snapshotRef.current(),
        projectPath: currentProjectPath,
        tauriRuntime: runtimeRef.current(),
        setProjectMessage,
        logger,
      });
    }, cacheDelayMs);
    return () => window.clearTimeout(timer);
  }, [projectRepository, currentProjectPath, cacheDelayMs, setProjectMessage, logger, ...cacheDeps]);

  useEffect(() => {
    if (!runtimeRef.current() || !currentProjectPath) return;
    setAutoSaveState("待自动保存");
    const timer = window.setTimeout(async () => {
      try {
        await saveProjectFileToPath({
          path: currentProjectPath,
          content: payloadRef.current(),
        });
        setAutoSaveState(`已自动保存 ${new Date().toLocaleTimeString()}`);
        loadRecentProjectsRef.current().then(setRecentProjects);
      } catch (error) {
        setAutoSaveState(`自动保存失败：${String(error)}`);
      }
    }, autoSaveDelayMs);
    return () => window.clearTimeout(timer);
  }, [currentProjectPath, saveProjectFileToPath, autoSaveDelayMs, ...autoSaveDeps]);

  return {
    recentProjects,
    setRecentProjects,
    autoSaveState,
    setAutoSaveState,
  };
}
