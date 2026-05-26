import React, { useEffect, useState } from "react";
import { loadAiSettings, saveAiSettings } from "./ai-services.js";

const FIELDS = [
  { group: "文本", endpoint: "textEndpoint", apiKey: "textApiKey", model: "textModel", placeholder: "https://.../v1/chat/completions" },
  { group: "图像", endpoint: "imageEndpoint", apiKey: "imageApiKey", model: "imageModel", placeholder: "https://.../v1/images/generations" },
  { group: "视频", endpoint: "videoEndpoint", apiKey: "videoApiKey", model: "videoModel", placeholder: "https://.../v1/videos/generations" },
];

export function SettingsDialog({ open, onClose }) {
  const [draft, setDraft] = useState(loadAiSettings);

  useEffect(() => {
    if (open) setDraft(loadAiSettings());
  }, [open]);

  if (!open) return null;

  const update = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));

  const save = () => {
    saveAiSettings(draft);
    onClose();
  };

  return (
    <div className="settings-backdrop" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-head">
          <h3>AI 服务配置</h3>
          <button className="settings-btn settings-btn-ghost" onClick={onClose}>
            关闭
          </button>
        </div>
        <div className="settings-body">
          {FIELDS.map((field) => (
            <div key={field.group} className="settings-group">
              <div className="settings-group-title">{field.group}</div>
              <label className="settings-field">
                <span>接口地址</span>
                <input
                  value={draft[field.endpoint] || ""}
                  placeholder={field.placeholder}
                  onChange={(e) => update(field.endpoint, e.target.value)}
                />
              </label>
              <label className="settings-field">
                <span>API Key</span>
                <input
                  type="password"
                  value={draft[field.apiKey] || ""}
                  placeholder="留空则不带 Authorization 头"
                  onChange={(e) => update(field.apiKey, e.target.value)}
                />
              </label>
              <label className="settings-field">
                <span>模型</span>
                <input
                  value={draft[field.model] || ""}
                  placeholder={field.group === "文本" ? "gpt-4o-mini" : "可选"}
                  onChange={(e) => update(field.model, e.target.value)}
                />
              </label>
            </div>
          ))}
          <div className="settings-hint">
            未配置接口时，对应类型的 shape 会返回占位结果，不影响画布操作。
          </div>
        </div>
        <div className="settings-foot">
          <button className="settings-btn settings-btn-ghost" onClick={onClose}>
            取消
          </button>
          <button className="settings-btn settings-btn-primary" onClick={save}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
