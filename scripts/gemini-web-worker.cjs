const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const { chromium } = require("@playwright/test");

const requestPath = process.argv[2];
const MIN_DOWNLOAD_IMAGE_BYTES = 48 * 1024;
const DOWNLOAD_STABLE_SAMPLES = 4;
const DOWNLOAD_STABLE_INTERVAL_MS = 1000;
const DOWNLOAD_MIN_AGE_MS = 2500;

main().catch((error) => {
  writeJsonLine({ type: "final", ok: false, error: error.message || String(error) });
  process.exit(1);
});

async function main() {
  if (!requestPath) throw new Error("缺少请求文件路径");
  const request = JSON.parse(await fs.readFile(requestPath, "utf8"));
  const userPrompt = String(request.prompt || "").trim();
  if (!userPrompt) throw new Error("提示词不能为空");
  await throwIfCancelled(request);
  const requestedParallelCount = Math.max(1, Math.min(4, Number(request.parallelCount) || 1));
  const parallelCount = 1;
  const promptParts = splitPromptJobs(userPrompt, request.splitMode || "paragraph");
  const promptJobs = promptParts.map((item, index) => ({
    index,
    sourcePrompt: item,
    prompt: buildGeminiImagePrompt(item),
  }));

  const profileDir = path.join(os.homedir(), ".wuxianhuabu", "gemini-chrome-profile");
  const downloadDir = path.join(os.homedir(), ".wuxianhuabu", "gemini-downloads");
  await fs.mkdir(profileDir, { recursive: true });
  await fs.mkdir(downloadDir, { recursive: true });

  const session = await openChromeSession(profileDir, downloadDir);
  const { context, page, close } = session;
  page.setDefaultTimeout(10_000);
  await configureDownloadBehavior(context, page, downloadDir);

  try {
    const pages = [page];
    for (let index = 1; index < Math.min(parallelCount, promptJobs.length); index += 1) {
      pages.push(await context.newPage());
    }
    const { results, errors, cancelled } = await runGeminiJobPool(pages, promptJobs, request, downloadDir);
    if (cancelled) throw new Error("Gemini 自动化任务已取消");
    if (!results.length) throw new Error(errors[0] || "Gemini 并发生图未返回图片");
    writeJsonLine({
      type: "final",
      ok: true,
      imageUrl: results[0].imageUrl,
      images: results,
      note: promptJobs.length > 1 ? `Gemini 网页稳定串行生成 · 成功 ${results.length}/${promptJobs.length}${requestedParallelCount > 1 ? " · 已自动降为单页防重复提交" : ""}` : (results[0].note || "Gemini 网页自动化生成"),
      profileDir,
      downloadDir,
      errors,
    });
  } catch (error) {
    const debugPath = await saveDebugArtifacts(page, error).catch(() => "");
    const suffix = debugPath ? `\n调试截图：${debugPath}` : "";
    throw new Error(`${error.message || String(error)}${suffix}`);
  } finally {
    await close();
  }
}

async function runGeminiJobPool(pages, promptJobs, request, downloadDir) {
  let nextIndex = 0;
  const results = [];
  const errors = [];
  let cancelled = false;
  async function worker(page) {
    while (nextIndex < promptJobs.length) {
      if (await isCancelled(request)) {
        cancelled = true;
        return;
      }
      const job = promptJobs[nextIndex];
      nextIndex += 1;
      try {
        const result = await runGeminiImageJob(page, request, job, downloadDir);
        results.push(result);
        writeJsonLine({
          type: "progress",
          requestId: request.requestId || "",
          ...result,
        });
      } catch (error) {
        const message = `任务 ${job.index + 1} 失败：${error.message || String(error)}`;
        if (/已取消/.test(message)) cancelled = true;
        errors.push(message);
        writeJsonLine({
          type: "progress",
          requestId: request.requestId || "",
          index: job.index,
          sourcePrompt: job.sourcePrompt,
          error: message,
        });
      }
    }
  }
  await Promise.all(pages.map((page) => worker(page)));
  results.sort((a, b) => a.index - b.index);
  return { results, errors, cancelled };
}

