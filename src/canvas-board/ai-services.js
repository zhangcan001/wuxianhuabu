const SETTINGS_KEY = "wuxianhuabu.board.aiServices.v1";

const DEFAULT_SETTINGS = {
  textEndpoint: "",
  textApiKey: "",
  textModel: "gpt-4o-mini",
  imageEndpoint: "",
  imageApiKey: "",
  imageModel: "",
  videoEndpoint: "",
  videoApiKey: "",
  videoModel: "",
};

export function loadAiSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveAiSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, ...settings }));
  } catch {
    /* ignore quota errors */
  }
}

function buildMockImage(prompt) {
  const safe = String(prompt || "AI").slice(0, 24).replace(/[<>&]/g, "");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3b82f6"/>
      <stop offset="1" stop-color="#10b981"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <text x="256" y="270" font-size="36" fill="white" text-anchor="middle" font-family="sans-serif">${safe || "Mock Image"}</text>
  <text x="256" y="320" font-size="18" fill="rgba(255,255,255,.8)" text-anchor="middle" font-family="sans-serif">未配置 API · 占位图</text>
</svg>`;
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

async function postJson(url, body, apiKey) {
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}${text ? ` · ${text.slice(0, 200)}` : ""}`);
  }
  return response.json();
}

export async function generateText(prompt, options = {}) {
  const settings = options.settings || loadAiSettings();
  const endpoint = (settings.textEndpoint || "").trim();
  if (!endpoint) {
    return {
      ok: true,
      mock: true,
      text: `（未配置文本 API · 这是占位回复）\n你给的提示词是：\n${prompt}`,
    };
  }
  const payload = {
    model: settings.textModel || "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    stream: false,
  };
  const json = await postJson(endpoint, payload, settings.textApiKey);
  const text = json?.choices?.[0]?.message?.content
    || json?.choices?.[0]?.text
    || json?.text
    || JSON.stringify(json).slice(0, 400);
  return { ok: true, text };
}

export async function generateImage(prompt, options = {}) {
  const settings = options.settings || loadAiSettings();
  const endpoint = (settings.imageEndpoint || "").trim();
  if (!endpoint) {
    return { ok: true, mock: true, imageUrl: buildMockImage(prompt) };
  }
  const payload = { prompt, model: settings.imageModel || undefined };
  const json = await postJson(endpoint, payload, settings.imageApiKey);
  const imageUrl = json?.imageUrl
    || json?.url
    || json?.data?.[0]?.url
    || (json?.data?.[0]?.b64_json ? `data:image/png;base64,${json.data[0].b64_json}` : "");
  if (!imageUrl) throw new Error("接口返回里没有 imageUrl/url/data[0].url 字段");
  return { ok: true, imageUrl };
}

export async function generateVideo(prompt, options = {}) {
  const settings = options.settings || loadAiSettings();
  const endpoint = (settings.videoEndpoint || "").trim();
  if (!endpoint) {
    return { ok: true, mock: true, videoUrl: "", note: "未配置视频 API · 显示占位" };
  }
  const payload = {
    prompt,
    model: settings.videoModel || undefined,
    sourceImage: options.sourceImageUrl || undefined,
  };
  const json = await postJson(endpoint, payload, settings.videoApiKey);
  const videoUrl = json?.videoUrl || json?.url || json?.data?.[0]?.url || "";
  if (!videoUrl) throw new Error("接口返回里没有 videoUrl/url 字段");
  return { ok: true, videoUrl };
}
