import { test, expect, type Page } from '@playwright/test';
const openList = async (page: Page) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /^My list/i }).click();
};
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    localStorage.setItem('eatspin:first-run-onboarding-seen', '1');
    if (!localStorage.getItem('eatspin:manual-lists')) {
      const restaurant = (id: string) => ({ id, name: id, category: ['street food'], address: 'Custom', coordinates: { lat: 0, lng: 0 }, hours: {}, rating: 0, priceRange: '$$', description: 'Custom' });
      localStorage.setItem('eatspin:manual-lists', JSON.stringify([{ id: 'list', name: 'Lunch', mealTime: null, restaurants: [restaurant('A'), restaurant('B')], createdAt: 1, updatedAt: 1 }]));
    }
  });
});

test('two tabs retain concurrent additions and reload the merged result', async ({ page, context }) => {
  await openList(page);
  const second = await context.newPage();
  await openList(second);
  await page.getByLabel('Add a place', { exact: true }).fill('C');
  await second.getByLabel('Add a place', { exact: true }).fill('D');
  await Promise.all([page.getByRole('button', { name: 'Add', exact: true }).click(), second.getByRole('button', { name: 'Add', exact: true }).click()]);
  for (const tab of [page, second]) {
    await expect(tab.getByRole('list', { name: 'Places on this list' }).getByRole('listitem')).toHaveCount(4);
  }
  await page.reload();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /^My list/i }).click();
  await expect(page.getByRole('button', { name: 'Remove C', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove D', exact: true })).toBeVisible();
});

test('undo removal preserves a place added from another tab', async ({ page, context }) => {
  await openList(page);
  const second = await context.newPage(); await openList(second);
  await page.getByRole('button', { name: 'Remove A', exact: true }).click();
  await second.getByLabel('Add a place', { exact: true }).fill('C');
  await second.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('list', { name: 'Places on this list' }).getByRole('listitem')).toHaveCount(3);
});

test('duplication creates independently editable list and item IDs', async ({ page }) => {
  await openList(page);
  await page.getByRole('button', { name: 'List tools', exact: true }).click();
  await page.getByRole('button', { name: 'Duplicate list', exact: true }).click();
  await page.getByRole('button', { name: 'Remove A', exact: true }).click();
  await page.getByRole('option', { name: 'Lunch 2', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove A', exact: true })).toBeVisible();
  const lists = await page.evaluate(() => JSON.parse(localStorage.getItem('eatspin:manual-lists')!));
  expect(lists).toHaveLength(2);
  const allIds = lists.flatMap((list: { id: string; restaurants: { id: string }[] }) => [list.id, ...list.restaurants.map(item => item.id)]);
  expect(new Set(allIds).size).toBe(allIds.length);
});

test('backup restore previews and adds copies without replacing existing lists', async ({ page }) => {
  await openList(page);
  await page.getByRole('button', { name: 'List tools', exact: true }).click();
  await page.getByRole('button', { name: 'Export lists', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export 1 list', exact: true }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks = []; for await (const chunk of stream!) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);
  await page.getByRole('button', { name: 'List tools', exact: true }).click();
  await page.getByRole('button', { name: 'Restore lists', exact: true }).click();
  await page.getByLabel('Choose backup file', { exact: true }).setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer });
  await expect(page.getByRole('dialog', { name: 'Ready to restore' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('eatspin:manual-lists')!).length)).toBe(1);
  await page.getByRole('button', { name: 'Restore 1 list', exact: true }).click();
  await expect(page.getByRole('option')).toHaveCount(2);
  await page.getByRole('button', { name: 'List tools', exact: true }).click();
  await page.getByRole('button', { name: 'Restore lists', exact: true }).click();
  await page.getByLabel('Choose backup file', { exact: true }).setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"version":2,"lists":[]}') });
  await expect(page.getByRole('alert')).toContainText('Unsupported or invalid list backup.');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('option')).toHaveCount(2);
});

test('failed local save is visible and the identical operation can be retried', async ({ page }) => {
  await openList(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    let fail = true;
    Storage.prototype.setItem = function(key, value) {
      if (fail && key.startsWith('eatspin:manual-op:')) { fail = false; throw new DOMException('Storage full', 'QuotaExceededError'); }
      return original.call(this, key, value);
    };
  });
  await page.getByLabel('Add a place', { exact: true }).fill('Retry cafe');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('Save failed', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove Retry cafe', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry saving', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove Retry cafe', exact: true })).toBeVisible();
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
});


test('simultaneous legacy migration preserves the same list and place IDs', async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    localStorage.setItem('eatspin:first-run-onboarding-seen', '1');
    localStorage.setItem('eatspin:manual-restaurants', JSON.stringify([{ id: 'legacy-place', name: 'Legacy cafe', category: ['street food'], address: 'Custom', coordinates: { lat: 0, lng: 0 }, hours: {}, rating: 0, priceRange: '$$', description: 'Custom' }]));
  });
  try {
    const first = await context.newPage(); const second = await context.newPage();
    await Promise.all([openList(first), openList(second)]);
    for (const page of [first, second]) {
      await expect(page.getByRole('button', { name: 'Remove Legacy cafe', exact: true })).toBeVisible();
      const base = await page.evaluate(() => JSON.parse(localStorage.getItem('eatspin:manual-base:v2')!));
      expect(base[0].id).toBe('manual-list-migrated-restaurants');
      expect(base[0].restaurants[0].id).toBe('legacy-place');
    }
  } finally { await context.close(); }
});
