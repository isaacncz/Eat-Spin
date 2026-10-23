import { test, expect, type Page } from '@playwright/test';

async function setup(page: Page, gps = false) {
  await page.addInitScript((allowGps) => {
    localStorage.setItem('eatspin:first-run-onboarding-seen', '1');
    Object.defineProperty(navigator, 'geolocation', { value: {
      watchPosition: (ok: (position: { coords: { latitude: number; longitude: number } }) => void, fail: (err: { message: string }) => void) => {
        if (allowGps) {
          ok({ coords: { latitude: 1.35, longitude: 103.82 } });
          window.addEventListener('test-gps-moved', () => ok({ coords: { latitude: 1.4, longitude: 103.9 } }));
        } else fail({ message: 'Permission denied' });
        return 1;
      }, clearWatch: () => {},
    } });
  }, gps);
  await page.route('**/places.googleapis.com/**', async (route) => {
    const url = route.request().url();
    if (url.includes('places:autocomplete')) return route.fulfill({ json: { suggestions: [{ placePrediction: { placeId: 'kiara', structuredFormat: { mainText: { text: 'Mont Kiara' }, secondaryText: { text: 'Kuala Lumpur, Malaysia' } } } }] } });
    if (url.includes('/places/kiara')) {
      expect(route.request().headers()['x-goog-fieldmask']).toBe('location,formattedAddress');
      return route.fulfill({ json: { location: { latitude: 3.17, longitude: 101.65 }, formattedAddress: 'Kuala Lumpur, Malaysia' } });
    }
    const request = route.request().postDataJSON();
    const center = request.locationRestriction?.circle?.center;
    const places = ['Kiara Noodles', 'Kiara Sushi'].map((name, i) => ({ id: `kiara-${i}`, displayName: { text: name }, formattedAddress: 'Mont Kiara', location: { latitude: (center?.latitude ?? 3.17) + 0.001 * i, longitude: center?.longitude ?? 101.65 }, rating: 4.7, userRatingCount: 100, types: ['restaurant'], currentOpeningHours: { openNow: true }, regularOpeningHours: { periods: Array.from({ length: 7 }, (_, day) => ({ open: { day, hour: 0, minute: 0 }, close: { day, hour: 23, minute: 59 } })) } }));
    return route.fulfill({ json: { places } });
  });
  await page.goto('/');
}

test('destination works without GPS; radius, reload, and return to current location', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: /search around/i }).click();
  await page.getByLabel('Search destination').fill('Mont Kiara');
  await page.getByRole('button', { name: /Mont Kiara Kuala Lumpur/i }).click();
  await expect(page.getByRole('button', { name: /search around Mont Kiara/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^3 km$/ })).toHaveAttribute('aria-pressed', 'true');
  const nearby = page.waitForRequest((r) => r.url().includes('places:searchNearby') && r.postDataJSON().locationRestriction.circle.radius === 5000);
  await page.getByRole('button', { name: /^5 km$/ }).click();
  await nearby;
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('eatspin:search-destination:v1')!));
  expect(saved.destination.coordinates).toEqual({ lat: 3.17, lng: 101.65 });
  expect(saved.destination.label).toBeUndefined();
  await page.reload();
  await expect(page.getByRole('button', { name: /search around Saved destination/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^5 km$/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /^spin!$/i })).toBeEnabled({ timeout: 15_000 });
  await page.screenshot({ path: '/tmp/eatspin-destination-preview.png', fullPage: true });
  await page.getByRole('button', { name: /search around/i }).click();
  await page.getByRole('button', { name: 'Use my current location' }).click();
  await expect(page.getByRole('button', { name: /search around Current location/i })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('eatspin:search-destination:v1')!).destination)).toBeNull();
});


test('manual destination remains fixed when GPS moves; food search shares radius and center', async ({ page }) => {
  await setup(page, true);
  await page.getByRole('button', { name: /share my location/i }).click();
  await page.getByRole('button', { name: /search around/i }).click();
  await page.getByLabel('Search destination').fill('Mont');
  await page.getByRole('button', { name: /Mont Kiara Kuala Lumpur/i }).click();
  await expect(page.getByRole('button', { name: /^spin!$/i })).toBeEnabled({ timeout: 15_000 });
  await page.evaluate(() => window.dispatchEvent(new Event('test-gps-moved')));
  await expect(page.getByRole('button', { name: /search around Mont Kiara/i })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Open now only' }).uncheck();
  await page.getByRole('button', { name: /search instead/i }).click();
  const searchRequest = page.waitForRequest((r) => r.url().includes('places:searchText'));
  await page.getByLabel(/search for food/i).fill('noodles');
  const body = (await searchRequest).postDataJSON();
  expect(body.openNow).toBe(false);
  expect(body.locationBias).toBeUndefined();
  expect(body.locationRestriction.rectangle.low.latitude).toBeCloseTo(3.143, 2);
  expect(body.locationRestriction.rectangle.high.longitude).toBeCloseTo(101.677, 2);
  await expect(page.getByText('Kiara Noodles', { exact: true })).toBeVisible();
  await expect(page.getByText(/km from Mont Kiara/).first()).toBeVisible();
});

test('changing radius cancels old food search and ignores a late response', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: /search around/i }).click();
  await page.getByLabel('Search destination').fill('Mont');
  await page.getByRole('button', { name: /Mont Kiara Kuala Lumpur/i }).click();
  await page.getByRole('button', { name: /search instead/i }).click();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let delivered!: () => void;
  const finished = new Promise<void>((resolve) => { delivered = resolve; });
  await page.route('**/places:searchText', async (route) => {
    if (route.request().postDataJSON().textQuery !== 'old') return route.fallback();
    await gate;
    try {
      await route.fulfill({ json: { places: [{ id: 'stale', displayName: { text: 'Stale result' }, location: { latitude: 3.17, longitude: 101.65 }, types: ['restaurant'] }] } });
    } catch { /* The browser may have already cancelled its request. */ }
    finally { delivered(); }
  });
  const oldRequest = page.waitForRequest((r) => r.url().includes('places:searchText'));
  await page.getByLabel(/search for food/i).fill('old');
  await oldRequest;
  await page.getByRole('button', { name: /back to spin/i }).click();
  await page.getByRole('button', { name: /^1 km$/ }).click();
  await page.getByRole('button', { name: /search instead/i }).click();
  await expect(page.getByLabel(/search for food/i)).toHaveValue('');
  release();
  await finished;
  await expect(page.getByText('Stale result', { exact: true })).toHaveCount(0);
  await page.getByLabel(/search for food/i).fill('fresh');
  await expect(page.getByText('Kiara Noodles', { exact: true })).toBeVisible();
});
