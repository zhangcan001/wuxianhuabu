import React, { useState } from "react";

const MODE_OPTIONS = [
  {
    key: "mock",
    title: "试试看（本地模拟）",
    tag: "推荐新手",
    description: "不需要任何 API 密钥，所有图片用占位卡。先把整个流程走通再说。",
    bullets: ["零配置", "0 秒上手", "出图是占位卡，不是真图"],
  },
  {
    key: "custom",
    title: "我有 API 密钥",
    tag: "出真图",
    description: "已有 LinAPI / OpenAI 兼容 / 火山方舟等接口。下一步填密钥即可。",
    bullets: ["真出图", "需要 URL + Key", "支持常见兼容接口"],
  },
  {
    key: "comfy",
    title: "我用 ComfyUI",
    tag: "本地出图",
    description: "本机已经跑着 ComfyUI（127.0.0.1:8188）。下一步选工作流。",
    bullets: ["完全本地", "需要先开 ComfyUI", "可加载自定义工作流"],
  },
];

const API_PRESETS = [
  {
    key: "openai",
    label: "OpenAI / 兼容接口（chat/completions）",
    apiUrl: "https://api.openai.com/v1/chat/completions",
    apiKind: "openai-compatible",
    resultMode: "auto",
    model: "gpt-image-1",
  },
  {
    key: "linapi",
    label: "LinAPI（OpenAI 兼容）",
    apiUrl: "https://api.linapi.com/v1/chat/completions",
    apiKind: "openai-compatible",
    resultMode: "auto",
    model: "gpt-4o",
  },
  {
    key: "doubao-draw",
    label: "火山方舟 / 豆包绘画（draw 轮询）",
    apiUrl: "https://ark.cn-beijing.volces.com/api/v3/draw/submit",
    apiKind: "draw-poll",
    resultMode: "task-id",
    model: "doubao-seedream-3-0-t2i",
  },
  {
    key: "stability",
    label: "Stability / 直返图片",
    apiUrl: "https://api.stability.ai/v2beta/stable-image/generate/core",
    apiKind: "direct-image",
    resultMode: "url",
    model: "stable-image-core",
  },
];

function ModeStep({ selectedMode, onSelect }) {
  return (
    <div className="onboarding-step">
      <h2 className="onboarding-title">先选一种使用方式</h2>
      <p className="onboarding-subtitle">随时可以在「设置」里改，先选一个能跑通的开始。</p>
      <div className="onboarding-mode-grid">
        {MODE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            className={`onboarding-mode-card${selectedMode === opt.key ? " is-selected" : ""}`}
            onClick={() => onSelect(opt.key)}
          >
            <div className="onboarding-mode-head">
              <span className="onboarding-mode-title">{opt.title}</span>
              <span className="onboarding-mode-tag">{opt.tag}</span>
            </div>
            <p className="onboarding-mode-desc">{opt.description}</p>
            <ul className="onboarding-mode-bullets">
              {opt.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </button>
        ))}
      </div>
    </div>
  );
}