function writeJsonLine(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

async function runGeminiImageJob(page, request, job, downloadDir) {
  await throwIfCancelled(request);
  page.setDefaultTimeout(10_000);
  const jobDownloadDir = path.join(downloadDir, `job-${Date.now()}-${job.index + 1}`);
  await fs.mkdir(jobDownloadDir, { recursive: true });
  await configureDownloadBehavior(page.context(), page, jobDownloadDir);
  const capturedImages = [];
  const captureState = { after: 0 };
  captureImageResponses(page, capturedImages, captureState);
  await page.goto(request.geminiUrl || "https://gemini.google.com/app", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await throwIfCancelled(request);
  const editor = await waitForPromptEditor(page, Number(request.loginTimeoutSeconds) || 180);
  await tryEnableImageGenerationTool(page);
  await throwIfCancelled(request);
  await fillPrompt(page, editor, job.prompt);
  const baseline = await getImageBaseline(page);
  capturedImages.length = 0;
  captureState.after = Date.now();
  await submitPrompt(page, editor);
  await throwIfCancelled(request);
  const result = await waitForGeneratedImage(page, Number(request.timeoutSeconds) || 240, capturedImages, baseline, captureState.after, jobDownloadDir, request);
  return {
    imageUrl: result.imageUrl,
    note: result.note || `Gemini 网页自动化生成 #${job.index + 1}`,
    index: job.index,
    sourcePrompt: job.sourcePrompt,
  };
}

async function isCancelled(request) {
  const cancelPath = String(request.cancelPath || "");
  if (!cancelPath) return false;
  return fs.stat(cancelPath).then(() => true).catch(() => false);
}

async function throwIfCancelled(request) {
  if (await isCancelled(request)) throw new Error("Gemini 自动化任务已取消");
}

function splitPromptJobs(prompt, splitMode = "paragraph") {
  const text = String(prompt || "").trim();
  if (!text) return [];
  let parts = [];
  if (splitMode === "line") {
    parts = text.split(/\r?\n/);
  } else if (splitMode === "separator") {
    parts = text.split(/\n\s*(?:---+|###|\*\*\*)\s*\n/g);
  } else {
    parts = text.split(/\n\s*\n+/);
  }
  parts = parts.map((item) => item.trim()).filter(Boolean);
  return parts.length ? parts : [text];
}

async function openChromeSession(profileDir, downloadDir) {
  const cdpEndpoint = "http://127.0.0.1:9223";
  try {
    const browser = await chromium.connectOverCDP(cdpEndpoint, { timeout: 2500 });
    const context = browser.contexts()[0] || await browser.newContext();
    const page = context.pages().find((item) => /gemini\.google\.com/i.test(item.url())) || context.pages()[0] || await context.newPage();
    return {
      context,
      page,
      close: async () => {},
    };
  } catch {
    try {
      const context = await chromium.launchPersistentContext(profileDir, {
        channel: "chrome",
        headless: false,
        viewport: { width: 1360, height: 900 },
        acceptDownloads: true,
        downloadsPath: downloadDir,
        args: ["--remote-debugging-port=9223", "--no-first-run"],
      });
      return {
        context,
        page: context.pages()[0] || await context.newPage(),
        close: async () => context.close().catch(() => {}),
      };
    } catch (error) {
      const message = error.message || String(error);
      if (/process singleton|user data directory|profile.*in use|already in use/i.test(message)) {
        throw new Error("Chrome 配置目录正在被占用。请先关闭由“Chrome登录”打开的 Gemini Chrome 窗口，或重新点击“Chrome登录”后再试。");
      }
      throw error;
    }
  }
}

async function configureDownloadBehavior(context, page, downloadDir) {
  await fs.mkdir(downloadDir, { recursive: true });
  const client = await context.newCDPSession(page).catch(() => null);
  if (!client) return false;
  const payload = { behavior: "allow", downloadPath: downloadDir };
  const browserResult = await client.send("Browser.setDownloadBehavior", payload).then(() => true).catch(() => false);
  if (browserResult) return true;
  return client.send("Page.setDownloadBehavior", payload).then(() => true).catch(() => false);
}

async function waitForPromptEditor(page, timeoutSeconds) {
  const deadline = Date.now() + timeoutSeconds * 1000;
  const selectors = [
    "rich-textarea div[contenteditable='true']",
    "div[contenteditable='true'][role='textbox']",
    "div[contenteditable='true']",
    "textarea",
  ];
  while (Date.now() < deadline) {
    for (const selector of selectors) {
      const locator = page.locator(selector).last();
      if (await locator.count().catch(() => 0)) {
        const visible = await locator.isVisible().catch(() => false);
        const enabled = await locator.isEnabled().catch(() => true);
        if (visible && enabled) return locator;
      }
    }
    await page.waitForTimeout(1000);
  }
  throw new Error("没有找到 Gemini 输入框。请在弹出的浏览器中完成登录或验证码后重试。");
}

async function tryEnableImageGenerationTool(page) {
  const toolButtons = [
    "button:has-text('工具')",
    "button:has-text('Tools')",
    "button[aria-label*='工具']",
    "button[aria-label*='Tools']",
  ];
  for (const selector of toolButtons) {
    const button = page.locator(selector).last();
    if (!(await button.count().catch(() => 0))) continue;
    if (!(await button.isVisible().catch(() => false))) continue;
    await button.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
    const options = [
      "text=/图片|图像|生成图片|Image|Imagen/i",
      "button:has-text('图片')",
      "button:has-text('图像')",
      "button:has-text('Image')",
      "[role='menuitem']:has-text('图片')",
      "[role='menuitem']:has-text('Image')",
    ];
    for (const optionSelector of options) {
      const option = page.locator(optionSelector).last();
      if (!(await option.count().catch(() => 0))) continue;
      if (!(await option.isVisible().catch(() => false))) continue;
      await option.click({ force: true }).catch(() => {});
      await page.waitForTimeout(500);
      return true;
    }
    await page.keyboard.press("Escape").catch(() => {});
  }
  return false;
}

async function fillPrompt(page, editor, prompt) {
  await editor.click({ timeout: 15_000 });
  await clearEditorText(page, editor);
  await setEditorText(editor, prompt);
  await page.waitForTimeout(600);

  let inserted = await readEditorText(page, editor);
  if (!looksLikePromptInserted(inserted, prompt)) {
    await clearEditorText(page, editor);
    await page.keyboard.insertText(prompt);
    await page.waitForTimeout(600);
    inserted = await readEditorText(page, editor);
  }

  if (hasDuplicatedPrompt(inserted, prompt)) {
    await clearEditorText(page, editor);
    await setEditorText(editor, prompt);
    await page.waitForTimeout(500);
  }
}

async function setEditorText(editor, prompt) {
  await editor.fill(prompt).catch(async () => {
    await editor.evaluate((element, value) => {
      element.focus();
      if ("value" in element) {
        element.value = value;
      } else {
        element.textContent = value;
      }
      element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }, prompt);
  });
}

async function clearEditorText(page, editor) {
  await editor.click({ timeout: 15_000 }).catch(() => {});
  await editor.press(process.platform === "darwin" ? "Meta+A" : "Control+A").catch(() => {});
  await editor.press("Backspace").catch(() => {});
  await editor.evaluate((element) => {
    element.focus();
    if ("value" in element) {
      element.value = "";
    } else {
      element.textContent = "";
    }
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }).catch(async () => {
    await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A").catch(() => {});
    await page.keyboard.press("Backspace").catch(() => {});
  });
  await page.waitForTimeout(250);
}

async function readEditorText(page, editor) {
  return editor.evaluate((element) => ("value" in element ? element.value : (element.innerText || element.textContent || "")).trim(), undefined, { timeout: 1500 }).catch(() => {
    return page.evaluate(() => (document.activeElement?.value || document.activeElement?.innerText || document.activeElement?.textContent || "").trim()).catch(() => "");
  });
}

function looksLikePromptInserted(inserted, prompt) {
  const marker = String(prompt || "").trim().slice(0, Math.min(24, String(prompt || "").trim().length));
  return Boolean(marker && String(inserted || "").includes(marker));
}

function hasDuplicatedPrompt(inserted, prompt) {
  const marker = String(prompt || "").trim().slice(0, Math.min(32, String(prompt || "").trim().length));
  if (marker.length < 8) return false;
  return String(inserted || "").split(marker).length > 2;
}

async function submitPrompt(page, editor) {
  const before = await page.locator("user-query, message-content, .query-text, [data-message-id]").count().catch(() => 0);
  await waitForComposerReadyToSubmit(page, editor);
  const button = await findSendButton(page, editor);
  if (button) {
    await button.click({ force: true });
    if (await waitForSubmitAccepted(page, before, editor, 45_000)) return;
    throw new Error("Gemini 发送按钮已点击一次，但网页没有进入生成状态。为避免重复提交，已停止本次任务。");
  }
  if (await clickComposerSendByPosition(page, editor)) {
    if (await waitForSubmitAccepted(page, before, editor, 45_000)) return;
    throw new Error("Gemini 发送区域已点击一次，但网页没有进入生成状态。为避免重复提交，已停止本次任务。");
  }
  await editor.click().catch(() => {});
  await page.keyboard.press("Enter");
  if (await waitForSubmitAccepted(page, before, editor, 12_000)) return;
  await page.keyboard.press(process.platform === "darwin" ? "Meta+Enter" : "Control+Enter").catch(() => {});
  if (await waitForSubmitAccepted(page, before, editor, 12_000)) return;
  throw new Error("提示词已填入，但未能自动点击 Gemini 发送按钮。请确认输入框右侧发送按钮可用。");
}

async function waitForComposerReadyToSubmit(page, editor) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (!(await isGeminiStillGenerating(page))) {
      const text = await readEditorText(page, editor).catch(() => "");
      if (text) return true;
    }
    await page.waitForTimeout(700);
  }
  return false;
}

async function waitForSubmitAccepted(page, previousCount, editor, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await didSubmit(page, previousCount, editor)) return true;
    await page.waitForTimeout(900);
  }
  return false;
}

