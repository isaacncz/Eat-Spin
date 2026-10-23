import { test, expect } from '@playwright/test';
const id = 'a'.repeat(32);
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('eatspin:first-run-onboarding-seen', '1');
    const restaurant = { id: 'manual-old', name: 'Original place', category: ['street food'], address: 'Your custom pick',
      coordinates: { lat: 0, lng: 0 }, hours: {}, rating: 0, priceRange: '$$', description: 'Added by you.' };
    localStorage.setItem('eatspin:manual-lists', JSON.stringify([
      { id: 'existing', name: 'Existing list', mealTime: null, restaurants: [restaurant], createdAt: 1, updatedAt: 1 },
    ]));
    localStorage.setItem('eatspin:selected-manual-list-id', 'existing');
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
  });
  await page.route('**/src/lib/sharedListsApi.ts*', async (route) => {
    await route.fulfill({ contentType: 'application/javascript', body: `
      export async function fetchSharedList(id) {
        if (id !== '${id}') throw new Error('This list is unavailable, expired, or revoked.');
        return { version: 1, name: 'Friend picks', mealTime: 'lunch', places: ['Friend noodles', 'Friend rice'], createdAt: Date.now(), expiresAt: Date.now() + 86400000 };
      }
      export async function publishSharedList(snapshot) {
        window.__publishedSnapshot = snapshot;
        return { id: '${id}', url: location.origin + '/?list=${id}' };
      }
      export async function revokeSharedList() { window.__linkRevoked = true; }
    ` });
  });
});
test('preview and import preserve existing lists and create independent IDs', async ({ page }) => {
  await page.goto('/?list=' + id);
  const dialog = page.getByRole('dialog', { name: 'A list from your friend' });
  await expect(dialog).toContainText('Friend noodles');
  await dialog.getByRole('button', { name: 'Save a personal copy', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const lists = await page.evaluate(() => JSON.parse(localStorage.getItem('eatspin:manual-lists')!));
  expect(lists).toHaveLength(2);
  expect(lists.find((list: { id: string }) => list.id === 'existing').restaurants[0].name).toBe('Original place');
  const imported = lists.find((list: { id: string }) => list.id !== 'existing');
  expect(imported.name).toBe('Friend picks');
  expect(imported.restaurants.map((place: { name: string }) => place.name)).toEqual(['Friend noodles', 'Friend rice']);
  expect(new Set(imported.restaurants.map((place: { id: string }) => place.id)).size).toBe(2);
  expect(new URL(page.url()).searchParams.has('list')).toBe(false);
});
test('save and open wheel displays the imported picks', async ({ page }) => {
  await page.goto('/?list=' + id);
  await page.getByRole('button', { name: 'Save copy & open wheel' }).click();
  await expect(page.getByRole('heading', { name: 'Spin your list' })).toBeVisible();
  await expect(page.getByRole('button', { name: /spin the wheel/i })).toBeVisible();
});
test('unavailable links show an error without modifying local lists', async ({ page }) => {
  await page.goto('/?list=unavailable');
  await expect(page.getByRole('alert')).toContainText('unavailable');
  await expect(page.getByRole('button', { name: 'Save a personal copy' })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('eatspin:manual-lists')!).length)).toBe(1);
});
test('sender can prepare, copy and revoke a fixed link', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /^My list/i }).click();
  await page.getByRole('button', { name: 'Share this list' }).click();
  await page.getByRole('button', { name: 'Preview list', exact: true }).click();
  await page.getByRole('button', { name: 'Create share link' }).click();
  await expect(page.getByLabel('Share link', { exact: true })).toHaveValue(new RegExp('list=' + id));
  await page.getByRole('button', { name: 'Copy link', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Link copied.');
  await page.getByRole('button', { name: 'Revoke link' }).click();
  await expect(page.getByRole('status')).toContainText('Link revoked.');
});


test('sender chooses exactly which saved list is shared', async ({ page }) => {
  await page.addInitScript(() => {
    const list = (id: string, name: string, place: string) => ({ id, name, mealTime: null, createdAt: 1, updatedAt: 1, restaurants: [{ id: 'manual-' + id, name: place, category: ['street food'], address: 'Your custom pick', coordinates: { lat: 0, lng: 0 }, hours: {}, rating: 0, priceRange: '$$', description: 'Added by you.' }] });
    localStorage.setItem('eatspin:manual-base:v2', JSON.stringify([list('lunch', 'Lunch picks', 'Lunch cafe'), list('dinner', 'Dinner picks', 'Dinner cafe')]));
    localStorage.setItem('eatspin:selected-manual-list-id', 'lunch');
  });
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /^My list/i }).click();
  await page.getByRole('button', { name: 'Share this list' }).click();
  await expect(page.getByRole('radio', { name: /Lunch picks/ })).toBeChecked();
  await page.getByRole('radio', { name: /Dinner picks/ }).check();
  await page.getByRole('button', { name: 'Preview list', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Share this list', exact: true });
  await expect(dialog).toContainText('Dinner cafe');
  await expect(dialog).not.toContainText('Lunch cafe');
  await dialog.getByRole('button', { name: 'Choose another list', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Share this list', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Share this list', exact: true }).click();
  await page.getByRole('radio', { name: /Dinner picks/ }).check();
  await page.getByRole('button', { name: 'Preview list', exact: true }).click();
  await dialog.getByRole('button', { name: 'Create share link' }).click();
  const snapshot = await page.evaluate(() => (window as unknown as { __publishedSnapshot: { name: string; places: string[] } }).__publishedSnapshot);
  expect(snapshot.name).toBe('Dinner picks');
  expect(snapshot.places).toEqual(['Dinner cafe']);
});
