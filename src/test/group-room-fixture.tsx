import '@/index.css';
import { useEffect } from 'react';
import { goOffline, goOnline, ref, update } from 'firebase/database';
import { firebaseDb } from '@/lib/firebase';
import { GroupScreen } from '@/screens/GroupScreen';
import { useFirebaseGroupRoom } from '@/hooks/useFirebaseGroupRoom';
export function GroupRoomFixture() {
  const room = useFirebaseGroupRoom();
  useEffect(() => {
    Object.assign(window, { groupHarness: { ...room, resetCooldown: () => firebaseDb && update(ref(firebaseDb, `rooms/${room.roomId}/meta`), { lastSpinAt: 0 }), offline: () => firebaseDb && goOffline(firebaseDb), online: () => firebaseDb && goOnline(firebaseDb) } });
  }, [room]);
  return <><pre data-testid="group-state">{JSON.stringify({ roomId: room.roomId, authUid: room.authUid, participants: room.participants, roomListNames: room.roomListNames, connected: room.connected, listSyncState: room.listSyncState, error: room.roomError, votes: room.votes, spin: room.currentSpin, isHost: room.isHost, preferences: room.preferences })}</pre>
    <GroupScreen isFirebaseConfigured={room.isFirebaseConfigured} firebaseConfigError={room.firebaseConfigError}
      authLoading={room.authLoading} authError={room.authError} authUid={room.authUid}
      displayName={room.displayName} resolvedDisplayName={room.resolvedDisplayName} setDisplayName={room.setDisplayName}
      roomId={room.roomId} hostUid={room.hostUid} roomLink={room.roomLink} isHost={room.isHost} isCohost={room.isCohost}
      cohostUids={room.cohostUids} isBusy={room.isBusy} roomError={room.roomError}
      participants={room.participants} reactions={room.reactions} votes={room.votes}
      canStartRoomSpin={room.roomListNames.length >= 2} onCreateRoom={room.createRoom} onJoinRoom={room.joinRoom}
      onLeaveRoom={room.leaveRoom} onStartRoomSpin={async names => { await room.requestHostSpin(names ?? room.roomListNames); }}
      onSetParticipantCohost={room.setParticipantCohost} onTransferHost={room.transferHost}
      onSendReaction={room.sendReaction} onSetGoingVote={room.setGoingVote} onClearRoomError={room.clearRoomError}
      showCompletedListReminder={false} roomListCount={room.roomListNames.length}
      latestSpin={room.currentSpin ? { spinId: room.currentSpin.spinId, relativeText: 'just now' } : null}
      onOpenList={() => {}} listNames={room.roomListNames} preferences={room.preferences}
      onSetPreference={room.setPreference} connected={room.connected} />
  </>;
}
