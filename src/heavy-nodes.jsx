import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { applyGeneratedFallback, applyGeneratedResult, copyTextWithFeedback, createGeneratingResultNode, describeLinkResult, describeShotDraftResult, normalizeNovelPipelineNodeData, normalizeSplitNodeData, normalizeStoryboardNodeData, openPromptPreviewCard, setNodeError, setNodeMessage } from "./node-action-helpers";

export function NovelPipelineNode({ node, updateNode, createOutputNear, onSyncOutputs, textApiSettings, patchTextApiSettings, openSettings, stylePresetCenter, onOpenStylePresetCenter, helpers }) {
  const {
    NodeHeader,
    NOVEL_TEMPLATE_DEFAULT,
    NOVEL_REVIEW_TEMPLATE_DEFAULT,
    NOVEL_REVISION_TEMPLATE_DEFAULT,
    NOVEL_ASSET_TEMPLATE_DEFAULT,
    NOVEL_PROMPT_TEMPLATE_DEFAULT,
    NOVEL_TEMPLATE_PRESETS,
    NOVEL_TASK_MODES,
    NOVEL_API_PROVIDERS,
    NOVEL_API_BODY_TEMPLATE_DEFAULT,
    NOVEL_FACTORY_SCHEMA,
    NOVEL_SCRIPT_SCHEMA,
    NOVEL_PLANNING_SCHEMA,
    NOVEL_REVIEW_SCHEMA,
    NOVEL_REVISION_SCHEMA,
    NOVEL_CHARACTER_ASSET_SCHEMA,
    NOVEL_SCENE_ASSET_SCHEMA,
    NOVEL_PROP_ASSET_SCHEMA,
    CINEFORGE_REVIEW_THRESHOLD,
    STYLE_IMAGE_SYSTEM_OPTIONS,
    buildNovelChatCompletionsUrl,
    normalizeNovelBodyTemplate,
    buildStylePresetSelectOptions,
    findStylePresetByName,
    runNovelFactoryApi,
    parseNovelPlanningOutput,
    parseNovelScriptOutput,
    parseNovelReviewOutput,
    parseNovelRevisionOutput,
    parseNovelAssetSliceOutput,
    parseNovelFactoryOutput,
    buildNovelPipeline,
    buildPipelineFromAssets,
    formatAssetPrompts,
    formatNovelPlanning,
    formatNovelReview,
    buildNovelRevisionInput,
    buildLocalScriptReview,
    makeLocalTaskId,
    buildCineForgeProjectName,
    labelNovelStage,
  } = helpers;
  const state = normalizeNovelPipelineNodeData(node.data, {
    scriptTemplate: NOVEL_TEMPLATE_DEFAULT,
    reviewTemplate: NOVEL_REVIEW_TEMPLATE_DEFAULT,
    assetTemplate: NOVEL_ASSET_TEMPLATE_DEFAULT,
    promptTemplate: NOVEL_PROMPT_TEMPLATE_DEFAULT,
  });
  const novel = state.novel;
  const scriptTemplate = state.scriptTemplate;
  const reviewTemplate = state.reviewTemplate;
  const assetTemplate = state.assetTemplate;
  const promptTemplate = state.promptTemplate;
  const taskMode = state.taskMode;
  const genre = state.genre;
  const stylePreset = state.stylePreset;
  const imageStyle = state.imageStyle;
  const duration = state.duration;
  const audience = state.audience;
  const tone = state.tone;
  const episodes = state.episodes;
  const pipeline = state.pipeline;
  const recentTasks = state.recentTasks;
  const [active, setActive] = useState("script");
  const [message, setMessage] = useState("");
  const [running, setRunning] = useState(false);
  const factoryMode = textApiSettings?.factoryMode || "local";
  const apiProvider = textApiSettings?.apiProvider || "openai";
  const providerPreset = NOVEL_API_PROVIDERS[apiProvider] || NOVEL_API_PROVIDERS.openai;
  const apiBaseUrl = textApiSettings?.apiBaseUrl || providerPreset.baseUrl;
  const apiUrl = textApiSettings?.apiUrl || buildNovelChatCompletionsUrl(apiBaseUrl);
  const apiKey = textApiSettings?.apiKey || "";
  const authType = textApiSettings?.authType || providerPreset.authType || "bearer";
  const apiModel = textApiSettings?.apiModel || providerPreset.model || "gpt-4o-mini";
  const headersJson = textApiSettings?.headersJson || "";
  const configuredBodyTemplate = normalizeNovelBodyTemplate(textApiSettings?.bodyTemplate, providerPreset);
  const bodyTemplate = apiProvider === "modelscopeMinimax" && !/"stream"\s*:\s*true/.test(configuredBodyTemplate)
    ? (providerPreset.bodyTemplate || NOVEL_API_BODY_TEMPLATE_DEFAULT)
    : configuredBodyTemplate;
  const responsePath = textApiSettings?.responsePath || providerPreset.responsePath || "choices.0.message.content";
  const schema = textApiSettings?.schema || NOVEL_FACTORY_SCHEMA;
  const taskStage = pipeline?.stage || "draft";
  const styleOptions = buildStylePresetSelectOptions(stylePresetCenter, stylePreset);
  const activeStylePreset = findStylePresetByName(stylePresetCenter, stylePreset);
  const currentTemplatePresetId = state.templatePresetId;

  function buildRevisionRefreshMeta(planItems = [], currentPipeline = pipeline) {
    const lines = Array.isArray(planItems) ? planItems.map((item) => String(item || "").trim()).filter(Boolean) : [];
    const text = lines.join("\n");
    const assetMention = /资产|人物|角色|场景|道具/.test(text);
    const promptMention = /镜头|提示词|shot|分镜|imagePrompt|videoPrompt|openingFrame|closingFrame/i.test(text);
    const timelineMention = /时间线|timeline|导入时间线|回填时间线/i.test(text);
    return {
      lines,
      text,
      needsAssetRefresh: assetMention || Boolean(currentPipeline?.characterAssets?.length || currentPipeline?.sceneAssets?.length || currentPipeline?.propAssets?.length),
      needsPromptRefresh: promptMention || Boolean(currentPipeline?.shots?.length),
      syncTimeline: timelineMention || Boolean(currentPipeline?.shots?.length),
    };
  }

  function formatRevisedOutput(currentPipeline = pipeline) {
    if (!currentPipeline?.revisedScript) return "选择自动修改后将在这里显示新版剧本。";
    const sections = [currentPipeline.revisedScript];
    if (currentPipeline.fixedIssues?.length) {
      sections.push("", "【本轮已解决】", ...currentPipeline.fixedIssues.map((item, index) => `${index + 1}. ${item}`));
    }
    if (currentPipeline.remainingRisks?.length) {
      sections.push("", "【剩余风险】", ...currentPipeline.remainingRisks.map((item, index) => `${index + 1}. ${item}`));
    }
    if (currentPipeline.assetRefreshPlan?.length) {
      sections.push("", "【建议回刷范围】", ...currentPipeline.assetRefreshPlan.map((item, index) => `${index + 1}. ${item}`));
    }
    return sections.join("\n");
  }

  function patchApiSettings(patch) {
    patchTextApiSettings?.(patch);
  }

  function buildRecentTask(nextPipeline = pipeline) {
    return {
      taskId: nextPipeline?.taskId || makeLocalTaskId(),
      projectName: nextPipeline?.projectName || buildCineForgeProjectName(taskMode, novel || nextPipeline?.script || ""),
      mode: taskMode,
      stage: nextPipeline?.stage || "draft",
      score: nextPipeline?.review?.score || "",
      updatedAt: new Date().toLocaleString(),
      pipeline: nextPipeline,
      novel,
      taskMode,
      genre,
      stylePreset,
      imageStyle,
      duration,
      audience,
      tone,
    };
  }

  function applyStylePresetSelection(nextStylePreset) {
    const preset = findStylePresetByName(stylePresetCenter, nextStylePreset);
    updateNode(node.id, {
      stylePreset: nextStylePreset,
      imageStyle: preset?.imageStyle || imageStyle,
    });
  }

  function pushRecentTask(nextPipeline) {
    const item = buildRecentTask(nextPipeline);
    return [item, ...recentTasks.filter((task) => task.taskId !== item.taskId)].slice(0, 8);
  }

  function saveDraft() {
    const draftPipeline = pipeline || {
      taskId: makeLocalTaskId(),
      projectName: buildCineForgeProjectName(taskMode, novel),
      stage: "draft",
      script: "",
      note: "草稿",
    };
    updateNode(node.id, { pipeline: draftPipeline, recentTasks: pushRecentTask(draftPipeline) });
    setMessage("已保存为 CineForge 草稿任务。");
  }

  function importExistingScript() {
    const body = novel.trim();
    if (!body) {
      alert("请先在左侧粘贴已有剧本");
      return;
    }
    const importedPipeline = {
      ...(pipeline || {}),
      taskId: makeLocalTaskId(),
      projectName: buildCineForgeProjectName("plot", body),
      planning: { projectName: "导入剧本", logline: body.slice(0, 80), characters: [], plotOutline: [], writingBrief: "导入已有剧本，直接进入审稿和资产抽取。" },
      script: body,
      stage: "ready",
      note: "导入已有剧本",
    };
    updateNode(node.id, { pipeline: importedPipeline, recentTasks: pushRecentTask(importedPipeline) });
    setActive("script");
    setMessage("已导入已有剧本，可直接审稿或抽取资产。");
  }

  function loadRecentTask(task) {
    updateNode(node.id, {
      pipeline: task.pipeline,
      novel: task.novel || "",
      taskMode: task.taskMode || task.mode || "plot",
      genre: task.genre || genre,
      stylePreset: task.stylePreset || stylePreset,
      imageStyle: task.imageStyle || imageStyle,
      duration: task.duration || duration,
      audience: task.audience || audience,
      tone: task.tone || tone,
    });
    setActive("script");
    setMessage(`已载入任务：${task.projectName}`);
  }

  function applyCineForgeTemplates() {
    updateNode(node.id, {
      templatePresetId: "",
      scriptTemplate: NOVEL_TEMPLATE_DEFAULT,
      template: NOVEL_TEMPLATE_DEFAULT,
      reviewTemplate: NOVEL_REVIEW_TEMPLATE_DEFAULT,
      assetTemplate: NOVEL_ASSET_TEMPLATE_DEFAULT,
      promptTemplate: NOVEL_PROMPT_TEMPLATE_DEFAULT,
    });
    setMessage("已应用 CineForge 内置模板。");
  }

  function applyTemplatePreset(presetId) {
    const preset = (NOVEL_TEMPLATE_PRESETS || []).find((item) => item.id === presetId);
    if (!preset) return;
    updateNode(node.id, {
      templatePresetId: preset.id,
      genre: preset.genre || genre,
      imageStyle: preset.imageStyle || imageStyle,
      scriptTemplate: preset.scriptTemplate,
      template: preset.scriptTemplate,
      reviewTemplate: preset.reviewTemplate,
      assetTemplate: preset.assetTemplate,
      promptTemplate: preset.promptTemplate,
    });
    setMessage(`已应用题材预设：${preset.name}`);
  }

  async function testApi() {
    setRunning(true);
    setMessage("正在测试小说工厂 API...");
    try {
      await runNovelFactoryApi({
        apiUrl,
        apiBaseUrl,
        apiProvider,
        apiKey,
        authType,
        headersJson,
        model: apiModel,
        bodyTemplate,
        responsePath,
        novel: "主角拿起一枚旧钥匙，走进雨夜里的废弃车站。",
        input: "主角拿起一枚旧钥匙，走进雨夜里的废弃车站。",
        template: scriptTemplate,
        schema: NOVEL_SCRIPT_SCHEMA,
      });
      setMessage(`测试成功：${apiProvider === "bailian" ? "阿里百炼" : providerPreset.label} 可以正常返回。`);
    } catch (error) {
      setMessage(`测试失败：${error.message || String(error)}`);
    } finally {
      setRunning(false);
    }
  }

  function apiConfigForStep(input, templateValue, schemaValue) {
    return {
      apiUrl,
      apiBaseUrl,
      apiProvider,
      apiKey,
      authType,
      headersJson,
      model: apiModel,
      bodyTemplate,
      responsePath,
      novel: input,
      input,
      template: templateValue,
      schema: schemaValue,
    };
  }

  function buildTaskPayload(sourceText = novel) {
    return JSON.stringify({
      mode: taskMode,
      modeLabel: NOVEL_TASK_MODES[taskMode],
      duration,
      genre,
      stylePreset,
      imageStyle,
      audience,
      tone,
      episodes,
      inputSummary: sourceText,
    }, null, 2);
  }

  async function callFactoryStep(input, templateValue, schemaValue, parser) {
    if (factoryMode === "api") {
      const result = await runNovelFactoryApi(apiConfigForStep(input, templateValue, schemaValue), parser);
      return result;
    }
    return null;
  }

  async function generateScript(baseNovel = novel, basePipeline = pipeline) {
    const resolvedNovel = baseNovel && typeof baseNovel === "object" && "target" in baseNovel ? novel : baseNovel;
    const resolvedPipeline = basePipeline && typeof basePipeline === "object" && "target" in basePipeline ? pipeline : basePipeline;
    if (!String(resolvedNovel || "").trim()) {
      alert("请先粘贴小说内容");
      return null;
    }
    setRunning(true);
    setMessage(factoryMode === "api" ? "正在规划剧本..." : "正在按本地规则转剧本...");
    try {
      let planning = null;
      let scriptResult;
      if (factoryMode === "api") {
        planning = await callFactoryStep(buildTaskPayload(resolvedNovel), `${scriptTemplate}\n\n先做 CineForge 式剧本 planning，只输出规划。`, NOVEL_PLANNING_SCHEMA, parseNovelPlanningOutput);
        setMessage("规划完成，正在写完整剧本...");
        const writingInput = [
          "剧本规划：",
          JSON.stringify(planning.plan || planning, null, 2),
          "",
          "原始输入：",
          buildTaskPayload(resolvedNovel),
        ].join("\n");
        scriptResult = await callFactoryStep(writingInput, scriptTemplate, NOVEL_SCRIPT_SCHEMA, parseNovelScriptOutput);
      } else {
        scriptResult = { script: buildNovelPipeline(resolvedNovel, scriptTemplate).script, note: "本地规则" };
      }
      const nextPipeline = {
        ...(resolvedPipeline || {}),
        taskId: resolvedPipeline?.taskId || makeLocalTaskId(),
        projectName: planning?.plan?.projectName || buildCineForgeProjectName(taskMode, resolvedNovel),
        planning: planning?.plan || null,
        script: scriptResult.script,
        reviewedScript: "",
        review: null,
        revisedScript: "",
        changeLog: [],
        stage: "ready",
        note: scriptResult.note || (factoryMode === "api" ? "小说工厂 API" : "本地规则"),
      };
      updateNode(node.id, { pipeline: nextPipeline, lastFactoryNote: nextPipeline.note, recentTasks: pushRecentTask(nextPipeline) });
      setActive("script");
      setMessage(`剧本已生成：${nextPipeline.note}`);
      return nextPipeline;
    } catch (error) {
      setMessage(`转剧本失败：${error.message}`);
      return null;
    } finally {
      setRunning(false);
    }
  }

  async function reviewScript(basePipeline = pipeline) {
    const resolvedPipeline = basePipeline && typeof basePipeline === "object" && "target" in basePipeline ? pipeline : basePipeline;
    const sourceScript = resolvedPipeline?.revisedScript || resolvedPipeline?.script || "";
    if (!sourceScript.trim()) {
      alert("请先生成剧本");
      return null;
    }
    setRunning(true);
    setMessage(factoryMode === "api" ? "正在调用 API 评价..." : "正在本地评价...");
    try {
      const review = factoryMode === "api"
        ? await callFactoryStep(sourceScript, reviewTemplate, NOVEL_REVIEW_SCHEMA, parseNovelReviewOutput)
        : buildLocalScriptReview(sourceScript);
      const status = Number(review.score || 0) >= CINEFORGE_REVIEW_THRESHOLD ? "passed" : "failed";
      const reviewedPipeline = { ...(resolvedPipeline || {}), review: { ...review, status }, reviewedScript: sourceScript, stage: status === "passed" ? "reviewed_passed" : "reviewed_failed" };
      updateNode(node.id, { pipeline: reviewedPipeline, recentTasks: pushRecentTask(reviewedPipeline) });
      setActive("review");
      setMessage(`评价完成：${status === "passed" ? "通过" : "需优化"}`);
      return reviewedPipeline;
    } catch (error) {
      setMessage(`评价失败：${error.message}`);
      return null;
    } finally {
      setRunning(false);
    }
  }

  async function reviseScript(basePipeline = pipeline) {
    const resolvedPipeline = basePipeline && typeof basePipeline === "object" && "target" in basePipeline ? pipeline : basePipeline;
    const sourceScript = resolvedPipeline?.reviewedScript || resolvedPipeline?.script || "";
    const review = resolvedPipeline?.review || null;
    if (!sourceScript.trim() || !review) {
      alert("请先完成评价");
      return null;
    }
    setRunning(true);
    setMessage(factoryMode === "api" ? "正在按修改意见自动修订..." : "正在本地整理修改意见...");
    try {
      const reviewText = formatNovelReview(review);
      const input = buildNovelRevisionInput(sourceScript, review);
      const revision = factoryMode === "api"
        ? await callFactoryStep(input, NOVEL_REVISION_TEMPLATE_DEFAULT, NOVEL_REVISION_SCHEMA, parseNovelRevisionOutput)
        : { revisedScript: `${sourceScript}\n\n【修改意见】\n${reviewText}`, changeLog: ["已附加评价意见，建议接入 API 自动改写。"], note: "本地规则" };
      const revisedPipeline = {
        ...(resolvedPipeline || {}),
        revisedScript: revision.revisedScript,
        changeLog: revision.changeLog || [],
        fixedIssues: revision.fixedIssues || [],
        remainingRisks: revision.remainingRisks || [],
        assetRefreshPlan: revision.assetRefreshPlan || [],
        characterAssets: [],
        sceneAssets: [],
        propAssets: [],
        characterPrompts: "",
        scenePrompts: "",
        propPrompts: "",
        videoPrompts: "",
        finalPrompts: "",
        shots: [],
        raw: "",
        stage: "ready",
        note: revision.note || resolvedPipeline?.note,
      };
      updateNode(node.id, { pipeline: revisedPipeline, recentTasks: pushRecentTask(revisedPipeline) });
      setActive("revised");
      setMessage("已按修改意见生成新版剧本，旧资产与镜头提示词已标记失效，等待重新提取");
      return revisedPipeline;
    } catch (error) {
      setMessage(`自动修改失败：${error.message}`);
      return null;
    } finally {
      setRunning(false);
    }
  }

  async function runAssetExtraction(basePipeline = pipeline, options = {}) {
    const finalScript = basePipeline?.revisedScript || basePipeline?.script || "";
    if (!finalScript.trim()) {
      alert("请先生成或修改剧本");
      return null;
    }
    setRunning(true);
    setMessage(factoryMode === "api" ? "正在抽取人物资产 1/3..." : "正在按本地规则提取资产...");
    try {
      let assetPipeline;
      if (factoryMode === "api") {
        const assetInput = JSON.stringify({ imageStyle, styleReference: "如用户未上传参考图，则按 imageStyle 锁定整体风格。", scriptBody: finalScript }, null, 2);
        const charactersResult = await callFactoryStep(assetInput, `${assetTemplate}\n\n当前只抽取人物资产。必须输出角色资产卡和三套引擎提示词。`, NOVEL_CHARACTER_ASSET_SCHEMA, parseNovelAssetSliceOutput);
        setMessage("人物完成，正在抽取场景资产 2/3...");
        updateNode(node.id, { pipeline: { ...(basePipeline || {}), characterAssets: charactersResult.characterAssets, characterPrompts: formatAssetPrompts(charactersResult.characterAssets), assetProgress: { step: "character", stepIndex: 1, totalSteps: 3 } } });
        const scenesResult = await callFactoryStep(assetInput, `${assetTemplate}\n\n当前只抽取场景资产。必须输出场景资产卡和三套引擎提示词。`, NOVEL_SCENE_ASSET_SCHEMA, parseNovelAssetSliceOutput);
        setMessage("场景完成，正在抽取道具资产 3/3...");
        updateNode(node.id, { pipeline: { ...(basePipeline || {}), characterAssets: charactersResult.characterAssets, sceneAssets: scenesResult.sceneAssets, characterPrompts: formatAssetPrompts(charactersResult.characterAssets), scenePrompts: formatAssetPrompts(scenesResult.sceneAssets), assetProgress: { step: "scene", stepIndex: 2, totalSteps: 3 } } });
        const propsResult = await callFactoryStep(assetInput, `${assetTemplate}\n\n当前只抽取道具资产。必须输出道具资产卡和三套引擎提示词。`, NOVEL_PROP_ASSET_SCHEMA, parseNovelAssetSliceOutput);
        assetPipeline = buildPipelineFromAssets(finalScript, charactersResult.characterAssets, scenesResult.sceneAssets, propsResult.propAssets, basePipeline?.note || "CineForge 资产抽取");
      } else {
        assetPipeline = buildNovelPipeline(finalScript, assetTemplate);
      }
      const nextPipeline = {
        ...(basePipeline || {}),
        ...assetPipeline,
        script: basePipeline?.script || assetPipeline.script || finalScript,
        revisedScript: basePipeline?.revisedScript || "",
        review: basePipeline?.review || null,
        reviewedScript: basePipeline?.reviewedScript || "",
        changeLog: basePipeline?.changeLog || [],
        finalScript,
        stage: "assets_ready",
        assetProgress: { step: "prop", stepIndex: 3, totalSteps: 3 },
        note: assetPipeline.note || basePipeline?.note || (factoryMode === "api" ? "小说工厂 API" : "本地规则"),
      };
      updateNode(node.id, { pipeline: nextPipeline, lastFactoryNote: nextPipeline.note, recentTasks: pushRecentTask(nextPipeline) });
      if (options.syncOutputs) onSyncOutputs?.(node.id, nextPipeline, { syncTimeline: false });
      setActive("final");
      setMessage("资产和提示词已提取，可输出到全局资产库");
      return nextPipeline;
    } catch (error) {
      setMessage(`资产提取失败：${error.message}`);
      return null;
    } finally {
      setRunning(false);
    }
  }

  async function extractAssets(basePipeline = pipeline, options = {}) {
    const resolvedPipeline = basePipeline && typeof basePipeline === "object" && "target" in basePipeline ? pipeline : basePipeline;
    const resolvedOptions = options && typeof options === "object" && "target" in options ? {} : options;
    return runAssetExtraction(resolvedPipeline, resolvedOptions);
  }

  async function runPromptGeneration(basePipeline = pipeline, options = {}) {
    const finalScript = basePipeline?.finalScript || basePipeline?.revisedScript || basePipeline?.script || "";
    const characters = basePipeline?.characterAssets || [];
    const scenes = basePipeline?.sceneAssets || [];
    const props = basePipeline?.propAssets || [];
    if (!finalScript.trim()) {
      alert("请先生成剧本");
      return null;
    }
    if (!characters.length && !scenes.length && !props.length) {
      alert("请先抽取资产");
      return null;
    }
    setRunning(true);
    setMessage(factoryMode === "api" ? "正在按 CineForge 模式生成镜头提示词..." : "正在本地生成镜头提示词...");
    try {
      const input = JSON.stringify({
        scriptBody: finalScript,
        assets: { characters, scenes, props },
        duration,
        taskMode,
        imageStyle,
      }, null, 2);
      const promptPipeline = factoryMode === "api"
        ? await callFactoryStep(input, promptTemplate, NOVEL_FACTORY_SCHEMA, parseNovelFactoryOutput)
        : buildNovelPipeline(finalScript, promptTemplate);
      const nextPipeline = {
        ...(basePipeline || {}),
        ...promptPipeline,
        script: basePipeline?.script || promptPipeline.script || finalScript,
        revisedScript: basePipeline?.revisedScript || "",
        review: basePipeline?.review || null,
        characterAssets: characters,
        sceneAssets: scenes,
        propAssets: props,
        characterPrompts: formatAssetPrompts(characters),
        scenePrompts: formatAssetPrompts(scenes),
        propPrompts: formatAssetPrompts(props),
        finalScript,
        stage: "prompts_ready",
        note: promptPipeline.note || basePipeline?.note || "CineForge 提示词生成",
      };
      updateNode(node.id, { pipeline: nextPipeline, lastFactoryNote: nextPipeline.note, recentTasks: pushRecentTask(nextPipeline) });
      if (options.syncOutputs) {
        onSyncOutputs?.(node.id, nextPipeline, {
          syncTimeline: options.syncTimeline,
          autoQueueShots: options.autoQueueShots,
          autoRunQueue: options.autoRunQueue,
        });
      }
      setActive("final");
      setMessage("提示词已生成，可输出到资产库和镜头表");
      return nextPipeline;
    } catch (error) {
      setMessage(`提示词生成失败：${error.message}`);
      return null;
    } finally {
      setRunning(false);
    }
  }

  async function generatePrompts(basePipeline = pipeline, options = {}) {
    const resolvedPipeline = basePipeline && typeof basePipeline === "object" && "target" in basePipeline ? pipeline : basePipeline;
    const resolvedOptions = options && typeof options === "object" && "target" in options ? {} : options;
    return runPromptGeneration(resolvedPipeline, resolvedOptions);
  }

  async function autoAdvancePipeline() {
    if (!novel.trim()) {
      alert("请先粘贴小说内容");
      return;
    }
    let workingPipeline = pipeline;
    if (!workingPipeline?.script) {
      workingPipeline = await generateScript(novel, workingPipeline);
      if (!workingPipeline) return;
    }
    if (!workingPipeline?.review) {
      workingPipeline = await reviewScript(workingPipeline);
      if (!workingPipeline) return;
    }
    if (workingPipeline?.review?.status === "failed" && !workingPipeline?.revisedScript) {
      workingPipeline = await reviseScript(workingPipeline);
      if (!workingPipeline) return;
      const reratedPipeline = await reviewScript(workingPipeline);
      if (reratedPipeline) workingPipeline = reratedPipeline;
    }
    if (!(workingPipeline?.characterAssets?.length || workingPipeline?.sceneAssets?.length || workingPipeline?.propAssets?.length)) {
      workingPipeline = await extractAssets(workingPipeline, { syncOutputs: true });
      if (!workingPipeline) return;
    }
    let syncedDuringPromptGeneration = false;
    if (!hasPromptOutputs(workingPipeline)) {
      workingPipeline = await generatePrompts(workingPipeline, { syncOutputs: true, syncTimeline: true });
      if (!workingPipeline) return;
      syncedDuringPromptGeneration = true;
    }
    if (!syncedDuringPromptGeneration) {
      onSyncOutputs?.(node.id, workingPipeline, { syncTimeline: true });
    }
    setActive("final");
    setMessage(`已自动完成前期链路：剧本${workingPipeline?.review ? "、审稿" : ""}、资产、提示词已就位，并同步到资产库和镜头表，未自动生成图片`);
  }

  async function refreshFromRevisionPlan() {
    const refreshMeta = buildRevisionRefreshMeta(pipeline?.assetRefreshPlan || [], pipeline);
    const sourcePipeline = pipeline || {};
    const shouldRefreshAssets = refreshMeta.needsAssetRefresh || !sourcePipeline.characterAssets?.length || !sourcePipeline.sceneAssets?.length || !sourcePipeline.propAssets?.length;
    const shouldRefreshPrompts = refreshMeta.needsPromptRefresh || Boolean(sourcePipeline.shots?.length);
    let workingPipeline = sourcePipeline;
    if (shouldRefreshAssets) {
      const refreshedAssets = await runAssetExtraction(workingPipeline, { syncOutputs: true });
      if (!refreshedAssets) return;
      workingPipeline = refreshedAssets;
    }
    if (shouldRefreshPrompts) {
      const refreshedPrompts = await runPromptGeneration(workingPipeline, { syncOutputs: true, syncTimeline: refreshMeta.syncTimeline });
      if (!refreshedPrompts) return;
      workingPipeline = refreshedPrompts;
    } else if (shouldRefreshAssets) {
      onSyncOutputs?.(node.id, workingPipeline, { syncTimeline: false });
    }
    setMessage(`已按修订计划回刷${shouldRefreshAssets ? "资产" : ""}${shouldRefreshAssets && shouldRefreshPrompts ? "、" : ""}${shouldRefreshPrompts ? "镜头提示词" : ""}${refreshMeta.syncTimeline && shouldRefreshPrompts ? "与时间线" : ""}`);
  }

  async function rollbackPipeline() {
    if (!pipeline?.review && !pipeline?.revisedScript) {
      setMessage("当前还没有可回退修改的审稿结果，先点“下一步”推进到审稿或修改阶段");
      return;
    }
    if (pipeline?.review && !pipeline?.revisedScript) {
      const revised = await reviseScript(pipeline);
      if (!revised) return;
      await refreshFromRevisionPlan();
      return;
    }
    await refreshFromRevisionPlan();
  }

  function exportTextNodes() {
    if (!pipeline) return;
    onSyncOutputs?.(node.id, pipeline, { syncTimeline: true });
    createOutputNear(node.id, "text", "AI视频提示词", {
      displayName: "AI视频提示词",
      text: pipeline.videoPrompts || "",
      width: 420,
      height: 260,
      outputRole: "video-prompts",
      __offsetX: 820,
      __offsetY: 0,
    });
    setMessage("已输出资产库、镜头表和 AI 视频提示词，未自动生成图片");
  }

  function hasPromptOutputs(currentPipeline = pipeline) {
    return Boolean((currentPipeline?.shots || []).length || String(currentPipeline?.videoPrompts || "").trim());
  }

  const tabs = [
    ["plan", "规划"],
    ["script", "剧本"],
    ["review", "评价"],
    ["revised", "修改后"],
    ["characters", "人物"],
    ["scenes", "场景"],
    ["props", "道具"],
    ["video", "视频"],
    ["final", "最终"],
  ];
  const outputText = (pipeline ? {
    plan: pipeline.planning ? formatNovelPlanning(pipeline.planning) : "规划完成后将在这里显示。",
    script: pipeline.script,
    review: pipeline.review ? formatNovelReview(pipeline.review) : "评价后将在这里显示质检结论和修改意见。",
    revised: formatRevisedOutput(pipeline),
    characters: pipeline.characterPrompts,
    scenes: pipeline.scenePrompts,
    props: pipeline.propPrompts,
    video: pipeline.videoPrompts,
    final: pipeline.finalPrompts,
  }[active] : "生成后将在这里显示结构化产物。") || "当前步骤还没有输出。";
  const stageCards = [
    { key: "script", number: 1, title: "剧本生成", desc: "Planning 后写作完整剧本", status: pipeline?.script ? "done" : "idle", action: generateScript, disabled: running || !novel.trim(), label: pipeline?.script ? "重新生成" : "开始生成" },
    { key: "review", number: 2, title: "剧本评价", desc: "生产闸口与交接 brief", status: pipeline?.review ? (pipeline.review.status === "passed" ? "pass" : "fail") : "idle", action: reviewScript, disabled: running || !pipeline?.script, label: "运行评价" },
    { key: "assets", number: 3, title: "资产抽取", desc: "人物、场景、道具三段提取", status: pipeline?.characterAssets?.length || pipeline?.sceneAssets?.length || pipeline?.propAssets?.length ? "done" : "idle", action: extractAssets, disabled: running || !(pipeline?.script || pipeline?.revisedScript), label: "提取资产" },
    { key: "prompts", number: 4, title: "提示词生成", desc: "镜头图片与 AI 视频提示词", status: hasPromptOutputs(pipeline) ? "done" : "idle", action: generatePrompts, disabled: running || !pipeline?.characterAssets?.length, label: "生成提示词" },
  ];
  const assetCounts = {
    characters: pipeline?.characterAssets?.length || 0,
    scenes: pipeline?.sceneAssets?.length || 0,
    props: pipeline?.propAssets?.length || 0,
    shots: pipeline?.shots?.length || 0,
  };
  const revisionRefreshMeta = buildRevisionRefreshMeta(pipeline?.assetRefreshPlan || [], pipeline);
  const factoryTaskHint = !pipeline?.script
    ? "先把小说内容转成可生产剧本，后面的评价、修订、资产提取才有基础。"
    : !pipeline?.review
      ? "剧本已经出来了，下一步优先跑评价，让系统给出可执行修改意见。"
      : pipeline?.review?.status === "failed" && !pipeline?.revisedScript
        ? "当前评价还没通过，先按审稿意见自动修订，再决定是否回刷资产和镜头。"
        : !assetCounts.characters && !assetCounts.scenes && !assetCounts.props
          ? "修订版已经有了，继续做资产提取，把角色、场景、道具锁下来。"
          : !hasPromptOutputs(pipeline)
            ? "资产已经就位，继续把镜头图像 / 视频提示词跑出来。"
            : "当前这一轮已经形成完整产物，可以自动同步到资产库和镜头表，再继续下游生产。";
  const nextActionMeta = !pipeline?.script
    ? { label: "下一步", hint: "生成剧本", action: generateScript, disabled: running || !novel.trim() }
    : !pipeline?.review
      ? { label: "下一步", hint: "运行审稿", action: reviewScript, disabled: running || !pipeline?.script }
      : pipeline?.review?.status === "failed" && !pipeline?.revisedScript
        ? { label: "下一步", hint: "按意见修改", action: reviseScript, disabled: running || !pipeline?.review }
        : !assetCounts.characters && !assetCounts.scenes && !assetCounts.props
          ? { label: "下一步", hint: "提取资产", action: extractAssets, disabled: running || !(pipeline?.script || pipeline?.revisedScript) }
          : !hasPromptOutputs(pipeline)
            ? {
              label: "下一步",
              hint: "生成提示词",
              action: () => generatePrompts(pipeline, { syncOutputs: true, syncTimeline: true }),
              disabled: running || !pipeline?.characterAssets?.length,
            }
            : { label: "下一步", hint: "输出资产和镜头表", action: exportTextNodes, disabled: !pipeline };
  const rollbackActionMeta = pipeline?.review || pipeline?.revisedScript
    ? {
      label: "回退修改",
      hint: pipeline?.revisedScript ? "回刷资产与提示词" : "按审稿意见重写",
      action: rollbackPipeline,
      disabled: running,
    }
    : {
      label: "回退修改",
      hint: "先完成审稿",
      action: rollbackPipeline,
      disabled: true,
    };

  async function copyActiveOutput() {
    await copyTextWithFeedback({
      text: outputText || "",
      setMessage,
      successMessage: `已复制${tabs.find(([key]) => key === active)?.[1] || "当前"}内容`,
    });
  }

  function exportActiveOutput() {
    createOutputNear(node.id, "text", `小说工厂-${tabs.find(([key]) => key === active)?.[1] || "输出"}`, {
      displayName: `小说工厂-${tabs.find(([key]) => key === active)?.[1] || "输出"}`,
      text: outputText || "",
      width: 520,
      height: 320,
    });
    setMessage("已将当前页输出到画布");
  }

  return (
    <>
      <NodeHeader icon="np" title="CineForge 小说转剧本工厂" />
      <div className="cf-dashboard">
        <aside className="cf-sidebar">
          <div className="cf-brand">
            <strong>{pipeline?.projectName || "新项目"}</strong>
            <span>{NOVEL_TASK_MODES[taskMode]} · {labelNovelStage(taskStage)}</span>
          </div>
          <textarea className="cf-seed" value={novel} placeholder="输入剧情梗概、小说片段，或粘贴已有剧本" onChange={(event) => updateNode(node.id, { novel: event.target.value })} />
          <div className="cf-mode-tabs">
            {Object.entries(NOVEL_TASK_MODES).map(([key, label]) => (
              <button key={key} className={taskMode === key ? "active" : ""} onClick={() => updateNode(node.id, { taskMode: key })}>{label}</button>
            ))}
          </div>
          <div className="cf-fields">
            <label>类型<input value={genre} onChange={(event) => updateNode(node.id, { genre: event.target.value })} /></label>
            <label>风格<select value={stylePreset} onChange={(event) => applyStylePresetSelection(event.target.value)}>
              {styleOptions.map((item) => <option key={item}>{item}</option>)}
            </select></label>
            <label>图像风格<select value={imageStyle} onChange={(event) => updateNode(node.id, { imageStyle: event.target.value })}>
              {STYLE_IMAGE_SYSTEM_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select></label>
            <label>时长<input value={duration} onChange={(event) => updateNode(node.id, { duration: event.target.value })} /></label>
            <label>受众<input value={audience} onChange={(event) => updateNode(node.id, { audience: event.target.value })} /></label>
            <label>语气<input value={tone} onChange={(event) => updateNode(node.id, { tone: event.target.value })} /></label>
          </div>
          {activeStylePreset && (
            <div className="cf-style-hint">
              <strong>{activeStylePreset.name}</strong>
              <span>{activeStylePreset.stylePrompt}</span>
              <small>图像体系：{activeStylePreset.imageStyle} · 推荐模型：{activeStylePreset.defaultModelPreset}</small>
            </div>
          )}
          <div className="cf-sidebar-actions">
            <button onClick={saveDraft}>保存草稿</button>
            <button onClick={importExistingScript}>导入已有剧本</button>
            <button onClick={onOpenStylePresetCenter}>管理风格预设</button>
          </div>
          <div className="cf-recent">
            <strong>最近任务</strong>
            {recentTasks.length ? recentTasks.map((task) => (
              <button key={task.taskId} onClick={() => loadRecentTask(task)}>
                <span>{task.projectName}</span>
                <small>{labelNovelStage(task.stage)} {task.score ? ` · ${task.score}分` : ""}</small>
              </button>
            )) : <p>暂无历史任务</p>}
          </div>
        </aside>
        <main className="cf-main">
          <div className="cf-topbar">
            <div>
              <span>实现从小说到漫剧资产流线化产出</span>
              <strong>{pipeline?.projectName || buildCineForgeProjectName(taskMode, novel)}</strong>
            </div>
            <div className="cf-api-actions">
              <button className={factoryMode === "local" ? "active" : ""} onClick={() => patchApiSettings({ factoryMode: "local" })}>本地</button>
              <button className={factoryMode === "api" ? "active" : ""} onClick={() => patchApiSettings({ factoryMode: "api" })}>API</button>
              <button onClick={openSettings}>API设置</button>
            </div>
          </div>
          <section className="panel-action-strip node-action-strip">
            <div className="panel-action-strip-copy">
              <strong>当前任务</strong>
              <span>{pipeline?.projectName || buildCineForgeProjectName(taskMode, novel)}</span>
              <p>{factoryTaskHint}</p>
            </div>
            <div className="panel-action-strip-actions">
              <button className="primary" disabled={nextActionMeta.disabled} onClick={nextActionMeta.action}>{running ? "处理中..." : `${nextActionMeta.label} · ${nextActionMeta.hint}`}</button>
              <button disabled={rollbackActionMeta.disabled} onClick={rollbackActionMeta.action}>{rollbackActionMeta.label}{rollbackActionMeta.hint ? ` · ${rollbackActionMeta.hint}` : ""}</button>
              <button className="primary" disabled={running || !novel.trim()} onClick={autoAdvancePipeline}>自动跑完整前期</button>
              <button disabled={running || !pipeline?.review} onClick={reviseScript}>按审稿意见重写</button>
              <button disabled={running || !(pipeline?.script || pipeline?.revisedScript)} onClick={extractAssets}>提取资产</button>
              <button disabled={running || !pipeline?.characterAssets?.length} onClick={generatePrompts}>生成提示词</button>
            </div>
          </section>
          <div className="novel-task-summary">
            <span>{NOVEL_TASK_MODES[taskMode]}</span>
            <span>{genre}</span>
            <span>{imageStyle}</span>
            <span>{duration}</span>
            <span>{labelNovelStage(taskStage)}</span>
            {pipeline?.assetProgress && <span>资产进度 {pipeline.assetProgress.stepIndex}/{pipeline.assetProgress.totalSteps}</span>}
          </div>
          <div className="cf-stage-grid">
            {stageCards.map((stage) => (
              <section key={stage.key} className={`cf-stage-card cf-stage-card--${stage.status}`}>
                <span className="cf-stage-card__num">{stage.number}</span>
                <div>
                  <strong>{stage.title}</strong>
                  <p>{stage.desc}</p>
                </div>
                <div className="cf-stage-card__actions">
                  <button type="button" onClick={() => setActive(stage.key === "assets" ? "characters" : stage.key)}>{stage.key === "assets" ? "查看资产" : "查看输出"}</button>
                  <button disabled={stage.disabled} onClick={stage.action}>{running ? "处理中..." : stage.label}</button>
                </div>
              </section>
            ))}
          </div>
          <div className="cf-result-panel">
            <div className="novel-tabs">
              {tabs.map(([key, label]) => <button key={key} className={active === key ? "active" : ""} onClick={() => setActive(key)}>{label}</button>)}
            </div>
            <div className="novel-actions">
              <button className="primary" disabled={nextActionMeta.disabled} onClick={nextActionMeta.action}>{nextActionMeta.label}{nextActionMeta.hint ? ` · ${nextActionMeta.hint}` : ""}</button>
              <button disabled={rollbackActionMeta.disabled} onClick={rollbackActionMeta.action}>{rollbackActionMeta.label}{rollbackActionMeta.hint ? ` · ${rollbackActionMeta.hint}` : ""}</button>
              <button disabled={running || !novel.trim()} onClick={autoAdvancePipeline}>自动推进</button>
              <button onClick={copyActiveOutput}>复制当前页</button>
              <button onClick={exportActiveOutput}>导出当前页</button>
            </div>
            <textarea className="novel-output" readOnly value={outputText} />
          </div>
        </main>
        <aside className="cf-inspector">
          <div className="cf-score-card">
            <span>剧本审查</span>
            <strong>{pipeline?.review?.score || "--"}</strong>
            <small>{pipeline?.review?.status === "passed" ? "审核通过" : pipeline?.review ? "建议回退优化" : `通过线 ${CINEFORGE_REVIEW_THRESHOLD}`}</small>
          </div>
          <div className="cf-asset-stats">
            <div><strong>{assetCounts.characters}</strong><span>人物</span></div>
            <div><strong>{assetCounts.scenes}</strong><span>场景</span></div>
            <div><strong>{assetCounts.props}</strong><span>道具</span></div>
            <div><strong>{assetCounts.shots}</strong><span>镜头</span></div>
          </div>
          <div className="cf-export-actions">
            <button disabled={running || !pipeline?.review} onClick={reviseScript}>按审稿意见重写</button>
            <button disabled={running || !pipeline?.revisedScript} onClick={refreshFromRevisionPlan}>按修订计划刷新</button>
            <button disabled={!pipeline} onClick={exportTextNodes}>同步到画布</button>
            <button disabled={running || factoryMode !== "api"} onClick={testApi}>测试连接</button>
          </div>
          {pipeline?.assetRefreshPlan?.length ? (
            <div className="cf-style-hint">
              <strong>修订回刷计划</strong>
              <span>{pipeline.assetRefreshPlan.join("；")}</span>
              <small>
                {revisionRefreshMeta.needsAssetRefresh ? "将刷新资产" : "资产无需回刷"} · {revisionRefreshMeta.needsPromptRefresh ? "将刷新镜头提示词" : "镜头提示词无需回刷"} · {revisionRefreshMeta.syncTimeline ? "将同步时间线" : "时间线保持当前"}
              </small>
            </div>
          ) : null}
          {message && <small className="result-message">{message}</small>}
        </aside>
      </div>
      <details className="cf-template-drawer">
        <summary>模板编辑</summary>
        <div className="quick-actions">
          <button type="button" onClick={applyCineForgeTemplates}>应用 CineForge 内置模板</button>
        </div>
        <div className="quick-actions">
          <select value={currentTemplatePresetId} onChange={(event) => applyTemplatePreset(event.target.value)}>
            <option value="">选择题材预设模板包</option>
            {(NOVEL_TEMPLATE_PRESETS || []).map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
          </select>
          <button type="button" disabled={!currentTemplatePresetId} onClick={() => applyTemplatePreset(currentTemplatePresetId)}>重新应用当前题材预设</button>
        </div>
        <div className="novel-grid">
          <label>转剧本模板<textarea value={scriptTemplate} onChange={(event) => updateNode(node.id, { scriptTemplate: event.target.value, template: event.target.value })} /></label>
          <label>评价模板<textarea value={reviewTemplate} onChange={(event) => updateNode(node.id, { reviewTemplate: event.target.value })} /></label>
          <label>资产提取模板<textarea value={assetTemplate} onChange={(event) => updateNode(node.id, { assetTemplate: event.target.value })} /></label>
          <label>提示词模板<textarea value={promptTemplate} onChange={(event) => updateNode(node.id, { promptTemplate: event.target.value })} /></label>
        </div>
      </details>
    </>
  );
}

export function StoryboardNode({ node, updateNode, createOutputNear, settings, assetIndex, openPromptPreview, helpers }) {
  const { NodeHeader, Counter, preparePromptForNode, buildStoryboardPrompt, runImageGeneration, providerLabel, makeStoryboardImage } = helpers;
  const state = normalizeStoryboardNodeData(node.data);
  const rows = state.rows;
  const cols = state.cols;
  const frames = state.frames;
  const filledCount = frames.filter((frame) => String(frame || "").trim()).length;
  function setGrid(nextRows, nextCols) {
    const count = nextRows * nextCols;
    updateNode(node.id, { rows: nextRows, cols: nextCols, frames: Array.from({ length: count }, (_, index) => frames[index] || "") });
  }
  function fillPreset(mode) {
    const count = rows * cols;
    let next = frames.slice(0, count);
    if (mode === "clear") next = Array.from({ length: count }, () => "");
    if (mode === "numbered") next = Array.from({ length: count }, (_, index) => next[index] || `镜头 ${index + 1}：主体、动作、景别、气氛`);
    if (mode === "cloneFirst") next = Array.from({ length: count }, (_, index) => (index === 0 ? next[0] || "" : next[0] || ""));
    updateNode(node.id, { frames: next });
  }
  async function copyPrompt() {
    const { expandedPrompt: prompt } = preparePromptForNode(buildStoryboardPrompt({ rows, cols, frames }), assetIndex, settings, {
      tool: "image",
      kind: "image",
    });
    await copyTextWithFeedback({ text: prompt });
  }
  async function generate() {
    const { expandedPrompt: prompt } = preparePromptForNode(buildStoryboardPrompt({ rows, cols, frames }), assetIndex, settings, {
      tool: "image",
      kind: "image",
    });
    const outputId = createGeneratingResultNode({
      createOutputNear,
      sourceNodeId: node.id,
      title: "分镜生成",
      note: `正在生成 ${rows}×${cols} 分镜...`,
      extra: { storyboardMeta: { rows, cols, frames } },
    });
    try {
      const result = await runImageGeneration(settings, prompt);
      applyGeneratedResult({
        updateNode,
        outputId,
        result,
        sourcePrompt: prompt,
        extra: {
          note: `${rows}×${cols} storyboardGenOutput · ${providerLabel(settings)}`,
          storyboardMeta: { rows, cols, frames },
        },
      });
    } catch (error) {
      applyGeneratedFallback({
        updateNode,
        outputId,
        error,
        sourcePrompt: prompt,
        fallbackImageUrl: makeStoryboardImage(rows, cols, frames),
        fallbackNote: `${rows}×${cols} 本地分镜预览`,
        extra: { storyboardMeta: { rows, cols, frames } },
      });
    }
  }
  function preview() {
    openPromptPreviewCard({
      openPromptPreview,
      title: "分镜生成提示词预览",
      kind: "storyboard",
      original: buildStoryboardPrompt({ rows, cols, frames }),
      negative: "文字水印，分格错乱，角色不一致，低清晰度",
      params: `${rows}×${cols} · ${providerLabel(settings)}`,
    });
  }
  return (
    <>
      <NodeHeader icon="sb" title="分镜生成" right={<button className="ghost">删除</button>} />
      <div className="grid-toolbar">
        <Counter label="R" value={rows} min={1} max={4} onChange={(value) => setGrid(value, cols)} />
        <Counter label="C" value={cols} min={1} max={4} onChange={(value) => setGrid(rows, value)} />
        <b>= {rows * cols}</b>
        <span className="pill">已填 {filledCount}/{rows * cols}</span>
      </div>
      <div className="storyboard-presets">
        {[[2, 2], [3, 3], [4, 2]].map(([presetRows, presetCols]) => (
          <button key={`${presetRows}x${presetCols}`} onClick={() => setGrid(presetRows, presetCols)}>{presetRows}×{presetCols}</button>
        ))}
        <button onClick={() => fillPreset("numbered")}>补编号骨架</button>
        <button onClick={() => fillPreset("cloneFirst")}>首格复制到全部</button>
        <button onClick={() => fillPreset("clear")}>清空全部</button>
      </div>
      <div className="story-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {frames.map((frame, index) => (
          <textarea
            key={index}
            value={frame}
            placeholder="node.storyboardGen.framePlaceholder"
            onChange={(event) => {
              const next = frames.slice();
              next[index] = event.target.value;
              updateNode(node.id, { frames: next });
            }}
          />
        ))}
      </div>
      <div className="node-footer">
        <span className="pill">⭐ Nano Banana 2 Token</span>
        <span className="pill">☷ 自动 · 2K</span>
        <button onClick={copyPrompt}>复制提示词</button>
        <button onClick={preview}>预览</button>
        <button className="primary" onClick={generate}>✦</button>
      </div>
    </>
  );
}

