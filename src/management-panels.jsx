import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function PromptFactoryPanel({
  state,
  stylePresetCenter,
  modelParamCenter,
  shots,
  assets,
  onPatchState,
  onGenerate,
  onOpenStylePresetCenter,
  onOpenModelParamCenter,
  onClose,
  buildStylePresetSelectOptions,
  findStylePresetByName,
  buildModelPresetOptions,
  buildModelParamPresetOptions,
  findModelParamPresetById,
  buildModelParamPresetSummary,
}) {
  const [sourceType, setSourceType] = useState(state.sourceType || "shot");
  const [sourceId, setSourceId] = useState(state.sourceId || "");
  const [templateKey, setTemplateKey] = useState(state.activeTemplate || "image_shot");
  const [message, setMessage] = useState("");
  const sources = sourceType === "asset" ? assets.map((asset) => ({ id: asset.token, title: asset.name, payload: asset })) : shots.map((shot) => ({ id: shot.id, title: `${shot.id} ${shot.scene || ""}`, payload: shot }));
  const selectedSource = sources.find((item) => item.id === sourceId) || sources[0] || null;
  const styleOptions = buildStylePresetSelectOptions(stylePresetCenter, state.stylePreset);
  const activeStylePreset = findStylePresetByName(stylePresetCenter, state.stylePreset);
  const modelOptions = buildModelPresetOptions(stylePresetCenter, activeStylePreset, state.modelPreset);
  const parameterOptions = buildModelParamPresetOptions(modelParamCenter, templateKey, state.parameterPresetId);
  const activeParameterPreset = findModelParamPresetById(modelParamCenter, state.parameterPresetId);
  const sourceCoverageText = sources.length ? `当前可用来源 ${sources.length} 个，已选 ${selectedSource?.title || "未选择"}。` : "当前还没有可用来源，先回到镜头表或资产库准备素材。";
  const promptTaskHint = sourceType === "asset"
    ? "资产模式更适合先锁角色、场景、道具的稳定设定，再把结果给后续镜头复用。"
    : "镜头模式优先把单镜的图像/视频提示词补齐，方便后续审稿和时间线推进。";

  useEffect(() => {
    if (!selectedSource && sources.length) setSourceId(sources[0].id);
  }, [selectedSource, sources]);

  async function copyOutput() {
    try {
      await navigator.clipboard.writeText(state.lastOutput || "");
      setMessage("已复制 Prompt");
    } catch (error) {
      setMessage(error.message || "复制失败");
    }
  }

  function handleGenerate() {
    if (!selectedSource) {
      setMessage("当前没有可生成的来源");
      return;
    }
    const output = onGenerate({
      sourceType,
      sourceId: selectedSource.id,
      templateKey,
      templates: state.templates,
      stylePreset: state.stylePreset,
      modelPreset: state.modelPreset,
      parameterPresetId: state.parameterPresetId,
      title: selectedSource.title,
      payload: selectedSource.payload,
    });
    setMessage(output ? "已生成 Prompt" : "生成失败");
  }

  return createPortal((
    <aside className="prompt-factory-panel">
      <header>
        <div>
          <strong>Prompt 工厂</strong>
          <span>{(state.history || []).length} 条历史 · 风格 {state.stylePreset} · 模型 {state.modelPreset}</span>
        </div>
        <button onClick={onClose}>关闭</button>
      </header>
      <section className="panel-action-strip">
        <div className="panel-action-strip-copy">
          <strong>当前任务</strong>
          <span>{sourceCoverageText}</span>
          <p>{promptTaskHint}</p>
        </div>
        <div className="panel-action-strip-actions">
          <button className="primary" onClick={handleGenerate}>生成当前 Prompt</button>
          <button onClick={copyOutput} disabled={!state.lastOutput}>复制当前结果</button>
          <button onClick={onOpenStylePresetCenter}>调风格预设</button>
          <button onClick={onOpenModelParamCenter}>调参数预设</button>
        </div>
      </section>
      <div className="prompt-factory-toolbar">
        <label>来源类型<select value={sourceType} onChange={(event) => { setSourceType(event.target.value); setSourceId(""); }}>
          <option value="shot">镜头</option>
          <option value="asset">资产</option>
        </select></label>
        <label>模板<select value={templateKey} onChange={(event) => setTemplateKey(event.target.value)}>
          <option value="image_shot">图像镜头模板</option>
          <option value="video_shot">视频镜头模板</option>
          <option value="asset_card">资产卡模板</option>
        </select></label>
        <label>风格<select value={state.stylePreset} onChange={(event) => {
          const preset = findStylePresetByName(stylePresetCenter, event.target.value);
          onPatchState({ stylePreset: event.target.value, modelPreset: preset?.defaultModelPreset || state.modelPreset });
        }}>
          {styleOptions.map((item) => <option key={item}>{item}</option>)}
        </select></label>
        <label>模型<select value={state.modelPreset} onChange={(event) => onPatchState({ modelPreset: event.target.value })}>
          {modelOptions.map((item) => <option key={item}>{item}</option>)}
        </select></label>
        <label>参数预设<select value={state.parameterPresetId || ""} onChange={(event) => {
          const preset = findModelParamPresetById(modelParamCenter, event.target.value);
          onPatchState({ parameterPresetId: event.target.value, modelPreset: preset?.modelPreset || state.modelPreset });
        }}>
          {parameterOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select></label>
        <button onClick={onOpenStylePresetCenter}>管理风格预设</button>
        <button onClick={onOpenModelParamCenter}>管理参数预设</button>
      </div>
      {activeStylePreset && (
        <div className="prompt-style-summary">
          <strong>{activeStylePreset.name}</strong>
          <span>{activeStylePreset.stylePrompt}</span>
          <small>图像体系：{activeStylePreset.imageStyle} · 推荐模型：{activeStylePreset.defaultModelPreset} · 适配：{(activeStylePreset.targetModels || []).join("、")}</small>
        </div>
      )}
      {activeParameterPreset && (
        <div className="prompt-style-summary">
          <strong>{activeParameterPreset.name}</strong>
          <span>{buildModelParamPresetSummary(activeParameterPreset)}</span>
          <small>执行模型：{activeParameterPreset.runtimeModel} · 质量：{activeParameterPreset.quality || "-"}</small>
        </div>
      )}
      <div className="prompt-factory-body">
        <section className="prompt-factory-sources">
          {sources.length ? sources.map((item) => (
            <button key={item.id} className={item.id === (selectedSource?.id || "") ? "active" : ""} onClick={() => setSourceId(item.id)}>
              <strong>{item.title}</strong>
              <span>{item.id}</span>
            </button>
          )) : <div className="asset-empty">当前没有可用来源。</div>}
        </section>
        <section className="prompt-factory-editor">
          <label>模板内容<textarea value={state.templates?.[templateKey] || ""} onChange={(event) => onPatchState({ templates: { ...(state.templates || {}), [templateKey]: event.target.value } })} /></label>
          <div className="prompt-factory-actions">
            <button onClick={handleGenerate}>生成 Prompt</button>
            <button onClick={copyOutput} disabled={!state.lastOutput}>复制结果</button>
          </div>
          <label>生成结果<textarea readOnly value={state.lastOutput || ""} /></label>
        </section>
        <section className="prompt-factory-history">
          <strong>历史记录</strong>
          <div className="prompt-factory-history-list">
            {(state.history || []).length ? state.history.map((item) => (
              <button key={item.id} onClick={() => onPatchState({ lastOutput: item.output, activeTemplate: item.templateKey, stylePreset: item.stylePreset, modelPreset: item.modelPreset, parameterPresetId: item.parameterPresetId || "" })}>
                <strong>{item.title}</strong>
                <span>{item.modelPreset} · {item.stylePreset}</span>
              </button>
            )) : <div className="asset-empty">还没有 Prompt 历史。</div>}
          </div>
        </section>
      </div>
      {message && <small className="result-message">{message}</small>}
    </aside>
  ), document.body);
}

export function TemplateCenterPanel({ state, onPatchState, onApplyTemplate, onExportTemplate, onClose, templateCategoryLabel, templateCategoryOptions }) {
  const [category, setCategory] = useState(state.activeCategory || "script");
  const templates = (state.templates || []).filter((item) => item.category === category);
  const [selectedId, setSelectedId] = useState(templates[0]?.id || "");
  const selected = templates.find((item) => item.id === selectedId) || templates[0] || null;
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!templates.length) {
      setSelectedId("");
      return;
    }
    if (!templates.some((item) => item.id === selectedId)) setSelectedId(templates[0].id);
  }, [templates, selectedId]);

  function patchSelected(patch) {
    if (!selected) return;
    onPatchState({
      activeCategory: category,
      templates: (state.templates || []).map((item) => (item.id === selected.id ? { ...item, ...patch } : item)),
    });
  }

  function addTemplate() {
    const next = {
      id: `template-${Date.now()}`,
      category,
      name: `新${templateCategoryLabel(category)}`,
      content: "",
      metaKey: "",
    };
    onPatchState({
      activeCategory: category,
      templates: [...(state.templates || []), next],
    });
    setSelectedId(next.id);
  }

  async function copyTemplate() {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.content || "");
      setMessage(`已复制模板：${selected.name}`);
    } catch (error) {
      setMessage(error.message || "复制失败");
    }
  }

  return createPortal((
    <aside className="template-center-panel">
      <header>
        <div>
          <strong>模板系统</strong>
          <span>{(state.templates || []).length} 个模板 · 当前分类 {templateCategoryLabel(category)}</span>
        </div>
        <button onClick={onClose}>关闭</button>
      </header>
      <div className="template-center-toolbar">
        <div className="asset-drawer-tabs template-tabs">
          {templateCategoryOptions.map(([key, label]) => (
            <button key={key} className={category === key ? "active" : ""} onClick={() => { setCategory(key); onPatchState({ activeCategory: key }); }}>{label}</button>
          ))}
        </div>
        <button onClick={addTemplate}>新增模板</button>
      </div>
      <div className="template-center-body">
        <section className="template-center-list">
          {templates.length ? templates.map((item) => (
            <button key={item.id} className={item.id === (selected?.id || "") ? "active" : ""} onClick={() => setSelectedId(item.id)}>
              <strong>{item.name}</strong>
              <span>{item.metaKey || item.category}</span>
            </button>
          )) : <div className="asset-empty">当前分类还没有模板。</div>}
        </section>
        <section className="template-center-editor">
          {selected ? (
            <>
              <label>模板名称<input value={selected.name} onChange={(event) => patchSelected({ name: event.target.value })} /></label>
              <label>附加键<input value={selected.metaKey || ""} onChange={(event) => patchSelected({ metaKey: event.target.value })} placeholder="例如 image_shot / novel_api_body" /></label>
              <label>模板内容<textarea value={selected.content || ""} onChange={(event) => patchSelected({ content: event.target.value })} /></label>
              <div className="template-center-actions">
                <button onClick={() => onApplyTemplate(selected.id)}>应用到当前项目</button>
                <button onClick={() => onExportTemplate(selected.id)}>导出到画布</button>
                <button onClick={copyTemplate}>复制模板</button>
              </div>
            </>
          ) : <div className="asset-empty">先创建一个模板。</div>}
        </section>
      </div>
      {message && <small className="result-message">{message}</small>}
    </aside>
  ), document.body);
}

