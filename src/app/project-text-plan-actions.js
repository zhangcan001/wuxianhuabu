import { isLocalTextMode } from "./production-preflight.js";

export async function createStudioTextPlanPackage({
  sourceText = "",
  textApiSettings = {},
  createLocalPackage = null,
  createApiPackage = null,
} = {}) {
  const text = String(sourceText || "").trim();
  if (!text) {
    return {
      ok: false,
      error: "请先粘贴小说、剧情梗概或已有剧本。",
    };
  }
  const packageFactory = isLocalTextMode(textApiSettings) ? createLocalPackage : createApiPackage;
  if (typeof packageFactory !== "function") {
    return {
      ok: false,
      error: isLocalTextMode(textApiSettings) ? "本地文本生产未就绪。" : "文本 API 生产未就绪。",
    };
  }
  return packageFactory(text);
}
