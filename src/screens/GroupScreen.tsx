import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Check, Copy, LogOut, Share2, UserMinus, UserPlus } from 'lucide-react';

import {
  GROUP_ROOM_MAX_PARTICIPANTS,
  GROUP_ROOM_NAME_MAX_LENGTH,
  type GroupRoomParticipant,
  type GroupRoomReaction,
  type GroupRoomVote,
} from '@/hooks/useFirebaseGroupRoom';
import { normalizeRoomCode } from '@/lib/roomCode';
import { cn } from '@/lib/utils';
import { ArcadeButton, FOCUS_RING, InitialTile, ScreenFrame, SectionLabel } from '@/screens/arcade';

const GROUP_REACTION_CHOICES = ['🔥', '😂', '🤮', '🙌'];
const COPIED_LABEL_MS = 2_500;
// How long a "Start spin" tap may wait for the room to report the new spin before it is forgotten.
const START_SPIN_WAIT_MS = 10_000;

const CARD_CLASS = 'rounded-2xl border-[3px] border-brand-ink bg-white p-3.5 font-heading text-brand-ink';

const FIELD_CLASS = cn(
  'h-12 w-full rounded-xl border-[3px] border-brand-ink bg-white px-3 font-heading text-base font-medium text-brand-ink',
  'placeholder:text-eatspin-gray-2 disabled:opacity-60',
  FOCUS_RING,
);

interface GroupScreenProps {
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
  reactions: GroupRoomReaction[];
  votes: GroupRoomVote[];
  canStartRoomSpin: boolean;
  onCreateRoom: () => Promise<void>;
  onJoinRoom: (value: string) => Promise<void>;
  onLeaveRoom: () => Promise<void>;
  onStartRoomSpin: (shortlist?: string[]) => Promise<void>;
  onTransferHost?: (uid: string) => Promise<void>;
  listNames?: string[];
  preferences?: Record<string, Record<string, 'prefer' | 'avoid'>>;
  onSetPreference?: (name: string, preference: 'prefer' | 'avoid' | null) => Promise<void>;
  connected?: boolean;
  onSetParticipantCohost: (uid: string, shouldBeCohost: boolean) => Promise<void>;
  onSendReaction: (emoji: string) => Promise<void>;
  onSetGoingVote: (going: boolean) => Promise<void>;
  onClearRoomError: () => void;
  showCompletedListReminder: boolean;

  /** Number of places on the shared room list (edited on My list). */
  roomListCount: number;
  /** Most recent room spin, without its winner so the reveal is not spoiled. */
  latestSpin: { spinId: string; relativeText: string } | null;
  /** Goes to My list, where the shared wheel plays the room spin. */
  onOpenList: () => void;
}

/**
 * Group screen: join or create a room, or, inside a room, the code, who is in it and the
 * pinned "Start spin for everyone". All room state and Firebase calls come in through props
 * from useFirebaseGroupRoom; this file only lays them out.
 */
