import { describe, expect, it } from 'vitest';
import { GROUP_ROOM_NAME_MAX_LENGTH, normalizeGroupDisplayName } from './groupRoomIdentity';

describe('group display names', () => {
  it('normalizes pasted whitespace while retaining a recognizable name', () => {
    expect(normalizeGroupDisplayName('  Jane\n\t Tan  ')).toBe('Jane Tan');
    expect(normalizeGroupDisplayName('  阿 明  ')).toBe('阿 明');
  });

  it('keeps blank names distinguishable from a generated guest identity', () => {
    expect(normalizeGroupDisplayName(' \n\t ')).toBe('');
  });

  it('applies the shared participant name limit after normalization', () => {
    expect(normalizeGroupDisplayName(`  ${'A'.repeat(40)}  `)).toBe('A'.repeat(GROUP_ROOM_NAME_MAX_LENGTH));
  });
});
