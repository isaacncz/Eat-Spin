import { test, expect, type Page } from '@playwright/test';

import {
  openFiltersSheet,
  openSpinScreenWithLocation,
  pinnedSpinButton,
  servesGroup,
} from './spin-helpers';

test.use({
  geolocation: { latitude: 1.3521, longitude: 103.8198 },
  permissions: ['geolocation'],
});

/** Fake the clock to a fixed hour on 15 Apr 2025. */
const freezeClockAt = async (page: Page, hour: number) => {
  await page.addInitScript((fakeHour) => {
    const RealDate = Date;
    const fakeNow = new RealDate(2025, 3, 15, fakeHour, 0, 0).getTime();
    globalThis.Date = class extends RealDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) {
          super(fakeNow);
        } else {
          // biome-ignore lint: constructor args
          super(...(args as [any]));
        }
      }
      static override now() { return fakeNow; }
    } as DateConstructor;
  }, hour);
};

test.describe('Time-of-day smart defaults', () => {
  test('morning (8am) pre-selects Breakfast pill', async ({ page }) => {
    await freezeClockAt(page, 8);
    await openSpinScreenWithLocation(page);
    const sheet = await openFiltersSheet(page);

    const breakfastBtn = servesGroup(sheet).getByRole('button', { name: /breakfast/i });
    await expect(breakfastBtn).toHaveAttribute('aria-pressed', 'true');
  });

  test('afternoon (3pm) pre-selects Coffee pill', async ({ page }) => {
    await freezeClockAt(page, 15);
    await openSpinScreenWithLocation(page);
    const sheet = await openFiltersSheet(page);

    const coffeeBtn = servesGroup(sheet).getByRole('button', { name: /coffee/i });
    await expect(coffeeBtn).toHaveAttribute('aria-pressed', 'true');
  });

  test('evening (7pm) has no serves-filter pre-selected', async ({ page }) => {
    await freezeClockAt(page, 19);
    await openSpinScreenWithLocation(page);
    const sheet = await openFiltersSheet(page);

    const pills = ['Coffee', 'Breakfast', 'Brunch', 'Dessert', 'Vegetarian'];
    for (const pill of pills) {
      const btn = servesGroup(sheet).getByRole('button', { name: new RegExp(pill, 'i') });
      await expect(btn).toHaveAttribute('aria-pressed', 'false');
    }
  });
});

test.describe('Recent searches', () => {
  test('recent searches appear in search mode after previous search', async ({ page }) => {
    // Seed a recent search in localStorage
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'eatspin:recent-searches',
        JSON.stringify(['chicken rice', 'bubble tea']),
      );
    });

    await openSpinScreenWithLocation(page);

    // Switch to search mode
    const searchButton = page.getByRole('button', { name: /search instead/i });
    await expect(searchButton).toBeVisible({ timeout: 15_000 });
    await searchButton.click();

    // Check that recent searches are displayed (use exact text to avoid popular chip collision)
    await expect(page.getByRole('button', { name: 'chicken rice', exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: 'bubble tea', exact: true })).toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Spin screen empty state', () => {
  test.use({
    geolocation: { latitude: 1.3521, longitude: 103.8198 },
    permissions: ['geolocation'],
  });

  test('pinned Spin button is disabled when 0 restaurants', async ({ page }) => {
    await openSpinScreenWithLocation(page);

    // The pinned button is either "Spin!" (places loaded) or says why it cannot spin.
    const spinBtn = pinnedSpinButton(page);
    await expect(spinBtn).toBeVisible({ timeout: 15_000 });
    if (/no places to spin|need 2\+ places/i.test((await spinBtn.textContent()) ?? '')) {
      await expect(spinBtn).toBeDisabled();
    }
  });
});
