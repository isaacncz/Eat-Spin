import { test, expect } from '@playwright/test';

test.use({
  geolocation: { latitude: 1.3521, longitude: 103.8198 },
  permissions: ['geolocation'],
});

test.describe('Time-of-day smart defaults', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('eatspin:first-run-onboarding-seen', '1');
    });
  });

  test('morning (8am) pre-selects Breakfast pill', async ({ page }) => {
    // Fake the clock to 8:00 AM
    await page.addInitScript(() => {
      const RealDate = Date;
      const fakeNow = new RealDate(2025, 3, 15, 8, 0, 0).getTime();
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

    await page.goto('/');
    const locationBtn = page.getByRole('button', { name: /share my location/i });
    if (await locationBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await locationBtn.click();
    }
    await expect(page.getByText(/i'm looking for/i)).toBeVisible({ timeout: 15_000 });

    const breakfastBtn = page.getByRole('button', { name: /breakfast/i });
    await expect(breakfastBtn).toHaveAttribute('aria-pressed', 'true');
  });

  test('afternoon (3pm) pre-selects Coffee pill', async ({ page }) => {
    await page.addInitScript(() => {
      const RealDate = Date;
      const fakeNow = new RealDate(2025, 3, 15, 15, 0, 0).getTime();
      globalThis.Date = class extends RealDate {
        constructor(...args: unknown[]) {
          if (args.length === 0) {
            super(fakeNow);
          } else {
            super(...(args as [any]));
          }
        }
        static override now() { return fakeNow; }
      } as DateConstructor;
    });

    await page.goto('/');
    const locationBtn = page.getByRole('button', { name: /share my location/i });
    if (await locationBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await locationBtn.click();
    }
    await expect(page.getByText(/i'm looking for/i)).toBeVisible({ timeout: 15_000 });

    const coffeeBtn = page.getByRole('button', { name: /coffee/i });
    await expect(coffeeBtn).toHaveAttribute('aria-pressed', 'true');
  });

  test('evening (7pm) has no serves-filter pre-selected', async ({ page }) => {
    await page.addInitScript(() => {
      const RealDate = Date;
      const fakeNow = new RealDate(2025, 3, 15, 19, 0, 0).getTime();
      globalThis.Date = class extends RealDate {
        constructor(...args: unknown[]) {
          if (args.length === 0) {
            super(fakeNow);
          } else {
            super(...(args as [any]));
          }
        }
        static override now() { return fakeNow; }
      } as DateConstructor;
    });

    await page.goto('/');
    const locationBtn = page.getByRole('button', { name: /share my location/i });
    if (await locationBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await locationBtn.click();
    }
    await expect(page.getByText(/i'm looking for/i)).toBeVisible({ timeout: 15_000 });

    const pills = ['Coffee', 'Breakfast', 'Brunch', 'Dessert', 'Vegetarian'];
    for (const pill of pills) {
      const btn = page.getByRole('button', { name: new RegExp(pill, 'i') });
      await expect(btn).toHaveAttribute('aria-pressed', 'false');
    }
  });
});

test.describe('Recent searches', () => {
  test('recent searches appear in search mode after previous search', async ({ page }) => {
    // Seed a recent search in localStorage
    await page.addInitScript(() => {
      window.localStorage.setItem('eatspin:first-run-onboarding-seen', '1');
      window.localStorage.setItem(
        'eatspin:recent-searches',
        JSON.stringify(['chicken rice', 'bubble tea']),
      );
    });

    await page.goto('/');
    const locationBtn = page.getByRole('button', { name: /share my location/i });
    if (await locationBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await locationBtn.click();
    }

    // Switch to search mode
    const searchLink = page.getByText(/search instead/i);
    await expect(searchLink).toBeVisible({ timeout: 15_000 });
    await searchLink.click();

    // Check that recent searches are displayed (use exact text to avoid popular chip collision)
    await expect(page.getByRole('button', { name: 'chicken rice', exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: 'bubble tea', exact: true })).toBeVisible({ timeout: 5_000 });
  });
});
