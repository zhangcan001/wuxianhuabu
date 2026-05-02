import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const configPath = path.join(root, "src-tauri", "tauri.conf.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const csp = String(config.app?.security?.csp || "");
const issues = [];
if (csp.includes("'unsafe-eval'")) issues.push("release CSP must not allow unsafe-eval");
if (/default-src[^;]*https:/.test(csp)) issues.push("release default-src must not allow all https");
if (!/script-src\s+'self'/.test(csp)) issues.push("release CSP must include script-src 'self'");
if (!config.app?.security?.assetProtocol?.scope?.length) issues.push("asset protocol scope is missing");

if (issues.length) {
  console.error(JSON.stringify({ ok: false, issues }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, csp: "release-strict" }));
