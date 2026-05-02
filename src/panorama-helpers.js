export const PANORAMA_CACHE_LIMIT = 4;

export function getVrGridPresets(count) {
  return count === 4
    ? [
        { label: "正面", yaw: 0, pitch: 0 },
        { label: "右面", yaw: Math.PI / 2, pitch: 0 },
        { label: "左面", yaw: -Math.PI / 2, pitch: 0 },
        { label: "后面", yaw: Math.PI, pitch: 0 },
      ]
    : [
        { label: "正面", yaw: 0, pitch: 0 },
        { label: "右面", yaw: Math.PI / 2, pitch: 0 },
        { label: "左面", yaw: -Math.PI / 2, pitch: 0 },
        { label: "后面", yaw: Math.PI, pitch: 0 },
        { label: "后上", yaw: Math.PI, pitch: -0.62 },
        { label: "右上", yaw: Math.PI / 2, pitch: -0.62 },
        { label: "左上", yaw: -Math.PI / 2, pitch: -0.62 },
        { label: "前上", yaw: 0, pitch: -0.62 },
        { label: "后下", yaw: Math.PI, pitch: 0.62 },
        { label: "右下", yaw: Math.PI / 2, pitch: 0.62 },
        { label: "左下", yaw: -Math.PI / 2, pitch: 0.62 },
        { label: "前下", yaw: 0, pitch: 0.62 },
      ];
}

export function getVrGridLayout(count) {
  return {
    cols: count === 4 ? 2 : 4,
    rows: count === 4 ? 2 : 3,
    cellW: count === 4 ? 480 : 360,
    cellH: count === 4 ? 480 : 240,
  };
}

export function createPanoramaSourceLoader({ cacheLimit = PANORAMA_CACHE_LIMIT, loadImageImpl = loadImage, documentRef = globalThis.document } = {}) {
  const cache = new Map();
  const loadPanoramaSource = async (source) => {
    const cacheKey = String(source || "");
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    const pending = (async () => {
      const image = await loadImageImpl(source);
      const sourceCanvas = documentRef.createElement("canvas");
      sourceCanvas.width = image.naturalWidth || image.width;
      sourceCanvas.height = image.naturalHeight || image.height;
      const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
      sourceCtx.drawImage(image, 0, 0, sourceCanvas.width, sourceCanvas.height);
      return {
        data: sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height),
        width: sourceCanvas.width,
        height: sourceCanvas.height,
      };
    })();

    cache.set(cacheKey, pending);
    while (cache.size > cacheLimit) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }

    try {
      return await pending;
    } catch (error) {
      cache.delete(cacheKey);
      throw error;
    }
  };

  loadPanoramaSource.cache = cache;
  return loadPanoramaSource;
}

export const loadPanoramaSource = createPanoramaSourceLoader();

export async function makeVrGrid(count, source, {
  documentRef = globalThis.document,
  loadImageImpl = loadImage,
  loadPanoramaSourceImpl = loadPanoramaSource,
} = {}) {
  const panorama = await loadPanoramaSourceImpl(source);
  const presets = getVrGridPresets(count);
  const { cols, rows, cellW, cellH } = getVrGridLayout(count);
  const canvas = documentRef.createElement("canvas");
  canvas.width = cols * cellW;
  canvas.height = rows * cellH;
  const ctx = canvas.getContext("2d");

  for (let i = 0; i < presets.length; i += 1) {
    const preset = presets[i];
    const dataUrl = renderPerspectiveFromPanoramaData(panorama, {
      yaw: preset.yaw,
      pitch: preset.pitch,
      width: cellW,
      height: cellH,
      fov: 82,
    }, { documentRef });
    const image = await loadImageImpl(dataUrl);
    const x = (i % cols) * cellW;
    const y = Math.floor(i / cols) * cellH;
    ctx.drawImage(image, x, y, cellW, cellH);
    ctx.fillStyle = "rgba(0,0,0,.42)";
    ctx.fillRect(x, y, 120, 52);
    ctx.fillStyle = "#ecfeff";
    ctx.font = "bold 26px sans-serif";
    ctx.fillText(preset.label, x + 20, y + 34);
  }

  return canvas.toDataURL("image/jpeg", 0.94);
}

export async function renderPerspectiveFromPanorama(source, opts, {
  loadPanoramaSourceImpl = loadPanoramaSource,
  documentRef = globalThis.document,
} = {}) {
  const panorama = await loadPanoramaSourceImpl(source);
  return renderPerspectiveFromPanoramaData(panorama, opts, { documentRef });
}

export function renderPerspectiveFromPanoramaData(panorama, opts, { documentRef = globalThis.document } = {}) {
  const output = documentRef.createElement("canvas");
  output.width = opts.width;
  output.height = opts.height;
  drawPerspectiveToCanvas(output, panorama, opts);
  return output.toDataURL("image/jpeg", 0.94);
}

export function drawPerspectiveToCanvas(canvas, panorama, opts) {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext("2d");
  const frame = ctx.createImageData(width, height);
  const fov = ((opts.fov || 75) * Math.PI) / 180;
  const tanHalf = Math.tan(fov / 2);
  const aspect = width / height;
  const cosYaw = Math.cos(opts.yaw || 0);
  const sinYaw = Math.sin(opts.yaw || 0);
  const cosPitch = Math.cos(opts.pitch || 0);
  const sinPitch = Math.sin(opts.pitch || 0);

  for (let y = 0; y < height; y += 1) {
    const py = (1 - (2 * (y + 0.5)) / height) * tanHalf;
    for (let x = 0; x < width; x += 1) {
      const px = ((2 * (x + 0.5)) / width - 1) * tanHalf * aspect;
      const pz = -1;
      const len = Math.hypot(px, py, pz);
      const nx = px / len;
      const ny = py / len;
      const nz = pz / len;

      const yawX = nx * cosYaw + nz * sinYaw;
      const yawZ = -nx * sinYaw + nz * cosYaw;
      const pitchY = ny * cosPitch - yawZ * sinPitch;
      const pitchZ = ny * sinPitch + yawZ * cosPitch;

      const lon = Math.atan2(yawX, -pitchZ);
      const lat = Math.asin(clamp(pitchY, -1, 1));
      const srcX = positiveModulo((lon / (Math.PI * 2) + 0.5) * panorama.width, panorama.width);
      const srcY = clamp((0.5 - lat / Math.PI) * panorama.height, 0, panorama.height - 1);
      sampleNearest(panorama.data, frame, panorama.width, Math.floor(srcX), Math.floor(srcY), x, y, width);
    }
  }

  ctx.putImageData(frame, 0, 0);
}

export function sampleNearest(sourceData, targetData, sourceWidth, sourceX, sourceY, targetX, targetY, targetWidth) {
  const sourceIndex = (sourceY * sourceWidth + sourceX) * 4;
  const targetIndex = (targetY * targetWidth + targetX) * 4;
  targetData.data[targetIndex] = sourceData.data[sourceIndex];
  targetData.data[targetIndex + 1] = sourceData.data[sourceIndex + 1];
  targetData.data[targetIndex + 2] = sourceData.data[sourceIndex + 2];
  targetData.data[targetIndex + 3] = 255;
}

export function positiveModulo(value, modulo) {
  return ((value % modulo) + modulo) % modulo;
}

export function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片加载失败，请检查链接是否正确"));
    image.src = source;
  });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