async function findSendButton(page, editor) {
  const editorBox = await editor.boundingBox().catch(() => null);
  const selectors = [
    "button[aria-label*='Send']",
    "button[aria-label*='发送']",
    "button[aria-label*='提交']",
    "button[aria-label*='运行']",
    "button[aria-label*='Submit']",
    "button[aria-label*='提交']",
    "button[aria-label*='send']",
    "button[data-test-id*='send']",
    "button:has(mat-icon:has-text('send'))",
    "button:has(svg)",
  ];
  for (const selector of selectors) {
    const buttons = page.locator(selector);
    const count = await buttons.count().catch(() => 0);
    for (let index = count - 1; index >= 0; index -= 1) {
      const button = buttons.nth(index);
      const visible = await button.isVisible().catch(() => false);
      const disabled = await button.isDisabled().catch(() => true);
      const box = await button.boundingBox().catch(() => null);
      if (!visible || disabled || !box) continue;
      if (box.width < 20 || box.height < 20) continue;
      if (editorBox) {
        const nearEditor = box.y > editorBox.y - 70 && box.y < editorBox.y + editorBox.height + 90;
        const rightSide = box.x > editorBox.x + editorBox.width * 0.62;
        if (!nearEditor || !rightSide) continue;
      } else if (box.y < 240) {
        continue;
      }
      return button;
    }
  }
  return null;
}

