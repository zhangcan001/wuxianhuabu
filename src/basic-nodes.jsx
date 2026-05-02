import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { appendNodeFieldToken, applyGeneratedFallback, applyGeneratedResult, applyNodeFieldTemplate, clearNodeField, copyText, copyTextWithFeedback, createGeneratingResultNode, createGeminiBatchResultNodes, createImportedResultNode, describeGeminiFinalMessage, describeGeminiProgressMessage, describeLinkResult, failGeminiBatchResults, finalizeGeminiBatchResults, openPromptPreviewCard, applyGeminiProgressUpdate, patchNodeData, setNodeError, setNodeField, setNodeMessage } from "./node-action-helpers";
import {
  copyImageToClipboard as invokeCopyImageToClipboard,
  cancelGeminiWebImage as invokeCancelGeminiWebImage,
  generateGeminiWebImage as invokeGenerateGeminiWebImage,
  listenGeminiWebImage,
  openGeminiChromeLogin as invokeOpenGeminiChromeLogin,
  saveImageToDownloads as invokeSaveImageToDownloads,
} from "./tauri-bridge-helpers.js";

function normalizeAssetPromptVariantsForNode(value = {}) {
  return {
    nanoBanana: String(value?.nanoBanana || value?.gemini || value?.nanoBananaPrompt || "").trim(),
    openSource: String(value?.openSource || value?.openSourcePrompt || "").trim(),
    midjourney: String(value?.midjourney || value?.midjourneyPrompt || value?.mj || "").trim(),
  };
}

function pickAssetPromptVariantForNode(asset, variant = "nanoBanana") {
  const variants = normalizeAssetPromptVariantsForNode(asset?.promptVariants || asset?.cineForge || {});
  if (variant === "openSource") return variants.openSource || variants.nanoBanana || variants.midjourney || asset?.prompt || "";
  if (variant === "midjourney") return variants.midjourney || variants.nanoBanana || variants.openSource || asset?.prompt || "";
  return variants.nanoBanana || variants.openSource || variants.midjourney || asset?.prompt || "";
}

function buildBoundAssetPromptForNode(asset, variant = "nanoBanana") {
  const selectedPrompt = pickAssetPromptVariantForNode(asset, variant);
  return [
    asset?.token || "",
    selectedPrompt || "",
    asset?.visualLock ? `稳定锚点：${asset.visualLock}` : "",
    asset?.continuityRule ? `连续性：${asset.continuityRule}` : "",
    Array.isArray(asset?.evidenceSource) && asset.evidenceSource.length ? `证据来源：${asset.evidenceSource.join("；")}` : "",
    asset?.referenceResources ? `参考资源：${asset.referenceResources}` : "",
    "请严格沿用以上资产设定生成，不要擅自改脸、改服装、改材质或改空间结构。",
  ].filter(Boolean).join("\n");
}

export function UploadNode({ node, updateNode, onSendToLinkedNode, helpers }) {
  const { NodeHeader, readImage, normalizeUploadNodeData, persistImportedImage } = helpers;
  const state = normalizeUploadNodeData(node.data);
  const [message, setMessage] = useState("");

  function useUrl() {
    if (!state.url.trim()) {
      setNodeMessage(setMessage, "请先粘贴图片直链");
      return;
    }
    patchNodeData(updateNode, node.id, { imageUrl: state.url, displayName: "上传图片" });
    setNodeMessage(setMessage, "已载入图片直链");
  }

  function sendToVr() {
    const image = state.imageUrl || state.url || "";
    if (!image) {
      setNodeMessage(setMessage, "请先上传图片或填写图片直链");
      return;
    }
    const result = onSendToLinkedNode?.(node.id, "vr360", { panorama: image, displayName: "VR360 全景场景" });
    if (result) setNodeMessage(setMessage, describeLinkResult(result, "VR360 ", { updatedPrefix: "已同步到最近的", createdPrefix: "已创建并送入" }));
  }

  async function acceptUploadedImage(imageUrl, context = {}) {
    try {
      const persisted = await persistImportedImage({
        imageUrl,
        imagePath: context.imagePath || "",
        fileName: context.fileName || "upload-image",
      });
      updateNode(node.id, {
        imageUrl: persisted.imageUrl,
        imagePath: persisted.imagePath,
        originalImageUrl: persisted.originalImageUrl,
        imageThumbnailUrl: persisted.imageThumbnailUrl,
        imageThumbnailPath: persisted.imageThumbnailPath,
        displayName: "上传图片",
      });
      setNodeMessage(setMessage, "已载入上传图片");
    } catch (error) {
      setNodeError(setMessage, "上传图片失败：", error);
    }
  }

  return (
    <>
      <NodeHeader icon="up" title={state.displayName} />
      <label className="upload-box">
        {state.imageUrl ? <img src={state.imageUrl} alt="" /> : <><b>↑</b><span>node.upload.hint</span></>}
        <input hidden type="file" accept="image/*" onChange={(event) => readImage(event, acceptUploadedImage)} />
      </label>
      <div className="url-row upload-url">
        <input value={state.url} placeholder="粘贴图片直链 / 参考图地址" onChange={(event) => setNodeField(updateNode, node.id, "url", event.target.value)} />
        <button onClick={useUrl}>使用</button>
      </div>
      <div className="image-quickbar">
        <button onClick={sendToVr}>送到 VR360</button>
      </div>
      <small className="tip">可作为角色参考、场景参考、道具参考的统一入口。</small>
      {message && <small className="result-message">{message}</small>}
    </>
  );
}

