import { describe, expect, it } from 'vitest';

import { formatLastVisit } from '@/lib/lastVisit';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2025, 3, 16, 12, 0, 0);

describe('formatLastVisit', () => {
  it('says so when the place was never visited', () => {
    expect(formatLastVisit(undefined, undefined, NOW)).toBe('Not visited yet');
    expect(formatLastVisit(null, 3, NOW)).toBe('Not visited yet');
    expect(formatLastVisit(Number.NaN, 3, NOW)).toBe('Not visited yet');
  });

  it('counts whole 24-hour days', () => {
    expect(formatLastVisit(NOW - 12 * DAY, 6, NOW)).toBe('Last visit 12 days ago · 6 visits');
    expect(formatLastVisit(NOW - 2 * DAY - 1000, 2, NOW)).toBe('Last visit 2 days ago · 2 visits');
  });

  it('uses today and yesterday for the last two days', () => {
    expect(formatLastVisit(NOW - 3 * 60 * 60 * 1000, 1, NOW)).toBe('Last visit today · 1 visit');
    expect(formatLastVisit(NOW - DAY - 1000, 1, NOW)).toBe('Last visit yesterday · 1 visit');
  });

  it('treats a timestamp in the future as today', () => {
    expect(formatLastVisit(NOW + 5 * DAY, 1, NOW)).toBe('Last visit today · 1 visit');
  });

  it('leaves the count out when it is unknown or zero', () => {
    expect(formatLastVisit(NOW - 9 * DAY, undefined, NOW)).toBe('Last visit 9 days ago');
    expect(formatLastVisit(NOW - 9 * DAY, 0, NOW)).toBe('Last visit 9 days ago');
  });
});
