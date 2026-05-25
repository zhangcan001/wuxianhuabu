import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCommandPaletteItems,
  filterCommandPaletteItems,
} from "../src/product/studio/command-palette-helpers.js";

test("buildCommandPaletteItems only emits actions backed by callable handlers", () => {
  const calls = [];
  const items = buildCommandPaletteItems({
    actions: {
      openProject: () => calls.push("open"),
      saveProject: () => calls.push("save"),
      // openQueue intentionally missing
    },
  });
  const keys = items.map((item) => item.key);
  assert.ok(keys.includes("action:openProject"));
  assert.ok(keys.includes("action:saveProject"));
  assert.ok(!keys.includes("action:openQueue"));
  items.find((item) => item.key === "action:openProject").run();
  assert.deepEqual(calls, ["open"]);
});

test("buildCommandPaletteItems adds navigation entries when navigateView is provided", () => {
  const visited = [];
  const items = buildCommandPaletteItems({
    actions: {},
    navigateView: (view) => visited.push(view),
  });
  const navKeys = items.filter((item) => item.key.startsWith("nav:")).map((item) => item.key);
  assert.ok(navKeys.includes("nav:overview"));
  assert.ok(navKeys.includes("nav:script"));
  assert.ok(navKeys.includes("nav:timeline"));
  items.find((item) => item.key === "nav:timeline").run();
  assert.deepEqual(visited, ["timeline"]);
});

test("buildCommandPaletteItems skips navigation entries when navigateView is missing", () => {
  const items = buildCommandPaletteItems({ actions: { openProject: () => {} } });
  assert.ok(items.every((item) => !item.key.startsWith("nav:")));
});

test("filterCommandPaletteItems returns everything for empty query", () => {
  const items = [
    { key: "a", label: "Apple", keywords: "fruit" },
    { key: "b", label: "Banana", keywords: "fruit" },
  ];
  assert.deepEqual(filterCommandPaletteItems(items, ""), items);
  assert.deepEqual(filterCommandPaletteItems(items, "   "), items);
});

test("filterCommandPaletteItems matches against label and keywords case-insensitively", () => {
  const items = [
    { key: "a", label: "打开队列", keywords: "queue jobs" },
    { key: "b", label: "打开时间线", keywords: "timeline edit" },
    { key: "c", label: "保存工程", keywords: "save file" },
  ];
  assert.deepEqual(filterCommandPaletteItems(items, "队列").map((i) => i.key), ["a"]);
  assert.deepEqual(filterCommandPaletteItems(items, "QUEUE").map((i) => i.key), ["a"]);
  assert.deepEqual(filterCommandPaletteItems(items, "edit").map((i) => i.key), ["b"]);
  assert.deepEqual(filterCommandPaletteItems(items, "打开").map((i) => i.key), ["a", "b"]);
  assert.deepEqual(filterCommandPaletteItems(items, "no-match"), []);
});
