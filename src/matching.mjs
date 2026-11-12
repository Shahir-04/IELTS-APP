/** Extract numbered references, preserving CD and dotted track identifiers. */
export function trackReferences(text) {
  const references = new Set();
  for (const match of text.matchAll(
    /(?:track|audio|recording|cd)[\s_:-]*(\d+(?:[.\-_]\d+)*)(?:\s*(?:track|audio)[\s_:-]*(\d+))?/gi,
  )) {
    references.add(
      normalizeTrack(match[2] ? `${match[1]}.${match[2]}` : match[1]),
    );
  }
  return [...references];
}
/** Normalize filename track numbers without conflating 1, 10, and 1.1. */
export function normalizeTrack(value) {
  return value
    .split(/[.\-_]/)
    .map((part) => String(Number(part)))
    .join(".");
}
/** Match explicit audio labels first, then a leading numeric filename. */
export function filenameTrack(name) {
  const stem = name.replace(/\.[a-z0-9]+$/i, "");
  return (
    trackReferences(stem)[0] ??
    (stem.match(/^(\d+(?:[.\-_]\d+)*)(?=[\s_\-]|$)/)?.[1]
      ? normalizeTrack(stem.match(/^(\d+(?:[.\-_]\d+)*)/)[1])
      : null)
  );
}
/** Return tracks linked manually or identified in the page's extracted text. */
export function pageTracks(tracks, text, page) {
  const references = trackReferences(text);
  return tracks.filter(
    (track) =>
      track.pages?.includes(page) ||
      (track.track && references.includes(track.track)),
  );
}
