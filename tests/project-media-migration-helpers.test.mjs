import assert from "node:assert/strict";
import test from "node:test";
import {
  isEmbeddedImageUrl,
  migrateProjectEmbeddedImages,
} from "../src/project-media-migration-helpers.js";

test("embedded image detector only matches image data urls", () => {
  assert.equal(isEmbeddedImageUrl("data:image/png;base64,abc"), true);
  assert.equal(isEmbeddedImageUrl("data:video/mp4;base64,abc"), false);
  assert.equal(isEmbeddedImageUrl("https://example.com/a.png"), false);
});

test("project media migration persists node, asset and resource embedded images", async () => {
  const dataUrl = "data:image/png;base64,abc";
  const resourceUrl = "data:image/png;base64,res";
  const calls = [];
  const { project, migratedCount } = await migrateProjectEmbeddedImages({
    nodes: [
      { id: "upload-1", type: "upload", data: { imageUrl: dataUrl } },
      {
        id: "asset-1",
        type: "assetLibrary",
        data: {
          characters: [
            {
              name: "主角",
              imageUrl: dataUrl,
              images: [dataUrl, "https://cdn.example.com/a.png"],
              rejectedImages: ["data:image/png;base64,bad"],
            },
          ],
        },
      },
    ],
    resources: [
      { id: "r1", kind: "image", dataUrl: resourceUrl, previewUrl: resourceUrl, storageMode: "embedded" },
    ],
  }, {
    persistImage: async ({ imageUrl, fileName }) => {
      calls.push({ imageUrl, fileName });
      const suffix = calls.length;
      return {
        imageUrl: `asset://image-${suffix}.png`,
        imagePath: `C:/cache/image-${suffix}.png`,
        originalImageUrl: imageUrl,
        imageThumbnailUrl: `asset://thumb-${suffix}.png`,
        imageThumbnailPath: `C:/cache/thumb-${suffix}.png`,
      };
    },
  });

  assert.equal(migratedCount, 5);
  assert.equal(project.nodes[0].data.imageUrl, "asset://image-1.png");
  assert.equal(project.nodes[0].data.imagePath, "C:/cache/image-1.png");
  const asset = project.nodes[1].data.characters[0];
  assert.equal(asset.imageUrl, "asset://image-1.png");
  assert.equal(asset.imageItems[0].imagePath, "C:/cache/image-1.png");
  assert.equal(asset.images.includes("data:image/png;base64,abc"), false);
  assert.equal(asset.rejectedImageItems[0].originalImageUrl, "data:image/png;base64,bad");
  assert.equal(project.resources[0].dataUrl, "");
  assert.equal(project.resources[0].filePath, "C:/cache/image-3.png");
  assert.equal(project.resources[0].storageMode, "file");
});

test("project media migration can be disabled outside tauri", async () => {
  const original = { nodes: [{ id: "n1", data: { imageUrl: "data:image/png;base64,abc" } }] };
  const result = await migrateProjectEmbeddedImages(original, {
    enabled: false,
    persistImage: async () => {
      throw new Error("should not run");
    },
  });
  assert.equal(result.project, original);
  assert.equal(result.migratedCount, 0);
});
