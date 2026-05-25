export const ONBOARDING_VERSION = 1;

export function defaultOnboardingState() {
  return {
    version: ONBOARDING_VERSION,
    completed: false,
    skipped: false,
    selectedMode: null,
    loadedExample: false,
    completedAt: 0,
  };
}

export function normalizeOnboardingState(raw) {
  const base = defaultOnboardingState();
  if (!raw || typeof raw !== "object") return base;
  return {
    ...base,
    completed: Boolean(raw.completed),
    skipped: Boolean(raw.skipped),
    selectedMode: typeof raw.selectedMode === "string" ? raw.selectedMode : null,
    loadedExample: Boolean(raw.loadedExample),
    completedAt: Number(raw.completedAt) || 0,
  };
}

export function loadOnboardingState({ storage = null, storageKey } = {}) {
  if (!storage || !storageKey) return defaultOnboardingState();
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return defaultOnboardingState();
    return normalizeOnboardingState(JSON.parse(raw));
  } catch {
    return defaultOnboardingState();
  }
}

export function saveOnboardingState(state, { storage = null, storageKey } = {}) {
  if (!storage || !storageKey) return;
  try {
    storage.setItem(storageKey, JSON.stringify(normalizeOnboardingState(state)));
  } catch {
    // ignore storage errors
  }
}

export function shouldShowOnboarding(state, { hasProjectData = false } = {}) {
  const normalized = normalizeOnboardingState(state);
  if (normalized.completed || normalized.skipped) return false;
  if (hasProjectData) return false;
  return true;
}

export function markOnboardingCompleted(prev, { mode = null, loadedExample = false } = {}) {
  return {
    ...normalizeOnboardingState(prev),
    completed: true,
    skipped: false,
    selectedMode: mode,
    loadedExample: Boolean(loadedExample),
    completedAt: Date.now(),
  };
}

export function markOnboardingSkipped(prev) {
  return {
    ...normalizeOnboardingState(prev),
    completed: false,
    skipped: true,
    completedAt: Date.now(),
  };
}

export function resetOnboardingState() {
  return defaultOnboardingState();
}
