import React from "react";
import { createPortal } from "react-dom";

export function MinimapPanel({ nodes, view, selectedNodeId, profile, helpers }) {
  const bounds = helpers.getNodeBounds(nodes);
  const scale = bounds.width && bounds.height ? Math.min(160 / bounds.width, 120 / bounds.height) : 1;
  const viewport = {
    x: (-view.x / (view.scale || 1) - bounds.minX) * scale,
    y: (-view.y / (view.scale || 1) - bounds.minY) * scale,
    width: (window.innerWidth / (view.scale || 1)) * scale,
    height: (window.innerHeight / (view.scale || 1)) * scale,
  };
  return createPortal((
    <aside className={`minimap-panel profile-${profile}`}>
      <header>
        <strong>小地图</strong>
        <span>{nodes.length} 节点</span>
      </header>
      <div className="minimap-canvas">
        {nodes.map((node) => (
          <span
            key={node.id}
            className={`minimap-node ${node.id === selectedNodeId ? "active" : ""}`}
            style={{
              left: (node.x - bounds.minX) * scale,
              top: (node.y - bounds.minY) * scale,
              width: Math.max(4, node.width * scale),
              height: Math.max(4, node.height * scale),
            }}
          />
        ))}
        <span
          className="minimap-viewport"
          style={{
            left: viewport.x,
            top: viewport.y,
            width: Math.max(12, viewport.width),
            height: Math.max(12, viewport.height),
          }}
        />
      </div>
    </aside>
  ), document.body);
}
