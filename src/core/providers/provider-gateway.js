export function createProviderGateway(providers = [], options = {}) {
  const registry = new Map();
  (Array.isArray(providers) ? providers : []).forEach((provider) => {
    if (!provider?.id) return;
    registry.set(provider.id, normalizeProvider(provider));
  });
  return {
    registry,
    defaultProviderByCapability: options.defaultProviderByCapability || {},
  };
}

export function registerProvider(gateway = createProviderGateway(), provider = {}) {
  const next = createProviderGateway([...gateway.registry.values()], {
    defaultProviderByCapability: gateway.defaultProviderByCapability,
  });
  if (provider?.id) next.registry.set(provider.id, normalizeProvider(provider));
  return next;
}

export function listProviders(gateway = createProviderGateway(), capability = "") {
  const providers = [...gateway.registry.values()];
  return capability ? providers.filter((provider) => provider.capabilities.includes(capability)) : providers;
}

export function resolveProvider(gateway = createProviderGateway(), request = {}) {
  const preferred = request.providerId || gateway.defaultProviderByCapability?.[request.capability || request.type] || "";
  if (preferred && gateway.registry.has(preferred)) return gateway.registry.get(preferred);
  return listProviders(gateway, request.capability || request.type)[0] || null;
}

export async function runProviderRequest(gateway = createProviderGateway(), request = {}) {
  const provider = resolveProvider(gateway, request);
  if (!provider) {
    return {
      ok: false,
      providerId: "",
      error: normalizeProviderError(new Error(`No provider for ${request.capability || request.type || "request"}`)),
    };
  }
  try {
    const validation = await provider.validateInput(request.input || {}, request);
    if (validation?.ok === false) {
      return {
        ok: false,
        providerId: provider.id,
        error: normalizeProviderError(validation.error || "Provider input validation failed"),
      };
    }
    const estimate = await provider.estimate(request.input || {}, request);
    const raw = await provider.run(request.input || {}, request);
    const output = await provider.parseResult(raw, request);
    return {
      ok: true,
      providerId: provider.id,
      capability: request.capability || request.type || "",
      estimate,
      output,
      raw,
    };
  } catch (error) {
    return {
      ok: false,
      providerId: provider.id,
      error: normalizeProviderError(provider.normalizeError(error, request)),
    };
  }
}

export function createMockProvider(input = {}) {
  return normalizeProvider({
    id: input.id || "mock-provider",
    label: input.label || "Mock Provider",
    capabilities: input.capabilities || ["text", "image", "video", "render"],
    estimate: input.estimate || (() => ({ cost: 0, tokens: 0 })),
    validateInput: input.validateInput || ((payload) => ({ ok: Boolean(String(payload.prompt || payload.text || payload.source || "ok").trim()) })),
    run: input.run || ((payload) => ({ url: payload.url || "mock://result", text: payload.text || payload.prompt || "" })),
    parseResult: input.parseResult || ((raw) => raw),
    normalizeError: input.normalizeError || ((error) => error),
  });
}

export function normalizeProviderError(error = "") {
  const message = error?.message || String(error || "Provider request failed");
  return {
    message,
    code: error?.code || "PROVIDER_ERROR",
    retryable: Boolean(error?.retryable),
    detail: error?.detail || "",
  };
}

function normalizeProvider(provider = {}) {
  return {
    id: provider.id || "",
    label: provider.label || provider.id || "Provider",
    capabilities: Array.isArray(provider.capabilities) ? provider.capabilities : [],
    estimate: provider.estimate || (() => ({ cost: 0 })),
    validateInput: provider.validateInput || (() => ({ ok: true })),
    run: provider.run || (() => {
      throw new Error("Provider run is not implemented");
    }),
    parseResult: provider.parseResult || ((raw) => raw),
    normalizeError: provider.normalizeError || ((error) => error),
  };
}
