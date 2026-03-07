import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { child, get, onValue, ref, remove, set } from 'firebase/database';
import { firebaseDb, isFirebaseConfigured } from '@/lib/firebase';

const CHALLENGE_CODE_LENGTH = 6;
const CHALLENGE_DURATION_DAYS = 7;
const ACTIVE_CHALLENGE_STORAGE_KEY = 'eatspin:active-challenge-id';

interface ChallengeMeta {
  createdAt: number;
  endsAt: number;
  createdBy: string;
}

interface ChallengeParticipant {
  uid: string;
  name: string;
  joinedAt: number;
  completedDayKeys: string[];
}

const normalizeChallengeCode = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, CHALLENGE_CODE_LENGTH);

const parseChallengeCodeInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.includes('challenge=')) {
    try {
      return normalizeChallengeCode(new URL(trimmed).searchParams.get('challenge') ?? '');
    } catch {
      return normalizeChallengeCode(trimmed);
    }
  }
  return normalizeChallengeCode(trimmed);
};

const generateChallengeCode = () => Math.random().toString(36).slice(2, 2 + CHALLENGE_CODE_LENGTH).toUpperCase();

const toDayKey = (value: Date | number = Date.now()): string => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseParticipants = (raw: unknown): ChallengeParticipant[] => {
  if (!raw || typeof raw !== 'object') return [];
  return Object.entries(raw as Record<string, unknown>).reduce<ChallengeParticipant[]>((accumulator, [uid, value]) => {
    if (!value || typeof value !== 'object') return accumulator;
    const candidate = value as Record<string, unknown>;
    const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
    const joinedAt = typeof candidate.joinedAt === 'number' ? candidate.joinedAt : 0;
    const completedDaysRaw = candidate.completedDays;
    const completedDayKeys = completedDaysRaw && typeof completedDaysRaw === 'object'
      ? Object.entries(completedDaysRaw as Record<string, unknown>)
        .filter(([, done]) => done === true)
        .map(([dayKey]) => dayKey)
      : [];

    if (!uid || !name || joinedAt <= 0) return accumulator;
    accumulator.push({
      uid,
      name,
      joinedAt,
      completedDayKeys,
    });
    return accumulator;
  }, []);
};

const parseMeta = (raw: unknown): ChallengeMeta | null => {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Record<string, unknown>;
  const createdAt = typeof candidate.createdAt === 'number' ? candidate.createdAt : 0;
  const endsAt = typeof candidate.endsAt === 'number' ? candidate.endsAt : 0;
  const createdBy = typeof candidate.createdBy === 'string' ? candidate.createdBy : '';
  if (createdAt <= 0 || endsAt <= 0 || !createdBy) return null;
  return { createdAt, endsAt, createdBy };
};

