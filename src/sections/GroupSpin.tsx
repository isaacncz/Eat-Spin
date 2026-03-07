import { useEffect, useState } from 'react';
import { Users, Link2, Sparkles, Trophy, Copy, Check, ShieldCheck, LogOut, UserPlus, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { GROUP_ROOM_MAX_PARTICIPANTS, GROUP_ROOM_NAME_MAX_LENGTH, type GroupRoomParticipant } from '@/hooks/useFirebaseGroupRoom';

const ROOM_CODE_LENGTH = 6;

const normalizeRoomCode = (value: string) => (
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, ROOM_CODE_LENGTH)
);

const extractRoomCode = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.includes('room=')) {
    try {
      return normalizeRoomCode(new URL(trimmed).searchParams.get('room') ?? '');
    } catch {
      return normalizeRoomCode(trimmed);
    }
  }
  return normalizeRoomCode(trimmed);
};

interface GroupSpinProps {
  isFirebaseConfigured: boolean;
  firebaseConfigError: string | null;
  authLoading: boolean;
  authError: string | null;
  authUid: string | null;
  displayName: string;
  resolvedDisplayName: string;
  setDisplayName: (value: string) => void;
  roomId: string;
  hostUid: string;
  roomLink: string;
  isHost: boolean;
  isCohost: boolean;
  cohostUids: string[];
  isBusy: boolean;
  roomError: string | null;
  participants: GroupRoomParticipant[];
  canStartRoomSpin: boolean;
  onCreateRoom: () => Promise<void>;
  onJoinRoom: (value: string) => Promise<void>;
  onLeaveRoom: () => Promise<void>;
  onStartRoomSpin: () => Promise<void>;
  onSetParticipantCohost: (uid: string, shouldBeCohost: boolean) => Promise<void>;
  onClearRoomError: () => void;
}

