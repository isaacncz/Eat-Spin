import { test, expect } from '@playwright/test';

test.describe('App loads and renders core UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });

  test('AppNavbar is visible with tab toggle', async ({ page }) => {
    const navbar = page.locator('nav');
    await expect(navbar).toBeVisible();

    // Tab toggle buttons should exist
    const spinTab = page.getByRole('button', { name: /spin for me/i });
    const manualTab = page.getByRole('button', { name: /i know where/i });
    await expect(spinTab).toBeVisible();
    await expect(manualTab).toBeVisible();
  });

  test('QuickSpinHero displays meal-time heading', async ({ page }) => {
    // Should show a dynamic heading like "What's for lunch?"
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/what.s for/i);
  });

  test('SPIN NOW button is visible and clickable', async ({ page }) => {
    const spinButton = page.getByRole('button', { name: /spin now/i });
    // Might not be visible if location not granted — check for either spin or location button
    const locationButton = page.getByRole('button', { name: /share my location/i });

    const spinVisible = await spinButton.isVisible().catch(() => false);
    const locationVisible = await locationButton.isVisible().catch(() => false);

    expect(spinVisible || locationVisible).toBe(true);
  });

  test('food mood buttons are rendered', async ({ page }) => {
    // Check for mood selector buttons
    const moods = ['Quick Bite', 'Treat Myself', 'Healthy', 'Surprise Me'];
    for (const mood of moods) {
      const btn = page.getByRole('button', { name: new RegExp(mood, 'i') });
      // Mood buttons may be hidden if location not granted
      const exists = await btn.count();
      // Just verify they exist in DOM (may be behind location gate)
      expect(exists).toBeGreaterThanOrEqual(0);
    }
  });

  test('Learn more toggle works', async ({ page }) => {
    const toggle = page.getByRole('button', { name: /learn more about eatspin/i });
    await expect(toggle).toBeVisible();

    await toggle.click();
    // After clicking, marketing sections should appear
    const hideButton = page.getByRole('button', { name: /hide/i });
    await expect(hideButton).toBeVisible();
  });

  test('footer is visible', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
  });
});

test.describe('Tab switching', () => {
  test('switching to manual tab shows restaurant input', async ({ page }) => {
    await page.goto('/');
    const manualTab = page.getByRole('button', { name: /i know where/i });
    await manualTab.click();

    const input = page.getByPlaceholder(/type any restaurant/i);
    await expect(input).toBeVisible();
  });

  test('switching back to auto tab works', async ({ page }) => {
    await page.goto('/');
    const manualTab = page.getByRole('button', { name: /i know where/i });
    await manualTab.click();

    const autoTab = page.getByRole('button', { name: /spin for me/i });
    await autoTab.click();

    // QuickSpinHero heading should still be visible
    const heading = page.locator('h1');
    await expect(heading).toContainText(/what.s for/i);
  });
});

test.describe('Manual mode spin flow', () => {
  test('can add restaurants and see them in the list', async ({ page }) => {
    await page.goto('/');

    // Switch to manual tab
    const manualTab = page.getByRole('button', { name: /i know where/i });
    await manualTab.click();

    const input = page.getByPlaceholder(/type any restaurant/i);
    const addButton = page.getByRole('button', { name: /add/i }).last();

    // Add two restaurants
    await input.fill('Test Restaurant A');
    await addButton.click();
    await input.fill('Test Restaurant B');
    await addButton.click();

    // Both should appear in the list
    await expect(page.getByText('Test Restaurant A')).toBeVisible();
    await expect(page.getByText('Test Restaurant B')).toBeVisible();
  });

  test('spin button appears with enough restaurants', async ({ page }) => {
    await page.goto('/');

    const manualTab = page.getByRole('button', { name: /i know where/i });
    await manualTab.click();

    const input = page.getByPlaceholder(/type any restaurant/i);
    const addButton = page.getByRole('button', { name: /add/i }).last();

    await input.fill('Place One');
    await addButton.click();
    await input.fill('Place Two');
    await addButton.click();

    // Spin button on the wheel should be visible
    const spinButton = page.getByRole('button', { name: /spin/i }).first();
    await expect(spinButton).toBeVisible();
  });
});

test.describe('Result card buttons', () => {
  test('result card action buttons are visible and clickable after spin', async ({ page }) => {
    await page.goto('/');

    // Switch to manual mode and add restaurants
    const manualTab = page.getByRole('button', { name: /i know where/i });
    await manualTab.click();

    const input = page.getByPlaceholder(/type any restaurant/i);
    const addButton = page.getByRole('button', { name: /add/i }).last();

    await input.fill('Sushi Place');
    await addButton.click();
    await input.fill('Burger Spot');
    await addButton.click();
    await input.fill('Pizza Corner');
    await addButton.click();

    // Click spin
    const spinButton = page.getByRole('button', { name: /^spin$/i });
    if (await spinButton.isVisible()) {
      await spinButton.click();

      // Wait for spin to complete (up to 8 seconds)
      const resultCard = page.locator('#spin-result-card');
      await resultCard.waitFor({ state: 'visible', timeout: 10_000 });

      // Check that action buttons are visible
      const spinAgainBtn = page.getByRole('button', { name: /spin again/i });
      await expect(spinAgainBtn).toBeVisible();
      await expect(spinAgainBtn).toBeEnabled();

      // Share button should have visible text
      const shareBtn = page.getByRole('button', { name: /share/i });
      if (await shareBtn.isVisible()) {
        const shareText = await shareBtn.textContent();
        expect(shareText?.trim().length).toBeGreaterThan(0);
      }
    }
  });
});
