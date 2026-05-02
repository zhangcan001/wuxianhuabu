import assert from "node:assert/strict";
import test from "node:test";
import {
  appendDebugTraceEntry,
  clearDebugTraceEntries,
  DEBUG_TRACE_EVENT,
  emitDebugTrace,
  getDebugTraceEntries,
  loadDebugTraceEnabled,
  saveDebugTraceEnabled,
} from "../src/debug-trace-helpers.js";

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    dump: () => Object.fromEntries(values.entries()),
  };
}

test("debug trace toggle loads and saves from storage", () => {
  const storage = memoryStorage();
  assert.equal(loadDebugTraceEnabled(storage, "trace"), false);
  saveDebugTraceEnabled(storage, "trace", true);
  assert.equal(loadDebugTraceEnabled(storage, "trace"), true);
  saveDebugTraceEnabled(storage, "trace", false);
  assert.equal(loadDebugTraceEnabled(storage, "trace"), false);
});

test("trace entries are capped and appended in order", () => {
  const result = appendDebugTraceEntry([{ id: 1 }, { id: 2 }], { id: 3 }, 2);
  assert.deepEqual(result, [{ id: 2 }, { id: 3 }]);
});

test("emit debug trace writes to sink and logger only when enabled", () => {
  const logs = [];
  const dispatched = [];
  const sink = {
    dispatchEvent(event) {
      dispatched.push(event);
    },
  };
  const entry = emitDebugTrace({
    enabled: true,
    event: "queue.job.done",
    payload: { id: "job-1" },
    sink,
    now: () => "2026-04-23T12:00:00.000Z",
    logger: (...args) => logs.push(args),
  });
  assert.deepEqual(entry, {
    time: "2026-04-23T12:00:00.000Z",
    event: "queue.job.done",
    payload: { id: "job-1" },
  });
  assert.equal(sink.__WUXIAN_TRACE__.length, 1);
  assert.equal(dispatched[0].type, DEBUG_TRACE_EVENT);
  assert.equal(logs.length, 1);
  assert.equal(emitDebugTrace({ enabled: false, event: "skip", sink, logger: () => logs.push("x") }), null);
  assert.equal(logs.length, 1);
});

test("debug trace entries can be read and cleared from sink", () => {
  const dispatched = [];
  const sink = {
    __WUXIAN_TRACE__: [{ event: "a" }],
    dispatchEvent(event) {
      dispatched.push(event);
    },
  };
  assert.deepEqual(getDebugTraceEntries(sink), [{ event: "a" }]);
  assert.deepEqual(clearDebugTraceEntries(sink), []);
  assert.deepEqual(getDebugTraceEntries(sink), []);
  assert.equal(dispatched[0].type, DEBUG_TRACE_EVENT);
});