export function GroupSpin({
  isFirebaseConfigured,
  firebaseConfigError,
  authLoading,
  authError,
  authUid,
  displayName,
  resolvedDisplayName,
  setDisplayName,
  roomId,
  hostUid,
  roomLink,
  isHost,
  isCohost,
  cohostUids,
  isBusy,
  roomError,
  participants,
  canStartRoomSpin,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onStartRoomSpin,
  onSetParticipantCohost,
  onClearRoomError,
}: GroupSpinProps) {
  const [joinValue, setJoinValue] = useState('');
  const [hasCopied, setHasCopied] = useState(false);
  const [cohostPendingUid, setCohostPendingUid] = useState<string | null>(null);

  const canInteract = isFirebaseConfigured && !authLoading;
  const hasRoom = Boolean(roomId);

  const handleCopyLink = async () => {
    if (!roomLink || typeof navigator === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(roomLink);
    setHasCopied(true);
  };

  const pasteRoomLinkToJoinInput = (value: string) => {
    if (!value) return;
    const normalizedRoomCode = extractRoomCode(value);
    setJoinValue(normalizedRoomCode || value);
    window.requestAnimationFrame(() => {
      const joinInput = document.getElementById('group-room-join-input');
      if (!(joinInput instanceof HTMLInputElement)) return;
      joinInput.focus();
      joinInput.select();
    });
  };

  const handleUseRoomLink = async () => {
    const valueToPaste = roomId || extractRoomCode(roomLink) || roomLink;
    if (!valueToPaste) return;
    pasteRoomLinkToJoinInput(valueToPaste);
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(roomLink);
      setHasCopied(true);
    } catch {
      // Clipboard can fail on unsupported browsers or denied permission.
    }
  };

  const handleCreateRoom = async () => {
    setHasCopied(false);
    await onCreateRoom();
  };

  const handleJoinRoom = async () => {
    if (!joinValue.trim()) return;
    setHasCopied(false);
    await onJoinRoom(joinValue);
    setJoinValue('');
  };

  const handleLeaveRoom = async () => {
    setHasCopied(false);
    await onLeaveRoom();
  };

  const handleStartRoomSpin = async () => {
    if (!isHost && !isCohost) return;
    await onStartRoomSpin();
  };

  const handleToggleCohost = async (uid: string, shouldBeCohost: boolean) => {
    setCohostPendingUid(uid);
    await onSetParticipantCohost(uid, shouldBeCohost);
    setCohostPendingUid(null);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const roomFromUrl = new URLSearchParams(window.location.search).get('room');
    if (!roomFromUrl) return;
    const normalizedRoomCode = normalizeRoomCode(roomFromUrl);
    if (!normalizedRoomCode) return;
    setJoinValue((previous) => previous || normalizedRoomCode);
  }, []);

  return (
    <section id="group-spin" className="bg-brand-linen px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <Badge className="mb-4 border border-brand-orange/30 bg-brand-orange/10 text-brand-orange">
            Flagship Feature
          </Badge>
          <h2 className="mb-4 font-heading text-3xl font-bold text-brand-black sm:text-4xl">
            Group Spin makes deciding effortless
          </h2>
          <p className="mx-auto max-w-2xl text-eatspin-gray-1">
            Firebase-powered rooms keep participants, shared lists, and spin outcomes synced across browsers and devices.
          </p>
        </div>

        {(!isFirebaseConfigured || authError || roomError) && (
          <div className="mb-6 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            {!isFirebaseConfigured && <p>{firebaseConfigError ?? 'Firebase configuration is missing.'}</p>}
            {authError && <p>{authError}</p>}
            {roomError && (
              <div className="flex items-center justify-between gap-2">
                <p>{roomError}</p>
                <Button size="sm" variant="outline" className="h-8 border-red-300 text-red-700" onClick={onClearRoomError}>
                  Dismiss
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-eatspin-peach/60 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-heading text-brand-black">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-orange/10">
                  <Users className="text-brand-orange" size={20} />
                </span>
                Create a room
              </CardTitle>
              <CardDescription>Create one room code and invite everyone with the same link.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Button
                className="w-full bg-brand-orange font-heading text-white hover:bg-brand-orange/90"
                onClick={handleCreateRoom}
                disabled={!canInteract || isBusy}
              >
                {isBusy ? 'Working...' : 'Create room link'}
              </Button>
              <div className="rounded-xl border border-dashed border-brand-orange/30 bg-white/70 px-4 py-3 text-sm text-eatspin-gray-1">
                {hasRoom ? (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-brand-black/60">Room code</p>
                    <p className="text-base font-heading text-brand-black">{roomId}</p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        type="button"
                        onClick={() => void handleUseRoomLink()}
                        className="truncate text-left text-xs text-brand-black/70 underline-offset-2 hover:underline"
                        title="Click to auto-paste into join field"
                      >
                        {roomLink}
                      </button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-brand-orange text-brand-orange hover:bg-brand-orange/10"
                        onClick={handleCopyLink}
                      >
                        {hasCopied ? <Check size={16} /> : <Copy size={16} />}
                        {hasCopied ? 'Copied' : 'Copy link'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  'Room code will appear here once created.'
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-eatspin-peach/60 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-heading text-brand-black">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-orange/10">
                  <Link2 className="text-brand-orange" size={20} />
                </span>
                Join the room
              </CardTitle>
              <CardDescription>Set your display name, then join by code or room link.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Input
                placeholder="Your name"
                maxLength={GROUP_ROOM_NAME_MAX_LENGTH}
                className="h-12 rounded-xl border-eatspin-peach/60 bg-white"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                disabled={!canInteract || isBusy}
              />
              <Input
                placeholder="Paste room link or enter code"
                id="group-room-join-input"
                className="h-12 rounded-xl border-eatspin-peach/60 bg-white"
                value={joinValue}
                onChange={(event) => setJoinValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  void handleJoinRoom();
                }}
                disabled={!canInteract || isBusy}
              />
              <Button
                variant="outline"
                className="w-full border-brand-orange text-brand-orange hover:bg-brand-orange/10"
                onClick={handleJoinRoom}
                disabled={!canInteract || isBusy}
              >
                {isBusy ? 'Joining...' : 'Join room'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {hasRoom && (
          <div className="mt-10 rounded-2xl border border-brand-orange/30 bg-white px-6 py-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-brand-black/60">Joined room</p>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-heading text-brand-black">{roomId}</p>
                  {isHost && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-orange/10 px-2 py-0.5 text-xs font-semibold text-brand-orange">
                      <ShieldCheck size={12} />
                      Host
                    </span>
                  )}
                  {!isHost && isCohost && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-orange/10 px-2 py-0.5 text-xs font-semibold text-brand-orange">
                      <ShieldCheck size={12} />
                      Co-host
                    </span>
                  )}
                </div>
                <p className="text-sm text-eatspin-gray-1">
                  {participants.length} / {GROUP_ROOM_MAX_PARTICIPANTS} participants active
                </p>
                <p className="text-xs text-eatspin-gray-1">Signed in as {resolvedDisplayName}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(isHost || isCohost) && (
                  <Button
                    className="bg-brand-orange text-white hover:bg-brand-orange/90"
                    onClick={() => void handleStartRoomSpin()}
                    disabled={!canStartRoomSpin || isBusy}
                    title={canStartRoomSpin ? 'Start room spin for everyone' : 'Add at least 2 restaurants in the shared list to spin'}
                  >
                    <Sparkles size={16} />
                    Start spin
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="border-brand-orange text-brand-orange hover:bg-brand-orange/10"
                  onClick={handleCopyLink}
                >
                  {hasCopied ? <Check size={16} /> : <Copy size={16} />}
                  {hasCopied ? 'Copied' : 'Copy room link'}
                </Button>
                <Button variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-100" onClick={handleLeaveRoom}>
                  <LogOut size={16} />
                  Leave room
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {participants.length === 0 ? (
                <p className="text-sm text-eatspin-gray-1">No active participants yet.</p>
              ) : (
                participants.map((participant) => (
                  <div
                    key={participant.uid}
                    className="flex items-center justify-between rounded-lg border border-eatspin-peach/60 bg-brand-linen/50 px-3 py-2"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-brand-black">
                        {participant.name} {participant.uid === authUid ? '(You)' : ''}
                      </span>
                      <span className="text-xs text-eatspin-gray-1">
                        {participant.uid === hostUid ? 'Host' : cohostUids.includes(participant.uid) ? 'Co-host' : 'Participant'} • {participant.ready ? 'Ready' : 'Idle'}
                      </span>
                    </div>
                    {isHost && participant.uid !== hostUid && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 border-brand-orange text-brand-orange hover:bg-brand-orange/10"
                        disabled={cohostPendingUid === participant.uid}
                        onClick={() => void handleToggleCohost(participant.uid, !cohostUids.includes(participant.uid))}
                      >
                        {cohostUids.includes(participant.uid) ? <UserMinus size={14} /> : <UserPlus size={14} />}
                        {cohostUids.includes(participant.uid) ? 'Remove co-host' : 'Make co-host'}
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: <Sparkles size={20} className="text-brand-orange" />,
              title: 'Host spins once',
              copy: 'Host writes one winner index, then every joined client animates to that result.',
            },
            {
              icon: <Trophy size={20} className="text-brand-orange" />,
              title: 'Shared final result',
              copy: 'No local-only randomness in room mode, so everyone sees the same winner.',
            },
            {
              icon: <ShieldCheck size={20} className="text-brand-orange" />,
              title: 'Fair for everyone',
              copy: 'One committed result drives every client, so no one gets a different outcome.',
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-eatspin-peach/50 bg-white px-5 py-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-orange/10">{item.icon}</span>
                <p className="font-heading font-semibold text-brand-black">{item.title}</p>
              </div>
              <p className="text-sm text-eatspin-gray-1">{item.copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
