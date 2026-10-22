import { test, expect } from '@playwright/test';

import { filtersSheet, openFiltersSheet, openSpinScreenWithLocation, servesGroup } from './spin-helpers';

// Grant geolocation so the browser doesn't prompt
test.use({
  geolocation: { latitude: 1.3521, longitude: 103.8198 }, // Singapore
  permissions: ['geolocation'],
});

test.describe('Serves filters (in the Filters sheet)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // Fix clock to 7pm so time-of-day defaults don't pre-select pills
      const RealDate = Date;
      const fakeNow = new RealDate(2025, 3, 15, 19, 0, 0).getTime();
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
    });

    await openSpinScreenWithLocation(page);
    await openFiltersSheet(page);
  });

  test('filter pill group renders with correct ARIA role', async ({ page }) => {
    await expect(servesGroup(filtersSheet(page))).toBeVisible();
  });

  test('all 7 filter pills are visible', async ({ page }) => {
    const pills = ['Coffee', 'Breakfast', 'Brunch', 'Dessert', 'Vegetarian', 'Delivery', 'Takeout'];
    // Scoped to the group: Breakfast, Brunch, Dessert and Vegetarian are also food types.
    const group = servesGroup(filtersSheet(page));
    for (const pill of pills) {
      await expect(group.getByRole('button', { name: new RegExp(pill, 'i') })).toBeVisible();
    }
  });

  test('pills start un-pressed', async ({ page }) => {
    const coffeeBtn = servesGroup(filtersSheet(page)).getByRole('button', { name: /coffee/i });
    await expect(coffeeBtn).toHaveAttribute('aria-pressed', 'false');
  });

  test('tapping a pill toggles aria-pressed', async ({ page }) => {
    const coffeeBtn = servesGroup(filtersSheet(page)).getByRole('button', { name: /coffee/i });

    await coffeeBtn.click();
    await expect(coffeeBtn).toHaveAttribute('aria-pressed', 'true');

    await coffeeBtn.click();
    await expect(coffeeBtn).toHaveAttribute('aria-pressed', 'false');
  });

  test('multiple pills can be active simultaneously', async ({ page }) => {
    const group = servesGroup(filtersSheet(page));
    const coffeeBtn = group.getByRole('button', { name: /coffee/i });
    const deliveryBtn = group.getByRole('button', { name: /delivery/i });

    await coffeeBtn.click();
    await deliveryBtn.click();

    await expect(coffeeBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(deliveryBtn).toHaveAttribute('aria-pressed', 'true');
  });
});
