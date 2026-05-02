export function resolvePrimaryStudioAction(state = {}) {
  const {
    sourceText = "",
    textReady = false,
    assetReady = false,
    imageReady = false,
    videoReady = false,
    timelineReady = false,
    reviewReady = false,
    exportReady = false,
    running = false,
  } = state;
  if (!sourceText.trim() && !textReady) return action("script", "粘贴小说", "先输入小说或剧情梗概", true);
  if (!textReady) return action("text", "生成文本方案", "生成剧本、资产和镜头表", running);
  if (!assetReady) return action("repairAssetConsistency", "锁定资产", "锁定角色/场景/道具一致性", running);
  if (!imageReady) return action("image", "生成图片", "补齐所有镜头首帧图", running);
  if (!videoReady) return action("video", "生成视频", "补齐所有镜头视频", running);
  if (!timelineReady) return action("syncTimeline", "同步时间线", "把视频素材挂入时间线", running);
  if (!reviewReady) return action("review", "执行审片", "检查连续性和交付问题", running);
  if (!exportReady) return action("delivery", "交付检查", "规划导出成片或工程包", running);
  return action("delivery", "导出成片", "当前集已达到交付门槛", running);
}

function action(key, label, detail, disabled = false) {
  return { key, label, detail, disabled };
}
