import { describe, expect, it } from 'vitest';

import { normalizeRoomCode, ROOM_CODE_LENGTH } from '@/lib/roomCode';

describe('normalizeRoomCode', () => {
  it('upper-cases, drops punctuation and cuts to the code length', () => {
    expect(normalizeRoomCode('k7q-x2m')).toBe('K7QX2M');
    expect(normalizeRoomCode('abc 123 456')).toBe('ABC123');
    expect(normalizeRoomCode('abc 123 456')).toHaveLength(ROOM_CODE_LENGTH);
  });

  it('returns an empty string for nothing usable', () => {
    expect(normalizeRoomCode('  -- ')).toBe('');
  });

  it('turns a room code from a shared link query into the join field value', () => {
    const roomFromLink = new URLSearchParams('?room=k7qx2m').get('room') ?? '';
    expect(normalizeRoomCode(roomFromLink)).toBe('K7QX2M');
  });
});
