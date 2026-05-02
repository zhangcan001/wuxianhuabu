const NODE_BASE_SIZES = {
  upload: [230, 235],
  imageEdit: [470, 390],
  geminiWeb: [500, 560],
  novelPipeline: [1080, 760],
  assetLibrary: [480, 560],
  shotList: [760, 640],
  text: [220, 120],
  storyboard: [380, 390],
  vr360: [440, 540],
  director3d: [620, 610],
  split: [360, 430],
  result: [280, 260],
};

const NODE_MIN_SIZES = {
  upload: [220, 180],
  imageEdit: [320, 300],
  geminiWeb: [360, 360],
  novelPipeline: [760, 560],
  assetLibrary: [360, 300],
  shotList: [460, 340],
  text: [180, 100],
  storyboard: [320, 320],
  vr360: [340, 360],
  director3d: [440, 390],
  split: [300, 320],
  result: [220, 190],
};

export function createNode(type, id, position, extras) {
  const [baseWidth, baseHeight] = NODE_BASE_SIZES[type] || [260, 200];
  const width = typeof extras?.width === "number" ? extras.width : baseWidth;
  const height = typeof extras?.height === "number" ? extras.height : baseHeight;
  return { id, type, x: position.x, y: position.y, width, height, selected: true, data: { ...extras } };
}

export function nodeMinSize(type) {
  return NODE_MIN_SIZES[type] || [180, 120];
}

export function createDefaultSettings(applyApiKeyVault = (settings) => settings) {
  return applyApiKeyVault({
    providerMode: "mock",
    customApiUrl: "",
    customApiKey: "",
    customAuthType: "bearer",
    customHeadersJson: "",
    customModel: "gpt-image-1",
    customApiKind: "direct-image",
    customResultMode: "auto",
    customImagePath: "data.0.url",
    customBodyTemplate: JSON.stringify(
      {
        model: "{{model}}",
        prompt: "{{prompt}}",
        size: "{{size}}",
      },
      null,
      2,
    ),
    comfyEnabled: false,
    comfyBaseUrl: "http://127.0.0.1:8188",
    positiveNodeId: "",
    workflowJson: "",
    comfyImagePositiveNodeId: "",
    comfyImageWorkflowJson: "",
    comfyVideoPositiveNodeId: "",
    comfyVideoWorkflowJson: "",
    comfyTimeoutSeconds: "600",
  });
}
