import { test, expect, type Page } from '@playwright/test';

async function setup(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('eatspin:first-run-onboarding-seen', '1');
    localStorage.removeItem('eatspin:test-group-workspace');
  });
  await page.route('**/src/hooks/useFirebaseGroupRoom.ts*', route => route.fulfill({
    contentType: 'application/javascript', body: "export * from '/src/test/group-app-hook-fixture.ts';",
  }));
  // No live Firebase project or credentials are involved in these App-level tests.
  await page.route('**/src/lib/firebase.ts*', route => route.fulfill({
    contentType: 'application/javascript', body: 'export const firebaseDb=null; export const firebaseAuth=null; export const isFirebaseConfigured=false; export const firebaseConfigError=null; export async function ensureAnonymousAuthUser(){ throw new Error("No live Firebase in UI fixture"); }',
  }));
}

const noHorizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe('at 360px', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('host sees progress steps, live people and the wheel before the places', async ({ page }) => {
    await setup(page);
    await page.goto('/?room=ROOM42');
    const progress = page.getByRole('region', { name: 'Room progress' });
    await expect(progress.getByRole('listitem')).toHaveText([/1 Places.*done/, /2 Invite.*done/, /^3 Spin$/]);
    await expect(progress.locator('[aria-current="step"]')).toHaveText('3 Spin');
    await expect(progress).toContainText('Ready — start the spin for everyone.');

    const people = page.getByRole('list', { name: 'People in the room' });
    await expect(people.getByRole('listitem').first()).toContainText('Isaac');
    await expect(people.getByRole('listitem').first()).toContainText('Host');
    await expect(people.getByRole('button', { name: 'Invite more people' })).toBeVisible();
    await expect(page.getByTestId('room-code')).toHaveText('ROOM42');

    // The shared wheel comes before the room places so it is near the pinned spin button.
    const wheelTop = await page.getByText('Shared wheel', { exact: true }).boundingBox();
    const placesTop = await page.getByText(/^Room places · 2$/).boundingBox();
    expect(wheelTop!.y).toBeLessThan(placesTop!.y);
    await expect(page.locator('[data-wheel-hub-lock]')).toHaveCount(0);
    expect(await noHorizontalOverflow(page)).toBe(true);
  });

  test('a participant who goes stale is shown as away', async ({ page }) => {
    await setup(page);
    await page.goto('/?room=ROOM42');
    await page.evaluate(() => {
      const harness = (window as unknown as { groupAppHarness: { state: { participants: { uid: string; lastSeenAt: number }[] }; setParticipants: (p: unknown[]) => void } }).groupAppHarness;
      harness.setParticipants(harness.state.participants.map(p => p.uid === 'pending' ? { ...p, lastSeenAt: Date.now() - 10 * 60_000 } : p));
    });
    await expect(page.getByRole('list', { name: 'People in the room' }).getByRole('listitem').nth(2)).toContainText('Away');
  });

  test('member sees a locked hub, their own steps and no edit controls', async ({ page }) => {
    await setup(page);
    await page.goto('/?room=ROOM42&fixtureRole=member');
    await expect(page.locator('[data-wheel-hub-lock]')).toBeVisible();
    await expect(page.getByText('The host spins. You’ll see it live.')).toBeVisible();
    const progress = page.getByRole('region', { name: 'Room progress' });
    await expect(progress.locator('[aria-current="step"]')).toHaveText('2 Your picks');
    await expect(page.getByRole('button', { name: /^Add places/ })).toHaveCount(0);
    expect(await noHorizontalOverflow(page)).toBe(true);
  });
});

test('the Add places sheet groups the three ways to add and restores focus on close', async ({ page }) => {
  await setup(page);
  await page.goto('/?room=ROOM42');
  const trigger = page.getByRole('button', { name: /^Add places/ });
  await trigger.click();
  const sheet = page.getByRole('dialog', { name: 'Add places' });
  await expect(sheet.getByRole('tab')).toHaveText(['Nearby', 'Saved list', 'Type a name']);
  await sheet.getByRole('tab', { name: 'Type a name' }).click();
  await sheet.getByLabel('Add a room place', { exact: true }).fill('Chip cafe');
  await sheet.getByLabel('Add a room place', { exact: true }).press('Enter');
  await expect(sheet).toContainText('3 places in the room so far.');
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Places in this room' })).toContainText('Chip cafe');
  await expect(trigger).toBeFocused();

  await page.getByRole('button', { name: 'More room place actions' }).click();
  await expect(page.getByRole('menuitem', { name: 'Save a personal copy' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Clear room places' })).toBeVisible();
});
