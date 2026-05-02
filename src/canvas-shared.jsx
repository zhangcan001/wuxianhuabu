import React, { useEffect, useState } from "react";

export function AssetTokenInsertRow({ assetIndex, onInsert }) {
  const options = Array.isArray(assetIndex?.items)
    ? assetIndex.items.filter((asset) => asset && typeof asset === "object" && asset.token)
    : [];
  const [token, setToken] = useState(options[0]?.token || "");

  useEffect(() => {
    if (!options.length) {
      setToken("");
      return;
    }
    if (!options.some((asset) => asset.token === token)) setToken(options[0].token);
  }, [options, token]);

  return (
    <div className="asset-insert-row">
      <select value={token} onChange={(event) => setToken(event.target.value)} disabled={!options.length}>
        {options.length ? options.map((asset) => (
          <option key={asset.token} value={asset.token}>{asset.category} · {asset.name}</option>
        )) : <option value="">暂无资产引用</option>}
      </select>
      <button disabled={!token} onClick={() => onInsert(token)}>插入引用</button>
    </div>
  );
}

export function NodeHeader({ icon, title, right }) {
  return <header className="node-header"><span>{icon}</span><strong>{title}</strong>{right}</header>;
}

export function Counter({ label, value, min, max, onChange, clamp }) {
  return <div className="counter"><span>{label}</span><button onClick={() => onChange(clamp(value - 1, min, max))}>−</button><b>{value}</b><button onClick={() => onChange(clamp(value + 1, min, max))}>＋</button></div>;
}
