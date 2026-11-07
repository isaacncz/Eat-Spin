/** Longest side requested for the full-screen photo viewer (cards use 720). */
export const VIEWER_PHOTO_MAX_PX = 1200;

/**
 * Larger variant of a Places photo URL for the viewer. Other URLs are returned unchanged.
 * The stored `photos` strings stay as they are; this is derived only when a photo is opened.
 */
export function toViewerPhotoUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'places.googleapis.com' || !parsed.pathname.endsWith('/media')) return url;
    parsed.searchParams.set('maxHeightPx', String(VIEWER_PHOTO_MAX_PX));
    parsed.searchParams.set('maxWidthPx', String(VIEWER_PHOTO_MAX_PX));
    return parsed.toString();
  } catch {
    return url;
  }
}
