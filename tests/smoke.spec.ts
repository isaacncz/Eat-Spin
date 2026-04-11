import { test, expect } from '@playwright/test';

test.describe('Smoke tests', () => {
  test('homepage loads with correct title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/EatSpin/);
  });

  test('hero section renders with meal-time heading', async ({ page }) => {
    await page.goto('/');
    // The heading contains dynamic meal time: "What's for breakfast/lunch/dinner/eating?"
    const heading = page.locator('text=/What.*for/i').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('mood selector buttons are visible', async ({ page }) => {
    await page.goto('/');
    const moods = ['Quick Bite', 'Treat Myself', 'Healthy', 'Surprise Me'];
    for (const mood of moods) {
      await expect(page.getByText(mood, { exact: false }).first()).toBeVisible({ timeout: 10_000 });
    }
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
});
