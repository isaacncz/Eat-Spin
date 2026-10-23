import { describe, expect, it } from 'vitest';
import { fitWheelLabel, wrapWithEllipsis, wrapWords } from './wheelLabel';

describe('wrapWords', () => {
  it('wraps greedily and refuses words wider than a line or extra lines', () => {
    expect(wrapWords('Tek Sen Restaurant', 10, 2)).toEqual(['Tek Sen', 'Restaurant']);
    expect(wrapWords('Restaurant', 6, 2)).toBeNull();
    expect(wrapWords('a b c d', 1, 3)).toBeNull();
  });
});

describe('wrapWithEllipsis', () => {
  it('cuts the last line with an ellipsis', () => {
    expect(wrapWithEllipsis('Ah Boy Koay Teow Thng Special', 8, 2)).toEqual(['Ah Boy', 'Koay…']);
  });
  it('never splits a word mid-word', () => {
    expect(wrapWithEllipsis('Tek Sen Restaurant', 8, 3)).toEqual(['Tek Sen', 'Restaurant']);
    expect(wrapWithEllipsis('Hameediyah', 8, 3)).toEqual(['Hameediyah']);
  });
});

describe('fitWheelLabel', () => {
  // ~84px is a 10-slice segment on a 360px wheel.
  it('keeps whole words on narrow segments', () => {
    expect(fitWheelLabel('Tek Sen Restaurant', 60, 14).lines).toEqual(['Tek Sen', 'Restaurant']);
    expect(fitWheelLabel('Hameediyah', 60, 14).lines).toEqual(['Hameediyah']);
  });

  it('shows common names in full, mostly on two lines', () => {
    for (const name of ['Tek Sen Restaurant', 'Nasi Kandar Line Clear', 'Chulia Street Hawker', "Ah Boy Koay Teow Th'ng", 'Kafe Kheng Pin']) {
      const { lines } = fitWheelLabel(name, 84, 14);
      expect(lines.length).toBeLessThanOrEqual(3);
      expect(lines.join(' ')).toBe(name);
    }
    expect(fitWheelLabel('Tek Sen Restaurant', 84, 14).lines).toEqual(['Tek Sen', 'Restaurant']);
    expect(fitWheelLabel('Kafe Kheng Pin', 84, 14).lines).toHaveLength(2);
  });

  it('shrinks the font before adding a third line', () => {
    const fitted = fitWheelLabel('Nasi Kandar Line Clear', 84, 16);
    expect(fitted.lines).toHaveLength(2);
    expect(fitted.fontSize).toBeLessThan(16);
    expect(fitted.fontSize).toBeGreaterThanOrEqual(11.5);
  });

  it('only cuts a name that cannot fit three lines at the smallest size', () => {
    const fitted = fitWheelLabel('The Extraordinarily Long Restaurant Name Of George Town Penang', 60, 14);
    expect(fitted.lines.length).toBeLessThanOrEqual(3);
    expect(fitted.lines[fitted.lines.length - 1].endsWith('…')).toBe(true);
    expect(fitted.fontSize).toBe(11.5);
  });
});
