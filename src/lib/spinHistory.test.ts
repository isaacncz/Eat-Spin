import { describe, expect, it } from 'vitest';
import { appendSpinHistory, parseSpinHistory } from './spinHistory';
import type { Restaurant } from '@/types';
const restaurant = { id: 'manual-one', name: 'Noodles' } as Restaurant;
describe('spin history', () => {
  it('counts each personal spin', () => {
    const first = appendSpinHistory([], restaurant, 'lunch');
    expect(appendSpinHistory(first, restaurant, 'lunch')).toHaveLength(2);
  });
  it('counts a group event only once across replay and reload', () => {
    const first = appendSpinHistory([], restaurant, 'lunch', 'group:ABC:123', 1000);
    const loaded = parseSpinHistory(JSON.stringify(first));
    expect(appendSpinHistory(loaded, restaurant, 'lunch', 'group:ABC:123', 2000)).toHaveLength(1);
    expect(appendSpinHistory(loaded, restaurant, 'lunch', 'group:ABC:124', 2000)).toHaveLength(2);
    expect(loaded[0].timestamp.getTime()).toBe(1000);
  });
  it('preserves legacy records and ignores invalid timestamps', () => {
    const old = { restaurant, mealTime: 'lunch', timestamp: '2026-10-22T12:00:00Z' };
    expect(parseSpinHistory(JSON.stringify([old]))).toHaveLength(1);
    expect(parseSpinHistory(JSON.stringify([{ ...old, timestamp: 'bad' }]))).toEqual([]);
  });
});
