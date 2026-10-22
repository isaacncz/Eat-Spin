import { describe, expect, it } from 'vitest';

import {
  EPIC_AFTER_DAYS,
  RARE_AFTER_DAYS,
  RARITIES,
  RARITY_HINT,
  RARITY_LABEL,
  RARITY_XP_MULTIPLIER,
  getRarity,
  getRarityMultiplier,
} from '@/lib/rarity';

const SECOND = 1000;
const DAY = 24 * 60 * 60 * SECOND;
const NOW = Date.UTC(2026, 9, 22, 12, 0, 0);

const visitedAgo = (ms: number) => getRarity(NOW - ms, NOW);

describe('rarity thresholds', () => {
  it('uses 7 and 30 days', () => {
    expect(RARE_AFTER_DAYS).toBe(7);
    expect(EPIC_AFTER_DAYS).toBe(30);
  });
});

describe('getRarity tier boundaries', () => {
  it.each([
    ['just now', 0, 'common'],
    ['one hour ago', DAY / 24, 'common'],
    ['yesterday', 1 * DAY, 'common'],
    ['6 days ago', 6 * DAY, 'common'],
    ['one second before 7 days', 7 * DAY - SECOND, 'common'],
    ['exactly 7 days', 7 * DAY, 'rare'],
    ['7 days and one second', 7 * DAY + SECOND, 'rare'],
    ['15 days ago', 15 * DAY, 'rare'],
    ['29 days ago', 29 * DAY, 'rare'],
    ['one second before 30 days', 30 * DAY - SECOND, 'rare'],
    ['exactly 30 days', 30 * DAY, 'epic'],
    ['30 days and one second', 30 * DAY + SECOND, 'epic'],
    ['90 days ago', 90 * DAY, 'epic'],
    ['two years ago', 730 * DAY, 'epic'],
  ] as const)('visited %s is %s', (_label, elapsed, expected) => {
    expect(visitedAgo(elapsed)).toBe(expected);
  });

  it('treats a place that was never visited as epic', () => {
    expect(getRarity(undefined, NOW)).toBe('epic');
    expect(getRarity(null, NOW)).toBe('epic');
  });

  it('treats an unusable timestamp as never visited', () => {
    expect(getRarity(Number.NaN, NOW)).toBe('epic');
    expect(getRarity(Number.POSITIVE_INFINITY, NOW)).toBe('epic');
    expect(getRarity('yesterday' as unknown as number, NOW)).toBe('epic');
  });

  it('treats a visit in the future (clock change) as a fresh visit', () => {
    expect(visitedAgo(-1 * DAY)).toBe('common');
  });

  it('defaults to the current time when no clock is passed', () => {
    expect(getRarity(Date.now())).toBe('common');
    expect(getRarity(Date.now() - 10 * DAY)).toBe('rare');
    expect(getRarity(Date.now() - 45 * DAY)).toBe('epic');
    expect(getRarity(undefined)).toBe('epic');
  });
});

describe('XP multiplier', () => {
  it('is 1x common, 2x rare, 3x epic', () => {
    expect(RARITY_XP_MULTIPLIER).toEqual({ common: 1, rare: 2, epic: 3 });
    expect(getRarityMultiplier('common')).toBe(1);
    expect(getRarityMultiplier('rare')).toBe(2);
    expect(getRarityMultiplier('epic')).toBe(3);
  });
});

describe('labels', () => {
  it('has a text label and hint for every tier, so colour is never the only signal', () => {
    for (const tier of RARITIES) {
      expect(RARITY_LABEL[tier].length).toBeGreaterThan(0);
      expect(RARITY_HINT[tier].length).toBeGreaterThan(0);
    }
    expect(RARITY_LABEL).toEqual({ common: 'Common', rare: 'Rare', epic: 'Epic' });
  });
});
