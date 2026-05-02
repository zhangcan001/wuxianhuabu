import assert from "node:assert/strict";
import test from "node:test";
import {
  appendMediaResource,
  buildProjectResourceRegistry,
  normalizeProjectResourceRecord,
} from "../src/app/resource-registry.js";

test("resource registry collects asset and shot media into resource records", () => {
  const registry = buildProjectResourceRegistry({
    id: "p1",
    episodes: [{
      id: "e1",
      assets: [{ token: "@角色_林舟", type: "character", imageUrl: "asset://lin.png", imagePath: "C:/cache/lin.png" }],
      shots: [{ id: "S01", imageUrl: "asset://s01.png", videoUrl: "asset://s01.mp4" }],
    }],
  });

  assert.equal(registry.summary.total, 3);
  assert.equal(registry.summary.images, 2);
  assert.equal(registry.summary.videos, 1);
  assert.equal(registry.summary.byTargetType.asset, 1);
  assert.equal(registry.summary.byTargetType.shot, 2);
});

test("resource registry preserves display url and export path separately", () => {
  const resource = normalizeProjectResourceRecord({
    target: { type: "shot", id: "S01" },
    imageUrl: "asset://s01.png",
    imagePath: "C:/cache/s01.png",
    imageThumbnailUrl: "asset://s01-thumb.png",
  }, { projectId: "p1", episodeId: "e1" });

  assert.equal(resource.kind, "image");
  assert.equal(resource.url, "asset://s01.png");
  assert.equal(resource.path, "C:/cache/s01.png");
  assert.equal(resource.thumbnailUrl, "asset://s01-thumb.png");
});

test("resource registry dedupes appended media resources", () => {
  const resources = appendMediaResource([], {
    id: "r1",
    kind: "video",
    target: { type: "shot", id: "S01" },
    videoUrl: "asset://s01.mp4",
  });
  const next = appendMediaResource(resources, {
    id: "r1",
    kind: "video",
    target: { type: "shot", id: "S01" },
    videoUrl: "asset://s01.mp4",
    videoPath: "C:/cache/s01.mp4",
  });

  assert.equal(next.length, 1);
  assert.equal(next[0].path, "C:/cache/s01.mp4");
});
