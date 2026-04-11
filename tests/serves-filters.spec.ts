import { test, expect } from '@playwright/test';

// Grant geolocation so the browser doesn't prompt
test.use({
  geolocation: { latitude: 1.3521, longitude: 103.8198 }, // Singapore
  permissions: ['geolocation'],
});

test.describe('Serves-filter pills', () => {
  test.beforeEach(async ({ page }) => {
    // Skip the first-run onboarding modal
    await page.addInitScript(() => {
      window.localStorage.setItem('eatspin:first-run-onboarding-seen', '1');
    });

    await page.goto('/');
    await expect(page.locator('text=/What.*for/i').first()).toBeVisible({
      timeout: 10_000,
    });

    // Click "Share My Location" to trigger geolocation
    const locationBtn = page.getByRole('button', { name: /share my location/i });
    if (await locationBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await locationBtn.click();
    }

    // Wait for pills to appear
    await expect(page.getByText(/i'm looking for/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  test('filter pill group renders with correct ARIA role', async ({ page }) => {
    const group = page.getByRole('group', { name: /filter by what.*served/i });
    await expect(group).toBeVisible();
  });

  test('all 7 filter pills are visible', async ({ page }) => {
    const pills = ['Coffee', 'Breakfast', 'Brunch', 'Dessert', 'Vegetarian', 'Delivery', 'Takeout'];
    for (const pill of pills) {
      await expect(
        page.getByRole('button', { name: new RegExp(pill, 'i') }),
      ).toBeVisible();
    }
  });

  test('pills start un-pressed', async ({ page }) => {
    const coffeeBtn = page.getByRole('button', { name: /coffee/i });
    await expect(coffeeBtn).toHaveAttribute('aria-pressed', 'false');
  });

  test('tapping a pill toggles aria-pressed', async ({ page }) => {
    const coffeeBtn = page.getByRole('button', { name: /coffee/i });

    await coffeeBtn.click();
    await expect(coffeeBtn).toHaveAttribute('aria-pressed', 'true');

    await coffeeBtn.click();
    await expect(coffeeBtn).toHaveAttribute('aria-pressed', 'false');
  });

  test('multiple pills can be active simultaneously', async ({ page }) => {
    const coffeeBtn = page.getByRole('button', { name: /coffee/i });
    const deliveryBtn = page.getByRole('button', { name: /delivery/i });

    await coffeeBtn.click();
    await deliveryBtn.click();

    await expect(coffeeBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(deliveryBtn).toHaveAttribute('aria-pressed', 'true');
  });
});
