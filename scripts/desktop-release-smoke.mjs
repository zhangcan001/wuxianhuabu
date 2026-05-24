import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const config = JSON.parse(fs.readFileSync(path.join(root, "src-tauri", "tauri.conf.json"), "utf8"));
const productName = config.productName || "wuxianhuabu";
const version = config.version || "0.0.0";
const exePath = path.join(root, "src-tauri", "target", "release", "wuxianhuabu.exe");
const nsisPath = path.join(root, "src-tauri", "target", "release", "bundle", "nsis", `${productName}_${version}_x64-setup.exe`);
const checks = [
  { key: "releaseExe", path: exePath },
  { key: "nsisInstaller", path: nsisPath },
];
const results = checks.map((check) => {
  const exists = fs.existsSync(check.path);
  const size = exists ? fs.statSync(check.path).size : 0;
  return {
    ...check,
    exists,
    size,
    ok: exists && size > 1024 * 1024,
  };
});
const issues = results.filter((item) => !item.ok).map((item) => `${item.key} missing or too small: ${item.path}`);
if (!Array.isArray(config.bundle?.targets) || !config.bundle.targets.includes("nsis")) {
  issues.push("tauri bundle targets must include nsis");
}
if (config.bundle?.windows?.nsis?.installMode !== "currentUser") {
  issues.push("NSIS installMode must be currentUser");
}

if (issues.length) {
  console.error(JSON.stringify({ ok: false, issues, results }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, productName, version, results }, null, 2));
