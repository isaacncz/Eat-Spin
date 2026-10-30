import { chooseSavedList } from './list-picker-helpers';
import { test, expect, type Page } from '@playwright/test';

const mainTab = (page: Page, name: string) => page.getByRole('navigation', { name: 'Main' })
  .getByRole('button', { name: new RegExp(`^${name}`) });
const fixtureState = (page: Page) => page.evaluate(() => (window as unknown as {
  groupAppHarness: { state: { roomId: string; roomListNames: string[]; syncCalls: string[][];
    authUid: string; displayName: string; participants: { uid: string; name: string }[];
    currentSpin: { spinId: string; winnerName: string } | null } };
}).groupAppHarness.state);
const savedSpins = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('eatspin_spins') ?? '[]'));

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('eatspin:first-run-onboarding-seen', '1');
    if (localStorage.getItem('eatspin:manual-base:v2')) return;
    const place = (id: string, name: string) => ({ id, name, category: ['street food'],
      address: 'Your custom pick', coordinates: { lat: 0, lng: 0 }, hours: {}, rating: 0, priceRange: '$$', description: 'Added by you.' });
    localStorage.setItem('eatspin:manual-base:v2', JSON.stringify([
      { id: 'personal-lunch', name: 'Personal lunch', mealTime: null,
        restaurants: [place('manual-private-a', 'Private cafe'), place('manual-private-b', 'Private bakery')], createdAt: 1, updatedAt: 2 },
      { id: 'personal-dinner', name: 'Personal dinner', mealTime: null,
        restaurants: [place('manual-dinner-a', 'Private dinner'), place('manual-dinner-b', 'Private supper')], createdAt: 1, updatedAt: 1 },
    ]));
    localStorage.setItem('eatspin:selected-manual-list-id', 'personal-lunch');
  });
  await page.route('**/src/hooks/useFirebaseGroupRoom.ts*', route => route.fulfill({
    contentType: 'application/javascript', body: "export * from '/src/test/group-app-hook-fixture.ts';",
  }));
  // No live Firebase project or credentials are involved in these App-level tests.
  await page.route('**/src/lib/firebase.ts*', route => route.fulfill({
    contentType: 'application/javascript', body: 'export const firebaseDb=null; export const firebaseAuth=null; export const isFirebaseConfigured=false; export const firebaseConfigError=null; export async function ensureAnonymousAuthUser(){ throw new Error("No live Firebase in UI fixture"); }',
  }));
});

