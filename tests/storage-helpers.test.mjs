import assert from "node:assert/strict";
import test from "node:test";
import {
  applyImageApiKeyVault,
  applyNovelApiKeyVault,
  forgetApiKeyInVault,
  hasSavedApiKey,
  loadApiKeyVaultFromStorage,
  rememberApiKeyInVault,
  saveApiKeyVaultToStorage,
} from "../src/storage/storage-helpers.js";

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    dump: () => Object.fromEntries(values.entries()),
  };
}

test("browser storage remembers and loads API keys", () => {
  const storage = memoryStorage();
  const options = { storage, storageKey: "vault", now: () => new Date("2026-04-23T00:00:00.000Z") };

  saveApiKeyVaultToStorage({ text: "sk-text", image: "sk-image" }, options);

  assert.deepEqual(loadApiKeyVaultFromStorage(options), {
    text: "sk-text",
    image: "sk-image",
  });
  assert.equal(JSON.parse(storage.dump().vault).updatedAt, "2026-04-23T00:00:00.000Z");
});

test("tauri runtime clears local vault instead of persisting secrets", () => {
  const storage = memoryStorage({ vault: JSON.stringify({ text: "old", image: "old-img" }) });
  const options = { storage, storageKey: "vault", tauriRuntime: true };

  assert.deepEqual(loadApiKeyVaultFromStorage(options), { text: "", image: "" });
  rememberApiKeyInVault("text", "new-secret", options);

  assert.deepEqual(storage.dump(), {});
});

test("remember and forget update only the selected key", () => {
  const storage = memoryStorage();
  const options = { storage, storageKey: "vault" };

  rememberApiKeyInVault("text", "  text-key  ", options);
  rememberApiKeyInVault("image", "image-key", options);
  forgetApiKeyInVault("text", options);

  assert.deepEqual(loadApiKeyVaultFromStorage(options), {
    text: "",
    image: "image-key",
  });
});

test("vault values are applied without overwriting explicit settings", () => {
  assert.deepEqual(applyImageApiKeyVault({ customApiKey: "", customApiKeySaved: false }, { image: "img-key" }), {
    customApiKey: "img-key",
    customApiKeySaved: true,
  });
  assert.deepEqual(applyNovelApiKeyVault({ apiKey: "manual", apiKeySaved: false }, { text: "vault-text" }), {
    apiKey: "manual",
    apiKeySaved: true,
  });
});

test("saved-key status respects clear requests", () => {
  assert.equal(hasSavedApiKey({ apiKeyClear: true, apiKey: "secret" }, { text: "vault" }, "text"), false);
  assert.equal(hasSavedApiKey({ apiKeySaved: false, apiKey: "" }, { text: "vault" }, "text"), true);
  assert.equal(hasSavedApiKey({ customApiKey: "image-secret" }, { image: "" }, "image"), true);
});
