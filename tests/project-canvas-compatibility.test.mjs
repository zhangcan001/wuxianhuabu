import assert from "node:assert/strict";
import test from "node:test";
import {
  isBusinessCanvasNode,
  materializeLegacyCanvasFromBusinessProject,
  mergeAdvancedCanvasProjection,
  reduceCanvasNodeEditToProjectStore,
  reduceProjectStoreWithCanvasCompatibility,
} from "../src/app/project-canvas-compatibility.js";
import {
  createProjectStoreState,
} from "../src/app/project-store.js";
import {
  normalizeAssetRows,
} from "../src/product/studio/production-selectors.js";

function businessProject() {
  return {
    id: "project-1",
    activeEpisodeId: "ep-1",
    episodes: [{
      id: "ep-1",
      title: "第一集",
      sourceText: "原文",
      assets: [{ id: "hero", token: "hero", name: "主角", type: "character" }],
      shots: [{ id: "s1", title: "镜头 1", imagePrompt: "old prompt" }],
    }],
  };
}

test("materializeLegacyCanvasFromBusinessProject projects active business episode", () => {
  const canvas = materializeLegacyCanvasFromBusinessProject(businessProject(), [], []);

  assert.equal(canvas.projected, true);
  assert.equal(canvas.nodes.length, 3);
  assert.equal(canvas.edges.length, 2);
  assert.equal(canvas.nodes.find((node) => node.type === "shotList").data.shots[0].id, "s1");
});

test("reduceProjectStoreWithCanvasCompatibility can materialize canvas with store action", () => {
  const state = createProjectStoreState(businessProject(), { source: "test" });
  const result = reduceProjectStoreWithCanvasCompatibility({
    storeState: state,
    action: {
      type: "updateEpisode",
      episodeId: "ep-1",
      updater: (episode) => ({
        ...episode,
        shots: [...episode.shots, { id: "s2", title: "镜头 2" }],
      }),
    },
    nodes: [],
    edges: [],
    materializeCanvas: true,
  });

  assert.equal(result.materialized, true);
  assert.equal(result.storeState.revision, 1);
  assert.deepEqual(
    result.nodes.find((node) => node.type === "shotList").data.shots.map((shot) => shot.id),
    ["s1", "s2"],
  );
});

test("reduceCanvasNodeEditToProjectStore applies legacy shot list edits to business project", () => {
  const state = createProjectStoreState(businessProject(), { source: "test" });
  const next = reduceCanvasNodeEditToProjectStore({
    storeState: state,
    node: {
      id: "episode-ep-1-shots",
      type: "shotList",
      data: {
        episodeId: "ep-1",
        shots: [{ id: "s1", title: "镜头 1", imagePrompt: "new prompt" }],
      },
    },
  });

  assert.equal(next.revision, 1);
  assert.equal(next.project.episodes[0].shots[0].imagePrompt, "new prompt");
});

test("reduceCanvasNodeEditToProjectStore keeps generated asset media visible to studio rows", () => {
  const state = createProjectStoreState(businessProject(), { source: "test" });
  const next = reduceCanvasNodeEditToProjectStore({
    storeState: state,
    node: {
      id: "episode-ep-1-assets",
      type: "assetLibrary",
      data: {
        episodeId: "ep-1",
        characters: [{
          id: "hero",
          name: "主角",
          token: "hero",
          imageUrl: "asset://localhost/C:/Users/ADMIN/.wuxianhuabu/media-cache/hero.png",
          imagePath: "C:/Users/ADMIN/.wuxianhuabu/media-cache/hero.png",
          imageThumbnailUrl: "asset://localhost/C:/Users/ADMIN/.wuxianhuabu/media-cache/hero-thumb.png",
          imageThumbnailPath: "C:/Users/ADMIN/.wuxianhuabu/media-cache/hero-thumb.png",
          imageItems: [{
            imageUrl: "asset://localhost/C:/Users/ADMIN/.wuxianhuabu/media-cache/hero.png",
            imagePath: "C:/Users/ADMIN/.wuxianhuabu/media-cache/hero.png",
            thumbnailUrl: "asset://localhost/C:/Users/ADMIN/.wuxianhuabu/media-cache/hero-thumb.png",
            thumbnailPath: "C:/Users/ADMIN/.wuxianhuabu/media-cache/hero-thumb.png",
          }],
        }],
        scenes: [],
        props: [],
      },
    },
  });
  const [asset] = next.project.episodes[0].assets;
  const [row] = normalizeAssetRows(next.project.episodes[0].assets);

  assert.equal(next.revision, 1);
  assert.equal(asset.imageUrl, "asset://localhost/C:/Users/ADMIN/.wuxianhuabu/media-cache/hero.png");
  assert.equal(asset.imagePath, "C:/Users/ADMIN/.wuxianhuabu/media-cache/hero.png");
  assert.equal(row.hasImage, true);
  assert.equal(row.imageUrl, "asset://localhost/C:/Users/ADMIN/.wuxianhuabu/media-cache/hero.png");
  assert.equal(row.imageCandidates.some((candidate) => (
    candidate.thumbnailUrl === "asset://localhost/C:/Users/ADMIN/.wuxianhuabu/media-cache/hero-thumb.png"
  )), true);
});

test("canvas compatibility ignores non-business canvas nodes", () => {
  const state = createProjectStoreState(businessProject(), { source: "test" });
  const node = { id: "note-1", type: "text", data: { text: "hello" } };

  assert.equal(isBusinessCanvasNode(node), false);
  assert.equal(reduceCanvasNodeEditToProjectStore({ storeState: state, node }), state);
});

test("mergeAdvancedCanvasProjection merges projected nodes into existing canvas", () => {
  const result = mergeAdvancedCanvasProjection({
    episode: businessProject().episodes[0],
    nodes: [{ id: "free-note", type: "text", x: 0, y: 0, data: {} }],
    edges: [],
    origin: { x: 10, y: 20 },
  });

  assert.equal(result.projected, true);
  assert.equal(result.nodes.some((node) => node.id === "free-note"), true);
  assert.equal(result.nodes.some((node) => node.type === "novelPipeline"), true);
  assert.equal(result.edges.length, 2);
});
