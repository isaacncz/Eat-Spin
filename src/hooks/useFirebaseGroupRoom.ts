import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  child,
  get,
  onDisconnect,
  onValue,
  ref,
  remove,
  runTransaction,
  set,
  update,
  type OnDisconnect,
} from 'firebase/database';
import { ensureAnonymousAuthUser, firebaseConfigError, firebaseDb, isFirebaseConfigured } from '@/lib/firebase';

const DISPLAY_NAME_KEY = 'eatspin:display-name';
const ROOM_CODE_LENGTH = 6;
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
const PRESENCE_HEARTBEAT_MS = 10_000;
const PARTICIPANT_STALE_MS = 45_000;
const STALE_CLEANUP_COOLDOWN_MS = 30_000;
const MAX_LIST_ITEMS = 60;

export const GROUP_ROOM_MAX_PARTICIPANTS = 8;
export const GROUP_ROOM_SPIN_COOLDOWN_MS = 7_000;
export const GROUP_ROOM_NAME_MAX_LENGTH = 24;

type RoomStatus = 'waiting' | 'spinning' | 'completed';

interface RoomMeta {
  hostUid: string;
  status: RoomStatus;
  createdAt: number;
  expiresAt: number;
  lastSpinAt: number;
}

export interface GroupRoomParticipant {
  uid: string;
  name: string;
  joinedAt: number;
  lastSeenAt: number;
  ready: boolean;
}

interface RoomListItem {
  key: string;
  name: string;
  order: number;
  createdAt: number;
}

export interface GroupRoomSpin {
  spinId: string;
  winnerIndex: number;
  winnerName: string;
  startedAt: number;
  completedAt: number;
  startedBy: string;
}

const normalizeDisplayName = (value: string) => value.trim().replace(/\s+/g, ' ').slice(0, GROUP_ROOM_NAME_MAX_LENGTH);

const normalizeRoomCode = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, ROOM_CODE_LENGTH);

const extractRoomCode = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.includes('room=')) {
    try {
      return normalizeRoomCode(new URL(trimmed).searchParams.get('room') ?? '');
    } catch {
      return normalizeRoomCode(trimmed);
    }
  }
  return normalizeRoomCode(trimmed);
};

const generateRoomCode = () => Math.random().toString(36).slice(2, 2 + ROOM_CODE_LENGTH).toUpperCase();

