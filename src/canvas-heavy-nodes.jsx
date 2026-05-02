import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  buildShotTimelinePayload,
  copyTextWithFeedback,
  describePromptNodeResult,
  enqueueShotGenerationJobs,
} from "./node-action-helpers";

export function ShotListNode({ node, updateNode, createOutputNear, onSyncToTimeline, onLocateResultForShot, assetIndex, resourceIndex, openPromptPreview, addGenerationJobs, helpers }) {
  const {
    NodeHeader,
    AssetTokenInsertRow,
    normalizeShotRecord,
    buildShotQualityPatch,
    buildShotQualityReport,
    buildShotRiskProfile,
    buildShotTypeRouteSummary,
    suggestShotAssetBindingPatch,
    formatShotListMarkdown,
    buildImageShotPrompt,
    buildVideoShotPrompt,
    appendToken,
    currentProviderMode,
    settings,
    SHOT_STATUS_OPTIONS,
    REVIEW_STATUS_OPTIONS,
  } = helpers;
  const defaultImageProviderMode = currentProviderMode?.(settings || {}) || "inherit";
  const shots = Array.isArray(node.data.shots)
    ? node.data.shots
      .filter((shot) => shot && typeof shot === "object")
      .map((shot, index) => normalizeShotRecord(shot, index))
    : [];
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [statusFilter, setStatusFilter] = useState("全部");
  const [draftSeed, setDraftSeed] = useState("");
  const selected = shots[selectedIndex] || shots[0] || null;
  const [message, setMessage] = useState("");
  const [batchSummary, setBatchSummary] = useState(null);
  const selectedReviewComments = Array.isArray(selected?.reviewComments) ? selected.reviewComments : [];
  const selectedMediaUrl = selected
    ? (selected.videoUrl || selected.videoResultUrl || selected.imageUrl || selected.imageResultUrl || selected.lastQueueResult || "")
    : "";
  const selectedHasVideo = Boolean(selected && (selected.videoUrl || selected.videoResultUrl || /\.(mp4|webm|mov)$/i.test(selected.lastQueueResult || "")));
  const selectedHasImage = Boolean(selected && (selected.imageUrl || selected.imageResultUrl || (selected.lastQueueResult && !/\.(mp4|webm|mov)$/i.test(selected.lastQueueResult || ""))));
  const selectedResultLabel = !selected
    ? "未选镜头"
    : selectedHasVideo
      ? "已有视频结果"
      : selectedHasImage
        ? "已有图片结果"
        : "还没有结果";
  const resourceTokenItems = Array.isArray(resourceIndex?.items)
    ? resourceIndex.items.map((item) => ({ token: item.token, category: "资源", name: item.name }))
    : [];
  const filteredShots = statusFilter === "全部" ? shots : shots.filter((shot) => (shot.status || "待写") === statusFilter);
  const statusSummary = SHOT_STATUS_OPTIONS.map((status) => ({
    status,
    count: shots.filter((shot) => (shot.status || "待写") === status).length,
  })).filter((item) => item.count > 0);
  const qualitySummary = shots.length
    ? Math.round(shots.reduce((sum, shot) => sum + buildShotQualityReport(shot).score, 0) / shots.length)
    : 0;
  const riskSummary = {
    high: shots.filter((shot) => buildShotRiskProfile(shot).level === "高风险").length,
    medium: shots.filter((shot) => buildShotRiskProfile(shot).level === "中风险").length,
    low: shots.filter((shot) => buildShotRiskProfile(shot).level === "低风险").length,
  };
  const productionSummary = {
    imageReady: shots.filter((shot) => Boolean(shot.imageUrl || shot.imageResultUrl || (shot.lastQueueResult && !/\.(mp4|webm|mov)$/i.test(shot.lastQueueResult)))).length,
    videoReady: shots.filter((shot) => Boolean(shot.videoUrl || shot.videoResultUrl || /\.(mp4|webm|mov)$/i.test(shot.lastQueueResult || ""))).length,
    pendingVideo: shots.filter((shot) => (shot.status || "") === "待生视频").length,
    pendingAudio: 0,
    completed: shots.filter((shot) => ["已生成", "已确认", "完成"].includes(shot.status || "")).length,
  };
  const shotTaskHint = !shots.length
    ? "先新增镜头，或者从小说工厂和资产库把内容推到镜头表。"
    : selected
      ? `${selected.id} 当前最适合先补绑定、补骨架，再决定入图像队列还是视频队列。`
      : "先选中一个镜头，再开始修镜头、补提示词或入队生成。";
  const selectedNextAction = !selected
    ? null
    : buildShotRiskProfile(selected).level === "高风险"
      ? { key: "repair", label: "一键降风险" }
      : (!selected.mainCharacterToken || !selected.mainSceneToken)
        ? { key: "binding", label: "补资产绑定" }
        : (!String(selected.imagePrompt || "").trim() || !String(selected.videoPrompt || "").trim())
          ? { key: "prompt", label: "补提示词骨架" }
          : !selectedMediaUrl
            ? {
              key: (String(selected.status || "") === "待生视频" || (selectedHasImage && !selectedHasVideo && String(selected.videoPrompt || "").trim())) ? "video" : "image",
              label: (String(selected.status || "") === "待生视频" || (selectedHasImage && !selectedHasVideo && String(selected.videoPrompt || "").trim())) ? "视频入队" : "图片入队",
            }
            : !selected.resultDecision
              ? { key: "confirm", label: "采用并确认" }
              : { key: "timeline", label: "同步时间线" };

  useEffect(() => {
    const focusShotId = String(node.data?.focusShotId || "").trim().toUpperCase();
    if (!focusShotId) return;
    const index = shots.findIndex((shot) => String(shot.id || "").trim().toUpperCase() === focusShotId);
    if (index >= 0) setSelectedIndex(index);
  }, [node.data?.focusShotId, shots]);

  function patchShot(index, patch) {
    updateNode(node.id, { shots: shots.map((shot, shotIndex) => (shotIndex === index ? { ...shot, ...patch } : shot)) }, { skipHistory: true });
  }

  function autoPolishShot(index) {
    const current = shots[index];
    if (!current) return;
    const patch = buildShotQualityPatch(current);
    patchShot(index, {
      ...patch,
      imagePrompt: current.imagePrompt || buildImageShotPrompt({ ...current, ...patch }, assetIndex, resourceIndex),
      videoPrompt: current.videoPrompt || buildVideoShotPrompt({ ...current, ...patch }, assetIndex, resourceIndex),
    });
    setMessage(`已补齐 ${current.id} 的生成质量骨架`);
  }

  function autoPolishShots(targetShots = filteredShots) {
    const ids = new Set((targetShots || []).map((shot) => shot.id));
    if (!ids.size) {
      setMessage("当前没有可优化的镜头");
      return;
    }
    updateNode(node.id, {
      shots: shots.map((shot) => {
        if (!ids.has(shot.id)) return shot;
        const patch = buildShotQualityPatch(shot);
        return {
          ...shot,
          ...patch,
          imagePrompt: shot.imagePrompt || buildImageShotPrompt({ ...shot, ...patch }, assetIndex, resourceIndex),
          videoPrompt: shot.videoPrompt || buildVideoShotPrompt({ ...shot, ...patch }, assetIndex, resourceIndex),
        };
      }),
    }, { skipHistory: true });
    setMessage(`已优化 ${ids.size} 个镜头的质量骨架`);
  }

  function repairSelectedShot() {
    if (!selected) return;
    const report = buildShotQualityReport(selected);
    patchShot(selectedIndex, {
      ...report.recommendedPatch,
      imagePrompt: buildImageShotPrompt({ ...selected, ...report.recommendedPatch }, assetIndex, resourceIndex),
      videoPrompt: buildVideoShotPrompt({ ...selected, ...report.recommendedPatch }, assetIndex, resourceIndex),
      reviewStatus: report.score >= 88 ? "已通过" : (selected.reviewStatus || "待修改"),
    });
    setMessage(`已一键修复 ${selected.id}，当前质量 ${report.score} 分`);
  }

  function nextShotId() {
    const used = new Set(shots.map((shot) => String(shot.id || "").trim()));
    for (let index = 1; index < 999; index += 1) {
      const candidate = `S${String(index).padStart(2, "0")}`;
      if (!used.has(candidate)) return candidate;
    }
    return `S${Date.now()}`;
  }

  function addShot() {
    const next = normalizeShotRecord({
      id: nextShotId(),
      scene: draftSeed || "",
      action: draftSeed || "",
      shotSize: "中景",
      duration: "4秒",
      status: "待写",
      reviewStatus: "未审",
    }, shots.length);
    updateNode(node.id, { shots: [...shots, next] });
    setSelectedIndex(shots.length);
    setMessage(`已新增镜头：${next.id}`);
  }

  function duplicateSelectedShot() {
    if (!selected) return;
    const next = normalizeShotRecord({
      ...selected,
      id: nextShotId(),
      status: "待写",
      reviewStatus: "未审",
      lastQueueResult: "",
    }, shots.length);
    updateNode(node.id, { shots: [...shots, next] });
    setSelectedIndex(shots.length);
    setMessage(`已复制镜头：${selected.id} -> ${next.id}`);
  }

  function deleteSelectedShot() {
    if (!selected) return;
    const nextShots = shots.filter((_, index) => index !== selectedIndex);
    updateNode(node.id, { shots: nextShots });
    setSelectedIndex(Math.max(0, Math.min(selectedIndex - 1, nextShots.length - 1)));
    setMessage(`已删除镜头：${selected.id}`);
  }

  function patchShotsByStatus(status, patch) {
    const targets = status === "全部" ? shots : shots.filter((shot) => (shot.status || "待写") === status);
    if (!targets.length) {
      setMessage("当前筛选下没有可批量修改的镜头");
      return;
    }
    updateNode(node.id, {
      shots: shots.map((shot) => ((status === "全部" || (shot.status || "待写") === status) ? { ...shot, ...patch } : shot)),
    }, { skipHistory: true });
    setMessage(`已批量更新 ${targets.length} 个镜头`);
  }

  function syncSelectedPrompts() {
    if (!selected) return;
    patchShot(selectedIndex, {
      imagePrompt: selected.imagePrompt || buildImageShotPrompt(selected, assetIndex, resourceIndex),
      videoPrompt: selected.videoPrompt || buildVideoShotPrompt(selected, assetIndex, resourceIndex),
    });
    setMessage(`已为 ${selected.id} 补齐默认提示词骨架`);
  }

  function applySuggestedBindings(index = selectedIndex) {
    const current = shots[index];
    if (!current) return;
    const patch = suggestShotAssetBindingPatch(current, assetIndex);
    patchShot(index, patch);
    setMessage(`已为 ${current.id} 自动补齐镜头绑定`);
  }

  function applySuggestedBindingsBatch(targetShots = filteredShots) {
    const ids = new Set((targetShots || []).map((shot) => shot.id));
    if (!ids.size) {
      setMessage("当前没有可补绑定的镜头");
      return;
    }
    updateNode(node.id, {
      shots: shots.map((shot) => {
        if (!ids.has(shot.id)) return shot;
        return { ...shot, ...suggestShotAssetBindingPatch(shot, assetIndex) };
      }),
    }, { skipHistory: true });
    setMessage(`已为 ${ids.size} 个镜头自动补齐绑定建议`);
  }

  function applyShotTypeStrategy(index = selectedIndex) {
    const current = shots[index];
    if (!current) return;
    const patch = buildShotQualityPatch(current);
    patchShot(index, {
      shotType: patch.shotType,
      imageParamPreset: patch.imageParamPreset,
      imageAspectRatio: patch.imageAspectRatio,
      imageQuality: patch.imageQuality,
      videoParamPreset: patch.videoParamPreset,
      videoAspectRatio: patch.videoAspectRatio,
      motionStrength: patch.motionStrength,
    });
    setMessage(`已为 ${current.id} 应用镜头类型策略`);
  }

  function applyShotTypeStrategyBatch(targetShots = filteredShots) {
    const ids = new Set((targetShots || []).map((shot) => shot.id));
    if (!ids.size) {
      setMessage("当前没有可应用策略的镜头");
      return;
    }
    updateNode(node.id, {
      shots: shots.map((shot) => {
        if (!ids.has(shot.id)) return shot;
        const patch = buildShotQualityPatch(shot);
        return {
          ...shot,
          shotType: patch.shotType,
          imageParamPreset: patch.imageParamPreset,
          imageAspectRatio: patch.imageAspectRatio,
          imageQuality: patch.imageQuality,
          videoParamPreset: patch.videoParamPreset,
          videoAspectRatio: patch.videoAspectRatio,
          motionStrength: patch.motionStrength,
        };
      }),
    }, { skipHistory: true });
    setMessage(`已为 ${ids.size} 个镜头应用类型策略`);
  }

  function runBatchProductionFlow(targetShots = filteredShots) {
    const items = Array.isArray(targetShots) ? targetShots.filter(Boolean) : [];
    if (!items.length) {
      setMessage("当前没有可批量生产的镜头");
      setBatchSummary(null);
      return;
    }
    const ids = new Set(items.map((shot) => shot.id));
    const riskyShots = items.map((shot) => ({ shot, risk: buildShotRiskProfile(shot) })).filter((item) => item.risk.level === "高风险");
    if (riskyShots.length) {
      setMessage(`当前筛选里有 ${riskyShots.length} 个高风险镜头，建议先一键修镜头再批量生产：${riskyShots.slice(0, 4).map((item) => item.shot.id).join("、")}${riskyShots.length > 4 ? "..." : ""}`);
      setBatchSummary({
        flow: "riskStop",
        total: items.length,
        risky: riskyShots.length,
        riskyIds: riskyShots.slice(0, 6).map((item) => item.shot.id),
      });
      return;
    }
    let preparedShots = [];
    let bindingCount = 0;
    let strategyCount = 0;
    let promptCount = 0;
    updateNode(node.id, {
      shots: shots.map((shot) => {
        if (!ids.has(shot.id)) return shot;
        const bindingPatch = suggestShotAssetBindingPatch(shot, assetIndex);
        const patch = buildShotQualityPatch({
          ...shot,
          ...bindingPatch,
        });
        if (
          bindingPatch.mainCharacterToken !== (shot.mainCharacterToken || "")
          || bindingPatch.mainSceneToken !== (shot.mainSceneToken || "")
          || JSON.stringify(bindingPatch.keyPropTokens || []) !== JSON.stringify(shot.keyPropTokens || [])
        ) bindingCount += 1;
        if (
          patch.shotType !== (shot.shotType || "")
          || patch.imageParamPreset !== (shot.imageParamPreset || "")
          || patch.videoParamPreset !== (shot.videoParamPreset || "")
        ) strategyCount += 1;
        if (!String(shot.imagePrompt || "").trim() || !String(shot.videoPrompt || "").trim()) promptCount += 1;
        const nextShot = {
          ...shot,
          ...patch,
          imagePrompt: shot.imagePrompt || buildImageShotPrompt({ ...shot, ...patch }, assetIndex, resourceIndex),
          videoPrompt: shot.videoPrompt || buildVideoShotPrompt({ ...shot, ...patch }, assetIndex, resourceIndex),
          status: shot.status === "待写" ? "待生图" : (shot.status || "待生图"),
        };
        preparedShots.push(nextShot);
        return nextShot;
      }),
    }, { skipHistory: true });
    if (!preparedShots.length) {
      setMessage("当前筛选下没有准备完成的镜头");
      setBatchSummary(null);
      return;
    }
    const jobs = enqueueShotGenerationJobs({
      targetShots: preparedShots,
      nodeId: node.id,
      kind: "image",
      buildImageShotPrompt,
      buildVideoShotPrompt,
      assetIndex,
      resourceIndex,
      addGenerationJobs,
      defaultImageProviderMode,
    });
    onSyncToTimeline?.(buildShotTimelinePayload({ shots: preparedShots, nodeId: node.id, normalizeShotRecord }));
    const waitingVideo = preparedShots.filter((shot) => (shot.status || "") === "待生图" || (shot.status || "") === "待生视频").length;
    setBatchSummary({
      total: preparedShots.length,
      bindingCount,
      strategyCount,
      promptCount,
      imageJobs: jobs.length,
      syncedTimeline: preparedShots.length,
      waitingVideo,
    });
    setMessage(`已完成批量生产准备：${preparedShots.length} 镜头已补绑定、套策略、补骨架，${jobs.length} 个图片任务已入队并同步时间线`);
  }

  function runBatchVideoFlow(targetShots = filteredShots) {
    const items = Array.isArray(targetShots) ? targetShots.filter(Boolean) : [];
    if (!items.length) {
      setMessage("当前没有可批量生视频的镜头");
      setBatchSummary(null);
      return;
    }
    const ids = new Set(items.map((shot) => shot.id));
    const riskyShots = items.map((shot) => ({ shot, risk: buildShotRiskProfile(shot) })).filter((item) => item.risk.level === "高风险");
    if (riskyShots.length) {
      setMessage(`当前筛选里有 ${riskyShots.length} 个高风险镜头，建议先修再批量生视频：${riskyShots.slice(0, 4).map((item) => item.shot.id).join("、")}${riskyShots.length > 4 ? "..." : ""}`);
      setBatchSummary({
        flow: "riskStop",
        total: items.length,
        risky: riskyShots.length,
        riskyIds: riskyShots.slice(0, 6).map((item) => item.shot.id),
      });
      return;
    }
    let preparedShots = [];
    let bindingCount = 0;
    let strategyCount = 0;
    let promptCount = 0;
    updateNode(node.id, {
      shots: shots.map((shot) => {
        if (!ids.has(shot.id)) return shot;
        const bindingPatch = suggestShotAssetBindingPatch(shot, assetIndex);
        const patch = buildShotQualityPatch({
          ...shot,
          ...bindingPatch,
        });
        if (
          bindingPatch.mainCharacterToken !== (shot.mainCharacterToken || "")
          || bindingPatch.mainSceneToken !== (shot.mainSceneToken || "")
          || JSON.stringify(bindingPatch.keyPropTokens || []) !== JSON.stringify(shot.keyPropTokens || [])
        ) bindingCount += 1;
        if (
          patch.shotType !== (shot.shotType || "")
          || patch.videoParamPreset !== (shot.videoParamPreset || "")
          || patch.motionStrength !== (shot.motionStrength || "")
        ) strategyCount += 1;
        if (!String(shot.videoPrompt || "").trim()) promptCount += 1;
        const nextShot = {
          ...shot,
          ...patch,
          imagePrompt: shot.imagePrompt || buildImageShotPrompt({ ...shot, ...patch }, assetIndex, resourceIndex),
          videoPrompt: shot.videoPrompt || buildVideoShotPrompt({ ...shot, ...patch }, assetIndex, resourceIndex),
          status: "待生视频",
        };
        preparedShots.push(nextShot);
        return nextShot;
      }),
    }, { skipHistory: true });
    if (!preparedShots.length) {
      setMessage("当前筛选下没有准备完成的视频镜头");
      setBatchSummary(null);
      return;
    }
    const jobs = enqueueShotGenerationJobs({
      targetShots: preparedShots,
      nodeId: node.id,
      kind: "video",
      buildImageShotPrompt,
      buildVideoShotPrompt,
      assetIndex,
      resourceIndex,
      addGenerationJobs,
      defaultImageProviderMode,
    });
    setBatchSummary({
      flow: "video",
      total: preparedShots.length,
      bindingCount,
      strategyCount,
      promptCount,
      videoJobs: jobs.length,
      syncedTimeline: 0,
      waitingVideo: preparedShots.length,
    });
    setMessage(`已完成批量视频准备：${preparedShots.length} 镜头已补绑定、套策略、补视频骨架，${jobs.length} 个视频任务已入队`);
  }

  function runAutoPilotProduction(targetShots = filteredShots) {
    const items = Array.isArray(targetShots) ? targetShots.filter(Boolean) : [];
    if (!items.length) {
      setMessage("当前没有可自动推进的镜头");
      setBatchSummary(null);
      return;
    }
    const ids = new Set(items.map((shot) => shot.id));
    let repairedCount = 0;
    let bindingCount = 0;
    let strategyCount = 0;
    let promptCount = 0;
    const preparedShots = [];
    const nextShots = shots.map((shot) => {
      if (!ids.has(shot.id)) return shot;
      const bindingPatch = suggestShotAssetBindingPatch(shot, assetIndex);
      const qualityPatch = buildShotQualityPatch({ ...shot, ...bindingPatch });
      const mergedShot = { ...shot, ...bindingPatch, ...qualityPatch };
      const hadHighRisk = buildShotRiskProfile(shot).level === "高风险";
      const hasImageResult = Boolean(shot.imageUrl || shot.imageResultUrl || (shot.lastQueueResult && !/\.(mp4|webm|mov)$/i.test(shot.lastQueueResult || "")));
      if (
        bindingPatch.mainCharacterToken !== (shot.mainCharacterToken || "")
        || bindingPatch.mainSceneToken !== (shot.mainSceneToken || "")
        || JSON.stringify(bindingPatch.keyPropTokens || []) !== JSON.stringify(shot.keyPropTokens || [])
      ) bindingCount += 1;
      if (
        qualityPatch.shotType !== (shot.shotType || "")
        || qualityPatch.imageParamPreset !== (shot.imageParamPreset || "")
        || qualityPatch.videoParamPreset !== (shot.videoParamPreset || "")
      ) strategyCount += 1;
      if (!String(shot.imagePrompt || "").trim() || !String(shot.videoPrompt || "").trim()) promptCount += 1;
      const nextShot = {
        ...mergedShot,
        imagePrompt: String(shot.imagePrompt || "").trim() || buildImageShotPrompt(mergedShot, assetIndex, resourceIndex),
        videoPrompt: String(shot.videoPrompt || "").trim() || buildVideoShotPrompt(mergedShot, assetIndex, resourceIndex),
        reviewStatus: buildShotQualityReport(mergedShot).score >= 88 ? "已通过" : (shot.reviewStatus || "待修改"),
        status: hasImageResult ? (shot.status || "待生视频") : (shot.status === "待生视频" ? "待生视频" : "待生图"),
      };
      if (hadHighRisk && buildShotRiskProfile(nextShot).level !== "高风险") repairedCount += 1;
      preparedShots.push(nextShot);
      return nextShot;
    });
    updateNode(node.id, { shots: nextShots }, { skipHistory: true });
    const queuedTargets = preparedShots.filter((shot) => !(shot.imageUrl || shot.imageResultUrl || (shot.lastQueueResult && !/\.(mp4|webm|mov)$/i.test(shot.lastQueueResult || ""))));
    const jobs = queuedTargets.length
      ? enqueueShotGenerationJobs({
        targetShots: queuedTargets,
        nodeId: node.id,
        kind: "image",
        buildImageShotPrompt,
        buildVideoShotPrompt,
        assetIndex,
        resourceIndex,
        addGenerationJobs,
        defaultImageProviderMode,
      })
      : [];
    onSyncToTimeline?.(buildShotTimelinePayload({ shots: preparedShots, nodeId: node.id, normalizeShotRecord }));
    setBatchSummary({
      flow: "autopilot",
      total: preparedShots.length,
      repairedCount,
      bindingCount,
      strategyCount,
      promptCount,
      imageJobs: jobs.length,
      syncedTimeline: preparedShots.length,
      waitingVideo: preparedShots.filter((shot) => (shot.status || "") === "待生视频").length,
    });
    setMessage(jobs.length
      ? `已自动推进 ${preparedShots.length} 个镜头到首轮出图：补绑定、降风险、重建提示词并入队 ${jobs.length} 个图片任务`
      : `已自动整理 ${preparedShots.length} 个镜头：补绑定、降风险、重建提示词，当前没有新的图片任务需要入队`);
  }

  function exportShotPrompts() {
    if (!shots.length) return;
    const text = formatShotListMarkdown(shots, assetIndex, resourceIndex);
    createOutputNear(node.id, "text", "镜头表导出", {
      displayName: "镜头表导出",
      text,
      width: 520,
      height: 360,
    });
  }

  function buildTimelinePayload(targetShots = shots) {
    return buildShotTimelinePayload({ shots: targetShots, nodeId: node.id, normalizeShotRecord });
  }

  function syncShotsToTimeline(targetShots = shots) {
    const payload = buildTimelinePayload(targetShots);
    onSyncToTimeline?.(payload);
    setMessage(`已同步 ${payload.length} 个镜头到时间线`);
  }

  function enqueueShots(kind, targetShots = shots) {
    const riskyShots = (targetShots || []).map((shot) => ({ shot, risk: buildShotRiskProfile(shot) })).filter((item) => item.risk.level === "高风险");
    if (riskyShots.length) {
      setMessage(`当前有 ${riskyShots.length} 个高风险镜头，不建议直接入队：${riskyShots.slice(0, 4).map((item) => item.shot.id).join("、")}${riskyShots.length > 4 ? "..." : ""}`);
      return;
    }
    const jobs = enqueueShotGenerationJobs({
      targetShots,
      nodeId: node.id,
      kind,
      buildImageShotPrompt,
      buildVideoShotPrompt,
      assetIndex,
      resourceIndex,
      addGenerationJobs,
      defaultImageProviderMode,
    });
    setMessage(`已加入 ${jobs.length} 个${kind === "video" ? "视频" : "图片"}生成任务`);
  }

  async function copySelectedPrompt(kind) {
    if (!selected) return;
    const text = kind === "image"
      ? buildImageShotPrompt(selected, assetIndex, resourceIndex)
      : buildVideoShotPrompt(selected, assetIndex, resourceIndex);
    await copyTextWithFeedback({
      text,
      setMessage,
      successMessage: `已复制${kind === "image" ? "图片" : "视频"}提示词`,
    });
  }

  function previewSelected(kind) {
    if (!selected) return;
    openPromptPreview({
      title: `${selected.id || "镜头"} ${kind === "image" ? "图片" : "AI视频"}提示词预览`,
      kind,
      original: kind === "image" ? buildImageShotPrompt(selected, assetIndex, resourceIndex) : buildVideoShotPrompt(selected, assetIndex, resourceIndex),
      negative: kind === "image" ? (selected.negativePrompt || "文字水印，低清晰度，角色不一致，构图混乱") : "画面闪烁，脸部崩坏，服装跳变，多手多脚，文字水印",
      params: `状态：${selected.status || "待写"} · 景别：${selected.shotSize || "-"} · 时长：${selected.duration || "-"} · 运镜：${selected.cameraMove || selected.camera || "-"}`,
    });
  }

  function previewReferenceTokenInsert(token) {
    patchShot(selectedIndex, { referenceResources: appendToken(selected?.referenceResources || "", token) });
  }

  function mergeShotAssetRefs(currentShot, tokens = []) {
    return [...new Set([...(Array.isArray(currentShot?.assetRefs) ? currentShot.assetRefs : []), ...tokens.filter(Boolean)])];
  }

  function bindPrimaryAsset(field, token) {
    const patch = { [field]: token, assetRefs: mergeShotAssetRefs(selected, [token]) };
    patchShot(selectedIndex, patch);
  }

  function appendPropBinding(token) {
    const nextProps = [...new Set([...(Array.isArray(selected?.keyPropTokens) ? selected.keyPropTokens : []), token].filter(Boolean))];
    patchShot(selectedIndex, {
      keyPropTokens: nextProps,
      assetRefs: mergeShotAssetRefs(selected, [token]),
    });
  }

  function createImageNodeFromShot(shot = selected) {
    if (!shot) return;
    const risk = buildShotRiskProfile(shot);
    if (risk.level === "高风险") {
      setMessage(`${shot.id} 目前属于高风险镜头，建议先补绑定、开收尾和风险控制后再生图`);
      return;
    }
    const prompt = shot.imagePrompt || buildImageShotPrompt(shot, assetIndex, resourceIndex);
    createOutputNear(node.id, "imageEdit", `${shot.id}-AI生图`, {
      prompt,
      targetShotId: shot.id || "",
      mainCharacterToken: shot.mainCharacterToken || "",
      mainSceneToken: shot.mainSceneToken || "",
      keyPropTokens: Array.isArray(shot.keyPropTokens) ? shot.keyPropTokens.filter(Boolean) : [],
      assetRefs: Array.isArray(shot.assetRefs) ? shot.assetRefs.filter(Boolean) : [],
      referenceResources: shot.referenceResources || "",
      providerMode: shot.imageProviderMode === "custom" ? "api" : (shot.imageProviderMode || "inherit"),
    });
    patchShot(shots.findIndex((item) => item.id === shot.id), {
      imagePrompt: prompt,
      status: shot.status === "待写" ? "待生图" : (shot.status || "待生图"),
    });
    setMessage(`已为 ${shot.id} 创建 AI生图节点`);
  }

  function createImageNodesFromShots(targetShots = filteredShots) {
    const items = Array.isArray(targetShots) ? targetShots.filter(Boolean) : [];
    if (!items.length) {
      setMessage("当前没有可转成 AI生图节点的镜头");
      return;
    }
    const riskyShots = items.map((shot) => ({ shot, risk: buildShotRiskProfile(shot) })).filter((item) => item.risk.level === "高风险");
    if (riskyShots.length) {
      setMessage(`当前筛选里有 ${riskyShots.length} 个高风险镜头，建议先修后再批量转 AI 生图：${riskyShots.slice(0, 4).map((item) => item.shot.id).join("、")}${riskyShots.length > 4 ? "..." : ""}`);
      return;
    }
    items.forEach((shot, index) => {
      const prompt = shot.imagePrompt || buildImageShotPrompt(shot, assetIndex, resourceIndex);
      createOutputNear(node.id, "imageEdit", `${shot.id}-AI生图`, {
        prompt,
        targetShotId: shot.id || "",
        mainCharacterToken: shot.mainCharacterToken || "",
        mainSceneToken: shot.mainSceneToken || "",
        keyPropTokens: Array.isArray(shot.keyPropTokens) ? shot.keyPropTokens.filter(Boolean) : [],
        assetRefs: Array.isArray(shot.assetRefs) ? shot.assetRefs.filter(Boolean) : [],
        referenceResources: shot.referenceResources || "",
        providerMode: shot.imageProviderMode === "custom" ? "api" : (shot.imageProviderMode || "inherit"),
        __offsetX: (index % 3) * 350,
        __offsetY: Math.floor(index / 3) * 330,
      });
    });
    updateNode(node.id, {
      shots: shots.map((shot) => {
        const target = items.find((item) => item.id === shot.id);
        if (!target) return shot;
        const prompt = shot.imagePrompt || buildImageShotPrompt(shot, assetIndex, resourceIndex);
        return {
          ...shot,
          imagePrompt: prompt,
          status: shot.status === "待写" ? "待生图" : (shot.status || "待生图"),
        };
      }),
    }, { skipHistory: true });
    setMessage(`已批量创建 ${items.length} 个 AI生图节点`);
  }

  function patchSelectedShotDecision(action) {
    if (!selected) return;
    if (!selectedMediaUrl && action !== "rework") {
      setMessage("当前镜头还没有可验收的生成结果");
      return;
    }
    const patch = action === "confirm"
      ? {
        status: "已确认",
        reviewStatus: "已通过",
        resultDecision: "confirm",
        resultDecisionAt: Date.now(),
      }
      : action === "complete"
        ? {
          status: "完成",
          reviewStatus: "已通过",
          resultDecision: "complete",
          resultDecisionAt: Date.now(),
        }
        : {
          status: "待修改",
          reviewStatus: "待修改",
          resultDecision: "rework",
          resultDecisionAt: Date.now(),
          reworkReason: selected.reworkReason || "镜头验收未通过，等待重新生成或重写提示词",
          rejectedResultUrl: selectedMediaUrl || selected.rejectedResultUrl || "",
        };
    const merged = { ...selected, ...patch };
    patchShot(selectedIndex, patch);
    if (action !== "rework") {
      onSyncToTimeline?.(buildShotTimelinePayload({ shots: [merged], nodeId: node.id, normalizeShotRecord }));
    }
    setMessage(action === "confirm"
      ? `已采用并确认当前镜头：${selected.id}`
      : action === "complete"
        ? `已采用并完成当前镜头：${selected.id}`
        : `已将当前镜头退回待修改：${selected.id}`);
  }

  function locateSelectedResult() {
    if (!selected) return;
    const result = onLocateResultForShot?.(node.id, selected.id);
    if (!result) {
      setMessage(`没有找到 ${selected.id} 对应的结果节点`);
      return;
    }
    setMessage(`已定位 ${selected.id} 的结果节点`);
  }

  function rerunSelectedShot() {
    if (!selected) return;
    if (selectedHasVideo || String(selected.status || "") === "待生视频") {
      enqueueShots("video", [selected]);
      return;
    }
    enqueueShots("image", [selected]);
  }

  function prepareSelectedShotForProduction(mode = "next") {
    if (!selected) return null;
    const bindingPatch = suggestShotAssetBindingPatch(selected, assetIndex);
    const qualityPatch = buildShotQualityPatch({ ...selected, ...bindingPatch });
    const mergedShot = { ...selected, ...bindingPatch, ...qualityPatch };
    const nextShot = {
      ...mergedShot,
      imagePrompt: String(selected.imagePrompt || "").trim() || buildImageShotPrompt(mergedShot, assetIndex, resourceIndex),
      videoPrompt: String(selected.videoPrompt || "").trim() || buildVideoShotPrompt(mergedShot, assetIndex, resourceIndex),
      reviewStatus: buildShotQualityReport(mergedShot).score >= 88 ? "已通过" : (mode === "rollback" ? "待修改" : (selected.reviewStatus || "待修改")),
      status: mode === "rollback"
        ? (selectedHasVideo || String(selected.status || "") === "待生视频" ? "待生视频" : "待生图")
        : (selectedHasVideo
          ? (selected.status || "待生视频")
          : selectedHasImage
            ? ((String(selected.videoPrompt || "").trim() || String(selected.status || "") === "待生视频") ? "待生视频" : (selected.status || "待生图"))
            : (selected.status === "待生视频" ? "待生视频" : "待生图")),
    };
    return nextShot;
  }

  function commitSelectedPreparedShot(nextShot) {
    patchShot(selectedIndex, nextShot);
    return nextShot;
  }

  function runSelectedShotNext() {
    if (!selected) return;
    if (selected.resultDecision === "complete") {
      syncShotsToTimeline([selected]);
      setMessage(`当前镜头 ${selected.id} 已完成，已再次同步时间线`);
      return;
    }
    if (selectedMediaUrl && selected.resultDecision === "confirm") {
      patchSelectedShotDecision("complete");
      return;
    }
    if (selectedMediaUrl && !selected.resultDecision) {
      patchSelectedShotDecision("confirm");
      return;
    }
    const nextShot = prepareSelectedShotForProduction("next");
    if (!nextShot) return;
    commitSelectedPreparedShot(nextShot);
    if (selectedHasVideo || String(nextShot.status || "") === "待生视频") {
      enqueueShots("video", [nextShot]);
      setMessage(`已为 ${nextShot.id} 自动完成修镜头、补绑定并送入视频队列`);
      return;
    }
    enqueueShots("image", [nextShot]);
    setMessage(`已为 ${nextShot.id} 自动完成修镜头、补绑定并送入图片队列`);
  }

  function rollbackSelectedShot() {
    if (!selected) return;
    if (selectedMediaUrl && selected.resultDecision !== "rework") {
      patchSelectedShotDecision("rework");
    }
    const nextShot = prepareSelectedShotForProduction("rollback");
    if (!nextShot) return;
    const rollbackShot = {
      ...nextShot,
      resultDecision: "rework",
      resultDecisionAt: Date.now(),
      reworkReason: selected.reworkReason || "用户点击回退修改，已自动重建镜头骨架并重新入队",
      rejectedResultUrl: selectedMediaUrl || selected.rejectedResultUrl || "",
    };
    commitSelectedPreparedShot(rollbackShot);
    if (selectedHasVideo || String(rollbackShot.status || "") === "待生视频") {
      enqueueShots("video", [rollbackShot]);
      setMessage(`已将 ${rollbackShot.id} 回退修改，并自动重新送入视频队列`);
      return;
    }
    enqueueShots("image", [rollbackShot]);
    setMessage(`已将 ${rollbackShot.id} 回退修改，并自动重新送入图片队列`);
  }

  function advanceSelectedShot() {
    if (!selected || !selectedNextAction) return;
    if (selectedNextAction.key === "repair") {
      repairSelectedShot();
      return;
    }
    if (selectedNextAction.key === "binding") {
      applySuggestedBindings(selectedIndex);
      return;
    }
    if (selectedNextAction.key === "prompt") {
      syncSelectedPrompts();
      return;
    }
    if (selectedNextAction.key === "image") {
      enqueueShots("image", [selected]);
      return;
    }
    if (selectedNextAction.key === "video") {
      enqueueShots("video", [selected]);
      return;
    }
    if (selectedNextAction.key === "confirm") {
      patchSelectedShotDecision("confirm");
      return;
    }
    if (selectedNextAction.key === "timeline") {
      syncShotsToTimeline([selected]);
    }
  }

  return (
    <>
      <NodeHeader icon="shot" title={node.data.displayName || "镜头表"} />
      <section className="panel-action-strip node-action-strip">
        <div className="panel-action-strip-copy">
          <strong>当前任务</strong>
          <span>{selected ? `${selected.id} · ${selected.scene || "未填场景"}` : "当前未选镜头"}</span>
          <p>{shotTaskHint}</p>
        </div>
        <div className="panel-action-strip-actions">
          <button className="primary" disabled={!selected} onClick={runSelectedShotNext}>下一步</button>
          <button disabled={!selected} onClick={rollbackSelectedShot}>回退修改</button>
          <button className="primary" disabled={!filteredShots.length} onClick={() => runAutoPilotProduction(filteredShots)}>自动推进到首轮出图</button>
          <button className="primary" disabled={!filteredShots.length} onClick={() => runBatchProductionFlow(filteredShots)}>一键批量生产</button>
          <button disabled={!filteredShots.length} onClick={() => runBatchVideoFlow(filteredShots)}>一键批量视频</button>
          <button disabled={!filteredShots.length} onClick={() => applySuggestedBindingsBatch(filteredShots)}>批量补绑定</button>
          <button disabled={!selected} onClick={repairSelectedShot}>一键修当前镜头</button>
        </div>
      </section>
      <div className="shot-summary">
        <span className="pill">{shots.length} 个镜头</span>
        <span className="pill">平均质量 {qualitySummary}</span>
        <span className={riskSummary.high ? "pill pill-warn" : "pill pill-ok"}>高风险 {riskSummary.high}</span>
        <span className={riskSummary.medium ? "pill pill-warn" : "pill pill-ok"}>中风险 {riskSummary.medium}</span>
        <span className="pill pill-ok">低风险 {riskSummary.low}</span>
        <span className="pill">已出图 {productionSummary.imageReady}</span>
        <span className="pill">已出视频 {productionSummary.videoReady}</span>
        <span className={productionSummary.pendingVideo ? "pill pill-warn" : "pill pill-ok"}>待视频 {productionSummary.pendingVideo}</span>
        <span className="pill pill-ok">已完成 {productionSummary.completed}</span>
        {statusSummary.map((item) => <span key={item.status} className="pill">{item.status} {item.count}</span>)}
      </div>
      {batchSummary && (
        <div className="shot-batch-summary">
          <span className={`pill ${batchSummary.flow === "riskStop" ? "pill-warn" : "pill-ok"}`}>{batchSummary.flow === "video" ? "视频流" : batchSummary.flow === "riskStop" ? "风险拦截" : batchSummary.flow === "autopilot" ? "自动推进" : "图像流"} · 本次处理 {batchSummary.total} 镜头</span>
          {!!batchSummary.risky && <span className="pill pill-warn">高风险 {batchSummary.risky}</span>}
          {!!batchSummary.riskyIds?.length && <span className="pill">{batchSummary.riskyIds.join("、")}</span>}
          {!!batchSummary.repairedCount && <span className="pill pill-ok">已降风险 {batchSummary.repairedCount}</span>}
          <span className="pill">补绑定 {batchSummary.bindingCount}</span>
          <span className="pill">套策略 {batchSummary.strategyCount}</span>
          <span className="pill">补提示词 {batchSummary.promptCount}</span>
          {!!batchSummary.imageJobs && <span className="pill pill-ok">图片入队 {batchSummary.imageJobs}</span>}
          {!!batchSummary.videoJobs && <span className="pill pill-ok">视频入队 {batchSummary.videoJobs}</span>}
          <span className="pill">时间线同步 {batchSummary.syncedTimeline}</span>
          <span className={batchSummary.waitingVideo ? "pill pill-warn" : "pill pill-ok"}>待视频 {batchSummary.waitingVideo}</span>
          {!!batchSummary.promotedCount && <span className="pill pill-ok">推进状态 {batchSummary.promotedCount}</span>}
        </div>
      )}
      <div className="shot-toolbar">
        <input value={draftSeed} onChange={(event) => setDraftSeed(event.target.value)} placeholder="快速新建镜头：可先写场景或动作关键词" />
        <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setSelectedIndex(0); }}>
          <option>全部</option>
          {SHOT_STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}
        </select>
        <button className="primary" onClick={addShot}>新增镜头</button>
        <button disabled={!selected} onClick={duplicateSelectedShot}>复制当前</button>
        <button className="danger" disabled={!selected} onClick={deleteSelectedShot}>删除当前</button>
        <button disabled={!filteredShots.length} onClick={() => enqueueShots("image", filteredShots)}>图片入队</button>
        <button disabled={!selected} onClick={() => createImageNodeFromShot(selected)}>当前转AI生图</button>
        <button disabled={!filteredShots.length} onClick={() => createImageNodesFromShots(filteredShots)}>批量转AI生图</button>
        <button disabled={!filteredShots.length} onClick={() => enqueueShots("video", filteredShots)}>视频入队</button>
        <button className="primary" disabled={!filteredShots.length} onClick={() => runAutoPilotProduction(filteredShots)}>自动推进到首轮出图</button>
        <button className="primary" disabled={!filteredShots.length} onClick={() => runBatchProductionFlow(filteredShots)}>一键批量生产</button>
        <button className="primary" disabled={!filteredShots.length} onClick={() => runBatchVideoFlow(filteredShots)}>一键批量视频</button>
        <button disabled={!filteredShots.length} onClick={() => applySuggestedBindingsBatch(filteredShots)}>批量补绑定</button>
        <button disabled={!filteredShots.length} onClick={() => applyShotTypeStrategyBatch(filteredShots)}>批量套策略</button>
        <button disabled={!filteredShots.length} onClick={() => autoPolishShots(filteredShots)}>批量优化骨架</button>
        <button disabled={!filteredShots.length} onClick={() => autoPolishShots(filteredShots)}>批量一键修镜头</button>
        <button disabled={!filteredShots.length} onClick={() => syncShotsToTimeline(filteredShots)}>同步时间线</button>
        <button disabled={!shots.length} onClick={exportShotPrompts}>导出文本</button>
      </div>
      <div className="shot-batch-toolbar">
        <button disabled={!filteredShots.length} onClick={() => patchShotsByStatus(statusFilter, { status: "待生图" })}>批量标记待生图</button>
        <button disabled={!filteredShots.length} onClick={() => patchShotsByStatus(statusFilter, { status: "待生视频" })}>批量标记待生视频</button>
        <button disabled={!filteredShots.length} onClick={() => patchShotsByStatus(statusFilter, { status: "完成" })}>批量完成</button>
      </div>
      <div className="shot-layout">
        <div className="shot-table">
          {filteredShots.length ? filteredShots.map((shot) => {
            const index = shots.findIndex((item) => item.id === shot.id);
            return (
              <button key={shot.id || index} className={index === selectedIndex ? "active" : ""} onClick={() => setSelectedIndex(index)}>
                <b>{shot.id}</b>
                <span>{shot.scene}</span>
                <small>{shot.duration || "未填时长"} · {shot.cameraMove || shot.camera || "未填运镜"}</small>
                <em>{shot.status || "待写"} · 审稿{shot.reviewStatus || "未审"} · 质量{buildShotQualityReport(shot).score}</em>
              </button>
            );
          }) : <div className="asset-empty">当前筛选下暂无镜头。</div>}
        </div>
        {selected && (
          <div className="shot-detail">
            <div className="shot-summary">
              <span className="pill">质量 {buildShotQualityReport(selected).score}</span>
              <span className="pill">{buildShotQualityReport(selected).level}</span>
              <span className="pill">{buildShotQualityReport(selected).summary}</span>
              <span className={buildShotRiskProfile(selected).level === "高风险" ? "pill pill-warn" : buildShotRiskProfile(selected).level === "中风险" ? "pill pill-warn" : "pill pill-ok"}>{buildShotRiskProfile(selected).level}</span>
              <span className={selectedMediaUrl ? "pill pill-ok" : "pill pill-warn"}>{selectedResultLabel}</span>
              {!!selected.resultDecision && <span className={selected.resultDecision === "rework" ? "pill pill-warn" : "pill pill-ok"}>验收 {selected.resultDecision === "confirm" ? "已确认" : selected.resultDecision === "complete" ? "已完成" : "待重做"}</span>}
              {selectedNextAction ? <span className="pill">下一步 {selectedNextAction.label}</span> : null}
            </div>
            <div className="shot-acceptance-card">
              <div className="shot-acceptance-card__header">
                <strong>镜头风险雷达</strong>
                <span>{buildShotRiskProfile(selected).recommendation}</span>
              </div>
              <div className="shot-summary">
                <span className={buildShotRiskProfile(selected).level === "高风险" ? "pill pill-warn" : buildShotRiskProfile(selected).level === "中风险" ? "pill pill-warn" : "pill pill-ok"}>风险分 {buildShotRiskProfile(selected).score}</span>
                <span className="pill">阻塞 {buildShotRiskProfile(selected).blockerCount}</span>
                <span className="pill">提示 {buildShotRiskProfile(selected).warningCount}</span>
                <span className="pill">{selected.shotType || buildShotQualityPatch(selected).shotType || "未分类"}</span>
              </div>
              {buildShotRiskProfile(selected).issues.length ? <div className="shot-rework-note">阻塞项：{buildShotRiskProfile(selected).issues.join("；")}</div> : null}
              {buildShotRiskProfile(selected).warnings.length ? <div className="shot-rework-note">风险提示：{buildShotRiskProfile(selected).warnings.join("；")}</div> : null}
              <div className="shot-actions shot-actions--acceptance">
                <button onClick={() => applySuggestedBindings(selectedIndex)}>先补绑定</button>
                <button onClick={() => applyShotTypeStrategy(selectedIndex)}>套镜头策略</button>
                <button onClick={() => autoPolishShot(selectedIndex)}>补质量骨架</button>
                <button className="primary" onClick={repairSelectedShot}>一键降风险</button>
                <button onClick={syncSelectedPrompts}>重建提示词骨架</button>
              </div>
            </div>
            <div className="shot-acceptance-card">
              <div className="shot-acceptance-card__header">
                <strong>镜头类型路由</strong>
                <span>{buildShotTypeRouteSummary(selected).focusRoute}</span>
              </div>
              <div className="shot-summary">
                <span className="pill">{buildShotTypeRouteSummary(selected).shotType}</span>
                <span className="pill">图像 {buildShotTypeRouteSummary(selected).imagePreset || "-"}</span>
                <span className="pill">视频 {buildShotTypeRouteSummary(selected).videoPreset || "-"}</span>
                <span className="pill">图像比例 {buildShotTypeRouteSummary(selected).imageAspectRatio || "-"}</span>
                <span className="pill">视频比例 {buildShotTypeRouteSummary(selected).videoAspectRatio || "-"}</span>
                <span className="pill">运动强度 {buildShotTypeRouteSummary(selected).motionStrength || "-"}</span>
              </div>
              <div className="shot-rework-note">图像路由：{buildShotTypeRouteSummary(selected).imageRoute}</div>
              <div className="shot-rework-note">视频路由：{buildShotTypeRouteSummary(selected).videoRoute}</div>
              <div className="shot-actions shot-actions--acceptance">
                <button onClick={() => applyShotTypeStrategy(selectedIndex)}>重套当前策略</button>
                <button onClick={() => patchShot(selectedIndex, { imagePrompt: buildImageShotPrompt(selected, assetIndex, resourceIndex) })}>重建图片提示词</button>
                <button onClick={() => patchShot(selectedIndex, { videoPrompt: buildVideoShotPrompt(selected, assetIndex, resourceIndex) })}>重建视频提示词</button>
                <button className="primary" onClick={() => {
                  const patch = buildShotQualityPatch(selected);
                  patchShot(selectedIndex, {
                    ...patch,
                    imagePrompt: buildImageShotPrompt({ ...selected, ...patch }, assetIndex, resourceIndex),
                    videoPrompt: buildVideoShotPrompt({ ...selected, ...patch }, assetIndex, resourceIndex),
                  });
                  setMessage(`已为 ${selected.id} 按 ${patch.shotType} 重建策略与提示词`);
                }}>按类型全量重建</button>
              </div>
            </div>
            <div className="shot-acceptance-card">
              <div className="shot-acceptance-card__header">
                <strong>结果验收</strong>
                <span>{selectedMediaUrl ? "当前镜头已经有结果，可以直接确认、完结或退回。" : "先生成图像或视频结果，再进入验收。"}
                </span>
              </div>
              <div className="shot-summary">
                <span className={selectedHasImage ? "pill pill-ok" : "pill"}>图片 {selectedHasImage ? "已就绪" : "未就绪"}</span>
                <span className={selectedHasVideo ? "pill pill-ok" : "pill"}>视频 {selectedHasVideo ? "已就绪" : "未就绪"}</span>
                <span className="pill">状态 {selected.status || "待写"}</span>
                <span className="pill">审稿 {selected.reviewStatus || "未审"}</span>
                {!!selected.reworkReason && <span className="pill pill-warn">退回原因已记录</span>}
              </div>
              {!!selected.reworkReason && <div className="shot-rework-note">{selected.reworkReason}</div>}
              <div className="shot-actions shot-actions--acceptance">
                <button onClick={locateSelectedResult}>查看结果节点</button>
                <button className="primary" onClick={runSelectedShotNext}>下一步</button>
                <button onClick={rollbackSelectedShot}>回退修改</button>
                <button className="primary" disabled={!selectedMediaUrl} onClick={() => patchSelectedShotDecision("confirm")}>采用并确认</button>
                <button className="primary" disabled={!selectedMediaUrl} onClick={() => patchSelectedShotDecision("complete")}>采用并完成</button>
                <button onClick={() => patchSelectedShotDecision("rework")}>退回待重做</button>
                <button onClick={rerunSelectedShot}>{selectedHasVideo ? "重入视频队列" : "重开AI生图"}</button>
              </div>
            </div>
            <div className="shot-fields">
              <label>状态<select value={selected.status || "待写"} onChange={(event) => patchShot(selectedIndex, { status: event.target.value })}>
                {SHOT_STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}
              </select></label>
              <label>审稿<select value={selected.reviewStatus || "未审"} onChange={(event) => patchShot(selectedIndex, { reviewStatus: event.target.value })}>
                {REVIEW_STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}
              </select></label>
              <label>镜头类型<input value={selected.shotType || ""} onChange={(event) => patchShot(selectedIndex, { shotType: event.target.value })} placeholder="建立镜头 / 对话镜头 / 动作镜头 / 情绪特写" /></label>
              <label>景别<input value={selected.shotSize || ""} onChange={(event) => patchShot(selectedIndex, { shotSize: event.target.value })} /></label>
              <label>时长<input value={selected.duration || ""} onChange={(event) => patchShot(selectedIndex, { duration: event.target.value })} /></label>
              <label>镜头运动<input value={selected.cameraMove || selected.camera || ""} onChange={(event) => patchShot(selectedIndex, { cameraMove: event.target.value })} /></label>
              <label>图片调用方式<select value={selected.imageProviderMode || "inherit"} onChange={(event) => patchShot(selectedIndex, { imageProviderMode: event.target.value })}>
                <option value="inherit">继承全局</option>
                <option value="custom">API</option>
                <option value="comfy">ComfyUI</option>
              </select></label>
            </div>
            <div className="shot-fields shot-fields--wide">
              <label>主焦点<input value={selected.mainFocus || ""} onChange={(event) => patchShot(selectedIndex, { mainFocus: event.target.value })} /></label>
              <label>画面意图<input value={selected.frameIntent || ""} onChange={(event) => patchShot(selectedIndex, { frameIntent: event.target.value })} /></label>
            </div>
            <div className="shot-binding-card">
              <div className="shot-binding-card__header">
                <strong>资产绑定</strong>
                <span>把镜头主角色、主场景、关键道具显式锁住，后面生成更稳。</span>
              </div>
              <div className="shot-fields shot-fields--wide">
                <label>
                  主角色绑定
                  <AssetTokenInsertRow assetIndex={assetIndex} onInsert={(token) => bindPrimaryAsset("mainCharacterToken", token)} />
                  <input value={selected.mainCharacterToken || ""} onChange={(event) => patchShot(selectedIndex, { mainCharacterToken: event.target.value, assetRefs: mergeShotAssetRefs(selected, [event.target.value]) })} placeholder="@角色_主角" />
                </label>
                <label>
                  主场景绑定
                  <AssetTokenInsertRow assetIndex={assetIndex} onInsert={(token) => bindPrimaryAsset("mainSceneToken", token)} />
                  <input value={selected.mainSceneToken || ""} onChange={(event) => patchShot(selectedIndex, { mainSceneToken: event.target.value, assetRefs: mergeShotAssetRefs(selected, [event.target.value]) })} placeholder="@场景_夜巷" />
                </label>
              </div>
              <div className="shot-fields shot-fields--wide">
                <label>
                  关键道具绑定
                  <AssetTokenInsertRow assetIndex={assetIndex} onInsert={appendPropBinding} />
                  <input value={(selected.keyPropTokens || []).join(" ")} onChange={(event) => patchShot(selectedIndex, { keyPropTokens: String(event.target.value || "").split(/[\s,，;；]+/).filter(Boolean) })} placeholder="@道具_纸人 @道具_面具" />
                </label>
                <label>
                  资产总引用
                  <AssetTokenInsertRow assetIndex={assetIndex} onInsert={(token) => patchShot(selectedIndex, { assetRefs: mergeShotAssetRefs(selected, [token]) })} />
                  <input value={(selected.assetRefs || []).join(" ")} onChange={(event) => patchShot(selectedIndex, { assetRefs: String(event.target.value || "").split(/[\s,，;；]+/).filter(Boolean) })} placeholder="@角色_主角 @场景_夜巷 @道具_纸人" />
                </label>
              </div>
            </div>
            <div className="shot-fields shot-fields--wide">
              <label>画面动作<textarea value={selected.action || ""} onChange={(event) => patchShot(selectedIndex, { action: event.target.value })} /></label>
              <label>镜头补充<textarea value={selected.note || ""} onChange={(event) => patchShot(selectedIndex, { note: event.target.value })} placeholder="补充构图、表情、运动节奏或模型注意事项" /></label>
            </div>
            <label>开场画面<textarea value={selected.openingFrame || ""} onChange={(event) => patchShot(selectedIndex, { openingFrame: event.target.value })} /></label>
            <label>收尾画面<textarea value={selected.closingFrame || ""} onChange={(event) => patchShot(selectedIndex, { closingFrame: event.target.value })} /></label>
            <label>连续性说明<textarea value={selected.continuityNote || ""} onChange={(event) => patchShot(selectedIndex, { continuityNote: event.target.value })} /></label>
            <label>风险控制<textarea value={selected.riskControl || ""} onChange={(event) => patchShot(selectedIndex, { riskControl: event.target.value })} /></label>
            <label>图片提示词<AssetTokenInsertRow assetIndex={assetIndex} onInsert={(token) => patchShot(selectedIndex, { imagePrompt: appendToken(selected.imagePrompt || "", token) })} /><textarea value={selected.imagePrompt || ""} onChange={(event) => patchShot(selectedIndex, { imagePrompt: event.target.value })} /></label>
            <label>AI视频提示词<AssetTokenInsertRow assetIndex={assetIndex} onInsert={(token) => patchShot(selectedIndex, { videoPrompt: appendToken(selected.videoPrompt || "", token) })} /><textarea value={selected.videoPrompt || ""} onChange={(event) => patchShot(selectedIndex, { videoPrompt: event.target.value })} /></label>
            <details className="node-advanced">
              <summary>高级设置</summary>
              <div className="node-advanced__body">
                <label>负面提示词<textarea className="small-textarea" value={selected.negativePrompt || ""} onChange={(event) => patchShot(selectedIndex, { negativePrompt: event.target.value })} /></label>
                <label>参考资源<AssetTokenInsertRow assetIndex={{ items: resourceTokenItems }} onInsert={previewReferenceTokenInsert} /><input value={selected.referenceResources || ""} onChange={(event) => patchShot(selectedIndex, { referenceResources: event.target.value })} placeholder="@资源_主角参考 @资源_S03夜景" /></label>
                <label>审稿备注<textarea className="small-textarea" value={selectedReviewComments.map((item) => `${item?.author || "导演"}：${item?.text || ""}`).join("\n")} readOnly /></label>
              </div>
            </details>
            <div className="shot-actions">
              <button className="primary" disabled={!selected} onClick={runSelectedShotNext}>下一步</button>
              <button disabled={!selected} onClick={rollbackSelectedShot}>回退修改</button>
              <button disabled={!selectedNextAction} onClick={advanceSelectedShot}>{selectedNextAction ? `细分下一步 · ${selectedNextAction.label}` : "细分下一步"}</button>
              <button className="primary" onClick={() => enqueueShots("image", [selected])}>当前图像入队</button>
              <button onClick={() => createImageNodeFromShot(selected)}>生成AI生图节点</button>
              <button className="primary" onClick={() => enqueueShots("video", [selected])}>当前视频入队</button>
              <button onClick={repairSelectedShot}>一键修镜头</button>
              <button onClick={() => applySuggestedBindings(selectedIndex)}>智能补绑定</button>
              <button onClick={() => applyShotTypeStrategy(selectedIndex)}>应用类型策略</button>
              <button onClick={() => patchShot(selectedIndex, { negativePrompt: buildShotQualityPatch(selected).negativePrompt || selected.negativePrompt || "" })}>补类型避坑</button>
              <button onClick={() => autoPolishShot(selectedIndex)}>优化当前骨架</button>
              <button onClick={syncSelectedPrompts}>补齐默认提示词</button>
              <button onClick={() => syncShotsToTimeline([selected])}>当前同步时间线</button>
              <button onClick={() => previewSelected("image")}>预览图片</button>
              <button onClick={() => copySelectedPrompt("image")}>复制图片提示词</button>
              <button onClick={() => previewSelected("video")}>预览视频</button>
              <button onClick={() => copySelectedPrompt("video")}>复制视频提示词</button>
            </div>
          </div>
        )}
      </div>
      {message && <small className="result-message">{message}</small>}
    </>
  );
}

