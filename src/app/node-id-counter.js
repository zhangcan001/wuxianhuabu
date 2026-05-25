let counter = 1;

export function getNextNodeIdValue() {
  return counter;
}

export function setNextNodeIdValue(value) {
  const numeric = Number(value);
  counter = Number.isFinite(numeric) && numeric >= 1 ? Math.floor(numeric) : 1;
}

export function allocateNodeId() {
  const id = `node-${counter}`;
  counter += 1;
  return id;
}

export function resetNodeIdCounter() {
  counter = 1;
}
