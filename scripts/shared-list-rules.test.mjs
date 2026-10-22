import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { get, ref, set, remove, serverTimestamp } from 'firebase/database';
const env = await initializeTestEnvironment({
  projectId: 'demo-eat-spin-sharing',
  database: { host: '127.0.0.1', port: 9000, rules: readFileSync('docs/firebase-rtdb-rules.json', 'utf8') },
});
try {
  const alice = env.authenticatedContext('alice').database();
  const bob = env.authenticatedContext('bob').database();
  const guest = env.unauthenticatedContext().database();
  const path = 'sharedLists/' + 'a'.repeat(32);
  const valid = { version: 1, name: 'Lunch', mealTime: 'any', places: ['Noodles'],
    ownerUid: 'alice', createdAt: serverTimestamp(), expiresAt: Date.now() + 7 * 86400000 };
  await assertSucceeds(set(ref(alice, path), valid));
  await assertSucceeds(get(ref(bob, path)));
  await assertFails(get(ref(guest, path)));
  await assertFails(get(ref(bob, 'sharedLists')));
  await assertFails(set(ref(alice, path), { ...valid, name: 'Changed' }));
  await assertFails(set(ref(bob, path), { ...valid, ownerUid: 'bob' }));
  await assertFails(remove(ref(bob, path)));
  const next = 'sharedLists/' + 'b'.repeat(32);
  await assertFails(set(ref(alice, next), { ...valid, places: [] }));
  await assertFails(set(ref(alice, next), { ...valid, places: Array(101).fill('Noodles') }));
  await assertFails(set(ref(alice, next), { ...valid, places: ['x'.repeat(121)] }));
  await assertFails(set(ref(alice, next), { ...valid, photos: ['private'] }));
  await assertFails(set(ref(alice, next), { ...valid, expiresAt: Date.now() + 40 * 86400000 }));
  await assertFails(set(ref(alice, 'sharedLists/not-valid'), valid));
  await env.withSecurityRulesDisabled(async (context) => {
    await set(ref(context.database(), next), { ...valid, createdAt: 1, expiresAt: 2 });
  });
  await assertFails(get(ref(bob, next)));
  await assertSucceeds(remove(ref(alice, path)));
  console.log('Shared list rules: valid creation/read, immutability, ownership, expiry and size checks passed.');
} finally { await env.cleanup(); }
