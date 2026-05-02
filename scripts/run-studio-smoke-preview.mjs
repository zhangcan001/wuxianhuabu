import { spawn, spawnSync } from "node:child_process";
import path from "node:path";

const host = "127.0.0.1";
const port = process.env.STUDIO_SMOKE_PORT || "5175";
const url = `http://${host}:${port}/`;
const smokeTimeoutMs = Number(process.env.STUDIO_SMOKE_TIMEOUT_MS || 90000);

const preview = spawnNpm([
  "run",
  "preview",
  "--",
  "--port",
  port,
  "--strictPort",
], {
  stdio: ["ignore", "pipe", "pipe"],
});

let settled = false;
preview.stdout?.on("data", (chunk) => process.stdout.write(chunk));
preview.stderr?.on("data", (chunk) => process.stderr.write(chunk));

const shutdown = () => {
  killTree(preview);
};

process.on("exit", shutdown);
process.on("SIGINT", () => {
  shutdown();
  process.exit(130);
});

try {
  await waitForPreview(url);
  const smoke = spawnNpm([
    "run",
    "test:e2e:studio",
    "--",
    url,
  ], {
    stdio: "inherit",
  });
  const code = await waitForExit(smoke, smokeTimeoutMs);
  settled = true;
  process.exitCode = code;
} finally {
  shutdown();
}

preview.on("exit", (code) => {
  if (!settled && code) {
    console.error(`Preview server exited before smoke completed: ${code}`);
    process.exitCode = code;
  }
});

async function waitForPreview(targetUrl) {
  const startedAt = Date.now();
  const timeoutMs = 30000;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(targetUrl);
      if (response.ok) return;
    } catch {
      // Vite preview is still booting.
    }
    await delay(300);
  }
  throw new Error(`Timed out waiting for preview at ${targetUrl}`);
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      killTree(child);
      console.error(`Studio smoke timed out after ${timeoutMs}ms`);
      resolve(124);
    }, timeoutMs);
    child.on("exit", (code) => resolve(code || 0));
    child.on("exit", () => clearTimeout(timeout));
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function spawnNpm(args, options = {}) {
  const npmCli = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  return spawn(process.execPath, [npmCli, ...args], options);
}

function killTree(child) {
  if (!child || child.killed) return;
  if (process.platform === "win32" && child.pid) {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  child.kill();
}
