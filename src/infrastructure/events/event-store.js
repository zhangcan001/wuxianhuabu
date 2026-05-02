import {
  createProductionEvent,
  summarizeProductionEvents,
} from "../../core/events/production-events.js";

export function createInMemoryEventStore(initialEvents = []) {
  let events = normalizeEvents(initialEvents);
  return {
    append(eventOrEvents) {
      const next = normalizeEvents(Array.isArray(eventOrEvents) ? eventOrEvents : [eventOrEvents]);
      events = [...events, ...next];
      return events;
    },
    list(filter = {}) {
      return filterEvents(events, filter);
    },
    clear(filter = {}) {
      if (!Object.keys(filter).length) {
        events = [];
        return events;
      }
      const remove = new Set(filterEvents(events, filter).map((event) => event.id));
      events = events.filter((event) => !remove.has(event.id));
      return events;
    },
    snapshot() {
      return [...events];
    },
    summary(filter = {}) {
      return summarizeProductionEvents(filterEvents(events, filter));
    },
  };
}

export function serializeEventsForStorage(events = []) {
  return JSON.stringify(normalizeEvents(events));
}

export function parseEventsFromStorage(raw = "") {
  try {
    return normalizeEvents(JSON.parse(raw || "[]"));
  } catch {
    return [];
  }
}

function normalizeEvents(events = []) {
  return (Array.isArray(events) ? events : []).filter(Boolean).map((event, index) => (
    event.id && event.type
      ? event
      : createProductionEvent(event.type || "production.event", event.payload || event, { sequence: index })
  ));
}

function filterEvents(events = [], filter = {}) {
  return (Array.isArray(events) ? events : []).filter((event) => {
    if (filter.projectId && event.projectId !== filter.projectId) return false;
    if (filter.episodeId && event.episodeId !== filter.episodeId) return false;
    if (filter.type && event.type !== filter.type) return false;
    if (filter.targetType && event.target?.type !== filter.targetType) return false;
    if (filter.targetId && event.target?.id !== filter.targetId) return false;
    return true;
  });
}
