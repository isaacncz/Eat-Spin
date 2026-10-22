import { test, expect, type Page } from '@playwright/test';

const MANUAL_LISTS_KEY = 'eatspin:manual-lists';

const seedPlace = (name: string, index: number) => ({
  id: `manual-seed-${index}`,
  name,
  category: ['street food'],
  address: 'Your custom pick',
  coordinates: { lat: 0, lng: 0 },
  hours: { daily: { windows: [{ open: '00:00', close: '23:59' }] } },
  rating: 5,
  priceRange: '$$',
  description: 'Great choice. Your next food adventure starts here.',
});

const openMyList = async (page: Page, placeNames: string[] = []) => {
  await page.addInitScript(
    ({ key, places }) => {
      window.localStorage.setItem('eatspin:first-run-onboarding-seen', '1');
      // Seed once. Later reloads in the same test must keep what the app saved.
      if (window.localStorage.getItem(key) === null) {
        window.localStorage.setItem(
          key,
          JSON.stringify([
            { id: 'list-e2e', name: 'E2E list', mealTime: null, createdAt: 1, updatedAt: 1, restaurants: places },
          ]),
        );
        window.localStorage.setItem('eatspin:selected-manual-list-id', 'list-e2e');
      }
    },
    { key: MANUAL_LISTS_KEY, places: placeNames.map(seedPlace) },
  );
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /^my list/i }).click();
  await expect(page.getByRole('heading', { name: 'My list', exact: true })).toBeVisible();
};

const readStoredPlaceNames = (page: Page) =>
  page.evaluate((key) => {
    const lists = JSON.parse(window.localStorage.getItem(key) ?? '[]') as Array<{ restaurants: Array<{ name: string }> }>;
    return lists[0]?.restaurants.map((restaurant) => restaurant.name) ?? [];
  }, MANUAL_LISTS_KEY);

test.describe('My list screen', () => {
  test('adds a place with the pinned input and saves it under the same storage key', async ({ page }) => {
    await openMyList(page);

    await page.getByLabel('Add a place').fill('Kheng Cafe');
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    const rows = page.getByRole('list', { name: 'Places on this list' }).getByRole('listitem');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Kheng Cafe');
    await expect(page.getByLabel('Add a place')).toHaveValue('');
    expect(await readStoredPlaceNames(page)).toEqual(['Kheng Cafe']);
  });

  test('Enter in the input adds a place, and a duplicate is not added twice', async ({ page }) => {
    await openMyList(page);

    const input = page.getByLabel('Add a place');
    await input.fill('Mee Hoon Corner');
    await input.press('Enter');
    await input.fill('mee hoon corner');
    await input.press('Enter');

    await expect(page.getByRole('list', { name: 'Places on this list' }).getByRole('listitem')).toHaveCount(1);
  });

  test('removes a place with its 44px remove button', async ({ page }) => {
    await openMyList(page, ['Nasi Kandar Pelita', 'CKT Stall']);

    const remove = page.getByRole('button', { name: 'Remove Nasi Kandar Pelita' });
    const box = await remove.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    await remove.click();

    const rows = page.getByRole('list', { name: 'Places on this list' }).getByRole('listitem');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('CKT Stall');
    expect(await readStoredPlaceNames(page)).toEqual(['CKT Stall']);
  });

  test('keeps the list after a reload', async ({ page }) => {
    await openMyList(page, ['Nasi Kandar Pelita']);

    await page.getByLabel('Add a place').fill('Sup Tulang');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByRole('listitem').filter({ hasText: 'Sup Tulang' })).toBeVisible();

    await page.reload();
    await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /^my list/i }).click();
    await expect(page.getByRole('listitem').filter({ hasText: 'Sup Tulang' })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'Nasi Kandar Pelita' })).toBeVisible();
  });

  test('the add bar sits right above the tab bar and rows are not hidden behind it', async ({ page }) => {
    await openMyList(page, Array.from({ length: 14 }, (_, index) => `Place number ${index + 1}`));

    const nav = await page.getByRole('navigation', { name: 'Main' }).boundingBox();
    const input = await page.getByLabel('Add a place').boundingBox();
    expect(Math.round((input?.y ?? 0) + (input?.height ?? 0))).toBeLessThanOrEqual(Math.round(nav?.y ?? 0));
    expect(Math.round(nav?.y ?? 0) - Math.round((input?.y ?? 0) + (input?.height ?? 0))).toBeLessThan(40);

    // At the end of the page the last row must be above the pinned add bar.
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    const lastRow = await page.getByRole('listitem').filter({ hasText: 'Place number 14' }).boundingBox();
    const inputAfterScroll = await page.getByLabel('Add a place').boundingBox();
    expect(Math.round((lastRow?.y ?? 0) + (lastRow?.height ?? 0))).toBeLessThanOrEqual(Math.round(inputAfterScroll?.y ?? 0));
  });

  test('"Spin this list" opens the wheel and Back returns to the list', async ({ page }) => {
    await openMyList(page, ['Nasi Kandar Pelita', 'CKT Stall']);

    await page.getByRole('button', { name: 'Spin this list' }).click();
    await expect(page.getByRole('heading', { name: 'Spin your list' })).toBeVisible();
    await expect(page.getByRole('button', { name: /spin the wheel/i })).toBeVisible();
    // The pinned add bar and the wheel's own pinned Spin button never share the screen.
    await expect(page.getByLabel('Add a place')).toHaveCount(0);

    await page.getByRole('button', { name: 'Back to list' }).click();
    await expect(page.getByLabel('Add a place')).toBeVisible();
  });

  test('"Spin this list" is disabled until there are two places', async ({ page }) => {
    await openMyList(page, ['Only one']);
    await expect(page.getByRole('button', { name: 'Add 2 places to spin' })).toBeDisabled();
  });
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 360, height: 800 },
]) {
  test.describe(`My list at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test('does not scroll sideways, even with a very long place name', async ({ page }) => {
      await openMyList(page, ['A very long restaurant name that keeps going and going and going for wrapping', 'CKT Stall']);

      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(scrollWidth).toBe(innerWidth);
    });
  });
}
