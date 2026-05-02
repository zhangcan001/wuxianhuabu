const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");

const PORT = Number(process.env.WUXIANHUABU_API_PORT || 8787);
const CONFIG_DIR = path.join(os.homedir(), ".wuxianhuabu");
const CONFIG_PATH = path.join(CONFIG_DIR, "ai-config.json");

const DEFAULT_CONFIG = {
  providerMode: "mock",
  customApiUrl: "",
  customApiKey: "",
  customAuthType: "bearer",
  customHeadersJson: "",
  customModel: "gpt-image-1",
  customImagePath: "data.0.url",
  customBodyTemplate: JSON.stringify(
    {
      model: "{{model}}",
      prompt: "{{prompt}}",
      size: "{{size}}",
    },
    null,
    2,
  ),
  comfyEnabled: false,
  comfyBaseUrl: "http://127.0.0.1:8188",
  positiveNodeId: "",
  workflowJson: "",
  comfyImagePositiveNodeId: "",
  comfyImageWorkflowJson: "",
  comfyVideoPositiveNodeId: "",
  comfyVideoWorkflowJson: "",
  comfyTimeoutSeconds: "600",
};

const server = http.createServer(async (req, res) => {
  try {
    setCors(res);
    if (req.method === "OPTIONS") return sendJson(res, 204, {});
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/api/health") {
      return sendJson(res, 200, { ok: true, configPath: CONFIG_PATH });
    }

    if (req.method === "GET" && url.pathname === "/api/ai-config") {
      const config = await readConfig();
      return sendJson(res, 200, publicConfig(config));
    }

    if (req.method === "POST" && url.pathname === "/api/ai-config") {
      const body = await readJson(req);
      const current = await readConfig();
      const next = { ...current, ...body };
      if (body.customApiKeyClear) {
        next.customApiKey = "";
        delete next.customApiKeyClear;
      } else if (!Object.prototype.hasOwnProperty.call(body, "customApiKey")) {
        next.customApiKey = current.customApiKey;
      }
      if (body.customApiKey === "") {
        next.customApiKey = current.customApiKey;
      }
      await writeConfig(next);
      return sendJson(res, 200, publicConfig(next));
    }

    if (req.method === "POST" && url.pathname === "/api/generate-image") {
      const body = await readJson(req);
      const config = await readConfig();
      const result = await runCustomApiGeneration(config, body.prompt || "AI Image");
      return sendJson(res, 200, result);
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    sendJson(res, 500, { error: error.message || String(error) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Local AI backend listening on http://127.0.0.1:${PORT}`);
  console.log(`AI config: ${CONFIG_PATH}`);
});

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function readConfig() {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await writeConfig(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  }
}

async function writeConfig(config) {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
}

function publicConfig(config) {
  const { customApiKey, ...rest } = config;
  return {
    ...rest,
    customApiKey: "",
    customApiKeySaved: Boolean(customApiKey),
    configPath: CONFIG_PATH,
  };
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, status, value) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(value));
}

async function runCustomApiGeneration(config, prompt) {
  if (!config.customApiUrl.trim()) throw new Error("请先填写自定义 API URL");
  const response = await fetch(config.customApiUrl.trim(), {
    method: "POST",
    headers: buildHeaders(config),
    body: JSON.stringify(buildBody(config, prompt)),
  });

  const contentType = response.headers.get("content-type") || "";
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`自定义 API 请求失败：HTTP ${response.status}${errorText ? ` · ${errorText.slice(0, 240)}` : ""}`);
  }

  if (contentType.startsWith("image/")) {
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return { imageUrl: `data:${contentType};base64,${base64}`, note: "自定义 API · image response" };
  }

  const json = await response.json();
  const imageValue = extractImageFromResponse(json, config.customImagePath);
  return {
    imageUrl: normalizeImageResult(imageValue),
    note: `自定义 API · ${config.customModel || "model"}`,
  };
}

function buildHeaders(config) {
  let headers = { "Content-Type": "application/json" };
  if (config.customHeadersJson?.trim()) {
    headers = { ...headers, ...JSON.parse(config.customHeadersJson) };
  }
  const apiKey = config.customApiKey?.trim();
  if (apiKey && config.customAuthType === "bearer") headers.Authorization = `Bearer ${apiKey}`;
  if (apiKey && config.customAuthType === "x-api-key") headers["x-api-key"] = apiKey;
  return headers;
}

function buildBody(config, prompt) {
  const template = config.customBodyTemplate?.trim() || "{}";
  const replaced = template
    .replaceAll("{{prompt}}", escapeJsonString(prompt.replace(/@(?=图\d+)/g, "").trim()))
    .replaceAll("{{model}}", escapeJsonString(config.customModel || ""))
    .replaceAll("{{size}}", "1024x1024")
    .replaceAll("{{aspectRatio}}", "auto");
  return JSON.parse(replaced);
}

function extractImageFromResponse(json, imagePath) {
  const candidates = [
    imagePath,
    "data.0.url",
    "data.0.b64_json",
    "images.0.url",
    "images.0",
    "image",
    "url",
    "b64_json",
  ].filter(Boolean);
  for (const candidate of candidates) {
    const value = getByPath(json, candidate);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  throw new Error(`响应里没有找到图片字段，请检查结果图片路径。响应键：${Object.keys(json || {}).join(", ")}`);
}

function normalizeImageResult(value) {
  if (/^https?:\/\//i.test(value) || value.startsWith("data:image/") || value.startsWith("blob:")) return value;
  return `data:image/png;base64,${value}`;
}

function getByPath(value, pathExpression) {
  return String(pathExpression)
    .split(".")
    .filter(Boolean)
    .reduce((current, key) => (current == null ? undefined : current[key]), value);
}

function escapeJsonString(value) {
  return JSON.stringify(value).slice(1, -1);
}
