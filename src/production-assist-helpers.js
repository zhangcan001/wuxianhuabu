export function createProductionAssistHelpers(options = {}) {
  const extractAssetTokens = options.extractAssetTokens || (() => []);
  const normalizeShotRecord = options.normalizeShotRecord || ((shot) => shot || {});
  const now = options.now || (() => Date.now());
  const randomId = options.randomId || (() => Math.random().toString(36).slice(2, 6));

  function buildDirectorImageSuggestion(shot) {
    const refs = extractAssetTokens(`${shot?.imagePrompt || ""} ${shot?.videoPrompt || ""}`);
    const assetPart = refs.length ? refs.join("、") : "请补充角色或场景资产引用";
    return [
      assetPart,
      shot?.scene ? `场景：${shot.scene}` : "",
      shot?.shotSize ? `景别：${shot.shotSize}` : "景别：中景",
      shot?.action ? `动作瞬间：${shot.action}` : "动作瞬间：角色进入画面并停顿，主焦点清楚",
      "保持主体稳定、背景层次清楚、不要漂移",
    ].filter(Boolean).join("，");
  }

  function buildDirectorVideoSuggestion(shot) {
    const refs = extractAssetTokens(`${shot?.imagePrompt || ""} ${shot?.videoPrompt || ""}`);
    const assetPart = refs.length ? refs.join("、") : "请补充角色或场景资产引用";
    return [
      assetPart,
      shot?.scene ? `场景：${shot.scene}` : "",
      `开场：${shot?.shotSize || "中景"}稳住主体`,
      `动作：${shot?.action || "角色完成一个清晰动作，不做多段变化"}`,
      `运镜：${shot?.cameraMove || suggestCameraMove(shot)}`,
      `结束：${shot?.duration || "4秒"}时落在清楚的结束姿态`,
      "画面稳定，人物与服装不要跳变",
    ].filter(Boolean).join("，");
  }

  function suggestCameraMove(shot) {
    if (/特写|近景/.test(shot?.shotSize || "")) return "轻微推进";
    if (/全景|远景/.test(shot?.shotSize || "")) return "缓慢横移";
    return "轻微推镜";
  }

  function suggestShotAction(shot) {
    if (shot?.scene) return `角色在${shot.scene}中完成单一动作，动作起点和终点都清楚`;
    return "角色完成一个单一、可连续生成的动作，结尾停在清楚姿态";
  }

  function inferTimelineBackfillShotStatus(clip, currentShot) {
    const normalized = normalizeShotRecord(currentShot || {});
    const approvalStatus = String(clip?.approvalStatus || "待验收");
    if (approvalStatus === "已通过") return "已确认";
    if (approvalStatus === "退回修改") return "待修改";
    const mediaUrl = String(clip?.mediaUrl || "").trim();
    const hasMedia = Boolean(mediaUrl);
    const hasVideoPrompt = Boolean(String(normalized.videoPrompt || "").trim());
    const hasVideoResult = /\.(mp4|webm|mov)$/i.test(mediaUrl || "") || Boolean(String(normalized.videoResultUrl || "").trim());
    if (!hasMedia) return normalized.status || "待写";
    if (hasVideoResult) return "已生成";
    return hasVideoPrompt ? "待生视频" : "待生图";
  }

  function inferTimelineBackfillReviewStatus(clip, currentShot) {
    const normalized = normalizeShotRecord(currentShot || {});
    const approvalStatus = String(clip?.approvalStatus || "待验收");
    if (approvalStatus === "已通过") return "已通过";
    if (approvalStatus === "退回修改") return "待修改";
    if (normalized.reviewStatus === "搁置") return "搁置";
    return "未审";
  }

  function buildTimelineBackfillPatch(clip, currentShot, patchOptions = {}) {
    const normalized = normalizeShotRecord(currentShot || {});
    const approvalStatus = String(clip?.approvalStatus || "待验收");
    const mediaUrl = String(clip?.mediaUrl || "").trim();
    const nextStatus = inferTimelineBackfillShotStatus(clip, normalized);
    const nextReviewStatus = inferTimelineBackfillReviewStatus(clip, normalized);
    const nextResultDecision = approvalStatus === "已通过" ? "confirm" : approvalStatus === "退回修改" ? "rework" : "";
    const decisionChanged = nextResultDecision !== String(normalized.resultDecision || "");
    const timestamp = now();
    const patch = {
      status: nextStatus,
      reviewStatus: nextReviewStatus,
      resultDecision: nextResultDecision,
      resultDecisionAt: approvalStatus === "待验收"
        ? 0
        : (decisionChanged ? timestamp : (Number(normalized.resultDecisionAt) || timestamp)),
      reworkReason: approvalStatus === "退回修改"
        ? (String(clip?.approvalNote || "").trim() || normalized.reworkReason || "时间线验收退回修改")
        : "",
      rejectedResultUrl: approvalStatus === "退回修改"
        ? (mediaUrl || normalized.rejectedResultUrl || "")
        : "",
    };

    if (!patchOptions.approvalOnly) {
      const nextScene = String(clip?.scene || "").trim();
      const nextDuration = String(clip?.duration || "").trim();
      if (nextScene) patch.scene = nextScene;
      if (nextDuration) patch.duration = nextDuration;
      if (mediaUrl) {
        patch.lastQueueResult = mediaUrl;
        if (clip?.mediaType === "video" || /\.(mp4|webm|mov)$/i.test(mediaUrl)) patch.videoResultUrl = mediaUrl;
        else patch.imageResultUrl = mediaUrl;
      }
    }

    const commentNote = String(clip?.approvalNote || "").trim();
    const commentText = [`时间线验收：${approvalStatus}`, commentNote].filter(Boolean).join(" · ");
    const existingComments = Array.isArray(normalized.reviewComments) ? normalized.reviewComments : [];
    const lastComment = existingComments[existingComments.length - 1];
    if ((approvalStatus !== "待验收" || commentNote) && lastComment?.text !== commentText) {
      patch.reviewComments = [
        ...existingComments,
        {
          id: `review-${timestamp}-${randomId()}`,
          author: "时间线验收",
          text: commentText,
          createdAt: timestamp,
        },
      ];
    }
    return patch;
  }

  function computeTimelineBackfillDiff(clip, currentShot, diffOptions = {}) {
    const normalized = normalizeShotRecord(currentShot || {});
    const patch = buildTimelineBackfillPatch(clip, normalized, diffOptions);
    const changedKeys = Object.keys(patch).filter((key) => JSON.stringify(normalized?.[key] ?? null) !== JSON.stringify(patch[key] ?? null));
    return {
      patch,
      changedKeys,
      needsBackfill: changedKeys.length > 0,
      addsComment: changedKeys.includes("reviewComments"),
    };
  }

  return {
    buildDirectorImageSuggestion,
    buildDirectorVideoSuggestion,
    suggestCameraMove,
    suggestShotAction,
    inferTimelineBackfillShotStatus,
    inferTimelineBackfillReviewStatus,
    buildTimelineBackfillPatch,
    computeTimelineBackfillDiff,
  };
}
