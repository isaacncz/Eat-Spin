export const GROUP_ROOM_PARTICIPANT_STALE_MS = 45_000;
// Presence subscriptions can arrive after room metadata; avoid briefly claiming the host left.
export const GROUP_ROOM_HOST_MISSING_GRACE_MS = 10_000;

export type HostPresence = 'viewer-offline' | 'checking' | 'present' | 'absent';

interface HostPresenceInput {
  connected: boolean;
  hostUid: string;
  participants: ReadonlyArray<{ uid: string; lastSeenAt: number }>;
  now: number;
  /** When the connected viewer first observed no host record, not the room creation time. */
  missingSince: number | null;
}

/** A local clock must refresh callers even when no Firebase value event arrives. */
export function getHostPresence({ connected, hostUid, participants, now, missingSince }: HostPresenceInput): HostPresence {
  if (!connected) return 'viewer-offline';
  if (!hostUid) return 'checking';
  const host = participants.find(participant => participant.uid === hostUid);
  if (host) {
    // A positive timestamp ahead of this device's clock is fresh, not an absent host.
    return Number.isFinite(host.lastSeenAt) && host.lastSeenAt > 0
      && now - host.lastSeenAt <= GROUP_ROOM_PARTICIPANT_STALE_MS ? 'present' : 'absent';
  }
  if (missingSince === null || now - missingSince < GROUP_ROOM_HOST_MISSING_GRACE_MS) return 'checking';
  return 'absent';
}
