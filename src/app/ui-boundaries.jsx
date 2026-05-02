import React from "react";
import { createPortal } from "react-dom";
import {
  UiErrorBoundary,
} from "./lazy-components.jsx";

export function PanelErrorFallback({ title = "面板", error, onRetry, onClose }) {
  return createPortal((
    <div className="panel-loading-backdrop">
      <div className="panel-error-card">
        <strong>{title}打开失败</strong>
        <span>{error?.message || "发生了未预期的错误。"}</span>
        <div className="panel-error-actions">
          <button onClick={onRetry}>重试</button>
          <button onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  ), document.body);
}

export function AppErrorFallback({ error, onRetry }) {
  return (
    <main className="app-crash-screen">
      <div className="app-crash-card">
        <strong>软件界面加载失败</strong>
        <span>{error?.message || "发生了未预期的错误。"}</span>
        <button onClick={onRetry}>重新加载界面</button>
      </div>
    </main>
  );
}

export function NodeErrorFallback({ label = "节点", error, onRetry }) {
  return (
    <div className="node-error-inline">
      <strong>{label}加载失败</strong>
      <span>{error?.message || "这个节点暂时打不开。"}</span>
      <button onClick={onRetry}>重试</button>
    </div>
  );
}

export function GuardedPanel({ title, onClose, resetKey, children }) {
  return (
    <UiErrorBoundary
      label={title}
      resetKey={resetKey}
      fallback={({ error, reset }) => (
        <PanelErrorFallback
          title={title}
          error={error}
          onRetry={reset}
          onClose={onClose}
        />
      )}
    >
      {children}
    </UiErrorBoundary>
  );
}

export function GuardedNode({ label, nodeId, children }) {
  return (
    <UiErrorBoundary
      label={label}
      resetKey={nodeId}
      fallback={({ error, reset }) => (
        <NodeErrorFallback label={label} error={error} onRetry={reset} />
      )}
    >
      {children}
    </UiErrorBoundary>
  );
}

export function PanelLoadingFallback({ label = "加载中" }) {
  return createPortal((
    <div className="panel-loading-backdrop">
      <div className="panel-loading-card">
        <strong>{label}</strong>
        <span>正在按需载入面板内容...</span>
      </div>
    </div>
  ), document.body);
}

export function NodeLoadingFallback({ label = "节点载入中" }) {
  return <div className="node-loading-inline">{label}...</div>;
}
