import { test, expect } from '@playwright/test';

test.describe('Smoke tests', () => {
  test('homepage loads with correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/EatSpin/);
  });

  test('Open Graph meta tags are present', async ({ page }) => {
    await page.goto('/');
    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute('content', /EatSpin/);

    const ogDescription = page.locator('meta[property="og:description"]');
    await expect(ogDescription).toHaveAttribute('content', /.+/);

    const ogImage = page.locator('meta[property="og:image"]');
    await expect(ogImage).toHaveAttribute('content', /.+/);
  });

  test('Twitter Card meta tags are present', async ({ page }) => {
    await page.goto('/');
    const twitterCard = page.locator('meta[name="twitter:card"]');
    await expect(twitterCard).toHaveAttribute('content', 'summary');
  });

  test('opens straight to the list-only wheel', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('eatspin:first-run-onboarding-seen', '1');
    });
    await page.goto('/');
    await expect(page.getByText(/add restaurants to start/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('tab')).toHaveCount(0);
  });
});
