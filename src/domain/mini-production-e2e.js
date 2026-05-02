import { buildAssetConsistencyPlan, applyAssetConsistencyPlan } from "./asset-consistency.js";
import { buildEnhancedDeliveryGate } from "./delivery-gate.js";

export function createMiniProductionFixture() {
  return {
    id: "mini-project",
    name: "Mini Production Check",
    activeEpisodeId: "mini-ep",
    episodes: [{
      id: "mini-ep",
      title: "Mini Episode",
      sourceText: "雨夜车站，主角回头。",
      script: "主角在雨夜车站回头。",
      assets: [
        { id: "char-1", type: "character", token: "@主角", prompt: "红衣青年" },
        { id: "scene-1", type: "scene", token: "@车站", prompt: "雨夜车站" },
      ],
      shots: [{
        id: "S01",
        imagePrompt: "雨夜车站，红衣青年回头",
        videoPrompt: "镜头缓慢推进",
        imageUrl: "asset://mini/s01.png",
        imagePath: "mini/s01.png",
        videoUrl: "asset://mini/s01.mp4",
        videoPath: "mini/s01.mp4",
      }],
      timeline: { clips: [{ id: "clip-1", shotId: "S01", mediaUrl: "asset://mini/s01.mp4", mediaPath: "mini/s01.mp4", duration: "4秒" }] },
    }],
  };
}

export function runMiniProductionE2E(project = createMiniProductionFixture()) {
  const episode = project.activeEpisode || project.episodes?.[0] || {};
  const assetPlan = buildAssetConsistencyPlan(episode);
  const fixedEpisode = applyAssetConsistencyPlan(episode, assetPlan);
  const gate = buildEnhancedDeliveryGate(fixedEpisode, { outputSpec: { aspectRatio: "9:16", resolution: "1080x1920", fps: 25 } });
  return {
    ok: assetPlan.missingRefCount === 0 && gate.ok,
    assetPlan,
    gate,
    episode: fixedEpisode,
  };
}
