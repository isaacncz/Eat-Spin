import { test, expect } from '@playwright/test';
import { openSpinScreenWithLocation, setLunchtimeClock } from './spin-helpers';

// Penang: the bundled fallback places are around here, so a wheel exists without Google Places.
test.use({
  geolocation: { latitude: 5.4146, longitude: 100.3296 },
  permissions: ['geolocation'],
});

type GeoCalls = { current: number; watch: number };
const geoCalls = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as unknown as { __geoCalls: GeoCalls }).__geoCalls);

test('device location is one fix: moving does not rebuild the wheel, the picker re-anchors', async ({ page, context }) => {
  await setLunchtimeClock(page);
  await page.addInitScript(() => {
    const calls = { current: 0, watch: 0 };
    (window as unknown as { __geoCalls: GeoCalls }).__geoCalls = calls;
    const geo = navigator.geolocation;
    const getCurrentPosition = geo.getCurrentPosition.bind(geo);
    const watchPosition = geo.watchPosition.bind(geo);
    geo.getCurrentPosition = (...args) => { calls.current++; return getCurrentPosition(...args); };
    geo.watchPosition = (...args) => { calls.watch++; return watchPosition(...args); };
  });
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
