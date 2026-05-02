export async function cacheProjectWithFallback({
  projectRepository,
  project,
  projectPath = "",
  tauriRuntime = false,
  setProjectMessage = () => {},
  logger = console,
} = {}) {
  try {
    await projectRepository.cache(project, {
      storage: "cache",
      projectPath,
    });
    return { cached: true, mode: "normal" };
  } catch (error) {
    if (tauriRuntime) {
      logger?.warn?.("Project cache file write failed", error);
      setProjectMessage("本地恢复缓存写入失败：请尽快保存工程，避免草稿丢失。");
      return { cached: false, mode: "tauri-failed", error };
    }
    try {
      await projectRepository.cache(project, {
        storage: "cache",
        compact: true,
        projectPath,
      });
      setProjectMessage("浏览器缓存已切换为轻量模式：大图片不再写入缓存，建议及时保存工程文件。");
      return { cached: true, mode: "compact" };
    } catch (compactError) {
      logger?.warn?.("Project cache skipped because browser storage is full", compactError || error);
      setProjectMessage("本地缓存空间不足：当前工程仍可保存到文件，超大图片不会写入浏览器缓存。");
      return { cached: false, mode: "browser-full", error: compactError || error };
    }
  }
}
