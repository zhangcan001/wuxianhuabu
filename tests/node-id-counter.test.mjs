import assert from "node:assert/strict";
import test from "node:test";

import {
  allocateNodeId,
  getNextNodeIdValue,
  resetNodeIdCounter,
  setNextNodeIdValue,
} from "../src/app/node-id-counter.js";

test("node id counter starts at 1 and increments per allocation", () => {
  resetNodeIdCounter();
  assert.equal(getNextNodeIdValue(), 1);
  assert.equal(allocateNodeId(), "node-1");
  assert.equal(allocateNodeId(), "node-2");
  assert.equal(getNextNodeIdValue(), 3);
});

test("setNextNodeIdValue restores counter for project loads", () => {
  setNextNodeIdValue(42);
  assert.equal(getNextNodeIdValue(), 42);
  assert.equal(allocateNodeId(), "node-42");
  assert.equal(getNextNodeIdValue(), 43);
});

test("setNextNodeIdValue clamps invalid inputs to 1", () => {
  setNextNodeIdValue(undefined);
  assert.equal(getNextNodeIdValue(), 1);
  setNextNodeIdValue(-10);
  assert.equal(getNextNodeIdValue(), 1);
  setNextNodeIdValue("not a number");
  assert.equal(getNextNodeIdValue(), 1);
  setNextNodeIdValue(7.9);
  assert.equal(getNextNodeIdValue(), 7);
});
