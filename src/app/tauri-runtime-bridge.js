let coreModulePromise = null;
let eventModulePromise = null;

function loadCoreModule() {
  if (!coreModulePromise) coreModulePromise = import("@tauri-apps/api/core");
  return coreModulePromise;
}

function loadEventModule() {
  if (!eventModulePromise) eventModulePromise = import("@tauri-apps/api/event");
  return eventModulePromise;
}

export function convertFileSrc(filePath, protocol = "asset") {
  const path = String(filePath || "");
  if (typeof window === "undefined") return path;
  const internals = window.__TAURI_INTERNALS__;
  if (internals?.convertFileSrc) {
    try {
      return internals.convertFileSrc(path, protocol);
    } catch {
      return path;
    }
  }
  return path;
}

export async function invokeTauri(command, payload) {
  const mod = await loadCoreModule();
  return mod.invoke(command, payload);
}

export async function listenTauri(event, handler) {
  const mod = await loadEventModule();
  return mod.listen(event, handler);
}
