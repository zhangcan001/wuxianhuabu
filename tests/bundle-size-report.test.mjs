import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { collectBundleAssets } from "../scripts/bundle-size-report.mjs";

test("collectBundleAssets lists js and css assets sorted by size", () => {
  const dir = mkdtempSync(join(tmpdir(), "bundle-report-"));
  try {
    writeFileSync(join(dir, "small.css"), "abc");
    writeFileSync(join(dir, "large.js"), "abcdef");
    writeFileSync(join(dir, "ignore.png"), "abcdefghi");

    const files = collectBundleAssets(dir);

    assert.equal(files.length, 2);
    assert.match(files[0].file, /large\.js$/);
    assert.equal(files[0].bytes, 6);
    assert.match(files[1].file, /small\.css$/);
    assert.equal(files[1].bytes, 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