export function SplitNode({ node, updateNode, createManyOutputs, onCreateShotDrafts, helpers }) {
  const { NodeHeader, Counter, readImage, splitImageToFrames } = helpers;
  const state = normalizeSplitNodeData(node.data);
  const rows = state.rows;
  const cols = state.cols;
  const imageUrl = state.imageUrl;
  const [message, setMessage] = useState("");
  const frameCount = rows * cols;

  function useUrl() {
    if (!state.url) {
      setNodeMessage(setMessage, "请先粘贴图片直链");
      return;
    }
    updateNode(node.id, { imageUrl: state.url });
    setNodeMessage(setMessage, "已载入直链图片");
  }

  async function splitImage() {
    if (!imageUrl) {
      setNodeMessage(setMessage, "请先上传或粘贴图片链接");
      return;
    }
    setNodeMessage(setMessage, "正在切割...");
    try {
      const frames = await splitImageToFrames(imageUrl, rows, cols);
      createManyOutputs(
        node.id,
        frames.map((frame, index) => ({
          displayName: `分镜 ${index + 1}`,
          imageUrl: frame,
          note: `${rows}×${cols} split frame`,
        })),
      );
      setNodeMessage(setMessage, `已生成 ${frames.length} 个单帧节点`);
    } catch (error) {
      setNodeError(setMessage, "切割失败：", error);
    }
  }

  function fillPreset(nextRows, nextCols) {
    updateNode(node.id, { rows: nextRows, cols: nextCols });
    setNodeMessage(setMessage, `已切换为 ${nextRows}×${nextCols} 拆分`);
  }

  function createShotDrafts() {
    const drafts = Array.from({ length: frameCount }, (_, index) => ({
      scene: `分镜 ${index + 1}`,
      action: `参考拆分结果第 ${index + 1} 帧补充动作与主焦点`,
      shotSize: "中景",
      duration: "4秒",
      status: "待写",
      reviewStatus: "未审",
    }));
    const result = onCreateShotDrafts?.(node.id, drafts, "镜头表");
    if (!result) {
      setNodeMessage(setMessage, "生成镜头草稿失败");
      return;
    }
    setNodeMessage(setMessage, describeShotDraftResult(result));
  }

  return (
    <>
      <NodeHeader icon="cut" title="分镜拆分" />
      <div className="grid-toolbar">
        <Counter label="R" value={rows} min={1} max={6} onChange={(value) => updateNode(node.id, { rows: value })} />
        <Counter label="C" value={cols} min={1} max={6} onChange={(value) => updateNode(node.id, { cols: value })} />
        <b>= {rows * cols}</b>
        <span className="pill">输出 {frameCount} 帧</span>
      </div>
      <div className="storyboard-presets">
        {[[2, 2], [3, 3], [4, 2], [4, 3]].map(([presetRows, presetCols]) => (
          <button key={`${presetRows}x${presetCols}`} onClick={() => fillPreset(presetRows, presetCols)}>{presetRows}×{presetCols}</button>
        ))}
        <button onClick={createShotDrafts}>生成镜头草稿</button>
      </div>
      <label className="split-preview">
        {imageUrl ? <img src={imageUrl} alt="" /> : <span>上传待拆分的分镜图</span>}
        <input hidden type="file" accept="image/*" onChange={(event) => readImage(event, (next) => updateNode(node.id, { imageUrl: next }))} />
      </label>
      <div className="url-row split-url">
        <input value={state.url} placeholder="粘贴图片直链" onChange={(event) => updateNode(node.id, { url: event.target.value })} />
        <button onClick={useUrl}>使用</button>
      </div>
      <button className="wide-primary split-button" onClick={splitImage}>拆分为单帧节点</button>
      {message && <small className="result-message">{message}</small>}
    </>
  );
}

