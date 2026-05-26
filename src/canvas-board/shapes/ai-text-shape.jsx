import React, { useState } from "react";
import { BaseBoxShapeUtil, HTMLContainer, T, stopEventPropagation, useEditor } from "tldraw";
import { generateText } from "../ai-services.js";

export class AiTextShapeUtil extends BaseBoxShapeUtil {
  static type = "ai-text";

  static props = {
    w: T.number,
    h: T.number,
    prompt: T.string,
    result: T.string,
    status: T.string,
    error: T.string,
  };

  getDefaultProps() {
    return {
      w: 320,
      h: 260,
      prompt: "",
      result: "",
      status: "idle",
      error: "",
    };
  }

  canResize = () => true;
  canEdit = () => true;
  isAspectRatioLocked = () => false;

  indicator(shape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={14} ry={14} />;
  }

  component(shape) {
    return (
      <HTMLContainer style={{ pointerEvents: "all" }}>
        <AiTextCard shape={shape} />
      </HTMLContainer>
    );
  }
}

function AiTextCard({ shape }) {
  const editor = useEditor();
  const [prompt, setPrompt] = useState(shape.props.prompt);

  const update = (patch) => {
    editor.updateShape({ id: shape.id, type: shape.type, props: { ...shape.props, ...patch } });
  };

  const runGenerate = async () => {
    update({ prompt, status: "loading", error: "" });
    try {
      const res = await generateText(prompt);
      update({ result: res.text || "", status: res.mock ? "mock" : "ok", error: "" });
    } catch (err) {
      update({ status: "error", error: String(err?.message || err) });
    }
  };

  const busy = shape.props.status === "loading";

  return (
    <div className="ai-card ai-card-text" onPointerDown={stopEventPropagation}>
      <div className="ai-card-head">
        <span className="ai-card-tag">📝 文本</span>
        <button
          className="ai-card-btn"
          disabled={busy}
          onPointerDown={stopEventPropagation}
          onClick={runGenerate}
        >
          {busy ? "生成中…" : "生成"}
        </button>
      </div>
      <textarea
        className="ai-card-input"
        placeholder="写一段提示词，比如：写一首关于春天的短诗"
        value={prompt}
        onPointerDown={stopEventPropagation}
        onChange={(e) => setPrompt(e.target.value)}
        onBlur={() => update({ prompt })}
      />
      <div className={`ai-card-body ${shape.props.status === "error" ? "is-error" : ""}`}>
        {shape.props.status === "error"
          ? shape.props.error
          : shape.props.result || <span className="ai-card-hint">输出会显示在这里</span>}
      </div>
      {shape.props.status === "mock" && <div className="ai-card-foot">占位结果 · 未配置 API</div>}
    </div>
  );
}
