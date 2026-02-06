import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { penangRestaurants } from '@/data/restaurants';
import {
  createParticipantId,
  generateRoomCode,
  generateSeed,
  getDeterministicRestaurant,
  participantsStorageKey,
  roomStateStorageKey,
  type GroupParticipant,
  type GroupRoomState,
} from '@/lib/groupSpin';
import { Copy, Users, Play, RotateCw, Link2 } from 'lucide-react';

const readParticipants = (roomCode: string): GroupParticipant[] => {
  const raw = window.localStorage.getItem(participantsStorageKey(roomCode));
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((participant): participant is GroupParticipant => (
      typeof participant?.id === 'string'
      && typeof participant?.name === 'string'
      && typeof participant?.ready === 'boolean'
      && typeof participant?.joinedAt === 'number'
    ));
  } catch {
    return [];
  }
};

const writeParticipants = (roomCode: string, participants: GroupParticipant[]) => {
  window.localStorage.setItem(participantsStorageKey(roomCode), JSON.stringify(participants));
};

const readRoomState = (roomCode: string): GroupRoomState => {
  const raw = window.localStorage.getItem(roomStateStorageKey(roomCode));

  if (!raw) {
    return { status: 'lobby', updatedAt: Date.now() };
  }

  try {
    const parsed = JSON.parse(raw) as GroupRoomState;
    if (parsed.status === 'lobby' || parsed.status === 'spinning' || parsed.status === 'done') {
      return {
        status: parsed.status,
        resultRestaurantId: parsed.resultRestaurantId,
        updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
      };
    }
    return { status: 'lobby', updatedAt: Date.now() };
  } catch {
    return { status: 'lobby', updatedAt: Date.now() };
  }
};

const writeRoomState = (roomCode: string, roomState: GroupRoomState) => {
  window.localStorage.setItem(roomStateStorageKey(roomCode), JSON.stringify(roomState));
};

const sanitizeName = (name: string): string => {
  const trimmed = name.trim();
  return trimmed.length === 0 ? 'Guest' : trimmed.slice(0, 24);
};

