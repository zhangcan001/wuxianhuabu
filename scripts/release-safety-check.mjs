import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const configPath = path.join(root, "src-tauri", "tauri.conf.json");
const packagePath = path.join(root, "package.json");
const cargoPath = path.join(root, "src-tauri", "Cargo.toml");
const smokePath = path.join(root, "scripts", "studio-smoke.mjs");
const smokePreviewPath = path.join(root, "scripts", "run-studio-smoke-preview.mjs");
const desktopSmokePath = path.join(root, "scripts", "desktop-release-smoke.mjs");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const cargoToml = fs.readFileSync(cargoPath, "utf8");
const csp = String(config.app?.security?.csp || "");
const nsis = config.bundle?.windows?.nsis || {};
const issues = [];
const cargoVersion = cargoToml.match(/^version\s*=\s*"([^"]+)"/m)?.[1] || "";
if (csp.includes("'unsafe-eval'")) issues.push("release CSP must not allow unsafe-eval");
if (/default-src[^;]*https:/.test(csp)) issues.push("release default-src must not allow all https");
if (!/script-src\s+'self'/.test(csp)) issues.push("release CSP must include script-src 'self'");
if (!config.app?.security?.assetProtocol?.scope?.length) issues.push("asset protocol scope is missing");
if (packageJson.version !== config.version) issues.push("package.json and tauri.conf.json versions must match");
if (packageJson.version !== cargoVersion) issues.push("package.json and src-tauri/Cargo.toml versions must match");
if (!String(packageJson.scripts?.["release:build"] || "").includes("test:release")) {
  issues.push("package.json release:build must run test:release before tauri build");
}
if (!Array.isArray(config.bundle?.targets) || !config.bundle.targets.includes("nsis")) {
  issues.push("release bundle must include nsis target");
}
if (nsis.installerIcon !== "icons/icon.ico") issues.push("NSIS installer icon must use the app icon");
if (nsis.installMode !== "currentUser") issues.push("NSIS installMode must default to currentUser");
if (!Array.isArray(nsis.languages) || !nsis.languages.includes("SimpChinese")) {
  issues.push("NSIS installer must include Simplified Chinese language");
}
if (!nsis.startMenuFolder) issues.push("NSIS startMenuFolder must be configured");
if (!String(packageJson.scripts?.["test:e2e:studio"] || "").includes("scripts/studio-smoke.mjs")) {
  issues.push("package.json must expose the studio smoke test");
}
if (!String(packageJson.scripts?.["test:e2e:studio:preview"] || "").includes("run-studio-smoke-preview.mjs")) {
  issues.push("package.json must expose the preview-backed studio smoke test");
}
if (!String(packageJson.scripts?.["test:release"] || "").includes("bundle:check")) {
  issues.push("package.json test:release must include bundle budget checks");
}
if (!String(packageJson.scripts?.["test:release"] || "").includes("test:release-safety")) {
  issues.push("package.json test:release must include release safety checks");
}
if (!String(packageJson.scripts?.["test:desktop-smoke"] || "").includes("desktop-release-smoke.mjs")) {
  issues.push("package.json must expose the desktop release smoke test");
}
if (!fs.existsSync(smokePath)) {
  issues.push("studio smoke test script is missing");
} else {
  const smokeSource = fs.readFileSync(smokePath, "utf8");
  if (!smokeSource.includes(".product-shell")) issues.push("studio smoke must verify the production workbench shell");
  if (!smokeSource.includes(".delivery-work-panel")) issues.push("studio smoke must verify the delivery panel");
  if (!smokeSource.includes("mobileOverflow")) issues.push("studio smoke must verify mobile horizontal overflow");
}
if (!fs.existsSync(smokePreviewPath)) {
  issues.push("preview-backed studio smoke runner is missing");
} else {
  const previewSmokeSource = fs.readFileSync(smokePreviewPath, "utf8");
  if (!previewSmokeSource.includes("--strictPort")) issues.push("preview-backed studio smoke must use a strict preview port");
  if (!previewSmokeSource.includes("test:e2e:studio")) issues.push("preview-backed studio smoke must run the studio smoke script");
}
if (!fs.existsSync(desktopSmokePath)) {
  issues.push("desktop release smoke script is missing");
} else {
  const desktopSmokeSource = fs.readFileSync(desktopSmokePath, "utf8");
  if (!desktopSmokeSource.includes("wuxianhuabu.exe")) issues.push("desktop smoke must verify the release exe");
  if (!desktopSmokeSource.includes("x64-setup.exe")) issues.push("desktop smoke must verify the NSIS installer");
}

if (issues.length) {
  console.error(JSON.stringify({ ok: false, issues }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({
  ok: true,
  csp: "release-strict",
  studioSmoke: "configured",
  versions: "synced",
  nsis: "configured",
}));
