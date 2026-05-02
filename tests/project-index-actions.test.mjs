import assert from "node:assert/strict";
import test from "node:test";

import {
  openProjectIndexSearchResultAction,
  parseIndexResultJson,
  rebuildProjectIndexAction,
  refreshProjectIndexSummaryAction,
  searchProjectIndexAction,
  syncProjectIndexToSqliteAction,
} from "../src/app/project-index-actions.js";

test("refreshProjectIndexSummaryAction stores summary and swallows read failures", async () => {
  const summaries = [];
  const summary = await refreshProjectIndexSummaryAction({
    readProjectIndexSummary: async () => ({ total: 3 }),
    setProjectIndexSummary: (value) => summaries.push(value),
  });

  assert.deepEqual(summary, { total: 3 });
  assert.deepEqual(summaries, [{ total: 3 }]);

  const warnings = [];
  const failed = await refreshProjectIndexSummaryAction({
    readProjectIndexSummary: async () => {
      throw new Error("boom");
    },
    logger: { warn: (...args) => warnings.push(args) },
  });

  assert.equal(failed, null);
  assert.equal(warnings.length, 1);
});

test("syncProjectIndexToSqliteAction builds payload and stores returned summary", async () => {
  const summaries = [];
  const seen = {};
  const summary = await syncProjectIndexToSqliteAction({
    buildProjectIndexPayload: (projectState, mediaCacheReport, options) => {
      seen.projectState = projectState;
      seen.mediaCacheReport = mediaCacheReport;
      seen.options = options;
      return { rows: 4 };
    },
    projectState: { activeEpisodeId: "ep1" },
    mediaCacheReport: { count: 2 },
    currentProjectPath: "project.json",
    deletionAudit: [{ path: "old.png" }],
    syncProjectIndex: async (request) => {
      seen.request = request;
      return { total: 4 };
    },
    setProjectIndexSummary: (value) => summaries.push(value),
  });

  assert.deepEqual(summary, { total: 4 });
  assert.deepEqual(seen.options, { projectPath: "project.json", deletionAudit: [{ path: "old.png" }] });
  assert.deepEqual(seen.request, { projectPath: "project.json", payload: { rows: 4 } });
  assert.deepEqual(summaries, [{ total: 4 }]);
});

test("rebuild and search project index actions respect runtime availability", async () => {
  let synced = false;
  let message = "";
  assert.equal(await rebuildProjectIndexAction({
    isRuntimeAvailable: () => false,
    syncProjectIndexToSqlite: async () => {
      synced = true;
    },
  }), null);
  assert.equal(synced, false);

  const summary = await rebuildProjectIndexAction({
    isRuntimeAvailable: () => true,
    syncProjectIndexToSqlite: async (audit) => {
      assert.deepEqual(audit, ["audit"]);
      return { total: 1 };
    },
    setProjectMessage: (value) => {
      message = value;
    },
    deletionAudit: ["audit"],
  });
  assert.deepEqual(summary, { total: 1 });
  assert.equal(message, "SQLite 项目索引已重建。");

  assert.deepEqual(await searchProjectIndexAction({ isRuntimeAvailable: () => false, query: "x" }), { items: [] });
  assert.deepEqual(await searchProjectIndexAction({
    isRuntimeAvailable: () => true,
    query: "镜头",
    limit: 5,
    searchProjectIndex: async (request) => ({ items: [request] }),
  }), { items: [{ query: "镜头", limit: 5 }] });
});

test("openProjectIndexSearchResultAction routes timeline clips, nodes, and fallback paths", () => {
  const calls = [];
  const timelineResult = openProjectIndexSearchResultAction({
    item: { kind: "timelineClip", id: "clipFallback", title: "片段", rawJson: JSON.stringify({ episodeId: "ep1", id: "clip1", title: "开场" }) },
    setActiveEpisodeId: (value) => calls.push(["episode", value]),
    setTimelineFocusClipId: (value) => calls.push(["clip", value]),
    setShowTimeline: (value) => calls.push(["showTimeline", value]),
    setProjectMessage: (value) => calls.push(["message", value]),
  });
  assert.equal(timelineResult.type, "timelineClip");
  assert.deepEqual(calls.slice(0, 3), [["episode", "ep1"], ["clip", "clip1"], ["showTimeline", true]]);

  const located = [];
  const nodeResult = openProjectIndexSearchResultAction({
    item: { kind: "shot", title: "S1", rawJson: JSON.stringify({ sourceNodeId: "node1", id: "shot1" }) },
    locateNode: (value) => located.push(value),
    setProjectMessage: (value) => calls.push(["shotMessage", value]),
  });
  assert.deepEqual(nodeResult, { type: "node", nodeId: "node1", raw: { sourceNodeId: "node1", id: "shot1" } });
  assert.deepEqual(located, ["node1"]);

  const copied = [];
  const pathResult = openProjectIndexSearchResultAction({
    item: { kind: "resource", path: "assets/a.png" },
    clipboard: { writeText: async (value) => copied.push(value) },
    setProjectMessage: (value) => calls.push(["pathMessage", value]),
  });
  assert.deepEqual(pathResult, { type: "path", path: "assets/a.png", raw: {} });
  assert.deepEqual(copied, ["assets/a.png"]);
});

test("parseIndexResultJson returns empty object for invalid input", () => {
  assert.deepEqual(parseIndexResultJson(""), {});
  assert.deepEqual(parseIndexResultJson("{nope"), {});
  assert.deepEqual(parseIndexResultJson("{\"id\":\"x\"}"), { id: "x" });
});
