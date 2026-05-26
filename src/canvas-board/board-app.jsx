import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Tldraw, createShapeId, useEditor, useValue } from "tldraw";
import "tldraw/tldraw.css";
import { AiTextShapeUtil } from "./shapes/ai-text-shape.jsx";
import { AiImageShapeUtil } from "./shapes/ai-image-shape.jsx";
import { AiVideoShapeUtil } from "./shapes/ai-video-shape.jsx";
import { AiPromptShapeUtil } from "./shapes/ai-prompt-shape.jsx";
import { generateText, generateImage, generateVideo } from "./ai-services.js";
import { SettingsDialog } from "./settings-dialog.jsx";
import { CommandPalette } from "./command-palette.jsx";

const SHAPE_UTILS = [AiTextShapeUtil, AiImageShapeUtil, AiVideoShapeUtil, AiPromptShapeUtil];

const INSERT_ITEMS = [
  { type: "ai-text", label: "📝 文本", title: "插入文本生成块" },
  { type: "ai-image", label: "🎨 图像", title: "插入图像生成块" },
  { type: "ai-video", label: "🎬 视频", title: "插入视频生成块" },
  { type: "ai-prompt", label: "💬 Prompt", title: "插入提示词模板块" },
];

const SHAPE_SIZE = {
  "ai-text": { w: 320, h: 260 },
  "ai-image": { w: 360, h: 420 },
  "ai-video": { w: 380, h: 480 },
  "ai-prompt": { w: 280, h: 220 },
};

export function BoardApp() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (e.key === "Escape") {
        setPaletteOpen(false);
        setSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="board-app">
      <Tldraw
        persistenceKey="wuxianhuabu-board-v1"
        shapeUtils={SHAPE_UTILS}
        components={{
          InFrontOfTheCanvas: () => (
            <BoardOverlay
              onOpenSettings={() => setSettingsOpen(true)}
              onOpenPalette={() => setPaletteOpen(true)}
            />
          ),
        }}
      />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <PaletteHost
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
    </div>
  );
}

function BoardOverlay({ onOpenSettings, onOpenPalette }) {
  const editor = useEditor();
  useEffect(() => {
    window.__boardEditor = editor;
    return () => {
      if (window.__boardEditor === editor) window.__boardEditor = null;
    };
  }, [editor]);
  return (
    <>
      <InsertToolbar editor={editor} onOpenSettings={onOpenSettings} onOpenPalette={onOpenPalette} />
      <SelectionToolbar editor={editor} />
    </>
  );
}

function insertShapeAtViewportCenter(editor, type) {
  const center = editor.getViewportPageCenter();
  const size = SHAPE_SIZE[type];
  const id = createShapeId();
  editor.createShape({
    id,
    type,
    x: center.x - size.w / 2,
    y: center.y - size.h / 2,
  });
  editor.select(id);
}

function InsertToolbar({ editor, onOpenSettings, onOpenPalette }) {
  return (
    <div className="board-toolbar board-toolbar-insert">
      {INSERT_ITEMS.map((item) => (
        <button
          key={item.type}
          className="board-toolbar-btn"
          title={item.title}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => insertShapeAtViewportCenter(editor, item.type)}
        >
          {item.label}
        </button>
      ))}
      <div className="board-toolbar-sep" />
      <button
        className="board-toolbar-btn"
        title="命令面板 (⌘K / Ctrl+K)"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onOpenPalette}
      >
        ⌘K
      </button>
      <button
        className="board-toolbar-btn"
        title="AI 服务配置"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onOpenSettings}
      >
        ⚙
      </button>
    </div>
  );
}

