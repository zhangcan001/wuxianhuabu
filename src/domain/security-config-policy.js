export function buildSecurityConfigReport(config = {}, mode = "release") {
  const csp = String(config.app?.security?.csp || config.csp || "");
  const issues = [];
  if (mode === "release" && /'unsafe-eval'/.test(csp)) issues.push("unsafe-eval");
  if (mode === "release" && /default-src[^;]*https:/.test(csp)) issues.push("default-src-https");
  if (!/script-src\s+'self'/.test(csp)) issues.push("script-src-self");
  if (!config.app?.security?.assetProtocol?.scope?.length && !config.assetScope?.length) issues.push("asset-scope");
  return {
    ok: issues.length === 0,
    mode,
    issues,
    allowsLocalhost: /localhost|127\.0\.0\.1/.test(csp),
  };
}

export function buildDevSecurityConfig(base = {}) {
  return {
    ...base,
    mode: "dev",
    csp: "default-src 'self' asset: data: blob: http://asset.localhost http://127.0.0.1:* http://localhost:*; connect-src 'self' ipc: http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:* https:; script-src 'self';",
  };
}

export function buildReleaseSecurityConfig(base = {}) {
  return {
    ...base,
    mode: "release",
    csp: "default-src 'self' asset: data: blob: http://asset.localhost; connect-src 'self' ipc: http://asset.localhost https:; script-src 'self';",
  };
}
