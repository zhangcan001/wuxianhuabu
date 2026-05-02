export async function verifyMediaFiles(paths = [], exists = async () => false) {
  const unique = [...new Set((Array.isArray(paths) ? paths : []).filter(Boolean))];
  const results = [];
  for (const path of unique) {
    const info = await exists(path);
    results.push({
      path,
      exists: Boolean(info && (info === true || info.exists !== false)),
      size: typeof info === "object" ? Number(info.size || 0) : 0,
      mtime: typeof info === "object" ? info.mtime || "" : "",
    });
  }
  return {
    ok: results.every((item) => item.exists),
    missing: results.filter((item) => !item.exists).map((item) => item.path),
    results,
  };
}

export function planThumbnailRebuild(media = []) {
  return (Array.isArray(media) ? media : [])
    .filter((item) => item.path && !item.thumbnailPath)
    .map((item) => ({
      sourcePath: item.path,
      targetPath: item.path.replace(/\.[^.\\/]+$/, "") + ".thumb.jpg",
      kind: item.kind || "image",
    }));
}
