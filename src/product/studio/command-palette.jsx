import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { buildCommandPaletteItems, filterCommandPaletteItems } from "./command-palette-helpers.js";

export { buildCommandPaletteItems, filterCommandPaletteItems };

export function CommandPalette({ open, onClose, actions, navigateView }) {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef(null);

  const items = useMemo(() => buildCommandPaletteItems({ actions, navigateView }), [actions, navigateView]);
  const filtered = useMemo(() => filterCommandPaletteItems(items, query), [items, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHighlight(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  if (!open || typeof document === "undefined") return null;

  function execute(item) {
    if (!item) return;
    try {
      item.run();
    } finally {
      onClose?.();
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose?.();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((current) => Math.min(current + 1, Math.max(0, filtered.length - 1)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      execute(filtered[highlight]);
    }
  }

  return createPortal(
    <div className="command-palette-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="command-palette-panel" onClick={(event) => event.stopPropagation()}>
        <input
          ref={inputRef}
          className="command-palette-input"
          placeholder="搜索命令、面板、视图..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="命令搜索"
        />
        <ul className="command-palette-list" role="listbox">
          {filtered.length === 0 ? (
            <li className="command-palette-empty">没有匹配的命令</li>
          ) : filtered.map((item, index) => (
            <li
              key={item.key}
              role="option"
              aria-selected={index === highlight}
              className={`command-palette-item${index === highlight ? " is-active" : ""}`}
              onMouseEnter={() => setHighlight(index)}
              onClick={() => execute(item)}
            >
              <strong>{item.label}</strong>
              <span>{item.hint}</span>
            </li>
          ))}
        </ul>
        <div className="command-palette-footer">
          <span>↑↓ 选择</span>
          <span>Enter 执行</span>
          <span>Esc 关闭</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