async function clickComposerSendByPosition(page, editor) {
  const editorBox = await editor.boundingBox().catch(() => null);
  if (!editorBox) return false;
  const buttons = page.locator("button");
  const count = await buttons.count().catch(() => 0);
  const candidates = [];
  for (let index = 0; index < count; index += 1) {
    const button = buttons.nth(index);
    const visible = await button.isVisible().catch(() => false);
    const disabled = await button.isDisabled().catch(() => true);
    const box = await button.boundingBox().catch(() => null);
    if (!visible || disabled || !box) continue;
    const nearEditor = box.y > editorBox.y - 70 && box.y < editorBox.y + editorBox.height + 100;
    const rightSide = box.x > editorBox.x + editorBox.width * 0.62;
    if (!nearEditor || !rightSide) continue;
    candidates.push({ button, score: box.x + box.y });
  }
  candidates.sort((a, b) => b.score - a.score);
  if (!candidates.length) return false;
  await candidates[0].button.click({ force: true });
  return true;
}

async function didSubmit(page, previousCount, editor) {
  const stopSelectors = [
    "button[aria-label*='Stop']",
    "button[aria-label*='停止']",
    "button[aria-label*='Cancel']",
    "button[aria-label*='取消']",
    "button:has-text('停止')",
    "button:has-text('Stop')",
  ];
  for (const selector of stopSelectors) {
    const item = page.locator(selector).last();
    const visible = await item.isVisible({ timeout: 500 }).catch(() => false);
    if (visible) return true;
  }
  const nextCount = await page.locator("user-query, message-content, .query-text, [data-message-id]").count().catch(() => 0);
  if (nextCount > previousCount) return true;
  const editorText = await editor.evaluate((element) => (element.innerText || element.textContent || "").trim(), undefined, { timeout: 800 }).catch(() => "");
  return !editorText && nextCount >= previousCount;
}

