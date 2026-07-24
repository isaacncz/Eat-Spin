import { test, expect } from '@playwright/test';

// Re-implements the ?wheel= encoder from src/lib/wheelShare.ts so the test can
// build a shareable link without importing app modules (no vite alias in the
// Playwright transform).
const encodeWheelParam = (name: string, names: string[]): string => {
  const payload = JSON.stringify({ n: name, r: names });
  const bytes = new TextEncoder().encode(payload);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const skipOnboarding = async (page: import('@playwright/test').Page) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('eatspin:first-run-onboarding-seen', '1');
  });
};

test.describe('Shareable wheel link', () => {
  const SHARED = ['Alpha Diner', 'Beta Bistro', 'Gamma Grill'];

  test('opening a ?wheel= link loads the shared restaurants into the manual tab', async ({ page }) => {
    await skipOnboarding(page);
    const param = encodeWheelParam('Friends night wheel', SHARED);
    await page.goto(`/?wheel=${param}`);

    // The manual tab's restaurant list should contain the shared picks.
    await expect(page.getByText('Restaurant list (3)')).toBeVisible({ timeout: 15_000 });
    for (const name of SHARED) {
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    }
  });

  test('the ?wheel= param is stripped from the URL after import', async ({ page }) => {
    await skipOnboarding(page);
    const param = encodeWheelParam('Friends night wheel', SHARED);
    await page.goto(`/?wheel=${param}`);
    await expect(page.getByText('Restaurant list (3)')).toBeVisible({ timeout: 15_000 });
    expect(new URL(page.url()).searchParams.has('wheel')).toBe(false);
  });

  test('Share wheel button is available for a wheel with 2+ places', async ({ page }) => {
    await skipOnboarding(page);
    const param = encodeWheelParam('Friends night wheel', SHARED);
    await page.goto(`/?wheel=${param}`);
    await expect(page.getByText('Restaurant list (3)')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /share wheel/i })).toBeVisible();
  });
});

test.describe('Interactive wheel controls', () => {
  test('wheel exposes a tappable spin hub and a flickable wheel', async ({ page }) => {
    await skipOnboarding(page);
    const param = encodeWheelParam('Interactive wheel', ['Alpha Diner', 'Beta Bistro', 'Gamma Grill']);
    await page.goto(`/?wheel=${param}`);
    await expect(page.getByText('Restaurant list (3)')).toBeVisible({ timeout: 15_000 });

    // Tappable center hub (exact label distinguishes it from the main CTA)
    await expect(page.getByRole('button', { name: 'Spin the wheel', exact: true })).toBeVisible();
    // Flickable wheel container
    await expect(page.getByRole('button', { name: /flick the wheel/i })).toBeVisible();
  });
});
