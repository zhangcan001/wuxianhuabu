import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const assetsDir = join(root, "dist", "assets");

export function collectBundleAssets(dir = assetsDir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => /\.(js|css)$/.test(name))
    .map((name) => {
      const path = join(dir, name);
      const size = statSync(path).size;
      return {
        file: relative(root, path).replaceAll("\\", "/"),
        bytes: size,
        kb: Number((size / 1024).toFixed(2)),
      };
    })
    .sort((a, b) => b.bytes - a.bytes);
}

export function printBundleSizeReport(files = collectBundleAssets()) {
  if (!files.length) {
    console.log("No bundle assets found. Run npm run build first.");
    return;
  }
  console.log("Bundle size report:");
  for (const file of files) {
    console.log(`${file.kb.toFixed(2).padStart(9)} kB  ${file.file}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  printBundleSizeReport();
}
