import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSearchEntries,
  nodeTypeLabel,
  searchNodeSubtitle,
  shortTitle,
  summarizeText,
} from "../src/project-search-helpers.js";

test("project search helpers label node types and subtitles", () => {
  assert.equal(nodeTypeLabel("shotList"), "镜头表");
  assert.equal(nodeTypeLabel("customNode"), "customNode");
  assert.equal(searchNodeSubtitle({
    type: "assetLibrary",
    data: { characters: [{ id: 1 }], scenes: [{ id: 2 }], props: [] },
  }), "1人物 1场景 0道具");
  assert.equal(searchNodeSubtitle({ type: "text", data: { text: "hello" } }), "hello");
});

test("project search helpers summarize compact titles and text", () => {
  assert.equal(shortTitle("  a   b   c  "), " a b c ");
  assert.equal(shortTitle(""), "结果图片");
  assert.equal(summarizeText("第一句，第二句。", 4), "第一句，...");
  assert.equal(summarizeText("结尾。", 20), "结尾");
});

test("project search helpers build mixed search entries", () => {
  const entries = buildSearchEntries([
    { id: "node-1", type: "text", data: { displayName: "文本节点", text: "搜索正文" } },
    { id: "node-2", type: "shotList", data: { shots: [{ id: "s1", scene: "街道", status: "", action: "追逐" }] } },
  ], {
    items: [{ token: "@角色:小明", sourceId: "node-3", category: "角色", name: "小明", meta: "主角" }],
  }, {
    items: [{ id: "res-1", name: "参考图", token: "@资源:参考", references: [{ nodeId: "node-4" }] }],
  });

  assert.deepEqual(entries.map((entry) => entry.kind), ["文本", "镜头表", "角色资产", "镜头", "项目资源"]);
  assert.equal(entries.find((entry) => entry.id === "node-1").subtitle, "搜索正文");
  assert.equal(entries.find((entry) => entry.id === "node-2-s1").title, "s1 街道");
});