export function ImageEditNode({ node, updateNode, createOutputNear, settings, assetIndex, openPromptPreview, helpers }) {
  const { NodeHeader, AssetTokenInsertRow, PROMPT_CHIPS, providerLabel, preparePromptForNode, normalizeImageEditNodeData, shortTitle, runImageGeneration, makeGeneratedImage, appendToken, currentProviderMode, testComfyConnection, testImageGeneration } = helpers;
  const state = normalizeImageEditNodeData(node.data);
  const prompt = state.prompt;
  const [message, setMessage] = useState(state.lastCheckMessage || "");
  const [testing, setTesting] = useState("");
  const lastAssetSyncKeyRef = useRef("");
  const nodeProviderMode = normalizeImageNodeProviderMode(state.providerMode);
  const apiPresets = [
    {
      id: "openai-image",
      label: "OpenAI 图像",
      customModel: "gpt-image-1",
      customImagePath: "data.0.b64_json",
      customImageSize: "1024x1024",
      customAspectRatio: "1:1",
    },
    {
      id: "banana-pro-4k",
      label: "Banana Pro 4K",
      customModel: "nano-banana-pro-4k-vip",
      customImagePath: "data.results.0.url",
      customImageSize: "4K",
      customAspectRatio: "auto",
    },
    {
      id: "banana-fast-1k",
      label: "Banana Fast 1K",
      customModel: "nano-banana-fast",
      customImagePath: "data.results.0.url",
      customImageSize: "1024x1024",
      customAspectRatio: "auto",
    },
    {
      id: "generic-url",
      label: "通用 URL",
      customModel: "",
      customImagePath: "data.0.url",
      customImageSize: "1024x1024",
      customAspectRatio: "auto",
    },
    {
      id: "generic-base64",
      label: "通用 Base64",
      customModel: "",
      customImagePath: "data.0.b64_json",
      customImageSize: "1024x1024",
      customAspectRatio: "auto",
    },
  ];
  const apiOverrideState = {
    customModel: String(state.apiModel || "").trim(),
    customImagePath: String(state.apiImagePath || "").trim(),
    customImageSize: String(state.apiImageSize || "").trim(),
    customAspectRatio: String(state.apiAspectRatio || "").trim(),
  };
  const comfyOverrideState = {
    comfyImagePositiveNodeId: String(state.comfyPositiveNodeId || "").trim(),
    comfyTimeoutSeconds: String(state.comfyTimeoutSeconds || "").trim(),
  };
  const effectiveSettings = {
    ...(settings || {}),
    ...(nodeProviderMode === "inherit"
      ? {}
      : {
        providerMode: nodeProviderMode === "api" ? "custom" : "comfy",
        comfyEnabled: nodeProviderMode === "comfy",
      }),
    ...(apiOverrideState.customModel ? { customModel: apiOverrideState.customModel } : {}),
    ...(apiOverrideState.customImagePath ? { customImagePath: apiOverrideState.customImagePath } : {}),
    ...(apiOverrideState.customImageSize ? { customImageSize: apiOverrideState.customImageSize } : {}),
    ...(apiOverrideState.customAspectRatio ? { customAspectRatio: apiOverrideState.customAspectRatio } : {}),
    ...(comfyOverrideState.comfyImagePositiveNodeId
      ? {
        comfyImagePositiveNodeId: comfyOverrideState.comfyImagePositiveNodeId,
        positiveNodeId: comfyOverrideState.comfyImagePositiveNodeId,
      }
      : {}),
    ...(comfyOverrideState.comfyTimeoutSeconds ? { comfyTimeoutSeconds: comfyOverrideState.comfyTimeoutSeconds } : {}),
  };
  const { expandedPrompt } = preparePromptForNode(prompt || "AI Image", assetIndex, effectiveSettings, {
    tool: "image",
    kind: "image",
  });
  const effectiveMode = nodeProviderMode === "inherit"
    ? currentProviderMode(effectiveSettings || {})
    : (nodeProviderMode === "api" ? "custom" : "comfy");
  const modeStatus = effectiveMode === "comfy"
    ? {
      title: "ComfyUI 生图",
      summary: `地址 ${effectiveSettings?.comfyBaseUrl || "未填写"} · 节点 ${(effectiveSettings?.comfyImagePositiveNodeId || effectiveSettings?.positiveNodeId || "未填写")} · 超时 ${effectiveSettings?.comfyTimeoutSeconds || "180"} 秒`,
      checks: [
        { ok: Boolean(String(effectiveSettings?.comfyBaseUrl || "").trim()), label: "ComfyUI 地址" },
        { ok: Boolean(String(effectiveSettings?.comfyImageWorkflowJson || effectiveSettings?.workflowJson || "").trim()), label: "API workflow JSON" },
        { ok: Boolean(String(effectiveSettings?.comfyImagePositiveNodeId || effectiveSettings?.positiveNodeId || "").trim()), label: "正向提示词节点 ID" },
      ],
    }
    : effectiveMode === "custom"
      ? {
        title: "API 生图",
        summary: `接口 ${effectiveSettings?.customApiUrl || "未填写"} · 模型 ${effectiveSettings?.customModel || "未填写"} · 尺寸 ${effectiveSettings?.customImageSize || "1024x1024"} · 比例 ${effectiveSettings?.customAspectRatio || "auto"}`,
        checks: [
          { ok: Boolean(String(effectiveSettings?.customApiUrl || "").trim()), label: "API 地址" },
          { ok: Boolean(String(effectiveSettings?.customModel || "").trim()), label: "模型" },
          { ok: Boolean(String(effectiveSettings?.customApiKey || "").trim() || effectiveSettings?.customApiKeySaved), label: "API Key" },
          { ok: Boolean(String(effectiveSettings?.customImagePath || "").trim()), label: "结果路径" },
        ],
      }
      : {
        title: "本地模拟",
        summary: "当前节点会使用本地模拟图像结果，适合占位和流程测试。",
        checks: [{ ok: true, label: "无需额外配置" }],
      };
  const missingChecks = modeStatus.checks.filter((item) => !item.ok);
  const canGenerate = missingChecks.length === 0 || effectiveMode === "mock";
  const selectedApiPreset = apiPresets.find((item) => item.id === state.apiPresetId) || null;
  const assetOptions = Array.isArray(assetIndex?.items)
    ? assetIndex.items.filter((item) => item && typeof item === "object" && item.token)
    : [];
  const quickTemplates = [
    ["角色定妆", "角色定妆照，全身正面站立，稳定脸部特征，服装层次清晰，纯净背景，角色设定图"],
    ["场景设定", "场景设定图，正向完整展示空间结构，材质明确，主光源清晰，建立镜头质感"],
    ["道具设定", "道具设定图，正面完整展示，结构清晰，材质细节明确，纯净背景"],
    ["封面海报", "影视海报构图，主角突出，氛围强烈，标题留白，电影感光影"],
  ];

  const inferredShotId = String(state.targetShotId || "").trim().toUpperCase() || `${prompt}\n${expandedPrompt}`.match(/\bS\d{2,}\b/i)?.[0]?.toUpperCase() || "";
  const shotBindingExtra = {
    mainCharacterToken: state.mainCharacterToken || "",
    mainSceneToken: state.mainSceneToken || "",
    keyPropTokens: Array.isArray(state.keyPropTokens) ? state.keyPropTokens.filter(Boolean) : [],
    assetRefs: Array.isArray(state.assetRefs) ? state.assetRefs.filter(Boolean) : [],
    referenceResources: state.referenceResources || "",
  };
  const assetResultExtra = {
    sourceAssetToken: state.sourceAssetToken || "",
    sourceAssetName: state.sourceAssetName || "",
    sourceAssetVariant: state.sourceAssetVariant || "",
    ...shotBindingExtra,
  };
  const providerSummary = effectiveMode === "custom"
    ? `API · ${effectiveSettings?.customModel || "未填写"} · ${effectiveSettings?.customImageSize || "1024x1024"} · ${effectiveSettings?.customAspectRatio || "auto"}`
    : effectiveMode === "comfy"
      ? `ComfyUI · 节点 ${effectiveSettings?.comfyImagePositiveNodeId || effectiveSettings?.positiveNodeId || "未填写"} · ${effectiveSettings?.comfyTimeoutSeconds || "180"} 秒`
      : "本地模拟 · 自动";
  const boundAsset = Array.isArray(assetIndex?.items)
    ? assetIndex.items.find((item) => item?.token === state.sourceAssetToken) || null
    : null;
  const boundAssetVariant = effectiveMode === "comfy"
    ? "openSource"
    : (state.sourceAssetVariant === "midjourney" ? "midjourney" : "nanoBanana");
  const boundAssetPromptSeed = boundAsset
    ? buildBoundAssetPromptForNode(boundAsset, boundAssetVariant)
    : "";

  function bindAssetToken(token) {
    const selectedAsset = assetOptions.find((item) => item.token === token) || null;
    const nextPrompt = selectedAsset
      ? buildBoundAssetPromptForNode(selectedAsset, effectiveMode === "comfy" ? "openSource" : "nanoBanana")
      : "";
    updateNode(node.id, {
      sourceAssetToken: token || "",
      sourceAssetName: selectedAsset?.name || "",
      sourceAssetVariant: effectiveMode === "comfy" ? "openSource" : "nanoBanana",
      prompt: nextPrompt,
      assetPromptSeed: nextPrompt,
    });
    if (selectedAsset) {
      setNodeMessage(setMessage, `已同步资产提示词：${selectedAsset.name || selectedAsset.token}`);
    } else {
      setNodeMessage(setMessage, "已清空资产绑定");
    }
  }

  function clearCurrentOverrides() {
    if (effectiveMode === "comfy") {
      updateNode(node.id, {
        comfyPositiveNodeId: "",
        comfyTimeoutSeconds: "",
      });
      return;
    }
    if (effectiveMode === "custom") {
      updateNode(node.id, {
        apiPresetId: "",
        apiModel: "",
        apiImagePath: "",
        apiImageSize: "",
        apiAspectRatio: "",
      });
    }
  }

  function applyApiPreset(preset) {
    updateNode(node.id, {
      providerMode: "api",
      apiPresetId: preset.id,
      apiModel: preset.customModel,
      apiImagePath: preset.customImagePath,
      apiImageSize: preset.customImageSize,
      apiAspectRatio: preset.customAspectRatio,
    });
  }

  function persistNodeStatus(status, nextMessage) {
    updateNode(node.id, {
      lastCheckStatus: status,
      lastCheckMessage: nextMessage,
      lastResolvedSummary: modeStatus.summary,
    });
    setNodeMessage(setMessage, nextMessage);
  }

  async function copyLastStatus() {
    if (!state.lastCheckMessage) return;
    await copyTextWithFeedback({
      text: state.lastResolvedSummary ? `${state.lastCheckMessage} · ${state.lastResolvedSummary}` : state.lastCheckMessage,
      setMessage,
      successMessage: "已复制最近结果。",
      errorPrefix: "复制失败：",
    });
  }

  function clearLastStatus() {
    updateNode(node.id, {
      lastCheckStatus: "",
      lastCheckMessage: "",
      lastResolvedSummary: "",
    });
    setNodeMessage(setMessage, "");
  }

  async function runNodeSelfCheck() {
    try {
      setTesting("selfcheck");
      if (missingChecks.length) {
        const nextMessage = `当前节点还缺少：${missingChecks.map((item) => item.label).join("、")}`;
        persistNodeStatus("warning", nextMessage);
        return;
      }
      if (effectiveMode === "comfy") {
        const note = await testComfyConnection(effectiveSettings);
        const nextMessage = `ComfyUI 连接正常：${note}`;
        persistNodeStatus("ok", nextMessage);
        return;
      }
      if (effectiveMode === "custom") {
        const nextMessage = [
          "API 配置检查通过",
          `接口 ${effectiveSettings?.customApiUrl || "未填写"}`,
          `模型 ${effectiveSettings?.customModel || "未填写"}`,
          `结果路径 ${effectiveSettings?.customImagePath || "未填写"}`,
        ].join(" · ");
        persistNodeStatus("ok", nextMessage);
        return;
      }
      const nextMessage = "当前节点使用本地模拟，可直接生成或试跑。";
      persistNodeStatus("ok", nextMessage);
    } catch (error) {
      persistNodeStatus("error", error?.message || String(error) || "节点自检失败");
      setNodeError(setMessage, "节点自检失败：", error);
    } finally {
      setTesting("");
    }
  }

  async function runNodeTrial() {
    try {
      setTesting("trial");
      if (!canGenerate) {
        const nextMessage = `试跑前请先补齐：${missingChecks.map((item) => item.label).join("、")}`;
        persistNodeStatus("warning", nextMessage);
        return;
      }
      const trialPrompt = (prompt || "").trim() || "角色设定图，全身正面站立，纯净背景，细节稳定。";
      const outputId = createGeneratingResultNode({
        createOutputNear,
        sourceNodeId: node.id,
        title: `${shortTitle(trialPrompt)} · 试跑`,
        note: "节点试跑中...",
        extra: {
          targetShotId: inferredShotId,
          providerSummary,
          sourceNodeType: "imageEdit",
          ...assetResultExtra,
        },
      });
      const result = await testImageGeneration(effectiveSettings, trialPrompt);
      const resultText = result?.note || result?.imageUrl || "已返回结果";
      applyGeneratedResult({
        updateNode,
        outputId,
        result,
        sourcePrompt: trialPrompt,
        extra: {
          targetShotId: inferredShotId,
          providerSummary,
          sourceNodeType: "imageEdit",
          ...assetResultExtra,
        },
      });
      persistNodeStatus("ok", `节点试跑成功：${String(resultText).slice(0, 160)}`);
    } catch (error) {
      const trialPrompt = (prompt || "").trim() || "角色设定图，全身正面站立，纯净背景，细节稳定。";
      const outputId = createGeneratingResultNode({
        createOutputNear,
        sourceNodeId: node.id,
        title: `${shortTitle(trialPrompt)} · 试跑失败`,
        note: "节点试跑失败",
        extra: {
          targetShotId: inferredShotId,
          providerSummary,
          sourceNodeType: "imageEdit",
          ...assetResultExtra,
        },
      });
      applyGeneratedFallback({
        updateNode,
        outputId,
        error,
        sourcePrompt: trialPrompt,
        fallbackImageUrl: makeGeneratedImage(`试跑失败\n${trialPrompt}`),
        fallbackNote: "节点试跑失败，已保留错误结果节点",
        extra: {
          targetShotId: inferredShotId,
          providerSummary,
          sourceNodeType: "imageEdit",
          ...assetResultExtra,
        },
      });
      persistNodeStatus("error", error?.message || String(error) || "节点试跑失败");
      setNodeError(setMessage, "节点试跑失败：", error);
    } finally {
      setTesting("");
    }
  }

  function pinCurrentMode() {
    if (effectiveMode === "custom") {
      updateNode(node.id, { providerMode: "api" });
      setNodeMessage(setMessage, `当前节点已固定为 API 生图，执行模型：${effectiveSettings?.customModel || "未填写"}`);
      return;
    }
    if (effectiveMode === "comfy") {
      updateNode(node.id, { providerMode: "comfy" });
      setNodeMessage(setMessage, `当前节点已固定为 ComfyUI 生图，正向节点：${effectiveSettings?.comfyImagePositiveNodeId || effectiveSettings?.positiveNodeId || "未填写"}`);
      return;
    }
    updateNode(node.id, { providerMode: "inherit" });
    setNodeMessage(setMessage, `当前节点已改为跟随全局，当前全局通道：${currentProviderMode(settings || {})}`);
  }

  function preview() {
    openPromptPreviewCard({
      openPromptPreview,
      title: "AI生图提示词预览",
      kind: "image",
      original: expandedPrompt,
      negative: "文字水印，低清晰度，脸部崩坏，多手多脚，角色不一致",
      params: `供应商：${providerLabel(effectiveSettings)} · 自动 · 2K`,
    });
  }

  async function copyExpandedPrompt() {
    await copyTextWithFeedback({ text: expandedPrompt });
  }

  async function generate() {
    if (!canGenerate) {
      const nextMessage = `生成前请先补齐：${missingChecks.map((item) => item.label).join("、")}`;
      persistNodeStatus("warning", nextMessage);
      return;
    }
    const title = prompt.trim() ? shortTitle(prompt) : "结果图片";
    const outputId = createGeneratingResultNode({
      createOutputNear,
      sourceNodeId: node.id,
      title,
      note: "正在生成...",
      extra: {
        targetShotId: inferredShotId,
        providerSummary,
        sourceNodeType: "imageEdit",
        ...assetResultExtra,
      },
    });
    try {
      const result = await runImageGeneration(effectiveSettings, expandedPrompt);
      applyGeneratedResult({
        updateNode,
        outputId,
        result,
        sourcePrompt: expandedPrompt,
        extra: {
          targetShotId: inferredShotId,
          providerSummary,
          sourceNodeType: "imageEdit",
          ...assetResultExtra,
        },
      });
      persistNodeStatus("ok", result?.note || "生成成功");
    } catch (error) {
      persistNodeStatus("error", error?.message || String(error) || "生成失败");
      applyGeneratedFallback({
        updateNode,
        outputId,
        error,
        sourcePrompt: expandedPrompt,
        fallbackImageUrl: makeGeneratedImage(expandedPrompt),
        fallbackNote: "生成接口未完成，已使用本地模拟结果",
        extra: {
          targetShotId: inferredShotId,
          providerSummary,
          sourceNodeType: "imageEdit",
          ...assetResultExtra,
        },
      });
    }
  }

  useEffect(() => {
    if (!state.autoStart || testing || !canGenerate) return;
    updateNode(node.id, { autoStart: false }, { skipHistory: true });
    generate();
  }, [state.autoStart, testing, canGenerate]);

  useEffect(() => {
    if (!state.sourceAssetToken || !boundAssetPromptSeed) return;
    if (
      String(state.prompt || "") === boundAssetPromptSeed
      && String(state.assetPromptSeed || "") === boundAssetPromptSeed
      && state.sourceAssetName === (boundAsset?.name || state.sourceAssetName)
      && state.sourceAssetVariant === boundAssetVariant
    ) return;
    updateNode(node.id, {
      prompt: boundAssetPromptSeed,
      assetPromptSeed: boundAssetPromptSeed,
      sourceAssetName: boundAsset?.name || state.sourceAssetName || "",
      sourceAssetVariant: boundAssetVariant,
    }, { skipHistory: true });
    const nextKey = `${state.sourceAssetToken}::${boundAssetVariant}::${boundAssetPromptSeed}`;
    if (lastAssetSyncKeyRef.current !== nextKey) {
      lastAssetSyncKeyRef.current = nextKey;
      setNodeMessage(setMessage, `已同步资产提示词：${boundAsset?.name || state.sourceAssetToken}`);
    }
  }, [
    node.id,
    updateNode,
    state.sourceAssetToken,
    state.prompt,
    state.assetPromptSeed,
    state.sourceAssetName,
    state.sourceAssetVariant,
    boundAsset?.name,
    boundAssetPromptSeed,
    boundAssetVariant,
  ]);

  return (
    <>
      <NodeHeader icon="ai" title="AI 图片" />
      <div className="chips">
        {Object.keys(PROMPT_CHIPS).map((chip) => (
          <button key={chip} onClick={() => setNodeField(updateNode, node.id, "prompt", `${prompt}${PROMPT_CHIPS[chip]}`)}>{chip}</button>
        ))}
      </div>
      <div className="image-quickbar">
        {quickTemplates.map(([label, template]) => (
          <button key={label} onClick={() => applyNodeFieldTemplate(updateNode, node.id, "prompt", template)}>{label}</button>
        ))}
        <button onClick={() => clearNodeField(updateNode, node.id, "prompt")}>清空</button>
      </div>
      <div className="asset-insert-row">
        <select value={state.sourceAssetToken || ""} onChange={(event) => bindAssetToken(event.target.value)}>
          <option value="">未绑定资产</option>
          {assetOptions.map((asset) => (
            <option key={asset.token} value={asset.token}>{asset.category} · {asset.name}</option>
          ))}
        </select>
        <button disabled={!state.sourceAssetToken} onClick={() => bindAssetToken(state.sourceAssetToken)}>同步资产提示词</button>
      </div>
      <div className="image-quickbar">
        <span className="pill">执行通道</span>
        <button className={nodeProviderMode === "inherit" ? "active" : ""} onClick={() => setNodeField(updateNode, node.id, "providerMode", "inherit")}>跟随全局</button>
        <button className={nodeProviderMode === "comfy" ? "active" : ""} onClick={() => setNodeField(updateNode, node.id, "providerMode", "comfy")}>ComfyUI 生图</button>
        <button className={nodeProviderMode === "api" ? "active" : ""} onClick={() => setNodeField(updateNode, node.id, "providerMode", "api")}>API 生图</button>
      </div>
      <div className="cf-style-hint">
        <strong>{modeStatus.title}</strong>
        <span>{modeStatus.summary}</span>
        <small>
          {nodeProviderMode === "inherit" ? "当前为跟随全局模式。" : "当前为节点独立执行模式。"}{" "}
          {missingChecks.length ? `缺少：${missingChecks.map((item) => item.label).join("、")}` : "当前通道配置完整。"}
        </small>
        <div className="image-quickbar">
          {!!state.sourceAssetToken && <span className="pill">资产 {state.sourceAssetName || state.sourceAssetToken}</span>}
          <span className={`pill ${missingChecks.length ? "pill-warn" : "pill-ok"}`}>{missingChecks.length ? "待补配置" : "配置通过"}</span>
          <span className="pill">当前模式 {effectiveMode === "custom" ? "API" : effectiveMode === "comfy" ? "ComfyUI" : "模拟"}</span>
          {!!inferredShotId && <span className="pill">目标镜头 {inferredShotId}</span>}
          <button onClick={runNodeSelfCheck} disabled={testing === "selfcheck" || testing === "trial"}>{testing === "selfcheck" ? "自检中..." : "节点自检"}</button>
          <button onClick={runNodeTrial} disabled={testing === "selfcheck" || testing === "trial"}>{testing === "trial" ? "试跑中..." : "节点试跑"}</button>
          {!!state.lastCheckMessage && <button onClick={copyLastStatus}>复制最近结果</button>}
          {!!state.lastCheckMessage && <button onClick={clearLastStatus}>清除记录</button>}
        </div>
        {!!state.lastCheckMessage && <small className={`node-inline-status ${state.lastCheckStatus === "error" ? "is-error" : state.lastCheckStatus === "warning" ? "is-warning" : "is-ok"}`}>最近结果：{state.lastCheckMessage}{state.lastResolvedSummary ? ` · ${state.lastResolvedSummary}` : ""}</small>}
      </div>
      {effectiveMode === "comfy" && (
        <div className="cf-style-hint">
          <strong>ComfyUI 节点覆盖</strong>
          <label>
            生图正向节点 ID
            <input value={state.comfyPositiveNodeId || ""} placeholder={settings?.comfyImagePositiveNodeId || settings?.positiveNodeId || "留空则继承全局"} onChange={(event) => setNodeField(updateNode, node.id, "comfyPositiveNodeId", event.target.value)} />
          </label>
          <label>
            超时秒数
            <input value={state.comfyTimeoutSeconds || ""} placeholder={settings?.comfyTimeoutSeconds || "180"} onChange={(event) => setNodeField(updateNode, node.id, "comfyTimeoutSeconds", event.target.value)} />
          </label>
          <small>这个节点可以单独控制 ComfyUI 正向提示词节点和轮询超时。留空时自动继承统一设置。</small>
          <div className="image-quickbar">
            <span className="pill">工作流 {String(effectiveSettings?.comfyImageWorkflowJson || effectiveSettings?.workflowJson || "").trim() ? "已加载" : "未加载"}</span>
            <button onClick={clearCurrentOverrides}>清空本节点覆盖</button>
            <button onClick={pinCurrentMode}>固定当前通道</button>
          </div>
        </div>
      )}
      {effectiveMode === "custom" && (
        <div className="cf-style-hint">
          <strong>API 节点覆盖</strong>
          <span>{selectedApiPreset ? `当前预设：${selectedApiPreset.label}` : "当前预设：自定义 / 继承混合"}</span>
          <div className="image-quickbar">
            {apiPresets.map((preset) => (
              <button key={preset.id} className={state.apiPresetId === preset.id ? "active" : ""} onClick={() => applyApiPreset(preset)}>{preset.label}</button>
            ))}
          </div>
          <label>
            模型
            <input value={state.apiModel || ""} placeholder={settings?.customModel || "留空则继承全局"} onChange={(event) => setNodeField(updateNode, node.id, "apiModel", event.target.value)} />
          </label>
          <label>
            尺寸
            <input value={state.apiImageSize || ""} placeholder="1024x1024 / 1536x1024 / 4K" onChange={(event) => setNodeField(updateNode, node.id, "apiImageSize", event.target.value)} />
          </label>
          <label>
            宽高比
            <input value={state.apiAspectRatio || ""} placeholder="auto / 1:1 / 16:9" onChange={(event) => setNodeField(updateNode, node.id, "apiAspectRatio", event.target.value)} />
          </label>
          <label>
            结果路径
            <input value={state.apiImagePath || ""} placeholder={settings?.customImagePath || "data.0.url"} onChange={(event) => setNodeField(updateNode, node.id, "apiImagePath", event.target.value)} />
          </label>
          <small>这个节点可以单独覆盖 API 模型、图像尺寸、宽高比和结果图片路径。留空时自动继承统一设置。</small>
          <div className="image-quickbar">
            <span className="pill">结果路径 {effectiveSettings?.customImagePath || "未填写"}</span>
            <span className="pill">尺寸 {effectiveSettings?.customImageSize || "1024x1024"}</span>
            <span className="pill">比例 {effectiveSettings?.customAspectRatio || "auto"}</span>
            <span className="pill">预设 {selectedApiPreset?.label || "自定义"}</span>
            <button onClick={clearCurrentOverrides}>清空本节点覆盖</button>
            <button onClick={pinCurrentMode}>固定当前通道</button>
          </div>
        </div>
      )}
      <AssetTokenInsertRow assetIndex={assetIndex} onInsert={(token) => appendNodeFieldToken({ updateNode, nodeId: node.id, field: "prompt", currentValue: prompt, token, appendToken })} />
      <textarea className="prompt" value={prompt} placeholder="node.imageEdit.promptPlaceholder" onChange={(event) => setNodeField(updateNode, node.id, "prompt", event.target.value)} />
      <div className="node-footer">
        <span className="pill">⭐ {providerLabel(effectiveSettings)}</span>
        <span className="pill">@资产 {assetIndex.items.length}</span>
        <span className="pill">字数 {prompt.trim().length}</span>
        <span className="pill">{effectiveMode === "custom" ? `☷ ${effectiveSettings?.customImageSize || "1024x1024"}` : effectiveMode === "comfy" ? `☷ ComfyUI · ${effectiveSettings?.comfyTimeoutSeconds || "180"}s` : "☷ 自动 · 2K"}</span>
        <button onClick={copyExpandedPrompt}>复制展开</button>
        <button onClick={preview}>预览</button>
        <button className="primary" onClick={generate} disabled={testing === "selfcheck" || testing === "trial" || !canGenerate}>✦ 生成</button>
      </div>
      <small className="tip">💡 当前节点可单独指定走 ComfyUI 或 API；“跟随全局”会使用软件总设置。若当前通道缺少关键配置，先到统一设置里补齐。</small>
      {message && <small className="result-message">{message}</small>}
    </>
  );
}

