import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProjectResourceIndex,
  createProjectResourceFromFile,
  expandResourceReferences,
  extractResourceTokens,
  formatBytes,
  normalizeProjectResource,
  parseDurationSeconds,
  resourceKindLabel,
  resourceKindShort,
  resourceMatchesQuery,
} from "../src/project-resource-helpers.js";

test("normalizeProjectResource fills defaults and preserves episode", () => {
  const resource = normalizeProjectResource({
    name: "角色设定图",
    mimeType: "image/png",
  }, "ep-1", 0);

  assert.equal(resource.name, "角色设定图");
  assert.equal(resource.kind, "image");
  assert.equal(resource.episodeId, "ep-1");
  assert.equal(resource.token, "@资源_角色设定图");
});

test("buildProjectResourceIndex tracks references and missing tokens", () => {
  const resources = [
    normalizeProjectResource({ name: "角色设定图", token: "@资源_角色设定图", kind: "image" }, "ep-1", 0),
  ];
  const nodes = [
    {
      id: "node-1",
      type: "shotList",
      data: {
        displayName: "镜头表",
        episodeId: "ep-1",
        shots: [
          { imagePrompt: "参考 @资源_角色设定图", note: "补一个 @资源_缺失文档" },
        ],
      },
    },
  ];
  const index = buildProjectResourceIndex(resources, nodes, [{ id: "ep-1", name: "第 1 集" }], "ep-1", {
    nodeTypeLabel: () => "镜头表",
  });

  assert.equal(index.items[0].referenceCount, 1);
  assert.deepEqual(index.items[0].references[0], {
    token: "@资源_角色设定图",
    nodeId: "node-1",
    nodeTitle: "镜头表",
    nodeType: "shotList",
    episodeId: "ep-1",
    path: "镜头 / #1 / 图片提示词",
  });
  assert.equal(index.missingRefs.length, 1);
  assert.equal(index.missingRefs[0].token, "@资源_缺失文档");
});

test("resource helpers keep query and display formatting stable", () => {
  const resource = normalizeProjectResource({
    name: "A 场景",
    token: "@资源_A场景",
    kind: "reference",
    note: "夜景街道",
    tags: "场景 夜景",
  }, "", 0);

  assert.equal(resourceMatchesQuery(resource, "夜景"), true);
  assert.equal(resourceMatchesQuery(resource, "白天"), false);
  assert.deepEqual(extractResourceTokens("用 @资源_A场景 和 @资源_A场景"), ["@资源_A场景"]);
  assert.equal(resourceKindLabel("unknown"), "参考");
  assert.equal(resourceKindShort("template"), "TPL");
  assert.equal(formatBytes(1536), "1.50 KB");
  assert.equal(parseDurationSeconds("4.5秒"), 4.5);
});

test("expandResourceReferences appends note text for known tokens", () => {
  const text = expandResourceReferences("参考 @资源_A场景", {
    items: [
      { token: "@资源_A场景", note: "夜景街道" },
    ],
  });

  assert.equal(text, "参考 @资源_A场景：夜景街道");
});

test("createProjectResourceFromFile can persist binary resources into local files", async () => {
  const file = {
    name: "角色设定.png",
    type: "image/png",
    size: 1024,
  };
  const previousFileReader = globalThis.FileReader;
  try {
    globalThis.FileReader = class MockFileReader {
      readAsDataURL() {
        this.result = "data:image/png;base64,abc";
        this.onload?.();
      }
    };
    const resource = await createProjectResourceFromFile(file, "ep-1", {
      persistMediaAsset: async () => ({
        mediaUrl: "asset://C:/cache/resource.png",
        mediaPath: "C:/cache/resource.png",
        thumbnailUrl: "asset://C:/cache/resource-thumb.png",
        thumbnailPath: "C:/cache/resource-thumb.png",
      }),
    });
    assert.equal(resource.storageMode, "file");
    assert.equal(resource.previewUrl, "asset://C:/cache/resource.png");
    assert.equal(resource.filePath, "C:/cache/resource.png");
    assert.equal(resource.thumbnailUrl, "asset://C:/cache/resource-thumb.png");
    assert.equal(resource.thumbnailPath, "C:/cache/resource-thumb.png");
    assert.equal(resource.dataUrl, undefined);
  } finally {
    globalThis.FileReader = previousFileReader;
  }
});
