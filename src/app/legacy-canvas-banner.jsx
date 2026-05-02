import React from "react";

export function LegacyCanvasBanner({ onReturnToStudio }) {
  return (
    <div className="compat-canvas-banner">
      <div>
        <strong>兼容画布</strong>
        <span>旧节点视图仅用于迁移和高级检查，主数据以生产工作台为准。</span>
      </div>
      <button type="button" onClick={onReturnToStudio}>返回生产工作台</button>
    </div>
  );
}
