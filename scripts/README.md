# Scripts

## Firebase expired room cleanup

This script deletes expired group-spin rooms from Firebase Realtime Database.

- Script: `scripts/cleanup-firebase-rooms.mjs`
- Default DB path: `rooms`
- Expiry field used: `meta/expiresAt` (Unix timestamp in milliseconds)

### 1) Prepare Firebase credentials

Use one of these options:

1. `FIREBASE_SERVICE_ACCOUNT_PATH` (recommended): path to your service account JSON file.
2. `FIREBASE_SERVICE_ACCOUNT_JSON`: service account JSON as a single env var string.
3. Application default credentials (`GOOGLE_APPLICATION_CREDENTIALS`).

Create service account key in Firebase Console:

- `Project settings` -> `Service accounts` -> `Generate new private key`

Do not commit this file to git.

### 2) Required environment variables

- `FIREBASE_DATABASE_URL` (required)

Optional:

- `FIREBASE_ROOMS_PATH` (defaults to `rooms`)
- `FIREBASE_SERVICE_ACCOUNT_PATH`
- `FIREBASE_SERVICE_ACCOUNT_JSON`

PowerShell example:

```powershell
$env:FIREBASE_DATABASE_URL="https://<project-id>-default-rtdb.asia-southeast1.firebasedatabase.app"
$env:FIREBASE_SERVICE_ACCOUNT_PATH="C:\secrets\firebase-service-account.json"
```

### 3) Run manually

From project root:

```bash
node scripts/cleanup-firebase-rooms.mjs --dry-run
node scripts/cleanup-firebase-rooms.mjs
```

When you are ready to use this script, install `firebase-admin` first:

```bash
npm install firebase-admin
```

### 4) Schedule it every 10 minutes

Linux/macOS cron:

```cron
*/10 * * * * /usr/bin/node /path/to/repo/scripts/cleanup-firebase-rooms.mjs >> /path/to/repo/scripts/cleanup.log 2>&1
```

Windows Task Scheduler:

- Trigger: every 10 minutes
- Program/script: `node`
- Arguments: `scripts/cleanup-firebase-rooms.mjs`
- Start in: your repo root path

### Notes

- This script only cleans up expired Group rooms. It does not delete expired `sharedLists` snapshots.
- A room TTL and client expiry handling do not by themselves enforce server-side access expiry. The current supplied room rules do not gate every read/write on `meta/expiresAt`; review expiry authorization separately before relying on it.
- Shared-list read expiry is a separate rule. Access expiry does not automatically remove stored records or recipients' saved copies.
