import { test, expect } from '@playwright/test';
import { openSpinScreenWithLocation, setLunchtimeClock, spinToResult } from './spin-helpers';
test.use({ geolocation: { latitude: 5.4146, longitude: 100.3296 }, permissions: ['geolocation'] });
test('failed persistence shows an error and does not award favourite quest progress', async ({ page }) => {
  await setLunchtimeClock(page);
  await openSpinScreenWithLocation(page);
  const dialog = await spinToResult(page);
  const before = await page.evaluate(() => localStorage.getItem('eatspin:game-v1'));
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
      if (this.name === 'favourites') throw new DOMException('Synthetic full storage', 'QuotaExceededError');
      return put.apply(this, args);
    };
  });
  await dialog.getByRole('button', { name: 'Save to list' }).click();
  await expect(page.getByText('Could not save this place. Please try again.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Save to list' })).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem('eatspin:game-v1'))).toBe(before);
});
