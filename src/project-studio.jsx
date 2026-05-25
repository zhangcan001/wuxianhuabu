import React, { useEffect, useMemo, useState } from "react";
import { convertFileSrc } from "./app/tauri-runtime-bridge.js";
import {
  resolveStudioActions,
} from "./app/studio-action-adapter.js";
import {
  ProjectShell,
} from "./product/studio/project-shell.jsx";
import {
  resolvePrimaryStudioAction,
} from "./product/studio/primary-action.js";
import {
  pickMediaFile,
} from "./tauri-bridge-helpers.js";

function clampCount(value) {
  return Math.max(0, Number(value || 0));
}

export function ProjectStudio({
  actions,
  businessModel,
  productionDashboard,
  exportHistory = [],
  consistencyReport = null,
  migrationReport = null,
  deliveryManifestReport = null,
  multiEpisodeDeliverySummary = null,
  mediaCacheReport = null,
  desktopUploadChecklist = null,
  providerHealthReport = null,
  queueOperationsBoard = null,
  enhancedDeliveryGate = null,
  productionTaskStore = null,
  resourceIndex = null,
  queue = [],
  queueRunning = false,
  projectMessage = "",
  activeViewRequest = null,
  onGenerateText,
  onGenerateImages,
  onGenerateVideos,
  onOpenAdvancedCanvas,
  onOpenDashboard,
  onOpenQueue,
  onOpenSettings,
  onOpenPromptFactory,
  onOpenTimeline,
  onOpenExport,
  onUploadShotImage,
  onUploadShotVideo,
  onSaveProject,
  onOpenProject,
  episodes = [],
  activeEpisodeId = "",
  onEpisodeChange,
  onCreateEpisode,
  workspaces = [],
  activeWorkspaceId = "",
  onWorkspaceChange,
  queueCounts = null,
  onSmartContinue,
  smartContinueHint = "",
  autoSaveState = "",
}) {
  const studioActions = useMemo(() => resolveStudioActions({
    actions,
    onGenerateText,
    onGenerateImages,
    onGenerateVideos,
    onOpenAdvancedCanvas,
    onOpenDashboard,
    onOpenQueue,
    onOpenSettings,
    onOpenPromptFactory,
    onOpenTimeline,
    onOpenExport,
    onUploadShotImage,
    onUploadShotVideo,
    onSaveProject,
    onOpenProject,
  }), [
    actions,
    onGenerateText,
    onGenerateImages,
    onGenerateVideos,
    onOpenAdvancedCanvas,
    onOpenDashboard,
    onOpenQueue,
    onOpenSettings,
    onOpenPromptFactory,
    onOpenTimeline,
    onOpenExport,
    onUploadShotImage,
    onUploadShotVideo,
    onSaveProject,
    onOpenProject,
  ]);
  const businessEpisode = businessModel?.activeEpisode || null;
  const active = businessEpisode || {};
  const businessStatus = businessEpisode?.status || {};
  const assetCounts = businessEpisode?.assetCounts || {
    characters: active.characters || 0,
    scenes: active.scenes || 0,
    props: active.props || 0,
  };
  const [sourceText, setSourceText] = useState("");
  const [runningAction, setRunningAction] = useState("");
  const [localMessage, setLocalMessage] = useState("");
  const [uploadReceipt, setUploadReceipt] = useState(null);
  useEffect(() => {
    if (!uploadReceipt?.previewObjectUrl || !uploadReceipt.previewUrl) return undefined;
    return () => URL.revokeObjectURL(uploadReceipt.previewUrl);
  }, [uploadReceipt]);
  useEffect(() => {
    if (!sourceText.trim() && businessEpisode?.sourceText) {
      setSourceText(businessEpisode.sourceText);
    }
  }, [businessEpisode?.sourceText, sourceText]);
  const shotCount = clampCount(businessStatus.shotCount || active.shots);
  const promptReady = clampCount(businessStatus.promptReady || active.promptReady);
  const imagesReady = clampCount(businessStatus.imagesReady || active.imagesReady);
  const videosReady = clampCount(businessStatus.videosReady || active.videosReady);
  const timelineClips = clampCount(businessStatus.timelineClips || active.timelineClips);
  const timelineReady = clampCount(businessStatus.timelineReady || active.timelineReady);
  const textReady = Boolean(businessStatus.textReady ?? (active.scripts && active.characters && active.scenes && shotCount && promptReady >= shotCount));
  const imageReady = Boolean(businessStatus.imageReady ?? (shotCount > 0 && imagesReady >= shotCount));
  const videoReady = Boolean(businessStatus.videoReady ?? (shotCount > 0 && videosReady >= shotCount));
  const exportReady = Boolean(businessStatus.exportReady ?? active.exportReady);
  const assetCount = businessEpisode?.assets?.length ?? (assetCounts.characters + assetCounts.scenes + assetCounts.props);
  const running = Boolean(runningAction) || queueRunning;
  const queueStats = useMemo(() => {
    const taskSummary = productionTaskStore?.summary || null;
    if (taskSummary) {
      return {
        pending: taskSummary.pending || 0,
        running: taskSummary.running || 0,
        failed: taskSummary.failed || 0,
        recent: queue.slice(-4).reverse(),
        source: "taskStore",
      };
    }
    return {
      pending: queue.filter((job) => job.status === "pending").length,
      running: queue.filter((job) => job.status === "running").length,
      failed: queue.filter((job) => job.status === "failed").length,
      recent: queue.slice(-4).reverse(),
      source: "legacyQueue",
    };
  }, [productionTaskStore, queue]);
  const stages = [
    {
      key: "text",
      title: "文本方案",
      detail: "从小说生成剧本、资产、镜头表、图片提示词和视频提示词。",
      stat: textReady ? `${shotCount} 个镜头已就绪` : `${promptReady}/${shotCount || 0} 条提示词`,
      done: textReady,
      active: !textReady,
      actionLabel: "生成文本方案",
      disabled: running || !sourceText.trim(),
      action: async () => studioActions.generateText?.(sourceText),
    },
    {
      key: "image",
      title: "图片生产",
      detail: "可用 API、ComfyUI 批量生成，也可本地上传首帧图并回填镜头。",
      stat: `${imagesReady}/${shotCount || 0} 张图片`,
      done: imageReady,
      active: textReady && !imageReady,
      actionLabel: "生成全部图片",
      disabled: running || !textReady,
      action: studioActions.generateImages,
    },
    {
      key: "video",
      title: "视频生产",
      detail: "可用 API、ComfyUI 生成镜头片段，也可上传本地视频进入时间线。",
      stat: `${videosReady}/${shotCount || 0} 条视频`,
      done: videoReady,
      active: imageReady && !videoReady,
      actionLabel: "生成全部视频",
      disabled: running || !textReady,
      action: studioActions.generateVideos,
    },
    {
      key: "export",
      title: "成片交付",
      detail: "检查时间线素材后导出 MP4 或交付包。",
      stat: exportReady ? "已达到导出门槛" : `${timelineReady}/${timelineClips} 条时间线素材`,
      done: exportReady,
      active: videoReady && !exportReady,
      actionLabel: "打开导出",
      disabled: running || !videoReady,
      action: studioActions.openExport,
    },
  ];
  const legacyProgress = Math.round((stages.filter((stage) => stage.done).length / stages.length) * 100);
  const progress = Number.isFinite(productionDashboard?.progressPercent)
    ? productionDashboard.progressPercent
    : legacyProgress;
  const costSummary = productionDashboard?.costs || null;
  const estimatedCost = costSummary?.totals?.estimatedTotalCost ?? 0;
  const costCurrency = costSummary?.currency || "CREDITS";
  const auditEventCount = productionDashboard?.audit?.totalEvents ?? 0;
  const episodeShots = Array.isArray(businessEpisode?.shots) ? businessEpisode.shots : [];
  const episodeAssets = Array.isArray(businessEpisode?.assets) ? businessEpisode.assets : [];
  const episodeTimeline = businessEpisode?.timeline || { clips: [] };
  const nextStage = stages.find((stage) => !stage.done) || stages[stages.length - 1];
  const productionStageLabel = productionStageTitle(productionDashboard?.currentStage);
  const heroTitle = productionStageLabel || nextStage?.title || "准备生产";
  const heroDetail = productionDashboard?.blockers?.length
    ? `当前阻塞：${productionDashboard.blockers.map(blockerLabel).join("、")}`
    : nextStage?.detail || "按顺序完成文本、图片、视频和导出。";
  const primaryAction = resolvePrimaryStudioAction({
    sourceText,
    textReady,
    assetReady: productionDashboard?.riskReport?.items?.find((item) => item.key === "asset-consistency")?.ok ?? Boolean(assetCount),
    imageReady,
    videoReady,
    timelineReady: timelineReady > 0 && timelineReady >= timelineClips,
    reviewReady: Boolean(productionDashboard?.audit?.byType?.["production.review.completed"] || businessStatus.reviewPassed >= shotCount),
    exportReady,
    running,
  });

  async function runStage(stage) {
    if (!stage?.action || stage.disabled) return;
    setRunningAction(stage.key);
    setLocalMessage(`${stage.title}正在执行...`);
    try {
      const result = await stage.action();
      setLocalMessage(result?.summary || `${stage.title}已启动。`);
    } catch (error) {
      setLocalMessage(error.message || String(error));
    } finally {
      setRunningAction("");
    }
  }

  async function uploadShotImage(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !studioActions.uploadShotImage) return;
    if (running) return;
    setRunningAction("upload-image");
    setLocalMessage(`正在读取图片：${file.name}（${formatFileSize(file.size)}）...`);
    try {
      const imageUrl = await readImageForUpload(file);
      setLocalMessage(`图片已读取，正在写入项目：${file.name}...`);
      const result = await withUploadTimeout(studioActions.uploadShotImage(imageUrl, { fileName: file.name, file }));
      setLocalMessage(result?.summary || `上传成功：${file.name} 已回填到当前待生图镜头。`);
      setUploadReceipt({ kind: "image", title: "图片上传成功", detail: file.name, previewUrl: imageUrl });
    } catch (error) {
      setLocalMessage(`上传失败：${error.message || String(error)}`);
    } finally {
      setRunningAction("");
    }
  }

  async function uploadShotVideo(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !studioActions.uploadShotVideo) return;
    if (running) return;
    setRunningAction("upload-video");
    setLocalMessage(`正在准备视频：${file.name}（${formatFileSize(file.size)}）...`);
    try {
      const previewUrl = URL.createObjectURL(file);
      setLocalMessage(`视频已选择，正在写入项目：${file.name}...`);
      const result = await withUploadTimeout(studioActions.uploadShotVideo("", { fileName: file.name, file, previewUrl }));
      setLocalMessage(result?.summary || `上传成功：${file.name} 已回填到当前待生视频镜头。`);
      setUploadReceipt({ kind: "video", title: "视频上传成功", detail: file.name, previewUrl, previewObjectUrl: true });
    } catch (error) {
      setLocalMessage(`上传失败：${error.message || String(error)}`);
    } finally {
      setRunningAction("");
    }
  }

  async function pickDesktopShotVideo(shot = null) {
    if (!isTauriRuntime() || !studioActions.uploadShotVideo || running) return false;
    setRunningAction(shot?.id ? `shot-video-upload-${shot.id}` : "upload-video");
    setLocalMessage("正在选择本地视频文件...");
    try {
      const picked = await pickMediaFile({ mediaType: "video" });
      if (!picked?.path) {
        setLocalMessage("已取消选择视频。");
        return false;
      }
      const fileName = picked.fileName || picked.path.split(/[\\/]/).pop() || "local-video";
      const previewUrl = convertFileSrc(picked.path);
      setLocalMessage(`视频已选择，正在写入项目：${fileName}...`);
      const result = await withUploadTimeout(studioActions.uploadShotVideo("", {
        fileName,
        mediaPath: picked.path,
        previewUrl,
        file: { path: picked.path, name: fileName, size: picked.size || 0, type: "video/*" },
        shotId: shot?.id || "",
      }));
      setLocalMessage(result?.summary || `上传成功：${fileName} 已导入${shot?.id ? ` ${shot.id}` : "当前镜头"}。`);
      setUploadReceipt({ kind: "video", title: `${shot?.id || "镜头"} 视频上传成功`, detail: fileName, previewUrl });
      return true;
    } catch (error) {
      setLocalMessage(`上传失败：${error.message || String(error)}`);
      return false;
    } finally {
      setRunningAction("");
    }
  }

  async function pickDesktopShotImage(shot = null) {
    if (!isTauriRuntime() || !studioActions.uploadShotImage || running) return false;
    setRunningAction(shot?.id ? `shot-image-upload-${shot.id}` : "upload-image");
    setLocalMessage("正在选择本地图片文件...");
    try {
      const picked = await pickMediaFile({ mediaType: "image" });
      if (!picked?.path) {
        setLocalMessage("已取消选择图片。");
        return false;
      }
      const fileName = picked.fileName || picked.path.split(/[\\/]/).pop() || "local-image";
      const previewUrl = convertFileSrc(picked.path);
      setLocalMessage(`图片已选择，正在写入项目：${fileName}...`);
      const result = await withUploadTimeout(studioActions.uploadShotImage(picked.path, {
        fileName,
        mediaPath: picked.path,
        previewUrl,
        file: { path: picked.path, name: fileName, size: picked.size || 0, type: "image/*" },
        shotId: shot?.id || "",
      }));
      setLocalMessage(result?.summary || `上传成功：${fileName} 已导入${shot?.id ? ` ${shot.id}` : "当前镜头"}。`);
      setUploadReceipt({ kind: "image", title: `${shot?.id || "镜头"} 图片上传成功`, detail: fileName, previewUrl });
      return true;
    } catch (error) {
      setLocalMessage(`上传失败：${error.message || String(error)}`);
      return false;
    } finally {
      setRunningAction("");
    }
  }

  async function uploadSpecificShotImage(shot, event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !studioActions.uploadShotImage) return;
    if (running) return;
    setRunningAction(`shot-image-upload-${shot?.id || ""}`);
    setLocalMessage(`正在读取 ${shot?.id || "镜头"} 图片：${file.name}（${formatFileSize(file.size)}）...`);
    try {
      const imageUrl = await readImageForUpload(file);
      setLocalMessage(`图片已读取，正在写入 ${shot?.id || "镜头"}...`);
      const result = await withUploadTimeout(studioActions.uploadShotImage(imageUrl, { fileName: file.name, file, shotId: shot?.id || "" }));
      setLocalMessage(result?.summary || `上传成功：${file.name} 已导入 ${shot?.id || "镜头"}。`);
      setUploadReceipt({ kind: "image", title: `${shot?.id || "镜头"} 图片上传成功`, detail: file.name, previewUrl: imageUrl });
    } catch (error) {
      setLocalMessage(`上传失败：${error.message || String(error)}`);
    } finally {
      setRunningAction("");
    }
  }

  async function uploadSpecificShotVideo(shot, event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !studioActions.uploadShotVideo) return;
    if (running) return;
    setRunningAction(`shot-video-upload-${shot?.id || ""}`);
    setLocalMessage(`正在准备 ${shot?.id || "镜头"} 视频：${file.name}（${formatFileSize(file.size)}）...`);
    try {
      const previewUrl = URL.createObjectURL(file);
      setLocalMessage(`视频已选择，正在写入 ${shot?.id || "镜头"}...`);
      const result = await withUploadTimeout(studioActions.uploadShotVideo("", { fileName: file.name, file, previewUrl, shotId: shot?.id || "" }));
      setLocalMessage(result?.summary || `上传成功：${file.name} 已导入 ${shot?.id || "镜头"}。`);
      setUploadReceipt({ kind: "video", title: `${shot?.id || "镜头"} 视频上传成功`, detail: file.name, previewUrl, previewObjectUrl: true });
    } catch (error) {
      setLocalMessage(`上传失败：${error.message || String(error)}`);
    } finally {
      setRunningAction("");
    }
  }

  async function uploadAssetImage(asset, event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !studioActions.uploadAssetImage) return;
    if (running) return;
    setRunningAction(`asset-upload-${asset?.id || asset?.token || asset?.name || ""}`);
    setLocalMessage(`正在读取资产图：${file.name}（${formatFileSize(file.size)}）...`);
    try {
      const imageUrl = await readImageForUpload(file);
      setLocalMessage(`资产图已读取，正在写入项目：${file.name}...`);
      const result = await withUploadTimeout(studioActions.uploadAssetImage(asset, imageUrl, { fileName: file.name, file }));
      setLocalMessage(result?.summary || `上传成功：${file.name} 已设为资产定妆图。`);
      setUploadReceipt({ kind: "image", title: "资产定妆图上传成功", detail: file.name, previewUrl: imageUrl });
    } catch (error) {
      setLocalMessage(`上传失败：${error.message || String(error)}`);
    } finally {
      setRunningAction("");
    }
  }

  return (
    <ProjectShell
      title="短剧 / 漫剧 AI 生产中台"
      episodeTitle={businessEpisode?.title || active?.name || "当前集"}
      sourceText={sourceText}
      setSourceText={setSourceText}
      stages={stages}
      shots={episodeShots}
      assets={episodeAssets}
      resources={resourceIndex?.activeItems || resourceIndex?.items || []}
      timeline={episodeTimeline}
      exportHistory={exportHistory}
      consistencyReport={consistencyReport}
      migrationReport={migrationReport}
      deliveryManifestReport={deliveryManifestReport}
      multiEpisodeDeliverySummary={multiEpisodeDeliverySummary}
      mediaCacheReport={mediaCacheReport}
      desktopUploadChecklist={desktopUploadChecklist}
      providerHealthReport={providerHealthReport}
      queueOperationsBoard={queueOperationsBoard}
      enhancedDeliveryGate={enhancedDeliveryGate}
      riskReport={productionDashboard?.riskReport || null}
      progress={progress}
      heroTitle={heroTitle}
      heroDetail={heroDetail}
      primaryAction={primaryAction}
      runningAction={runningAction}
      running={running}
      actions={studioActions}
      runStage={runStage}
      uploadShotImage={uploadShotImage}
      uploadShotVideo={uploadShotVideo}
      uploadSpecificShotImage={uploadSpecificShotImage}
      uploadSpecificShotVideo={uploadSpecificShotVideo}
      pickDesktopShotImage={pickDesktopShotImage}
      pickDesktopShotVideo={pickDesktopShotVideo}
      uploadAssetImage={uploadAssetImage}
      uploadReceipt={uploadReceipt}
      onDismissUploadReceipt={() => setUploadReceipt(null)}
      activeViewRequest={activeViewRequest}
      episodes={episodes}
      activeEpisodeId={activeEpisodeId}
      onEpisodeChange={onEpisodeChange}
      onCreateEpisode={onCreateEpisode}
      workspaces={workspaces}
      activeWorkspaceId={activeWorkspaceId}
      onWorkspaceChange={onWorkspaceChange}
      queueCounts={queueCounts}
      onSmartContinue={onSmartContinue}
      smartContinueHint={smartContinueHint}
      autoSaveState={autoSaveState}
      queueStatus={queueRunning ? "队列运行中" : queueStats.failed ? "有失败任务待处理" : queueStats.pending ? "任务等待运行" : "空闲"}
      queue={queue}
      nextActions={productionDashboard?.nextActions || []}
      message={localMessage || projectMessage}
      metrics={[
        { label: "角色", value: assetCounts.characters || 0 },
        { label: "场景", value: assetCounts.scenes || 0 },
        { label: "镜头", value: shotCount },
        { label: "资产", value: assetCount },
        { label: "可执行", value: productionDashboard?.totals?.readyTasks ?? queueStats.pending },
        { label: "阻塞", value: productionDashboard?.totals?.blockedTasks ?? 0 },
        { label: `${costCurrency} 预估`, value: formatCost(estimatedCost) },
        { label: "审计", value: auditEventCount },
        { label: "待执行", value: queueStats.pending },
        { label: "失败", value: queueStats.failed },
      ]}
    />
  );
}

