import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Users,
  Link2,
  Copy,
  Check,
  ShieldCheck,
  LogOut,
  MapPin,
  Locate,
  Sparkles,
  UserPlus,
  UserMinus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MidSpinMap } from '@/components/MidSpinMap';
import {
  GROUP_ROOM_MAX_PARTICIPANTS,
  GROUP_ROOM_NAME_MAX_LENGTH,
  type GroupRoomParticipant,
  type GroupRoomReaction,
  type GroupRoomVote,
  type RoomType,
} from '@/hooks/useFirebaseGroupRoom';
import { computeCentroid, computeAutoRadius, type GeoPoint } from '@/lib/centroid';

const GROUP_REACTION_CHOICES = ['🔥', '😂', '🤮', '🙌'];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MidSpinProps {
  // Auth
  isFirebaseConfigured: boolean;
  firebaseConfigError: string | null;
  authLoading: boolean;
  authError: string | null;
  authUid: string | null;

  // Display name
  displayName: string;
  resolvedDisplayName: string;
  setDisplayName: (value: string) => void;

  // Room state
  roomId: string;
  hostUid: string;
  roomLink: string;
  roomType: RoomType;
  isHost: boolean;
  isCohost: boolean;
  cohostUids: string[];
  isBusy: boolean;
  roomError: string | null;
  participants: GroupRoomParticipant[];
  reactions: GroupRoomReaction[];
  votes: GroupRoomVote[];

  // Location
  userLocation: { lat: number; lng: number } | null;
  locationLoading: boolean;
  locationError: string | null;
  onRequestLocation: () => void;

  // Actions
  onCreateRoom: () => Promise<void>;
  onJoinRoom: (value: string) => Promise<void>;
  onLeaveRoom: () => Promise<void>;
  onSetParticipantCohost: (uid: string, shouldBeCohost: boolean) => Promise<void>;
  onSendReaction: (emoji: string) => Promise<void>;
  onSetGoingVote: (going: boolean) => Promise<void>;
  onClearRoomError: () => void;

  // Spin callback — parent handles the actual search + wheel
  onMidSpin: (centroid: GeoPoint, radiusM: number) => void;
  canSpin: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MidSpin({
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
  roomType: _roomType,
  isHost,
  isCohost,
  cohostUids,
  isBusy,
  roomError,
  participants,
  reactions,
  votes,
  userLocation,
  locationLoading,
  locationError,
  onRequestLocation,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onSetParticipantCohost,
  onSendReaction,
  onSetGoingVote,
  onClearRoomError,
  onMidSpin,
  canSpin,
}: MidSpinProps) {
  const [joinValue, setJoinValue] = useState('');
  const [hasCopied, setHasCopied] = useState(false);
  const [cohostPendingUid, setCohostPendingUid] = useState<string | null>(null);
  const [votePending, setVotePending] = useState(false);

  const canInteract = isFirebaseConfigured && !authLoading;
  const hasRoom = Boolean(roomId);
  const isMidspinRoom = hasRoom && _roomType === 'midspin';
  const goingCount = votes.filter((v) => v.going).length;
  const myVote = votes.find((v) => v.uid === authUid);
  const reactionBurst = reactions.slice(-6);

  // Derived geo data
  const locatedParticipants = useMemo(
    () => participants.filter((p) => p.lat !== undefined && p.lng !== undefined),
    [participants],
  );
  const geoPoints: GeoPoint[] = useMemo(
    () => locatedParticipants.map((p) => ({ lat: p.lat!, lng: p.lng! })),
    [locatedParticipants],
  );
  const centroid = useMemo(() => computeCentroid(geoPoints), [geoPoints]);
  const autoRadius = useMemo(
    () => (centroid ? computeAutoRadius(centroid, geoPoints) : 0),
    [centroid, geoPoints],
  );

  const hasLocation = Boolean(userLocation);

  // Auto-request location when section first renders
  useEffect(() => {
    if (!userLocation && !locationLoading && !locationError) {
      onRequestLocation();
    }
    // Only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handlers
  const handleCopyLink = useCallback(async () => {
    if (!roomLink || typeof navigator === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(roomLink);
    setHasCopied(true);
  }, [roomLink]);

  const handleCreateRoom = useCallback(async () => {
    setHasCopied(false);
    await onCreateRoom();
  }, [onCreateRoom]);

  const handleJoinRoom = useCallback(async () => {
    if (!joinValue.trim()) return;
    setHasCopied(false);
    await onJoinRoom(joinValue);
    setJoinValue('');
  }, [joinValue, onJoinRoom]);

  const handleLeaveRoom = useCallback(async () => {
    setHasCopied(false);
    await onLeaveRoom();
  }, [onLeaveRoom]);

  const handleSpin = useCallback(() => {
    if (!centroid) return;
    onMidSpin(centroid, autoRadius);
  }, [centroid, autoRadius, onMidSpin]);

  const handleToggleCohost = useCallback(async (uid: string, shouldBeCohost: boolean) => {
    setCohostPendingUid(uid);
    await onSetParticipantCohost(uid, shouldBeCohost);
    setCohostPendingUid(null);
  }, [onSetParticipantCohost]);

  const handleSetGoingVote = useCallback(async (going: boolean) => {
    setVotePending(true);
    await onSetGoingVote(going);
    setVotePending(false);
  }, [onSetGoingVote]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <section id="midspin" className="bg-brand-linen px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-12 text-center">
          <Badge className="mb-4 border border-brand-orange/30 bg-brand-orange/10 text-brand-orange">
            <MapPin size={12} className="mr-1" />
            MidSpin
          </Badge>
          <h2 className="mb-4 font-heading text-3xl font-bold text-brand-black sm:text-4xl">
            Meet in the middle
          </h2>
          <p className="mx-auto max-w-2xl text-eatspin-gray-1">
            Everyone shares their location. We find the fair midpoint and discover restaurants nearby.
          </p>
        </div>

        {/* Error banner */}
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

        {/* Location gate — show prompt if location is not yet available */}
        {!hasLocation && (
          <div className="mb-6 rounded-xl border border-brand-orange/30 bg-white px-5 py-4 text-center">
            <Locate size={24} className="mx-auto mb-2 text-brand-orange" />
            <p className="text-sm font-semibold text-brand-black">Location required for MidSpin</p>
            <p className="mt-1 text-xs text-eatspin-gray-1">
              {locationError ?? 'Allow location access so we can compute the meeting point.'}
            </p>
            <Button
              className="mt-3 bg-brand-orange text-white hover:bg-brand-orange/90"
              onClick={onRequestLocation}
              disabled={locationLoading}
            >
              {locationLoading ? 'Getting location…' : 'Share my location'}
            </Button>
          </div>
        )}

        {/* ── Create / Join grid ── */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-eatspin-peach/60 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl font-heading text-brand-black">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-orange/10">
                  <Users className="text-brand-orange" size={20} />
                </span>
                Create MidSpin room
              </CardTitle>
              <CardDescription>Share a room code — everyone brings their location.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Button
                className="w-full bg-brand-orange font-heading text-white hover:bg-brand-orange/90"
                onClick={handleCreateRoom}
                disabled={!canInteract || isBusy || !hasLocation}
              >
                {isBusy ? 'Working…' : 'Create MidSpin room'}
              </Button>
              <div className="rounded-xl border border-dashed border-brand-orange/30 bg-white/70 px-4 py-3 text-sm text-eatspin-gray-1">
                {hasRoom ? (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-brand-black/60">Room code</p>
                    <p className="text-base font-heading text-brand-black">{roomId}</p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="truncate text-xs text-brand-black/70">{roomLink}</span>
                      <Button
                        variant="outline" size="sm"
                        className="border-brand-orange text-brand-orange hover:bg-brand-orange/10"
                        onClick={() => { void handleCopyLink(); }}
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
                Join MidSpin room
              </CardTitle>
              <CardDescription>Set your name, then join with a code or link.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Input
                placeholder="Your name (required)"
                maxLength={GROUP_ROOM_NAME_MAX_LENGTH}
                className="h-12 rounded-xl border-eatspin-peach/60 bg-white"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={!canInteract || isBusy}
              />
              <Input
                placeholder="Paste room link or enter code"
                className="h-12 rounded-xl border-eatspin-peach/60 bg-white"
                value={joinValue}
                onChange={(e) => setJoinValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleJoinRoom(); } }}
                disabled={!canInteract || isBusy}
              />
              <Button
                variant="outline"
                className="w-full border-brand-orange text-brand-orange hover:bg-brand-orange/10"
                onClick={() => { void handleJoinRoom(); }}
                disabled={!canInteract || isBusy || !hasLocation}
              >
                {isBusy ? 'Joining…' : 'Join room'}
              </Button>
              {!hasLocation && (
                <p className="text-xs text-center text-eatspin-gray-1">
                  Enable location above before joining.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Active room panel ── */}
        {isMidspinRoom && (
          <div className="mt-10 space-y-6">
            {/* Map — always visible */}
            <div className="rounded-2xl border border-brand-orange/30 bg-white p-3 shadow-sm">
              <MidSpinMap
                participants={participants}
                authUid={authUid}
                className="h-[340px] sm:h-[420px]"
              />
            </div>

            {/* Room info + participants */}
            <div className="rounded-2xl border border-brand-orange/30 bg-white px-6 py-5 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-brand-black/60">MidSpin room</p>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-heading text-brand-black">{roomId}</p>
                    {isHost && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-orange/10 px-2 py-0.5 text-xs font-semibold text-brand-orange">
                        <ShieldCheck size={12} /> Host
                      </span>
                    )}
                    {!isHost && isCohost && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-orange/10 px-2 py-0.5 text-xs font-semibold text-brand-orange">
                        <ShieldCheck size={12} /> Co-host
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-eatspin-gray-1">
                    {participants.length} / {GROUP_ROOM_MAX_PARTICIPANTS} participants •
                    {' '}{locatedParticipants.length} located
                  </p>
                  <p className="text-xs text-eatspin-gray-1">Signed in as {resolvedDisplayName}</p>
                  {centroid && (
                    <p className="mt-1 text-xs text-brand-orange font-medium">
                      Midpoint: {centroid.lat.toFixed(4)}, {centroid.lng.toFixed(4)} •
                      Radius: {autoRadius >= 1000 ? `${(autoRadius / 1000).toFixed(1)} km` : `${autoRadius} m`}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(isHost || isCohost) && (
                    <Button
                      className="bg-brand-orange text-white hover:bg-brand-orange/90"
                      onClick={handleSpin}
                      disabled={!canSpin || !centroid || locatedParticipants.length < 1}
                      title={!centroid ? 'Waiting for participant locations…' : 'Spin for restaurants near midpoint'}
                    >
                      <Sparkles size={16} />
                      Spin midpoint
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="border-brand-orange text-brand-orange hover:bg-brand-orange/10"
                    onClick={() => { void handleCopyLink(); }}
                  >
                    {hasCopied ? <Check size={16} /> : <Copy size={16} />}
                    {hasCopied ? 'Copied' : 'Copy link'}
                  </Button>
                  <Button variant="outline" className="border-gray-300 text-gray-700 hover:bg-gray-100" onClick={() => { void handleLeaveRoom(); }}>
                    <LogOut size={16} />
                    Leave
                  </Button>
                </div>
              </div>

              {/* Participant list */}
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {participants.length === 0 ? (
                  <p className="text-sm text-eatspin-gray-1">No active participants yet.</p>
                ) : (
                  participants.map((p) => (
                    <div
                      key={p.uid}
                      className="flex items-center justify-between rounded-lg border border-eatspin-peach/60 bg-brand-linen/50 px-3 py-2"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-brand-black">
                          {p.name} {p.uid === authUid ? '(You)' : ''}
                        </span>
                        <span className="text-xs text-eatspin-gray-1">
                          {p.uid === hostUid ? 'Host' : cohostUids.includes(p.uid) ? 'Co-host' : 'Participant'}
                          {' • '}
                          {p.lat !== undefined ? (
                            <span className="text-emerald-600">📍 Located</span>
                          ) : (
                            <span className="text-amber-500">Waiting for location…</span>
                          )}
                        </span>
                      </div>
                      {isHost && p.uid !== hostUid && (
                        <Button
                          variant="outline" size="sm"
                          className="h-8 border-brand-orange text-brand-orange hover:bg-brand-orange/10"
                          disabled={cohostPendingUid === p.uid}
                          onClick={() => { void handleToggleCohost(p.uid, !cohostUids.includes(p.uid)); }}
                        >
                          {cohostUids.includes(p.uid) ? <UserMinus size={14} /> : <UserPlus size={14} />}
                          {cohostUids.includes(p.uid) ? 'Remove' : 'Co-host'}
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Reactions */}
              <div className="relative mt-4 rounded-xl border border-eatspin-peach/60 bg-brand-linen/50 px-4 py-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-brand-black">Reactions</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {GROUP_REACTION_CHOICES.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-brand-orange/35 bg-white text-lg hover:bg-brand-orange/10"
                      onClick={() => { void onSendReaction(emoji); }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {reactions.slice(-8).map((r) => (
                    <span key={r.id} className="rounded-full bg-white px-2 py-0.5 text-xs text-brand-black">
                      {r.emoji} {r.name}
                    </span>
                  ))}
                </div>
                {reactionBurst.length > 0 && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center gap-2 overflow-hidden pb-2">
                    {reactionBurst.map((r) => (
                      <span key={`burst-${r.id}`} className="reaction-float text-xl">{r.emoji}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Who's in? */}
              <div className="mt-4 rounded-xl border border-eatspin-peach/60 bg-brand-linen/50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-brand-black">Who's in?</p>
                  <p className="text-xs text-eatspin-gray-1">
                    {goingCount}/{participants.length} going
                  </p>
                </div>
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button" size="sm"
                    className={`h-8 ${myVote?.going ? 'bg-brand-orange text-white' : 'bg-white text-brand-black border border-brand-orange/40 hover:bg-brand-orange/10'}`}
                    disabled={votePending}
                    onClick={() => { void handleSetGoingVote(true); }}
                  >
                    I'm in
                  </Button>
                  <Button
                    type="button" size="sm" variant="outline"
                    className={`h-8 ${myVote && !myVote.going ? 'border-brand-orange text-brand-orange' : ''}`}
                    disabled={votePending}
                    onClick={() => { void handleSetGoingVote(false); }}
                  >
                    Pass
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Feature cards */}
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: <MapPin size={20} className="text-brand-orange" />,
              title: 'Fair midpoint',
              copy: 'We compute the geographic centre of all participants so nobody travels more than anyone else.',
            },
            {
              icon: <Locate size={20} className="text-brand-orange" />,
              title: 'Auto radius',
              copy: 'The search radius stretches to cover everyone, then adds a small buffer for more options.',
            },
            {
              icon: <ShieldCheck size={20} className="text-brand-orange" />,
              title: 'Privacy first',
              copy: 'Locations are rounded to ~100 m before sharing. Only the midpoint is used for the search.',
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
