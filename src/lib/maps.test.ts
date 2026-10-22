import { describe, expect, it } from 'vitest';

import { getMapsUrl } from '@/lib/maps';
import type { Restaurant } from '@/types';

const restaurant = (overrides: Partial<Restaurant> = {}): Restaurant =>
  ({
    id: 'r1',
    name: 'Nasi Lemak & Co',
    coordinates: { lat: 5.4141, lng: 100.3288 },
    ...overrides,
  }) as Restaurant;

describe('getMapsUrl', () => {
  it('prefers the official Google Maps URI', () => {
    const url = getMapsUrl(restaurant({ googleMapsUri: 'https://maps.google.com/?cid=123' }));
    expect(url).toBe('https://maps.google.com/?cid=123');
  });

  it('builds a directions link from coordinates and the place id', () => {
    const url = getMapsUrl(restaurant({ googlePlaceId: 'ChIJabc' }));
    expect(url).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=5.4141,100.3288&destination_place_id=ChIJabc&query=Nasi%20Lemak%20%26%20Co',
    );
  });

  it('leaves the place id empty when there is none', () => {
    expect(getMapsUrl(restaurant())).toContain('destination_place_id=&query=');
  });

  it('falls back to a name search when coordinates are missing', () => {
    const url = getMapsUrl(restaurant({ coordinates: { lat: 0, lng: 0 } }));
    expect(url).toBe('https://www.google.com/maps/search/?api=1&query=Nasi%20Lemak%20%26%20Co');
  });
});
