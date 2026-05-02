export function currentProviderMode(settings = {}) {
  const mode = String(settings?.providerMode || "").trim().toLowerCase();
  if (settings?.comfyEnabled) return "comfy";
  if (mode === "comfy" || mode === "comfyui") return "comfy";
  if (mode === "custom" || mode === "api") return "custom";
  if (mode === "upload" || mode === "local-upload" || mode === "manual") return "upload";
  return "mock";
}

export function normalizeImageProviderMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  if (mode === "api" || mode === "custom") return "custom";
  if (mode === "comfy" || mode === "comfyui") return "comfy";
  if (mode === "upload" || mode === "local-upload" || mode === "manual") return "upload";
  return "inherit";
}

export function normalizeVideoProviderMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  if (mode === "api" || mode === "custom") return "custom";
  if (mode === "comfy" || mode === "comfyui") return "comfy";
  if (mode === "upload" || mode === "local-upload" || mode === "manual") return "upload";
  return "inherit";
}

export function resolveImageJobSettings(baseSettings, job = {}) {
  const mode = normalizeImageProviderMode(job.imageProviderMode);
  if (mode === "inherit") return baseSettings;
  return {
    ...(baseSettings || {}),
    providerMode: mode,
    comfyEnabled: mode === "comfy",
    ...(mode === "custom" && job.imageRuntimeModel ? { customModel: job.imageRuntimeModel } : {}),
  };
}

export function resolveVideoJobSettings(baseSettings, job = {}) {
  const mode = normalizeVideoProviderMode(job.videoProviderMode || job.providerMode);
  if (mode === "inherit") return baseSettings;
  return {
    ...(baseSettings || {}),
    providerMode: mode,
    comfyEnabled: mode === "comfy",
    ...(mode === "custom" && job.videoRuntimeModel ? { customModel: job.videoRuntimeModel } : {}),
  };
}

export function resolveShotImageProviderMode(shot = {}, settings = {}) {
  const shotMode = normalizeImageProviderMode(shot.imageProviderMode || shot.imageCallMode || shot.imageProvider);
  if (shotMode !== "inherit") return shotMode;
  return normalizeImageProviderMode(currentProviderMode(settings));
}

export function resolveShotVideoProviderMode(shot = {}, settings = {}) {
  const shotMode = normalizeVideoProviderMode(shot.videoProviderMode || shot.videoCallMode || shot.videoProvider);
  if (shotMode !== "inherit") return shotMode;
  return normalizeVideoProviderMode(currentProviderMode(settings));
}

export function createMediaProviderRuntime({
  runCustomApiGeneration = async () => ({}),
  runCustomVideoApiGeneration = async () => ({}),
  runComfyGeneration = async () => ({}),
  makeGeneratedImage = () => "",
  enqueueComfyGeneration = (task) => task(),
} = {}) {
  return {
    async runImageGeneration(settings, prompt) {
      const mode = currentProviderMode(settings);
      if (mode === "custom") return runCustomApiGeneration(settings, prompt);
      if (mode === "comfy") return enqueueComfyGeneration(() => runComfyGeneration(settings, prompt, "image"));
      if (mode === "upload") throw new Error("当前镜头设置为本地上传，请使用“上传镜头图片”回填图片。");
      return { imageUrl: makeGeneratedImage(prompt), note: "本地模拟 · 自动 · 2K" };
    },
    async runVideoGeneration(settings, prompt) {
      const mode = currentProviderMode(settings);
      if (mode === "custom") return runCustomVideoApiGeneration(settings, prompt);
      if (mode === "comfy") return enqueueComfyGeneration(() => runComfyGeneration(settings, prompt, "video"));
      if (mode === "upload") throw new Error("当前镜头设置为本地上传，请使用“上传镜头视频”回填视频。");
      return { imageUrl: makeGeneratedImage(`视频预览\n${prompt}`), note: "本地模拟视频 · 请在 AI 设置中启用 ComfyUI 视频工作流" };
    },
  };
}
