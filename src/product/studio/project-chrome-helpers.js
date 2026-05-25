export function detectSaveStateTone(autoSaveState) {
  if (!autoSaveState) return null;
  if (autoSaveState.startsWith("已自动保存")) return { tone: "ok", icon: "✓", text: autoSaveState };
  if (autoSaveState.startsWith("自动保存失败")) return { tone: "err", icon: "!", text: autoSaveState };
  return { tone: "pending", icon: "…", text: autoSaveState };
}

export function diffNewlyDoneSteps(prevProgress, currentProgress, steps) {
  const newlyDone = {};
  for (const step of steps) {
    if (currentProgress?.[step.key] && !prevProgress?.[step.key]) {
      newlyDone[step.key] = true;
    }
  }
  return newlyDone;
}

export function providerLabel(key = "") {
  const labels = {
    text: "文本",
    image: "图片",
    video: "视频",
    comfy: "ComfyUI",
    gemini: "Gemini",
    customImage: "自定义图片",
  };
  return labels[key] || key;
}