test('the room owns editing and the shared reveal while personal lists stay private', async ({ page }) => {
  // Three real wheel mounts (initial, tab revisit, reload) can each animate.
  test.setTimeout(60_000);
  await page.goto('/?room=ROOM42');
  await expect(mainTab(page, 'Group')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'Group spin', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^I[’']m in$/ })).toHaveCount(0);

  await page.getByLabel('Add a room place', { exact: true }).fill('Room cafe');
  await page.getByRole('button', { name: 'Add to room', exact: true }).click();
  await expect.poll(async () => (await fixtureState(page)).roomListNames).toContain('Room cafe');
  const syncsBeforePersonal = (await fixtureState(page)).syncCalls.length;

  await mainTab(page, 'My list').click();
  await expect(page.getByRole('button', { name: 'Remove Private cafe', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove Room cafe', exact: true })).toHaveCount(0);
  await chooseSavedList(page, 'Personal dinner');
  await page.getByLabel('Add a place', { exact: true }).fill('Only mine');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove Only mine', exact: true })).toBeVisible();
  expect((await fixtureState(page)).syncCalls).toHaveLength(syncsBeforePersonal);
  expect((await fixtureState(page)).roomListNames).toEqual(['Room noodles', 'Room rice', 'Room cafe']);

  await mainTab(page, 'Group').click();
  await page.getByRole('button', { name: 'Start spin for everyone', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Let fate decide.' })).toBeVisible();
  // The selected tab stays Group while the modal hides background controls from AT.
  await expect(page.locator('nav[aria-label="Main"]').getByRole('button', {
    name: /^Group/, includeHidden: true,
  })).toHaveAttribute('aria-current', 'page');
  const startToast = page.locator('[data-sonner-toast]').filter({ hasText: 'Room spin started' });
  await expect(startToast).toBeVisible();
  await expect(startToast).not.toContainText('Room noodles');
  await expect(page.getByRole('region', { name: 'Shared result', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^I[’']m in$/ })).toHaveCount(0);
  const result = page.getByRole('region', { name: 'Shared result', exact: true });
  await expect(result).toBeVisible({ timeout: 20_000 });
  await expect(result).toContainText('Room noodles');
  await expect(page.getByRole('dialog', { name: 'You got it!' })).toHaveCount(0);
  await result.getByRole('button', { name: /^I[’']m in$/ }).click();
  await expect(result).toContainText('Isaac');
  await expect(result).toContainText('Jane');
  await expect(result).toContainText('Alex');
  expect(await savedSpins(page)).toHaveLength(1);

  await mainTab(page, 'Me').click();
  await mainTab(page, 'Group').click();
  await expect(result).toBeVisible({ timeout: 20_000 });
  expect(await savedSpins(page)).toHaveLength(1);
  await page.reload();
  await expect(result).toBeVisible({ timeout: 20_000 });
  expect(await savedSpins(page)).toHaveLength(1);
  expect((await fixtureState(page)).roomId).toBe('ROOM42');
});

test('an older committed result opens directly and attendance excludes departed guests', async ({ page }) => {
  await page.goto('/?room=ROOM42');
  await expect(page.getByRole('button', { name: 'Start spin for everyone', exact: true })).toBeVisible();
  await page.evaluate(() => {
    const harness = (window as unknown as { groupAppHarness: {
      setRemoteSpin: (spin: unknown) => void; setVotes: (votes: unknown[]) => void;
    } }).groupAppHarness;
    harness.setRemoteSpin({ spinId: 'older-room-spin', winnerIndex: 0, winnerName: 'Room noodles',
      startedAt: Date.now() - 300_000, completedAt: Date.now() - 293_000, startedBy: 'host' });
    harness.setVotes([
      { spinId: 'older-room-spin', uid: 'member', name: 'Jane', going: true, updatedAt: Date.now() },
      { spinId: 'older-room-spin', uid: 'departed', name: 'Departed guest', going: true, updatedAt: Date.now() },
      { spinId: 'different-spin', uid: 'pending', name: 'Alex', going: true, updatedAt: Date.now() },
    ]);
  });
  const result = page.getByRole('region', { name: 'Shared result', exact: true });
  await expect(result).toBeVisible({ timeout: 5_000 });
  await expect(result).toContainText('Room noodles');
  await expect(result).toContainText('1/3 going');
  await expect(result).not.toContainText('Departed guest');
  await expect(result).toContainText('Alex');
  expect(await savedSpins(page)).toHaveLength(1);
});

test('a participant can edit their room name without gaining host controls or leaving', async ({ page }) => {
  await page.goto('/?room=ROOM42&fixtureRole=member');
  await page.getByRole('button', { name: 'Edit name', exact: true }).click();
  await page.getByLabel('Your room name', { exact: true }).fill('  New   Jane  ');
  await page.getByRole('button', { name: 'Save name', exact: true }).click();
  await expect.poll(async () => (await fixtureState(page)).displayName).toBe('New Jane');
  expect((await fixtureState(page)).authUid).toBe('member');
  expect((await fixtureState(page)).roomId).toBe('ROOM42');
  await expect(page.getByRole('button', { name: 'Start spin for everyone', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Add a room place', { exact: true })).toHaveCount(0);
});

test('spinning a personal list during a room records a personal result without publishing or starting a room spin', async ({ page }) => {
  await page.goto('/?room=ROOM42');
  await expect(mainTab(page, 'Group')).toHaveAttribute('aria-current', 'page');
  await mainTab(page, 'My list').click();
  await page.getByRole('button', { name: 'Spin this list', exact: true }).click();
  await page.getByRole('button', { name: /spin the wheel/i }).click();
  const result = page.getByRole('dialog', { name: 'You got it!' });
  await expect(result).toBeVisible({ timeout: 20_000 });
  await expect(result).toContainText(/Private cafe|Private bakery/);
  expect(await savedSpins(page)).toHaveLength(1);
  expect((await fixtureState(page)).currentSpin).toBeNull();
  expect((await fixtureState(page)).syncCalls).toHaveLength(0);
  expect((await fixtureState(page)).roomListNames).toEqual(['Room noodles', 'Room rice']);
});

test('a saved-list preview is private until explicit replacement is confirmed', async ({ page }) => {
  await page.goto('/?room=ROOM42');
  await page.getByText('Load a saved list', { exact: true }).click();
  await page.getByLabel('Saved list', { exact: true }).selectOption('personal-dinner');
  await expect(page.getByRole('region', { name: 'Room places', exact: true })).toContainText('Personal dinner has 2 places');
  expect((await fixtureState(page)).syncCalls).toHaveLength(0);
  expect((await fixtureState(page)).roomListNames).toEqual(['Room noodles', 'Room rice']);
  const personalBefore = await page.evaluate(() => localStorage.getItem('eatspin:manual-lists'));

  await page.getByRole('button', { name: 'Use this list in room', exact: true }).click();
  const confirmation = page.getByRole('alertdialog', { name: 'Replace room places?', exact: true });
  await expect(confirmation).toContainText('Personal dinner');
  expect((await fixtureState(page)).syncCalls).toHaveLength(0);
  await confirmation.getByRole('button', { name: 'Keep room places', exact: true }).click();
  await expect(confirmation).toHaveCount(0);
  expect((await fixtureState(page)).roomListNames).toEqual(['Room noodles', 'Room rice']);

  await page.getByRole('button', { name: 'Use this list in room', exact: true }).click();
  await confirmation.getByRole('button', { name: 'Use this list in room', exact: true }).click();
  await expect.poll(async () => (await fixtureState(page)).roomListNames).toEqual(['Private dinner', 'Private supper']);
  expect((await fixtureState(page)).syncCalls).toEqual([['Private dinner', 'Private supper']]);
  expect(await page.evaluate(() => localStorage.getItem('eatspin:manual-lists'))).toBe(personalBefore);
});

test('creating a room starts empty and does not publish an existing personal list', async ({ page }) => {
  await page.goto('/');
  await mainTab(page, 'Group').click();
  await page.getByRole('button', { name: 'Create room link', exact: true }).click();
  await expect(page.getByTestId('room-code')).toHaveText('ROOM42');
  await expect(page.getByRole('region', { name: 'Room places', exact: true })).toContainText('Add at least 2 places');
  expect((await fixtureState(page)).roomListNames).toEqual([]);
  expect((await fixtureState(page)).syncCalls).toHaveLength(0);
  await mainTab(page, 'My list').click();
  await expect(page.getByRole('button', { name: 'Remove Private cafe', exact: true })).toBeVisible();
});

test('a reduced-motion group spin reveals immediately and never leaves a spinning state or duplicate history', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?room=ROOM42');
  await page.getByRole('button', { name: 'Start spin for everyone', exact: true }).click();
  const result = page.getByRole('region', { name: 'Shared result', exact: true });
  await expect(result).toContainText('Room noodles', { timeout: 5_000 });
  await expect(page.getByRole('dialog', { name: 'You got it!' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Spinning…', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start another spin', exact: true })).toBeEnabled();
  expect(await savedSpins(page)).toHaveLength(1);
  await mainTab(page, 'Me').click();
  await mainTab(page, 'Group').click();
  await expect(result).toContainText('Room noodles', { timeout: 5_000 });
  await page.reload();
  await expect(result).toContainText('Room noodles', { timeout: 5_000 });
  await expect(page.getByRole('button', { name: 'Start another spin', exact: true })).toBeEnabled();
  expect(await savedSpins(page)).toHaveLength(1);
});
