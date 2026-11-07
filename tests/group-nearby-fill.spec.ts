import { test, expect, type Page } from '@playwright/test';

const fixtureState = (page: Page) => page.evaluate(() => (window as unknown as {
  groupAppHarness: { state: { roomListNames: string[]; roomPlaceIds: Record<string, string> } };
}).groupAppHarness.state);

async function setup(page: Page, { gps }: { gps: boolean }) {
  await page.clock.setFixedTime(new Date('2026-10-23T12:30:00Z'));
  await page.addInitScript((allowGps) => {
    localStorage.setItem('eatspin:first-run-onboarding-seen', '1');
    Object.defineProperty(navigator, 'geolocation', { value: {
      getCurrentPosition: (ok: (p: { coords: { latitude: number; longitude: number } }) => void, fail: (e: { message: string }) => void) => {
        if (allowGps) ok({ coords: { latitude: 1.35, longitude: 103.82 } }); else fail({ message: 'Permission denied' });
      },
    } });
  }, gps);
  await page.route('**/src/hooks/useFirebaseGroupRoom.ts*', route => route.fulfill({
    contentType: 'application/javascript', body: "export * from '/src/test/group-app-hook-fixture.ts';",
  }));
  // No live Firebase or Google project is involved; every Places request is intercepted.
  await page.route('**/src/lib/firebase.ts*', route => route.fulfill({
    contentType: 'application/javascript', body: 'export const firebaseDb=null; export const firebaseAuth=null; export const isFirebaseConfigured=false; export const firebaseConfigError=null; export async function ensureAnonymousAuthUser(){ throw new Error("No live Firebase in UI fixture"); }',
  }));
  await page.route('**/places.googleapis.com/**', async (route) => {
    const url = route.request().url();
    if (url.includes('places:autocomplete')) return route.fulfill({ json: { suggestions: [{ placePrediction: { placeId: 'kiara', structuredFormat: { mainText: { text: 'Mont Kiara' }, secondaryText: { text: 'Kuala Lumpur, Malaysia' } } } }] } });
    if (url.includes('/places/kiara')) return route.fulfill({ json: { location: { latitude: 3.17, longitude: 101.65 }, formattedAddress: 'Kuala Lumpur, Malaysia' } });
    const center = route.request().postDataJSON().locationRestriction?.circle?.center;
    const prefix = center?.latitude > 3 ? 'Kiara' : 'Home';
    const names = [`${prefix} Noodles`, `${prefix} Extraordinarily Long Seafood House`, `${prefix} Sushi`];
    const places = names.map((name, i) => ({ id: `${prefix.toLowerCase()}-${i}`, displayName: { text: name }, formattedAddress: 'Somewhere', location: { latitude: center.latitude + 0.001 * i, longitude: center.longitude }, rating: 4.5, userRatingCount: 100, types: ['restaurant'], currentOpeningHours: { openNow: true }, regularOpeningHours: { periods: Array.from({ length: 7 }, (_, day) => ({ open: { day, hour: 0, minute: 0 }, close: { day, hour: 23, minute: 59 } })) } }));
    return route.fulfill({ json: { places } });
  });
}

test.skip(!process.env.VITE_GOOGLE_MAPS_API_KEY, 'Needs a dummy VITE_GOOGLE_MAPS_API_KEY for the dev server; requests are mocked.');

test('host fills the room from their location and shares ticked places with place IDs', async ({ page }) => {
  await setup(page, { gps: true });
  await page.goto('/?room=ROOM42');
  await page.getByRole('button', { name: /^Add places/ }).click();
  await expect(page.getByRole('tab', { name: 'Nearby' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Use my location', exact: true }).click();
  await page.getByRole('button', { name: 'Find places', exact: true }).click();
  await expect(page.getByText('3 of 3 places selected')).toBeVisible();
  await expect(page.getByText('Home Extraordinarily Lo…', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('checkbox', { name: 'Home Sushi' }).uncheck();
  await page.getByRole('button', { name: 'Share 2 places with room' }).click();
  await page.getByRole('button', { name: 'Share nearby places', exact: true }).click();
  await expect.poll(async () => (await fixtureState(page)).roomListNames).toEqual(['Home Noodles', 'Home Extraordinarily Lo…']);
  expect((await fixtureState(page)).roomPlaceIds).toEqual({ 'home noodles': 'home-0', 'home extraordinarily lo…': 'home-1' });
  await expect(page.getByRole('dialog', { name: 'Add places' })).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Places in this room' }).getByText('Home Noodles')).toBeVisible();
});

test('host without GPS searches an area instead; members cannot fill from nearby', async ({ page }) => {
  await setup(page, { gps: false });
  await page.goto('/?room=ROOM42');
  await page.getByRole('button', { name: /^Add places/ }).click();
  await expect(page.getByRole('tab', { name: 'Nearby' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Search an area', exact: true }).click();
  await page.getByLabel('Search destination').fill('Mont Kiara');
  await page.getByRole('button', { name: /Mont Kiara Kuala Lumpur/i }).click();
  await expect(page.getByText('Around: Mont Kiara')).toBeVisible();
  await page.getByRole('button', { name: 'Find places', exact: true }).click();
  await page.getByRole('button', { name: 'Share 3 places with room' }).click();
  await page.getByRole('button', { name: 'Share nearby places', exact: true }).click();
  await expect.poll(async () => (await fixtureState(page)).roomListNames).toContain('Kiara Sushi');

  await page.evaluate(() => localStorage.removeItem('eatspin:test-group-workspace'));
  await page.goto('/?room=ROOM42&fixtureRole=member');
  await expect(page.getByRole('heading', { name: 'Group spin', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Add places/ })).toHaveCount(0);
});
