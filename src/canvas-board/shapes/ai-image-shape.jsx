import React, { useState } from "react";
import { BaseBoxShapeUtil, HTMLContainer, T, stopEventPropagation, useEditor } from "tldraw";
import { generateImage } from "../ai-services.js";

export class AiImageShapeUtil extends BaseBoxShapeUtil {
  static type = "ai-image";

  static props = {
    w: T.number,
    h: T.number,
    prompt: T.string,
    imageUrl: T.string,
    status: T.string,
    error: T.string,
  };

  getDefaultProps() {
    return {
      w: 360,
      h: 420,
      prompt: "",
      imageUrl: "",
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
        <AiImageCard shape={shape} />
      </HTMLContainer>
    );
  }
}

function AiImageCard({ shape }) {
  const editor = useEditor();
  const [prompt, setPrompt] = useState(shape.props.prompt);

  const update = (patch) => {
    editor.updateShape({ id: shape.id, type: shape.type, props: { ...shape.props, ...patch } });
  };

  const runGenerate = async () => {
    update({ prompt, status: "loading", error: "" });
    try {
      const res = await generateImage(prompt);
      update({ imageUrl: res.imageUrl || "", status: res.mock ? "mock" : "ok", error: "" });
    } catch (err) {
      update({ status: "error", error: String(err?.message || err) });
    }
  };

  const busy = shape.props.status === "loading";

  return (
    <div className="ai-card ai-card-image" onPointerDown={stopEventPropagation}>
      <div className="ai-card-head">
        <span className="ai-card-tag">🎨 图像</span>
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
        placeholder="描述你想要的画面，比如：黄昏湖边一只独自望天的猫"
        value={prompt}
        onPointerDown={stopEventPropagation}
        onChange={(e) => setPrompt(e.target.value)}
        onBlur={() => update({ prompt })}
      />
      <div className={`ai-card-image-body ${shape.props.status === "error" ? "is-error" : ""}`}>
        {shape.props.status === "error" ? (
          <div className="ai-card-error">{shape.props.error}</div>
        ) : shape.props.imageUrl ? (
          <img src={shape.props.imageUrl} alt="" draggable={false} />
        ) : (
          <span className="ai-card-hint">图像会显示在这里</span>
        )}
      </div>
      {shape.props.status === "mock" && <div className="ai-card-foot">占位图 · 未配置 API</div>}
    </div>
  );
}