function formatCost(value = 0) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "0";
  if (number >= 100) return String(Math.round(number));
  return number.toFixed(2).replace(/\.?0+$/, "");
}

function readFileAsDataUrl(file, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 45000);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const timer = window.setTimeout(() => {
      reader.abort();
      reject(new Error(`${options.errorMessage || "文件读取失败"}：文件过大或读取超时`));
    }, timeoutMs);
    reader.onload = () => {
      window.clearTimeout(timer);
      resolve(reader.result);
    };
    reader.onerror = () => {
      window.clearTimeout(timer);
      reject(reader.error || new Error(options.errorMessage || "文件读取失败"));
    };
    reader.onabort = () => {
      window.clearTimeout(timer);
      reject(new Error(`${options.errorMessage || "文件读取失败"}：读取已取消`));
    };
    reader.readAsDataURL(file);
  });
}

function readImageForUpload(file) {
  if (!file?.type?.startsWith("image/")) {
    return readFileAsDataUrl(file, { errorMessage: "图片读取失败" });
  }
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    const timer = window.setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("图片解码超时，请尝试压缩后重新上传。"));
    }, 45000);
    image.onload = () => {
      window.clearTimeout(timer);
      try {
        const maxDimension = 2048;
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
        const width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
        const height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { alpha: false });
        context.fillStyle = "#050505";
        context.fillRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      } catch (error) {
        readFileAsDataUrl(file, { errorMessage: "图片读取失败" }).then(resolve, reject);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      URL.revokeObjectURL(objectUrl);
      readFileAsDataUrl(file, { errorMessage: "图片读取失败" }).then(resolve, reject);
    };
    image.src = objectUrl;
  });
}

