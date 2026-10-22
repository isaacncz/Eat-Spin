import { describe, expect, it } from 'vitest';

import { getLevelProgress } from '@/lib/levelProgress';

describe('getLevelProgress', () => {
  it('turns XP into a percent and the XP left to the next level', () => {
    expect(getLevelProgress(340, 500)).toEqual({ percent: 68, xpToNext: 160 });
    expect(getLevelProgress(0, 500)).toEqual({ percent: 0, xpToNext: 500 });
  });

  it('rounds the percent to a whole number', () => {
    expect(getLevelProgress(1, 3)).toEqual({ percent: 33, xpToNext: 2 });
  });

  it('keeps out-of-range input inside 0 to 100', () => {
    expect(getLevelProgress(-20, 500)).toEqual({ percent: 0, xpToNext: 500 });
    expect(getLevelProgress(900, 500)).toEqual({ percent: 100, xpToNext: 0 });
  });

  it('does not divide by zero', () => {
    expect(getLevelProgress(10, 0)).toEqual({ percent: 0, xpToNext: 0 });
  });
});
