import assert from "node:assert/strict";
import test from "node:test";
import {
  appendProductionEvent,
} from "../src/core/events/production-events.js";
import {
  createInMemoryEventStore,
  parseEventsFromStorage,
  serializeEventsForStorage,
} from "../src/infrastructure/events/event-store.js";

test("event store appends filters summarizes and clears events", () => {
  const first = appendProductionEvent([], "production.started", {
    projectId: "p1",
    episodeId: "e1",
    target: { type: "episode", id: "e1" },
  })[0];
  const second = appendProductionEvent([], "production.done", {
    projectId: "p2",
    episodeId: "e2",
  })[0];
  const store = createInMemoryEventStore([first]);
  store.append(second);

  assert.equal(store.list().length, 2);
  assert.equal(store.list({ projectId: "p1" }).length, 1);
  assert.equal(store.summary().byType["production.started"], 1);

  store.clear({ projectId: "p1" });
  assert.equal(store.list().length, 1);
});

test("event store serializes and parses storage payload", () => {
  const event = appendProductionEvent([], "production.started", { projectId: "p1" })[0];
  const raw = serializeEventsForStorage([event]);
  const parsed = parseEventsFromStorage(raw);

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].type, "production.started");
  assert.deepEqual(parseEventsFromStorage("not-json"), []);
});
