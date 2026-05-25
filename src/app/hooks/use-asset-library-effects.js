import { useEffect } from "react";

export function useAssetLibraryEffects({
  assetIndex = {},
  nodes = [],
  setNodes = () => {},
  syncGeneratedImagesIntoAssets = (currentNodes) => currentNodes,
  syncBusinessCanvasNodesToProjectStore = () => {},
  assetForStorage = (asset) => asset,
  storage = localStorage,
  storageKey = "",
} = {}) {
  useEffect(() => {
    persistAssetLibrary(assetIndex, { assetForStorage, storage, storageKey });
  }, [assetForStorage, assetIndex, storage, storageKey]);

  useEffect(() => {
    const nextNodes = syncGeneratedImagesIntoAssets(nodes);
    if (nextNodes !== nodes) {
      syncBusinessCanvasNodesToProjectStore(nextNodes, nodes);
      setNodes(nextNodes);
    }
  }, [nodes, setNodes, syncBusinessCanvasNodesToProjectStore, syncGeneratedImagesIntoAssets]);
}

function persistAssetLibrary(assetIndex, {
  assetForStorage = (asset) => asset,
  storage = localStorage,
  storageKey = "",
} = {}) {
  const characters = assetIndex?.characters || [];
  const scenes = assetIndex?.scenes || [];
  const props = assetIndex?.props || [];
  if (!characters.length && !scenes.length && !props.length) return;
  try {
    storage.setItem(storageKey, JSON.stringify({
      characters: characters.map(assetForStorage),
      scenes: scenes.map(assetForStorage),
      props: props.map(assetForStorage),
      savedAt: Date.now(),
    }));
  } catch {
    // The project file remains the source of truth when browser storage is full.
  }
}
