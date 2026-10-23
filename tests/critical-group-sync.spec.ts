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
  await member.getByRole('button', { name: 'Prefer A', exact: true }).click();
  await member.getByRole('button', { name: 'Prefer B', exact: true }).click();
  await member.getByRole('button', { name: 'Avoid C', exact: true }).click();
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
  host.once('dialog', dialog => dialog.accept());
  await host.getByRole('button', { name: 'Transfer host', exact: true }).click();
  await expect.poll(async () => (await state(member)).isHost).toBe(true);
  await expect.poll(async () => (await state(host)).isHost).toBe(false);
});