export function Vr360Node({ node, updateNode, createOutputNear, onSendToLinkedNode, helpers }) {
  const { NodeHeader, readImage, renderPerspectiveFromPanorama, makeVrGrid } = helpers;
  const panorama = node.data.panorama;
  const yaw = node.data.yaw || 0;
  const pitch = node.data.pitch || 0;
  const [busy, setBusy] = useState("");
  const [fullscreen, setFullscreen] = useState(false);

  function useUrl() {
    if (!(node.data.url || "").trim()) {
      setBusy("请先粘贴全景图直链");
      return;
    }
    updateNode(node.id, { panorama: node.data.url });
    setBusy("已载入全景图直链");
  }

  function applyViewPreset(mode) {
    if (mode === "front") updateNode(node.id, { yaw: 0, pitch: 0 });
    if (mode === "left") updateNode(node.id, { yaw: -1.57, pitch: 0 });
    if (mode === "right") updateNode(node.id, { yaw: 1.57, pitch: 0 });
    if (mode === "up") updateNode(node.id, { yaw, pitch: -0.55 });
    if (mode === "down") updateNode(node.id, { yaw, pitch: 0.55 });
    setBusy("已切换预设视角");
  }

  function sendToUpload() {
    if (!panorama) {
      setBusy("请先加载全景图");
      return;
    }
    const result = onSendToLinkedNode?.(node.id, "upload", { imageUrl: panorama, displayName: "上传图片" });
    if (result) setBusy(describeLinkResult(result, "上传", { updatedPrefix: "已同步到最近", createdPrefix: "已创建并送入" }));
  }

  async function exportCurrentView() {
    if (!panorama) return alert("请先加载全景图");
    setBusy("正在导出当前视角...");
    try {
      const imageUrl = await renderPerspectiveFromPanorama(panorama, { yaw, pitch, width: 900, height: 560, fov: 78 });
      createOutputNear(node.id, "result", "VR360-当前视角", { imageUrl, note: "当前透视视角" });
    } catch (error) {
      alert(`导出失败：${error.message}`);
    } finally {
      setBusy("");
    }
  }

  async function exportGrid(count) {
    if (!panorama) return alert("请先加载全景图");
    setBusy(`正在生成${count}宫格...`);
    try {
      const imageUrl = await makeVrGrid(count, panorama);
      createOutputNear(node.id, "result", `VR360-${count}宫格参考`, { imageUrl, note: `${count}宫格全景参考` });
    } catch (error) {
      alert(`生成失败：${error.message}`);
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <NodeHeader icon="🌐" title="VR360 全景场景" />
      <div className="vr-preview">
        {panorama ? (
          <PanoramaViewer
            imageSrc={panorama}
            yaw={yaw}
            pitch={pitch}
            onViewChange={(next) => updateNode(node.id, next)}
            onOpen={() => setFullscreen(true)}
            helpers={helpers}
          />
        ) : (
          <span>等待全景图...</span>
        )}
        <small>{panorama ? "拖拽查看360°场景" : "上传或粘贴全景图直链"}</small>
      </div>
      {panorama && <button className="vr-open-full" onClick={() => setFullscreen(true)}>全屏360°浏览</button>}
      <div className="storyboard-presets">
        <button onClick={() => applyViewPreset("front")}>正前</button>
        <button onClick={() => applyViewPreset("left")}>左侧</button>
        <button onClick={() => applyViewPreset("right")}>右侧</button>
        <button onClick={() => applyViewPreset("up")}>仰视</button>
        <button onClick={() => applyViewPreset("down")}>俯视</button>
      </div>
      <div className="vr-actions">
        <button onClick={exportCurrentView}>导出当前视角</button>
        <button onClick={() => exportGrid(4)}>4宫格参考</button>
        <button onClick={() => exportGrid(12)}>12宫格参考</button>
        <button onClick={() => panorama && createOutputNear(node.id, "result", "VR360-原始全景", { imageUrl: panorama, note: "原始等距柱状全景" })}>原始全景</button>
      </div>
      <div className="image-quickbar">
        <button onClick={sendToUpload}>送到上传</button>
      </div>
      {fullscreen && (
        <FullscreenPanorama
          imageSrc={panorama}
          initialYaw={yaw}
          initialPitch={pitch}
          onClose={(next) => {
            updateNode(node.id, next);
            setFullscreen(false);
          }}
          helpers={helpers}
        />
      )}
      {busy && <div className="vr-busy">{busy}</div>}
      <label className="dash-upload">上传全景图<input hidden type="file" accept="image/*" onChange={(event) => readImage(event, (imageUrl) => updateNode(node.id, { panorama: imageUrl }), 4096)} /></label>
      <div className="url-row">
        <input value={node.data.url || ""} placeholder="粘贴图片直链" onChange={(event) => updateNode(node.id, { url: event.target.value })} />
        <button onClick={useUrl}>使用</button>
      </div>
    </>
  );
}

function PanoramaViewer({ imageSrc, yaw, pitch, onViewChange, onOpen, helpers }) {
  const { createPanoramaScene, clamp } = helpers;
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const sceneRef = useRef(null);
  const viewRef = useRef({ yaw, pitch, fov: 78 });

  useEffect(() => {
    let cancelled = false;
    let scene = null;
    createPanoramaScene(canvasRef.current, imageSrc, { pixelRatio: 1.35 }).then((createdScene) => {
      if (cancelled) {
        createdScene.dispose();
        return;
      }
      scene = createdScene;
      sceneRef.current = scene;
      scene.setView(viewRef.current);
      scene.render();
    }).catch((error) => {
      if (!cancelled) console.warn("Panorama preview failed", error);
    });
    return () => {
      cancelled = true;
      scene?.dispose();
      sceneRef.current = null;
    };
  }, [imageSrc, createPanoramaScene]);

  useEffect(() => {
    viewRef.current = { ...viewRef.current, yaw, pitch };
    sceneRef.current?.setView(viewRef.current);
    sceneRef.current?.render();
  }, [yaw, pitch]);

  function startDrag(event) {
    dragRef.current = { x: event.clientX, y: event.clientY, yaw, pitch, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event) {
    if (!dragRef.current) return;
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    if (Math.hypot(dx, dy) > 5) dragRef.current.moved = true;
    viewRef.current = {
      ...viewRef.current,
      yaw: dragRef.current.yaw + dx * 0.005,
      pitch: clamp(dragRef.current.pitch + dy * 0.0035, -1.25, 1.25),
    };
    sceneRef.current?.setView(viewRef.current);
    sceneRef.current?.render();
  }

  function endDrag() {
    if (dragRef.current && !dragRef.current.moved) onOpen?.();
    if (dragRef.current?.moved) onViewChange({ yaw: viewRef.current.yaw, pitch: viewRef.current.pitch });
    dragRef.current = null;
  }

  return (
    <canvas
      ref={canvasRef}
      width="820"
      height="420"
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
    />
  );
}

function FullscreenPanorama({ imageSrc, initialYaw, initialPitch, onClose, helpers }) {
  const { createPanoramaScene, clamp } = helpers;
  const canvasRef = useRef(null);
  const dragRef = useRef(null);
  const viewRef = useRef({ yaw: initialYaw || 0, pitch: initialPitch || 0, fov: 76 });
  const sceneRef = useRef(null);
  const velocityRef = useRef({ yaw: 0, pitch: 0 });
  const rafRef = useRef(0);
  const lastMoveRef = useRef({ x: 0, y: 0, t: 0 });
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [status, setStatus] = useState("正在加载全景...");

  function startLoop() {
    if (rafRef.current) return;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(32, now - last) / 16.67;
      last = now;
      const velocity = velocityRef.current;
      if (!dragRef.current) {
        viewRef.current.yaw += velocity.yaw * dt;
        viewRef.current.pitch = clamp(viewRef.current.pitch + velocity.pitch * dt, -1.35, 1.35);
        velocity.yaw *= 0.9;
        velocity.pitch *= 0.9;
      }
      sceneRef.current?.setView(viewRef.current);
      sceneRef.current?.render();
      if (dragRef.current || Math.abs(velocity.yaw) > 0.0001 || Math.abs(velocity.pitch) > 0.0001) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = 0;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  useEffect(() => {
    function resize() {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    }
    function keydown(event) {
      if (event.key === "Escape") onClose({ yaw: viewRef.current.yaw, pitch: viewRef.current.pitch });
    }
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", keydown);
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", keydown);
    };
  }, [onClose]);

  useEffect(() => {
    setStatus("正在加载全景...");
    let cancelled = false;
    let scene = null;
    createPanoramaScene(canvasRef.current, imageSrc, {
      pixelRatio: Math.min(2, window.devicePixelRatio || 1),
      onReady: () => setStatus(""),
      onError: (message) => setStatus(message),
    }).then((createdScene) => {
      if (cancelled) {
        createdScene.dispose();
        return;
      }
      scene = createdScene;
      sceneRef.current = scene;
      scene.setView(viewRef.current);
      scene.resize();
      scene.render();
    }).catch((error) => {
      if (!cancelled) setStatus(`全景加载失败：${String(error)}`);
    });
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      scene?.dispose();
      sceneRef.current = null;
    };
  }, [imageSrc, createPanoramaScene]);

  useEffect(() => {
    sceneRef.current?.resize();
    sceneRef.current?.render();
  }, [size.width, size.height]);

  function startDrag(event) {
    dragRef.current = { x: event.clientX, y: event.clientY, yaw: viewRef.current.yaw, pitch: viewRef.current.pitch };
    lastMoveRef.current = { x: event.clientX, y: event.clientY, t: performance.now() };
    velocityRef.current = { yaw: 0, pitch: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
    startLoop();
  }

  function moveDrag(event) {
    if (!dragRef.current) return;
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    const now = performance.now();
    const deltaT = Math.max(8, now - lastMoveRef.current.t);
    velocityRef.current = {
      yaw: ((event.clientX - lastMoveRef.current.x) * 0.0048) / (deltaT / 16.67),
      pitch: ((event.clientY - lastMoveRef.current.y) * 0.0032) / (deltaT / 16.67),
    };
    lastMoveRef.current = { x: event.clientX, y: event.clientY, t: now };
    viewRef.current = {
      ...viewRef.current,
      yaw: dragRef.current.yaw + dx * 0.0048,
      pitch: clamp(dragRef.current.pitch + dy * 0.0032, -1.35, 1.35),
    };
    sceneRef.current?.setView(viewRef.current);
    sceneRef.current?.render();
  }

  function endDrag() {
    dragRef.current = null;
    startLoop();
  }

  function zoom(event) {
    event.preventDefault();
    viewRef.current = { ...viewRef.current, fov: clamp(viewRef.current.fov + (event.deltaY > 0 ? 4 : -4), 42, 100) };
    sceneRef.current?.setView(viewRef.current);
    sceneRef.current?.render();
  }

  return createPortal((
    <div className="vr-fullscreen">
      <canvas
        ref={canvasRef}
        width={size.width}
        height={size.height}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onWheel={zoom}
      />
      <div className="vr-fullscreen-top">
        <strong>VR360 全景浏览</strong>
        <span>拖拽转向 · 滚轮缩放 · Esc退出</span>
        {status && <em>{status}</em>}
      </div>
      <button className="vr-fullscreen-close" onClick={() => onClose({ yaw: viewRef.current.yaw, pitch: viewRef.current.pitch })}>关闭</button>
    </div>
  ), document.body);
}