export function AssetLibraryNode({ node, updateNode, onCreatePromptNode, assetIndex, resourceIndex, helpers }) {
  const {
    NodeHeader,
    AssetTokenInsertRow,
    assetListByTab,
    normalizeAsset,
    assetCategoryByTab,
    makeAssetToken,
    appendToken,
    addUniqueImage,
    readImage,
    persistImportedImage,
  } = helpers;
  const characters = Array.isArray(node.data.characters) ? node.data.characters : [];
  const scenes = Array.isArray(node.data.scenes) ? node.data.scenes : [];
  const props = Array.isArray(node.data.props) ? node.data.props : [];
  const [tab, setTab] = useState("characters");
  const [query, setQuery] = useState("");
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [message, setMessage] = useState("");
  const assets = assetListByTab(tab, { characters, scenes, props })
    .map((asset) => normalizeAsset(asset, assetCategoryByTab(tab), node.id));
  const filteredAssets = assets
    .map((asset, index) => ({ asset, index }))
    .filter(({ asset }) => {
      const haystack = `${asset.name || ""} ${asset.kind || ""} ${asset.token || ""} ${asset.meta || ""} ${asset.prompt || ""}`.toLowerCase();
      const missingFields = assetIndex?.byToken?.get(asset.token)?.missingFields || [];
      const queryMatched = !query.trim() || haystack.includes(query.trim().toLowerCase());
      const incompleteMatched = !onlyIncomplete || missingFields.length > 0;
      return queryMatched && incompleteMatched;
    });
  const resourceTokenIndex = { items: (resourceIndex?.items || []).map((item) => ({ token: item.token, category: "资源", name: item.name })) };
  const assetTaskHint = !assets.length
    ? `先新增${assetCategoryByTab(tab)}资产，再补视觉锁定和连续性规则。`
    : onlyIncomplete
      ? `当前正在看待补资产，优先把视觉锁定、连续性规则和提示词补完整。`
      : `当前 ${assetCategoryByTab(tab)}资产共 ${assets.length} 个，先锁定定稿，再决定送去生图还是视频节点。`;

  async function copyAsset(asset) {
    await copyTextWithFeedback({
      text: asset.prompt || "",
      setMessage,
      successMessage: `已复制：${asset.name}`,
    });
  }

  async function copyAssetCard(asset) {
    const missingFields = assetIndex?.byToken?.get(asset.token)?.missingFields || [];
    const payload = [
      `名称：${asset.name || ""}`,
      `类型：${asset.kind || assetCategoryByTab(tab)}`,
      `引用：${asset.token || ""}`,
      asset.meta ? `备注：${asset.meta}` : "",
      asset.visualLock ? `视觉锁定：${asset.visualLock}` : "",
      asset.continuityRule ? `连续性规则：${asset.continuityRule}` : "",
      asset.referenceResources ? `参考资源：${asset.referenceResources}` : "",
      asset.prompt ? `提示词：${asset.prompt}` : "",
      missingFields.length ? `待补字段：${missingFields.join("、")}` : "",
    ].filter(Boolean).join("\n");
    await copyTextWithFeedback({
      text: payload,
      setMessage,
      successMessage: `已复制资产卡：${asset.name}`,
    });
  }

  async function copyAssetToken(asset) {
    await copyTextWithFeedback({
      text: asset.token || makeAssetToken(assetCategoryByTab(tab), asset.name),
      setMessage,
      successMessage: `已复制引用：${asset.name}`,
    });
  }

  function updateAsset(index, patch) {
    const key = tab;
    const next = assets.map((asset, assetIndex) => (assetIndex === index ? normalizeAsset({ ...asset, ...patch }, assetCategoryByTab(tab), node.id) : asset));
    updateNode(node.id, { [key]: next }, { skipHistory: true });
  }

  function addAsset() {
    const key = tab;
    const category = assetCategoryByTab(tab);
    const name = `新${category}${assets.length + 1}`;
    const next = [
      ...assets,
      normalizeAsset({
        name,
        kind: category,
        token: makeAssetToken(category, name),
        prompt: "",
        meta: "",
        images: [],
      }, category, node.id),
    ];
    updateNode(node.id, { [key]: next });
    setMessage(`已新增${category}资产`);
  }

  function duplicateAsset(index) {
    const current = assets[index];
    if (!current) return;
    const category = assetCategoryByTab(tab);
    const cloneName = `${current.name || `新${category}`} 副本`;
    const clone = normalizeAsset({
      ...current,
      name: cloneName,
      token: makeAssetToken(category, cloneName),
      images: [...(current.images || [])],
    }, category, node.id);
    updateNode(node.id, { [tab]: [...assets, clone] });
    setMessage(`已复制资产：${current.name}`);
  }

  function deleteAsset(index) {
    const key = tab;
    const next = assets.filter((_, assetIndex) => assetIndex !== index);
    updateNode(node.id, { [key]: next });
    setMessage("已删除资产");
  }

  async function attachAssetImage(index, imageUrl, context = {}) {
    const current = assets[index];
    if (!current) return;
    try {
      const persisted = await persistImportedImage({
        imageUrl,
        imagePath: context.imagePath || "",
        fileName: context.fileName || `${current.name || "asset-image"}-${index + 1}`,
      });
      const currentItem = current.imageUrl ? [{
        imageUrl: current.imageUrl,
        imagePath: current.imagePath || "",
        originalImageUrl: current.originalImageUrl || "",
        thumbnailUrl: current.imageThumbnailUrl || "",
        thumbnailPath: current.imageThumbnailPath || "",
      }] : [];
      const imageItems = [...(current.imageItems || []), ...currentItem, {
        imageUrl: persisted.imageUrl,
        imagePath: persisted.imagePath,
        originalImageUrl: persisted.originalImageUrl,
        thumbnailUrl: persisted.imageThumbnailUrl,
        thumbnailPath: persisted.imageThumbnailPath,
      }];
      updateAsset(index, {
        imageUrl: persisted.imageUrl,
        imagePath: persisted.imagePath,
        originalImageUrl: persisted.originalImageUrl,
        imageThumbnailUrl: persisted.imageThumbnailUrl,
        imageThumbnailPath: persisted.imageThumbnailPath,
        imageItems,
        images: addUniqueImage((imageItems || []).map((item) => item.imageUrl).filter(Boolean)),
      });
      setMessage(`已添加图片：${current.name}`);
    } catch (error) {
      setMessage(error.message || "添加图片失败");
    }
  }

  function setPrimaryAssetImage(index, imageUrl) {
    const current = assets[index];
    if (!current || !imageUrl) return;
    const selected = (current.imageItems || []).find((item) => item?.imageUrl === imageUrl) || null;
    const remainingItems = (current.imageItems || []).filter((item) => item?.imageUrl && item.imageUrl !== imageUrl);
    const nextItems = selected ? [selected, ...remainingItems] : [...remainingItems];
    updateAsset(index, {
      imageUrl,
      imagePath: selected?.imagePath || "",
      originalImageUrl: selected?.originalImageUrl || "",
      imageThumbnailUrl: selected?.thumbnailUrl || "",
      imageThumbnailPath: selected?.thumbnailPath || "",
      imageItems: nextItems,
      images: addUniqueImage(nextItems.map((item) => item?.imageUrl).filter(Boolean)),
    });
    setMessage(`已设为主图：${current.name}`);
  }

  function rejectAssetImage(index, imageUrl) {
    const current = assets[index];
    if (!current || !imageUrl) return;
    const rejectedItem = (current.imageItems || []).find((item) => item?.imageUrl === imageUrl) || null;
    const remainingItems = (current.imageItems || []).filter((item) => item?.imageUrl && item.imageUrl !== imageUrl);
    const nextPrimary = current.imageUrl === imageUrl ? (remainingItems[0] || null) : (current.imageItems || []).find((item) => item?.imageUrl === current.imageUrl) || null;
    updateAsset(index, {
      imageUrl: nextPrimary?.imageUrl || "",
      imagePath: nextPrimary?.imagePath || "",
      originalImageUrl: nextPrimary?.originalImageUrl || "",
      imageThumbnailUrl: nextPrimary?.thumbnailUrl || "",
      imageThumbnailPath: nextPrimary?.thumbnailPath || "",
      imageItems: remainingItems,
      images: addUniqueImage(remainingItems.map((item) => item?.imageUrl).filter(Boolean)),
      rejectedImageItems: rejectedItem ? [...(current.rejectedImageItems || []), rejectedItem] : (current.rejectedImageItems || []),
      rejectedImages: addUniqueImage([...(current.rejectedImages || [])], imageUrl),
    });
    setMessage(`已移入废弃图：${current.name}`);
  }

  function restoreRejectedAssetImage(index, imageUrl) {
    const current = assets[index];
    if (!current || !imageUrl) return;
    const restoredItem = (current.rejectedImageItems || []).find((item) => item?.imageUrl === imageUrl) || {
      imageUrl,
      imagePath: "",
      originalImageUrl: "",
      thumbnailUrl: "",
      thumbnailPath: "",
    };
    const imageItems = [...(current.imageItems || []), ...(current.imageUrl ? [{
      imageUrl: current.imageUrl,
      imagePath: current.imagePath || "",
      originalImageUrl: current.originalImageUrl || "",
      thumbnailUrl: current.imageThumbnailUrl || "",
      thumbnailPath: current.imageThumbnailPath || "",
    }] : []), restoredItem];
    updateAsset(index, {
      imageUrl: current.imageUrl || imageUrl,
      imagePath: current.imagePath || restoredItem.imagePath || "",
      originalImageUrl: current.originalImageUrl || restoredItem.originalImageUrl || "",
      imageThumbnailUrl: current.imageThumbnailUrl || restoredItem.thumbnailUrl || "",
      imageThumbnailPath: current.imageThumbnailPath || restoredItem.thumbnailPath || "",
      imageItems,
      images: addUniqueImage(imageItems.map((item) => item?.imageUrl).filter(Boolean)),
      rejectedImageItems: (current.rejectedImageItems || []).filter((item) => item?.imageUrl && item.imageUrl !== imageUrl),
      rejectedImages: (current.rejectedImages || []).filter((item) => item && item !== imageUrl),
    });
    setMessage(`已恢复图片：${current.name}`);
  }

  function toggleAssetApproved(index) {
    const current = assets[index];
    if (!current) return;
    updateAsset(index, { approved: !current.approved });
    setMessage(current.approved ? `已取消定稿锁定：${current.name}` : `已锁定当前定稿：${current.name}`);
  }

  function sendAssetPrompt(asset, mode) {
    const result = onCreatePromptNode?.(node.id, asset, mode);
    if (!result) {
      setMessage("没有可用的目标节点");
      return;
    }
    setMessage(describePromptNodeResult(result, mode));
  }

  function quickGenerateAsset(asset, mode) {
    const result = onCreatePromptNode?.(node.id, asset, mode, { autoStart: true });
    if (!result) {
      setMessage("没有可用的目标节点");
      return;
    }
    setMessage(describePromptNodeResult(result, `${mode}-run`));
  }

  return (
    <>
      <NodeHeader icon="lib" title={node.data.displayName || "资产库"} />
      <section className="panel-action-strip node-action-strip">
        <div className="panel-action-strip-copy">
          <strong>当前任务</strong>
          <span>{assetCategoryByTab(tab)}资产 {assets.length} 个 · 当前筛选 {filteredAssets.length} 个</span>
          <p>{assetTaskHint}</p>
        </div>
        <div className="panel-action-strip-actions">
          <button className="primary" onClick={addAsset}>新增{assetCategoryByTab(tab)}</button>
          <button onClick={() => setOnlyIncomplete((value) => !value)}>{onlyIncomplete ? "显示全部" : "只看待补"}</button>
          <button disabled={!filteredAssets.length} onClick={() => filteredAssets[0] && copyAssetCard(filteredAssets[0].asset)}>复制当前资产卡</button>
          <button disabled={!filteredAssets.length} onClick={() => filteredAssets[0] && quickGenerateAsset(filteredAssets[0].asset, "image-api")}>一键生成首个资产</button>
        </div>
      </section>
      <div className="asset-tabs">
        <button className={tab === "characters" ? "active" : ""} onClick={() => setTab("characters")}>人物资产 {characters.length}</button>
        <button className={tab === "scenes" ? "active" : ""} onClick={() => setTab("scenes")}>场景资产 {scenes.length}</button>
        <button className={tab === "props" ? "active" : ""} onClick={() => setTab("props")}>道具资产 {props.length}</button>
      </div>
      <div className="asset-insert-row">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称、引用、提示词" />
        <button className={onlyIncomplete ? "active" : ""} onClick={() => setOnlyIncomplete((value) => !value)}>{onlyIncomplete ? "显示全部" : "只看待补"}</button>
        <button onClick={addAsset}>新增{assetCategoryByTab(tab)}</button>
      </div>
      <div className="asset-list">
        {filteredAssets.length ? filteredAssets.map(({ asset, index }) => (
          <section key={`${tab}-${asset.name}-${index}`} className="asset-item">
            <header>
              <input value={asset.name || ""} onChange={(event) => updateAsset(index, { name: event.target.value, token: makeAssetToken(assetCategoryByTab(tab), event.target.value) })} />
              <input value={asset.kind || assetCategoryByTab(tab)} onChange={(event) => updateAsset(index, { kind: event.target.value })} />
              <button onClick={() => copyAssetToken(asset)}>引用</button>
              <button onClick={() => copyAsset(asset)}>复制</button>
              <button onClick={() => copyAssetCard(asset)}>卡片</button>
              <button className="primary" onClick={() => quickGenerateAsset(asset, "image-api")}>一键API</button>
              <button onClick={() => quickGenerateAsset(asset, "image-comfy")}>一键Comfy</button>
              <button onClick={() => quickGenerateAsset(asset, "image-gemini")}>一键Gemini</button>
              <button onClick={() => sendAssetPrompt(asset, "video")}>视频节点</button>
              <button onClick={() => duplicateAsset(index)}>副本</button>
              <button className="danger" onClick={() => deleteAsset(index)}>删除</button>
            </header>
            <div className="asset-consistency-bar">
              <span>引用 {assetIndex?.byToken?.get(asset.token)?.referenceCount || 0}</span>
              <span>{(assetIndex?.byToken?.get(asset.token)?.references || []).filter((item) => item.nodeType === "shotList").length} 个镜头节点命中</span>
              <span className={asset.approved ? "good" : "bad"}>{asset.approved ? "已锁定定稿" : "未锁定定稿"}</span>
              <span className={(assetIndex?.byToken?.get(asset.token)?.missingFields || []).length ? "bad" : "good"}>
                {(assetIndex?.byToken?.get(asset.token)?.missingFields || []).length ? `待补 ${(assetIndex?.byToken?.get(asset.token)?.missingFields || []).length} 项` : "锁定完整"}
              </span>
            </div>
            {!!(assetIndex?.byToken?.get(asset.token)?.missingFields || []).length && (
              <div className="asset-missing-fields">
                {(assetIndex?.byToken?.get(asset.token)?.missingFields || []).map((field) => <span key={`${asset.token}-${field}`}>{field}</span>)}
              </div>
            )}
            <input value={asset.token || ""} onChange={(event) => updateAsset(index, { token: event.target.value })} placeholder="@资产_名称" />
            <textarea value={asset.prompt || ""} onChange={(event) => updateAsset(index, { prompt: event.target.value })} placeholder="资产提示词" />
            <details className="node-advanced">
              <summary>高级设置</summary>
              <div className="node-advanced__body">
                <textarea className="small-textarea" value={asset.meta || ""} onChange={(event) => updateAsset(index, { meta: event.target.value })} placeholder="备注/检索信息" />
                <textarea className="small-textarea" value={asset.visualLock || ""} onChange={(event) => updateAsset(index, { visualLock: event.target.value })} placeholder="视觉锁定：外形、服装、材质、主色、身份锚点" />
                <textarea className="small-textarea" value={asset.continuityRule || ""} onChange={(event) => updateAsset(index, { continuityRule: event.target.value })} placeholder="连续性规则：允许变化、禁止漂移、阶段变化方式" />
                <label>定稿策略
                  <div className="asset-finalize-row">
                    <button className={asset.approved ? "active" : ""} onClick={() => toggleAssetApproved(index)}>{asset.approved ? "已锁定当前定稿" : "锁定当前定稿"}</button>
                    <select value={asset.preferredVariant || ""} onChange={(event) => updateAsset(index, { preferredVariant: event.target.value })}>
                      <option value="">自动选择提示词版本</option>
                      <option value="nanoBanana">NanoBanana / Gemini</option>
                      <option value="openSource">开源模型 / Comfy</option>
                      <option value="midjourney">Midjourney</option>
                    </select>
                  </div>
                </label>
                <label>参考资源<AssetTokenInsertRow assetIndex={resourceTokenIndex} onInsert={(token) => updateAsset(index, { referenceResources: appendToken(asset.referenceResources || "", token) })} /><input value={asset.referenceResources || ""} onChange={(event) => updateAsset(index, { referenceResources: event.target.value })} placeholder="@资源_角色定妆 @资源_场景参考" /></label>
                {!!(assetIndex?.byToken?.get(asset.token)?.references || []).length && (
                  <div className="asset-reference-hits">
                    {(assetIndex.byToken.get(asset.token).references || []).slice(0, 4).map((reference, refIndex) => (
                      <span key={`${asset.token}-${reference.nodeId}-${refIndex}`}>{reference.nodeTitle} · {reference.path}</span>
                    ))}
                    {(assetIndex.byToken.get(asset.token).references || []).length > 4 && <span>还有 {(assetIndex.byToken.get(asset.token).references || []).length - 4} 处引用</span>}
                  </div>
                )}
                <div className="asset-image-panel">
                  {asset.imageUrl ? (
                    <div className="asset-image-main">
                      <img src={asset.imageThumbnailUrl || asset.imageUrl} alt="" />
                      <div className="asset-image-main__toolbar">
                        <span>当前定稿</span>
                        <button onClick={() => rejectAssetImage(index, asset.imageUrl)}>移入废弃</button>
                      </div>
                    </div>
                  ) : (
                    <div className="asset-image-main asset-image-main--empty">暂无主图</div>
                  )}
                  <div className="asset-image-strip">
                    {(asset.imageItems || []).filter((item) => item?.imageUrl).map((image, imageIndex) => (
                      <div key={`${image.imageUrl.slice(0, 40)}-${imageIndex}`} className={`asset-thumb ${image.imageUrl === asset.imageUrl ? "active" : ""}`}>
                        <img src={image.thumbnailUrl || image.imageUrl} alt="" />
                        <div className="asset-thumb__actions">
                          {image.imageUrl !== asset.imageUrl && <button onClick={() => setPrimaryAssetImage(index, image.imageUrl)}>设主图</button>}
                          <button onClick={() => rejectAssetImage(index, image.imageUrl)}>废弃</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {!!(asset.rejectedImageItems || []).length && (
                    <div className="asset-rejected-strip">
                      <span>废弃图 {(asset.rejectedImageItems || []).length}</span>
                      {(asset.rejectedImageItems || []).map((image, imageIndex) => (
                        <div key={`${image.imageUrl.slice(0, 40)}-rejected-${imageIndex}`} className="asset-thumb rejected">
                          <img src={image.thumbnailUrl || image.imageUrl} alt="" />
                          <div className="asset-thumb__actions">
                            <button onClick={() => restoreRejectedAssetImage(index, image.imageUrl)}>恢复</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <label className="gemini-upload-button">添加图片<input hidden type="file" accept="image/*" onChange={(event) => readImage(event, (imageUrl, context) => attachAssetImage(index, imageUrl, context), 2048)} /></label>
                </div>
              </div>
            </details>
          </section>
        )) : <div className="asset-empty">暂无资产。可从“小说转剧本”节点输出人物、场景和道具资产。</div>}
      </div>
      {message && <small className="result-message">{message}</small>}
    </>
  );
}

export function DirectorNode({ node, updateNode, createOutputNear, helpers }) {
  const {
    NodeHeader,
    DEFAULT_MANNEQUINS,
    POSE_PRESETS,
    normalizeMannequins,
    normalizeDirectorCamera,
    normalizeMannequin,
    makeDirectorImage,
    makeDirectorDepthImage,
    makeDirectorPoseImage,
    projectDirectorPoint,
    positiveModulo,
    clamp,
  } = helpers;
  const mannequins = normalizeMannequins(node.data.mannequins || DEFAULT_MANNEQUINS);
  const camera = normalizeDirectorCamera(node.data.camera);
  const selectedId = node.data.selectedMannequinId || mannequins[0]?.id || 1;
  const selectedMan = mannequins.find((man) => man.id === selectedId) || mannequins[0];
  const [fullscreen, setFullscreen] = useState(false);

  function patchDirector(patch, options = {}) {
    updateNode(node.id, patch, options);
  }

  function patchMannequin(id, patch, options = {}) {
    patchDirector({
      mannequins: mannequins.map((man) => (man.id === id ? normalizeMannequin({ ...man, ...patch }) : man)),
      selectedMannequinId: id,
    }, options);
  }

  function setPose(pose) {
    if (!selectedMan) return;
    patchMannequin(selectedMan.id, { pose, ...POSE_PRESETS[pose] });
  }

  function addStanding() {
    const nextId = Math.max(0, ...mannequins.map((item) => item.id)) + 1;
    const colors = ["#e53935", "#20c060", "#1da1f2", "#f0b429", "#ff5aa5"];
    patchDirector({
      mannequins: [...mannequins, normalizeMannequin({ id: nextId, color: colors[(nextId - 1) % colors.length], x: -3 + nextId * 1.2, z: 0 })],
      selectedMannequinId: nextId,
    });
  }

  function duplicateSelected() {
    if (!selectedMan) return;
    const nextId = Math.max(0, ...mannequins.map((item) => item.id)) + 1;
    patchDirector({
      mannequins: [...mannequins, normalizeMannequin({
        ...selectedMan,
        id: nextId,
        x: (selectedMan.x || 0) + 0.8,
        z: selectedMan.z || 0,
      })],
      selectedMannequinId: nextId,
    });
  }

  function resetSelectedPose() {
    if (!selectedMan) return;
    patchMannequin(selectedMan.id, { pose: "stand", ...POSE_PRESETS.stand });
  }

  function applyStagePreset(mode) {
    if (mode === "duet") {
      patchDirector({
        camera: { yaw: 0, pitch: 12, zoom: 1 },
        mannequins: [
          normalizeMannequin({ id: 1, color: "#e53935", x: -1.2, z: 0, pose: "stand", ...POSE_PRESETS.stand }),
          normalizeMannequin({ id: 2, color: "#20c060", x: 1.2, z: 0, pose: "stand", ...POSE_PRESETS.stand }),
        ],
        selectedMannequinId: 1,
      });
      return;
    }
    if (mode === "triangle") {
      patchDirector({
        camera: { yaw: 18, pitch: 16, zoom: 1 },
        mannequins: [
          normalizeMannequin({ id: 1, color: "#e53935", x: 0, z: 1.4, pose: "stand", ...POSE_PRESETS.stand }),
          normalizeMannequin({ id: 2, color: "#20c060", x: -1.6, z: -0.8, pose: "stand", ...POSE_PRESETS.stand }),
          normalizeMannequin({ id: 3, color: "#1da1f2", x: 1.6, z: -0.8, pose: "stand", ...POSE_PRESETS.stand }),
        ],
        selectedMannequinId: 1,
      });
      return;
    }
    if (mode === "confront") {
      patchDirector({
        camera: { yaw: 0, pitch: 10, zoom: 1.08 },
        mannequins: [
          normalizeMannequin({ id: 1, color: "#e53935", x: -1.4, z: 0, turn: 18, pose: "stand", ...POSE_PRESETS.stand }),
          normalizeMannequin({ id: 2, color: "#20c060", x: 1.4, z: 0, turn: -18, pose: "stand", ...POSE_PRESETS.stand }),
        ],
        selectedMannequinId: 1,
      });
    }
  }

  return (
    <>
      <NodeHeader icon="🎬" title="3D导演台" />
      <DirectorCanvas mannequins={mannequins} camera={camera} selectedId={selectedId} onCameraChange={(nextCamera) => patchDirector({ camera: nextCamera }, { skipHistory: true })} onSelect={(id) => patchDirector({ selectedMannequinId: id })} helpers={{ projectDirectorPoint, positiveModulo, clamp }} />
      <div className="storyboard-presets director-interactive">
        <button onClick={() => applyStagePreset("duet")}>双人对话</button>
        <button onClick={() => applyStagePreset("triangle")}>三人三角</button>
        <button onClick={() => applyStagePreset("confront")}>双人对峙</button>
      </div>
      <div className="director-export-actions director-interactive">
        <button onClick={() => createOutputNear(node.id, "result", "3D当前视角", { imageUrl: makeDirectorImage(mannequins, camera), note: "3D导演台 · 当前视角" })}>导出当前视角</button>
        <button onClick={() => createOutputNear(node.id, "result", "3D深度图", { imageUrl: makeDirectorDepthImage(mannequins, camera), note: "3D导演台 · 深度图" })}>导出深度图</button>
        <button onClick={() => createOutputNear(node.id, "result", "3D姿态图", { imageUrl: makeDirectorPoseImage(mannequins, camera), note: "3D导演台 · 姿态骨架图" })}>导出姿态图</button>
      </div>
      <div className="director-camera director-interactive">
        <span>视角</span>
        <button onClick={() => patchDirector({ camera: { yaw: 0, pitch: 12, zoom: 1 } })}>正面</button>
        <button onClick={() => patchDirector({ camera: { yaw: 90, pitch: 12, zoom: 1 } })}>侧面</button>
        <button onClick={() => patchDirector({ camera: { yaw: 180, pitch: 12, zoom: 1 } })}>背面</button>
        <label>俯仰<input type="range" min="-8" max="36" value={camera.pitch} onChange={(event) => patchDirector({ camera: { ...camera, pitch: Number(event.target.value) } }, { skipHistory: true })} /></label>
      </div>
      <div className="mannequin-row">
        {mannequins.map((man) => (
          <button key={man.id} className={man.id === selectedId ? "active" : ""} onClick={() => patchDirector({ selectedMannequinId: man.id })}>
            <i style={{ background: man.color }} />#{man.id} {POSE_PRESETS[man.pose]?.label || "站立"}
          </button>
        ))}
        <button onClick={addStanding}>+ 添加站立</button>
        <button disabled={!selectedMan} onClick={duplicateSelected}>复制当前</button>
        <button className="danger" onClick={() => patchDirector({ mannequins: [], selectedMannequinId: 0 })}>清空</button>
      </div>
      {selectedMan && (
        <div className="pose-panel director-interactive">
          <div className="pose-presets">
            {Object.entries(POSE_PRESETS).map(([key, preset]) => (
              <button key={key} className={selectedMan.pose === key ? "active" : ""} onClick={() => setPose(key)}>{preset.label}</button>
            ))}
            <button onClick={resetSelectedPose}>重置姿态</button>
          </div>
          <div className="pose-sliders">
            <label>X<input type="range" min="-5" max="5" step="0.1" value={selectedMan.x} onChange={(event) => patchMannequin(selectedMan.id, { x: Number(event.target.value) }, { skipHistory: true })} /></label>
            <label>Z<input type="range" min="-4" max="4" step="0.1" value={selectedMan.z} onChange={(event) => patchMannequin(selectedMan.id, { z: Number(event.target.value) }, { skipHistory: true })} /></label>
            <label>朝向<input type="range" min="-180" max="180" value={selectedMan.turn} onChange={(event) => patchMannequin(selectedMan.id, { turn: Number(event.target.value) }, { skipHistory: true })} /></label>
            <label>左臂<input type="range" min="-100" max="100" value={selectedMan.leftArm} onChange={(event) => patchMannequin(selectedMan.id, { leftArm: Number(event.target.value) }, { skipHistory: true })} /></label>
            <label>右臂<input type="range" min="-100" max="100" value={selectedMan.rightArm} onChange={(event) => patchMannequin(selectedMan.id, { rightArm: Number(event.target.value) }, { skipHistory: true })} /></label>
            <label>左腿<input type="range" min="-85" max="85" value={selectedMan.leftLeg} onChange={(event) => patchMannequin(selectedMan.id, { leftLeg: Number(event.target.value) }, { skipHistory: true })} /></label>
            <label>右腿<input type="range" min="-85" max="85" value={selectedMan.rightLeg} onChange={(event) => patchMannequin(selectedMan.id, { rightLeg: Number(event.target.value) }, { skipHistory: true })} /></label>
            <label>身体<input type="range" min="-24" max="24" value={selectedMan.bodyLean} onChange={(event) => patchMannequin(selectedMan.id, { bodyLean: Number(event.target.value) }, { skipHistory: true })} /></label>
          </div>
        </div>
      )}
      <button className="wide-primary" onClick={() => setFullscreen(true)}>全屏操控</button>
      <label className="dash-upload">上传360 全景背景图<input hidden type="file" accept="image/*" /></label>
      {fullscreen && (
        <FullscreenDirector mannequins={mannequins} camera={camera} selectedId={selectedId} onCameraChange={(nextCamera) => patchDirector({ camera: nextCamera }, { skipHistory: true })} onSelect={(id) => patchDirector({ selectedMannequinId: id })} onClose={() => setFullscreen(false)} helpers={{ projectDirectorPoint, positiveModulo, clamp }} />
      )}
    </>
  );
}

function DirectorCanvas({ mannequins, camera, selectedId, onCameraChange, onSelect, large = false, helpers }) {
  const { projectDirectorPoint, positiveModulo, clamp } = helpers;
  const dragRef = useRef(null);
  const sorted = [...mannequins].sort((a, b) => projectDirectorPoint(a, camera).depth - projectDirectorPoint(b, camera).depth);

  function startDrag(event) {
    event.stopPropagation();
    dragRef.current = { x: event.clientX, y: event.clientY, camera };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event) {
    if (!dragRef.current) return;
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    onCameraChange({
      ...dragRef.current.camera,
      yaw: positiveModulo(dragRef.current.camera.yaw + dx * 0.35, 360),
      pitch: clamp(dragRef.current.camera.pitch - dy * 0.12, -8, 36),
    });
  }

  function endDrag() {
    dragRef.current = null;
  }

  return (
    <div className={`director-stage director-interactive ${large ? "large" : ""}`} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerLeave={endDrag}>
      <div className="horizon" />
      <div className="director-grid" style={{ transform: `translate(-50%, -34%) rotateX(${64 - camera.pitch}deg) rotateZ(${-camera.yaw}deg) scale(${camera.zoom})` }} />
      <div className="director-hud">拖拽切换角度 · 点击人物选择</div>
      {sorted.map((man) => {
        const projected = projectDirectorPoint(man, camera);
        return (
          <button
            key={man.id}
            className={`person ${man.id === selectedId ? "active" : ""}`}
            style={{
              "--c": man.color,
              "--s": projected.scale,
              "--turn": `${(man.turn || 0) - camera.yaw}deg`,
              "--lean": `${man.bodyLean}deg`,
              "--la": `${man.leftArm}deg`,
              "--ra": `${man.rightArm}deg`,
              "--ll": `${man.leftLeg}deg`,
              "--rl": `${man.rightLeg}deg`,
              left: `${projected.left}%`,
              top: `${projected.top}%`,
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              onSelect(man.id);
            }}
          >
            <span className="head" />
            <b className="body" />
            <i className="arm arm-left" />
            <i className="arm arm-right" />
            <i className="leg leg-left" />
            <i className="leg leg-right" />
            <em>#{man.id}</em>
          </button>
        );
      })}
    </div>
  );
}

function FullscreenDirector({ mannequins, camera, selectedId, onCameraChange, onSelect, onClose, helpers }) {
  useEffect(() => {
    function keydown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [onClose]);

  return createPortal((
    <div className="director-fullscreen">
      <DirectorCanvas mannequins={mannequins} camera={camera} selectedId={selectedId} onCameraChange={onCameraChange} onSelect={onSelect} large helpers={helpers} />
      <div className="vr-fullscreen-top">
        <strong>3D导演台</strong>
        <span>拖拽切换角度 · Esc退出</span>
      </div>
      <button className="vr-fullscreen-close" onClick={onClose}>关闭</button>
    </div>
  ), document.body);
}