function captureImageResponses(page, capturedImages, captureState) {
  page.on("response", async (response) => {
    try {
      const ts = Date.now();
      if (captureState.after && ts < captureState.after) return;
      const contentType = response.headers()["content-type"] || "";
      if (!contentType.startsWith("image/")) return;
      const url = response.url();
      if (/avatar|logo|favicon|sprite|emoji|googleusercontent\.com\/a\//i.test(url)) return;
      const buffer = await response.body();
      if (!buffer || buffer.length < 24 * 1024) return;
      capturedImages.push({
        url,
        contentType: contentType.split(";")[0],
        buffer,
        size: buffer.length,
        ts,
      });
      capturedImages.sort((a, b) => b.size - a.size);
      capturedImages.splice(12);
    } catch {
      // Some cross-process responses cannot be read. Other strategies below will handle them.
    }
  });
}

async function getImageBaseline(page) {
  return page.locator("img").evaluateAll((images) => images.map((image) => ({
    src: image.currentSrc || image.src || image.getAttribute("src") || "",
    width: image.naturalWidth || image.width || 0,
    height: image.naturalHeight || image.height || 0,
  }))).catch(() => []);
}

async function waitForGeneratedImage(page, timeoutSeconds, capturedImages = [], baseline = [], submittedAt = Date.now(), downloadDir = "", request = {}) {
  const baselineSources = new Set(baseline.map((item) => item.src).filter(Boolean));
  const baselineCount = baseline.length;
  const deadline = Date.now() + timeoutSeconds * 1000;
  const minReturnAt = submittedAt + 8000;
  let lastDownloadAttemptAt = 0;
  let lastCandidate = null;
  while (Date.now() < deadline) {
    await throwIfCancelled(request);
    const downloaded = await findLatestDownloadedImage(downloadDir, submittedAt).catch(() => null);
    if (downloaded?.imageUrl) return downloaded;

    await page.waitForTimeout(2200);
    const candidates = await collectImageCandidates(page, baselineCount, baselineSources, submittedAt);
    if (candidates.length) {
      lastCandidate = candidates[0];
      if (Date.now() - lastDownloadAttemptAt > 5000) {
        lastDownloadAttemptAt = Date.now();
        const afterClickDownload = await downloadViaGeminiUi(page, lastCandidate, downloadDir).catch(() => null);
        if (afterClickDownload?.imageUrl) return afterClickDownload;
      }

      const directResult = await imageCandidateToDataUrl(page, lastCandidate, capturedImages, { allowScreenshot: true, downloadDir, downloadOnly: false }).catch(() => null);
      if (directResult?.imageUrl) return directResult;
    }

    if (!candidates.length && Date.now() - submittedAt > 12_000 && Date.now() - lastDownloadAttemptAt > 10_000) {
      lastDownloadAttemptAt = Date.now();
      const afterGlobalDownload = await downloadViaGeminiUi(page, null, downloadDir).catch(() => null);
      if (afterGlobalDownload?.imageUrl) return afterGlobalDownload;
    }

    if (await isGeminiStillGenerating(page)) continue;
    if (Date.now() < minReturnAt) continue;
  }

  if (lastCandidate) {
    const finalResult = await imageCandidateToDataUrl(page, lastCandidate, capturedImages, { allowScreenshot: true, downloadDir, downloadOnly: false }).catch(() => null);
    if (finalResult?.imageUrl) return finalResult;
  }
  throw new Error(`Gemini 已等待 ${timeoutSeconds} 秒，但未能抓取到生成结果。请确认 Gemini 页面已经真正出图，或重新登录后再试。下载目录：${downloadDir}`);
}

function buildGeminiImagePrompt(prompt) {
  return [
    "按照下面的提示词生成图片，只输出生成图片本身。",
    "",
    prompt,
  ].join("\n");
}

async function isGeminiStillGenerating(page) {
  const text = await page.locator("body").innerText({ timeout: 1200 }).catch(() => "");
  return /正在生成|生成中|正在创建|Creating|Generating|Thinking|思考中/i.test(text);
}

async function collectImageCandidates(page, baselineCount, baselineSources, submittedAt) {
  const images = page.locator("img");
  const count = await images.count().catch(() => 0);
  const candidates = [];
  for (let index = baselineCount; index < count; index += 1) {
    const locator = images.nth(index);
    const box = await locator.boundingBox().catch(() => null);
    if (!box || box.width < 180 || box.height < 160) continue;
    const meta = await locator.evaluate((image) => ({
      src: image.getAttribute("src") || "",
      currentSrc: image.currentSrc || "",
      naturalWidth: image.naturalWidth || 0,
      naturalHeight: image.naturalHeight || 0,
      alt: image.getAttribute("alt") || "",
    })).catch(() => ({ src: "", currentSrc: "", naturalWidth: 0, naturalHeight: 0, alt: "" }));
    const src = meta.currentSrc || meta.src;
    if (baselineSources.has(src)) continue;
    if (/avatar|logo|googleusercontent\.com\/a\//i.test(src || "")) continue;
    if (/favicon|sprite|icon/i.test(`${src} ${meta.alt}`)) continue;
    const stable = await waitForImageStable(locator, src).catch(() => true);
    if (!stable && Date.now() - submittedAt < 18_000) continue;
    const naturalArea = Math.max(1, meta.naturalWidth * meta.naturalHeight);
    candidates.push({ locator, src, meta, area: Math.max(box.width * box.height, naturalArea) });
  }
  candidates.sort((a, b) => b.area - a.area);
  return candidates;
}

async function waitForImageStable(locator, initialSrc) {
  const first = await locator.evaluate((image) => ({
    src: image.currentSrc || image.src || "",
    complete: image.complete,
    width: image.naturalWidth || 0,
    height: image.naturalHeight || 0,
  }), undefined, { timeout: 1200 });
  if (!first.complete || first.width < 180 || first.height < 160) return false;
  await new Promise((resolve) => setTimeout(resolve, 500));
  const second = await locator.evaluate((image) => ({
    src: image.currentSrc || image.src || "",
    complete: image.complete,
    width: image.naturalWidth || 0,
    height: image.naturalHeight || 0,
  }), undefined, { timeout: 1200 }).catch(() => first);
  return second.complete && second.src === (initialSrc || first.src) && second.width >= 180 && second.height >= 160;
}

async function imageCandidateToDataUrl(page, candidate, capturedImages = [], options = {}) {
  const allowScreenshot = options.allowScreenshot !== false;
  const downloaded = await downloadViaGeminiUi(page, candidate, options.downloadDir).catch(() => null);
  if (downloaded?.imageUrl) return downloaded;

  if (options.downloadOnly) return null;

  const captured = bestCapturedImage(capturedImages, candidate.src);
  if (captured) return capturedToResult(captured);

  const urls = buildImageUrlCandidates(candidate.src || candidate.meta?.currentSrc || candidate.meta?.src || "");
  for (const url of urls) {
    const result = await downloadImageAsDataUrl(page, url).catch(() => null);
    if (result?.imageUrl) return result;
  }

  const canvasCopy = await readRenderedImageViaCanvas(candidate).catch(() => null);
  if (canvasCopy?.imageUrl) return canvasCopy;

  const inlineDataUrl = await candidate.locator.evaluate(async (image) => {
    const src = image.currentSrc || image.src || "";
    if (src.startsWith("data:image/")) return src;
    if (src.startsWith("blob:")) {
      const blob = await fetch(src).then((response) => response.blob());
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("blob image read failed"));
        reader.readAsDataURL(blob);
      });
    }
    return "";
  }).catch(() => "");
  if (inlineDataUrl) {
    return {
      imageUrl: inlineDataUrl,
      note: `Gemini 网页原图导入 · ${candidate.meta?.naturalWidth || "?"}×${candidate.meta?.naturalHeight || "?"}`,
    };
  }

  if (!allowScreenshot) return null;

  const buffer = await candidate.locator.screenshot({ type: "png" });
  return {
    imageUrl: `data:image/png;base64,${buffer.toString("base64")}`,
    note: "Gemini 网页截图导入 · 未能下载原图",
  };
}

