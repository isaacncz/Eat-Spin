import { describe, expect, it } from 'vitest';
import { getHostPresence, GROUP_ROOM_HOST_MISSING_GRACE_MS, GROUP_ROOM_PARTICIPANT_STALE_MS } from './groupRoomPresence';

const now = 1_000_000;
const input = { connected: true, hostUid: 'host', participants: [], now, missingSince: now };

describe('host presence feedback', () => {
  it('distinguishes local loss of connectivity from absent host presence', () => {
    expect(getHostPresence({ ...input, connected: false, missingSince: 0 })).toBe('viewer-offline');
    expect(getHostPresence({ ...input, hostUid: '', missingSince: 0 })).toBe('checking');
  });

  it('allows presence subscriptions to settle before reporting a missing host', () => {
    expect(getHostPresence({ ...input, missingSince: null })).toBe('checking');
    expect(getHostPresence({ ...input, now: now + GROUP_ROOM_HOST_MISSING_GRACE_MS - 1 })).toBe('checking');
    expect(getHostPresence({ ...input, now: now + GROUP_ROOM_HOST_MISSING_GRACE_MS })).toBe('absent');
  });

  it('ages a host heartbeat without needing another listener event', () => {
    const participants = [{ uid: 'host', lastSeenAt: now }];
    expect(getHostPresence({ ...input, participants, now: now + GROUP_ROOM_PARTICIPANT_STALE_MS })).toBe('present');
    expect(getHostPresence({ ...input, participants, now: now + GROUP_ROOM_PARTICIPANT_STALE_MS + 1 })).toBe('absent');
  });

  it('clears absence once the same host reconnects with a fresh heartbeat', () => {
    const absent = { ...input, missingSince: now - GROUP_ROOM_HOST_MISSING_GRACE_MS };
    expect(getHostPresence(absent)).toBe('absent');
    expect(getHostPresence({ ...absent, participants: [{ uid: 'host', lastSeenAt: now }] })).toBe('present');
  });

  it('does not treat a participant or a readiness flag as host presence', () => {
    expect(getHostPresence({ ...input, participants: [{ uid: 'cohost', lastSeenAt: now }], missingSince: 0 })).toBe('absent');
    const presentHostNotMarkedReady = [{ uid: 'host', lastSeenAt: now, ready: false }];
    expect(getHostPresence({ ...input, participants: presentHostNotMarkedReady })).toBe('present');
  });

  it('treats future positive heartbeat times as fresh and malformed times as absent', () => {
    expect(getHostPresence({ ...input, participants: [{ uid: 'host', lastSeenAt: now + 1_000 }] })).toBe('present');
    expect(getHostPresence({ ...input, participants: [{ uid: 'host', lastSeenAt: Number.NaN }] })).toBe('absent');
  });
});