function SelectionToolbar({ editor }) {
  const selected = useValue(
    "board-only-selected-shape",
    () => {
      const ids = editor.getSelectedShapeIds();
      if (ids.length !== 1) return null;
      const s = editor.getShape(ids[0]);
      if (!s) return null;
      if (!["ai-text", "ai-image", "ai-video", "ai-prompt"].includes(s.type)) return null;
      return s;
    },
    [editor],
  );

  const [busy, setBusy] = useState(false);

  if (!selected) return null;

  const regenerate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (selected.type === "ai-text") {
        editor.updateShape({ id: selected.id, type: selected.type, props: { ...selected.props, status: "loading", error: "" } });
        const res = await generateText(selected.props.prompt);
        editor.updateShape({ id: selected.id, type: selected.type, props: { ...selected.props, result: res.text || "", status: res.mock ? "mock" : "ok", error: "" } });
      } else if (selected.type === "ai-image") {
        editor.updateShape({ id: selected.id, type: selected.type, props: { ...selected.props, status: "loading", error: "" } });
        const res = await generateImage(selected.props.prompt);
        editor.updateShape({ id: selected.id, type: selected.type, props: { ...selected.props, imageUrl: res.imageUrl || "", status: res.mock ? "mock" : "ok", error: "" } });
      } else if (selected.type === "ai-video") {
        editor.updateShape({ id: selected.id, type: selected.type, props: { ...selected.props, status: "loading", error: "" } });
        const res = await generateVideo(selected.props.prompt, { sourceImageUrl: selected.props.sourceImageUrl });
        editor.updateShape({ id: selected.id, type: selected.type, props: { ...selected.props, videoUrl: res.videoUrl || "", status: res.mock ? "mock" : "ok", error: res.note || "" } });
      }
    } catch (err) {
      editor.updateShape({ id: selected.id, type: selected.type, props: { ...selected.props, status: "error", error: String(err?.message || err) } });
    } finally {
      setBusy(false);
    }
  };

  const chainTo = (targetType, prompt, extras = {}) => {
    const sourceSize = SHAPE_SIZE[selected.type];
    const id = createShapeId();
    editor.createShape({
      id,
      type: targetType,
      x: selected.x + sourceSize.w + 32,
      y: selected.y,
      props: { ...editor.getShapeUtil(targetType).getDefaultProps(), prompt, ...extras },
    });
    editor.select(id);
  };

  const actions = [];
  if (selected.type === "ai-text") {
    actions.push({ label: "重新生成", onClick: regenerate });
    if (selected.props.result) {
      actions.push({ label: "→ 用结果做图", onClick: () => chainTo("ai-image", selected.props.result) });
    }
  } else if (selected.type === "ai-image") {
    actions.push({ label: "重新生成", onClick: regenerate });
    if (selected.props.imageUrl) {
      actions.push({
        label: "→ 图生视频",
        onClick: () => chainTo("ai-video", selected.props.prompt, { sourceImageUrl: selected.props.imageUrl }),
      });
    }
  } else if (selected.type === "ai-video") {
    actions.push({ label: "重新生成", onClick: regenerate });
  } else if (selected.type === "ai-prompt") {
    actions.push({ label: "→ 文本生成", onClick: () => chainTo("ai-text", selected.props.body) });
    actions.push({ label: "→ 图像生成", onClick: () => chainTo("ai-image", selected.props.body) });
  }

  return (
    <div className="board-toolbar board-toolbar-selection">
      <span className="board-toolbar-tag">
        {selected.type === "ai-text" && "📝"}
        {selected.type === "ai-image" && "🎨"}
        {selected.type === "ai-video" && "🎬"}
        {selected.type === "ai-prompt" && "💬"}
      </span>
      {actions.map((action) => (
        <button
          key={action.label}
          className="board-toolbar-btn"
          disabled={busy}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

function PaletteHost({ open, onClose, onOpenSettings }) {
  const items = useMemo(() => {
    const ed = window.__boardEditor;
    const list = INSERT_ITEMS.map((item) => ({
      id: `insert-${item.type}`,
      label: `插入 ${item.label}`,
      hint: item.type,
      onRun: () => ed && insertShapeAtViewportCenter(ed, item.type),
    }));
    list.push({
      id: "open-settings",
      label: "打开 AI 服务配置",
      hint: "settings",
      onRun: onOpenSettings,
    });
    list.push({
      id: "zoom-to-fit",
      label: "缩放至内容",
      hint: "zoom fit",
      onRun: () => ed?.zoomToFit({ animation: { duration: 220 } }),
    });
    return list;
  }, [onOpenSettings, open]);

  return <CommandPalette open={open} onClose={onClose} items={items} />;
}
