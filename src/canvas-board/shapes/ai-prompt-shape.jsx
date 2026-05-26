import React, { useState } from "react";
import { BaseBoxShapeUtil, HTMLContainer, T, stopEventPropagation, useEditor } from "tldraw";

export class AiPromptShapeUtil extends BaseBoxShapeUtil {
  static type = "ai-prompt";

  static props = {
    w: T.number,
    h: T.number,
    title: T.string,
    body: T.string,
  };

  getDefaultProps() {
    return {
      w: 280,
      h: 220,
      title: "提示词",
      body: "",
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
        <AiPromptCard shape={shape} />
      </HTMLContainer>
    );
  }
}

function AiPromptCard({ shape }) {
  const editor = useEditor();
  const [title, setTitle] = useState(shape.props.title);
  const [body, setBody] = useState(shape.props.body);

  const commit = (patch) => {
    editor.updateShape({ id: shape.id, type: shape.type, props: { ...shape.props, ...patch } });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="ai-card ai-card-prompt" onPointerDown={stopEventPropagation}>
      <div className="ai-card-head">
        <input
          className="ai-card-title"
          value={title}
          onPointerDown={stopEventPropagation}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => commit({ title })}
        />
        <button
          className="ai-card-btn ai-card-btn-ghost"
          onPointerDown={stopEventPropagation}
          onClick={copy}
        >
          复制
        </button>
      </div>
      <textarea
        className="ai-card-input ai-card-input-grow"
        placeholder="把可复用的提示词模板放进来"
        value={body}
        onPointerDown={stopEventPropagation}
        onChange={(e) => setBody(e.target.value)}
        onBlur={() => commit({ body })}
      />
    </div>
  );
}