function withUploadTimeout(promise, timeoutMs = 90000) {
  let timer = 0;
  return Promise.race([
    Promise.resolve(promise).finally(() => {
      if (timer) window.clearTimeout(timer);
    }),
    new Promise((_, reject) => {
      timer = window.setTimeout(() => reject(new Error("上传写入超时，请确认文件大小或稍后重试。")), timeoutMs);
    }),
  ]);
}

function formatFileSize(size = 0) {
  const bytes = Number(size || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "未知大小";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(/\.0$/, "")} MB`;
}

function isTauriRuntime() {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
}

function productionStageTitle(stage = "") {
  const labels = {
    intake: "小说导入",
    bible: "制作圣经",
    textPlan: "文本方案",
    assetRegistry: "资产注册",
    shotBreakdown: "镜头拆解",
    assetGeneration: "资产定妆",
    shotImages: "镜头图片",
    shotVideos: "镜头视频",
    timeline: "时间线装配",
    review: "审片质检",
    delivery: "交付导出",
    archive: "审计归档",
  };
  return labels[stage] || "";
}

function blockerLabel(blocker = "") {
  const labels = {
    sourceText: "补充小说原文",
    productionBible: "完善制作圣经",
    script: "生成文本方案",
    assets: "建立资产库",
    shots: "生成镜头表",
    approvedAssets: "锁定资产定妆",
    shotImages: "生成全部图片",
    shotVideos: "生成全部视频",
    timeline: "装配时间线",
    approvedReview: "通过审片",
    delivery: "完成导出",
    eventLog: "归档审计记录",
  };
  return labels[blocker] || blocker;
}
