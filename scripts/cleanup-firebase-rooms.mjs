import fs from 'node:fs';
import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

const ROOM_ROOT_PATH = process.env.FIREBASE_ROOMS_PATH || 'rooms';
const databaseURL = process.env.FIREBASE_DATABASE_URL;
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const dryRun = process.argv.includes('--dry-run');

if (!databaseURL) {
  throw new Error('Missing FIREBASE_DATABASE_URL');
}

const getCredential = () => {
  if (serviceAccountJson) {
    return cert(JSON.parse(serviceAccountJson));
  }

  if (serviceAccountPath) {
    const raw = fs.readFileSync(serviceAccountPath, 'utf8');
    return cert(JSON.parse(raw));
  }

  return applicationDefault();
};

if (!getApps().length) {
  initializeApp({
    credential: getCredential(),
    databaseURL,
  });
}

const db = getDatabase();
const now = Date.now();

const roomsRef = db.ref(ROOM_ROOT_PATH);
const expiredSnapshot = await roomsRef.orderByChild('meta/expiresAt').endAt(now).get();

if (!expiredSnapshot.exists()) {
  console.log(`No expired rooms found in "${ROOM_ROOT_PATH}".`);
  process.exit(0);
}

const updates = {};
const expiredRoomIds = [];

expiredSnapshot.forEach((child) => {
  const roomId = child.key;
  const expiresAt = child.child('meta/expiresAt').val();

  if (!roomId || typeof expiresAt !== 'number' || expiresAt > now) {
    return;
  }

  updates[roomId] = null;
  expiredRoomIds.push(roomId);
});

if (expiredRoomIds.length === 0) {
  console.log(`No expired rooms qualified for cleanup in "${ROOM_ROOT_PATH}".`);
  process.exit(0);
}

if (dryRun) {
  console.log(`[DRY RUN] ${expiredRoomIds.length} room(s) would be deleted from "${ROOM_ROOT_PATH}":`);
  for (const roomId of expiredRoomIds) {
    console.log(`- ${roomId}`);
  }
  process.exit(0);
}

await roomsRef.update(updates);
console.log(`Deleted ${expiredRoomIds.length} expired room(s) from "${ROOM_ROOT_PATH}".`);
