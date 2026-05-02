export function emptyApiKeyVault() {
  return { text: "", image: "" };
}

export function loadApiKeyVaultFromStorage({ storage, storageKey, tauriRuntime = false }) {
  if (tauriRuntime) {
    safeRemove(storage, storageKey);
    return emptyApiKeyVault();
  }

  try {
    const raw = storage?.getItem(storageKey);
    const vault = raw ? JSON.parse(raw) : {};
    return normalizeApiKeyVault(vault);
  } catch {
    return emptyApiKeyVault();
  }
}

export function saveApiKeyVaultToStorage(vault, { storage, storageKey, tauriRuntime = false, now = () => new Date() }) {
  if (tauriRuntime) {
    safeRemove(storage, storageKey);
    return;
  }

  try {
    storage?.setItem(storageKey, JSON.stringify({
      ...normalizeApiKeyVault(vault),
      updatedAt: now().toISOString(),
    }));
  } catch {
    // Browser storage can fail when quota is full or unavailable.
  }
}

export function rememberApiKeyInVault(kind, value, options) {
  const key = String(value || "").trim();
  if (!key) return;
  const vault = loadApiKeyVaultFromStorage(options);
  saveApiKeyVaultToStorage({ ...vault, [kind]: key }, options);
}

export function forgetApiKeyInVault(kind, options) {
  const vault = loadApiKeyVaultFromStorage(options);
  saveApiKeyVaultToStorage({ ...vault, [kind]: "" }, options);
}

export function applyImageApiKeyVault(settings, vault) {
  const normalized = normalizeApiKeyVault(vault);
  if (!normalized.image) return settings;
  return {
    ...settings,
    customApiKey: settings.customApiKey || normalized.image,
    customApiKeySaved: true,
  };
}

export function applyNovelApiKeyVault(settings, vault) {
  const normalized = normalizeApiKeyVault(vault);
  if (!normalized.text) return settings;
  return {
    ...settings,
    apiKey: settings.apiKey || normalized.text,
    apiKeySaved: true,
  };
}

export function hasSavedApiKey(settings, vault, kind) {
  const normalized = normalizeApiKeyVault(vault);
  const value = kind === "image" ? normalized.image : normalized.text;
  return !settings.apiKeyClear && (settings.apiKeySaved || Boolean(settings.apiKey) || Boolean(settings.customApiKey) || Boolean(value));
}

function normalizeApiKeyVault(vault) {
  return {
    text: String(vault?.text || ""),
    image: String(vault?.image || ""),
  };
}

function safeRemove(storage, storageKey) {
  try {
    storage?.removeItem(storageKey);
  } catch {
    // Ignore storage cleanup failures; the runtime should keep operating.
  }
}
