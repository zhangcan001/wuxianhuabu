export function buildEnhancedDeliveryGate(episode = {}, options = {}) {
  const clips = Array.isArray(episode.timeline?.clips) ? episode.timeline.clips : [];
  const blockers = [];
  const warnings = [];
  if (!clips.length) blockers.push("timeline");
  clips.forEach((clip) => {
    if (!clip.mediaUrl && !clip.videoUrl) blockers.push(`clip-media:${clip.id || clip.shotId}`);
    if (!clip.duration) warnings.push(`clip-duration:${clip.id || clip.shotId}`);
  });
  const spec = options.outputSpec || {};
  if (!spec.aspectRatio && !episode.outputSpec?.aspectRatio) warnings.push("aspectRatio");
  if (!spec.resolution && !episode.outputSpec?.resolution) warnings.push("resolution");
  if (!spec.fps && !episode.outputSpec?.fps) warnings.push("fps");
  if (options.requireCover && !episode.coverImage && !episode.coverImageUrl) warnings.push("cover");
  if (options.requireSubtitles && !episode.subtitles?.length) warnings.push("subtitles");
  if (options.requireVoice && !episode.voiceTracks?.length) warnings.push("voice");
  return {
    ok: blockers.length === 0,
    readyForRender: blockers.length === 0,
    blockers: unique(blockers),
    warnings: unique(warnings),
    score: Math.max(0, Math.round(100 - blockers.length * 25 - warnings.length * 8)),
  };
}

function unique(items = []) {
  return [...new Set(items)];
}
