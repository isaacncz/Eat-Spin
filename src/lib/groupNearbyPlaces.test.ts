import { describe, expect, it } from 'vitest';

import { buildRoomNearbyPlaces, roomPlaceIdMap, toRoomPlaceName } from '@/lib/groupNearbyPlaces';
import type { Restaurant } from '@/types';

const place = (name: string, googlePlaceId?: string) => ({ id: name, name, googlePlaceId } as Restaurant);

describe('group nearby places', () => {
  it('truncates long names to the 24-character room limit with an ellipsis', () => {
    expect(toRoomPlaceName('  Short   name ')).toBe('Short name');
    const long = toRoomPlaceName('The Really Long Restaurant Name Bistro');
    expect(long).toHaveLength(24);
    expect(long).toBe('The Really Long Restaur…');
    expect(toRoomPlaceName('x'.repeat(24))).toBe('x'.repeat(24));
  });

  it('deduplicates truncated names, drops invalid place IDs and caps the count', () => {
    const places = buildRoomNearbyPlaces([
      place('Same Prefix Restaurant Alpha', 'ChIJ_a'),
      place('Same Prefix Restaurant Beta', 'ChIJ_b'),
      place('Cafe', 'bad id/x'),
      place('Noodles', 'ChIJ-n'),
    ]);
    expect(places).toEqual([
      { name: 'Same Prefix Restaurant…', placeId: 'ChIJ_a' },
      { name: 'Cafe', placeId: null },
      { name: 'Noodles', placeId: 'ChIJ-n' },
    ]);
    expect(roomPlaceIdMap(places)).toEqual({ 'same prefix restaurant…': 'ChIJ_a', noodles: 'ChIJ-n' });
    expect(buildRoomNearbyPlaces(Array.from({ length: 70 }, (_, i) => place(`P${i}`)))).toHaveLength(60);
  });
});