async function triggerGeminiDownload(page, candidate) {
  if (candidate?.locator) {
    await candidate.locator.scrollIntoViewIfNeeded().catch(() => {});
    await candidate.locator.click({ force: true }).catch(() => {});
    await page.waitForTimeout(900);
  }

  const directButton = await findDownloadButton(page);
  if (directButton) {
    await directButton.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1200);
    return true;
  }

  const moreButton = await findMoreActionsButton(page);
  if (!moreButton) return false;
  await moreButton.click({ force: true }).catch(() => {});
  await page.waitForTimeout(700);
  const menuDownload = await findDownloadButton(page);
  if (!menuDownload) {
    await page.keyboard.press("Escape").catch(() => {});
    return false;
  }
  await menuDownload.click({ force: true }).catch(() => {});
  await page.waitForTimeout(1200);
  return true;
}

async function findLatestDownloadedImage(downloadDir, sinceMs) {
  if (!downloadDir) return null;
  const file = await latestStableImageFile(downloadDir, sinceMs);
  if (!file) return null;
  const buffer = await fs.readFile(file.path);
  if (buffer.length < MIN_DOWNLOAD_IMAGE_BYTES) return null;
  return {
    imageUrl: `data:${mimeFromFileName(file.name)};base64,${buffer.toString("base64")}`,
    note: `Gemini 网页下载原图导入 · ${(buffer.length / 1024).toFixed(0)} KB`,
  };
}

async function waitForDownloadedImage(downloadDir, sinceMs, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await findLatestDownloadedImage(downloadDir, sinceMs).catch(() => null);
    if (result?.imageUrl) return result;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return null;
}

async function latestStableImageFile(downloadDir, sinceMs) {
  const entries = await fs.readdir(downloadDir, { withFileTypes: true }).catch(() => []);
  let activePartial = false;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!/\.(crdownload|tmp|part)$/i.test(entry.name)) continue;
    const stat = await fs.stat(path.join(downloadDir, entry.name)).catch(() => null);
    if (stat && stat.mtimeMs >= sinceMs - 2000) {
      activePartial = true;
      break;
    }
  }
  if (activePartial) return null;

  const candidates = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    if (!/\.(png|jpe?g|webp|gif)$/i.test(name)) continue;
    if (/\.(crdownload|tmp|part)$/i.test(name)) continue;
    const filePath = path.join(downloadDir, name);
    const stable = await waitForStableFile(filePath, sinceMs);
    if (!stable) continue;
    candidates.push({ path: filePath, name, size: stable.size, mtimeMs: stable.mtimeMs });
  }
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs || b.size - a.size);
  return candidates[0] || null;
}

