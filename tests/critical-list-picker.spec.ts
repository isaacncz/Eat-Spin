import { test, expect, type Page } from '@playwright/test';
import { openListPicker } from './list-picker-helpers';

const longName = 'Friday dinner with family and friends around Penang and Butterworth';
const mainTab = (page: Page) => page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /^My list/ });

test.beforeEach(async ({ context }) => {
  await context.addInitScript(long => {
    localStorage.setItem('eatspin:first-run-onboarding-seen', '1');
    if (localStorage.getItem('eatspin:manual-base:v2')) return;
    const names = ['Lunch favourites', 'Dinner ideas', 'Weekend cafés', 'Family picks', long,
      ...Array.from({ length: 35 }, (_, i) => `Saved list ${i + 1}`)];
    const place = (id: string, name: string) => ({ id, name, category: ['street food'], address: 'Custom',
      coordinates: { lat: 0, lng: 0 }, hours: {}, rating: 0, priceRange: '$$', description: 'Custom' });
    localStorage.setItem('eatspin:manual-base:v2', JSON.stringify(names.map((name, i) => ({
      id: `list-${i}`, name, mealTime: null,
      restaurants: i === 3 ? [] : [place(`a-${i}`, `${name} cafe`), place(`b-${i}`, `${name} noodles`)],
      createdAt: 1, updatedAt: names.length - i,
    }))));
    localStorage.setItem('eatspin:selected-manual-list-id', 'list-0');
  }, longName);
  await context.route('**/places.googleapis.com/**', route => route.fulfill({ json: { places: [] } }));
});

async function openMyLists(page: Page) {
  await page.goto('/');
  await mainTab(page).click();
}

test('search switches a large collection, resets on reopening and persists selection after reload', async ({ page }) => {
  await openMyLists(page);
  await expect(page.getByRole('button', { name: 'Create new list', exact: true })).toBeInViewport();
  const dialog = await openListPicker(page);
  const choices = dialog.getByRole('list', { name: 'Saved lists', exact: true }).getByRole('button');
  await expect(choices).toHaveCount(40);
  await expect(choices.first()).toHaveAccessibleName('Open list Lunch favourites');
  await expect(choices.nth(1)).toHaveAccessibleName('Open list Dinner ideas');
  await expect(choices.first()).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('textbox', { name: 'Search your lists', exact: true }).fill('  WEEKEND  ');
  await expect(choices).toHaveCount(1);
  await choices.first().click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Remove Weekend cafés cafe', exact: true })).toBeVisible();
  await page.reload();
  await mainTab(page).click();
  await expect(page.getByRole('button', { name: /^Choose a list: Weekend cafés/ })).toBeVisible();
  const reopened = await openListPicker(page);
  await expect(reopened.getByRole('textbox', { name: 'Search your lists' })).toHaveValue('');
  await expect(reopened.getByRole('list', { name: 'Saved lists' }).getByRole('listitem')).toHaveCount(40);
});

