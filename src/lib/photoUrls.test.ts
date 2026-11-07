import { describe, expect, it } from 'vitest';
import { toViewerPhotoUrl, VIEWER_PHOTO_MAX_PX } from '@/lib/photoUrls';

describe('toViewerPhotoUrl', () => {
  it('requests a larger Places photo and keeps the photo and key', () => {
    const card = 'https://places.googleapis.com/v1/places/abc/photos/xyz/media?maxHeightPx=720&maxWidthPx=720&key=test-key';
    const url = new URL(toViewerPhotoUrl(card));
    expect(url.pathname).toBe('/v1/places/abc/photos/xyz/media');
    expect(url.searchParams.get('maxHeightPx')).toBe(String(VIEWER_PHOTO_MAX_PX));
    expect(url.searchParams.get('maxWidthPx')).toBe(String(VIEWER_PHOTO_MAX_PX));
    expect(url.searchParams.get('key')).toBe('test-key');
  });

  it('leaves other URLs and invalid input unchanged', () => {
    expect(toViewerPhotoUrl('/test-photos/one.svg')).toBe('/test-photos/one.svg');
    expect(toViewerPhotoUrl('https://example.com/photo.jpg?w=10')).toBe('https://example.com/photo.jpg?w=10');
    expect(toViewerPhotoUrl('https://places.googleapis.com/v1/places/abc')).toBe('https://places.googleapis.com/v1/places/abc');
  });
});
