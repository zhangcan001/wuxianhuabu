import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  addApiWorkspaceToLibrary,
  createApiWorkspaceEntry,
  loadApiWorkspaceLibrary,
  normalizeApiWorkspaceLibrary,
  saveApiWorkspaceLibrary,
} from "../api-workspace-library.js";

const CUSTOM_API_DIAGNOSTIC_HISTORY_KEY = "wuxianhuabu.customApiDiagnosticHistory.v1";
const CUSTOM_API_DIAGNOSTIC_HISTORY_LIMIT = 8;
const API_PROFILE_LIBRARY_KEY = "wuxianhuabu.apiProfileLibrary.v1";

function loadCustomApiDiagnosticHistory() {
  try {
    const raw = localStorage.getItem(CUSTOM_API_DIAGNOSTIC_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCustomApiDiagnosticHistory(entries) {
  try {
    localStorage.setItem(CUSTOM_API_DIAGNOSTIC_HISTORY_KEY, JSON.stringify(entries || []));
  } catch {
    // Diagnostic history is only a convenience layer for repeated API debugging.
  }
}

function createApiProfileId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeApiProfileLibrary(raw) {
  const library = raw && typeof raw === "object" ? raw : {};
  return {
    textProfiles: Array.isArray(library.textProfiles) ? library.textProfiles : [],
    mediaProfiles: Array.isArray(library.mediaProfiles) ? library.mediaProfiles : [],
    activeTextProfileId: String(library.activeTextProfileId || ""),
    activeMediaProfileId: String(library.activeMediaProfileId || ""),
  };
}

function loadApiProfileLibrary() {
  try {
    const raw = localStorage.getItem(API_PROFILE_LIBRARY_KEY);
    return normalizeApiProfileLibrary(raw ? JSON.parse(raw) : {});
  } catch {
    return normalizeApiProfileLibrary({});
  }
}

function saveApiProfileLibrary(library) {
  try {
    localStorage.setItem(API_PROFILE_LIBRARY_KEY, JSON.stringify(normalizeApiProfileLibrary(library)));
  } catch {
    // Profile presets are a convenience layer and should not block settings editing.
  }
}

function buildTextApiProfileSnapshot(settings = {}) {
  return {
    factoryMode: settings.factoryMode || "local",
    apiProvider: settings.apiProvider || "openai",
    apiBaseUrl: settings.apiBaseUrl || "",
    apiUrl: settings.apiUrl || "",
    apiKey: settings.apiKey || "",
    apiKeySaved: Boolean(settings.apiKeySaved || settings.apiKey),
    apiKeyClear: false,
    authType: settings.authType || "bearer",
    headersJson: settings.headersJson || "",
    apiModel: settings.apiModel || "",
    bodyTemplate: settings.bodyTemplate || "",
    responsePath: settings.responsePath || "",
    schema: settings.schema || "",
  };
}

function buildMediaApiProfileSnapshot(settings = {}) {
  return {
    providerMode: settings.providerMode || "mock",
    customApiUrl: settings.customApiUrl || "",
    customApiKey: settings.customApiKey || "",
    customApiKeySaved: Boolean(settings.customApiKeySaved || settings.customApiKey),
    customApiKeyClear: false,
    customAuthType: settings.customAuthType || "bearer",
    customHeadersJson: settings.customHeadersJson || "",
    customModel: settings.customModel || "",
    customApiKind: settings.customApiKind || "direct-image",
    customResultMode: settings.customResultMode || "auto",
    customImagePath: settings.customImagePath || "",
    customBodyTemplate: settings.customBodyTemplate || "",
    comfyEnabled: Boolean(settings.comfyEnabled),
    comfyBaseUrl: settings.comfyBaseUrl || "",
    positiveNodeId: settings.positiveNodeId || "",
    workflowJson: settings.workflowJson || "",
    comfyImagePositiveNodeId: settings.comfyImagePositiveNodeId || "",
    comfyImageWorkflowJson: settings.comfyImageWorkflowJson || "",
    comfyVideoPositiveNodeId: settings.comfyVideoPositiveNodeId || "",
    comfyVideoWorkflowJson: settings.comfyVideoWorkflowJson || "",
    comfyTimeoutSeconds: settings.comfyTimeoutSeconds || "",
  };
}

function sanitizeImportedProfileName(value, fallback) {
  const name = String(value || "").trim();
  return name || fallback;
}

function parseImportedApiProfile(rawText, expectedKind) {
  const parsed = JSON.parse(rawText);
  const payload = parsed?.profile ? parsed : { kind: expectedKind, profile: parsed };
  if (payload.kind !== expectedKind) {
    throw new Error(`导入文件不是${expectedKind === "text" ? "文本" : "图片/视频"}配置。`);
  }
  if (!payload.profile || typeof payload.profile !== "object") {
    throw new Error("导入文件缺少 profile 配置内容。");
  }
  return payload.profile;
}

function parseImportedApiWorkspace(rawText) {
  const parsed = JSON.parse(rawText);
  const payload = parsed?.workspace ? parsed : { kind: "workspace", workspace: parsed };
  if (payload.kind !== "workspace") {
    throw new Error("导入文件不是整套工作配置。");
  }
  if (!payload.workspace || typeof payload.workspace !== "object") {
    throw new Error("导入文件缺少 workspace 配置内容。");
  }
  return payload.workspace;
}

function summarizeTextSettings(settings = {}) {
  const mode = settings.factoryMode === "api" ? "API" : "本地";
  const provider = settings.apiProvider || "openai";
  const model = settings.apiModel || "未填模型";
  return `${mode} · ${provider} · ${model}`;
}

function summarizeMediaSettings(settings = {}) {
  const providerMode = settings.comfyEnabled ? "comfy" : (settings.providerMode || "mock");
  if (providerMode === "comfy" || settings.comfyEnabled) {
    return `ComfyUI · ${settings.comfyBaseUrl || "未填地址"} · 图${settings.comfyImagePositiveNodeId || settings.positiveNodeId || "-"} / 视${settings.comfyVideoPositiveNodeId || "-"}`;
  }
  if (providerMode === "custom") {
    return `HTTP API · ${settings.customApiKind || "direct-image"} · ${settings.customModel || "未填模型"}`;
  }
  return "本地模拟";
}

function summarizeWorkspace(workspace = {}) {
  return {
    text: summarizeTextSettings(workspace.textSettings || {}),
    media: summarizeMediaSettings(workspace.mediaSettings || {}),
  };
}

function indexKindLabel(kind) {
  if (kind === "node") return "节点";
  if (kind === "shot") return "镜头";
  if (kind === "timelineClip") return "时间线";
  if (kind === "resource") return "资源";
  if (kind === "task") return "任务";
  if (kind === "media") return "媒体";
  if (kind === "mediaReference") return "媒体引用";
  return "索引";
}

export function SettingsPanel({ settings, setSettings, textApiSettings, patchTextApiSettings, focusSection = "image", onBackToRoot, onClose, helpers }) {
  const [message, setMessage] = useState("");
  const [testing, setTesting] = useState("");
  const [customApiDiagnostic, setCustomApiDiagnostic] = useState(null);
  const [customApiDiagnosticHistory, setCustomApiDiagnosticHistory] = useState(() => loadCustomApiDiagnosticHistory());
  const [apiProfileLibrary, setApiProfileLibrary] = useState(() => loadApiProfileLibrary());
  const [apiWorkspaceLibrary, setApiWorkspaceLibrary] = useState(() => loadApiWorkspaceLibrary());
  const autoSaveReadyRef = useRef(false);
  const textGroupRef = useRef(null);
  const imageGroupRef = useRef(null);
  const videoGroupRef = useRef(null);
  const importTextProfileInputRef = useRef(null);
  const importMediaProfileInputRef = useRef(null);
  const importWorkspaceInputRef = useRef(null);
  const textProvider = textApiSettings?.apiProvider || "openai";
  const textProviderPreset = helpers.NOVEL_API_PROVIDERS[textProvider] || helpers.NOVEL_API_PROVIDERS.openai;
  const textApiBaseUrl = textApiSettings?.apiBaseUrl || textProviderPreset.baseUrl;
  const textApiUrl = textApiSettings?.apiUrl || helpers.buildNovelChatCompletionsUrl(textApiBaseUrl);
  const textApiKeySaved = Boolean(textApiSettings?.apiKeySaved || textApiSettings?.apiKey);
  const textProviderUnsupported = Boolean(textProviderPreset?.unsupportedInApp);
  const sectionRefs = { text: textGroupRef, image: imageGroupRef, video: videoGroupRef };
  const activeTextProfile = useMemo(
    () => apiProfileLibrary.textProfiles.find((item) => item.id === apiProfileLibrary.activeTextProfileId) || null,
    [apiProfileLibrary],
  );
  const activeMediaProfile = useMemo(
    () => apiProfileLibrary.mediaProfiles.find((item) => item.id === apiProfileLibrary.activeMediaProfileId) || null,
    [apiProfileLibrary],
  );
  const activeWorkspace = useMemo(
    () => apiWorkspaceLibrary.workspaces.find((item) => item.id === apiWorkspaceLibrary.activeWorkspaceId) || null,
    [apiWorkspaceLibrary],
  );
  const activeWorkspaceSummary = useMemo(
    () => activeWorkspace ? summarizeWorkspace(activeWorkspace) : null,
    [activeWorkspace],
  );

  useEffect(() => {
    if (focusSection === "root") {
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 50);
      return;
    }
    const target = sectionRefs[focusSection]?.current;
    if (!target) return;
    window.setTimeout(() => target.scrollIntoView({ block: "start", behavior: "smooth" }), 80);
  }, [focusSection]);

  useEffect(() => {
    function handleEsc(event) {
      if (event.key !== "Escape") return;
      if (focusSection !== "root") {
        event.preventDefault();
        onBackToRoot?.();
        setMessage("已返回一级设置页");
      }
    }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [focusSection, onBackToRoot]);

  useEffect(() => {
    if (!autoSaveReadyRef.current) {
      autoSaveReadyRef.current = true;
      return;
    }
    const timer = window.setTimeout(() => {
      helpers.saveBackendAiConfig(settings)
        .then(() => setMessage("图片/视频 API 设置已自动保存到本地"))
        .catch((error) => setMessage(`图片/视频 API 自动保存失败：${error.message}`));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [settings, helpers]);

  function patch(next) {
    setSettings((current) => ({ ...current, ...next }));
  }

  function patchMediaProviderMode(mode = "custom") {
    if (mode === "comfy") {
      patch({
        providerMode: "comfy",
        comfyEnabled: true,
        comfyBaseUrl: settings.comfyBaseUrl || "http://127.0.0.1:8188",
      });
      return;
    }
    if (mode === "mock") {
      patch({ providerMode: "mock", comfyEnabled: false });
      return;
    }
    patch({ providerMode: "custom", comfyEnabled: false });
  }

  function updateApiProfileLibrary(updater) {
    setApiProfileLibrary((current) => {
      const next = normalizeApiProfileLibrary(updater(current));
      saveApiProfileLibrary(next);
      return next;
    });
  }

  function updateApiWorkspaceLibrary(updater) {
    setApiWorkspaceLibrary((current) => {
      const next = normalizeApiWorkspaceLibrary(updater(current));
      saveApiWorkspaceLibrary(next);
      return next;
    });
  }

  function downloadProfileJson(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function switchTextProfile(profileId) {
    const profile = apiProfileLibrary.textProfiles.find((item) => item.id === profileId);
    updateApiProfileLibrary((current) => ({ ...current, activeTextProfileId: profileId || "" }));
    if (!profile) {
      setMessage("已取消文本 API 配置绑定");
      return;
    }
    patchTextApiSettings?.(buildTextApiProfileSnapshot(profile.settings || {}));
    setMessage(`已切换文本 API 配置：${profile.name}`);
  }

  async function switchMediaProfile(profileId) {
    const profile = apiProfileLibrary.mediaProfiles.find((item) => item.id === profileId);
    updateApiProfileLibrary((current) => ({ ...current, activeMediaProfileId: profileId || "" }));
    if (!profile) {
      setMessage("已取消图片/视频 API 配置绑定");
      return;
    }
    const nextSettings = buildMediaApiProfileSnapshot(profile.settings || {});
    setSettings((current) => ({ ...current, ...nextSettings }));
    try {
      await helpers.saveBackendAiConfig(nextSettings);
      setMessage(`已切换图片/视频配置：${profile.name}`);
    } catch (error) {
      setMessage(`切换图片/视频配置失败：${error.message}`);
    }
  }

  function saveCurrentTextProfileAsNew() {
    const name = window.prompt("请输入文本 API 配置名称", `${textProviderPreset.label || "文本"}配置`);
    if (!name || !name.trim()) return;
    const entry = {
      id: createApiProfileId("text"),
      name: name.trim(),
      updatedAt: new Date().toISOString(),
      settings: buildTextApiProfileSnapshot(textApiSettings || {}),
    };
    updateApiProfileLibrary((current) => ({
      ...current,
      activeTextProfileId: entry.id,
      textProfiles: [entry, ...current.textProfiles],
    }));
    setMessage(`已保存文本 API 配置：${entry.name}`);
  }

  function saveCurrentMediaProfileAsNew() {
    const name = window.prompt("请输入图片/视频配置名称", `${settings.customModel || "图片视频"}配置`);
    if (!name || !name.trim()) return;
    const entry = {
      id: createApiProfileId("media"),
      name: name.trim(),
      updatedAt: new Date().toISOString(),
      settings: buildMediaApiProfileSnapshot(settings || {}),
    };
    updateApiProfileLibrary((current) => ({
      ...current,
      activeMediaProfileId: entry.id,
      mediaProfiles: [entry, ...current.mediaProfiles],
    }));
    setMessage(`已保存图片/视频配置：${entry.name}`);
  }

  function renameActiveTextProfile() {
    if (!activeTextProfile) return;
    const name = window.prompt("请输入新的文本配置名称", activeTextProfile.name || "文本配置");
    if (!name || !name.trim()) return;
    updateApiProfileLibrary((current) => ({
      ...current,
      textProfiles: current.textProfiles.map((item) => (
        item.id === activeTextProfile.id ? { ...item, name: name.trim(), updatedAt: new Date().toISOString() } : item
      )),
    }));
    setMessage(`已重命名文本 API 配置：${name.trim()}`);
  }

  function renameActiveMediaProfile() {
    if (!activeMediaProfile) return;
    const name = window.prompt("请输入新的图片/视频配置名称", activeMediaProfile.name || "图片视频配置");
    if (!name || !name.trim()) return;
    updateApiProfileLibrary((current) => ({
      ...current,
      mediaProfiles: current.mediaProfiles.map((item) => (
        item.id === activeMediaProfile.id ? { ...item, name: name.trim(), updatedAt: new Date().toISOString() } : item
      )),
    }));
    setMessage(`已重命名图片/视频配置：${name.trim()}`);
  }

  function exportTextProfile() {
    const profile = activeTextProfile || {
      id: createApiProfileId("text-export"),
      name: sanitizeImportedProfileName(textProviderPreset.label, "文本配置"),
      updatedAt: new Date().toISOString(),
      settings: buildTextApiProfileSnapshot(textApiSettings || {}),
    };
    downloadProfileJson(`${profile.name.replace(/[\\/:*?"<>|]+/g, "-") || "text-profile"}.json`, {
      kind: "text",
      version: 1,
      exportedAt: new Date().toISOString(),
      profile,
    });
    setMessage(`已导出文本 API 配置：${profile.name}`);
  }

  function exportMediaProfile() {
    const profile = activeMediaProfile || {
      id: createApiProfileId("media-export"),
      name: sanitizeImportedProfileName(settings.customModel, "图片视频配置"),
      updatedAt: new Date().toISOString(),
      settings: buildMediaApiProfileSnapshot(settings || {}),
    };
    downloadProfileJson(`${profile.name.replace(/[\\/:*?"<>|]+/g, "-") || "media-profile"}.json`, {
      kind: "media",
      version: 1,
      exportedAt: new Date().toISOString(),
      profile,
    });
    setMessage(`已导出图片/视频配置：${profile.name}`);
  }

  function openTextProfileImport() {
    importTextProfileInputRef.current?.click();
  }

  function openMediaProfileImport() {
    importMediaProfileInputRef.current?.click();
  }

  function openWorkspaceImport() {
    importWorkspaceInputRef.current?.click();
  }

  function importTextProfileFromText(text) {
    const imported = parseImportedApiProfile(text, "text");
    const entry = {
      id: createApiProfileId("text"),
      name: sanitizeImportedProfileName(imported.name, "导入的文本配置"),
      updatedAt: new Date().toISOString(),
      settings: buildTextApiProfileSnapshot(imported.settings || imported),
    };
    updateApiProfileLibrary((current) => ({
      ...current,
      activeTextProfileId: entry.id,
      textProfiles: [entry, ...current.textProfiles],
    }));
    patchTextApiSettings?.(entry.settings);
    setMessage(`已导入文本 API 配置：${entry.name}`);
  }

  function importMediaProfileFromText(text) {
    const imported = parseImportedApiProfile(text, "media");
    const entry = {
      id: createApiProfileId("media"),
      name: sanitizeImportedProfileName(imported.name, "导入的图片视频配置"),
      updatedAt: new Date().toISOString(),
      settings: buildMediaApiProfileSnapshot(imported.settings || imported),
    };
    updateApiProfileLibrary((current) => ({
      ...current,
      activeMediaProfileId: entry.id,
      mediaProfiles: [entry, ...current.mediaProfiles],
    }));
    setSettings((current) => ({ ...current, ...entry.settings }));
    helpers.saveBackendAiConfig(entry.settings)
      .then(() => setMessage(`已导入图片/视频配置：${entry.name}`))
      .catch((error) => setMessage(`图片/视频配置已导入，但写入当前设置失败：${error.message}`));
  }

  async function applyWorkspace(entry) {
    if (!entry) {
      updateApiWorkspaceLibrary((current) => ({ ...current, activeWorkspaceId: "" }));
      setMessage("已取消整套工作配置绑定");
      return;
    }
    patchTextApiSettings?.(buildTextApiProfileSnapshot(entry.textSettings || {}));
    const nextMediaSettings = buildMediaApiProfileSnapshot(entry.mediaSettings || {});
    setSettings((current) => ({ ...current, ...nextMediaSettings }));
    updateApiWorkspaceLibrary((current) => ({ ...current, activeWorkspaceId: entry.id }));
    try {
      await helpers.saveBackendAiConfig(nextMediaSettings);
      setMessage(`已切换整套工作配置：${entry.name}`);
    } catch (error) {
      setMessage(`整套工作配置已切换，但图片/视频写入失败：${error.message}`);
    }
  }

  async function switchWorkspace(workspaceId) {
    const entry = apiWorkspaceLibrary.workspaces.find((item) => item.id === workspaceId) || null;
    await applyWorkspace(entry);
  }

  function saveCurrentWorkspaceAsNew() {
    const name = window.prompt("请输入整套工作配置名称", `${textProviderPreset.label || "文本"} + ${settings.customModel || "图片视频"}`);
    if (!name || !name.trim()) return;
    const entry = createApiWorkspaceEntry({
      id: createApiProfileId("workspace"),
      name: name.trim(),
      textSettings: buildTextApiProfileSnapshot(textApiSettings || {}),
      mediaSettings: buildMediaApiProfileSnapshot(settings || {}),
    });
    updateApiWorkspaceLibrary((current) => addApiWorkspaceToLibrary(current, entry));
    setMessage(`已创建新工作区：${entry.name}`);
  }

  function overwriteActiveWorkspace() {
    if (!activeWorkspace) {
      saveCurrentWorkspaceAsNew();
      return;
    }
    updateApiWorkspaceLibrary((current) => ({
      ...current,
      workspaces: current.workspaces.map((item) => (
        item.id === activeWorkspace.id
          ? {
              ...item,
              updatedAt: new Date().toISOString(),
              textSettings: buildTextApiProfileSnapshot(textApiSettings || {}),
              mediaSettings: buildMediaApiProfileSnapshot(settings || {}),
            }
          : item
      )),
    }));
    setMessage(`已覆盖整套工作配置：${activeWorkspace.name}`);
  }

  function renameActiveWorkspace() {
    if (!activeWorkspace) return;
    const name = window.prompt("请输入新的整套工作配置名称", activeWorkspace.name || "整套工作配置");
    if (!name || !name.trim()) return;
    updateApiWorkspaceLibrary((current) => ({
      ...current,
      workspaces: current.workspaces.map((item) => (
        item.id === activeWorkspace.id ? { ...item, name: name.trim(), updatedAt: new Date().toISOString() } : item
      )),
    }));
    setMessage(`已重命名整套工作配置：${name.trim()}`);
  }

  function deleteActiveWorkspace() {
    if (!activeWorkspace) return;
    updateApiWorkspaceLibrary((current) => ({
      ...current,
      activeWorkspaceId: "",
      workspaces: current.workspaces.filter((item) => item.id !== activeWorkspace.id),
    }));
    setMessage(`已删除整套工作配置：${activeWorkspace.name}`);
  }

  function exportWorkspace() {
    const workspace = activeWorkspace || {
      id: createApiProfileId("workspace-export"),
      name: sanitizeImportedProfileName(`${textProviderPreset.label || "文本"}-${settings.customModel || "图片视频"}`, "workspace"),
      updatedAt: new Date().toISOString(),
      textSettings: buildTextApiProfileSnapshot(textApiSettings || {}),
      mediaSettings: buildMediaApiProfileSnapshot(settings || {}),
    };
    downloadProfileJson(`${workspace.name.replace(/[\\/:*?"<>|]+/g, "-") || "workspace"}.json`, {
      kind: "workspace",
      version: 1,
      exportedAt: new Date().toISOString(),
      workspace,
    });
    setMessage(`已导出整套工作配置：${workspace.name}`);
  }

  function importWorkspaceFromText(text) {
    const imported = parseImportedApiWorkspace(text);
    const entry = {
      id: createApiProfileId("workspace"),
      name: sanitizeImportedProfileName(imported.name, "导入的整套工作配置"),
      updatedAt: new Date().toISOString(),
      textSettings: buildTextApiProfileSnapshot(imported.textSettings || {}),
      mediaSettings: buildMediaApiProfileSnapshot(imported.mediaSettings || {}),
    };
    updateApiWorkspaceLibrary((current) => ({
      ...current,
      activeWorkspaceId: entry.id,
      workspaces: [entry, ...current.workspaces],
    }));
    applyWorkspace(entry);
  }

  function overwriteActiveTextProfile() {
    if (!activeTextProfile) {
      saveCurrentTextProfileAsNew();
      return;
    }
    updateApiProfileLibrary((current) => ({
      ...current,
      textProfiles: current.textProfiles.map((item) => (
        item.id === activeTextProfile.id
          ? { ...item, updatedAt: new Date().toISOString(), settings: buildTextApiProfileSnapshot(textApiSettings || {}) }
          : item
      )),
    }));
    setMessage(`已覆盖文本 API 配置：${activeTextProfile.name}`);
  }

  function overwriteActiveMediaProfile() {
    if (!activeMediaProfile) {
      saveCurrentMediaProfileAsNew();
      return;
    }
    updateApiProfileLibrary((current) => ({
      ...current,
      mediaProfiles: current.mediaProfiles.map((item) => (
        item.id === activeMediaProfile.id
          ? { ...item, updatedAt: new Date().toISOString(), settings: buildMediaApiProfileSnapshot(settings || {}) }
          : item
      )),
    }));
    setMessage(`已覆盖图片/视频配置：${activeMediaProfile.name}`);
  }

  function deleteActiveTextProfile() {
    if (!activeTextProfile) return;
    updateApiProfileLibrary((current) => ({
      ...current,
      activeTextProfileId: "",
      textProfiles: current.textProfiles.filter((item) => item.id !== activeTextProfile.id),
    }));
    setMessage(`已删除文本 API 配置：${activeTextProfile.name}`);
  }

  function deleteActiveMediaProfile() {
    if (!activeMediaProfile) return;
    updateApiProfileLibrary((current) => ({
      ...current,
      activeMediaProfileId: "",
      mediaProfiles: current.mediaProfiles.filter((item) => item.id !== activeMediaProfile.id),
    }));
    setMessage(`已删除图片/视频配置：${activeMediaProfile.name}`);
  }

  function patchImageApiKey(value) {
    const next = { ...settings, customApiKey: value, customApiKeyClear: false, customApiKeySaved: Boolean(value || settings.customApiKeySaved) };
    setSettings((current) => ({ ...current, customApiKey: value, customApiKeyClear: false, customApiKeySaved: Boolean(value || current.customApiKeySaved) }));
    if (value.trim()) {
      helpers.saveBackendAiConfig(next)
        .then((saved) => {
          setSettings((current) => ({
            ...current,
            ...saved,
            customApiKey: current.customApiKey || value,
            customApiKeySaved: true,
          }));
          setMessage("图片/视频 API Key 已保存，后续会自动使用");
        })
        .catch((error) => setMessage(`图片/视频 API Key 保存失败：${error.message}`));
    }
  }

  function patchText(next) {
    patchTextApiSettings?.(next);
    setMessage("文本 API 设置已自动保存到本地");
  }

  function patchTextApiKey(value) {
    patchText({ apiKey: value, apiKeyClear: false, apiKeySaved: Boolean(value || textApiKeySaved) });
    if (value.trim()) setMessage("文本 API Key 已保存，后续会自动使用");
  }

  function applyTextProvider(provider) {
    const preset = helpers.NOVEL_API_PROVIDERS[provider] || helpers.NOVEL_API_PROVIDERS.custom;
    patchText({
      factoryMode: "api",
      apiProvider: provider,
      apiBaseUrl: preset.baseUrl,
      apiUrl: "",
      authType: preset.authType,
      apiModel: preset.model,
      responsePath: preset.responsePath,
      headersJson: preset.headersJson || "",
      bodyTemplate: preset.bodyTemplate || helpers.NOVEL_API_BODY_TEMPLATE_DEFAULT,
      schema: helpers.NOVEL_FACTORY_SCHEMA,
    });
  }

  function clearTextApiKey() {
    patchText({ apiKey: "", apiKeyClear: true, apiKeySaved: false });
    setMessage("已清除本地保存的文本 API Key");
  }

  async function testTextApi() {
    if (textProviderUnsupported) {
      setMessage(textProviderPreset?.unsupportedReason || "当前供应商不支持在本软件里直接测试。");
      return;
    }
    setTesting("text-api");
    setMessage("正在测试文本 API...");
    try {
      await helpers.runNovelFactoryApi({
        apiUrl: textApiUrl,
        apiBaseUrl: textApiBaseUrl,
        apiProvider: textProvider,
        apiKey: textApiSettings?.apiKey || "",
        authType: textApiSettings?.authType || textProviderPreset.authType || "bearer",
        headersJson: textApiSettings?.headersJson || "",
        model: textApiSettings?.apiModel || textProviderPreset.model || "gpt-4o-mini",
        bodyTemplate: helpers.normalizeNovelBodyTemplate(textApiSettings?.bodyTemplate, textProviderPreset),
        responsePath: textApiSettings?.responsePath || textProviderPreset.responsePath || "choices.0.message.content",
        novel: "主角在雨夜发现一封没有署名的信。",
        input: "主角在雨夜发现一封没有署名的信。",
        template: "请用一句话改写输入内容。",
        schema: "只输出一句中文文本。",
      }, (text, note) => ({ text, note }));
      setMessage(`文本 API 测试成功：${textProviderPreset.label}`);
    } catch (error) {
      setMessage(`文本 API 测试失败：${error.message || String(error)}`);
    } finally {
      setTesting("");
    }
  }

  function patchComfyWorkflow(value, kind = "image") {
    const detected = helpers.detectComfyPromptNodeId(value);
    const format = helpers.detectComfyWorkflowFormat(value);
    if (kind === "video") {
      patch({
        comfyVideoWorkflowJson: value,
        ...(detected && !settings.comfyVideoPositiveNodeId ? { comfyVideoPositiveNodeId: detected } : {}),
      });
      if (format === "ui") setMessage("已识别普通 ComfyUI workflow。运行生图需要在 ComfyUI 里导出 API workflow JSON。");
      else if (detected) setMessage(`已识别视频提示词节点：${detected}`);
      return;
    }
    patch({
      comfyImageWorkflowJson: value,
      workflowJson: value,
      ...(detected && !(settings.comfyImagePositiveNodeId || settings.positiveNodeId) ? { comfyImagePositiveNodeId: detected, positiveNodeId: detected } : {}),
    });
    if (format === "ui") setMessage("已识别普通 ComfyUI workflow。运行生图需要在 ComfyUI 里导出 API workflow JSON。");
    else if (detected) setMessage(`已识别生图提示词节点：${detected}`);
  }

  function applyApiPreset(preset) {
    if (preset === "openai") {
      patch({
        providerMode: "custom",
        comfyEnabled: false,
        customApiUrl: "https://api.openai.com/v1/images/generations",
        customAuthType: "bearer",
        customModel: "gpt-image-1",
        customApiKind: "direct-image",
        customResultMode: "base64",
        customImagePath: "data.0.b64_json",
        customBodyTemplate: JSON.stringify({ model: "{{model}}", prompt: "{{prompt}}", size: "{{size}}" }, null, 2),
      });
    }
    if (preset === "url") {
      patch({
        providerMode: "custom",
        comfyEnabled: false,
        customApiKind: "direct-image",
        customResultMode: "url",
        customImagePath: "data.0.url",
        customBodyTemplate: JSON.stringify({ prompt: "{{prompt}}", model: "{{model}}" }, null, 2),
      });
    }
    if (preset === "base64") {
      patch({
        providerMode: "custom",
        comfyEnabled: false,
        customApiKind: "direct-image",
        customResultMode: "base64",
        customImagePath: "data.0.b64_json",
        customBodyTemplate: JSON.stringify({ prompt: "{{prompt}}", model: "{{model}}" }, null, 2),
      });
    }
    if (preset === "grsai-banana-pro-4k") {
      patch({
        providerMode: "custom",
        comfyEnabled: false,
        customApiUrl: "https://grsaiapi.com/v1/draw/nano-banana",
        customAuthType: "bearer",
        customModel: "nano-banana-pro-4k-vip",
        customApiKind: "draw-poll",
        customResultMode: "task-id",
        customImagePath: "data.results.0.url",
        customBodyTemplate: JSON.stringify({
          model: "{{model}}",
          prompt: "{{prompt}}",
          aspectRatio: "auto",
          imageSize: "4K",
          urls: [],
          webHook: "-1",
          shutProgress: true,
        }, null, 2),
      });
    }
  }

  async function testComfyConnectionOnly() {
    setTesting("comfy-connect");
    setMessage("正在检测 ComfyUI...");
    try {
      const result = await helpers.testComfyConnection(settings);
      setMessage(`ComfyUI 已连接：${result}`);
    } catch (error) {
      setMessage(`ComfyUI 连接失败：${error.message}`);
    } finally {
      setTesting("");
    }
  }

  async function saveBackendConfig() {
    setMessage("正在保存...");
    try {
      const saved = await helpers.saveBackendAiConfig(settings);
      setSettings((current) => ({ ...current, ...saved, customApiKey: current.customApiKey || "" }));
      setMessage(`已保存到本地：${saved.configPath || "~/.wuxianhuabu/ai-config.json"}`);
    } catch (error) {
      setMessage(`保存失败：${error.message}`);
    }
  }

  async function clearBackendApiKey() {
    setMessage("正在清除 Key...");
    try {
      const saved = await helpers.saveBackendAiConfig({ ...settings, customApiKey: "", customApiKeyClear: true });
      setSettings((current) => ({ ...current, ...saved, customApiKey: "" }));
      setMessage("已清除本地保存的 API Key");
    } catch (error) {
      setMessage(`清除失败：${error.message}`);
    }
  }

  async function copyDiagnosticJson() {
    if (!customApiDiagnostic) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(customApiDiagnostic, null, 2));
      setMessage("诊断 JSON 已复制");
    } catch (error) {
      setMessage(error.message || "复制诊断 JSON 失败");
    }
  }

  function rememberCustomApiDiagnostic(report) {
    const entry = {
      id: `${Date.now()}`,
      createdAt: new Date().toISOString(),
      apiUrl: settings.customApiUrl || "",
      model: settings.customModel || "",
      report,
    };
    setCustomApiDiagnosticHistory((current) => {
      const next = [entry, ...current].slice(0, CUSTOM_API_DIAGNOSTIC_HISTORY_LIMIT);
      saveCustomApiDiagnosticHistory(next);
      return next;
    });
  }

  async function copyHistoryDiagnosticJson(entry) {
    if (!entry?.report) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(entry.report, null, 2));
      setMessage("历史诊断 JSON 已复制");
    } catch (error) {
      setMessage(error.message || "复制历史诊断 JSON 失败");
    }
  }

  function restoreHistoryDiagnostic(entry) {
    if (!entry?.report) return;
    setCustomApiDiagnostic(entry.report);
    setMessage(`已载入 ${new Date(entry.createdAt).toLocaleString()} 的测试报告`);
  }

  function clearCustomApiDiagnosticHistory() {
    setCustomApiDiagnosticHistory([]);
    saveCustomApiDiagnosticHistory([]);
    setMessage("已清空自定义图片 API 测试历史");
  }

  async function copyDiagnosticSummary() {
    if (!customApiDiagnosticSummary) return;
    const text = [
      `接口识别：${customApiDiagnosticSummary.apiKind || "direct-image"}`,
      `结果模式：${customApiDiagnosticSummary.resultMode || "auto"}`,
      `首轮响应键摘要：${customApiDiagnosticSummary.keySummary || "暂无"}`,
      `图片字段检测：${customApiDiagnosticSummary.imageFieldStatus || "未检测到图片字段"}`,
      `任务 ID 检测：${customApiDiagnosticSummary.taskFieldStatus || "未检测到任务 ID"}`,
      `轮询判断：${customApiDiagnosticSummary.pollingStatus || "不会进入轮询"}`,
      customApiDiagnostic.firstResponseContentType ? `首轮 Content-Type：${customApiDiagnostic.firstResponseContentType}` : "",
      customApiDiagnostic.error ? `诊断结论：${customApiDiagnostic.error}` : "",
    ].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setMessage("诊断结论已复制");
    } catch (error) {
      setMessage(error.message || "复制诊断结论失败");
    }
  }

  async function testCustomApiWithReport() {
    setTesting("custom-api");
    setMessage("正在测试自定义图片 API 并生成报告...");
    try {
      await helpers.saveBackendAiConfig(settings);
      const report = await helpers.diagnoseCustomImageApi(settings, "一只在霓虹城市里看星星的白猫");
      setCustomApiDiagnostic(report);
      rememberCustomApiDiagnostic(report);
      if (report?.success) {
        setMessage("自定义图片 API 测试成功，已生成接口报告");
      } else {
        setMessage(`自定义图片 API 测试完成：${report?.error || "未返回图片，请查看下方测试报告"}`);
      }
    } catch (error) {
      setCustomApiDiagnostic({
        success: false,
        normalizedApiKind: settings.customApiKind || "direct-image",
        normalizedResultMode: settings.customResultMode || "auto",
        firstResponseContentType: "",
        firstResponseKeySummary: "",
        firstResponseTopLevelKeys: [],
        firstResponseNestedKeys: [],
        detectedImageField: "",
        detectedTaskId: "",
        hasImageField: false,
        hasTaskId: false,
        willPoll: false,
        imagePreview: "",
        note: "自定义图片 API 诊断",
        error: helpers.formatCustomImageApiError(error),
      });
      rememberCustomApiDiagnostic({
        success: false,
        normalizedApiKind: settings.customApiKind || "direct-image",
        normalizedResultMode: settings.customResultMode || "auto",
        firstResponseContentType: "",
        firstResponseKeySummary: "",
        firstResponseTopLevelKeys: [],
        firstResponseNestedKeys: [],
        detectedImageField: "",
        detectedTaskId: "",
        hasImageField: false,
        hasTaskId: false,
        willPoll: false,
        imagePreview: "",
        note: "自定义图片 API 诊断",
        error: helpers.formatCustomImageApiError(error),
      });
      setMessage(`自定义图片 API 测试失败：${helpers.formatCustomImageApiError(error)}`);
    } finally {
      setTesting("");
    }
  }

  const customApiValidationMessage = helpers.validateCustomImageApiSettings(settings);
  const customApiDiagnosticSummary = customApiDiagnostic ? helpers.summarizeCustomImageApiDiagnostic(customApiDiagnostic) : null;

  return (
    <div className="settings-backdrop">
      <section className="settings-panel">
        <header>
          <div>
            <strong>AI 设置</strong>
            <span>选择本地模拟、自定义 HTTP API 或本地 ComfyUI。</span>
          </div>
          <button onClick={onClose}>关闭</button>
        </header>
        <div className="settings-group">
          <h3>整套工作配置</h3>
          <div className="settings-profile-strip">
            <input
              hidden
              ref={importWorkspaceInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(event) => helpers.readTextFile(event, importWorkspaceFromText)}
            />
            <label>
              当前工作配置
              <select value={apiWorkspaceLibrary.activeWorkspaceId || ""} onChange={(event) => switchWorkspace(event.target.value)}>
                <option value="">当前临时组合</option>
                {apiWorkspaceLibrary.workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name} · {(workspace.textSettings?.apiModel || workspace.textSettings?.apiProvider || "文本")} / {(workspace.mediaSettings?.customModel || workspace.mediaSettings?.providerMode || "媒体")}
                  </option>
                ))}
              </select>
            </label>
            {activeWorkspaceSummary && (
              <div className="settings-workspace-summary">
                <span>文本：{activeWorkspaceSummary.text}</span>
                <span>图片/视频：{activeWorkspaceSummary.media}</span>
              </div>
            )}
            <div className="quick-actions">
              <button onClick={saveCurrentWorkspaceAsNew}>新建工作区</button>
              <button onClick={overwriteActiveWorkspace}>{activeWorkspace ? "覆盖当前整套配置" : "保存为当前整套配置"}</button>
              <button onClick={renameActiveWorkspace} disabled={!activeWorkspace}>重命名</button>
              <button onClick={exportWorkspace}>导出 JSON</button>
              <button onClick={openWorkspaceImport}>导入 JSON</button>
              <button onClick={deleteActiveWorkspace} disabled={!activeWorkspace}>删除当前整套配置</button>
            </div>
            {apiWorkspaceLibrary.workspaces.length ? (
              <div className="settings-workspace-list">
                {apiWorkspaceLibrary.workspaces.slice(0, 6).map((workspace) => {
                  const summary = summarizeWorkspace(workspace);
                  return (
                    <section
                      key={workspace.id}
                      className={`settings-workspace-item ${workspace.id === apiWorkspaceLibrary.activeWorkspaceId ? "active" : ""}`}
                    >
                      <strong>{workspace.name}</strong>
                      <p>{summary.text}</p>
                      <p>{summary.media}</p>
                    </section>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
        <div className="settings-savebar">
          <button onClick={saveBackendConfig}>立即保存图片/视频配置</button>
          {message && <span>{message}</span>}
        </div>
        <div className="settings-group settings-master-switches">
          <h3>生成总开关</h3>
          <div className="settings-switch-grid">
            <section>
              <strong>文字生成</strong>
              <span>剧本、资产抽取、提示词和审稿</span>
              <div className="quick-actions">
                <button className={textApiSettings?.factoryMode === "api" ? "active" : ""} onClick={() => patchText({ factoryMode: "api" })}>API 生成</button>
                <button className={(textApiSettings?.factoryMode || "local") === "local" ? "active" : ""} onClick={() => patchText({ factoryMode: "local" })}>本地规则</button>
              </div>
            </section>
            <section>
              <strong>图片/视频生成</strong>
              <span>镜头图、资产图、视频队列默认跟随这里</span>
              <div className="quick-actions">
                <button className={helpers.currentProviderMode(settings) === "custom" ? "active" : ""} onClick={() => patchMediaProviderMode("custom")}>API 生成</button>
                <button className={helpers.currentProviderMode(settings) === "comfy" ? "active" : ""} onClick={() => patchMediaProviderMode("comfy")}>本地 ComfyUI</button>
                <button className={helpers.currentProviderMode(settings) === "mock" ? "active" : ""} onClick={() => patchMediaProviderMode("mock")}>本地模拟</button>
              </div>
            </section>
          </div>
          <small className="settings-hint">总开关控制默认生成来源；镜头、资产行内下拉选择“跟随总开关”时会自动使用这里的设置。</small>
        </div>
        <div className="provider-cards">
          {[
            ["text", "文本 API", "剧本、评分、资产抽取、提示词生成。"],
            ["image", "图片 API", "生成分镜图、角色图和场景图。"],
            ["video", "视频 API", "根据镜头提示词生成视频素材。"],
          ].map(([mode, title, desc]) => (
            <button
              key={mode}
              className={`provider-card ${focusSection === mode ? "active" : ""}`}
              onClick={() => sectionRefs[mode]?.current?.scrollIntoView({ block: "start", behavior: "smooth" })}
            >
              <strong>{title}</strong>
              <span>{desc}</span>
            </button>
          ))}
        </div>
        <div className="settings-group" ref={textGroupRef}>
          <h3>文本 API</h3>
          <div className="settings-profile-strip">
            <input
              hidden
              ref={importTextProfileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(event) => helpers.readTextFile(event, importTextProfileFromText)}
            />
            <label>
              文本配置组
              <select value={apiProfileLibrary.activeTextProfileId || ""} onChange={(event) => switchTextProfile(event.target.value)}>
                <option value="">当前临时配置</option>
                {apiProfileLibrary.textProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>{profile.name}</option>
                ))}
              </select>
            </label>
            <div className="quick-actions">
              <button onClick={saveCurrentTextProfileAsNew}>另存为新配置</button>
              <button onClick={overwriteActiveTextProfile}>{activeTextProfile ? "覆盖当前配置" : "保存为当前配置"}</button>
              <button onClick={renameActiveTextProfile} disabled={!activeTextProfile}>重命名</button>
              <button onClick={exportTextProfile}>导出 JSON</button>
              <button onClick={openTextProfileImport}>导入 JSON</button>
              <button onClick={deleteActiveTextProfile} disabled={!activeTextProfile}>删除当前配置</button>
            </div>
          </div>
          <div className="quick-actions">
            <button className={textApiSettings?.factoryMode === "local" ? "active" : ""} onClick={() => patchText({ factoryMode: "local" })}>本地规则</button>
            <button className={textApiSettings?.factoryMode === "api" ? "active" : ""} onClick={() => patchText({ factoryMode: "api" })}>启用 API</button>
            <button onClick={testTextApi} disabled={testing === "text-api" || textApiSettings?.factoryMode === "local" || textProviderUnsupported}>{testing === "text-api" ? "测试中..." : "测试文本 API"}</button>
          </div>
          <label>
            供应商
            <select value={textProvider} onChange={(event) => applyTextProvider(event.target.value)}>
              {Object.entries(helpers.NOVEL_API_PROVIDERS).map(([key, preset]) => (
                <option key={key} value={key}>{preset.label}</option>
              ))}
            </select>
          </label>
          {textProviderUnsupported && (
            <div className="settings-warning">
              <strong>{textProviderPreset.label}</strong>
              <p>{textProviderPreset.unsupportedReason}</p>
              <p>如果你是想让本软件稳定调用阿里模型，请改用“阿里百炼 / DashScope”供应商；它适合本软件现在这类文本 API 链路。</p>
              {textProviderPreset.suggestedProvider && (
                <button className="settings-secondary" onClick={() => applyTextProvider(textProviderPreset.suggestedProvider)}>切换到阿里百炼 / DashScope</button>
              )}
            </div>
          )}
          <label>
            Base URL
            <input value={textApiBaseUrl} onChange={(event) => patchText({ apiBaseUrl: event.target.value, apiUrl: "" })} placeholder="https://api.example.com/v1" />
          </label>
          <label>
            API Key
            <input value={textApiSettings?.apiKey || ""} onChange={(event) => patchTextApiKey(event.target.value)} type="password" placeholder={textApiKeySaved ? "已保存到本地，留空会自动沿用" : "只需输入一次，保存后自动沿用"} />
          </label>
          <small className="settings-hint">{textApiKeySaved ? "文本 API Key 已保存在本机，小说转剧本、评分、资产提取和提示词生成会自动使用。" : "输入一次文本 API Key 后会立即保存到本机。"}</small>
          {textApiKeySaved && <button className="settings-secondary" onClick={clearTextApiKey}>清除文本 API Key</button>}
          <label>
            模型
            <input value={textApiSettings?.apiModel || textProviderPreset.model || ""} onChange={(event) => patchText({ apiModel: event.target.value })} placeholder="gpt-4o-mini / deepseek-chat / qwen-plus" />
          </label>
          <label>
            完整接口地址
            <input value={textApiSettings?.apiUrl || ""} onChange={(event) => patchText({ apiUrl: event.target.value })} placeholder="默认由 Base URL 自动拼接 /chat/completions" />
          </label>
          <label>
            认证方式
            <select value={textApiSettings?.authType || textProviderPreset.authType || "bearer"} onChange={(event) => patchText({ authType: event.target.value })}>
              <option value="bearer">Authorization: Bearer</option>
              <option value="x-api-key">x-api-key</option>
              <option value="none">不自动添加</option>
            </select>
          </label>
          <label>
            结果文本路径
            <input value={textApiSettings?.responsePath || textProviderPreset.responsePath || "choices.0.message.content"} onChange={(event) => patchText({ responsePath: event.target.value })} placeholder="choices.0.message.content" />
          </label>
          <label>
            额外请求头 JSON
            <textarea className="small-textarea" value={textApiSettings?.headersJson || ""} onChange={(event) => patchText({ headersJson: event.target.value })} placeholder='{"X-Provider":"demo"}' />
          </label>
          <label>
            请求体模板 JSON
            <textarea className="small-textarea" value={helpers.normalizeNovelBodyTemplate(textApiSettings?.bodyTemplate, textProviderPreset)} onChange={(event) => patchText({ bodyTemplate: event.target.value })} />
          </label>
        </div>
        <div className="settings-group" ref={imageGroupRef}>
          <h3>图片 API</h3>
          <div className="settings-profile-strip">
            <input
              hidden
              ref={importMediaProfileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(event) => helpers.readTextFile(event, importMediaProfileFromText)}
            />
            <label>
              图片/视频配置组
              <select value={apiProfileLibrary.activeMediaProfileId || ""} onChange={(event) => switchMediaProfile(event.target.value)}>
                <option value="">当前临时配置</option>
                {apiProfileLibrary.mediaProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>{profile.name}</option>
                ))}
              </select>
            </label>
            <div className="quick-actions">
              <button onClick={saveCurrentMediaProfileAsNew}>另存为新配置</button>
              <button onClick={overwriteActiveMediaProfile}>{activeMediaProfile ? "覆盖当前配置" : "保存为当前配置"}</button>
              <button onClick={renameActiveMediaProfile} disabled={!activeMediaProfile}>重命名</button>
              <button onClick={exportMediaProfile}>导出 JSON</button>
              <button onClick={openMediaProfileImport}>导入 JSON</button>
              <button onClick={deleteActiveMediaProfile} disabled={!activeMediaProfile}>删除当前配置</button>
            </div>
          </div>
          <label>
            默认生图工具
            <select
              value={helpers.currentProviderMode(settings) === "comfy" ? "comfy" : helpers.currentProviderMode(settings) === "custom" ? "custom" : ""}
              onChange={(event) => {
                if (event.target.value === "comfy") patchMediaProviderMode("comfy");
                if (event.target.value === "custom") patchMediaProviderMode("custom");
              }}
            >
              <option value="" disabled>请选择 API 或 ComfyUI</option>
              <option value="custom">API</option>
              <option value="comfy">ComfyUI</option>
            </select>
          </label>
          <div className="quick-actions">
            <button className={helpers.currentProviderMode(settings) === "mock" ? "active" : ""} onClick={() => patchMediaProviderMode("mock")}>本地模拟</button>
            <button className={helpers.currentProviderMode(settings) === "custom" ? "active" : ""} onClick={() => patchMediaProviderMode("custom")}>HTTP API</button>
            <button className={helpers.currentProviderMode(settings) === "comfy" ? "active" : ""} onClick={() => patchMediaProviderMode("comfy")}>ComfyUI</button>
          </div>
          <div className="quick-actions">
            <button onClick={() => applyApiPreset("openai")}>OpenAI 图片格式</button>
            <button onClick={() => applyApiPreset("url")}>通用 URL 返回</button>
            <button onClick={() => applyApiPreset("base64")}>通用 Base64 返回</button>
            <button onClick={() => applyApiPreset("grsai-banana-pro-4k")}>GrsAI Banana Pro 4K</button>
          </div>
          <label>
            接口 URL
            <input value={settings.customApiUrl} onChange={(event) => patch({ customApiUrl: event.target.value })} placeholder="https://api.example.com/v1/images/generations" />
          </label>
          <label>
            API Key
            <input value={settings.customApiKey} onChange={(event) => patchImageApiKey(event.target.value)} placeholder={settings.customApiKeySaved ? "已保存到本地，留空会自动沿用" : "只需输入一次，保存后自动沿用"} type="password" />
          </label>
          <small className="settings-hint">{settings.customApiKeySaved ? "图片/视频 HTTP API Key 已保存在本机，生成时会自动使用。" : "输入一次图片/视频 API Key 后会立即保存到本机。"}</small>
          {settings.customApiKeySaved && <button className="settings-secondary" onClick={clearBackendApiKey}>清除已保存 API Key</button>}
          <label>
            认证方式
            <select value={settings.customAuthType} onChange={(event) => patch({ customAuthType: event.target.value })}>
              <option value="bearer">Authorization: Bearer</option>
              <option value="x-api-key">x-api-key</option>
              <option value="none">不自动添加</option>
            </select>
          </label>
          <label>
            模型
            <input value={settings.customModel} onChange={(event) => patch({ customModel: event.target.value })} placeholder="例如 gpt-image-1 / flux / nano-banana" />
          </label>
          <label>
            接口类型
            <select value={settings.customApiKind || "direct-image"} onChange={(event) => patch({ customApiKind: event.target.value })}>
              <option value="direct-image">直返图片接口</option>
              <option value="openai-compatible">OpenAI 兼容聊天接口</option>
              <option value="draw-poll">火山 Draw 轮询接口</option>
            </select>
          </label>
          <label>
            结果模式
            <select value={settings.customResultMode || "auto"} onChange={(event) => patch({ customResultMode: event.target.value })}>
              <option value="auto">自动识别</option>
              <option value="url">图片 URL</option>
              <option value="base64">Base64 图片</option>
              <option value="task-id">任务 ID + 轮询</option>
            </select>
          </label>
          <label>
            额外请求头 JSON
            <textarea className="small-textarea" value={settings.customHeadersJson} onChange={(event) => patch({ customHeadersJson: event.target.value })} placeholder='{"X-Provider":"demo"}' />
          </label>
          <label>
            请求体模板 JSON
            <textarea className="small-textarea" value={settings.customBodyTemplate} onChange={(event) => patch({ customBodyTemplate: event.target.value })} />
          </label>
          <label>
            结果图片路径
            <input value={settings.customImagePath} onChange={(event) => patch({ customImagePath: event.target.value })} placeholder="data.0.url 或 data.0.b64_json" />
          </label>
          <small className="settings-hint">
            {settings.customApiKind === "draw-poll"
              ? "火山 Draw 模式会先拿任务 ID，再轮询 draw/result。LinAPI / OpenAI 兼容层通常不支持这一模式。"
              : settings.customApiKind === "openai-compatible"
                ? "OpenAI 兼容聊天接口通常不会走 draw/result 轮询；如果你用的是 LinAPI，请优先选 url、base64 或 auto。"
                : "直返图片接口适合 `/images/generations` 或直接返回图片 URL/Base64 的服务。"}
          </small>
          {customApiValidationMessage && (
            <div className="settings-warning">
              <strong>请求前预检</strong>
              <p>{customApiValidationMessage}</p>
            </div>
          )}
          <button
            className="settings-test"
            onClick={testCustomApiWithReport}
            disabled={Boolean(customApiValidationMessage) || testing === "custom-api"}
          >
            {testing === "custom-api" ? "测试并生成报告中..." : "保存并测试自定义 API"}
          </button>
          {customApiDiagnostic && (
            <div className={`settings-diagnostic ${customApiDiagnostic.success ? "is-success" : "is-warning"}`}>
              <div className="settings-diagnostic-header">
                <strong>自定义图片 API 测试报告</strong>
                <span>{customApiDiagnostic.success ? "已拿到图片结果" : "已完成诊断"}</span>
              </div>
              <div className="quick-actions settings-diagnostic-actions">
                <button onClick={copyDiagnosticSummary}>复制结论</button>
                <button onClick={copyDiagnosticJson}>复制 JSON</button>
              </div>
              <div className="settings-diagnostic-grid">
                <section>
                  <span>接口识别</span>
                  <b>{customApiDiagnosticSummary?.apiKind || "direct-image"}</b>
                </section>
                <section>
                  <span>结果模式</span>
                  <b>{customApiDiagnosticSummary?.resultMode || "auto"}</b>
                </section>
                <section>
                  <span>首轮响应键摘要</span>
                  <b>{customApiDiagnosticSummary?.keySummary || "暂无"}</b>
                </section>
                <section>
                  <span>图片字段检测</span>
                  <b>{customApiDiagnosticSummary?.imageFieldStatus || "未检测到图片字段"}</b>
                </section>
                <section>
                  <span>任务 ID 检测</span>
                  <b>{customApiDiagnosticSummary?.taskFieldStatus || "未检测到任务 ID"}</b>
                </section>
                <section>
                  <span>轮询判断</span>
                  <b>{customApiDiagnosticSummary?.pollingStatus || "不会进入轮询"}</b>
                </section>
              </div>
              {customApiDiagnostic.firstResponseContentType && (
                <p className="settings-diagnostic-line">首轮 Content-Type：{customApiDiagnostic.firstResponseContentType}</p>
              )}
              {customApiDiagnosticSummary?.nestedKeySummary && customApiDiagnosticSummary.nestedKeySummary !== "暂无" && (
                <div className="settings-diagnostic-paths">
                  <span>首轮响应嵌套键路径样本</span>
                  <pre>{customApiDiagnosticSummary.nestedKeySummary}</pre>
                </div>
              )}
              {customApiDiagnostic.imagePreview && (
                <p className="settings-diagnostic-line">结果预览：{customApiDiagnostic.imagePreview}</p>
              )}
              {customApiDiagnostic.error && (
                <div className="settings-warning">
                  <strong>诊断结论</strong>
                  <p>{customApiDiagnostic.error}</p>
                </div>
              )}
            </div>
          )}
          {customApiDiagnosticHistory.length ? (
            <div className="settings-diagnostic-history">
              <div className="settings-diagnostic-history-header">
                <strong>最近测试历史</strong>
                <button className="settings-secondary" onClick={clearCustomApiDiagnosticHistory}>清空历史</button>
              </div>
              <div className="settings-diagnostic-history-list">
                {customApiDiagnosticHistory.map((entry) => {
                  const summary = helpers.summarizeCustomImageApiDiagnostic(entry.report || {});
                  return (
                    <section key={entry.id} className={`settings-history-item ${(entry.report?.success) ? "is-success" : "is-warning"}`}>
                      <div className="settings-history-item-top">
                        <strong>{entry.report?.success ? "测试成功" : "测试失败"}</strong>
                        <span>{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "-"}</span>
                      </div>
                      <p>{summary.apiKind} · {summary.resultMode}</p>
                      <p>{entry.model || "未填模型"} · {entry.apiUrl || "未填 URL"}</p>
                      <p>{summary.keySummary || "暂无响应键摘要"}</p>
                      <div className="quick-actions settings-history-actions">
                        <button onClick={() => restoreHistoryDiagnostic(entry)}>查看这次报告</button>
                        <button onClick={() => copyHistoryDiagnosticJson(entry)}>复制 JSON</button>
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
        <div className="settings-group" ref={videoGroupRef}>
          <h3>视频 API</h3>
          <div className="setup-steps">
            <span>1. 打开 ComfyUI</span>
            <span>2. 导出 API workflow JSON</span>
            <span>3. 导入后测试生图</span>
          </div>
          <label className="switch-row">
            <input type="checkbox" checked={settings.providerMode === "comfy" || settings.comfyEnabled} onChange={(event) => patchMediaProviderMode(event.target.checked ? "comfy" : "custom")} />
            图片/视频默认使用本地 ComfyUI
          </label>
          <label>
            ComfyUI 地址
            <input value={settings.comfyBaseUrl} onChange={(event) => patch({ comfyBaseUrl: event.target.value })} placeholder="http://127.0.0.1:8188" />
          </label>
          <div className="quick-actions">
            <button onClick={testComfyConnectionOnly} disabled={testing === "comfy-connect"}>{testing === "comfy-connect" ? "检测中..." : "检测连接"}</button>
            <button onClick={() => patchMediaProviderMode("comfy")}>设为图片/视频总开关</button>
          </div>
          <label>
            生图正向提示词节点 ID
            <input value={settings.comfyImagePositiveNodeId || settings.positiveNodeId || ""} onChange={(event) => patch({ comfyImagePositiveNodeId: event.target.value, positiveNodeId: event.target.value })} placeholder="例如 6" />
          </label>
          <label>
            生图工作流 JSON
            <textarea value={settings.comfyImageWorkflowJson || settings.workflowJson || ""} onChange={(event) => patchComfyWorkflow(event.target.value, "image")} placeholder="粘贴从 ComfyUI 导出的 API workflow JSON" />
          </label>
          <div className="quick-actions">
            <label className="file-action">导入生图工作流<input hidden type="file" accept=".json,application/json" onChange={(event) => helpers.readTextFile(event, (text) => patchComfyWorkflow(text, "image"))} /></label>
            <button onClick={() => {
              const detected = helpers.detectComfyPromptNodeId(settings.comfyImageWorkflowJson || settings.workflowJson || "");
              if (detected) patch({ comfyImagePositiveNodeId: detected, positiveNodeId: detected });
              setMessage(detected ? `已识别生图提示词节点：${detected}` : "未识别到提示词节点，请确认导出的是 API workflow JSON。");
            }}>自动识别节点</button>
          </div>
          <label>
            视频正向提示词节点 ID
            <input value={settings.comfyVideoPositiveNodeId} onChange={(event) => patch({ comfyVideoPositiveNodeId: event.target.value })} placeholder="例如 12" />
          </label>
          <label>
            视频工作流 JSON
            <textarea value={settings.comfyVideoWorkflowJson} onChange={(event) => patchComfyWorkflow(event.target.value, "video")} placeholder="粘贴 AnimateDiff / Wan / LTX / HunyuanVideo 等视频工作流的 API JSON" />
          </label>
          <div className="quick-actions">
            <label className="file-action">导入视频工作流<input hidden type="file" accept=".json,application/json" onChange={(event) => helpers.readTextFile(event, (text) => patchComfyWorkflow(text, "video"))} /></label>
            <button onClick={() => {
              const detected = helpers.detectComfyPromptNodeId(settings.comfyVideoWorkflowJson || "");
              if (detected) patch({ comfyVideoPositiveNodeId: detected });
              setMessage(detected ? `已识别视频提示词节点：${detected}` : "未识别到视频提示词节点。");
            }}>自动识别节点</button>
          </div>
          <label>
            ComfyUI 轮询超时秒数
            <input value={settings.comfyTimeoutSeconds} onChange={(event) => patch({ comfyTimeoutSeconds: event.target.value })} placeholder="图片 180，视频建议 900" />
          </label>
          <div className="settings-test-row">
            <button className="settings-test" onClick={async () => {
              await saveBackendConfig();
              await helpers.testComfyImage(settings);
            }}>测试 Comfy 生图</button>
            <button className="settings-test" onClick={async () => {
              await saveBackendConfig();
              await helpers.testComfyVideo(settings);
            }}>测试 Comfy 视频</button>
          </div>
        </div>
        <p>提示：浏览器直连第三方 API 可能遇到 CORS；接入 Tauri 后端后可统一代理请求并安全保存密钥。</p>
      </section>
    </div>
  );
}
