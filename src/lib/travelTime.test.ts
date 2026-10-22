import { describe, expect, it } from 'vitest';

import { estimateTravelTime } from '@/lib/travelTime';

describe('estimateTravelTime', () => {
  it('says walk for short distances', () => {
    // 0.5 km straight is 0.7 road km, about 8 minutes on foot.
    expect(estimateTravelTime(0.5)).toBe('~8 min walk');
  });

  it('never says less than 1 minute', () => {
    expect(estimateTravelTime(0)).toBe('~1 min walk');
    expect(estimateTravelTime(5)).not.toContain('~0');
  });

  it('switches to driving once the road distance passes 1.2 km', () => {
    // 0.85 km straight is 1.19 road km: still a walk.
    expect(estimateTravelTime(0.85)).toContain('walk');
    // 1 km straight is 1.4 road km: about 3 minutes by car.
    expect(estimateTravelTime(1)).toBe('~3 min drive');
  });

  it('scales with distance', () => {
    expect(estimateTravelTime(4)).toBe('~11 min drive');
  });
});