export function GroupSpinPanel() {
  const [searchParams, setSearchParams] = useState(() => new URLSearchParams(window.location.search));
  const roomCode = searchParams.get('room')?.toUpperCase() ?? '';
  const seed = Number(searchParams.get('seed'));
  const hostId = searchParams.get('host') ?? '';
  const participantId = searchParams.get('pid') ?? '';

  const hasRoom = roomCode.length >= 4 && Number.isFinite(seed);

  const [displayName, setDisplayName] = useState(searchParams.get('name') ?? '');
  const [participants, setParticipants] = useState<GroupParticipant[]>([]);
  const [roomState, setRoomState] = useState<GroupRoomState>({ status: 'lobby', updatedAt: 0 });

  const currentResult = useMemo(() => {
    if (roomState.status !== 'done' || !roomState.resultRestaurantId) return null;
    return penangRestaurants.find((restaurant) => restaurant.id === roomState.resultRestaurantId) ?? null;
  }, [roomState]);

  const roomLink = useMemo(() => {
    if (!hasRoom) return '';
    const link = new URL(window.location.href);
    link.searchParams.set('room', roomCode);
    link.searchParams.set('seed', String(seed));
    link.searchParams.set('host', hostId);
    return link.toString();
  }, [hasRoom, roomCode, seed, hostId]);

  const isHost = hasRoom && participantId === hostId;

  const refreshRoom = useCallback(() => {
    if (!hasRoom) return;
    setParticipants(readParticipants(roomCode));
    setRoomState(readRoomState(roomCode));
  }, [hasRoom, roomCode]);

  useEffect(() => {
    if (!hasRoom || !participantId) return;

    const nextName = sanitizeName(displayName);
    const currentParticipants = readParticipants(roomCode);
    const existing = currentParticipants.find((participant) => participant.id === participantId);

    const updatedParticipants = existing
      ? currentParticipants.map((participant) => participant.id === participantId
        ? { ...participant, name: nextName }
        : participant)
      : [...currentParticipants, {
        id: participantId,
        name: nextName,
        ready: false,
        joinedAt: Date.now(),
      }];

    writeParticipants(roomCode, updatedParticipants);

    if (!window.localStorage.getItem(roomStateStorageKey(roomCode))) {
      writeRoomState(roomCode, { status: 'lobby', updatedAt: Date.now() });
    }

    const timeoutId = window.setTimeout(() => {
      refreshRoom();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [displayName, hasRoom, participantId, refreshRoom, roomCode]);

  useEffect(() => {
    if (!hasRoom) return;

    const onStorage = (event: StorageEvent) => {
      if (!event.key) return;
      if (event.key === participantsStorageKey(roomCode) || event.key === roomStateStorageKey(roomCode)) {
        refreshRoom();
      }
    };

    window.addEventListener('storage', onStorage);
    const timeoutId = window.setTimeout(() => {
      refreshRoom();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener('storage', onStorage);
    };
  }, [hasRoom, refreshRoom, roomCode]);

  const createRoom = () => {
    const generatedRoom = generateRoomCode();
    const generatedSeed = generateSeed();
    const generatedHostId = createParticipantId();
    const params = new URLSearchParams(window.location.search);

    params.set('room', generatedRoom);
    params.set('seed', String(generatedSeed));
    params.set('host', generatedHostId);
    params.set('pid', generatedHostId);
    params.set('name', sanitizeName(displayName));

    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', nextUrl);
    setSearchParams(new URLSearchParams(window.location.search));
  };

  const updateParticipant = (next: (participant: GroupParticipant) => GroupParticipant) => {
    if (!hasRoom || !participantId) return;
    const currentParticipants = readParticipants(roomCode);
    const updatedParticipants = currentParticipants.map((participant) => (
      participant.id === participantId ? next(participant) : participant
    ));
    writeParticipants(roomCode, updatedParticipants);
    refreshRoom();
  };

  const setReadyState = (ready: boolean) => {
    updateParticipant((participant) => ({ ...participant, ready }));
  };

  const syncName = () => {
    if (!hasRoom || !participantId) return;

    const params = new URLSearchParams(window.location.search);
    params.set('name', sanitizeName(displayName));
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    setSearchParams(new URLSearchParams(window.location.search));
  };

  const startGroupSpin = () => {
    if (!hasRoom) return;

    const pickedRestaurant = getDeterministicRestaurant(penangRestaurants, seed);
    if (!pickedRestaurant) return;

    writeRoomState(roomCode, {
      status: 'spinning',
      updatedAt: Date.now(),
    });
    refreshRoom();

    window.setTimeout(() => {
      writeRoomState(roomCode, {
        status: 'done',
        resultRestaurantId: pickedRestaurant.id,
        updatedAt: Date.now(),
      });
      refreshRoom();
    }, 1800);
  };

  const resetRoom = () => {
    if (!hasRoom) return;

    writeParticipants(
      roomCode,
      participants.map((participant) => ({ ...participant, ready: false })),
    );
    writeRoomState(roomCode, { status: 'lobby', updatedAt: Date.now() });
    refreshRoom();
  };

  const everyoneReady = participants.length > 0 && participants.every((participant) => participant.ready);

  return (
    <div className="rounded-2xl border border-eatspin-peach/60 bg-white p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-heading text-2xl font-bold text-brand-black">Group Spin (Beta)</h3>
          <p className="text-sm text-eatspin-gray-1">Create a room link and get one shared deterministic result.</p>
        </div>
        {!hasRoom && (
          <Button onClick={createRoom} className="bg-brand-orange hover:bg-brand-orange/90">
            <Users size={16} className="mr-2" /> Create room
          </Button>
        )}
      </div>

      <div className="grid sm:grid-cols-[1fr_auto] gap-2">
        <Input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Display name (optional)"
        />
        <Button variant="outline" onClick={syncName} disabled={!hasRoom || !participantId}>
          Save name
        </Button>
      </div>

      {hasRoom ? (
        <>
          <div className="rounded-xl bg-brand-linen p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-xs text-eatspin-gray-1">Room code</p>
              <p className="font-heading text-2xl text-brand-black tracking-widest">{roomCode}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => navigator.clipboard.writeText(roomLink)}
              >
                <Copy size={16} className="mr-2" /> Copy link
              </Button>
              <Button
                variant="outline"
                onClick={() => navigator.clipboard.writeText(roomLink)}
              >
                <Link2 size={16} className="mr-2" /> Share
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-eatspin-peach/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-brand-black">Lobby participants</p>
              <span className="text-xs text-eatspin-gray-1">{participants.length} total</span>
            </div>
            {participants.length === 0 ? (
              <p className="text-sm text-eatspin-gray-1">No participants yet.</p>
            ) : (
              <ul className="space-y-2">
                {participants.map((participant) => (
                  <li key={participant.id} className="flex items-center justify-between rounded-lg bg-brand-linen px-3 py-2">
                    <span className="text-sm text-brand-black">
                      {participant.name}
                      {participant.id === participantId ? ' (You)' : ''}
                      {participant.id === hostId ? ' • Host' : ''}
                    </span>
                    <span className={`text-xs font-semibold ${participant.ready ? 'text-green-600' : 'text-eatspin-gray-1'}`}>
                      {participant.ready ? 'Ready' : 'Waiting'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setReadyState(true)}>
              I'm Ready
            </Button>
            <Button variant="outline" onClick={() => setReadyState(false)}>
              Not ready
            </Button>
            <Button onClick={startGroupSpin} disabled={!everyoneReady && !isHost}>
              <Play size={16} className="mr-2" />
              {everyoneReady ? 'Start group spin' : isHost ? 'Force spin as host' : 'Waiting for everyone'}
            </Button>
            <Button variant="outline" onClick={resetRoom}>
              <RotateCw size={16} className="mr-2" /> Reset room
            </Button>
          </div>

          {roomState.status === 'spinning' && (
            <p className="text-sm text-eatspin-orange font-medium">Spinning… everyone using this room link will resolve to the same result.</p>
          )}

          {roomState.status === 'done' && currentResult && (
            <div className="rounded-xl bg-eatspin-success/10 border border-eatspin-success/20 p-4">
              <p className="text-xs uppercase tracking-wide text-eatspin-success font-semibold">Shared result</p>
              <p className="font-heading text-2xl text-brand-black">{currentResult.name}</p>
              <p className="text-sm text-eatspin-gray-1">Seed: {seed} · Deterministic spin from shared URL.</p>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-eatspin-gray-1">No room active. Create a room to generate a shareable link with a room code and seed.</p>
      )}
    </div>
  );
}
