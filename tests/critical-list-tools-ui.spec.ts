import { test, expect } from '@playwright/test';
const restaurant = { id: 'manual-place', name: 'Cafe', category: ['street food'], address: 'Your custom pick', coordinates: { lat: 0, lng: 0 }, hours: {}, rating: 0, priceRange: '$$', description: 'Added by you.' };
test.beforeEach(async ({ page }) => {
  await page.addInitScript(place => {
    localStorage.setItem('eatspin:first-run-onboarding-seen', '1');
    localStorage.setItem('eatspin:manual-base:v2', JSON.stringify([
      { id: 'lunch', name: 'Lunch picks', mealTime: null, restaurants: [place, { ...place, id: 'manual-second', name: 'Second cafe' }], createdAt: 1, updatedAt: 2 },
      { id: 'dinner', name: 'Dinner picks', mealTime: null, restaurants: [{ ...place, id: 'manual-dinner' }], createdAt: 1, updatedAt: 1 },
    ]));
    localStorage.setItem('eatspin:selected-manual-list-id', 'lunch');
  }, restaurant);
  page.on('dialog', dialog => { throw new Error(`Unexpected native dialog: ${dialog.message()}`); });
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /^My list/i }).click();
});

test('compact tools use a styled file button and cancel restores focus', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Duplicate list', exact: true })).toHaveCount(0);
  const tools = page.getByRole('button', { name: 'List tools', exact: true });
  await tools.click();
  await page.getByRole('button', { name: 'Restore lists', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Restore lists', exact: true });
  await expect(dialog.getByRole('button', { name: 'Choose file', exact: true })).toBeVisible();
  await expect(dialog.getByLabel('Choose backup file', { exact: true })).toBeHidden();
  const chooserPromise = page.waitForEvent('filechooser');
  await dialog.getByRole('button', { name: 'Choose file', exact: true }).click();
  const chooser = await chooserPromise;
  expect(chooser.isMultiple()).toBe(false);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(tools).toBeFocused();
});

test('export includes only the selected lists and restores only checked lists', async ({ page }) => {
  await page.getByRole('button', { name: 'List tools', exact: true }).click();
  await page.getByRole('button', { name: 'Export lists', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: /Lunch picks/ })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: /Dinner picks/ })).not.toBeChecked();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export 1 list', exact: true }).click();
  const stream = await (await downloadPromise).createReadStream();
  const chunks = []; for await (const chunk of stream!) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString());
  expect(exported.lists.map((list: {name: string}) => list.name)).toEqual(['Lunch picks']);
  const source = [{ ...exported.lists[0], id: 'friend-a', name: 'Friend lunch' }, { ...exported.lists[0], id: 'friend-b', name: 'Friend dinner' }];
  await page.getByRole('button', { name: 'List tools', exact: true }).click();
  await page.getByRole('button', { name: 'Restore lists', exact: true }).click();
  await page.getByLabel('Choose backup file', { exact: true }).setInputFiles({ name: 'friends.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, lists: source })) });
  await page.getByRole('checkbox', { name: /Friend dinner/ }).uncheck();
  await page.getByRole('button', { name: 'Restore 1 list', exact: true }).click();
  const names = await page.evaluate(() => JSON.parse(localStorage.getItem('eatspin:manual-lists')!).map((list: {name: string}) => list.name));
  expect(names.sort()).toEqual(['Dinner picks', 'Friend lunch', 'Lunch picks']);
});

test('delete and clear use in-app confirmations with safe cancellation and undo', async ({ page }) => {
  const deleteButton = page.getByRole('button', { name: 'Delete Lunch picks', exact: true });
  await deleteButton.click();
  const deletion = page.getByRole('alertdialog', { name: 'Delete this list?' });
  await expect(deletion).toContainText('Lunch picks and its 2 places');
  await deletion.getByRole('button', { name: 'Keep list', exact: true }).click();
  await expect(page.getByRole('option')).toHaveCount(2);
  await expect(deleteButton).toBeFocused();
  await page.getByRole('button', { name: 'Clear all places', exact: true }).click();
  const clearing = page.getByRole('alertdialog', { name: 'Clear all places?' });
  await clearing.getByRole('button', { name: 'Keep places', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove Cafe', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear all places', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Clear places', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove Cafe', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Remove Second cafe', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove Cafe', exact: true })).toBeVisible();
  await deleteButton.click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete list', exact: true }).click();
  await expect(page.getByRole('option')).toHaveCount(1);
});