const getBaseUrl = () => {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}${window.location.pathname}`;
};

export const useSpinChallenge = (authUid: string | null, displayName: string) => {
  const [challengeId, setChallengeId] = useState('');
  const [meta, setMeta] = useState<ChallengeMeta | null>(null);
  const [participants, setParticipants] = useState<ChallengeParticipant[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unsubscriberRef = useRef<(() => void) | null>(null);
  const autoJoinedRef = useRef(false);

  const challengeLink = useMemo(() => {
    if (!challengeId) return '';
    const baseUrl = getBaseUrl();
    if (!baseUrl) return `?challenge=${challengeId}`;
    const url = new URL(baseUrl);
    url.searchParams.set('challenge', challengeId);
    return url.toString();
  }, [challengeId]);

  const myParticipant = useMemo(
    () => participants.find((participant) => participant.uid === authUid),
    [authUid, participants],
  );

  const leaderboard = useMemo(
    () => [...participants].sort((a, b) => b.completedDayKeys.length - a.completedDayKeys.length),
    [participants],
  );

  const clearListener = useCallback(() => {
    if (!unsubscriberRef.current) return;
    unsubscriberRef.current();
    unsubscriberRef.current = null;
  }, []);

  const leaveChallenge = useCallback(async () => {
    clearListener();
    setChallengeId('');
    setMeta(null);
    setParticipants([]);
    setError(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(ACTIVE_CHALLENGE_STORAGE_KEY);
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete('challenge');
      window.history.replaceState({}, '', nextUrl.toString());
    }
  }, [clearListener]);

  const attachChallengeListener = useCallback((nextChallengeId: string) => {
    if (!firebaseDb) return;
    clearListener();

    const challengeRef = ref(firebaseDb, `challenges/${nextChallengeId}`);
    unsubscriberRef.current = onValue(challengeRef, (snapshot) => {
      const raw = snapshot.val();
      const nextMeta = parseMeta(raw?.meta);
      if (!nextMeta || nextMeta.endsAt <= Date.now()) {
        void leaveChallenge();
        return;
      }
      setMeta(nextMeta);
      setParticipants(parseParticipants(raw?.participants));
    });
  }, [clearListener, leaveChallenge]);

  const joinChallenge = useCallback(async (input: string) => {
    if (!firebaseDb || !isFirebaseConfigured || !authUid) {
      setError('Challenge mode needs Firebase sign-in first.');
      return;
    }

    const parsedCode = parseChallengeCodeInput(input);
    if (!parsedCode) {
      setError('Enter a valid challenge code or link.');
      return;
    }

    setIsBusy(true);
    setError(null);
    try {
      const challengeRootRef = ref(firebaseDb, `challenges/${parsedCode}`);
      const snapshot = await get(challengeRootRef);
      const raw = snapshot.val();
      const challengeMeta = parseMeta(raw?.meta);
      if (!challengeMeta) {
        setError('Challenge not found.');
        return;
      }

      if (challengeMeta.endsAt <= Date.now()) {
        await remove(challengeRootRef);
        setError('Challenge expired. Ask for a new one.');
        return;
      }

      await set(child(challengeRootRef, `participants/${authUid}`), {
        name: displayName,
        joinedAt: Date.now(),
      });

      setChallengeId(parsedCode);
      setMeta(challengeMeta);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(ACTIVE_CHALLENGE_STORAGE_KEY, parsedCode);
      }
      attachChallengeListener(parsedCode);
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'Unable to join challenge.');
    } finally {
      setIsBusy(false);
    }
  }, [attachChallengeListener, authUid, displayName]);

  const createChallenge = useCallback(async () => {
    if (!firebaseDb || !isFirebaseConfigured || !authUid) {
      setError('Challenge mode needs Firebase sign-in first.');
      return;
    }

    setIsBusy(true);
    setError(null);
    try {
      let attempts = 0;
      while (attempts < 5) {
        attempts += 1;
        const nextChallengeId = generateChallengeCode();
        const challengeRootRef = ref(firebaseDb, `challenges/${nextChallengeId}`);
        const existing = await get(challengeRootRef);
        const existingMeta = parseMeta(existing.val()?.meta);
        if (existingMeta && existingMeta.endsAt > Date.now()) {
          continue;
        }

        const now = Date.now();
        const endsAt = now + CHALLENGE_DURATION_DAYS * 24 * 60 * 60 * 1000;

        await set(challengeRootRef, {
          meta: {
            createdAt: now,
            endsAt,
            createdBy: authUid,
          },
          participants: {
            [authUid]: {
              name: displayName,
              joinedAt: now,
            },
          },
        });

        setChallengeId(nextChallengeId);
        setMeta({ createdAt: now, endsAt, createdBy: authUid });
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(ACTIVE_CHALLENGE_STORAGE_KEY, nextChallengeId);
        }
        attachChallengeListener(nextChallengeId);
        return;
      }

      setError('Could not create challenge, please retry.');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create challenge.');
    } finally {
      setIsBusy(false);
    }
  }, [attachChallengeListener, authUid, displayName]);

  const recordDailySpin = useCallback(async () => {
    if (!firebaseDb || !authUid || !challengeId) return;
    const dayKey = toDayKey();
    try {
      await set(ref(firebaseDb, `challenges/${challengeId}/participants/${authUid}/completedDays/${dayKey}`), true);
    } catch {
      // best-effort sync
    }
  }, [authUid, challengeId]);

  useEffect(() => {
    if (!authUid || autoJoinedRef.current) return;
    autoJoinedRef.current = true;
    if (typeof window === 'undefined') return;

    const fromUrl = parseChallengeCodeInput(new URLSearchParams(window.location.search).get('challenge') ?? '');
    const fromStorage = normalizeChallengeCode(window.localStorage.getItem(ACTIVE_CHALLENGE_STORAGE_KEY) ?? '');
    const initialCode = fromUrl || fromStorage;
    if (!initialCode) return;
    void joinChallenge(initialCode);
  }, [authUid, joinChallenge]);

  useEffect(() => {
    return () => {
      clearListener();
    };
  }, [clearListener]);

  return {
    challengeId,
    challengeLink,
    leaderboard,
    myParticipant,
    meta,
    isBusy,
    error,
    createChallenge,
    joinChallenge,
    leaveChallenge,
    recordDailySpin,
  };
};
