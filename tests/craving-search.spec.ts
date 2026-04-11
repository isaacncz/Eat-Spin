import { test, expect } from '@playwright/test';

test.use({
  geolocation: { latitude: 1.3521, longitude: 103.8198 },
  permissions: ['geolocation'],
});

test.describe('Craving search', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('eatspin:first-run-onboarding-seen', '1');
    });
    await page.goto('/');

    // Grant location
    const locationBtn = page.getByRole('button', { name: /share my location/i });
    if (await locationBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await locationBtn.click();
    }

    // Wait for spin mode to be ready
    await expect(page.getByRole('button', { name: /spin now/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('"Search instead" link is visible', async ({ page }) => {
    await expect(page.getByText(/search instead/i)).toBeVisible();
  });

  test('clicking search link shows search input', async ({ page }) => {
    await page.getByText(/search instead/i).click();

    const input = page.getByLabel(/search for food/i);
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
  });

  test('popular chips are visible in search mode', async ({ page }) => {
    await page.getByText(/search instead/i).click();

    // Scope to the "Popular" section inside the search area
    const popularSection = page.getByText('Popular').locator('..');
    const chips = ['Coffee', 'Chicken Rice', 'Bubble Tea', 'Pizza'];
    for (const chip of chips) {
      await expect(
        popularSection.getByRole('button', { name: new RegExp(chip, 'i') }),
      ).toBeVisible();
    }
  });

  test('"Back to Spin" returns to spin mode', async ({ page }) => {
    await page.getByText(/search instead/i).click();
    await expect(page.getByLabel(/search for food/i)).toBeVisible();

    await page.getByText(/back to spin/i).click();
    await expect(page.getByRole('button', { name: /spin now/i })).toBeVisible();
  });

  test('typing in search input shows clear button', async ({ page }) => {
    await page.getByText(/search instead/i).click();

    const input = page.getByLabel(/search for food/i);
    await input.fill('coffee');

    await expect(page.getByLabel(/clear search/i)).toBeVisible();
  });

  test('clear button resets search', async ({ page }) => {
    await page.getByText(/search instead/i).click();

    const input = page.getByLabel(/search for food/i);
    await input.fill('coffee');
    await page.getByLabel(/clear search/i).click();

    await expect(input).toHaveValue('');
  });
});
