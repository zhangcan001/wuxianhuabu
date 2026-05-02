import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const configPath = path.join(root, "src-tauri", "tauri.conf.json");
const packagePath = path.join(root, "package.json");
const smokePath = path.join(root, "scripts", "studio-smoke.mjs");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const csp = String(config.app?.security?.csp || "");
const issues = [];
if (csp.includes("'unsafe-eval'")) issues.push("release CSP must not allow unsafe-eval");
if (/default-src[^;]*https:/.test(csp)) issues.push("release default-src must not allow all https");
if (!/script-src\s+'self'/.test(csp)) issues.push("release CSP must include script-src 'self'");
if (!config.app?.security?.assetProtocol?.scope?.length) issues.push("asset protocol scope is missing");
if (!String(packageJson.scripts?.["test:e2e:studio"] || "").includes("scripts/studio-smoke.mjs")) {
  issues.push("package.json must expose the studio smoke test");
}
if (!fs.existsSync(smokePath)) {
  issues.push("studio smoke test script is missing");
} else {
  const smokeSource = fs.readFileSync(smokePath, "utf8");
  if (!smokeSource.includes(".product-shell")) issues.push("studio smoke must verify the production workbench shell");
  if (!smokeSource.includes(".delivery-work-panel")) issues.push("studio smoke must verify the delivery panel");
  if (!smokeSource.includes("mobileOverflow")) issues.push("studio smoke must verify mobile horizontal overflow");
}

if (issues.length) {
  console.error(JSON.stringify({ ok: false, issues }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, csp: "release-strict", studioSmoke: "configured" }));
