import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const args = process.argv.slice(2);
const runBuild = args.includes("--run");
const exePath = path.join(root, "src-tauri", "target", "release", "wuxianhuabu.exe");

if (runBuild) {
  const result = spawnSync("npx", ["tauri", "build", "--no-bundle"], { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status || 1);
}

const exists = fs.existsSync(exePath);
console.log(JSON.stringify({ ok: runBuild ? exists : true, checked: exePath, exists, mode: runBuild ? "build" : "dry-run" }));
if (runBuild && !exists) process.exit(1);