test('no-match clearing, long names and empty lists remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await openMyLists(page);
  const dialog = await openListPicker(page);
  const search = dialog.getByRole('textbox', { name: 'Search your lists' });
  await search.fill('not-a-list');
  await expect(dialog.getByText('No lists match your search.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Clear search', exact: true }).last().click();
  await expect(search).toHaveValue('');
  await expect(search).toBeFocused();
  await search.fill('Friday');
  const long = dialog.getByRole('button', { name: `Open list ${longName}`, exact: true });
  await expect(long).toBeVisible();
  expect(await long.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await search.fill('Family');
  await expect(dialog.getByRole('button', { name: 'Open list Family picks', exact: true })).toHaveAccessibleDescription('0 places · Any meal');
  await dialog.getByRole('button', { name: 'Open list Family picks', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add 2 places to spin', exact: true })).toBeDisabled();
});

test('keyboard focus stays in the picker, Escape restores it, and New list uses the existing form', async ({ page }) => {
  await openMyLists(page);
  const trigger = page.getByRole('button', { name: /^Choose a list:/ });
  const dialog = await openListPicker(page);
  if ((page.viewportSize()?.width ?? 0) >= 640) await expect(dialog.getByRole('textbox')).toBeFocused();
  else await expect(dialog.getByRole('button', { name: 'Close list picker', exact: true })).toBeFocused();
  for (let i = 0; i < 45; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await openListPicker(page);
  await page.getByRole('dialog').getByRole('button', { name: 'Create new list', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('List name', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Meal time', { exact: true })).toBeVisible();
});

test('another tab can rename and delete lists while search is open', async ({ page, context }) => {
  await openMyLists(page);
  const dialog = await openListPicker(page);
  await dialog.getByRole('textbox').fill('Dinner ideas');
  const second = await context.newPage();
  await second.goto('/');
  await second.evaluate(() => {
    const operation = { id: 'rename-from-second-tab', clock: Date.now(), listId: 'list-1', kind: 'patch', fields: { name: 'Evening ideas' } };
    localStorage.setItem('eatspin:manual-op:' + operation.id, JSON.stringify(operation));
  });
  await expect(dialog.getByText('No lists match your search.')).toBeVisible();
  await dialog.getByRole('textbox').fill('Evening');
  await expect(dialog.getByRole('button', { name: 'Open list Evening ideas', exact: true })).toBeVisible();
  await second.evaluate(() => {
    const operation = { id: 'delete-from-second-tab', clock: Date.now() + 1, listId: 'list-1', kind: 'delete' };
    localStorage.setItem('eatspin:manual-op:' + operation.id, JSON.stringify(operation));
  });
  await expect(dialog.getByText('No lists match your search.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Open list Evening ideas', exact: true })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Choose a list' })).toBeVisible();
  await second.evaluate(() => {
    const operation = { id: 'delete-current-from-second-tab', clock: Date.now() + 2, listId: 'list-0', kind: 'delete' };
    localStorage.setItem('eatspin:manual-op:' + operation.id, JSON.stringify(operation));
  });
  await dialog.getByRole('textbox').fill('');
  await expect(dialog.getByRole('button', { name: 'Open list Lunch favourites', exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Open list Weekend cafés', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('search, results and New list stay above an overlaying phone keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const target = new EventTarget();
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: Object.assign(target,
      { height: 844, offsetTop: 0, width: 390, offsetLeft: 0, scale: 1 }) });
    (window as unknown as { setPickerKeyboard: () => void }).setPickerKeyboard = () => {
      Object.assign(window.visualViewport!, { height: 360, offsetTop: 18 });
      target.dispatchEvent(new Event('resize'));
    };
  });
  await openMyLists(page);
  const dialog = await openListPicker(page);
  const search = dialog.getByRole('textbox', { name: 'Search your lists' });
  await search.fill('Weekend');
  await page.evaluate(() => (window as unknown as { setPickerKeyboard: () => void }).setPickerKeyboard());
  await expect.poll(async () => (await dialog.boundingBox())!.y + (await dialog.boundingBox())!.height).toBeLessThanOrEqual(378);
  const result = dialog.getByRole('button', { name: 'Open list Weekend cafés', exact: true });
  await result.scrollIntoViewIfNeeded();
  for (const control of [search, result, dialog.getByRole('button', { name: 'Create new list', exact: true })]) {
    const box = (await control.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(18);
    expect(box.y + box.height).toBeLessThanOrEqual(378);
  }
  await result.click();
  await expect(dialog).toHaveCount(0);
});

test('Favourites switches separately and can return to a personal list', async ({ page }) => {
  await openMyLists(page);
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('eatspin-favourites', 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore('favourites', { keyPath: 'id' });
        store.createIndex('by-rating', 'userRating'); store.createIndex('by-savedAt', 'savedAt');
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('favourites', 'readwrite');
        tx.objectStore('favourites').put({ id: 'saved-cafe', restaurant: { id: 'cafe', name: 'Saved cafe',
          category: ['street food'], address: 'Custom', coordinates: { lat: 5.4, lng: 100.3 }, hours: {}, rating: 4, priceRange: '$$' },
          savedAt: 1, savedFrom: 'lets-go', visitCount: 1, userRating: 'suggest', feedbackPending: false });
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
      };
    });
  });
  await page.reload(); await mainTab(page).click();
  let dialog = await openListPicker(page);
  await dialog.getByRole('button', { name: 'Open favourites', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Choose a list: Favourites, 1 place/ })).toBeVisible();
  await expect(page.getByLabel('Add a place', { exact: true })).toHaveCount(0);
  dialog = await openListPicker(page);
  await expect(dialog.getByRole('button', { name: 'Open favourites', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByRole('list', { name: 'Saved lists' }).getByRole('button', { pressed: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Open list Lunch favourites', exact: true }).click();
  await expect(page.getByLabel('Add a place', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove Lunch favourites cafe', exact: true })).toBeVisible();
});
