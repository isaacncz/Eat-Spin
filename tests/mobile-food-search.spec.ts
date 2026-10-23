import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date('2026-10-23T12:30:00Z')); });

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
  expect(box!.y + box!.height).toBeLessThanOrEqual(200);
  expect(await input.evaluate((el) => getComputedStyle(el).fontSize)).toBe('16px');
  await expect(page.getByRole('button', { name: 'Clear search' })).toBeVisible();
  await page.screenshot({ path: '/tmp/eatspin-food-search-keyboard-viewport.png' });

  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(input).toHaveValue('');
  await page.getByRole('button', { name: /back to spin/i }).click();
  await expect(page.getByRole('group', { name: 'Search radius' })).toBeVisible();
});

test('a city typed in food search can become the destination without returning to Spin', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('eatspin:first-run-onboarding-seen', '1');
    localStorage.setItem('eatspin:search-destination:v1', JSON.stringify({ version: 1, radiusKm: 5,
      destination: { placeId: 'kiara', coordinates: { lat: 3.17, lng: 101.65 }, fetchedAt: Date.now() } }));
  });
  await page.route('**/places.googleapis.com/**', (route) => {
    const url = route.request().url();
    if (url.includes('places:autocomplete')) {
      expect(route.request().postDataJSON().input).toBe('George Town');
      return route.fulfill({ json: { suggestions: [{ placePrediction: { placeId: 'george-town', structuredFormat: { mainText: { text: 'George Town' }, secondaryText: { text: 'Penang, Malaysia' } } } }] } });
    }
    if (url.includes('/places/george-town')) return route.fulfill({ json: { location: { latitude: 5.414, longitude: 100.33 }, formattedAddress: 'Penang, Malaysia' } });
    if (url.includes('places:searchText') && route.request().postDataJSON().textQuery === 'coffee') {
      const body = route.request().postDataJSON();
      expect(body.locationRestriction.rectangle.low.latitude).toBeGreaterThan(5.3);
      return route.fulfill({ json: { places: [{ id: 'coffee', displayName: { text: 'Penang Coffee' }, location: { latitude: 5.415, longitude: 100.33 }, types: ['cafe'] }] } });
    }
    return route.fulfill({ json: { places: [] } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /search instead/i }).click();
  const food = page.getByRole('textbox', { name: 'Search for food' });
  await food.fill('George Town');
  await expect(page.getByRole('button', { name: 'Change area' })).toBeVisible();
  const areaAction = page.getByRole('button', { name: 'Search “George Town” as an area' });
  await expect(areaAction).toBeVisible();
  await page.screenshot({ path: '/tmp/eatspin-area-search-fix.png' });
  await areaAction.click();
  await expect(page.getByLabel('Search destination')).toHaveValue('George Town');
  await page.getByRole('button', { name: 'George Town Penang, Malaysia' }).click();
  await expect(page.getByLabel('Food search area')).toHaveText('Within 5 km of George Town');
  await expect(food).toHaveValue('');
  await food.fill('coffee');
  await expect(page.getByText('Penang Coffee', { exact: true })).toBeVisible();
});
