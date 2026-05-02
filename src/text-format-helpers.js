export function buildStoryboardPrompt({ rows, cols, frames }) {
  const lines = [`生成一张${rows}×${cols}的${rows * cols}宫格分镜图，画面风格统一，禁止添加描述文本。`];
  frames.forEach((frame, index) => {
    const text = String(frame || "").trim();
    lines.push(`分镜${index + 1}：${text || "依据之前的内容进行推测"}`);
  });
  return lines.join("\n");
}

export function appendToken(text, token) {
  const current = String(text || "").trimEnd();
  return `${current}${current ? " " : ""}${token} `;
}

export function splitGeminiPrompts(prompt, splitMode = "paragraph") {
  const text = String(prompt || "").trim();
  if (!text) return [];
  let parts;
  if (splitMode === "line") {
    parts = text.split(/\r?\n/);
  } else if (splitMode === "separator") {
    parts = text.split(/\n\s*(?:---+|###|\*\*\*)\s*\n/g);
  } else {
    parts = text.split(/\n\s*\n+/);
  }
  const cleaned = parts.map((item) => item.trim()).filter(Boolean);
  return cleaned.length ? cleaned : [text];
}

export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function dedupeOrderedStrings(values = []) {
  const seen = new Set();
  const result = [];
  values.forEach((value) => {
    const normalized = String(value || "").trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
}

export function compactPromptText(text = "") {
  return String(text || "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/；{2,}/g, "；")
    .replace(/，{2,}/g, "，")
    .trim();
}
