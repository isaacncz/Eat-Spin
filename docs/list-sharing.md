# Fixed list sharing
Publish docs/firebase-rtdb-rules.json to the configured Realtime Database before releasing this feature. Anonymous Firebase Auth must be enabled. This PR does not publish rules automatically.

Share a saved personal list from My list. Create share link uploads an immutable snapshot, then Share with friends or Copy link opens a fresh user gesture (avoiding mobile share activation failures after an upload). A snapshot includes only version, list name, meal time and up to 100 place names (120 characters each). It omits history, user ratings, photos, API keys and coordinates. Recipients save independently generated local place/list IDs. Place details are intentionally not included: shared manual lists are name-based.

Links expire after 7 days. Anyone with the unguessable link can read its snapshot after anonymous authentication; never include sensitive personal information in a list name. The creating anonymous user may revoke a generated link while its share dialog is open. Revocation and expiry do not remove copies already saved by recipients. Old expired records remain in the database until administrative cleanup; rules deny reads after expiry. There is no bulk sharing directory read or ability to edit a snapshot.

A network connection is needed to publish/open/revoke a link; saving an already loaded preview is local. Invalid, expired, revoked, offline and storage-failure states have explicit messages. Import while in a Group room is blocked to protect the room list. Existing saved lists are retained and name collisions get a suffix.

Validation before production: run the full CI suite, test the supplied rules in the Firebase emulator/Rules Playground, verify owner-only revocation and cross-user immutability, and exercise a two-device share/open/import. Rules have been supplied but not deployed or validated against a live project here.
