import {
  clamp,
} from "../canvas-viewport-helpers.js";

let threeModulePromise = null;
let panoramaHelpersPromise = null;

async function loadThreeModule() {
  if (!threeModulePromise) threeModulePromise = import("three");
  return threeModulePromise;
}

async function loadPanoramaHelpers() {
  if (!panoramaHelpersPromise) panoramaHelpersPromise = import("../panorama-helpers.js");
  return panoramaHelpersPromise;
}

export async function renderPerspectiveFromPanorama(...args) {
  const helpers = await loadPanoramaHelpers();
  return helpers.renderPerspectiveFromPanorama(...args);
}

export async function makeVrGrid(...args) {
  const helpers = await loadPanoramaHelpers();
  return helpers.makeVrGrid(...args);
}

export async function createPanoramaScene(canvas, imageSrc, options = {}) {
  const THREE = await loadThreeModule();
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(options.pixelRatio || 1);
  renderer.setClearColor(0x020506, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(76, 1, 0.1, 1200);
  camera.rotation.order = "YXZ";

  const geometry = new THREE.SphereGeometry(500, 96, 64);
  const material = new THREE.MeshBasicMaterial({ color: 0x05090b, side: THREE.BackSide });
  scene.add(new THREE.Mesh(geometry, material));

  let texture = null;
  let disposed = false;
  let view = { yaw: 0, pitch: 0, fov: 76 };

  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin("anonymous");
  loader.load(
    imageSrc,
    (loadedTexture) => {
      if (disposed) {
        loadedTexture.dispose();
        return;
      }
      loadedTexture.colorSpace = THREE.SRGBColorSpace;
      loadedTexture.minFilter = THREE.LinearFilter;
      loadedTexture.magFilter = THREE.LinearFilter;
      texture = loadedTexture;
      material.map = texture;
      material.color.set(0xffffff);
      material.needsUpdate = true;
      api.resize();
      api.render();
      options.onReady?.();
    },
    undefined,
    () => options.onError?.("图片加载失败，请检查链接或上传本地图片"),
  );

  const api = {
    setView(nextView) {
      view = { ...view, ...nextView };
      camera.fov = view.fov || 76;
      camera.rotation.y = view.yaw || 0;
      camera.rotation.x = clamp(view.pitch || 0, -1.45, 1.45);
      camera.updateProjectionMatrix();
    },
    resize() {
      const width = Math.max(1, canvas.clientWidth || canvas.width || 1);
      const height = Math.max(1, canvas.clientHeight || canvas.height || 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },
    render() {
      api.resize();
      renderer.render(scene, camera);
    },
    dispose() {
      disposed = true;
      texture?.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
    },
  };

  return api;
}
