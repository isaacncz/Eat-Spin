import { get, ref, remove, serverTimestamp, set } from 'firebase/database';
import { ensureAnonymousAuthUser, firebaseDb } from '@/lib/firebase';
import { isSharedListId, parseSharedList, type SharedListSnapshot } from '@/lib/sharedLists';
function database() {
  if (!firebaseDb) throw new Error('List sharing is unavailable: Firebase is not configured.');
  if (!navigator.onLine) throw new Error('Connect to the internet to open or share a list.');
  return firebaseDb;
}
export async function publishSharedList(snapshot: SharedListSnapshot): Promise<{ id: string; url: string }> {
  const db = database();
  const user = await ensureAnonymousAuthUser();
  const data = parseSharedList(snapshot);
  const id = crypto.randomUUID().replaceAll('-', '');
  await set(ref(db, `sharedLists/${id}`), {
    ...data, mealTime: data.mealTime ?? 'any', createdAt: serverTimestamp(), ownerUid: user.uid,
  });
  const url = new URL(window.location.origin);
  url.searchParams.set('list', id);
  return { id, url: url.toString() };
}
export async function fetchSharedList(id: string): Promise<SharedListSnapshot> {
  if (!isSharedListId(id)) throw new Error('This share link is invalid.');
  const db = database();
  await ensureAnonymousAuthUser();
  try {
    const snapshot = await get(ref(db, `sharedLists/${id}`));
    if (!snapshot.exists()) throw new Error('missing');
    return parseSharedList(snapshot.val());
  } catch {
    throw new Error('This list is unavailable, expired, or revoked. Ask your friend for a new link.');
  }
}
export async function revokeSharedList(id: string): Promise<void> {
  if (!isSharedListId(id)) throw new Error('Invalid share link.');
  const db = database();
  await ensureAnonymousAuthUser();
  await remove(ref(db, `sharedLists/${id}`));
}
