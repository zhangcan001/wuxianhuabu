import { API_KEY_VAULT_KEY } from "./app-constants.js";
import { isTauriRuntime } from "./runtime-helpers.js";
import {
  applyImageApiKeyVault,
  applyNovelApiKeyVault,
  forgetApiKeyInVault,
  loadApiKeyVaultFromStorage,
  rememberApiKeyInVault,
} from "../storage/storage-helpers.js";

export function loadApiKeyVault() {
  return loadApiKeyVaultFromStorage({ storage: localStorage, storageKey: API_KEY_VAULT_KEY, tauriRuntime: isTauriRuntime() });
}

export function rememberApiKey(kind, value) {
  rememberApiKeyInVault(kind, value, { storage: localStorage, storageKey: API_KEY_VAULT_KEY, tauriRuntime: isTauriRuntime() });
}

export function forgetApiKey(kind) {
  forgetApiKeyInVault(kind, { storage: localStorage, storageKey: API_KEY_VAULT_KEY, tauriRuntime: isTauriRuntime() });
}

export function applyApiKeyVaultToImageSettings(settings) {
  return applyImageApiKeyVault(settings, loadApiKeyVault());
}

export function applyApiKeyVaultToNovelSettings(settings) {
  return applyNovelApiKeyVault(settings, loadApiKeyVault());
}