async function waitForStableFile(filePath, sinceMs) {
  let previous = null;
  for (let index = 0; index < DOWNLOAD_STABLE_SAMPLES; index += 1) {
    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat) return null;
    const ageMs = Date.now() - stat.mtimeMs;
    if (stat.mtimeMs < sinceMs - 2000 || stat.size < MIN_DOWNLOAD_IMAGE_BYTES) return null;
    if (ageMs < DOWNLOAD_MIN_AGE_MS) {
      await new Promise((resolve) => setTimeout(resolve, DOWNLOAD_MIN_AGE_MS - ageMs));
      index -= 1;
      continue;
    }
    if (previous && (previous.size !== stat.size || previous.mtimeMs !== stat.mtimeMs)) return null;
    previous = { size: stat.size, mtimeMs: stat.mtimeMs };
    if (index < DOWNLOAD_STABLE_SAMPLES - 1) {
      await new Promise((resolve) => setTimeout(resolve, DOWNLOAD_STABLE_INTERVAL_MS));
    }
  }
  return previous;
}

function bestCapturedImage(capturedImages, preferredUrl = "") {
  if (!capturedImages.length) return null;
  const preferred = String(preferredUrl || "");
  if (!preferred) return null;
  const matched = preferred
    ? capturedImages.find((item) => item.url === preferred || item.url.includes(preferred) || preferred.includes(item.url))
    : null;
  return matched || null;
}

function capturedToResult(item) {
  return {
    imageUrl: `data:${item.contentType || "image/png"};base64,${item.buffer.toString("base64")}`,
    note: `Gemini 网页网络原图导入 · ${(item.size / 1024).toFixed(0)} KB`,
  };
}

async function downloadViaGeminiUi(page, candidate, downloadDir = "") {
  if (!downloadDir) return null;
  await fs.mkdir(downloadDir, { recursive: true });
  const downloadStartedAt = Date.now();
  const beforeDownloads = page.waitForEvent("download", { timeout: 18_000 }).catch(() => null);
  if (candidate?.locator) {
    await candidate.locator.scrollIntoViewIfNeeded().catch(() => {});
    await candidate.locator.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1000);
  }

  const button = await findDownloadButton(page);
  if (!button) return null;
  await button.click({ force: true });
  const download = await beforeDownloads;
  if (!download) return null;
  const fileName = sanitizeFileName(download.suggestedFilename() || `gemini-${downloadStartedAt}.png`);
  const targetPath = await uniqueDownloadPath(downloadDir, fileName);
  await download.saveAs(targetPath).catch(async () => {
    const tmpPath = await download.path();
    if (!tmpPath) throw new Error("download path unavailable");
    await fs.copyFile(tmpPath, targetPath);
  });
  const buffer = await readSavedDownload(targetPath);
  if (buffer.length < MIN_DOWNLOAD_IMAGE_BYTES) return null;
  const mime = mimeFromFileName(fileName);
  return {
    imageUrl: `data:${mime};base64,${buffer.toString("base64")}`,
    note: `Gemini 网页下载原图导入 · ${(buffer.length / 1024).toFixed(0)} KB`,
  };
}

async function readSavedDownload(filePath) {
  const deadline = Date.now() + 5000;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const buffer = await fs.readFile(filePath);
      if (buffer.length >= MIN_DOWNLOAD_IMAGE_BYTES) return buffer;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (lastError) throw lastError;
  return fs.readFile(filePath);
}

function sanitizeFileName(fileName) {
  const safe = String(fileName || "gemini.png").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").trim();
  return safe || "gemini.png";
}

async function uniqueDownloadPath(downloadDir, fileName) {
  const parsed = path.parse(fileName);
  const ext = parsed.ext || ".png";
  const base = parsed.name || "gemini";
  for (let index = 0; index < 100; index += 1) {
    const suffix = index ? `-${index}` : "";
    const candidate = path.join(downloadDir, `${base}${suffix}${ext}`);
    const exists = await fs.stat(candidate).then(() => true).catch(() => false);
    if (!exists) return candidate;
  }
  return path.join(downloadDir, `${base}-${Date.now()}${ext}`);
}