const getBaseUrl = () => {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}${window.location.pathname}`;
};

const buildRoomLink = (roomId: string) => {
  if (!roomId) return '';
  const baseUrl = getBaseUrl();
  if (!baseUrl) return `?room=${roomId}`;
  const url = new URL(baseUrl);
  url.searchParams.set('room', roomId);
  return url.toString();
};

const buildGuestName = (uid: string) => `Guest-${uid.slice(0, 4).toUpperCase()}`;

const parseRoomStatus = (value: unknown): RoomStatus => {
  if (value === 'waiting' || value === 'spinning' || value === 'completed') return value;
  return 'waiting';
};

const parseRoomMeta = (raw: unknown): RoomMeta | null => {
  if (!raw || typeof raw !== 'object') return null;

  const candidate = raw as Record<string, unknown>;
  const hostUid = typeof candidate.hostUid === 'string' ? candidate.hostUid : '';
  const createdAt = typeof candidate.createdAt === 'number' ? candidate.createdAt : 0;
  const expiresAt = typeof candidate.expiresAt === 'number' ? candidate.expiresAt : 0;
  const lastSpinAt = typeof candidate.lastSpinAt === 'number' ? candidate.lastSpinAt : 0;

  if (!hostUid || createdAt <= 0 || expiresAt <= 0) return null;

  return {
    hostUid,
    status: parseRoomStatus(candidate.status),
    createdAt,
    expiresAt,
    lastSpinAt,
  };
};

const parseParticipants = (raw: unknown) => {
  if (!raw || typeof raw !== 'object') return [] as GroupRoomParticipant[];

  const entries = Object.entries(raw as Record<string, unknown>);
  const parsed = entries.reduce<GroupRoomParticipant[]>((accumulator, [uid, value]) => {
    if (!value || typeof value !== 'object') return accumulator;
    const candidate = value as Record<string, unknown>;
    const name = normalizeDisplayName(typeof candidate.name === 'string' ? candidate.name : '');
    const joinedAt = typeof candidate.joinedAt === 'number' ? candidate.joinedAt : 0;
    const lastSeenAt = typeof candidate.lastSeenAt === 'number' ? candidate.lastSeenAt : 0;
    const ready = typeof candidate.ready === 'boolean' ? candidate.ready : false;
    if (!uid || joinedAt <= 0 || lastSeenAt <= 0) return accumulator;

    accumulator.push({
      uid,
      name: name || buildGuestName(uid),
      joinedAt,
      lastSeenAt,
      ready,
    });

    return accumulator;
  }, []);

  return parsed.sort((first, second) => first.joinedAt - second.joinedAt);
};

const parseRoomList = (raw: unknown) => {
  if (!raw || typeof raw !== 'object') return [] as string[];

  const items = Object.entries(raw as Record<string, unknown>).reduce<RoomListItem[]>((accumulator, [key, value]) => {
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (!normalized) return accumulator;
      accumulator.push({
        key,
        name: normalized,
        order: Number.MAX_SAFE_INTEGER,
        createdAt: 0,
      });
      return accumulator;
    }

    if (!value || typeof value !== 'object') return accumulator;
    const candidate = value as Record<string, unknown>;
    const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
    if (!name) return accumulator;
    const order = typeof candidate.order === 'number' ? candidate.order : Number.MAX_SAFE_INTEGER;
    const createdAt = typeof candidate.createdAt === 'number' ? candidate.createdAt : 0;
    accumulator.push({ key, name, order, createdAt });
    return accumulator;
  }, []);

  return items
    .sort((first, second) => {
      if (first.order !== second.order) return first.order - second.order;
      if (first.createdAt !== second.createdAt) return first.createdAt - second.createdAt;
      return first.key.localeCompare(second.key);
    })
    .map((item) => item.name);
};

const parseSpin = (raw: unknown): GroupRoomSpin | null => {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Record<string, unknown>;
  const spinId = typeof candidate.spinId === 'string' ? candidate.spinId : '';
  const winnerIndex = typeof candidate.winnerIndex === 'number' ? candidate.winnerIndex : -1;
  const winnerName = typeof candidate.winnerName === 'string' ? candidate.winnerName : '';
  const startedAt = typeof candidate.startedAt === 'number' ? candidate.startedAt : 0;
  const completedAt = typeof candidate.completedAt === 'number' ? candidate.completedAt : 0;
  const startedBy = typeof candidate.startedBy === 'string' ? candidate.startedBy : '';

  if (!spinId || winnerIndex < 0 || !winnerName || startedAt <= 0 || completedAt <= 0 || !startedBy) {
    return null;
  }

  return {
    spinId,
    winnerIndex,
    winnerName,
    startedAt,
    completedAt,
    startedBy,
  };
};

const parseCohostUids = (raw: unknown) => {
  if (!raw || typeof raw !== 'object') return [] as string[];

  return Object.entries(raw as Record<string, unknown>)
    .filter(([, value]) => value === true)
    .map(([uid]) => uid);
};

const normalizeListNames = (names: string[]) =>
  names
    .map((name) => normalizeDisplayName(name))
    .filter(Boolean)
    .filter((name, index, list) => list.findIndex((entry) => entry.toLowerCase() === name.toLowerCase()) === index)
    .slice(0, MAX_LIST_ITEMS);

const extractErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    const normalized = error.message.toLowerCase();
    if (normalized.includes('configuration-not-found')) {
      return 'Firebase Authentication is not configured for this project. In Firebase Console, open Authentication, click Get started, and enable Anonymous sign-in.';
    }
    if (normalized.includes('permission_denied')) return 'Permission denied. Check your Firebase Realtime Database rules.';
    if (normalized.includes('network')) return 'Network issue while talking to Firebase. Please retry.';
    return error.message;
  }
  return 'Unexpected Firebase error.';
};

const getStoredDisplayName = () => {
  if (typeof window === 'undefined') return '';
  return normalizeDisplayName(window.localStorage.getItem(DISPLAY_NAME_KEY) ?? '');
};

const getRoomCodeFromUrl = () => {
  if (typeof window === 'undefined') return '';
  return normalizeRoomCode(new URLSearchParams(window.location.search).get('room') ?? '');
};

const updateRoomCodeInUrl = (roomId: string) => {
  if (typeof window === 'undefined') return;
  const nextUrl = new URL(window.location.href);
  if (roomId) {
    nextUrl.searchParams.set('room', roomId);
  } else {
    nextUrl.searchParams.delete('room');
  }
  window.history.replaceState({}, '', nextUrl.toString());
};

export function useFirebaseGroupRoom() {
  const [authUid, setAuthUid] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(isFirebaseConfigured);
  const [authError, setAuthError] = useState<string | null>(firebaseConfigError);
  const [displayName, setDisplayNameState] = useState(() => getStoredDisplayName());
  const [roomId, setRoomId] = useState('');
  const [hostUid, setHostUid] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [cohostUids, setCohostUids] = useState<string[]>([]);
  const [participants, setParticipants] = useState<GroupRoomParticipant[]>([]);
  const [roomListNames, setRoomListNames] = useState<string[]>([]);
  const [currentSpin, setCurrentSpin] = useState<GroupRoomSpin | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);

  const unsubscribersRef = useRef<Array<() => void>>([]);
  const heartbeatIntervalRef = useRef<number | null>(null);
  const disconnectRef = useRef<OnDisconnect | null>(null);
  const roomIdRef = useRef('');
  const isHostRef = useRef(false);
  const isCohostRef = useRef(false);
  const lastStaleCleanupRef = useRef(0);
  const lastSyncedListRef = useRef('');
  const autoJoinAttemptedRef = useRef(false);

  const resolvedDisplayName = useMemo(() => {
    const normalized = normalizeDisplayName(displayName);
    if (normalized) return normalized;
    if (authUid) return buildGuestName(authUid);
    return 'Guest';
  }, [displayName, authUid]);

  const roomLink = useMemo(() => buildRoomLink(roomId), [roomId]);
  const isCohost = useMemo(() => {
    if (!authUid || isHost) return false;
    return cohostUids.includes(authUid);
  }, [authUid, cohostUids, isHost]);
  const canEditList = isHost || isCohost;

  const clearRoomListeners = useCallback(() => {
    unsubscribersRef.current.forEach((unsubscribe) => unsubscribe());
    unsubscribersRef.current = [];

    if (heartbeatIntervalRef.current !== null) {
      window.clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const cancelDisconnectCleanup = useCallback(async () => {
    if (!disconnectRef.current) return;
    try {
      await disconnectRef.current.cancel();
    } catch {
      // Best-effort cleanup
    }
    disconnectRef.current = null;
  }, []);

  const removeSelfFromRoom = useCallback(async (targetRoomId: string) => {
    if (!firebaseDb || !authUid || !targetRoomId) return;
    try {
      await remove(ref(firebaseDb, `rooms/${targetRoomId}/participants/${authUid}`));
    } catch {
      // Best-effort cleanup
    }
  }, [authUid]);

  const clearRoomState = useCallback(() => {
    setRoomId('');
    setHostUid('');
    setIsHost(false);
    setCohostUids([]);
    setParticipants([]);
    setRoomListNames([]);
    setCurrentSpin(null);
    roomIdRef.current = '';
    isHostRef.current = false;
    isCohostRef.current = false;
    lastSyncedListRef.current = '';
  }, []);

  const leaveRoom = useCallback(async () => {
    const activeRoomId = roomIdRef.current;
    clearRoomListeners();
    await cancelDisconnectCleanup();
    await removeSelfFromRoom(activeRoomId);
    clearRoomState();
    updateRoomCodeInUrl('');
  }, [cancelDisconnectCleanup, clearRoomListeners, clearRoomState, removeSelfFromRoom]);

  const cleanupStaleParticipants = useCallback(async (targetRoomId: string, currentParticipants: GroupRoomParticipant[]) => {
    const db = firebaseDb;
    if (!db || !isHostRef.current) return;
    const now = Date.now();
    if (now - lastStaleCleanupRef.current < STALE_CLEANUP_COOLDOWN_MS) return;
    lastStaleCleanupRef.current = now;

    const staleParticipants = currentParticipants.filter((participant) => now - participant.lastSeenAt > PARTICIPANT_STALE_MS);
    if (staleParticipants.length === 0) return;

    await Promise.all(staleParticipants.map((participant) => remove(ref(db, `rooms/${targetRoomId}/participants/${participant.uid}`))));
  }, []);

  const attachRoomSubscriptions = useCallback((targetRoomId: string) => {
    const db = firebaseDb;
    if (!db || !authUid) return;

    const participantsRef = ref(db, `rooms/${targetRoomId}/participants`);
    const cohostsRef = ref(db, `rooms/${targetRoomId}/cohosts`);
    const listRef = ref(db, `rooms/${targetRoomId}/list`);
    const spinRef = ref(db, `rooms/${targetRoomId}/spin`);
    const metaRef = ref(db, `rooms/${targetRoomId}/meta`);

    const unsubscribeParticipants = onValue(participantsRef, (snapshot) => {
      const parsedParticipants = parseParticipants(snapshot.val());
      const now = Date.now();
      const activeParticipants = parsedParticipants.filter((participant) => now - participant.lastSeenAt <= PARTICIPANT_STALE_MS);
      setParticipants(activeParticipants);
      void cleanupStaleParticipants(targetRoomId, parsedParticipants);
    });

    const unsubscribeList = onValue(listRef, (snapshot) => {
      setRoomListNames(parseRoomList(snapshot.val()));
    });

    const unsubscribeSpin = onValue(spinRef, (snapshot) => {
      setCurrentSpin(parseSpin(snapshot.val()));
    });

    const unsubscribeMeta = onValue(metaRef, (snapshot) => {
      const parsedMeta = parseRoomMeta(snapshot.val());
      if (!parsedMeta) {
        setRoomError('Room closed. Create a new room or rejoin.');
        void leaveRoom();
        return;
      }

      if (parsedMeta.expiresAt <= Date.now()) {
        setRoomError('Room expired. Create a new one to continue.');
        if (isHostRef.current) {
          void remove(ref(db, `rooms/${targetRoomId}`));
        }
        void leaveRoom();
        return;
      }

      const shouldBeHost = parsedMeta.hostUid === authUid;
      setHostUid(parsedMeta.hostUid);
      if (shouldBeHost !== isHostRef.current) {
        isHostRef.current = shouldBeHost;
        setIsHost(shouldBeHost);
        if (shouldBeHost) {
          isCohostRef.current = false;
        }
      }
    });

    const unsubscribeCohosts = onValue(cohostsRef, (snapshot) => {
      const parsedUids = parseCohostUids(snapshot.val());
      setCohostUids(parsedUids);
      const nextIsCohost = Boolean(authUid && parsedUids.includes(authUid) && !isHostRef.current);
      isCohostRef.current = nextIsCohost;
    });

    unsubscribersRef.current.push(unsubscribeParticipants, unsubscribeList, unsubscribeSpin, unsubscribeMeta, unsubscribeCohosts);
  }, [authUid, cleanupStaleParticipants, leaveRoom]);

  const writePresenceHeartbeat = useCallback(async (targetRoomId: string) => {
    if (!firebaseDb || !authUid || !targetRoomId) return;

    await update(ref(firebaseDb, `rooms/${targetRoomId}/participants/${authUid}`), {
      name: resolvedDisplayName,
      lastSeenAt: Date.now(),
      ready: true,
    });
  }, [authUid, resolvedDisplayName]);

  const enterRoom = useCallback(async (input: string, createMode: boolean) => {
    if (!firebaseDb || !authUid) {
      setRoomError('Firebase Auth is not ready yet.');
      return;
    }

    const parsedRoomCode = createMode ? normalizeRoomCode(input) : extractRoomCode(input);
    if (!parsedRoomCode) {
      setRoomError('Please enter a valid room code or link.');
      return;
    }

    setRoomError(null);
    setIsBusy(true);

    try {
      const previousRoomId = roomIdRef.current;
      const shouldLeavePreviousRoom = Boolean(previousRoomId && previousRoomId !== parsedRoomCode);
      if (!shouldLeavePreviousRoom) {
        clearRoomListeners();
        await cancelDisconnectCleanup();
      }

      const roomRootRef = ref(firebaseDb, `rooms/${parsedRoomCode}`);
      const metaRef = child(roomRootRef, 'meta');
      const participantsRef = child(roomRootRef, 'participants');
      const now = Date.now();

      const metaSnapshot = await get(metaRef);
      const existingMeta = parseRoomMeta(metaSnapshot.val());
      let nextHost = false;

      if (createMode) {
        if (existingMeta && existingMeta.expiresAt > now) {
          setRoomError(`Room ${parsedRoomCode} already exists. Try again.`);
          return;
        }

        const nextMeta: RoomMeta = {
          hostUid: authUid,
          status: 'waiting',
          createdAt: now,
          expiresAt: now + ROOM_TTL_MS,
          lastSpinAt: 0,
        };

        await set(metaRef, nextMeta);
        await set(child(roomRootRef, 'list'), {});
        await remove(child(roomRootRef, 'spin'));
        nextHost = true;
      } else {
        if (!existingMeta) {
          setRoomError('Room not found. Check the code and try again.');
          return;
        }

        if (existingMeta.expiresAt <= now) {
          await remove(roomRootRef);
          setRoomError('Room expired. Ask the host to create a new room.');
          return;
        }

        nextHost = existingMeta.hostUid === authUid;
      }

      const participantsSnapshot = await get(participantsRef);
      const existingParticipants = parseParticipants(participantsSnapshot.val());
      const activeParticipants = existingParticipants.filter((participant) => now - participant.lastSeenAt <= PARTICIPANT_STALE_MS);
      const existingSelf = activeParticipants.find((participant) => participant.uid === authUid);

      if (!existingSelf && activeParticipants.length >= GROUP_ROOM_MAX_PARTICIPANTS) {
        setRoomError(`Room full. Maximum ${GROUP_ROOM_MAX_PARTICIPANTS} participants.`);
        return;
      }

      if (nextHost) {
        await cleanupStaleParticipants(parsedRoomCode, existingParticipants);
      }

      if (shouldLeavePreviousRoom) {
        await leaveRoom();
      }

      const participantRef = ref(firebaseDb, `rooms/${parsedRoomCode}/participants/${authUid}`);
      await set(participantRef, {
        name: resolvedDisplayName,
        joinedAt: existingSelf?.joinedAt ?? now,
        lastSeenAt: now,
        ready: true,
      });

      const disconnect = onDisconnect(participantRef);
      await disconnect.remove();
      disconnectRef.current = disconnect;

      roomIdRef.current = parsedRoomCode;
      isHostRef.current = nextHost;
      isCohostRef.current = false;
      setRoomId(parsedRoomCode);
      setHostUid(nextHost ? authUid : (existingMeta?.hostUid ?? ''));
      setIsHost(nextHost);
      setCohostUids([]);
      setParticipants([]);
      setRoomListNames([]);
      setCurrentSpin(null);

      attachRoomSubscriptions(parsedRoomCode);
      await writePresenceHeartbeat(parsedRoomCode);

      heartbeatIntervalRef.current = window.setInterval(() => {
        void writePresenceHeartbeat(parsedRoomCode);
      }, PRESENCE_HEARTBEAT_MS);

      updateRoomCodeInUrl(parsedRoomCode);
    } catch (error: unknown) {
      setRoomError(extractErrorMessage(error));
      await leaveRoom();
    } finally {
      setIsBusy(false);
    }
  }, [
    attachRoomSubscriptions,
    authUid,
    cancelDisconnectCleanup,
    cleanupStaleParticipants,
    clearRoomListeners,
    leaveRoom,
    resolvedDisplayName,
    writePresenceHeartbeat,
  ]);

  const createRoom = useCallback(async () => {
    if (!authUid) {
      setRoomError('Authentication is still initializing.');
      return;
    }

    let attempts = 0;
    while (attempts < 5) {
      attempts += 1;
      const code = generateRoomCode();
      if (code.length !== ROOM_CODE_LENGTH) continue;
      await enterRoom(code, true);
      if (roomIdRef.current === code) return;
    }

    setRoomError('Could not create a room. Please try again.');
  }, [authUid, enterRoom]);

  const joinRoom = useCallback(async (input: string) => {
    await enterRoom(input, false);
  }, [enterRoom]);

  const syncHostList = useCallback(async (names: string[]) => {
    const activeRoomId = roomIdRef.current;
    if (!firebaseDb || !authUid || !activeRoomId || (!isHostRef.current && !isCohostRef.current)) return;

    const normalizedNames = normalizeListNames(names);
    const listSignature = JSON.stringify(normalizedNames);
    if (listSignature === lastSyncedListRef.current) return;

    lastSyncedListRef.current = listSignature;

    const now = Date.now();
    const payload = normalizedNames.reduce<Record<string, { name: string; order: number; createdAt: number; createdBy: string }>>(
      (accumulator, name, index) => {
        accumulator[`item-${index + 1}`] = {
          name,
          order: index,
          createdAt: now + index,
          createdBy: authUid,
        };
        return accumulator;
      },
      {},
    );

    try {
      await set(ref(firebaseDb, `rooms/${activeRoomId}/list`), payload);
    } catch (error: unknown) {
      setRoomError(extractErrorMessage(error));
    }
  }, [authUid]);

  const setParticipantCohost = useCallback(async (targetUid: string, shouldBeCohost: boolean) => {
    const activeRoomId = roomIdRef.current;
    if (!firebaseDb || !authUid || !activeRoomId) {
      setRoomError('Join a room first.');
      return;
    }

    if (!isHostRef.current) {
      setRoomError('Only the host can assign co-hosts.');
      return;
    }

    if (!targetUid || targetUid === authUid || targetUid === hostUid) {
      return;
    }

    const targetRef = ref(firebaseDb, `rooms/${activeRoomId}/cohosts/${targetUid}`);

    try {
      if (shouldBeCohost) {
        await set(targetRef, true);
      } else {
        await remove(targetRef);
      }
    } catch (error: unknown) {
      setRoomError(extractErrorMessage(error));
    }
  }, [authUid, hostUid]);

  const requestHostSpin = useCallback(async (candidateNames: string[]) => {
    const activeRoomId = roomIdRef.current;
    if (!firebaseDb || !authUid || !activeRoomId) {
      setRoomError('Join a room first.');
      return null;
    }

    if (!isHostRef.current) {
      setRoomError('Only the host can start a room spin.');
      return null;
    }

    const normalizedNames = normalizeListNames(candidateNames);
    if (normalizedNames.length < 2) {
      setRoomError('Add at least 2 restaurants before spinning.');
      return null;
    }

    const now = Date.now();
    const metaRef = ref(firebaseDb, `rooms/${activeRoomId}/meta`);

    try {
      const transactionResult = await runTransaction(metaRef, (currentMeta) => {
        const parsedMeta = parseRoomMeta(currentMeta);
        if (!parsedMeta) return;
        if (parsedMeta.hostUid !== authUid) return;
        if (parsedMeta.expiresAt <= now) return;
        if (now - parsedMeta.lastSpinAt < GROUP_ROOM_SPIN_COOLDOWN_MS) return;

        return {
          ...parsedMeta,
          status: 'spinning',
          lastSpinAt: now,
        };
      });

      if (!transactionResult.committed) {
        setRoomError(`Busy now, retry in ${Math.ceil(GROUP_ROOM_SPIN_COOLDOWN_MS / 1000)}s.`);
        return null;
      }

      const winnerIndex = Math.floor(Math.random() * normalizedNames.length);
      const nextSpin: GroupRoomSpin = {
        spinId: `${now}-${Math.random().toString(36).slice(2, 8)}`,
        winnerIndex,
        winnerName: normalizedNames[winnerIndex],
        startedAt: now,
        completedAt: now + 5_000,
        startedBy: authUid,
      };

      await set(ref(firebaseDb, `rooms/${activeRoomId}/spin`), nextSpin);
      await update(metaRef, { status: 'completed' });
      return nextSpin;
    } catch (error: unknown) {
      setRoomError(extractErrorMessage(error));
      return null;
    }
  }, [authUid]);

  const clearRoomError = useCallback(() => {
    setRoomError(null);
  }, []);

  const setDisplayName = useCallback((value: string) => {
    setDisplayNameState(value.slice(0, GROUP_ROOM_NAME_MAX_LENGTH));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(DISPLAY_NAME_KEY, resolvedDisplayName);
  }, [resolvedDisplayName]);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setAuthLoading(false);
      return;
    }

    let cancelled = false;

    const initializeAuth = async () => {
      setAuthLoading(true);
      try {
        const user = await ensureAnonymousAuthUser();
        if (cancelled) return;
        setAuthUid(user.uid);
        setAuthError(null);
      } catch (error: unknown) {
        if (cancelled) return;
        setAuthError(extractErrorMessage(error));
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
        }
      }
    };

    void initializeAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!authUid || autoJoinAttemptedRef.current) return;
    autoJoinAttemptedRef.current = true;
    const roomFromUrl = getRoomCodeFromUrl();
    if (!roomFromUrl) return;
    void joinRoom(roomFromUrl);
  }, [authUid, joinRoom]);

  useEffect(() => {
    return () => {
      void leaveRoom();
    };
  }, [leaveRoom]);

  return {
    isFirebaseConfigured,
    firebaseConfigError,
    authUid,
    authLoading,
    authError,
    displayName,
    resolvedDisplayName,
    setDisplayName,
    roomId,
    hostUid,
    roomLink,
    isHost,
    isCohost,
    canEditList,
    cohostUids,
    isBusy,
    roomError,
    clearRoomError,
    participants,
    roomListNames,
    currentSpin,
    createRoom,
    joinRoom,
    leaveRoom,
    syncHostList,
    setParticipantCohost,
    requestHostSpin,
  };
}
