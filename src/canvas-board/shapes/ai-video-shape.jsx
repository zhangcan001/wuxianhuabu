import React, { useState } from "react";
import { BaseBoxShapeUtil, HTMLContainer, T, stopEventPropagation, useEditor } from "tldraw";
import { generateVideo } from "../ai-services.js";

export class AiVideoShapeUtil extends BaseBoxShapeUtil {
  static type = "ai-video";

  static props = {
    w: T.number,
    h: T.number,
    prompt: T.string,
    sourceImageUrl: T.string,
    videoUrl: T.string,
    status: T.string,
    error: T.string,
  };

  getDefaultProps() {
    return {
      w: 380,
      h: 480,
      prompt: "",
      sourceImageUrl: "",
      videoUrl: "",
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
        <AiVideoCard shape={shape} />
      </HTMLContainer>
    );
  }
}

function AiVideoCard({ shape }) {
  const editor = useEditor();
  const [prompt, setPrompt] = useState(shape.props.prompt);
  const [sourceImageUrl, setSourceImageUrl] = useState(shape.props.sourceImageUrl);

  const update = (patch) => {
    editor.updateShape({ id: shape.id, type: shape.type, props: { ...shape.props, ...patch } });
  };

  const runGenerate = async () => {
    update({ prompt, sourceImageUrl, status: "loading", error: "" });
    try {
      const res = await generateVideo(prompt, { sourceImageUrl });
      update({
        videoUrl: res.videoUrl || "",
        status: res.mock ? "mock" : "ok",
        error: res.note || "",
      });
    } catch (err) {
      update({ status: "error", error: String(err?.message || err) });
    }
  };

  const busy = shape.props.status === "loading";

  return (
    <div className="ai-card ai-card-video" onPointerDown={stopEventPropagation}>
      <div className="ai-card-head">
        <span className="ai-card-tag">🎬 视频</span>
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
        placeholder="描述镜头，比如：一只猫慢慢转头看向镜头"
        value={prompt}
        onPointerDown={stopEventPropagation}
        onChange={(e) => setPrompt(e.target.value)}
        onBlur={() => update({ prompt })}
      />
      <input
        className="ai-card-input ai-card-input-line"
        placeholder="可选：参考图 URL（图生视频时填）"
        value={sourceImageUrl}
        onPointerDown={stopEventPropagation}
        onChange={(e) => setSourceImageUrl(e.target.value)}
        onBlur={() => update({ sourceImageUrl })}
      />
      <div className={`ai-card-video-body ${shape.props.status === "error" ? "is-error" : ""}`}>
        {shape.props.status === "error" ? (
          <div className="ai-card-error">{shape.props.error}</div>
        ) : shape.props.videoUrl ? (
          <video src={shape.props.videoUrl} controls />
        ) : (
          <span className="ai-card-hint">
            {shape.props.status === "mock"
              ? shape.props.error || "占位结果 · 未配置 API"
              : "视频会显示在这里"}
          </span>
        )}
      </div>
    </div>
  );
}
