import { test, expect } from '@playwright/test';

test('food input stays visible with a destination and a keyboard-sized viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('eatspin:first-run-onboarding-seen', '1');
    localStorage.setItem('eatspin:search-destination:v1', JSON.stringify({ version: 1, radiusKm: 3,
      destination: { placeId: 'kiara', coordinates: { lat: 3.17, lng: 101.65 }, fetchedAt: Date.now() } }));
  });
  await page.route('**/places.googleapis.com/**', (route) => route.fulfill({ json: { places: [] } }));
  await page.goto('/');
  await page.getByRole('button', { name: /search instead/i }).click();
  const input = page.getByRole('textbox', { name: 'Search for food' });
  await expect(input).toBeFocused();
  await expect(page.getByLabel('Food search area')).toHaveText('Within 3 km of Saved destination');
  await expect(page.getByRole('group', { name: 'Search radius' })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(0);
  await page.screenshot({ path: '/tmp/eatspin-food-search-mobile.png' });

  // Android's onscreen keyboard leaves roughly this much usable layout height.
  await page.setViewportSize({ width: 390, height: 360 });
  await input.fill('chicken rice');
  const box = await input.boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThan(200);
  expect(await input.evaluate((el) => getComputedStyle(el).fontSize)).toBe('16px');
  await expect(page.getByRole('button', { name: 'Clear search' })).toBeVisible();
  await page.screenshot({ path: '/tmp/eatspin-food-search-keyboard-viewport.png' });

  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(input).toHaveValue('');
  await page.getByRole('button', { name: /back to spin/i }).click();
  await expect(page.getByRole('group', { name: 'Search radius' })).toBeVisible();
});
