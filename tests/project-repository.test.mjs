import assert from "node:assert/strict";
import test from "node:test";
import {
  createProjectRepository,
} from "../src/app/project-repository.js";

test("project repository loads content through injected parser and normalizer", async () => {
  const repository = createProjectRepository({
    normalizeProject: (project) => ({ ...project, normalized: true }),
  });

  const result = await repository.load({ content: '{"name":"短剧"}', path: "p.wxhb" });

  assert.equal(result.project.name, "短剧");
  assert.equal(result.project.normalized, true);
  assert.equal(result.path, "p.wxhb");
});

test("project repository saves and caches through storage ports", async () => {
  const calls = [];
  const repository = createProjectRepository({
    serializeProject: (project, options) => JSON.stringify({ ...project, compact: Boolean(options.compact) }),
    save: async (input) => {
      calls.push(["save", input.content]);
      return { path: "project.wxhb" };
    },
    cache: async (input) => {
      calls.push(["cache", input.content]);
      return { cached: true };
    },
  });

  const saved = await repository.save({ id: "p1" });
  const cached = await repository.cache({ id: "p1" });

  assert.equal(saved.path, "project.wxhb");
  assert.equal(cached.cached, true);
  assert.deepEqual(calls, [
    ["save", '{"id":"p1","compact":false}'],
    ["cache", '{"id":"p1","compact":true}'],
  ]);
});
