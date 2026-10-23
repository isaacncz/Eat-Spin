import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { useConfirmation } from '@/hooks/useConfirmation';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Check, Copy, LogOut, Pencil, Share2, UserMinus, UserPlus } from 'lucide-react';

import {
  GROUP_ROOM_MAX_PARTICIPANTS,
  GROUP_ROOM_NAME_MAX_LENGTH,
  type GroupRoomParticipant,
  type GroupRoomReaction,
  type GroupRoomVote,
} from '@/hooks/useFirebaseGroupRoom';
import { normalizeRoomCode } from '@/lib/roomCode';
import { getHostPresence, GROUP_ROOM_PARTICIPANT_STALE_MS } from '@/lib/groupRoomPresence';
import { cn } from '@/lib/utils';
import { ArcadeButton, FOCUS_RING, InitialTile, ScreenFrame, SectionLabel } from '@/screens/arcade';

const GROUP_REACTION_CHOICES = ['🔥', '😂', '🤮', '🙌'];
const COPIED_LABEL_MS = 2_500;

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
  onSaveDisplayName?: (value: string) => Promise<boolean>;
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
  showCompletedListReminder?: boolean;

  /** Room editor and wheel stay in Group, independent of personal lists. */
  roomContent?: ReactNode;
  roomWheel?: ReactNode;
  roomStage?: 'preparing' | 'spinning' | 'finished';
  /** Only supplied after this client's wheel reveal is complete. */
  revealedResult?: { spinId: string; winnerName: string; relativeText: string } | null;
  resultActions?: ReactNode;
  /** Number of places on the shared room list. */
  roomListCount: number;
  /** Most recent room spin, without its winner so the reveal is not spoiled. */
  latestSpin: { spinId: string; relativeText: string } | null;
  /** Legacy callers may supply this; room actions no longer navigate to My list. */
  onOpenList?: () => void;
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
  onSaveDisplayName,
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
  roomListCount,
  latestSpin,
  roomContent,
  roomWheel,
  roomStage = latestSpin ? 'spinning' : 'preparing',
  revealedResult = null,
  resultActions,
}: GroupScreenProps) {
  const { confirm, request: confirmation, answer: answerConfirmation, restoreFocus: restoreConfirmationFocus } = useConfirmation();
  const [joinValue, setJoinValue] = useState(() => {
    if (typeof window === 'undefined') return '';
    return normalizeRoomCode(new URLSearchParams(window.location.search).get('room') ?? '');
  });
  const [hasCopied, setHasCopied] = useState(false);
  const [cohostPendingUid, setCohostPendingUid] = useState<string | null>(null);
  const [shortlistOnly, setShortlistOnly] = useState(false);
  const [transferPending, setTransferPending] = useState(false);
  const [votePending, setVotePending] = useState(false);
  const [nameEditing, setNameEditing] = useState(false);
  const [nameDismissedRoom, setNameDismissedRoom] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState(displayName);
  const [namePending, setNamePending] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [spinPending, setSpinPending] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [missingHostSince, setMissingHostSince] = useState<number | null>(null);

  const copiedTimerRef = useRef<number | null>(null);

  const nameFieldId = useId();
  const joinFieldId = useId();
  const startHintId = useId();
  const roomNameFieldId = useId();
  const editNameButtonId = useId();

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
  const visibleResult = roomStage === 'finished' && revealedResult?.spinId === latestSpinId ? revealedResult : null;
  const activeVotes = visibleResult ? votes.filter(vote => vote.spinId === visibleResult.spinId && activeUids.has(vote.uid)) : [];
  const goingCount = activeVotes.filter((vote) => vote.going).length;
  const myVote = activeVotes.find((vote) => vote.uid === authUid);
  const reactionBurst = reactions.slice(-6);
  const hostParticipant = participants.find(participant => participant.uid === hostUid);
  const hasFreshHost = Boolean(hostParticipant && now - hostParticipant.lastSeenAt <= GROUP_ROOM_PARTICIPANT_STALE_MS);
  const hostPresence = getHostPresence({ connected, hostUid, participants, now, missingSince: missingHostSince });
  const needsName = (!displayName.trim() || /^Guest-[A-Z0-9]{4}$/i.test(displayName.trim())) && nameDismissedRoom !== roomId;
  const showNameEditor = nameEditing || needsName;

  useEffect(() => () => {
    if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
  }, []);

  useEffect(() => {
    if (!roomId) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [roomId]);

  useEffect(() => {
    setMissingHostSince(!roomId || !connected || hasFreshHost ? null : Date.now());
  }, [connected, hasFreshHost, roomId]);

  useEffect(() => {
    setShortlistOnly(false);
    setNameEditing(false);
    setNameDismissedRoom(null);
    setNameError(null);
  }, [roomId]);

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
    if (isHost && participants.some(participant => participant.uid !== authUid) && !await confirm({ title: 'Leave without transferring host?', description: 'Transfer host first if the group should continue. You can stay and choose a new host.', accept: 'Leave room', cancel: 'Stay in room' })) return;
    setHasCopied(false);
    await onLeaveRoom();
  };

  const handleStartRoomSpin = async () => {
    if (!canHostSpin || !canSpinSelection || !connected || spinPending || roomStage === 'spinning') return;
    setSpinPending(true);
    try { await onStartRoomSpin(shortlistOnly ? nominatedNames : undefined); }
    finally { setSpinPending(false); }
  };

  const handleToggleCohost = async (uid: string, shouldBeCohost: boolean) => {
    setCohostPendingUid(uid);
    try { await onSetParticipantCohost(uid, shouldBeCohost); }
    finally { setCohostPendingUid(null); }
  };

  const handleSetGoingVote = async (going: boolean) => {
    setVotePending(true);
    try { await onSetGoingVote(going); }
    finally { setVotePending(false); }
  };

  const handleSaveName = async () => {
    if (!nameDraft.trim() || namePending || !connected) return;
    setNamePending(true);
    setNameError(null);
    try {
      const saved = onSaveDisplayName ? await onSaveDisplayName(nameDraft) : false;
      if (!saved) { setNameError('Your room name was not saved. Check your connection and try again.'); return; }
      setNameEditing(false);
      setNameDismissedRoom(roomId);
      window.requestAnimationFrame(() => document.getElementById(editNameButtonId)?.focus());
    } catch {
      setNameError('Your room name was not saved. Try again.');
    } finally { setNamePending(false); }
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
  const activeCohostAvailable = participants.some(participant => cohostUids.includes(participant.uid));
  const stageTitle = roomStage === 'spinning' ? 'Spinning together…'
    : visibleResult ? 'Your group’s pick' : roomListCount >= 2 ? 'Ready to choose?' : 'Prepare your room';
  const stageDescription = roomStage === 'spinning' ? 'Everyone sees the same spin. The result will appear here.'
    : visibleResult ? 'See the pick and let your friends know if you’re going.'
      : canHostSpin ? 'Add places, invite friends, then spin when you’re ready.' : 'Review the places and share your preferences while the host gets ready.';

  const pinned = (
    <div className="flex flex-col gap-2">
      {canHostSpin ? (
        <>
          {!canSpinSelection && roomStage !== 'spinning' && (
            <p id={startHintId} className="text-center font-heading text-sm font-semibold text-brand-ink">
              {canStartRoomSpin ? 'Choose at least 2 nominations, or turn off nominated-only in preferences.'
                : roomListCount < 2 ? 'Add at least 2 places to this room to spin.' : 'Wait for room changes to finish saving before spinning.'}
            </p>
          )}
          <ArcadeButton
            variant="pink"
            size="lg"
            onClick={() => void handleStartRoomSpin()}
            disabled={!canSpinSelection || isBusy || !connected || spinPending || roomStage === 'spinning'}
            aria-describedby={canSpinSelection || roomStage === 'spinning' ? undefined : startHintId}
          >
            {roomStage === 'spinning' || spinPending ? 'Spinning…' : visibleResult ? 'Start another spin' : 'Start spin for everyone'}
          </ArcadeButton>
        </>
      ) : (
        <p className="py-2 text-center font-heading text-sm font-semibold text-brand-ink" role="status">
          {roomStage === 'spinning' ? 'The shared spin is playing above.' : visibleResult ? 'The result is above. Let your friends know if you’re going.' : hostPresence === 'absent'
            ? activeCohostAvailable ? 'Waiting for the host to reconnect or a co-host to spin.' : 'Waiting for the host to reconnect.'
            : 'Waiting for the host to start the spin.'}
        </p>
      )}
    </div>
  );

  const attendance = participants.map(participant => ({
    participant,
    vote: activeVotes.find(vote => vote.uid === participant.uid),
  }));

  return (
    <ScreenFrame title="Group spin" subtitle="Your room, from places to the final pick" pinned={pinned}>
      <ConfirmationDialog request={confirmation} onAnswer={answerConfirmation} onRestoreFocus={restoreConfirmationFocus} />
      {statusBanner}
      <p role="status" className="text-sm font-semibold">{connected ? 'Connected to room' : 'Offline · reconnecting…'}</p>
      {connected && !isHost && hostPresence === 'absent' && (
        <p role="status" className={cn(CARD_CLASS, 'bg-arcade-yellow text-sm font-semibold')}>
          Host disconnected—waiting for them to return.
          {isCohost ? ' You can still start a spin as co-host.' : activeCohostAvailable ? ' A co-host can still start the spin.' : ' Your places and preferences are still here.'}
        </p>
      )}

      <section aria-label="Room code" className={cn(CARD_CLASS, 'border-4 shadow-pop')}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-eatspin-gray-1">Invite friends · {participants.length}/{GROUP_ROOM_MAX_PARTICIPANTS} here</p>
            <p data-testid="room-code" className="text-[30px] font-bold tracking-[0.12em] [overflow-wrap:anywhere]">{roomId}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ArcadeButton variant="cyan" className="min-h-11 px-3 text-sm" onClick={() => void handleCopyLink()}>
              {hasCopied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
              <span aria-live="polite">{hasCopied ? 'Copied' : 'Copy link'}</span>
            </ArcadeButton>
            {canShare && <ArcadeButton className="min-h-11 px-3 text-sm" onClick={() => void handleShare()}><Share2 size={18} aria-hidden="true" />Share</ArcadeButton>}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t-2 border-brand-ink/15 pt-2 text-sm">
          <p className="break-words">You: <strong>{resolvedDisplayName}</strong>{isHost ? ' · Host' : isCohost ? ' · Co-host' : ''}</p>
          {onSaveDisplayName && <ArcadeButton id={editNameButtonId} className="min-h-11 px-3 text-sm" onClick={() => {
            setNameDraft(displayName || resolvedDisplayName);
            setNameEditing(true);
            setNameError(null);
          }}><Pencil size={16} aria-hidden="true" />Edit name</ArcadeButton>}
        </div>
      </section>

      {showNameEditor && onSaveDisplayName && (
        <form aria-label="Edit room name" className={CARD_CLASS} onSubmit={event => { event.preventDefault(); void handleSaveName(); }}>
          <label htmlFor={roomNameFieldId} className="block text-base font-bold">What should friends call you?</label>
          <p className="mb-2 text-sm">Choose a name so your friends know who’s in. You can keep using the room while you decide.</p>
          <label htmlFor={roomNameFieldId} className="sr-only">Your room name</label>
          <input id={roomNameFieldId} aria-label="Your room name" type="text" autoComplete="nickname" maxLength={GROUP_ROOM_NAME_MAX_LENGTH}
            value={nameDraft} onChange={event => setNameDraft(event.target.value)} disabled={namePending}
            placeholder="Your name" className={FIELD_CLASS} />
          {nameError && <p role="alert" className="mt-2 text-sm font-semibold">{nameError}</p>}
          {!connected && <p className="mt-2 text-sm">Reconnect to save your room name.</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <ArcadeButton type="submit" variant="cyan" disabled={!nameDraft.trim() || namePending || !connected}>{namePending ? 'Saving name…' : 'Save name'}</ArcadeButton>
            <ArcadeButton disabled={namePending} onClick={() => {
              setNameEditing(false);
              setNameDismissedRoom(roomId);
              setNameError(null);
              window.requestAnimationFrame(() => document.getElementById(editNameButtonId)?.focus());
            }}>{nameEditing ? 'Cancel' : 'Maybe later'}</ArcadeButton>
          </div>
        </form>
      )}

      <section aria-label="Room stage" className="font-heading text-brand-ink">
        <h2 className="text-2xl font-bold">{stageTitle}</h2>
        <p className="mt-1 text-sm font-medium">{stageDescription}</p>
        <p role="status" className="sr-only">{visibleResult ? `The group picked ${visibleResult.winnerName}. Let your friends know if you’re going.` : roomStage === 'spinning' ? 'The shared spin is playing.' : ''}</p>
      </section>

      {visibleResult && (
        <section data-room-result aria-label="Shared result" className={cn(CARD_CLASS, 'border-4 bg-arcade-lime shadow-pop')}>
          <p className="text-sm font-semibold">Your group’s pick · {visibleResult.relativeText}</p>
          <h2 className="mt-1 break-words text-2xl font-bold">{visibleResult.winnerName}</h2>
          {resultActions && <div className="mt-3">{resultActions}</div>}
          <section aria-label="Who is going" className="mt-4 border-t-2 border-brand-ink/20 pt-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-base font-bold">Who’s in?</h3>
              <p className="text-sm font-semibold">{goingCount}/{participants.length} going · {activeVotes.length} responded</p>
            </div>
            <ul aria-label="Attendance responses" className="mt-2 space-y-1 text-sm">
              {attendance.map(({ participant, vote }) => <li key={participant.uid} className="flex flex-wrap justify-between gap-x-3 gap-y-1 rounded-lg bg-white/60 px-2 py-1.5">
                <span className="min-w-0 break-words font-semibold">{participant.name}{participant.uid === authUid ? ' (you)' : ''}</span>
                <span>{vote ? vote.going ? 'Going' : 'Passed' : 'Not responded'}</span>
              </li>)}
            </ul>
            <div className="mt-3 flex gap-2">
              <ArcadeButton variant={myVote?.going ? 'lime' : 'white'} aria-pressed={myVote?.going === true} disabled={votePending || !connected} className="flex-1" onClick={() => void handleSetGoingVote(true)}>I’m in</ArcadeButton>
              <ArcadeButton variant={myVote && !myVote.going ? 'yellow' : 'white'} aria-pressed={myVote ? !myVote.going : false} disabled={votePending || !connected} className="flex-1" onClick={() => void handleSetGoingVote(false)}>Pass</ArcadeButton>
            </div>
          </section>
        </section>
      )}


      <details open={roomStage === 'preparing'} className={CARD_CLASS}>
        <summary className={cn('flex min-h-11 cursor-pointer items-center font-bold', FOCUS_RING)}>Room places · {roomListCount}</summary>
        <div className="mt-3">{roomContent ?? (
          <>
            <p className="text-sm">{canHostSpin ? 'These places are shared with everyone in this room.' : 'Only the host and co-hosts can edit these places.'}</p>
            {listNames.length > 0 ? <ul aria-label="Room places" className="mt-2 list-inside list-disc space-y-1">{listNames.map(name => <li key={name} className="break-words font-semibold">{name}</li>)}</ul> : <p className="mt-2 text-sm">The host can add places to get started.</p>}
          </>
        )}</div>
      </details>

      {roomStage !== 'spinning' && onSetPreference && listNames.length > 0 && (
        <details className={CARD_CLASS}>
          <summary className={cn('flex min-h-11 cursor-pointer items-center font-bold', FOCUS_RING)}>Choose preferences (optional)</summary>
          <section aria-label="Shortlist preferences" className="mt-2">
            <h2 className="text-base font-bold">Where would you like to go?</h2>
            <p className="text-sm">Preferences stay for this room. Avoid is advice, not a veto. The host chooses whether to use nominations.</p>
            <ul className="mt-3 space-y-3">{listNames.map(name => {
              const mine = authUid ? preferences[authUid]?.[preferenceKey(name)] : undefined;
              return <li key={name}><p className="break-words font-semibold">{name} · {countPreference(name, 'prefer')} prefer · {countPreference(name, 'avoid')} avoid</p>
                <div className="mt-1 flex flex-wrap gap-2">
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
          </section>
        </details>
      )}

      {roomWheel && <details open={roomStage !== 'finished'} className={cn(CARD_CLASS, 'relative overflow-hidden')}>
        <summary className={cn('flex min-h-11 cursor-pointer items-center font-bold', FOCUS_RING)}>Shared wheel</summary>
        <div className="mt-2">{roomWheel}</div>
      </details>}


      <details className={CARD_CLASS}>
        <summary className={cn('flex min-h-11 cursor-pointer items-center font-bold', FOCUS_RING)}>People · {participants.length}</summary>
        <SectionLabel id="in-the-room-heading">In the room · {participants.length}/{GROUP_ROOM_MAX_PARTICIPANTS}</SectionLabel>
        {participants.length === 0 ? <p className="mt-2 text-sm">No active participants yet.</p> : <ul aria-labelledby="in-the-room-heading" className="mt-2 space-y-2">
          {participants.map(participant => <li key={participant.uid} className="flex items-center gap-2">
            <InitialTile name={participant.name} shape="round" />
            <span className="min-w-0 flex-1 break-words font-semibold">{participant.name}{participant.uid === authUid ? ' (you)' : ''}</span>
            {roleOf(participant.uid) === 'host' && <Badge tone="yellow">Host</Badge>}
            {roleOf(participant.uid) === 'cohost' && <Badge tone="violet">Co-host</Badge>}
          </li>)}
        </ul>}
      </details>

      <details className={CARD_CLASS}>
        <summary className={cn('flex min-h-11 cursor-pointer items-center font-bold', FOCUS_RING)}>Room settings</summary>
        {isHost && participants.filter(participant => participant.uid !== hostUid).map(participant => <div key={participant.uid} className="mt-3 border-b-2 border-brand-ink/15 pb-3">
          <p className="break-words font-bold">{participant.name}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {onTransferHost && <ArcadeButton className="min-h-11 px-3 text-sm" disabled={transferPending || !connected || roomStage === 'spinning'} onClick={async () => {
              if (!await confirm({ title: 'Transfer host?', description: `Make ${participant.name} the host? They will control this room. ${cohostUids.includes(authUid ?? '') ? 'You will remain a co-host.' : 'You will become a participant.'}`, accept: 'Transfer host', cancel: 'Keep current host' })) return;
              setTransferPending(true);
              try { await onTransferHost(participant.uid); } finally { setTransferPending(false); }
            }}>Transfer host</ArcadeButton>}
            <ArcadeButton className="min-h-11 px-3 text-sm" disabled={cohostPendingUid === participant.uid || !connected} onClick={() => void handleToggleCohost(participant.uid, !cohostUids.includes(participant.uid))}>
              {cohostUids.includes(participant.uid) ? <UserMinus size={16} aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}
              {cohostUids.includes(participant.uid) ? 'Remove co-host' : 'Make co-host'}
            </ArcadeButton>
          </div>
        </div>)}
        <ArcadeButton onClick={() => void handleLeaveRoom()} className="mt-3 w-full font-semibold"><LogOut size={18} aria-hidden="true" />Leave room</ArcadeButton>
      </details>

      <details className={cn(CARD_CLASS, 'relative overflow-hidden')}>
        <summary className={cn('flex min-h-11 cursor-pointer items-center font-bold', FOCUS_RING)}>Reactions</summary>
        <p className="text-sm">Tap to react in real time</p>
        <div className="mt-2 flex flex-wrap gap-2">{GROUP_REACTION_CHOICES.map(emoji => <button key={emoji} type="button" aria-label={`React with ${emoji}`} disabled={!connected}
          className={cn('inline-flex size-11 items-center justify-center rounded-full border-[3px] border-brand-ink bg-white text-xl disabled:opacity-60', FOCUS_RING)} onClick={() => { void onSendReaction(emoji); }}>{emoji}</button>)}</div>
        {reactions.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{reactions.slice(-8).map(reaction => <span key={reaction.id} className="rounded-full border-2 border-brand-ink bg-arcade-yellow/60 px-2 py-0.5 text-xs font-semibold">{reaction.emoji} {reaction.name}</span>)}</div>}
        {reactionBurst.length > 0 && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center gap-2 overflow-hidden pb-2">{reactionBurst.map(reaction => <span key={`burst-${reaction.id}`} className="reaction-float text-xl">{reaction.emoji}</span>)}</div>}
      </details>
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
