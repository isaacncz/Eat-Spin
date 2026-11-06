import { test, expect, type Page } from '@playwright/test';

const mallId = 'sunway-pyramid';

async function setup(page: Page, options: { unknown?: boolean; fail?: boolean; tenants?: number; withdrawFirst?: boolean } = {}) {
  await page.clock.setFixedTime(new Date('2026-11-06T04:00:00Z'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('eatspin:first-run-onboarding-seen', '1');
    Object.defineProperty(navigator, 'geolocation', { value: {
      watchPosition: (_ok: unknown, fail: (error: { message: string }) => void) => { fail({ message: 'Permission denied' }); return 1; },
      clearWatch: () => {},
    } });
  });
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.abort());
  await page.route('**/places.googleapis.com/**', async (route) => {
    const url = route.request().url();
    if (url.includes('places:autocomplete')) return route.fulfill({ json: { suggestions: [{ placePrediction: {
      placeId: mallId, structuredFormat: { mainText: { text: 'Sunway Pyramid' }, secondaryText: { text: 'Malaysia' } },
    } }] } });
    if (url.includes(`/places/${mallId}`)) return route.fulfill({ json: {
      location: { latitude: 3.073, longitude: 101.607 }, types: ['shopping_mall'], formattedAddress: 'Malaysia',
    } });
    if (options.fail) return route.fulfill({ status: 503, json: { error: { message: 'Test provider unavailable' } } });
    const makePlace = (id: string, name: string, parents?: string[]) => ({
      id, displayName: { text: name }, formattedAddress: 'Sunway Pyramid area',
      location: { latitude: 3.073, longitude: 101.607 }, rating: 4.8, userRatingCount: 200,
      types: ['restaurant'], primaryType: 'restaurant', containingPlaces: parents?.map((id) => ({ id })),
      currentOpeningHours: { openNow: true },
      regularOpeningHours: { periods: Array.from({ length: 7 }, (_, day) => ({ open: { day, hour: 0, minute: 0 }, close: { day, hour: 23, minute: 59 } })) },
    });
    const tenants = Array.from({ length: options.tenants ?? 2 }, (_, i) =>
      makePlace(`tenant-${i}`, `Tenant ${i === 0 ? 'Noodles' : i === 1 ? 'Sushi' : i}`, options.unknown ? undefined : options.withdrawFirst && i === 0 ? ['different-mall'] : [mallId]));
    return route.fulfill({ json: { places: [
      makePlace('outside', 'Outside branch', ['different-mall']),
      makePlace('unknown', 'Unverified restaurant'), ...tenants,
    ] } });
  });
  await page.goto('/');
}

async function selectMall(page: Page) {
  await page.getByRole('button', { name: /search around.*change area/i }).click();
  await page.getByLabel('Search destination').fill('Sunway');
  await page.getByRole('button', { name: 'Sunway Pyramid Malaysia' }).click();
  await expect(page.getByRole('group', { name: 'Mall search scope' }).getByRole('button', { name: 'Inside this mall', exact: true })).toHaveAttribute('aria-pressed', 'true');
}

