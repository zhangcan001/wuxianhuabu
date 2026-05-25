import assert from "node:assert/strict";
import test from "node:test";
import {
  createPanoramaSourceLoader,
  getVrGridLayout,
  getVrGridPresets,
  positiveModulo,
  sampleNearest,
} from "../src/canvas/panorama-helpers.js";

function createFakeDocument() {
  return {
    createElement(type) {
      assert.equal(type, "canvas");
      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            drawImage() {},
            getImageData(_x, _y, width, height) {
              return { data: new Uint8ClampedArray(width * height * 4), width, height };
            },
          };
        },
      };
    },
  };
}

test("VR grid layout matches 4-view and 12-view modes", () => {
  assert.deepEqual(getVrGridLayout(4), { cols: 2, rows: 2, cellW: 480, cellH: 480 });
  assert.deepEqual(getVrGridLayout(12), { cols: 4, rows: 3, cellW: 360, cellH: 240 });
});

test("VR presets expose expected labels", () => {
  assert.deepEqual(getVrGridPresets(4).map((item) => item.label), ["正面", "右面", "左面", "后面"]);
  assert.equal(getVrGridPresets(12).length, 12);
  assert.equal(getVrGridPresets(12).at(-1).label, "前下");
});

test("positiveModulo wraps negative and overflowing values", () => {
  assert.equal(positiveModulo(-1, 4), 3);
  assert.equal(positiveModulo(5, 4), 1);
  assert.equal(positiveModulo(8, 4), 0);
});

test("sampleNearest copies RGB and forces opaque alpha", () => {
  const source = { data: new Uint8ClampedArray([
    1, 2, 3, 4,
    5, 6, 7, 8,
    9, 10, 11, 12,
    13, 14, 15, 16,
  ]) };
  const target = { data: new Uint8ClampedArray(8) };

  sampleNearest(source, target, 2, 1, 1, 1, 0, 2);

  assert.deepEqual(Array.from(target.data.slice(4, 8)), [13, 14, 15, 255]);
});

test("panorama loader caches identical sources and evicts oldest entries", async () => {
  let loadCount = 0;
  const loader = createPanoramaSourceLoader({
    cacheLimit: 2,
    documentRef: createFakeDocument(),
    loadImageImpl: async (source) => {
      loadCount += 1;
      return { width: source.length + 1, height: source.length + 2 };
    },
  });

  const first = await loader("a");
  const second = await loader("a");
  await loader("bb");
  await loader("ccc");

  assert.equal(first, second);
  assert.equal(loadCount, 3);
  assert.deepEqual(Array.from(loader.cache.keys()), ["bb", "ccc"]);
});

test("panorama loader drops failed entries from cache", async () => {
  const loader = createPanoramaSourceLoader({
    cacheLimit: 2,
    documentRef: createFakeDocument(),
    loadImageImpl: async () => {
      throw new Error("broken");
    },
  });

  await assert.rejects(() => loader("bad"), /broken/);
  assert.equal(loader.cache.has("bad"), false);
});
