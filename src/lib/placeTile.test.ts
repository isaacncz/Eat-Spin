import { describe, expect, it } from 'vitest';

import { getPlaceInitial, getPlaceTileColor, PLACE_TILE_COLORS } from '@/lib/placeTile';

describe('getPlaceInitial', () => {
  it('uses the first letter, upper-cased', () => {
    expect(getPlaceInitial('nasi kandar Pelita')).toBe('N');
    expect(getPlaceInitial('CKT Stall, Lorong 3')).toBe('C');
  });

  it('ignores leading spaces and punctuation', () => {
    expect(getPlaceInitial('   Kheng Cafe')).toBe('K');
    expect(getPlaceInitial('(Sup) Tulang')).toBe('S');
    expect(getPlaceInitial('"Mee Hoon" Corner')).toBe('M');
  });

  it('skips a leading emoji and keeps digits', () => {
    expect(getPlaceInitial('🍜 Noodle House')).toBe('N');
    expect(getPlaceInitial('7-Eleven')).toBe('7');
  });

  it('handles non-Latin names', () => {
    expect(getPlaceInitial('老王面馆')).toBe('老');
  });

  it('falls back to the first character, then to a question mark', () => {
    expect(getPlaceInitial('🍜')).toBe('🍜');
    expect(getPlaceInitial('   ')).toBe('?');
    expect(getPlaceInitial('')).toBe('?');
  });
});

describe('getPlaceTileColor', () => {
  it('always returns one of the arcade colours', () => {
    for (const name of ['Nasi Kandar Pelita', 'CKT Stall', 'Kheng Cafe', 'Sup Tulang Pak Mat', '', '🍜', 'a', 'b', 'c']) {
      expect(PLACE_TILE_COLORS).toContain(getPlaceTileColor(name));
    }
  });

  it('is stable for the same place, whatever the case or spacing', () => {
    expect(getPlaceTileColor('Kheng Cafe')).toBe(getPlaceTileColor('Kheng Cafe'));
    expect(getPlaceTileColor('Kheng Cafe')).toBe(getPlaceTileColor('  kheng   CAFE '));
  });

  it('spreads different names across more than one colour', () => {
    const names = ['Nasi Kandar Pelita', 'CKT Stall', 'Kheng Cafe', 'Sup Tulang', 'Mee Hoon Corner', 'Sushi Place', 'Burger Spot'];
    const colors = new Set(names.map(getPlaceTileColor));
    expect(colors.size).toBeGreaterThan(2);
  });
});