export function StylePresetCenterPanel({
  state,
  onPatchState,
  onApplyToPromptFactory,
  onApplyToNovelPipelines,
  onClose,
  normalizeStylePresetDefinition,
  promptModelPresets,
  styleImageSystemOptions,
}) {
  const presets = state.presets || [];
  const [selectedId, setSelectedId] = useState(state.activePresetId || presets[0]?.id || "");
  const [message, setMessage] = useState("");
  const selected = presets.find((item) => item.id === selectedId) || presets[0] || null;

  useEffect(() => {
    if (!presets.length) {
      setSelectedId("");
      return;
    }
    if (!presets.some((item) => item.id === selectedId)) setSelectedId(presets[0].id);
  }, [presets, selectedId]);

  function patchSelected(patch) {
    if (!selected) return;
    onPatchState({
      activePresetId: selected.id,
      presets: presets.map((item) => (item.id === selected.id ? { ...item, ...patch } : item)),
    });
  }

  function addPreset() {
    const next = normalizeStylePresetDefinition({
      id: `style-preset-${Date.now()}`,
      name: `新风格预设 ${presets.length + 1}`,
      imageStyle: "CG电影感",
      defaultModelPreset: promptModelPresets[0],
      targetModels: [promptModelPresets[0]],
    }, presets.length);
    onPatchState({
      activePresetId: next.id,
      presets: [...presets, next],
    });
    setSelectedId(next.id);
  }

  async function copyPresetSummary() {
    if (!selected) return;
    const summary = [
      `风格：${selected.name}`,
      `图像体系：${selected.imageStyle}`,
      `推荐模型：${selected.defaultModelPreset}`,
      `适配模型：${(selected.targetModels || []).join("、")}`,
      `风格说明：${selected.stylePrompt || ""}`,
      `资产策略：${selected.assetRule || ""}`,
      `视频策略：${selected.videoRule || ""}`,
      `避开：${selected.negativeHints || ""}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(summary);
      setMessage(`已复制：${selected.name}`);
    } catch (error) {
      setMessage(error.message || "复制失败");
    }
  }

  return createPortal((
    <aside className="style-preset-panel">
      <header>
        <div>
          <strong>风格预设</strong>
          <span>{presets.length} 套项目风格 · 当前 {(selected && selected.name) || "未选择"}</span>
        </div>
        <button onClick={onClose}>关闭</button>
      </header>
      <div className="style-preset-toolbar">
        <button onClick={addPreset}>新增风格</button>
        <button onClick={() => selected && onApplyToPromptFactory(selected.id)} disabled={!selected}>应用到 Prompt 工厂</button>
        <button onClick={() => selected && onApplyToNovelPipelines(selected.id)} disabled={!selected}>应用到当前集小说工厂</button>
        <button onClick={copyPresetSummary} disabled={!selected}>复制风格说明</button>
      </div>
      <div className="style-preset-body">
        <section className="style-preset-list">
          {presets.length ? presets.map((item) => (
            <button key={item.id} className={item.id === (selected?.id || "") ? "active" : ""} onClick={() => { setSelectedId(item.id); onPatchState({ activePresetId: item.id }); }}>
              <strong>{item.name}</strong>
              <span>{item.imageStyle} · {item.defaultModelPreset}</span>
            </button>
          )) : <div className="asset-empty">当前还没有风格预设。</div>}
        </section>
        <section className="style-preset-editor">
          {selected ? (
            <>
              <div className="style-preset-grid">
                <label>风格名称<input value={selected.name || ""} onChange={(event) => patchSelected({ name: event.target.value })} /></label>
                <label>图像体系<select value={selected.imageStyle || "CG电影感"} onChange={(event) => patchSelected({ imageStyle: event.target.value })}>
                  {styleImageSystemOptions.map((item) => <option key={item}>{item}</option>)}
                </select></label>
                <label>推荐模型<select value={selected.defaultModelPreset || promptModelPresets[0]} onChange={(event) => patchSelected({ defaultModelPreset: event.target.value })}>
                  {promptModelPresets.map((item) => <option key={item}>{item}</option>)}
                </select></label>
                <label>适配模型<textarea className="small-textarea" value={(selected.targetModels || []).join("\n")} onChange={(event) => patchSelected({ targetModels: event.target.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) })} /></label>
              </div>
              <label>风格说明<textarea value={selected.stylePrompt || ""} onChange={(event) => patchSelected({ stylePrompt: event.target.value })} /></label>
              <label>资产策略<textarea className="small-textarea" value={selected.assetRule || ""} onChange={(event) => patchSelected({ assetRule: event.target.value })} /></label>
              <label>视频策略<textarea className="small-textarea" value={selected.videoRule || ""} onChange={(event) => patchSelected({ videoRule: event.target.value })} /></label>
              <label>避开问题<textarea className="small-textarea" value={selected.negativeHints || ""} onChange={(event) => patchSelected({ negativeHints: event.target.value })} /></label>
            </>
          ) : <div className="asset-empty">先创建一个风格预设。</div>}
        </section>
      </div>
      {message && <small className="result-message">{message}</small>}
    </aside>
  ), document.body);
}

export function ModelParamCenterPanel({
  state,
  onPatchState,
  onApplyToPromptFactory,
  onApplyToShots,
  onApplyToAiSettings,
  onClose,
  normalizeModelParamPresetDefinition,
  promptModelPresets,
  buildModelParamPresetSummary,
}) {
  const presets = state.presets || [];
  const [selectedId, setSelectedId] = useState(state.activePresetId || presets[0]?.id || "");
  const [message, setMessage] = useState("");
  const selected = presets.find((item) => item.id === selectedId) || presets[0] || null;

  useEffect(() => {
    if (!presets.length) {
      setSelectedId("");
      return;
    }
    if (!presets.some((item) => item.id === selectedId)) setSelectedId(presets[0].id);
  }, [presets, selectedId]);

  function patchSelected(patch) {
    if (!selected) return;
    onPatchState({
      activePresetId: selected.id,
      presets: presets.map((item) => (item.id === selected.id ? { ...item, ...patch } : item)),
    });
  }

  function addPreset(kind = "image") {
    const next = normalizeModelParamPresetDefinition({
      id: `param-preset-${Date.now()}`,
      kind,
      name: `新${kind === "video" ? "视频" : "图片"}参数预设 ${presets.length + 1}`,
      modelPreset: kind === "video" ? "通用视频模型" : "NanoBanana / Gemini",
      runtimeModel: "",
    }, presets.length);
    onPatchState({
      activePresetId: next.id,
      presets: [...presets, next],
    });
    setSelectedId(next.id);
  }

  async function copyPreset() {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(buildModelParamPresetSummary(selected));
      setMessage(`已复制：${selected.name}`);
    } catch (error) {
      setMessage(error.message || "复制失败");
    }
  }

  return createPortal((
    <aside className="model-param-panel">
      <header>
        <div>
          <strong>参数预设</strong>
          <span>{presets.length} 套模型参数 · 当前 {(selected && selected.name) || "未选择"}</span>
        </div>
        <button onClick={onClose}>关闭</button>
      </header>
      <div className="model-param-toolbar">
        <button onClick={() => addPreset("image")}>新增图片预设</button>
        <button onClick={() => addPreset("video")}>新增视频预设</button>
        <button onClick={() => selected && onApplyToPromptFactory(selected.id)} disabled={!selected}>应用到 Prompt 工厂</button>
        <button onClick={() => selected && onApplyToShots(selected.id)} disabled={!selected}>应用到当前集镜头</button>
        <button onClick={() => selected && onApplyToAiSettings(selected.id)} disabled={!selected}>写入 AI 设置</button>
        <button onClick={copyPreset} disabled={!selected}>复制摘要</button>
      </div>
      <div className="model-param-body">
        <section className="model-param-list">
          {presets.length ? presets.map((item) => (
            <button key={item.id} className={item.id === (selected?.id || "") ? "active" : ""} onClick={() => { setSelectedId(item.id); onPatchState({ activePresetId: item.id }); }}>
              <strong>{item.name}</strong>
              <span>{item.kind === "video" ? "视频" : "图片"} · {item.modelPreset}</span>
            </button>
          )) : <div className="asset-empty">当前还没有参数预设。</div>}
        </section>
        <section className="model-param-editor">
          {selected ? (
            <>
              <div className="style-preset-grid">
                <label>预设名称<input value={selected.name || ""} onChange={(event) => patchSelected({ name: event.target.value })} /></label>
                <label>类型<select value={selected.kind || "image"} onChange={(event) => patchSelected({ kind: event.target.value })}>
                  <option value="image">图片</option>
                  <option value="video">视频</option>
                </select></label>
                <label>模型预设<select value={selected.modelPreset || promptModelPresets[0]} onChange={(event) => patchSelected({ modelPreset: event.target.value })}>
                  {promptModelPresets.map((item) => <option key={item}>{item}</option>)}
                </select></label>
                <label>执行模型<input value={selected.runtimeModel || ""} onChange={(event) => patchSelected({ runtimeModel: event.target.value })} placeholder="例如 nano-banana-fast / Comfy workflow" /></label>
                <label>分辨率/尺寸<input value={selected.imageSize || ""} onChange={(event) => patchSelected({ imageSize: event.target.value })} placeholder="1K / 4K / 1536x1536" /></label>
                <label>画幅<input value={selected.aspectRatio || ""} onChange={(event) => patchSelected({ aspectRatio: event.target.value })} placeholder="16:9 / 9:16 / 1:1" /></label>
                <label>质量档位<input value={selected.quality || ""} onChange={(event) => patchSelected({ quality: event.target.value })} placeholder="快速预览 / 高质量定稿" /></label>
                <label>时长<input value={selected.duration || ""} onChange={(event) => patchSelected({ duration: event.target.value })} placeholder="视频常用 4秒 / 6秒" /></label>
                <label>运动强度<input value={selected.motionStrength || ""} onChange={(event) => patchSelected({ motionStrength: event.target.value })} placeholder="弱 / 中 / 强" /></label>
              </div>
              <label>参数说明<textarea className="small-textarea" value={selected.bodyHints || ""} onChange={(event) => patchSelected({ bodyHints: event.target.value })} /></label>
              <label>避开问题<textarea className="small-textarea" value={selected.negativeHints || ""} onChange={(event) => patchSelected({ negativeHints: event.target.value })} /></label>
            </>
          ) : <div className="asset-empty">先创建一个参数预设。</div>}
        </section>
      </div>
      {message && <small className="result-message">{message}</small>}
    </aside>
  ), document.body);
}

export function ExportPresetCenterPanel({
  state,
  onPatchState,
  onApplyToExportCenter,
  onCopyPresetSummary,
  onExportPresetFile,
  onExportAllPresetFiles,
  onImportPresets,
  onClose,
  normalizeExportPresetDefinition,
  exportVideoPresetOptions,
  exportPresetStageOptions,
}) {
  const presets = state.presets || [];
  const [selectedId, setSelectedId] = useState(state.activePresetId || presets[0]?.id || "");
  const [message, setMessage] = useState("");
  const [importDraft, setImportDraft] = useState("");
  const selected = presets.find((item) => item.id === selectedId) || presets[0] || null;

  useEffect(() => {
    if (!presets.length) {
      setSelectedId("");
      return;
    }
    if (!presets.some((item) => item.id === selectedId)) setSelectedId(presets[0].id);
  }, [presets, selectedId]);

  function patchSelected(patch) {
    if (!selected) return;
    onPatchState({
      activePresetId: selected.id,
      presets: presets.map((item) => (item.id === selected.id ? { ...item, ...patch } : item)),
    });
  }

  function addPreset() {
    const next = normalizeExportPresetDefinition({
      id: `export-preset-${Date.now()}`,
      name: `新导出预设 ${presets.length + 1}`,
      width: 1920,
      height: 1080,
      fps: 30,
      encodePreset: "veryfast",
      crf: 18,
      note: "",
    }, presets.length);
    onPatchState({
      activePresetId: next.id,
      presets: [...presets, next],
    });
    setSelectedId(next.id);
  }

  function duplicatePreset() {
    if (!selected) return;
    const next = normalizeExportPresetDefinition({
      ...selected,
      id: `export-preset-${Date.now()}`,
      name: `${selected.name} 副本`,
    }, presets.length);
    onPatchState({
      activePresetId: next.id,
      presets: [...presets, next],
    });
    setSelectedId(next.id);
  }

  function removePreset() {
    if (!selected) return;
    if (selected.locked) {
      setMessage("当前预设已锁定，先取消锁定再删除。");
      return;
    }
    if (presets.length <= 1) {
      setMessage("至少保留一个导出预设。");
      return;
    }
    const nextPresets = presets.filter((item) => item.id !== selected.id);
    const nextSelectedId = nextPresets[0]?.id || "";
    onPatchState({
      activePresetId: nextSelectedId,
      presets: nextPresets,
    });
    setSelectedId(nextSelectedId);
  }

  async function copyPreset() {
    if (!selected) return;
    try {
      await onCopyPresetSummary?.(selected.id);
      setMessage(`已复制：${selected.name}`);
    } catch (error) {
      setMessage(error.message || "复制失败");
    }
  }

  return createPortal((
    <aside className="export-preset-panel">
      <header>
        <div>
          <strong>导出预设</strong>
          <span>{presets.length} 套导出方案 · 当前 {(selected && selected.name) || "未选择"}</span>
        </div>
        <button onClick={onClose}>关闭</button>
      </header>
      <div className="export-preset-toolbar">
        <button onClick={addPreset}>新增预设</button>
        <button onClick={duplicatePreset} disabled={!selected}>复制预设</button>
        <button onClick={removePreset} disabled={!selected}>删除预设</button>
        <button onClick={() => selected && onApplyToExportCenter?.(selected.id)} disabled={!selected}>应用到成片导出</button>
        <button onClick={copyPreset} disabled={!selected}>复制摘要</button>
        <button onClick={() => selected && onExportPresetFile?.(selected.id)} disabled={!selected}>导出当前 JSON</button>
        <button onClick={() => onExportAllPresetFiles?.()} disabled={!presets.length}>导出全部 JSON</button>
      </div>
      <div className="model-param-body">
        <section className="model-param-list">
          {presets.length ? presets.map((item) => (
            <button key={item.id} className={item.id === (selected?.id || "") ? "active" : ""} onClick={() => { setSelectedId(item.id); onPatchState({ activePresetId: item.id }); }}>
              <strong>{item.name}</strong>
              <span>{item.stageTag || "自定义"} · {item.width}x{item.height} · {item.fps}fps · {item.encodePreset}{item.locked ? " · 已锁定" : ""}</span>
            </button>
          )) : <div className="asset-empty">当前还没有导出预设。</div>}
        </section>
        <section className="model-param-editor">
          {selected ? (
            <>
              <div className="style-preset-grid">
                <label>预设名称<input value={selected.name || ""} onChange={(event) => patchSelected({ name: event.target.value })} /></label>
                <label>交付标签<select value={selected.stageTag || "自定义"} onChange={(event) => patchSelected({ stageTag: event.target.value })}>
                  {exportPresetStageOptions.map((item) => <option key={item}>{item}</option>)}
                </select></label>
                <label>宽度<input type="number" min="320" step="2" value={selected.width || 1920} onChange={(event) => patchSelected({ width: Number(event.target.value || 1920) })} /></label>
                <label>高度<input type="number" min="320" step="2" value={selected.height || 1080} onChange={(event) => patchSelected({ height: Number(event.target.value || 1080) })} /></label>
                <label>FPS<input type="number" min="12" max="60" value={selected.fps || 30} onChange={(event) => patchSelected({ fps: Number(event.target.value || 30) })} /></label>
                <label>编码预设<select value={selected.encodePreset || "veryfast"} onChange={(event) => patchSelected({ encodePreset: event.target.value })}>
                  {exportVideoPresetOptions.map((item) => <option key={item}>{item}</option>)}
                </select></label>
                <label>CRF<input type="number" min="12" max="35" value={selected.crf || 18} onChange={(event) => patchSelected({ crf: Number(event.target.value || 18) })} /></label>
              </div>
              <label className="export-preset-checkbox">
                <input type="checkbox" checked={Boolean(selected.locked)} onChange={(event) => patchSelected({ locked: event.target.checked })} />
                <span>锁定预设</span>
              </label>
              <label>适用说明<textarea className="small-textarea" value={selected.note || ""} onChange={(event) => patchSelected({ note: event.target.value })} /></label>
              <div className="export-preset-import-box">
                <strong>导入导出</strong>
                <textarea className="small-textarea" value={importDraft} onChange={(event) => setImportDraft(event.target.value)} placeholder="把导出预设 JSON 粘贴到这里，可合并导入或覆盖导入。" />
                <div className="export-preset-import-actions">
                  <button onClick={() => { onImportPresets?.(importDraft, "merge"); setImportDraft(""); }}>合并导入</button>
                  <button onClick={() => { onImportPresets?.(importDraft, "replace"); setImportDraft(""); }}>覆盖导入</button>
                </div>
              </div>
            </>
          ) : <div className="asset-empty">先创建一个导出预设。</div>}
        </section>
      </div>
      {message && <small className="result-message">{message}</small>}
    </aside>
  ), document.body);
}

export function DirectorAssistantPanel({ report, onApplyPromptSuggestion, onApplyShotSuggestion, onLocate, onClose }) {
  const [tab, setTab] = useState("suggestions");
  const suggestions = report?.suggestions || [];
  const weakShots = report?.weakShots || [];
  const coverage = report?.coverage || {};

  return createPortal((
    <aside className="director-panel">
      <header>
        <div>
          <strong>导演助手</strong>
          <span>{report?.episodeName || "当前集"} · 建议 {suggestions.length} 条 · 弱镜头 {weakShots.length} 个</span>
        </div>
        <button onClick={onClose}>关闭</button>
      </header>
      <div className="director-summary">
        <section><b>{coverage.totalShots || 0}</b><span>镜头总数</span></section>
        <section><b>{coverage.healthyShots || 0}</b><span>较稳镜头</span></section>
        <section><b>{coverage.assetBoundShots || 0}</b><span>已绑资产</span></section>
        <section><b>{coverage.timelineShots || 0}</b><span>已进时间线</span></section>
      </div>
      <div className="health-toolbar">
        <div className="asset-drawer-tabs health-tabs">
          <button className={tab === "suggestions" ? "active" : ""} onClick={() => setTab("suggestions")}>镜头建议</button>
          <button className={tab === "weak" ? "active" : ""} onClick={() => setTab("weak")}>弱镜头</button>
          <button className={tab === "beats" ? "active" : ""} onClick={() => setTab("beats")}>节奏提醒</button>
        </div>
      </div>
      <div className="director-list">
        {tab === "suggestions" && (suggestions.length ? suggestions.map((item, index) => (
          <section key={`${item.shotId}-${index}`} className="director-item">
            <header>
              <div className="health-item-meta">
                <span className="health-level level-建议">{item.kindLabel}</span>
                <span>{item.shotId}</span>
                <span>{item.title}</span>
              </div>
              <div className="health-item-actions">
                <button onClick={() => onLocate(item.nodeId)}>定位</button>
                {item.value ? <button onClick={() => onApplyPromptSuggestion(item)}>应用建议</button> : <button onClick={() => onApplyShotSuggestion(item)}>应用建议</button>}
              </div>
            </header>
            <strong>{item.summary}</strong>
            <p>{item.detail}</p>
            {item.preview && <code>{item.preview}</code>}
          </section>
        )) : <div className="asset-empty">当前没有可生成的镜头建议。</div>)}
        {tab === "weak" && (weakShots.length ? weakShots.map((item, index) => (
          <section key={`${item.shotId}-${index}`} className="director-item">
            <header>
              <div className="health-item-meta">
                <span className={`health-level level-${item.level}`}>{item.level}</span>
                <span>{item.shotId}</span>
                <span>{item.scene || "未填场景"}</span>
              </div>
              <div className="health-item-actions">
                <button onClick={() => onLocate(item.nodeId)}>定位</button>
              </div>
            </header>
            <strong>{item.text}</strong>
            <p>{item.detail}</p>
          </section>
        )) : <div className="asset-empty">当前没有弱镜头。</div>)}
        {tab === "beats" && ((report?.beats || []).length ? report.beats.map((item, index) => (
          <section key={`${item.kind}-${index}`} className="director-item">
            <header>
              <div className="health-item-meta">
                <span className={`health-level level-${item.level}`}>{item.level}</span>
                <span>{item.kind}</span>
              </div>
            </header>
            <strong>{item.text}</strong>
            <p>{item.detail}</p>
          </section>
        )) : <div className="asset-empty">当前没有节奏提醒。</div>)}
      </div>
    </aside>
  ), document.body);
}

export function ReviewCenterPanel({
  report,
  collaborationState,
  reviewWorkflow,
  focusTargetId,
  onAddComment,
  onUpdateShotReviewStatus,
  onRunApiReview,
  onRunBatchApiReview,
  onRunApiReviewAndRevise,
  onRunBatchApiReviewAndRevise,
  onRunRefreshPlan,
  onRunBatchRefreshPlan,
  refreshPlanCount,
  onContinueCurrentStep,
  onGoNextStep,
  onOpenApiSettings,
  onLocate,
  onClose,
  reviewStatusOptions,
}) {
  const [targetId, setTargetId] = useState(report.targets[0]?.id || "");
  const [author, setAuthor] = useState(collaborationState?.activeMemberName || "导演");
  const [text, setText] = useState("");
  const [reviewStatus, setReviewStatus] = useState("待修改");
  const [apiMessage, setApiMessage] = useState("");
  const [apiLoading, setApiLoading] = useState("");
  const selected = report.targets.find((item) => item.id === targetId) || report.targets[0] || null;
  const reviewTaskHint = report.summary.unreviewed
    ? `当前还有 ${report.summary.unreviewed} 个未审镜头，先让 API 跑出可执行意见。`
    : report.summary.pendingFix
      ? `当前还有 ${report.summary.pendingFix} 个待修改镜头，优先跑自动修改和刷新计划。`
      : (refreshPlanCount || report.summary.refreshPlans || 0)
        ? `当前还有 ${refreshPlanCount || report.summary.refreshPlans || 0} 个刷新计划，执行完就更接近下一步。`
        : "这一轮审稿闭环已经比较干净，可以继续推进到时间线或导出。";

  useEffect(() => {
    setAuthor(collaborationState?.activeMemberName || "导演");
  }, [collaborationState?.activeMemberName]);

  useEffect(() => {
    if (!report.targets.length) {
      setTargetId("");
      return;
    }
    if (!report.targets.some((item) => item.id === targetId)) setTargetId(report.targets[0].id);
  }, [report.targets, targetId]);

  useEffect(() => {
    if (!focusTargetId) return;
    if (report.targets.some((item) => item.id === focusTargetId)) setTargetId(focusTargetId);
  }, [focusTargetId, report.targets]);

  useEffect(() => {
    setReviewStatus(selected?.reviewStatus || "待修改");
  }, [selected?.id, selected?.reviewStatus]);

  function submitComment() {
    if (!selected) return;
    onAddComment({
      nodeId: selected.nodeId,
      shotId: selected.shotId || "",
      author,
      text,
      reviewStatus: selected.shotId ? reviewStatus : "",
    });
    setText("");
  }

  async function handleApiReviewCurrent() {
    if (!selected?.shotId || !onRunApiReview) return;
    setApiLoading(selected.id);
    setApiMessage("正在用 API 审稿当前镜头...");
    try {
      const result = await onRunApiReview({ nodeId: selected.nodeId, shotId: selected.shotId });
      setApiMessage(result?.summary ? `API 审稿完成：${result.summary}` : "API 审稿完成，结果已写回当前镜头。");
    } catch (error) {
      setApiMessage(`API 审稿失败：${error.message || String(error)}`);
    } finally {
      setApiLoading("");
    }
  }

  async function handleApiReviewBatch() {
    if (!onRunBatchApiReview) return;
    setApiLoading("batch");
    setApiMessage("正在批量 API 审稿当前集...");
    try {
      const result = await onRunBatchApiReview();
      setApiMessage(`批量审稿完成：处理 ${result.reviewed || 0} 个镜头，待修改 ${result.pendingFix || 0} 个，已通过 ${result.passed || 0} 个。`);
    } catch (error) {
      setApiMessage(`批量审稿失败：${error.message || String(error)}`);
    } finally {
      setApiLoading("");
    }
  }

  async function handleApiReviewAndReviseCurrent() {
    if (!selected?.shotId || !onRunApiReviewAndRevise) return;
    setApiLoading(`revise:${selected.id}`);
    setApiMessage("正在审稿并按意见自动修改当前镜头...");
    try {
      const result = await onRunApiReviewAndRevise({ nodeId: selected.nodeId, shotId: selected.shotId });
      setApiMessage(result?.revised ? "当前镜头已按审稿意见自动修改，并完成复审与全局回写。" : "当前镜头已通过审稿，无需自动修改。");
    } catch (error) {
      setApiMessage(`自动修改失败：${error.message || String(error)}`);
    } finally {
      setApiLoading("");
    }
  }

  async function handleApiReviewAndReviseBatch() {
    if (!onRunBatchApiReviewAndRevise) return;
    setApiLoading("revise-batch");
    setApiMessage("正在批量审稿并按意见自动修改当前集...");
    try {
      const result = await onRunBatchApiReviewAndRevise();
      setApiMessage(`批量闭环完成：已审 ${result.reviewed || 0} 个，已改 ${result.revised || 0} 个，剩余待修改 ${result.pendingFix || 0} 个。`);
    } catch (error) {
      setApiMessage(`批量自动修改失败：${error.message || String(error)}`);
    } finally {
      setApiLoading("");
    }
  }

  async function handleRefreshCurrent() {
    if (!selected?.shotId || !onRunRefreshPlan) return;
    setApiLoading(`refresh:${selected.id}`);
    setApiMessage("正在执行当前镜头刷新计划...");
    try {
      const result = await onRunRefreshPlan({ nodeId: selected.nodeId, shotId: selected.shotId });
      setApiMessage(`刷新完成：资产 ${result.assetCount || 0}，提示词 ${result.promptUpdated || 0}，时间线 ${result.timelineUpdated || 0}。`);
    } catch (error) {
      setApiMessage(`刷新计划执行失败：${error.message || String(error)}`);
    } finally {
      setApiLoading("");
    }
  }

  async function handleRefreshBatch() {
    if (!onRunBatchRefreshPlan) return;
    setApiLoading("refresh-batch");
    setApiMessage("正在批量执行刷新计划...");
    try {
      const result = await onRunBatchRefreshPlan();
      setApiMessage(`批量刷新完成：镜头 ${result.handled || 0} 个，资产 ${result.assetCount || 0}，提示词 ${result.promptUpdated || 0}，时间线 ${result.timelineUpdated || 0}。`);
    } catch (error) {
      setApiMessage(`批量刷新失败：${error.message || String(error)}`);
    } finally {
      setApiLoading("");
    }
  }

  return createPortal((
    <aside className="review-center-panel">
      <header>
        <div>
          <strong>审稿反馈</strong>
          <span>{report.episodeName} · 待修改 {report.summary.pendingFix} · 已通过 {report.summary.passed}</span>
        </div>
        <button onClick={onClose}>关闭</button>
      </header>
      <section className="panel-action-strip">
        <div className="panel-action-strip-copy">
          <strong>当前任务</strong>
          <span>{selected?.title || "请选择一个镜头或节点"}</span>
          <p>{reviewTaskHint}</p>
        </div>
        <div className="panel-action-strip-actions">
          <button className="primary" onClick={handleApiReviewBatch} disabled={!report.summary.reviewableShots || Boolean(apiLoading)}>{apiLoading === "batch" ? "批量审稿中..." : "批量 API 审稿"}</button>
          <button onClick={handleApiReviewAndReviseBatch} disabled={!report.summary.reviewableShots || Boolean(apiLoading)}>{apiLoading === "revise-batch" ? "自动修改中..." : "批量自动修改"}</button>
          <button onClick={handleRefreshBatch} disabled={!(refreshPlanCount || report.summary.refreshPlans) || Boolean(apiLoading)}>{apiLoading === "refresh-batch" ? "批量刷新中..." : "执行全局刷新"}</button>
          <button onClick={onGoNextStep} disabled={!reviewWorkflow?.canAdvance}>进入下一步</button>
        </div>
      </section>
      <div className="review-summary">
        <section><b>{report.summary.nodeComments}</b><span>节点评注</span></section>
        <section><b>{report.summary.shotComments}</b><span>镜头评注</span></section>
        <section><b>{report.summary.pendingFix}</b><span>待修改</span></section>
        <section><b>{report.summary.unreviewed || 0}</b><span>未审</span></section>
        <section><b>{report.summary.passed}</b><span>已通过</span></section>
        <section><b>{refreshPlanCount || report.summary.refreshPlans || 0}</b><span>待刷新计划</span></section>
      </div>
      <section className="review-workflow-card">
        <div className="review-workflow-copy">
          <strong>{reviewWorkflow?.headline || "审稿步骤"}</strong>
          <p>{reviewWorkflow?.description || "先审当前镜头，再把待修改镜头处理完，最后进入时间线和导出。"}</p>
          <ol className="review-workflow-steps">
            <li>先点“API审当前镜头”或“API批量审当前集”，让系统先给出可执行意见。</li>
            <li>看结果后，把有问题的镜头定位去修，状态清到“已通过”。</li>
            <li>如果自动修改里带了刷新计划，直接执行刷新计划，把资产和时间线一起回刷。</li>
            <li>待审和待修改清零后，点右侧“进入下一步”。</li>
          </ol>
          {apiMessage ? <small className="result-message">{apiMessage}</small> : null}
        </div>
        <div className="review-workflow-actions">
          <button onClick={handleApiReviewCurrent} disabled={!selected?.shotId || Boolean(apiLoading)}>{apiLoading === selected?.id ? "审稿中..." : "API审当前镜头"}</button>
          <button onClick={handleApiReviewBatch} disabled={!report.summary.reviewableShots || Boolean(apiLoading)}>{apiLoading === "batch" ? "批量审稿中..." : "API批量审当前集"}</button>
          <button onClick={handleApiReviewAndReviseCurrent} disabled={!selected?.shotId || Boolean(apiLoading)}>{apiLoading === `revise:${selected?.id}` ? "自动修改中..." : "审稿并自动修改当前镜头"}</button>
          <button onClick={handleApiReviewAndReviseBatch} disabled={!report.summary.reviewableShots || Boolean(apiLoading)}>{apiLoading === "revise-batch" ? "批量自动修改中..." : "审稿并自动修改当前集"}</button>
          <button onClick={handleRefreshCurrent} disabled={!selected?.autoRevisionReport?.assetRefreshPlan?.length || Boolean(apiLoading)}>{apiLoading === `refresh:${selected?.id}` ? "刷新中..." : "执行当前刷新计划"}</button>
          <button onClick={handleRefreshBatch} disabled={!(refreshPlanCount || report.summary.refreshPlans) || Boolean(apiLoading)}>{apiLoading === "refresh-batch" ? "批量刷新中..." : "执行全局刷新计划"}</button>
          <button onClick={onContinueCurrentStep}>{reviewWorkflow?.currentActionLabel || "继续当前步骤"}</button>
          <button className="primary" onClick={onGoNextStep} disabled={!reviewWorkflow?.canAdvance}>{reviewWorkflow?.nextActionLabel || "进入下一步"}</button>
          <button onClick={onOpenApiSettings}>文本API设置</button>
        </div>
      </section>
      <div className="review-center-body">
        <section className="review-target-list">
          {report.targets.length ? report.targets.map((item) => (
            <button key={item.id} className={item.id === (selected?.id || "") ? "active" : ""} onClick={() => { setTargetId(item.id); setReviewStatus(item.reviewStatus || "待修改"); }}>
              <strong>{item.title}</strong>
              <span>{item.kindLabel} · {item.reviewStatus || "未审"}</span>
              <small>{item.commentCount} 条评注</small>
            </button>
          )) : <div className="asset-empty">当前集还没有可审稿内容。</div>}
        </section>
        <section className="review-center-main">
          {selected ? (
            <>
              <div className="review-target-header">
                <div>
                  <strong>{selected.title}</strong>
                  <span>{selected.kindLabel} · {selected.subtitle}</span>
                </div>
                <div className="health-item-actions">
                  <button onClick={() => onLocate(selected.nodeId)}>定位</button>
                  {selected.shotId && (
                    <select value={reviewStatus} onChange={(event) => { setReviewStatus(event.target.value); onUpdateShotReviewStatus({ nodeId: selected.nodeId, shotId: selected.shotId, reviewStatus: event.target.value }); }}>
                      {reviewStatusOptions.map((item) => <option key={item}>{item}</option>)}
                    </select>
                  )}
                </div>
              </div>
              <div className="review-comment-list">
                {selected.autoRevisionReport?.assetRefreshPlan?.length ? (
                  <section className="review-refresh-card">
                    <header>
                      <strong>自动修改后的刷新计划</strong>
                      <span>{selected.autoRevisionReport.updatedAt ? new Date(selected.autoRevisionReport.updatedAt).toLocaleString() : ""}</span>
                    </header>
                    {selected.autoRevisionReport.summary ? <p>{selected.autoRevisionReport.summary}</p> : null}
                    {selected.autoRevisionReport.changeLog?.length ? <div><strong>修改记录</strong><ul>{selected.autoRevisionReport.changeLog.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div> : null}
                    {selected.autoRevisionReport.fixedIssues?.length ? <div><strong>已解决</strong><ul>{selected.autoRevisionReport.fixedIssues.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div> : null}
                    <div>
                      <strong>待执行刷新</strong>
                      <ul>{selected.autoRevisionReport.assetRefreshPlan.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
                    </div>
                  </section>
                ) : null}
                {selected.comments.length ? selected.comments.map((item) => (
                  <section key={item.id} className="review-comment-item">
                    <header>
                      <strong>{item.author || "导演"}</strong>
                      <span>{new Date(item.createdAt || Date.now()).toLocaleString()}</span>
                    </header>
                    <p>{item.text}</p>
                  </section>
                )) : <div className="asset-empty">还没有评注。</div>}
              </div>
              <div className="review-comment-editor">
                <label>评注人<select value={author} onChange={(event) => setAuthor(event.target.value)}>
                  {(collaborationState?.members || []).map((member) => <option key={member.id || member.name} value={member.name}>{member.name} · {member.role}</option>)}
                </select></label>
                <label>评注意见<textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="例如：这一镜动作不够清楚，建议补一个明确的起点和结束姿态。" /></label>
                <button onClick={submitComment}>添加评注</button>
              </div>
            </>
          ) : <div className="asset-empty">请选择一个节点或镜头。</div>}
        </section>
      </div>
    </aside>
  ), document.body);
}

export function CollaborationCenterPanel({ state, report, onPatchState, onLocate, onClose }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("审稿");

  function addMember() {
    const memberName = String(name || "").trim();
    if (!memberName) return;
    const nextMember = {
      id: `member-${Date.now()}`,
      name: memberName,
      role: String(role || "成员").trim() || "成员",
    };
    onPatchState({
      members: [...(state.members || []), nextMember],
      activeMemberId: state.activeMemberId || nextMember.id,
      activeMemberName: state.activeMemberName || nextMember.name,
    });
    setName("");
  }

  return createPortal((
    <aside className="collab-panel">
      <header>
        <div>
          <strong>协作中心</strong>
          <span>{report.episodeName} · 成员 {report.summary.members} · 操作记录 {report.summary.activities}</span>
        </div>
        <button onClick={onClose}>关闭</button>
      </header>
      <div className="review-summary">
        <section><b>{report.summary.members}</b><span>协作成员</span></section>
        <section><b>{report.summary.activities}</b><span>处理记录</span></section>
        <section><b>{report.summary.pendingFix}</b><span>待修改镜头</span></section>
        <section><b>{report.summary.latestActor || "-"}</b><span>最近处理人</span></section>
      </div>
      <div className="collab-body">
        <section className="collab-members">
          <div className="collab-member-add">
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="新增成员名称" />
            <input value={role} onChange={(event) => setRole(event.target.value)} placeholder="职责" />
            <button onClick={addMember}>添加成员</button>
          </div>
          <label>当前处理人<select value={state.activeMemberId || ""} onChange={(event) => {
            const next = (state.members || []).find((member) => member.id === event.target.value);
            onPatchState({ activeMemberId: event.target.value, activeMemberName: next?.name || "" });
          }}>
            {(state.members || []).map((member) => <option key={member.id} value={member.id}>{member.name} · {member.role}</option>)}
          </select></label>
          <div className="review-target-list">
            {(state.members || []).map((member) => (
              <button key={member.id} className={member.id === state.activeMemberId ? "active" : ""} onClick={() => onPatchState({ activeMemberId: member.id, activeMemberName: member.name })}>
                <strong>{member.name}</strong>
                <span>{member.role}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="collab-activity">
          <strong>处理记录时间线</strong>
          <div className="director-list">
            {(report.activities || []).length ? report.activities.map((item) => (
              <section key={item.id} className="director-item">
                <header>
                  <div className="health-item-meta">
                    <span className="health-level level-建议">{item.actor || "成员"}</span>
                    <span>{new Date(item.createdAt || Date.now()).toLocaleString()}</span>
                  </div>
                  <div className="health-item-actions">
                    {!!item.nodeId && <button onClick={() => onLocate(item.nodeId)}>定位</button>}
                  </div>
                </header>
                <strong>{item.title}</strong>
                <p>{item.detail || ""}</p>
              </section>
            )) : <div className="asset-empty">当前还没有协作记录。</div>}
          </div>
        </section>
      </div>
    </aside>
  ), document.body);
}