function ApiSetupStep({ presetKey, setPresetKey, apiKey, setApiKey, apiUrl, setApiUrl }) {
  return (
    <div className="onboarding-step">
      <h2 className="onboarding-title">填一下 API 信息</h2>
      <p className="onboarding-subtitle">不知道选哪个？挑你已经申请过的服务，没有就回上一步选「本地模拟」。</p>

      <label className="onboarding-field">
        <span className="onboarding-field-label">选一个常见服务（自动填默认参数）</span>
        <div className="onboarding-preset-grid">
          {API_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              className={`onboarding-preset-card${presetKey === preset.key ? " is-selected" : ""}`}
              onClick={() => {
                setPresetKey(preset.key);
                setApiUrl(preset.apiUrl);
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </label>

      <label className="onboarding-field">
        <span className="onboarding-field-label">API URL</span>
        <input
          type="text"
          className="onboarding-input"
          value={apiUrl}
          onChange={(event) => setApiUrl(event.target.value)}
          placeholder="https://api.example.com/v1/chat/completions"
          spellCheck={false}
          autoComplete="off"
        />
      </label>

      <label className="onboarding-field">
        <span className="onboarding-field-label">API Key（仅本地保存）</span>
        <input
          type="password"
          className="onboarding-input"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="sk-..."
          spellCheck={false}
          autoComplete="off"
        />
      </label>

      <div className="onboarding-hint">
        留空也能继续，进了软件再去「设置 → 接口配置」补也行。
      </div>
    </div>
  );
}

function ComfySetupStep({ comfyUrl, setComfyUrl }) {
  return (
    <div className="onboarding-step">
      <h2 className="onboarding-title">连接你的 ComfyUI</h2>
      <p className="onboarding-subtitle">默认地址通常是本机 127.0.0.1:8188，先确认 ComfyUI 已经在后台跑着。</p>
      <label className="onboarding-field">
        <span className="onboarding-field-label">ComfyUI 地址</span>
        <input
          type="text"
          className="onboarding-input"
          value={comfyUrl}
          onChange={(event) => setComfyUrl(event.target.value)}
          placeholder="http://127.0.0.1:8188"
          spellCheck={false}
          autoComplete="off"
        />
      </label>
      <div className="onboarding-hint">
        启动后可以在「设置 → ComfyUI 通道」里加载工作流 JSON、跑连接诊断。
      </div>
    </div>
  );
}

function StarterStep({ loadExample, setLoadExample }) {
  return (
    <div className="onboarding-step">
      <h2 className="onboarding-title">最后一步：要不要带一个示例项目？</h2>
      <p className="onboarding-subtitle">里面已经塞好了小说文本、3 个示例镜头、2 位角色和 1 个场景。点开就能看到完整流程长什么样。</p>
      <div className="onboarding-starter-grid">
        <button
          type="button"
          className={`onboarding-starter-card${loadExample ? " is-selected" : ""}`}
          onClick={() => setLoadExample(true)}
        >
          <span className="onboarding-starter-title">📂 加载示例项目「雪夜灯下」</span>
          <p className="onboarding-starter-desc">推荐第一次使用。可以直接点示例镜头里的「生成图片」按钮看完整流程。</p>
        </button>
        <button
          type="button"
          className={`onboarding-starter-card${!loadExample ? " is-selected" : ""}`}
          onClick={() => setLoadExample(false)}
        >
          <span className="onboarding-starter-title">🗒️ 从空白项目开始</span>
          <p className="onboarding-starter-desc">直接进生产工作台，自己粘贴小说。</p>
        </button>
      </div>
    </div>
  );
}

export function OnboardingWizard({ onComplete, onSkip }) {
  const [step, setStep] = useState(0);
  const [selectedMode, setSelectedMode] = useState("mock");
  const [presetKey, setPresetKey] = useState("openai");
  const [apiUrl, setApiUrl] = useState(API_PRESETS[0].apiUrl);
  const [apiKey, setApiKey] = useState("");
  const [comfyUrl, setComfyUrl] = useState("http://127.0.0.1:8188");
  const [loadExample, setLoadExample] = useState(true);

  const totalSteps = selectedMode === "mock" ? 2 : 3;
  const isLastStep = step === totalSteps - 1;

  function handleNext() {
    if (!isLastStep) {
      setStep((current) => current + 1);
      return;
    }
    const preset = API_PRESETS.find((item) => item.key === presetKey) || API_PRESETS[0];
    const settings = { providerMode: selectedMode };
    if (selectedMode === "custom") {
      settings.customApiUrl = apiUrl.trim();
      settings.customApiKey = apiKey.trim();
      settings.customApiKind = preset.apiKind;
      settings.customResultMode = preset.resultMode;
      settings.customModel = preset.model;
    } else if (selectedMode === "comfy") {
      settings.comfyEnabled = true;
      settings.comfyBaseUrl = comfyUrl.trim() || "http://127.0.0.1:8188";
    }
    onComplete({ mode: selectedMode, settings, loadExample });
  }

  function handleBack() {
    if (step > 0) setStep((current) => current - 1);
  }

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true">
      <div className="onboarding-modal">
        <header className="onboarding-header">
          <span className="onboarding-brand">无限画布 · 火山 AI 漫剧</span>
          <button type="button" className="onboarding-skip" onClick={onSkip}>
            稍后再说
          </button>
        </header>

        <div className="onboarding-progress">
          {Array.from({ length: totalSteps }).map((_, idx) => (
            <span key={idx} className={`onboarding-progress-dot${idx <= step ? " is-active" : ""}`} />
          ))}
        </div>

        <div className="onboarding-body">
          {step === 0 && (
            <ModeStep selectedMode={selectedMode} onSelect={setSelectedMode} />
          )}
          {step === 1 && selectedMode === "custom" && (
            <ApiSetupStep
              presetKey={presetKey}
              setPresetKey={setPresetKey}
              apiKey={apiKey}
              setApiKey={setApiKey}
              apiUrl={apiUrl}
              setApiUrl={setApiUrl}
            />
          )}
          {step === 1 && selectedMode === "comfy" && (
            <ComfySetupStep comfyUrl={comfyUrl} setComfyUrl={setComfyUrl} />
          )}
          {step === 1 && selectedMode === "mock" && (
            <StarterStep loadExample={loadExample} setLoadExample={setLoadExample} />
          )}
          {step === 2 && (
            <StarterStep loadExample={loadExample} setLoadExample={setLoadExample} />
          )}
        </div>

        <footer className="onboarding-footer">
          <button
            type="button"
            className="onboarding-btn onboarding-btn-ghost"
            onClick={handleBack}
            disabled={step === 0}
          >
            上一步
          </button>
          <button
            type="button"
            className="onboarding-btn onboarding-btn-primary"
            onClick={handleNext}
          >
            {isLastStep ? "完成，进入工作台" : "下一步"}
          </button>
        </footer>
      </div>
    </div>
  );
}
