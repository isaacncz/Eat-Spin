# My list and Group Spin rollout (#104–#113)

One PR contains the fixes and enhancements. Required CI includes the full unit suite, critical browser regressions, and shared-list/group Firebase emulator checks. No production Firebase data is used by tests.

## Personal lists

The first v2 load freezes a migration base at `eatspin:manual-base:v2`. Existing IDs, names, meal times, places and selected-list preference are retained. Each later mutation writes a uniquely keyed `eatspin:manual-op:*` record. Replaying operations deterministically merges concurrent additions and field changes; a stale patch cannot recreate a deleted list. Storage events refresh other tabs. The original `eatspin:manual-lists` key is a compatibility snapshot, not an authoritative write source after migration. Legacy preset/restaurant keys remain intact.

Failed writes show a retry action and block further edits until the pending operation is resolved. List records are local to this browser profile; the UI says “Saved on this device”, not cloud-synced. The operation journal is retained rather than compacted unsafely while other tabs may be writing. Storage exhaustion is reported; versioned JSON export provides a portable backup.

Undo lasts eight seconds. Item undo restores only removed items and preserves unrelated edits. Deleted-list undo creates a new independent copy. Duplicate and restore generate fresh list/item IDs. Restore previews the validated file and adds all copies through one atomic journal write. Limits: 2 MB per backup, 100 lists per file. Existing lists remain saved.

## Group rooms

Room-list writes apply a delta inside a Firebase transaction. Existing item keys survive; concurrent additions are retained, and removing/clearing an editor's baseline does not delete unseen additions. Failed operations remain pending until acknowledged. Pending operations are scoped to the current room session; this is an in-memory queue, not durable offline storage across reloads. New rooms start empty. A host or co-host can explicitly load a saved personal list inside Group, with confirmation before replacing existing room places. Browsing, selecting, editing or importing personal lists does not publish their contents to the room.

Reconnection registers onDisconnect again and restores the complete participant schema, including joinedAt. Heartbeat failures are surfaced. Attendance votes carry the spinId; the UI ignores previous-spin and legacy unscoped votes, and rules reject a vote for a different current spin.

Host transfer is explicit, confirmed and transactional. Only the current host may transfer to an active participant; co-hosts cannot promote themselves. There is no automatic takeover when a host disconnects. Existing co-host assignments remain unchanged by transfer.

Preferences are advisory prefer/avoid nominations, scoped to the room and participant. Only active participants' preferences count. Hosts/co-hosts may opt in to spin nominated places only; at least two nominees are required. Avoid is not a veto; ties have no ranking effect. Turning the filter off spins the full room list. Preferences persist for the room and are distinct from post-result attendance votes.

## Group workspace and local-only delivery (#115–119)

Group contains the room places, optional preferences, shared wheel and revealed result. My list stays personal while a room is active; personal spins remain independent and are recorded normally. Room editing is disabled during the reveal and room spinning waits for connectivity and acknowledged list saves. The room exposes preparation, spinning and finished stages; the winner and spin-scoped attendance appear together only after local reveal. Recent results animate on replay, older results open directly, and reduced-motion users get a direct reveal. Unique group events are still counted once across replay/reload. Start feedback never includes the winner name.

The room list loader is expanded for an empty room and tucked behind Load a saved list for a populated room. Selection previews a personal list without publishing it. Room-name limits (24 characters per place) and the existing 60-place cap are checked before accepting additions or explicit list loading; overlong names are rejected rather than silently truncated by this UI. Room removal/clear retain Undo; saving a room copy creates an independent personal list without leaving the room.

Guests can choose or edit their name in the room. Names are normalized and only reported as saved after server acknowledgement; the participant UID, joinedAt, role, preferences and existing votes stay unchanged. Offline-before-submit is rejected. A connection loss during submission keeps the operation pending until acknowledgement/rejection, rather than falsely reporting failure for a write that may still commit. Complete presence is refreshed after a successful save, including same-name saves.

Host presence is distinct from the viewer's own connection. Existing heartbeats become stale after 45 seconds; a missing host record has a 10-second grace period before the disconnected notice. Co-hosts retain existing authority; no participant is automatically promoted. Ready/Idle labels are not used as a substitute for a real readiness vote.

Implement this batch in local commits with local typecheck, build, unit, critical browser and Firebase emulator checks. Do not push intermediate work or trigger Netlify during development. The user requests the eventual batch push/preview. Keep required CI intact. No Firebase schema/rules changes or live rules publication are required by this batch.

## Firebase deployment

`docs/firebase-rtdb-rules.json` includes the rules for host transfer, complete presence, room item validation, spin-scoped votes and each participant's own preferences. Existing sharing/challenge/usage rules are preserved. Deploying these rules is a separate owner action; this PR does not publish rules or write production data.

Publish the reviewed rules before or alongside releasing the client. Existing old-client votes without spinId will be rejected by the stricter rules; participants should refresh the app. Rooms are short-lived; use a fresh room for rollout acceptance. The client transaction enforces the 60-item room limit; RTDB rules enforce item schemas and authorization, not a dynamic collection child count.

Validation scenarios: two-tab additions/reload, undo with a remote addition, independent duplication, backup preview/restore and failed local save retry; real two-client room additions, identical retry after a rejected edit, disconnect/reconnect, advisory nominations, next-spin attendance isolation and ownership transfer; unauthorized rule writes rejected. Shared snapshots remain immutable independent copies.

## List tools and confirmations

The list page keeps a compact device-save status and List tools button. Duplicate, export and restore live in a branded bottom sheet (centered dialog on desktop). Export starts with only the current list selected; checkboxes allow other explicit choices. Restore uses a styled Choose file action, the device's native file picker, a validated file preview and per-list checkboxes. Only checked lists are restored through one atomic journal operation. Closing a sheet cancels pending file reads and returns focus to its opener.

Sharing first asks which single list to share, then previews its places before creating a link. Other saved lists remain private; shared snapshot format and Firebase rules are unchanged by the picker. Delete, clear, host transfer and leaving as host use accessible in-app confirmation dialogs with explicit cancel/accept labels. Simple item removal keeps Undo. Cancelling changes nothing and returns keyboard focus to the opener.