export function GroupScreen({
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
  reactions,
  votes,
  canStartRoomSpin,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onStartRoomSpin, onTransferHost, listNames = [], preferences = {}, onSetPreference, connected = true,
  onSetParticipantCohost,
  onSendReaction,
  onSetGoingVote,
  onClearRoomError,
  showCompletedListReminder,
  roomListCount,
  latestSpin,
  onOpenList,
}: GroupScreenProps) {
  const [joinValue, setJoinValue] = useState(() => {
    if (typeof window === 'undefined') return '';
    return normalizeRoomCode(new URLSearchParams(window.location.search).get('room') ?? '');
  });
  const [hasCopied, setHasCopied] = useState(false);
  const [cohostPendingUid, setCohostPendingUid] = useState<string | null>(null);
  const [shortlistOnly, setShortlistOnly] = useState(false);
  const [transferPending, setTransferPending] = useState(false);
  const [votePending, setVotePending] = useState(false);

  const copiedTimerRef = useRef<number | null>(null);
  const awaitingSpinRef = useRef<{ previousSpinId: string | null } | null>(null);
  const awaitingTimerRef = useRef<number | null>(null);

  const nameFieldId = useId();
  const joinFieldId = useId();
  const startHintId = useId();

  const canInteract = isFirebaseConfigured && !authLoading;
  const hasRoom = Boolean(roomId);
  const canHostSpin = isHost || isCohost;
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const latestSpinId = latestSpin?.spinId ?? null;

  const preferenceKey = (name: string) => Array.from(new TextEncoder().encode(name.toLowerCase())).map(byte => byte.toString(16).padStart(2, '0')).join('');
  const activeUids = new Set(participants.map(participant => participant.uid));
  const countPreference = (name: string, value: 'prefer' | 'avoid') => Object.entries(preferences).filter(([uid, entries]) => activeUids.has(uid) && entries[preferenceKey(name)] === value).length;
  const nominatedNames = listNames.filter(name => countPreference(name, 'prefer') > 0);
  const canSpinSelection = canStartRoomSpin && (!shortlistOnly || nominatedNames.length >= 2);
  const goingCount = votes.filter((vote) => vote.going).length;
  const myVote = votes.find((vote) => vote.uid === authUid);
  const reactionBurst = reactions.slice(-6);

  useEffect(() => () => {
    if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
    if (awaitingTimerRef.current !== null) window.clearTimeout(awaitingTimerRef.current);
  }, []);

  // After "Start spin" the room reports a new spin. Bring the starter to the wheel so they see it play.
  useEffect(() => {
    const awaiting = awaitingSpinRef.current;
    if (!awaiting || latestSpinId === awaiting.previousSpinId) return;
    awaitingSpinRef.current = null;
    onOpenList();
  }, [latestSpinId, onOpenList]);

  const showCopied = () => {
    setHasCopied(true);
    if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = window.setTimeout(() => setHasCopied(false), COPIED_LABEL_MS);
  };

  const handleCopyLink = async () => {
    if (!roomLink || typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(roomLink);
      showCopied();
    } catch {
      // Clipboard can fail on unsupported browsers or denied permission.
    }
  };

  const handleShare = async () => {
    if (!roomLink || !canShare) return;
    try {
      await navigator.share({
        title: 'Join my EatSpin room',
        text: `Join my EatSpin room ${roomId} and spin for lunch together.`,
        url: roomLink,
      });
    } catch {
      // Closing the share sheet rejects. Nothing to do.
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
    if (isHost && participants.some(participant => participant.uid !== authUid) && !window.confirm('Transfer host first if the group should continue. Leave without transferring?')) return;
    setHasCopied(false);
    await onLeaveRoom();
  };

  const handleStartRoomSpin = async () => {
    if (!canHostSpin || !canSpinSelection || !connected) return;
    awaitingSpinRef.current = { previousSpinId: latestSpinId };
    if (awaitingTimerRef.current !== null) window.clearTimeout(awaitingTimerRef.current);
    awaitingTimerRef.current = window.setTimeout(() => {
      awaitingSpinRef.current = null;
    }, START_SPIN_WAIT_MS);
    await onStartRoomSpin(shortlistOnly ? nominatedNames : undefined);
  };

  const handleToggleCohost = async (uid: string, shouldBeCohost: boolean) => {
    setCohostPendingUid(uid);
    await onSetParticipantCohost(uid, shouldBeCohost);
    setCohostPendingUid(null);
  };

  const handleSetGoingVote = async (going: boolean) => {
    setVotePending(true);
    await onSetGoingVote(going);
    setVotePending(false);
  };

  // Without Firebase config the auth error repeats the config error, so show the text once.
  const configMessage = isFirebaseConfigured ? null : firebaseConfigError ?? 'Firebase configuration is missing.';
  const authMessage = authError && authError !== configMessage ? authError : null;

  const statusBanner = (configMessage || authMessage || roomError) && (
    <div role="alert" className={cn(CARD_CLASS, 'flex flex-col gap-2 text-sm font-semibold')}>
      {configMessage && <p>{configMessage}</p>}
      {authMessage && <p>{authMessage}</p>}
      {roomError && (
        <div className="flex items-center justify-between gap-2">
          <p>{roomError}</p>
          <ArcadeButton className="min-h-11 shrink-0 px-3 text-sm" onClick={onClearRoomError}>
            Dismiss
          </ArcadeButton>
        </div>
      )}
    </div>
  );

  if (!hasRoom) {
    return (
      <ScreenFrame title="Group spin" subtitle="Everyone sees the same wheel">
        {statusBanner}

        <div className={CARD_CLASS}>
          <label htmlFor={nameFieldId} className="mb-1 block text-sm font-semibold text-eatspin-gray-1">
            Your name
          </label>
          <input
            id={nameFieldId}
            type="text"
            maxLength={GROUP_ROOM_NAME_MAX_LENGTH}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            disabled={!canInteract || isBusy}
            autoComplete="nickname"
            placeholder="What should friends call you?"
            className={FIELD_CLASS}
          />
        </div>

        <section aria-label="Create a room" className={cn(CARD_CLASS, 'flex flex-col gap-3 border-4 shadow-pop')}>
          <div>
            <h2 className="text-xl font-bold">Create a room</h2>
            <p className="text-sm font-medium text-eatspin-gray-1">
              Create one room code and invite everyone with the same link.
            </p>
          </div>
          <ArcadeButton variant="pink" size="lg" onClick={() => void handleCreateRoom()} disabled={!canInteract || isBusy}>
            {isBusy ? 'Working...' : 'Create room link'}
          </ArcadeButton>
        </section>

        <form
          aria-label="Join a room"
          className={cn(CARD_CLASS, 'flex flex-col gap-3')}
          onSubmit={(event) => {
            event.preventDefault();
            void handleJoinRoom();
          }}
        >
          <div>
            <h2 className="text-xl font-bold">Join a room</h2>
            <p className="text-sm font-medium text-eatspin-gray-1">Enter the code or paste the room link a friend sent.</p>
          </div>
          <div>
            <label htmlFor={joinFieldId} className="mb-1 block text-sm font-semibold text-eatspin-gray-1">
              Room code or link
            </label>
            <input
              id={joinFieldId}
              type="text"
              value={joinValue}
              onChange={(event) => setJoinValue(event.target.value)}
              disabled={!canInteract || isBusy}
              autoCapitalize="characters"
              autoComplete="off"
              enterKeyHint="go"
              placeholder="Paste room link or enter code"
              className={FIELD_CLASS}
            />
          </div>
          <ArcadeButton
            type="submit"
            variant="cyan"
            disabled={!canInteract || isBusy || !joinValue.trim()}
          >
            {isBusy ? 'Joining...' : 'Join room'}
          </ArcadeButton>
        </form>
      </ScreenFrame>
    );
  }

  const roleOf = (uid: string): 'host' | 'cohost' | 'participant' => (
    uid === hostUid ? 'host' : cohostUids.includes(uid) ? 'cohost' : 'participant'
  );

  const pinned = (
    <div className="flex flex-col gap-2.5">
      {canHostSpin ? (
        <>
          {!canStartRoomSpin && (
            <p id={startHintId} className="text-center font-heading text-sm font-semibold text-brand-ink">
              Add at least 2 places in My list to spin.
            </p>
          )}
          <ArcadeButton
            variant="pink"
            size="lg"
            onClick={() => void handleStartRoomSpin()}
            disabled={!canSpinSelection || isBusy || !connected}
            aria-describedby={canStartRoomSpin ? undefined : startHintId}
          >
            Start spin for everyone
          </ArcadeButton>
        </>
      ) : (
        <>
          <p id={startHintId} className="text-center font-heading text-sm font-semibold text-brand-ink">
            Waiting for the host to start the spin.
          </p>
          <ArcadeButton variant="pink" size="lg" onClick={onOpenList} aria-describedby={startHintId}>
            Open the shared wheel
          </ArcadeButton>
        </>
      )}
      <ArcadeButton onClick={() => void handleLeaveRoom()} className="font-semibold">
        <LogOut size={18} strokeWidth={2.5} aria-hidden="true" />
        Leave room
      </ArcadeButton>
    </div>
  );

  return (
    <ScreenFrame title="Group spin" subtitle="Everyone sees the same wheel" pinned={pinned}>
      {statusBanner}
      <p role="status" className="text-sm font-semibold">{connected ? 'Connected to room' : 'Offline · reconnecting…'}</p>

      <section
        aria-label="Room code"
        className="rounded-3xl border-4 border-brand-ink bg-white px-4 py-4 text-center font-heading text-brand-ink shadow-pop-lg"
      >
        <p className="text-sm font-semibold text-eatspin-gray-1">Room code</p>
        <p
          data-testid="room-code"
          className="text-[44px] font-bold leading-[1.1] tracking-[0.14em] [overflow-wrap:anywhere]"
        >
          {roomId}
        </p>
        <div className="mt-2.5 flex gap-2.5">
          <ArcadeButton variant="cyan" className="flex-1 whitespace-nowrap px-3" onClick={() => void handleCopyLink()}>
            {hasCopied ? <Check size={18} strokeWidth={3} aria-hidden="true" /> : <Copy size={18} strokeWidth={2.5} aria-hidden="true" />}
            <span aria-live="polite">{hasCopied ? 'Copied' : 'Copy link'}</span>
          </ArcadeButton>
          {canShare && (
            <ArcadeButton className="flex-1 whitespace-nowrap px-3" onClick={() => void handleShare()}>
              <Share2 size={18} strokeWidth={2.5} aria-hidden="true" />
              Share
            </ArcadeButton>
          )}
        </div>
      </section>

      <section aria-labelledby="in-the-room-heading">
        <SectionLabel id="in-the-room-heading">
          In the room · {participants.length} / {GROUP_ROOM_MAX_PARTICIPANTS}
        </SectionLabel>
        {participants.length === 0 ? (
          <p className="font-heading text-sm font-medium text-eatspin-gray-1">No active participants yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {participants.map((participant) => {
              const role = roleOf(participant.uid);
              const isMe = participant.uid === authUid;
              const showCohostToggle = isHost && participant.uid !== hostUid;
              return (
                <li
                  key={participant.uid}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border-[3px] border-brand-ink bg-white px-3 py-2 font-heading text-brand-ink"
                >
                  <InitialTile name={participant.name} shape="round" />
                  <span className="min-w-0 flex-1 break-words text-[17px] font-semibold">
                    {participant.name}
                    {isMe && <span className="font-medium text-eatspin-gray-1"> (you)</span>}
                  </span>
                  {role === 'host' && <Badge tone="yellow">Host</Badge>}
                  {role === 'cohost' && <Badge tone="violet">Co-host</Badge>}
                  {role === 'participant' && (
                    <Badge tone={participant.ready ? 'lime' : 'white'}>{participant.ready ? 'Ready' : 'Idle'}</Badge>
                  )}
                  {showCohostToggle && onTransferHost && <ArcadeButton className="min-h-11 w-full px-3 text-sm"
                    disabled={transferPending || !connected} onClick={async () => {
                      if (!window.confirm(`Make ${participant.name} the host? You will become a participant.`)) return;
                      setTransferPending(true);
                      try { await onTransferHost(participant.uid); } finally { setTransferPending(false); }
                    }}>Transfer host</ArcadeButton>}
                  {showCohostToggle && (
                    <ArcadeButton
                      className="min-h-11 w-full px-3 text-sm"
                      disabled={cohostPendingUid === participant.uid}
                      onClick={() => void handleToggleCohost(participant.uid, role !== 'cohost')}
                    >
                      {role === 'cohost' ? <UserMinus size={16} aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}
                      {role === 'cohost' ? 'Remove co-host' : 'Make co-host'}
                    </ArcadeButton>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-2 font-heading text-xs font-medium text-eatspin-gray-1">You are {resolvedDisplayName}.</p>
      </section>

      {latestSpin && (
        <section aria-label="Latest spin" className={cn(CARD_CLASS, 'flex items-center justify-between gap-3')}>
          <div className="min-w-0">
            <p className="text-base font-bold">Latest spin {latestSpin.relativeText}</p>
            <p className="text-sm font-medium text-eatspin-gray-1">Watch the wheel to see the result.</p>
          </div>
          <ArcadeButton variant="cyan" className="min-h-11 shrink-0 px-3 text-sm" onClick={onOpenList}>
            Watch
          </ArcadeButton>
        </section>
      )}

      {showCompletedListReminder && (
        <section aria-label="Room spin finished" className={cn(CARD_CLASS, 'bg-arcade-lime text-sm')}>
          <p className="font-bold">The room spin is finished.</p>
          <p className="font-medium">
            You are still viewing this room&apos;s shared list. Leave the room when you want to go back to your own saved personal list.
          </p>
        </section>
      )}

      <section aria-label="Shared list" className={cn(CARD_CLASS, 'flex items-center justify-between gap-3')}>
        <div className="min-w-0">
          <p className="text-base font-bold">
            {roomListCount} {roomListCount === 1 ? 'place' : 'places'} on the room list
          </p>
          <p className="text-sm font-medium text-eatspin-gray-1">
            {canHostSpin ? 'Edit it in My list. Changes sync to the room.' : 'Only the host and co-hosts can edit it.'}
          </p>
        </div>
        <ArcadeButton className="min-h-11 shrink-0 px-3 text-sm" onClick={onOpenList}>
          View list
        </ArcadeButton>
      </section>

      {onSetPreference && listNames.length > 0 && <section aria-label="Shortlist preferences" className={CARD_CLASS}>
        <h2 className="text-base font-bold">Where would you like to go?</h2>
        <p className="text-sm">Preferences stay for this room. Avoid is advice, not a veto. The host chooses whether to use nominations.</p>
        <ul className="mt-2 space-y-3">{listNames.map(name => {
          const mine = authUid ? preferences[authUid]?.[preferenceKey(name)] : undefined;
          return <li key={name}><p className="font-semibold break-words">{name} · {countPreference(name, 'prefer')} prefer · {countPreference(name, 'avoid')} avoid</p>
            <div className="flex flex-wrap gap-2">
              <ArcadeButton className="min-h-11" disabled={!connected} aria-pressed={mine === 'prefer'} onClick={() => void onSetPreference(name, mine === 'prefer' ? null : 'prefer')}>Prefer {name}</ArcadeButton>
              <ArcadeButton className="min-h-11" disabled={!connected} aria-pressed={mine === 'avoid'} onClick={() => void onSetPreference(name, mine === 'avoid' ? null : 'avoid')}>Avoid {name}</ArcadeButton>
            </div>
          </li>;
        })}</ul>
        {canHostSpin && <label className="mt-3 flex min-h-11 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={shortlistOnly} onChange={event => setShortlistOnly(event.target.checked)} />
          Spin nominated places only ({nominatedNames.length})
        </label>}
        {canHostSpin && shortlistOnly && nominatedNames.length < 2 && <p role="status">Nominate at least 2 places, or turn off this filter.</p>}
      </section>}

      <section aria-label="Who is going" className={CARD_CLASS}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
          <h2 className="text-base font-bold">Who&apos;s in?</h2>
          <p className="text-xs font-medium text-eatspin-gray-1">
            {goingCount}/{participants.length} going · {votes.length} voted
          </p>
        </div>
        <div className="mt-2 flex gap-2">
          <ArcadeButton
            variant={myVote?.going ? 'lime' : 'white'}
            aria-pressed={myVote?.going === true}
            disabled={votePending || !latestSpin || !connected}
            className="flex-1"
            onClick={() => void handleSetGoingVote(true)}
          >
            I&apos;m in
          </ArcadeButton>
          <ArcadeButton
            variant={myVote && !myVote.going ? 'yellow' : 'white'}
            aria-pressed={myVote ? !myVote.going : false}
            disabled={votePending || !latestSpin || !connected}
            className="flex-1"
            onClick={() => void handleSetGoingVote(false)}
          >
            Pass
          </ArcadeButton>
        </div>
      </section>

      <section aria-label="Reactions" className={cn(CARD_CLASS, 'relative overflow-hidden')}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
          <h2 className="text-base font-bold">Reactions</h2>
          <p className="text-xs font-medium text-eatspin-gray-1">Tap to react in real time</p>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {GROUP_REACTION_CHOICES.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={`React with ${emoji}`}
              className={cn(
                'inline-flex size-11 items-center justify-center rounded-full border-[3px] border-brand-ink bg-white text-xl',
                'transition-transform enabled:active:scale-95 motion-reduce:transition-none motion-reduce:enabled:active:scale-100',
                FOCUS_RING,
              )}
              onClick={() => { void onSendReaction(emoji); }}
            >
              {emoji}
            </button>
          ))}
        </div>
        {reactions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {reactions.slice(-8).map((reaction) => (
              <span
                key={reaction.id}
                className="rounded-full border-2 border-brand-ink bg-arcade-yellow/60 px-2 py-0.5 text-xs font-semibold"
              >
                {reaction.emoji} {reaction.name}
              </span>
            ))}
          </div>
        )}

        {reactionBurst.length > 0 && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center gap-2 overflow-hidden pb-2">
            {reactionBurst.map((reaction) => (
              <span key={`burst-${reaction.id}`} className="reaction-float text-xl">
                {reaction.emoji}
              </span>
            ))}
          </div>
        )}
      </section>
    </ScreenFrame>
  );
}

const BADGE_TONES = {
  yellow: 'bg-arcade-yellow',
  violet: 'bg-arcade-violet',
  lime: 'bg-arcade-lime',
  white: 'bg-white',
} as const;

function Badge({ tone, children }: { tone: keyof typeof BADGE_TONES; children: ReactNode }) {
  return (
    <span
      className={cn(
        'rounded-[10px] border-[3px] border-brand-ink px-2 py-0.5 font-heading text-xs font-bold uppercase tracking-wide text-brand-ink',
        BADGE_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}
