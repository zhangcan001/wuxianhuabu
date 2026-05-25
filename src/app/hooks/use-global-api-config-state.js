import { useCallback, useEffect, useState } from "react";

export function useGlobalApiConfigState({
  showSettings = false,
  loadApiWorkspaceLibrary = () => ({ workspaces: [], activeWorkspaceId: "" }),
  loadBackendAiConfig = async () => null,
  loadNovelApiSettingsFromBackend = async () => null,
  setSettings = () => {},
  setTextApiSettings = () => {},
} = {}) {
  const [apiWorkspaceLibrary, setApiWorkspaceLibrary] = useState(() => loadApiWorkspaceLibrary());

  const refreshGlobalApiConfigs = useCallback(async () => {
    const [backendSettings, backendTextSettings] = await Promise.all([
      loadBackendAiConfig(),
      loadNovelApiSettingsFromBackend(),
    ]);
    if (backendSettings) {
      setSettings((current) => ({
        ...current,
        ...backendSettings,
        customApiKey: current.customApiKey || backendSettings.customApiKey || "",
        customApiKeySaved: Boolean(current.customApiKeySaved || backendSettings.customApiKeySaved || backendSettings.customApiKey),
      }));
    }
    if (backendTextSettings) {
      setTextApiSettings((current) => ({
        ...current,
        ...backendTextSettings,
        apiKey: current.apiKey || backendTextSettings.apiKey || "",
        apiKeySaved: Boolean(current.apiKeySaved || backendTextSettings.apiKeySaved || backendTextSettings.apiKey),
      }));
    }
  }, [loadBackendAiConfig, loadNovelApiSettingsFromBackend, setSettings, setTextApiSettings]);

  useEffect(() => {
    refreshGlobalApiConfigs();
  }, [refreshGlobalApiConfigs]);

  useEffect(() => {
    if (showSettings) return;
    setApiWorkspaceLibrary(loadApiWorkspaceLibrary());
  }, [loadApiWorkspaceLibrary, showSettings]);

  return {
    apiWorkspaceLibrary,
    setApiWorkspaceLibrary,
    refreshGlobalApiConfigs,
  };
}
