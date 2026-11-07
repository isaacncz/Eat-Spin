import { test, expect, type Page } from '@playwright/test';
import { openSpinScreenWithLocation, pinnedSpinButton, setLunchtimeClock } from './spin-helpers';

// Penang: the bundled fallback places are around here, so a wheel exists without Google Places.
test.use({
  geolocation: { latitude: 5.4146, longitude: 100.3296 },
  permissions: ['geolocation'],
});

type GeoWindow = Window & {
  __geoCalls: { current: number; watch: number };
  /** While true, getCurrentPosition waits until __releaseGeo() before answering. */
  __holdGeo?: boolean;
  __releaseGeo?: () => void;
  /** While true, getCurrentPosition never calls back (a dismissed permission prompt). */
  __silentGeo?: boolean;
};
const geoCalls = (page: Page) => page.evaluate(() => (window as unknown as GeoWindow).__geoCalls);

/** Counts geolocation calls and lets a test hold or silence the answer to getCurrentPosition. */
const instrumentGeolocation = (page: Page) => page.addInitScript(() => {
  const w = window as unknown as GeoWindow;
  w.__geoCalls = { current: 0, watch: 0 };
  const geo = navigator.geolocation;
  const getCurrentPosition = geo.getCurrentPosition.bind(geo);
  const watchPosition = geo.watchPosition.bind(geo);
  geo.getCurrentPosition = (...args) => {
    w.__geoCalls.current++;
    if (w.__silentGeo) return;
    if (w.__holdGeo) { w.__releaseGeo = () => getCurrentPosition(...args); return; }
    getCurrentPosition(...args);
  };
  geo.watchPosition = (...args) => { w.__geoCalls.watch++; return watchPosition(...args); };
});

test.beforeEach(async ({ page }) => {
  await instrumentGeolocation(page);
});

test('device location is one fix: moving does not rebuild the wheel, the picker re-anchors', async ({ page, context }) => {
  await setLunchtimeClock(page);
  await openSpinScreenWithLocation(page);
  await expect(page.getByRole('button', { name: /^spin!$/i })).toBeEnabled({ timeout: 15_000 });
  const disc = page.locator('[data-wheel-disc]');
  await disc.evaluate((el) => el.setAttribute('data-original-disc', 'yes'));
  expect(await geoCalls(page)).toEqual({ current: 1, watch: 0 });

  // Move ~470 m, well past the old 100 m threshold: the old continuous watch rebuilt the wheel
  // and re-searched here. It stays inside the 5 km radius of the bundled Penang places.
  await context.setGeolocation({ latitude: 5.4176, longitude: 100.3326 });
  await page.waitForTimeout(1_500);
  await expect(page.locator('[data-original-disc="yes"]')).toHaveCount(1);
  expect(await geoCalls(page)).toEqual({ current: 1, watch: 0 });

  // An explicit "Use my current location" takes one new fix and moves the anchor.
  await page.getByRole('button', { name: /search around/i }).click();
  await page.getByRole('button', { name: 'Use my current location' }).click();
  await expect.poll(() => geoCalls(page)).toEqual({ current: 2, watch: 0 });
  await expect(page.locator('[data-original-disc="yes"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^spin!$/i })).toBeEnabled({ timeout: 15_000 });
});

test('while a new fix is pending, the previous fix is not used for a wheel', async ({ page }) => {
  await setLunchtimeClock(page);
  await openSpinScreenWithLocation(page);
  await expect(page.getByRole('button', { name: /^spin!$/i })).toBeEnabled({ timeout: 15_000 });

  await page.evaluate(() => { (window as unknown as GeoWindow).__holdGeo = true; });
  await page.getByRole('button', { name: /search around/i }).click();
  await page.getByRole('button', { name: 'Use my current location' }).click();
  await expect(pinnedSpinButton(page)).toHaveAccessibleName(/locating…/i);
  await expect(page.locator('[data-wheel-disc]')).toHaveCount(0);

  await page.evaluate(() => {
    const w = window as unknown as GeoWindow;
    w.__holdGeo = false;
    w.__releaseGeo?.();
  });
  await expect(page.getByRole('button', { name: /^spin!$/i })).toBeEnabled({ timeout: 15_000 });
  await expect(page.locator('[data-wheel-disc]')).toBeVisible();
});

test('a request that never answers times out and can be retried', async ({ page }) => {
  // A lunchtime clock that still ticks, so the bundled places are open; the test then jumps ahead.
  await page.clock.install({ time: new Date(2025, 3, 16, 12, 30) });
  await page.addInitScript(() => localStorage.setItem('eatspin:first-run-onboarding-seen', '1'));
  await page.goto('/');
  await page.evaluate(() => { (window as unknown as GeoWindow).__silentGeo = true; });
  await page.getByRole('button', { name: /share my location/i }).click();
  await expect(pinnedSpinButton(page)).toHaveAccessibleName(/locating…/i);

  await page.clock.fastForward(16_000);
  await expect(page.getByRole('alert')).toContainText(/timed out/i);
  await expect(page.getByRole('button', { name: /share my location/i })).toBeEnabled();

  await page.evaluate(() => { (window as unknown as GeoWindow).__silentGeo = false; });
  await page.getByRole('button', { name: /share my location/i }).click();
  await expect(page.getByRole('button', { name: /^spin!$/i })).toBeEnabled({ timeout: 15_000 });
  expect(await geoCalls(page)).toEqual({ current: 2, watch: 0 });
});
