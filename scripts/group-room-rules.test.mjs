import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { get, ref, set, update, remove, runTransaction } from 'firebase/database';
import { roomListDelta } from '../src/lib/listOperations.ts';
const env = await initializeTestEnvironment({ projectId: 'demo-eat-spin-sharing', database: { host: '127.0.0.1', port: 9000, rules: readFileSync('docs/firebase-rtdb-rules.json', 'utf8') } });
try {
  const host = env.authenticatedContext('host').database();
  const cohost = env.authenticatedContext('cohost').database();
  const member = env.authenticatedContext('member').database();
  const outsider = env.authenticatedContext('outsider').database();
  const room = 'rooms/RULES1';
  const now = Date.now();
  const presence = { name: 'User', joinedAt: now, lastSeenAt: now, ready: true };
  const meta = { hostUid: 'host', status: 'waiting', createdAt: now, expiresAt: now + 7200000, lastSpinAt: 0 };
  await assertSucceeds(set(ref(host, room + '/meta'), meta));
  for (const [uid, db] of [['host', host], ['cohost', cohost], ['member', member]]) await assertSucceeds(set(ref(db, room + '/participants/' + uid), presence));
  await assertSucceeds(set(ref(host, room + '/cohosts/cohost'), true));
  const seed = roomListDelta(null, [], ['A', 'B'], 'host', 'seed', now);
  await assertSucceeds(set(ref(host, room + '/list'), seed));
  await Promise.all([
    assertSucceeds(runTransaction(ref(host, room + '/list'), raw => roomListDelta(raw, ['A', 'B'], ['A', 'B', 'C'], 'host', 'op1', now))),
    assertSucceeds(runTransaction(ref(cohost, room + '/list'), raw => roomListDelta(raw, ['A', 'B'], ['A', 'B', 'D'], 'cohost', 'op2', now))),
  ]);
  assert.deepEqual(Object.values((await get(ref(host, room + '/list'))).val()).map(item => item.name).sort(), ['A', 'B', 'C', 'D']);
  await assertFails(set(ref(member, room + '/list/evil'), { name: 'Evil', order: 0, createdAt: now, createdBy: 'member' }));
  await assertFails(set(ref(host, room + '/list/bad'), { name: 'x'.repeat(25), order: 0, createdAt: now, createdBy: 'host' }));
  await assertSucceeds(remove(ref(member, room + '/participants/member')));
  await assertFails(update(ref(member, room + '/participants/member'), { name: 'User', lastSeenAt: now, ready: true }));
  await assertSucceeds(set(ref(member, room + '/participants/member'), presence));
  const spin = { spinId: 'spin-a', winnerIndex: 0, winnerName: 'A', startedAt: now, completedAt: now + 5000, startedBy: 'host' };
  await assertSucceeds(set(ref(host, room + '/spin'), spin));
  const vote = { spinId: 'spin-a', name: 'User', going: true, updatedAt: now };
  await assertSucceeds(set(ref(member, room + '/votes/member'), vote));
  await assertFails(set(ref(outsider, room + '/votes/outsider'), vote));
  await assertFails(set(ref(cohost, room + '/votes/member'), vote));
  await assertSucceeds(set(ref(host, room + '/spin'), { ...spin, spinId: 'spin-b' }));
  await assertFails(set(ref(member, room + '/votes/member'), vote));
  await assertSucceeds(set(ref(member, room + '/votes/member'), { ...vote, spinId: 'spin-b' }));
  await assertSucceeds(set(ref(member, room + '/preferences/member/61'), 'prefer'));
  await assertFails(set(ref(host, room + '/preferences/member/61'), 'avoid'));
  await assertFails(set(ref(outsider, room + '/preferences/outsider/61'), 'prefer'));
  await assertFails(set(ref(member, room + '/preferences/member/62'), 'veto'));
  await assertFails(update(ref(cohost, room + '/meta'), { hostUid: 'cohost' }));
  // Validation rules are skipped on deletes: deny delete/recreate takeover at .write too.
  await assertFails(remove(ref(cohost, room + '/meta')));
  await assertFails(set(ref(cohost, room + '/meta'), { ...meta, hostUid: 'cohost' }));
  await assertFails(update(ref(host, room + '/meta'), { hostUid: 'outsider' }));
  await assertSucceeds(update(ref(host, room + '/meta'), { hostUid: 'member' }));
  await assertFails(set(ref(host, room + '/cohosts/host'), true));
  await assertSucceeds(set(ref(member, room + '/cohosts/host'), true));
  console.log('Group rules: concurrent edits, complete presence, spin-scoped votes, own preferences and authorized host transfer passed.');
} finally { await env.cleanup(); }
