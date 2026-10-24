import { test, expect, type Page, type Route } from '@playwright/test';

const ALL_DAY = { periods: Array.from({ length: 7 }, (_, day) => ({ open: { day, hour: 0, minute: 0 }, close: { day, hour: 23, minute: 59 } })) };
// Opens 18:00–22:00 every day; the clock below is 12:30 local, so these are closed now.
const EVENINGS = { periods: Array.from({ length: 7 }, (_, day) => ({ open: { day, hour: 18, minute: 0 }, close: { day, hour: 22, minute: 0 } })) };

const place = (i: number, hours: typeof ALL_DAY, center: { latitude: number; longitude: number }) => ({
  id: `p-${i}`,
  displayName: { text: `Kiara Place ${i}` },
  formattedAddress: 'Mont Kiara',
  location: { latitude: center.latitude + 0.001 * i, longitude: center.longitude },
  rating: 4.5,
  userRatingCount: 100,
  types: ['restaurant'],
  currentOpeningHours: { openNow: hours === ALL_DAY },
  regularOpeningHours: hours,
});

async function openWithDestination(page: Page, nearby: (route: Route, radius: number) => Promise<void>) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(new Date('2026-10-21T04:30:00Z')); // 12:30 in Kuala Lumpur
  await page.addInitScript(() => {
    localStorage.setItem('eatspin:first-run-onboarding-seen', '1');
    localStorage.setItem('eatspin:search-destination:v1', JSON.stringify({ version: 1, radiusKm: 3,
      destination: { placeId: 'kiara', coordinates: { lat: 3.17, lng: 101.65 }, fetchedAt: Date.now() } }));
  });
  await page.route('**/places.googleapis.com/**', (route) => {
    const body = route.request().postDataJSON?.() ?? {};
    return nearby(route, body.locationRestriction?.circle?.radius ?? 0);
  });
  await page.goto('/');
}

const cta = (page: Page) => page.locator('main button').filter({ hasText: /spin!|widen|closed places|open filters/i }).last();

test('a compact location row keeps the whole wheel above the pinned Spin button', async ({ page }) => {
  await openWithDestination(page, (route) => route.fulfill({ json: { places: [0, 1, 2, 3].map((i) => place(i, ALL_DAY, { latitude: 3.17, longitude: 101.65 })) } }));
  const where = page.getByRole('button', { name: /search around Saved destination/i });
  await expect(where).toBeVisible();
  expect((await where.boundingBox())!.height).toBeLessThanOrEqual(48);
  const spin = page.getByRole('button', { name: /^spin!$/i });
  await expect(spin).toBeEnabled({ timeout: 15_000 });
  const wheel = page.locator('.aspect-square').first();
  const wheelBox = (await wheel.boundingBox())!;
  const spinBox = (await spin.boundingBox())!;
  expect(wheelBox.y + wheelBox.height).toBeLessThanOrEqual(spinBox.y);
});

test('when everything is closed, the pinned button offers closed places and fills the wheel', async ({ page }) => {
  await openWithDestination(page, (route) => route.fulfill({ json: { places: [0, 1, 2].map((i) => place(i, EVENINGS, { latitude: 3.17, longitude: 101.65 })) } }));
  await expect(page.getByText('No open spots left for the wheel right now.')).toBeVisible({ timeout: 15_000 });
  const fix = page.getByRole('button', { name: 'Show closed places too' });
  await expect(fix).toBeEnabled();
  await fix.click();
  await expect(page.getByRole('button', { name: /^spin!$/i })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole('button', { name: /^filters/i }).click();
  await expect(page.getByRole('checkbox', { name: 'Open now only' })).not.toBeChecked();
});

test('when nothing is found, the pinned button widens the radius', async ({ page }) => {
  await openWithDestination(page, (route, radius) => route.fulfill({
    json: { places: radius >= 5000 ? [0, 1, 2].map((i) => place(i, ALL_DAY, { latitude: 3.17, longitude: 101.65 })) : [] },
  }));
  await expect(page.getByText('No restaurants found here yet.')).toBeVisible({ timeout: 15_000 });
  const wider = page.waitForRequest((r) => r.url().includes('places:searchNearby') && r.postDataJSON().locationRestriction.circle.radius === 5000);
  await page.getByRole('button', { name: 'Widen to 5 km' }).click();
  await wider;
  await expect(page.getByRole('button', { name: /^spin!$/i })).toBeEnabled({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /^filters · 5 km/i })).toBeVisible();
  expect(await cta(page).textContent()).toMatch(/spin!/i);
});
