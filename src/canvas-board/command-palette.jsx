import React, { useEffect, useMemo, useRef, useState } from "react";

export function CommandPalette({ open, onClose, items }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (it) => it.label.toLowerCase().includes(q) || (it.hint || "").toLowerCase().includes(q),
    );
  }, [items, query]);

  useEffect(() => {
    if (active >= filtered.length) setActive(0);
  }, [filtered, active]);

  if (!open) return null;

  const handleKey = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = filtered[active];
      if (pick) {
        pick.onRun();
        onClose();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="palette-backdrop" onClick={onClose}>
      <div className="palette-modal" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="输入命令名或快捷词，比如「插入文本」「设置」"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKey}
        />
        <div className="palette-list">
          {filtered.length === 0 && <div className="palette-empty">没有匹配的命令</div>}
          {filtered.map((item, idx) => (
            <button
              key={item.id}
              className={`palette-item ${idx === active ? "is-active" : ""}`}
              onMouseEnter={() => setActive(idx)}
              onClick={() => {
                item.onRun();
                onClose();
              }}
            >
              <span className="palette-item-label">{item.label}</span>
              {item.hint && <span className="palette-item-hint">{item.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
