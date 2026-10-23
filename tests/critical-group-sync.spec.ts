import { test, expect, type Page } from '@playwright/test';
// Runs only in the dedicated emulator CI job; no production Firebase config or credentials.
test.skip(!process.env.EATSPIN_GROUP_EMULATOR, 'Requires the isolated Firebase rules emulator job');
async function mount(page: Page, uid: string) {
  await page.route('**/src/lib/firebase.ts*', route => route.fulfill({ contentType: 'application/javascript', body: `export * from '/src/test/firebase-emulator-fixture.ts';` }));
  await page.route('http://localhost:5173/?fixture=*', route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div><script type="module">const {default:RefreshRuntime}=await import("/@react-refresh");RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;const {mountGroupRoomFixture}=await import("/src/test/group-room-mount.tsx");mountGroupRoomFixture();</script>' }));
  await page.goto('/?fixture=' + uid);
  await expect.poll(async () => (await state(page)).authUid).toBe(uid);
}
const state = async (page: Page) => JSON.parse(await page.getByTestId('group-state').innerText());
const invoke = async (page: Page, method: string, args: unknown[] = []) => page.evaluate(async ({ method, args }) => {
  const harness = (window as unknown as { groupHarness: Record<string, (...args: unknown[]) => unknown> }).groupHarness;
  return await harness[method](...args);
}, { method, args });

test('real hook merges clients, retries failures, reconnects and scopes votes', async ({ page: host, context }) => {
  const token = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
  const hostUid = 'host' + token; const memberUid = 'member' + token;
  await mount(host, hostUid);
  await invoke(host, 'createRoom');
  const roomId = (await state(host)).roomId;
  expect(roomId).toHaveLength(6);
  await invoke(host, 'syncHostList', [['A', 'B'], []]);
  const member = await context.newPage();
  await mount(member, memberUid);
  await invoke(member, 'joinRoom', [roomId]);
  await expect.poll(async () => (await state(member)).roomListNames).toEqual(['A', 'B']);
  await invoke(host, 'setParticipantCohost', [memberUid, true]);
  // Wait for the permission subscription, without relying on arbitrary sleeps.
  await expect.poll(() => member.evaluate(() => (window as unknown as { groupHarness: { canEditList: boolean } }).groupHarness.canEditList)).toBe(true);
  await Promise.all([invoke(host, 'syncHostList', [['A', 'B', 'C'], ['A', 'B']]), invoke(member, 'syncHostList', [['A', 'B', 'D'], ['A', 'B']])]);
  await expect.poll(async () => (await state(host)).roomListNames.sort()).toEqual(['A', 'B', 'C', 'D']);
  // A stale editor exceeds the limit after another client fills the last slot.
  // The failed operation remains pending and an identical retry succeeds once space is freed.
  const baseline = Array.from({ length: 59 }, (_, i) => `Place ${i}`);
  await invoke(host, 'syncHostList', [baseline, ['A', 'B', 'C', 'D']]);
  await expect.poll(async () => (await state(member)).roomListNames.length).toBe(59);
  await invoke(host, 'syncHostList', [[...baseline, 'Host last'], baseline]);
  await invoke(member, 'syncHostList', [[...baseline, 'Member last'], baseline]);
  await expect.poll(async () => (await state(member)).listSyncState).toBe('error');
  await invoke(host, 'syncHostList', [baseline, [...baseline, 'Host last']]);
  await invoke(member, 'retryRoomList');
  await expect.poll(async () => (await state(member)).listSyncState).toBe('saved');
  await expect.poll(async () => (await state(host)).roomListNames).toContain('Member last');
  await invoke(host, 'syncHostList', [['A', 'B', 'C'], [...baseline, 'Member last']]);
  // Disconnect consumes onDisconnect. Full membership must be restored automatically.
  await invoke(member, 'offline');
  await expect.poll(async () => (await state(member)).connected).toBe(false);
  await expect.poll(async () => (await state(host)).participants.map((p: {uid:string}) => p.uid)).not.toContain(memberUid);
  await invoke(member, 'online');
  await expect.poll(async () => (await state(host)).participants.map((p: {uid:string}) => p.uid)).toContain(memberUid);
  await member.getByText('Choose preferences (optional)', { exact: true }).click();
  await member.getByRole('button', { name: 'Prefer A', exact: true }).click();
  await member.getByRole('button', { name: 'Prefer B', exact: true }).click();
  await member.getByRole('button', { name: 'Avoid C', exact: true }).click();
  await host.getByText('Choose preferences (optional)', { exact: true }).click();
  await expect(host.getByLabel('Spin nominated places only (2)')).toBeVisible();
  await host.getByLabel('Spin nominated places only (2)').check();
  await host.getByRole('button', { name: 'Start spin for everyone', exact: true }).click();
  await expect.poll(async () => (await state(member)).spin?.spinId).toBeTruthy();
  await invoke(member, 'setGoingVote', [true]);
  await expect.poll(async () => (await state(host)).votes.length).toBe(1);
  // Wait for the real cooldown by advancing the previous lock's timestamp in the emulator via host SDK.
  await invoke(host, 'resetCooldown');
  await invoke(host, 'requestHostSpin', [['A', 'B']]);
  await expect.poll(async () => (await state(member)).votes.length).toBe(0);
  await host.getByText('Room settings', { exact: true }).click();
  await host.getByRole('button', { name: 'Transfer host', exact: true }).click();
  await host.getByRole('alertdialog', { name: 'Transfer host?' }).getByRole('button', { name: 'Transfer host', exact: true }).click();
  await expect.poll(async () => (await state(member)).isHost).toBe(true);
  await expect.poll(async () => (await state(host)).isHost).toBe(false);
  await member.getByText('Room settings', { exact: true }).click();
  await member.getByRole('button', { name: 'Leave room', exact: true }).click();
  await member.getByRole('alertdialog', { name: 'Leave without transferring host?' }).getByRole('button', { name: 'Stay in room', exact: true }).click();
  expect((await state(member)).roomId).toBe(roomId);
  expect((await state(member)).isHost).toBe(true);
});

test('in-room rename preserves membership, permissions, preferences and attendance across reconnect', async ({ page: host, context }) => {
  const token = crypto.randomUUID().replaceAll('-', '');
  const hostUid = 'host' + token;
  const memberUid = 'member' + token;
  await mount(host, hostUid);
  await invoke(host, 'createRoom');
  const roomId = (await state(host)).roomId;
  await invoke(host, 'syncHostList', [['A', 'B'], []]);
  const member = await context.newPage();
  await mount(member, memberUid);
  await invoke(member, 'joinRoom', [roomId]);
  await expect.poll(async () => (await state(member)).roomListNames).toEqual(['A', 'B']);
  await invoke(host, 'setParticipantCohost', [memberUid, true]);
  await expect.poll(async () => (await state(member)).isCohost).toBe(true);
  await invoke(member, 'setPreference', ['A', 'prefer']);
  await expect.poll(async () => (await state(host)).preferences[memberUid]).toBeTruthy();
  await invoke(host, 'requestHostSpin', [['A', 'B']]);
  await expect.poll(async () => (await state(member)).spin?.spinId).toBeTruthy();
  await member.getByRole('region', { name: 'Shared result', exact: true })
    .getByRole('button', { name: /^I[’']m in$/ }).click();
  await expect.poll(async () => (await state(host)).votes.length).toBe(1);
  const before = await state(host);
  const joinedAt = before.participants.find((person: {uid:string}) => person.uid === memberUid).joinedAt;
  const votesBefore = before.votes;
  const preferencesBefore = before.preferences;

  await member.getByRole('button', { name: 'Edit name', exact: true }).click();
  await member.getByLabel('Your room name', { exact: true }).fill('  New   Jane  ');
  await member.getByRole('button', { name: 'Save name', exact: true }).click();
  await expect.poll(async () => (await state(host)).participants.find((person: {uid:string}) => person.uid === memberUid)?.name).toBe('New Jane');
  const renamed = await state(member);
  expect(renamed.roomId).toBe(roomId);
  expect(renamed.authUid).toBe(memberUid);
  expect(renamed.isHost).toBe(false);
  expect(renamed.isCohost).toBe(true);
  expect(renamed.participants.find((person: {uid:string}) => person.uid === memberUid).joinedAt).toBe(joinedAt);
  expect(renamed.participants.filter((person: {uid:string}) => person.uid === memberUid)).toHaveLength(1);
  expect(renamed.votes).toEqual(votesBefore);
  expect(renamed.preferences).toEqual(preferencesBefore);

  await invoke(member, 'offline');
  await expect.poll(async () => (await state(member)).connected).toBe(false);
  expect(await invoke(member, 'saveDisplayName', ['Unsaved name'])).toBe(false);
  expect((await state(member)).resolvedDisplayName).toBe('New Jane');
  await expect(member.getByRole('alert')).toContainText('offline');
  await invoke(member, 'online');
  await expect.poll(async () => (await state(host)).participants.find((person: {uid:string}) => person.uid === memberUid)?.name).toBe('New Jane');
  const reconnected = await state(member);
  expect(reconnected.roomId).toBe(roomId);
  expect(reconnected.isCohost).toBe(true);
  expect(reconnected.votes).toEqual(votesBefore);
  expect(reconnected.preferences).toEqual(preferencesBefore);
  expect(reconnected.participants.filter((person: {uid:string}) => person.uid === memberUid)).toHaveLength(1);
});

test('host absence is distinct from local offline and never transfers ownership automatically', async ({ page: host, context }) => {
  // Two genuine host-absence grace periods are intentionally observed.
  test.setTimeout(60_000);
  const token = crypto.randomUUID().replaceAll('-', '');
  const hostUid = 'host' + token;
  const memberUid = 'member' + token;
  await mount(host, hostUid);
  await invoke(host, 'createRoom');
  const roomId = (await state(host)).roomId;
  await invoke(host, 'syncHostList', [['A', 'B'], []]);
  const member = await context.newPage();
  await mount(member, memberUid);
  await invoke(member, 'joinRoom', [roomId]);
  await expect.poll(async () => (await state(member)).participants.length).toBe(2);
  await expect(member.getByText(/Host disconnected/)).toHaveCount(0);

  await invoke(host, 'offline');
  await expect.poll(async () => (await state(member)).participants.map((person: {uid:string}) => person.uid)).not.toContain(hostUid);
  await expect(member.getByText(/Host disconnected—waiting for them to return/)).toBeVisible({ timeout: 15_000 });
  expect((await state(member)).connected).toBe(true);
  expect((await state(member)).hostUid).toBe(hostUid);
  expect((await state(member)).isHost).toBe(false);
  await expect(member.getByRole('button', { name: 'Start spin for everyone', exact: true })).toHaveCount(0);

  await invoke(member, 'offline');
  await expect.poll(async () => (await state(member)).connected).toBe(false);
  await expect(member.getByText('Offline · reconnecting…', { exact: true })).toBeVisible();
  await expect(member.getByText(/Host disconnected—waiting for them to return/)).toHaveCount(0);
  expect((await state(member)).isHost).toBe(false);

  await invoke(host, 'online');
  await invoke(member, 'online');
  await expect.poll(async () => (await state(member)).participants.map((person: {uid:string}) => person.uid)).toContain(hostUid);
  await expect(member.getByText(/Host disconnected—waiting for them to return/)).toHaveCount(0);
  expect((await state(member)).hostUid).toBe(hostUid);
  expect((await state(member)).isHost).toBe(false);
  await invoke(host, 'setParticipantCohost', [memberUid, true]);
  await expect.poll(async () => (await state(member)).isCohost).toBe(true);
  await invoke(host, 'offline');
  await expect(member.getByText(/You can still start a spin as co-host/)).toBeVisible({ timeout: 15_000 });
  await expect(member.getByRole('button', { name: 'Start spin for everyone', exact: true })).toBeEnabled();
  expect((await state(member)).hostUid).toBe(hostUid);
  expect((await state(member)).isHost).toBe(false);
});