async function findDownloadButton(page) {
  const selectors = [
    "button[aria-label*='Download']",
    "button[aria-label*='下载']",
    "[role='button'][aria-label*='Download']",
    "[role='button'][aria-label*='下载']",
    "button[title*='Download']",
    "button[title*='下载']",
    "a[download]",
    "a[aria-label*='Download']",
    "a[aria-label*='下载']",
    "button:has-text('Download')",
    "button:has-text('下载')",
    "[role='menuitem']:has-text('Download')",
    "[role='menuitem']:has-text('下载')",
  ];
  for (const selector of selectors) {
    const items = page.locator(selector);
    const count = await items.count().catch(() => 0);
    for (let index = count - 1; index >= 0; index -= 1) {
      const item = items.nth(index);
      const visible = await item.isVisible().catch(() => false);
      const disabled = await item.isDisabled().catch(() => false);
      const box = await item.boundingBox().catch(() => null);
      if (visible && !disabled && box && box.width >= 18 && box.height >= 18) return item;
    }
  }
  return null;
}

async function findMoreActionsButton(page) {
  const selectors = [
    "button[aria-label*='More']",
    "button[aria-label*='更多']",
    "button[aria-label*='操作']",
    "[role='button'][aria-label*='More']",
    "[role='button'][aria-label*='更多']",
    "button:has-text('更多')",
  ];
  for (const selector of selectors) {
    const items = page.locator(selector);
    const count = await items.count().catch(() => 0);
    for (let index = count - 1; index >= 0; index -= 1) {
      const item = items.nth(index);
      const visible = await item.isVisible().catch(() => false);
      const disabled = await item.isDisabled().catch(() => false);
      const box = await item.boundingBox().catch(() => null);
      if (visible && !disabled && box && box.width >= 18 && box.height >= 18) return item;
    }
  }
  return null;
}

async function readRenderedImageViaCanvas(candidate) {
  return candidate.locator.evaluate(async (image) => {
    const width = image.naturalWidth || image.width || 0;
    const height = image.naturalHeight || image.height || 0;
    if (width < 256 || height < 256) return null;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    context.drawImage(image, 0, 0, width, height);
    return {
      imageUrl: canvas.toDataURL("image/png"),
      note: `Gemini 网页Canvas原图导入 · ${width}×${height}`,
    };
  });
}

function mimeFromFileName(fileName) {
  const lower = String(fileName || "").toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/png";
}

function buildImageUrlCandidates(rawUrl) {
  if (!rawUrl) return [];
  const urls = new Set([rawUrl]);
  if (/googleusercontent|gstatic|google/i.test(rawUrl)) {
    urls.add(rawUrl.replace(/=w\d+(-h\d+)?(-[a-z]+)?/i, "=s2048"));
    urls.add(rawUrl.replace(/=s\d+(-[a-z]+)?/i, "=s2048"));
    urls.add(rawUrl.replace(/=.*$/, "=s2048"));
  }
  return [...urls].filter(Boolean);
}

async function downloadImageAsDataUrl(page, url) {
  if (!url || url.startsWith("blob:")) return "";
  if (url.startsWith("data:image/")) return { imageUrl: url, note: "Gemini 网页原图导入 · data URL" };
  const absoluteUrl = new URL(url, page.url()).toString();
  const response = await page.request.get(absoluteUrl, {
    timeout: 30_000,
    headers: {
      referer: page.url(),
      "user-agent": await page.evaluate(() => navigator.userAgent).catch(() => "Mozilla/5.0"),
    },
  });
  if (!response.ok()) return "";
  const contentType = response.headers()["content-type"] || "image/png";
  if (!contentType.startsWith("image/")) return "";
  const buffer = await response.body();
  if (buffer.length < 2048) return "";
  return {
    imageUrl: `data:${contentType.split(";")[0]};base64,${buffer.toString("base64")}`,
    note: `Gemini 网页原图导入 · ${(buffer.length / 1024).toFixed(0)} KB`,
  };
}

async function saveDebugArtifacts(page, error) {
  const debugDir = path.join(os.homedir(), ".wuxianhuabu", "gemini-debug");
  await fs.mkdir(debugDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const png = path.join(debugDir, `gemini-${stamp}.png`);
  const txt = path.join(debugDir, `gemini-${stamp}.txt`);
  await page.screenshot({ path: png, fullPage: false }).catch(() => {});
  const bodyText = await page.locator("body").innerText({ timeout: 2000 }).catch(() => "");
  await fs.writeFile(txt, [
    `url=${page.url()}`,
    `error=${error.message || String(error)}`,
    "",
    bodyText.slice(0, 4000),
  ].join("\n"), "utf8");
  return png;
}