test('mall selection restricts the wheel and text search; nearby is explicit and restores the saved radius', async ({ page }) => {
  await setup(page);
  await selectMall(page);
  await expect(page.getByRole('button', { name: /^Spin!$/ })).toBeEnabled();
  await page.getByRole('button', { name: 'Review this round' }).click();
  const round = page.getByRole('region', { name: 'Review this round' });
  await expect(round.getByText('Tenant Noodles', { exact: true })).toBeVisible();
  await expect(round.getByText('Outside branch', { exact: true })).toHaveCount(0);
  await expect(round.getByText('Unverified restaurant', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /^Filters/ }).click();
  const filters = page.getByRole('dialog', { name: 'Filters' });
  await expect(filters.getByRole('group', { name: 'How far' })).toHaveCount(0);
  await expect(filters.getByRole('checkbox', { name: 'Open now only' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /^Filters/ })).toBeFocused();
  await page.getByRole('button', { name: 'Search instead' }).click();
  await page.getByLabel('Search for food').fill('noodles');
  await expect(page.getByText('Tenant Noodles', { exact: true })).toBeVisible();
  await expect(page.getByText('Outside branch', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Unverified restaurant', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Around this mall', exact: true }).click();
  await expect(page.getByLabel('Search for food')).toHaveValue('');
  await page.getByLabel('Search for food').fill('noodles');
  await expect(page.getByText('Outside branch', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to Spin' }).click();
  await page.getByRole('button', { name: /^Filters/ }).click();
  await expect(filters.getByRole('button', { name: '5 km', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await filters.getByRole('button', { name: '3 km', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Inside this mall', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Inside this mall', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Around this mall', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Filters · 3 km/ })).toBeVisible();
});

for (const fail of [false, true]) {
  test(`${fail ? 'provider failure' : 'missing relationships'} stays inside-only with no local fallback`, async ({ page }) => {
    await setup(page, { unknown: true, fail });
    await selectMall(page);
    await expect(page.getByText(fail ? 'Unable to verify mall restaurants.' : 'No confirmed restaurants inside this mall yet.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Spin!$/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Inside this mall', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Choose another mall', exact: true }).click();
    await expect(page.getByLabel('Search destination')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Choose another mall', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Search around this mall', exact: true }).first().click();
    await expect(page.getByRole('button', { name: 'Around this mall', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });
}

test('switching from nearby to inside cancels a delayed outside food response', async ({ page }) => {
  await setup(page);
  await selectMall(page);
  await page.getByRole('button', { name: 'Around this mall', exact: true }).click();
  await page.getByRole('button', { name: 'Search instead' }).click();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/places:searchText', async (route) => {
    if (route.request().postDataJSON().textQuery !== 'old') return route.fallback();
    await gate;
    try { await route.fulfill({ json: { places: [{ id: 'late', displayName: { text: 'Late outside restaurant' }, types: ['restaurant'], location: { latitude: 3.073, longitude: 101.607 } }] } }); }
    catch { /* The request may already have been cancelled. */ }
  });
  const requested = page.waitForRequest((request) => request.url().includes('places:searchText'));
  await page.getByLabel('Search for food').fill('old');
  await requested;
  await page.getByRole('button', { name: 'Inside this mall', exact: true }).click();
  release();
  await expect(page.getByLabel('Search for food')).toHaveValue('');
  await page.getByLabel('Search for food').fill('fresh');
  await expect(page.getByText('Tenant Noodles', { exact: true })).toBeVisible();
  await expect(page.getByText('Late outside restaurant', { exact: true })).toHaveCount(0);
});

test('inside-only cache survives reload and cannot share entries with nearby searches', async ({ page }) => {
  await setup(page, { tenants: 12 });
  await selectMall(page);
  await expect(page.getByRole('button', { name: /^Spin!$/ })).toBeEnabled();
  await page.getByRole('button', { name: 'Around this mall', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Filters · 5 km · 14 places/ })).toBeVisible();
  await page.getByRole('button', { name: 'Inside this mall', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Filters · Inside mall · 12 places/ })).toBeVisible();
  await page.route('**/places:searchNearby', (route) => route.fulfill({ status: 503, json: { error: { message: 'Must use scoped cache' } } }));
  await page.reload();
  await expect(page.getByRole('button', { name: /^Filters · Inside mall · 12 places/ })).toBeVisible();
  await page.getByRole('button', { name: 'Review this round' }).click();
  await expect(page.getByRole('region', { name: 'Review this round' }).getByText('Outside branch', { exact: true })).toHaveCount(0);
  const snapshots = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('eatspin-nearby-cache'); request.onsuccess = () => resolve(request.result); request.onerror = reject;
    });
    const values = await new Promise<{ mallPlaceId?: string; placeIds: string[] }[]>((resolve, reject) => {
      const request = db.transaction('snapshots').objectStore('snapshots').getAll(); request.onsuccess = () => resolve(request.result); request.onerror = reject;
    }); db.close(); return values;
  });
  expect(snapshots.some((snapshot) => snapshot.mallPlaceId === mallId && snapshot.placeIds.length === 12)).toBe(true);
  expect(snapshots.some((snapshot) => !snapshot.mallPlaceId && snapshot.placeIds.length === 14)).toBe(true);
  // Even a different mall at exactly the same coordinates cannot reuse these tenants.
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('eatspin:search-destination:v1')!);
    saved.destination.placeId = 'other-mall'; saved.destination.mallPlaceId = 'other-mall';
    localStorage.setItem('eatspin:search-destination:v1', JSON.stringify(saved));
  });
  await page.reload();
  await expect(page.getByText('Unable to verify mall restaurants.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Spin!$/ })).toHaveCount(0);
});

test('coordinate expiry preserves inside-only intent through reload until a location is explicitly chosen', async ({ page }) => {
  await setup(page);
  await selectMall(page);
  await expect(page.getByRole('button', { name: /^Spin!$/ })).toBeEnabled();
  await page.clock.setFixedTime(new Date('2026-12-07T04:00:00Z'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText(/Your saved mall location expired/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Spin!$/ })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(/Your saved mall location expired/)).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('eatspin:search-destination:v1')!));
  expect(saved.pendingMallPlaceId).toBe(mallId);
  expect(saved.destination).toBeNull();
  await page.getByRole('button', { name: 'Share My Location', exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('eatspin:search-destination:v1')!).pendingMallPlaceId)).toBeUndefined();
});

test('scope controls fit phones and desktop and remain usable above the keyboard', async ({ page }) => {
  await setup(page);
  await selectMall(page);
  await expect(page.getByRole('button', { name: /^Spin!$/ })).toBeEnabled();
  for (const width of [360, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const bounds = await page.getByRole('button', { name: 'Inside this mall', exact: true }).boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: `tmp/mall-preview/implemented-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Search instead' }).click();
  await page.evaluate(() => {
    Object.defineProperties(window.visualViewport!, {
      height: { configurable: true, value: 400 }, offsetTop: { configurable: true, value: 0 },
    });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await page.getByRole('button', { name: 'Change area', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Where are you heading?' });
  await expect(page.getByLabel('Search destination')).toBeVisible();
  await expect.poll(async () => {
    const bounds = await dialog.boundingBox(); return bounds!.y + bounds!.height;
  }).toBeLessThanOrEqual(400);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Change area', exact: true })).toBeFocused();
});

// The in-memory filter cache must not resurrect a previously eligible tenant.
test('refreshed membership removes a restaurant that no longer matches the mall', async ({ page }) => {
  const options = { withdrawFirst: false };
  await setup(page, options);
  await selectMall(page);
  await expect(page.getByRole('button', { name: /^Filters · Inside mall · 2 places/ })).toBeVisible();
  options.withdrawFirst = true;
  await page.getByRole('button', { name: 'Around this mall', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Filters · 5 km · 4 places/ })).toBeVisible();
  await page.getByRole('button', { name: 'Inside this mall', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Filters · Inside mall · 1 place$/ })).toBeVisible();
  await page.getByRole('button', { name: 'Review this round' }).click();
  const round = page.getByRole('region', { name: 'Review this round' });
  await expect(round.getByText('Tenant Sushi', { exact: true })).toBeVisible();
  await expect(round.getByText('Tenant Noodles', { exact: true })).toHaveCount(0);
});
