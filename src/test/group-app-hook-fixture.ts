// Playwright route replacement for the room hook. The real App, room screen and
// wheel still render; the Firebase SDK and network are covered by emulator tests.
import { useCallback, useEffect, useState } from 'react';
import type { GroupRoomParticipant, GroupRoomSpin, GroupRoomVote } from '@/hooks/useFirebaseGroupRoom';

export const GROUP_ROOM_MAX_PARTICIPANTS = 8;
export const GROUP_ROOM_SPIN_COOLDOWN_MS = 7_000;
export const GROUP_ROOM_NAME_MAX_LENGTH = 24;

const STORAGE_KEY = 'eatspin:test-group-workspace';
const preferenceKey = (name: string) => Array.from(new TextEncoder().encode(name.toLowerCase()))
  .map(byte => byte.toString(16).padStart(2, '0')).join('');

interface FixtureState {
  roomId: string;
  roomListNames: string[];
  currentSpin: GroupRoomSpin | null;
  votes: GroupRoomVote[];
  preferences: Record<string, Record<string, 'prefer' | 'avoid'>>;
  participants: GroupRoomParticipant[];
  displayName: string;
  connected: boolean;
  syncCalls: string[][];
}

export function useFirebaseGroupRoom() {
  const params = new URLSearchParams(location.search);
  const authUid = params.get('fixtureRole') === 'member' ? 'member' : 'host';
  const [state, setState] = useState<FixtureState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved) as FixtureState;
    const now = Date.now();
    return {
      roomId: params.get('room') ?? '', roomListNames: params.has('room') ? ['Room noodles', 'Room rice'] : [],
      currentSpin: null, votes: [], preferences: {},
      participants: ['host', 'member', 'pending'].map((uid, index) => ({
        uid, name: ['Isaac', 'Jane', 'Alex'][index], joinedAt: now, lastSeenAt: now, ready: true,
      })),
      displayName: authUid === 'host' ? 'Isaac' : 'Jane', connected: true, syncCalls: [],
    };
  });
  const patch = useCallback((changes: Partial<FixtureState>) => setState(previous => ({ ...previous, ...changes })), []);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [state]);

  const syncHostList = useCallback(async (names: string[]) => {
    setState(previous => ({ ...previous, roomListNames: names, syncCalls: [...previous.syncCalls, names] }));
  }, []);
  const requestHostSpin = useCallback(async (names: string[]) => {
    const now = Date.now();
    const spin: GroupRoomSpin = {
      spinId: `fixture-spin-${now}`, winnerIndex: 0, winnerName: names[0],
      startedAt: now, completedAt: now + 7_000, startedBy: authUid,
    };
    patch({ currentSpin: spin, votes: [] });
    return spin;
  }, [authUid, patch]);
  const saveDisplayName = useCallback(async (value: string) => {
    const name = value.trim().replace(/\s+/g, ' ').slice(0, GROUP_ROOM_NAME_MAX_LENGTH);
    if (!name || !state.connected) return false;
    setState(previous => ({ ...previous, displayName: name,
      participants: previous.participants.map(person => person.uid === authUid ? { ...person, name } : person) }));
    return true;
  }, [authUid, state.connected]);
  const setGoingVote = useCallback(async (going: boolean) => {
    setState(previous => previous.currentSpin ? {
      ...previous,
      votes: [...previous.votes.filter(vote => vote.uid !== authUid), {
        uid: authUid, name: previous.displayName, spinId: previous.currentSpin.spinId, going, updatedAt: Date.now(),
      }],
    } : previous);
  }, [authUid]);
  const setPreference = useCallback(async (name: string, value: 'prefer' | 'avoid' | null) => {
    setState(previous => {
      const mine = { ...previous.preferences[authUid] };
      if (value) mine[preferenceKey(name)] = value;
      else delete mine[preferenceKey(name)];
      return { ...previous, preferences: { ...previous.preferences, [authUid]: mine } };
    });
  }, [authUid]);

  useEffect(() => {
    Object.assign(window, { groupAppHarness: {
      state: { ...state, authUid },
      setConnected: (connected: boolean) => patch({ connected }),
      setParticipants: (participants: GroupRoomParticipant[]) => patch({ participants }),
      setRemoteSpin: (spin: GroupRoomSpin) => patch({ currentSpin: spin, votes: [] }),
      setVotes: (votes: GroupRoomVote[]) => patch({ votes }),
    } });
  }, [authUid, patch, state]);

  return {
    ...state, authUid, hostUid: 'host', roomLink: location.origin + '/?room=' + state.roomId,
    isFirebaseConfigured: true, firebaseConfigError: null, authLoading: false, authError: null,
    resolvedDisplayName: state.displayName, setDisplayName: (displayName: string) => patch({ displayName }),
    saveDisplayName, isSavingDisplayName: false,
    isHost: authUid === 'host', isCohost: false, cohostUids: [], canEditList: authUid === 'host',
    isBusy: false, roomError: null, clearRoomError: () => {},
    roomStatus: state.currentSpin ? 'completed' as const : 'waiting' as const,
    reactions: [], listSyncState: 'saved' as const, canSeedList: false, listLoaded: true,
    createRoom: async () => { setState(previous => ({ ...previous, roomId: 'ROOM42', roomListNames: [],
      participants: previous.participants.filter(participant => participant.uid === authUid) })); },
    joinRoom: async (roomId: string) => { patch({ roomId }); },
    leaveRoom: async () => { patch({ roomId: '' }); },
    syncHostList, retryRoomList: async () => {}, transferHost: async () => {},
    setParticipantCohost: async () => {}, requestHostSpin, sendReaction: async () => {},
    setGoingVote, setPreference, restoreRoomPlaces: async () => {},
  };
}