export function GeminiWebNode({ node, updateNode, createOutputNear, assetIndex, openPromptPreview, helpers }) {
  const {
    NodeHeader,
    AssetTokenInsertRow,
    preparePromptForNode,
    normalizeGeminiWebNodeData,
    appendToken,
    clamp,
    isTauriRuntime,
    splitGeminiPrompts,
    shortTitle,
    readClipboardImageAsDataUrl,
    readImage,
    persistImportedImage,
  } = helpers;
  const state = normalizeGeminiWebNodeData(node.data);
  const prompt = state.prompt;
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const currentRequestIdRef = useRef("");
  const geminiUrl = state.geminiUrl;
  const { expandedPrompt } = preparePromptForNode(prompt || "生成一张适合AI漫剧使用的高质量画面。", assetIndex, null, {
    tool: "geminiWeb",
    modelPreset: "NanoBanana / Gemini",
  });
  const parallelCount = clamp(parseInt(state.parallelCount || "1", 10) || 1, 1, 4);
  const splitMode = state.splitMode || "paragraph";
  const promptJobs = splitGeminiPrompts(expandedPrompt, splitMode);
  const failedIndexSet = new Set(state.geminiFailedIndexes);
  const assetResultExtra = {
    targetShotId: state.targetShotId || "",
    mainCharacterToken: state.mainCharacterToken || "",
    mainSceneToken: state.mainSceneToken || "",
    keyPropTokens: Array.isArray(state.keyPropTokens) ? state.keyPropTokens.filter(Boolean) : [],
    assetRefs: Array.isArray(state.assetRefs) ? state.assetRefs.filter(Boolean) : [],
    referenceResources: state.referenceResources || "",
    sourceAssetToken: state.sourceAssetToken || "",
    sourceAssetName: state.sourceAssetName || "",
    sourceAssetVariant: state.sourceAssetVariant || "",
    sourceNodeType: "geminiWeb",
  };

  async function copyPrompt() {
    await copyTextWithFeedback({
      text: expandedPrompt,
      setMessage,
      successMessage: "已复制提示词，可粘贴到 Gemini 网页。",
      errorPrefix: "复制失败：",
    });
  }

  async function copyJobPrompt(index) {
    const text = promptJobs[index] || "";
    if (!text.trim()) return;
    await copyTextWithFeedback({
      text,
      setMessage,
      successMessage: `已复制第 ${index + 1} 条子任务提示词。`,
      errorPrefix: "复制失败：",
    });
  }

  async function openGemini() {
    await copyPrompt();
    window.open(geminiUrl, "_blank", "noopener,noreferrer");
    setNodeMessage(setMessage, "已打开 Gemini。生成完成后复制图片，再回到这里读取剪贴板。");
  }

  async function openChromeLogin() {
    if (!isTauriRuntime()) {
      window.open(geminiUrl, "_blank", "noopener,noreferrer");
      setNodeMessage(setMessage, "浏览器预览版已打开 Gemini。桌面版会使用独立 Chrome 登录配置。");
      return;
    }
    try {
      const result = await invokeOpenGeminiChromeLogin({
        prompt: expandedPrompt,
        geminiUrl,
        timeoutSeconds: Number(state.timeoutSeconds) || 240,
        loginTimeoutSeconds: Number(state.loginTimeoutSeconds) || 180,
        parallelCount,
        splitMode,
      });
      setNodeMessage(setMessage, `已用普通 Chrome 打开 Gemini。登录完成后关闭 Chrome，再点“后台自动生成”。配置：${result.profileDir}`);
    } catch (error) {
      setNodeError(setMessage, "打开 Chrome 失败：", error);
    }
  }

  async function autoGenerate(retryIndexes = null) {
    if (busyRef.current) {
      setNodeMessage(setMessage, "Gemini 正在生成中，请等待当前任务完成或先取消。");
      return;
    }
    if (!isTauriRuntime()) {
      setNodeMessage(setMessage, "后台自动化需要桌面版运行。浏览器预览版只能使用复制/上传流程。");
      return;
    }
    const jobPrompts = Array.isArray(retryIndexes) && retryIndexes.length
      ? retryIndexes.map((index) => promptJobs[index]).filter(Boolean)
      : promptJobs;
    const requestPrompt = Array.isArray(retryIndexes) && retryIndexes.length ? jobPrompts.join("\n\n") : expandedPrompt;
    busyRef.current = true;
    setBusy(true);
    setNodeMessage(setMessage, `正在启动 Gemini 自动化：${jobPrompts.length} 条任务，${Math.min(parallelCount, jobPrompts.length)} 页并发。`);
    const requestId = `gemini-${node.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    currentRequestIdRef.current = requestId;
    updateNode(node.id, { geminiFailedIndexes: [] }, { skipHistory: true });
    const outputIds = createGeminiBatchResultNodes({
      createOutputNear,
      sourceNodeId: node.id,
      jobPrompts,
      prompt,
      shortTitle,
    });
    const completedIndexes = new Set();
    const failedIndexes = new Set();
    let unlistenProgress = null;
    try {
      unlistenProgress = await listenGeminiWebImage(async (event) => {
        let item = event.payload || {};
        if (item?.imageUrl) {
          const persisted = await persistImportedImage({
            imageUrl: item.imageUrl,
            fileName: `${prompt || "gemini-auto"}-${Number(item.index || 0) + 1}`,
          });
          item = {
            ...item,
            imageUrl: persisted.imageUrl,
            imagePath: persisted.imagePath,
            originalImageUrl: persisted.originalImageUrl,
            imageThumbnailUrl: persisted.imageThumbnailUrl,
            imageThumbnailPath: persisted.imageThumbnailPath,
          };
        }
        const progress = applyGeminiProgressUpdate({
          item,
          requestId,
          outputIds,
          completedIndexes,
          failedIndexes,
          jobPrompts,
          nodeId: node.id,
          updateNode,
        });
        if (!progress) return;
        setNodeMessage(setMessage, describeGeminiProgressMessage(progress));
      });
      const result = await invokeGenerateGeminiWebImage({
        requestId,
        prompt: requestPrompt,
        geminiUrl,
        timeoutSeconds: Number(state.timeoutSeconds) || 240,
        loginTimeoutSeconds: Number(state.loginTimeoutSeconds) || 180,
        parallelCount,
        splitMode: Array.isArray(retryIndexes) && retryIndexes.length ? "paragraph" : splitMode,
      });
      const persistedImages = await Promise.all((Array.isArray(result?.images) && result.images.length
        ? result.images
        : [{ imageUrl: result?.imageUrl, note: result?.note }]
      ).map(async (item, fallbackIndex) => {
        if (!item?.imageUrl) return item;
        const persisted = await persistImportedImage({
          imageUrl: item.imageUrl,
          fileName: `${prompt || "gemini-auto"}-${Number.isFinite(Number(item.index)) ? Number(item.index) + 1 : fallbackIndex + 1}`,
        });
        return {
          ...item,
          imageUrl: persisted.imageUrl,
          imagePath: persisted.imagePath,
          originalImageUrl: persisted.originalImageUrl,
          imageThumbnailUrl: persisted.imageThumbnailUrl,
          imageThumbnailPath: persisted.imageThumbnailPath,
        };
      }));
      const finalState = finalizeGeminiBatchResults({
        result: { ...result, imageUrl: persistedImages.find((item) => item?.imageUrl)?.imageUrl || "", images: persistedImages },
        outputIds,
        completedIndexes,
        failedIndexes,
        jobPrompts,
        nodeId: node.id,
        updateNode,
      });
      setNodeMessage(setMessage, describeGeminiFinalMessage({
        imagesLength: finalState.images.length,
        total: jobPrompts.length,
        profileDir: result.profileDir || "本地配置目录",
      }));
    } catch (error) {
      failGeminiBatchResults({
        error,
        outputIds,
        jobPrompts,
        nodeId: node.id,
        updateNode,
      });
      setNodeError(setMessage, "自动生成失败：", error);
    } finally {
      if (unlistenProgress) unlistenProgress();
      currentRequestIdRef.current = "";
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function cancelAutoGenerate() {
    const requestId = currentRequestIdRef.current;
    if (!requestId) return;
    try {
      await invokeCancelGeminiWebImage({ requestId });
      setNodeMessage(setMessage, "已请求取消 Gemini 自动化，正在等待当前浏览器任务停下。");
    } catch (error) {
      setNodeError(setMessage, "取消失败：", error);
    }
  }

  async function importClipboardImage() {
    setBusy(true);
    setNodeMessage(setMessage, "正在读取剪贴板图片...");
    try {
      const imageUrl = await readClipboardImageAsDataUrl();
      const persisted = await persistImportedImage({
        imageUrl,
        fileName: `${prompt || "gemini-result"}-clipboard`,
      });
      updateNode(node.id, {
        imageUrl: persisted.imageUrl,
        imagePath: persisted.imagePath,
        originalImageUrl: persisted.originalImageUrl,
        imageThumbnailUrl: persisted.imageThumbnailUrl,
        imageThumbnailPath: persisted.imageThumbnailPath,
        displayName: "Gemini网页生图",
      }, { skipHistory: true });
      createImportedResultNode({
        createOutputNear,
        sourceNodeId: node.id,
        title: shortTitle(prompt || "Gemini结果"),
        imageUrl: persisted.imageUrl,
        imagePath: persisted.imagePath,
        originalImageUrl: persisted.originalImageUrl,
        imageThumbnailUrl: persisted.imageThumbnailUrl,
        imageThumbnailPath: persisted.imageThumbnailPath,
        note: "Gemini 网页导入",
        sourcePrompt: expandedPrompt,
        extra: assetResultExtra,
      });
      setNodeMessage(setMessage, "已从剪贴板导入 Gemini 图片。");
    } catch (error) {
      setNodeMessage(setMessage, error.message || "没有读取到剪贴板图片。可在 Gemini 下载图片后用“上传结果”。");
    } finally {
      setBusy(false);
    }
  }

  function preview() {
    openPromptPreviewCard({
      openPromptPreview,
      title: "Gemini网页提示词预览",
      kind: "image",
      original: prompt,
      negative: "文字水印，低清晰度，角色不一致，画面变形",
      params: "Gemini 网页 · 手动确认导入",
    });
  }

  async function acceptUploaded(imageUrl, context = {}) {
    try {
      const persisted = await persistImportedImage({
        imageUrl,
        imagePath: context.imagePath || "",
        fileName: context.fileName || `${prompt || "gemini-result"}-upload`,
      });
      updateNode(node.id, {
        imageUrl: persisted.imageUrl,
        imagePath: persisted.imagePath,
        originalImageUrl: persisted.originalImageUrl,
        imageThumbnailUrl: persisted.imageThumbnailUrl,
        imageThumbnailPath: persisted.imageThumbnailPath,
        displayName: "Gemini网页生图",
      });
      createImportedResultNode({
        createOutputNear,
        sourceNodeId: node.id,
        title: shortTitle(prompt || "Gemini结果"),
        imageUrl: persisted.imageUrl,
        imagePath: persisted.imagePath,
        originalImageUrl: persisted.originalImageUrl,
        imageThumbnailUrl: persisted.imageThumbnailUrl,
        imageThumbnailPath: persisted.imageThumbnailPath,
        note: "Gemini 网页上传导入",
        sourcePrompt: expandedPrompt,
        extra: assetResultExtra,
      });
      setNodeMessage(setMessage, "已上传 Gemini 结果图片。");
    } catch (error) {
      setNodeError(setMessage, "导入 Gemini 图片失败：", error);
    }
  }

  useEffect(() => {
    if (!state.autoStart || busy) return;
    updateNode(node.id, { autoStart: false }, { skipHistory: true });
    autoGenerate();
  }, [state.autoStart, busy]);

  return (
    <>
      <NodeHeader icon="gm" title="Gemini 网页生图" />
      <textarea
        className="prompt gemini-prompt"
        value={prompt}
        placeholder="在这里写提示词。点击“打开Gemini”后会自动复制提示词，你在 Gemini 网页粘贴生成，再复制图片回本软件。"
        onChange={(event) => setNodeField(updateNode, node.id, "prompt", event.target.value)}
      />
      <AssetTokenInsertRow assetIndex={assetIndex} onInsert={(token) => appendNodeFieldToken({ updateNode, nodeId: node.id, field: "prompt", currentValue: prompt, token, appendToken })} />
      <label className="gemini-url">
        Gemini地址
        <input value={geminiUrl} onChange={(event) => setNodeField(updateNode, node.id, "geminiUrl", event.target.value)} />
      </label>
      <div className="gemini-timeouts">
        <label>登录等待秒数<input value={state.loginTimeoutSeconds} onChange={(event) => setNodeField(updateNode, node.id, "loginTimeoutSeconds", event.target.value)} /></label>
        <label>生成等待秒数<input value={state.timeoutSeconds} onChange={(event) => setNodeField(updateNode, node.id, "timeoutSeconds", event.target.value)} /></label>
        <label>并发页数<input type="number" min="1" max="4" step="1" value={state.parallelCount} onChange={(event) => setNodeField(updateNode, node.id, "parallelCount", event.target.value)} /></label>
        <label>分割方式
          <select value={splitMode} onChange={(event) => setNodeField(updateNode, node.id, "splitMode", event.target.value)}>
            <option value="paragraph">按空行分段</option>
            <option value="line">按每行分割</option>
            <option value="separator">按 --- / ### 分割</option>
          </select>
        </label>
      </div>
      <small className="tip">批量任务：{promptJobs.length} 条 · 同时打开 {Math.min(parallelCount, promptJobs.length)} 个网页</small>
      {promptJobs.length > 1 && (
        <div className="gemini-job-list">
          {promptJobs.map((jobPrompt, index) => {
            const failed = failedIndexSet.has(index);
            return (
              <div key={`${node.id}-job-${index}`} className={`gemini-job-item ${failed ? "failed" : ""}`}>
                <div>
                  <strong>任务 {index + 1}</strong>
                  <span>{jobPrompt.slice(0, 96) || "空提示词"}</span>
                </div>
                <div className="gemini-job-actions">
                  {failed && <em>失败待重试</em>}
                  <button onClick={() => copyJobPrompt(index)}>复制</button>
                  <button disabled={busy} onClick={() => autoGenerate([index])}>重试单条</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="gemini-result-preview">
        {state.imageUrl ? <img src={state.imageUrl} alt="" /> : <span>等待从 Gemini 网页导入图片</span>}
      </div>
      <div className="node-footer gemini-actions">
        <span className="pill">任务 {promptJobs.length}</span>
        {!!failedIndexSet.size && <span className="pill">失败 {failedIndexSet.size}</span>}
        <button disabled={busy} onClick={preview}>预览</button>
        <button disabled={busy} onClick={copyPrompt}>复制提示词</button>
        <button disabled={busy} onClick={openChromeLogin}>Chrome登录</button>
        <button disabled={busy} onClick={openGemini}>手动打开</button>
        <button className="primary" disabled={busy} onClick={() => autoGenerate()}>{busy ? "生成中..." : "后台自动生成"}</button>
        {busy && <button onClick={cancelAutoGenerate}>取消</button>}
        {!busy && state.geminiFailedIndexes.length > 0 && (
          <button onClick={() => autoGenerate(state.geminiFailedIndexes)}>重试失败</button>
        )}
      </div>
      <div className="gemini-import-row">
        <button disabled={busy} onClick={importClipboardImage}>{busy ? "读取中..." : "读取剪贴板图片"}</button>
        <label className="gemini-upload-button">上传结果<input hidden type="file" accept="image/*" onChange={(event) => readImage(event, acceptUploaded)} /></label>
      </div>
      <small className="tip">提示：Gemini 网页生成后，右键/复制图片或下载图片，再回到这里导入。</small>
      {message && <small className="result-message">{message}</small>}
    </>
  );
}

function normalizeImageNodeProviderMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  if (mode === "api" || mode === "custom" || mode === "http") return "api";
  if (mode === "comfy" || mode === "comfyui") return "comfy";
  return "inherit";
}

export function TextNode({ node, updateNode, helpers }) {
  const { NodeHeader, normalizeTextNodeData } = helpers;
  const state = normalizeTextNodeData(node.data);
  const text = state.text;
  const quickBlocks = [
    ["镜头备注", "镜头目标：\n情绪：\n动作：\n需要保持一致的元素："],
    ["审稿意见", "问题：\n原因：\n修改建议："],
    ["资产说明", "资产名称：\n视觉锁定：\n连续性规则："],
  ];
  return (
    <>
      <NodeHeader icon="doc" title={node.data.displayName || "文本注释"} />
      <div className="image-quickbar">
        {quickBlocks.map(([label, value]) => (
          <button key={label} onClick={() => applyNodeFieldTemplate(updateNode, node.id, "text", value)}>{label}</button>
        ))}
        <span className="pill">字数 {text.trim().length}</span>
      </div>
      <textarea className="note" value={text} placeholder="node.textAnnotation.empty" onChange={(event) => setNodeField(updateNode, node.id, "text", event.target.value)} />
    </>
  );
}

export function ResultNode({ node, createOutputNear, onSendToLinkedNode, onApplyToNearestShot, onHandleShotAction, helpers }) {
  const { NodeHeader, isTauriRuntime, imageUrlToBlob, safeFileName } = helpers;
  const [message, setMessage] = useState("");
  const previewCandidates = [
    node.data.imageThumbnailUrl || "",
    node.data.imageUrl || "",
    node.data.originalImageUrl || "",
  ].filter(Boolean);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(previewCandidates[0] || "");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState("");
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const imageUrl = node.data.imageUrl;
  const videoUrl = node.data.videoUrl;
  const imagePath = node.data.imagePath || "";
  const videoPath = node.data.videoPath || "";
  const imageThumbnailUrl = node.data.imageThumbnailUrl || "";
  const imageThumbnailPath = node.data.imageThumbnailPath || "";
  const originalImageUrl = node.data.originalImageUrl || "";
  const fullImageCandidates = [
    imageUrl || "",
    originalImageUrl || "",
    imagePreviewUrl || "",
  ].filter(Boolean);
  const mediaUrl = videoUrl || imageUrl;
  const sourcePrompt = node.data.sourcePrompt || "";
  const targetShotId = node.data.targetShotId || "";
  const adoptedShotId = node.data.adoptedShotId || "";
  const adoptionLabel = node.data.adoptionLabel || "";
  const adoptionState = node.data.adoptionState || "";
  const providerSummary = node.data.providerSummary || "";
  const bindingSummary = [
    node.data.mainCharacterToken ? `主角色 ${node.data.mainCharacterToken}` : "",
    node.data.mainSceneToken ? `主场景 ${node.data.mainSceneToken}` : "",
    Array.isArray(node.data.keyPropTokens) && node.data.keyPropTokens.length ? `道具 ${node.data.keyPropTokens.join("、")}` : "",
  ].filter(Boolean).join(" · ");

  useEffect(() => {
    setImagePreviewUrl(previewCandidates[0] || "");
  }, [node.data.imageThumbnailUrl, node.data.imageUrl, node.data.originalImageUrl]);

  useEffect(() => {
    if (!lightboxOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setLightboxOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxOpen]);

  function openLightbox() {
    const preferred = fullImageCandidates[0] || "";
    if (!preferred) return;
    setLightboxUrl(preferred);
    setLightboxOpen(true);
  }

  function closeLightbox() {
    setLightboxOpen(false);
  }

    async function copyImage() {
      if (!imageUrl) return;
      try {
        if (isTauriRuntime()) {
          await invokeCopyImageToClipboard({ imageUrl: imagePath || imageUrl });
          setMessage("已复制图片");
          return;
        }
      if (!navigator.clipboard || !window.ClipboardItem) throw new Error("当前浏览器不支持复制图片");
      const blob = await imageUrlToBlob(imageUrl);
      await navigator.clipboard.write([new ClipboardItem({ [blob.type || "image/png"]: blob })]);
      setMessage("已复制图片");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function copyLink() {
    if (!mediaUrl) return;
    try {
      await copyText(mediaUrl);
      setMessage("已复制链接");
    } catch (error) {
      setMessage(error.message);
    }
  }

    async function download() {
      if (!mediaUrl) return;
      if (videoUrl) {
        const link = document.createElement("a");
        link.href = videoPath || videoUrl;
        link.download = `${safeFileName(node.data.displayName || "video-result")}.mp4`;
        link.click();
        setMessage("已开始下载视频");
        return;
      }
      if (isTauriRuntime()) {
        try {
          const result = await invokeSaveImageToDownloads({
            imageUrl: imagePath || imageUrl,
            fileName: safeFileName(node.data.displayName || "result"),
          });
          setMessage(`已保存：${result.path}`);
      } catch (error) {
        setMessage(String(error));
      }
      return;
    }
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `${safeFileName(node.data.displayName || "result")}.png`;
    link.click();
    setMessage("已开始下载");
  }

  function sendToSplit() {
    if (!imageUrl) return;
    const meta = node.data.storyboardMeta || {};
    createOutputNear(node.id, "split", "分镜拆分", {
      imageUrl,
      rows: meta.rows || 2,
      cols: meta.cols || 2,
      displayName: "分镜拆分",
    });
    setMessage("已创建分镜拆分节点");
  }

  async function copyPrompt() {
    if (!sourcePrompt.trim()) return;
    try {
      await copyText(sourcePrompt);
      setMessage("已复制源提示词");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function copyDiagnostics() {
    const diagnostics = [
      `displayName: ${node.data.displayName || ""}`,
      `previewSrc: ${imagePreviewUrl || ""}`,
      `imageUrl: ${imageUrl || ""}`,
      `imagePath: ${imagePath || ""}`,
      `imageThumbnailUrl: ${imageThumbnailUrl || ""}`,
      `imageThumbnailPath: ${imageThumbnailPath || ""}`,
      `videoUrl: ${videoUrl || ""}`,
      `videoPath: ${videoPath || ""}`,
      `note: ${node.data.note || ""}`,
      `generationError: ${node.data.generationError || ""}`,
    ].join("\n");
    try {
      await copyText(diagnostics);
      setMessage("已复制结果诊断信息");
    } catch (error) {
      setMessage(error.message);
    }
  }

  function exportPromptText() {
    if (!sourcePrompt.trim()) return;
    createOutputNear(node.id, "text", "结果提示词", {
      text: sourcePrompt,
      displayName: "结果提示词",
      width: 420,
      height: 280,
    });
    setMessage("已把源提示词输出到文本节点");
  }

  function sendToUploadNode() {
    if (!imageUrl) return;
    const result = onSendToLinkedNode?.(node.id, "upload", { imageUrl, displayName: "上传图片" });
    if (result) setMessage(describeLinkResult(result, "上传", { updatedPrefix: "已同步到最近的", createdPrefix: "已创建并送入" }));
  }

  function sendToVrNode() {
    if (!imageUrl) return;
    const result = onSendToLinkedNode?.(node.id, "vr360", { panorama: imageUrl, displayName: "VR360 全景场景" });
    if (result) setMessage(describeLinkResult(result, "VR360 ", { updatedPrefix: "已同步到最近的", createdPrefix: "已创建并送入" }));
  }

  function applyToShot() {
    const result = onApplyToNearestShot?.(node.id, node.data || {});
    if (!result) {
      setMessage("附近没有可回填的镜头表，或没有可匹配的镜头");
      return;
    }
    setMessage(`已回填到镜头 ${result.shotId}`);
  }

  function triggerShotAction(action) {
    const result = onHandleShotAction?.(action, node.id, node.data || {});
    if (!result) {
      setMessage(action === "locate" ? "没有找到可定位的镜头表或镜头" : "当前结果还没有匹配到可处理的镜头");
      return;
    }
    if (action === "locate") {
      setMessage(`已定位到镜头 ${result.shotId || targetShotId || ""}`);
      return;
    }
    const actionLabel = action === "confirm"
      ? "已采用并确认"
      : action === "complete"
        ? "已采用并完成"
        : action === "rework"
          ? "已标记待重做"
          : "已更新";
    setMessage(`${actionLabel} ${result.shotId}`);
  }

  return (
    <>
      <NodeHeader icon={videoUrl ? "vid" : "img"} title={node.data.displayName || (videoUrl ? "结果视频" : "结果图片")} />
      <div className="result-image">
        {videoUrl ? <video src={videoUrl} controls playsInline /> : imageUrl ? <img className="result-image-clickable" src={imagePreviewUrl} alt="" onClick={openLightbox} onError={() => {
          const currentIndex = previewCandidates.indexOf(imagePreviewUrl);
          const nextPreviewUrl = previewCandidates[currentIndex + 1] || "";
          if (nextPreviewUrl && nextPreviewUrl !== imagePreviewUrl) setImagePreviewUrl(nextPreviewUrl);
        }} /> : <span>{node.data.isGenerating ? "生成中..." : "结果占位"}</span>}
      </div>
      <div className="result-meta">
        {videoUrl && <span className="pill">视频结果</span>}
        {imageUrl && <span className="pill">图片结果</span>}
        {!!targetShotId && <span className="pill">镜头 {targetShotId}</span>}
        {!!bindingSummary && <span className="pill">{bindingSummary}</span>}
        {!!providerSummary && <span className="pill">{providerSummary}</span>}
        {!!sourcePrompt && <span className="pill">含源提示词</span>}
        {!!adoptionLabel && <span className={`pill ${adoptionState === "rework" ? "pill-warn" : "pill-ok"}`}>{adoptionLabel}{adoptedShotId ? ` · ${adoptedShotId}` : ""}</span>}
        {node.data.generationError && <span className="pill">有报错记录</span>}
      </div>
      {mediaUrl && (
        <div className="result-actions">
          {(imageUrl || videoUrl) && <button className="primary" onClick={applyToShot}>回填镜头</button>}
          {(imageUrl || videoUrl) && <button onClick={() => triggerShotAction("confirm")}>采用并确认</button>}
          {(imageUrl || videoUrl) && <button onClick={() => triggerShotAction("complete")}>采用并完成</button>}
          {(imageUrl || videoUrl) && <button onClick={() => triggerShotAction("rework")}>标记待重做</button>}
          <button onClick={() => triggerShotAction("locate")}>定位来源镜头</button>
          <button onClick={download}>下载</button>
          {imageUrl && <button onClick={copyImage}>复制图片</button>}
          <button onClick={copyLink}>复制链接</button>
          {imageUrl && <button onClick={sendToUploadNode}>送到上传</button>}
          {imageUrl && <button onClick={sendToSplit}>送入拆分</button>}
          {imageUrl && <button onClick={sendToVrNode}>送到 VR360</button>}
          {imageUrl && <button onClick={() => setShowDiagnostics((value) => !value)}>{showDiagnostics ? "隐藏诊断" : "显示诊断"}</button>}
          {imageUrl && <button onClick={copyDiagnostics}>复制诊断</button>}
          {!!sourcePrompt && <button onClick={copyPrompt}>复制提示词</button>}
          {!!sourcePrompt && <button onClick={exportPromptText}>导出提示词</button>}
        </div>
      )}
      {showDiagnostics && (
        <div className="cf-style-hint">
          <strong>结果诊断</strong>
          <small>当前预览地址：{imagePreviewUrl || "空"}</small>
          <small>主图 URL：{imageUrl || "空"}</small>
          <small>主图路径：{imagePath || "空"}</small>
          <small>原始图 URL：{originalImageUrl || "空"}</small>
          <small>缩略图 URL：{imageThumbnailUrl || "空"}</small>
          <small>缩略图路径：{imageThumbnailPath || "空"}</small>
        </div>
      )}
      <small>{node.data.note || "exportImage"}</small>
      {node.data.generationError && <small className="error-text">{node.data.generationError}</small>}
      {message && <small className="result-message">{message}</small>}
      {lightboxOpen && !videoUrl && typeof document !== "undefined" ? createPortal(
        <div className="result-lightbox-backdrop" onClick={closeLightbox}>
          <div className="result-lightbox-panel" onClick={(event) => event.stopPropagation()}>
            <img
              src={lightboxUrl}
              alt=""
              onError={() => {
                const currentIndex = fullImageCandidates.indexOf(lightboxUrl);
                const nextImageUrl = fullImageCandidates[currentIndex + 1] || "";
                if (nextImageUrl && nextImageUrl !== lightboxUrl) {
                  setLightboxUrl(nextImageUrl);
                  return;
                }
                setMessage("高清大图加载失败");
                closeLightbox();
              }}
            />
            <small>点击空白处或按 Esc 关闭高清预览</small>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
