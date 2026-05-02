export const PIPELINE_SYSTEMS = Object.freeze({
  orchestrator: "orchestrator",
  text: "text",
  image: "image",
  video: "video",
  resource: "resource",
});

export const PIPELINE_COMMANDS = Object.freeze({
  runTextOnly: "orchestrator.runTextOnly",
  runFullProduction: "orchestrator.runFullProduction",
  generateTextPackage: "text.generateAssetsAndShots",
  queueShotImages: "image.queueShotImages",
  queueAssetImages: "image.queueAssetImages",
  queueShotVideos: "video.queueShotVideos",
});

export const PIPELINE_EVENTS = Object.freeze({
  commandAccepted: "orchestrator.commandAccepted",
  textCompleted: "text.completed",
  assetUpdated: "asset.updated",
  shotUpdated: "shot.updated",
  imageTaskCreated: "image.task.created",
  imageCompleted: "image.completed",
  videoTaskCreated: "video.task.created",
  videoCompleted: "video.completed",
  taskFailed: "task.failed",
  resourceCreated: "resource.created",
});

export const PRODUCTION_MODES = Object.freeze({
  textOnly: "textOnly",
  full: "full",
});

export const PIPELINE_STAGE_KEYS = Object.freeze({
  novel: "novel",
  asset: "asset",
  shot: "shot",
  image: "image",
  video: "video",
  export: "export",
});

export function createPipelineCommand(type, payload = {}, options = {}) {
  const commandType = String(type || "").trim();
  if (!commandType) throw new Error("Pipeline command type is required.");
  return {
    id: options.id || `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: commandType,
    payload: payload && typeof payload === "object" ? payload : {},
    mode: options.mode || PRODUCTION_MODES.full,
    createdAt: options.createdAt || Date.now(),
    source: options.source || PIPELINE_SYSTEMS.orchestrator,
  };
}

export function createPipelineEvent(type, payload = {}, options = {}) {
  const eventType = String(type || "").trim();
  if (!eventType) throw new Error("Pipeline event type is required.");
  return {
    id: options.id || `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: eventType,
    payload: payload && typeof payload === "object" ? payload : {},
    createdAt: options.createdAt || Date.now(),
    source: options.source || inferEventSource(eventType),
    commandId: options.commandId || "",
  };
}

export function inferEventSource(eventType) {
  const prefix = String(eventType || "").split(".")[0];
  return Object.values(PIPELINE_SYSTEMS).includes(prefix) ? prefix : PIPELINE_SYSTEMS.orchestrator;
}

export function isMediaCommand(command) {
  return [
    PIPELINE_COMMANDS.queueShotImages,
    PIPELINE_COMMANDS.queueAssetImages,
    PIPELINE_COMMANDS.queueShotVideos,
  ].includes(command?.type);
}

export function commandAllowedInMode(command, mode = PRODUCTION_MODES.full) {
  if (mode !== PRODUCTION_MODES.textOnly) return true;
  return !isMediaCommand(command);
}

