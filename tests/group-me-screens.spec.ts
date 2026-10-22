import { test, expect, type Page } from '@playwright/test';

import { setLunchtimeClock } from './spin-helpers';

const tab = (page: Page, label: 'Spin' | 'My list' | 'Group' | 'Me') =>
  page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: new RegExp(`^${label}`) });

const skipOnboarding = (page: Page) =>
  page.addInitScript(() => {
    window.localStorage.setItem('eatspin:first-run-onboarding-seen', '1');
  });

// The Group screen inside a room needs a live Firebase project, so these specs cover the
// screen a person sees before joining. The in-room layout was checked by hand.
test.describe('Group screen (not in a room)', () => {
  test('shows the create and join cards with labelled fields', async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/');
    await tab(page, 'Group').click();

    await expect(page.getByRole('heading', { name: 'Group spin', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create a room' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Join a room' })).toBeVisible();
    await expect(page.getByLabel('Your name')).toBeVisible();
    await expect(page.getByLabel('Room code or link')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create room link' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join room' })).toBeVisible();
    // Nothing is pinned above the tab bar until the person is in a room.
    await expect(page.getByRole('button', { name: 'Start spin for everyone' })).toHaveCount(0);
  });

  test('a shared room link opens Group with the code in the join field', async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/?room=abc123');

    await expect(tab(page, 'Group')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByLabel('Room code or link')).toHaveValue('ABC123');
  });
});

const seedGame = (page: Page) =>
  page.addInitScript(() => {
    // 1840 XP = level 4 with 340 / 500 XP into the level
    window.localStorage.setItem('eatspin:game-v1', JSON.stringify({ v: 1, xp: 1840, coins: 120, awardedOn: {} }));
  });

const seedFavourites = async (page: Page) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const place = (name: string, index: number) => ({
      id: `fav-e2e-${index}`,
      restaurant: {
        id: `fav-r-${index}`,
        name,
        category: ['street food'],
        address: `${index} Jalan Test`,
        coordinates: { lat: 5.4, lng: 100.3 },
        hours: {},
        rating: 4,
        priceRange: '$',
      },
      savedAt: 1000 + index,
      savedFrom: 'lets-go',
      location: { lat: 5.4, lng: 100.3 },
      visitCount: [3, 9, 6, 1][index],
      userRating: 'suggest',
      feedbackPending: false,
    });
    const entries = ['Kheng Cafe', 'Nasi Kandar Pelita', 'CKT Stall', 'Mee Hoon Corner'].map(place);

    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('eatspin-favourites', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('favourites')) {
          const store = db.createObjectStore('favourites', { keyPath: 'id' });
          store.createIndex('by-rating', 'userRating', { unique: false });
          store.createIndex('by-savedAt', 'savedAt', { unique: false });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('favourites', 'readwrite');
        entries.forEach((entry) => tx.objectStore('favourites').put(entry));
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
  });
};

test.describe('Me screen', () => {
  test('shows the level card with an XP progress bar and the stat tiles', async ({ page }) => {
    await skipOnboarding(page);
    await seedGame(page);
    await page.goto('/');
    await tab(page, 'Me').click();

    await expect(page.getByRole('heading', { name: 'Me', exact: true })).toBeVisible();
    await expect(page.getByText('Level 4 Foodie')).toBeVisible();
    await expect(page.getByText('160 XP to level 5')).toBeVisible();

    const bar = page.getByRole('progressbar', { name: /experience points/i });
    await expect(bar).toHaveAttribute('aria-valuenow', '340');
    await expect(bar).toHaveAttribute('aria-valuemax', '500');

    const stats = page.getByRole('region', { name: 'Stats' });
    await expect(stats.getByText('Day streak')).toBeVisible();
    await expect(stats.getByText('Coins')).toBeVisible();
    await expect(stats.getByText('Spins', { exact: true })).toBeVisible();
    await expect(stats.getByText('120')).toBeVisible();
  });

  test('uses one level card: the HUD is not shown twice', async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/');
    await tab(page, 'Me').click();

    await expect(page.getByRole('progressbar', { name: /experience points/i })).toHaveCount(1);
    await expect(page.getByRole('region', { name: 'Your progress' })).toHaveCount(0);
  });

  test('lists the three most visited places, most visited first', async ({ page }) => {
    await skipOnboarding(page);
    await seedFavourites(page);
    await page.reload();
    await tab(page, 'Me').click();

    const rows = page.getByRole('region', { name: 'Most visited' }).getByRole('listitem');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('Nasi Kandar Pelita');
    await expect(rows.nth(0)).toContainText('9 visits');
    await expect(rows.nth(1)).toContainText('CKT Stall');
    await expect(rows.nth(2)).toContainText('Kheng Cafe');
  });

  test('shows an empty state when nothing has been visited', async ({ page }) => {
    await skipOnboarding(page);
    await page.goto('/');
    await tab(page, 'Me').click();

    await expect(page.getByRole('region', { name: 'Most visited' })).toContainText(/places you visit most/i);
  });
});

// The landing sections sit behind Me > About EatSpin. Their "start" buttons must open the
// Spin tab, since the old scroll target (#app-main-section) no longer exists in the shell.
test.describe('Me screen > About EatSpin start buttons', () => {
  // Penang: the bundled fallback places are around here, so the wheel has places to show.
  test.use({
    geolocation: { latitude: 5.4146, longitude: 100.3296 },
    permissions: ['geolocation'],
  });

  const startButtons = [
    { section: 'How it works', button: 'Try It Now' },
    { section: 'Ready to Spin', button: 'Start Spinning Now' },
  ] as const;

  for (const { section, button } of startButtons) {
    test(`the ${section} "${button}" button lands on the Spin tab`, async ({ page }) => {
      await setLunchtimeClock(page);
      await skipOnboarding(page);
      await page.goto('/');
      await tab(page, 'Me').click();
      await expect(tab(page, 'Me')).toHaveAttribute('aria-current', 'page');

      await page.getByRole('button', { name: 'About EatSpin' }).click();
      const start = page.getByRole('button', { name: new RegExp(button, 'i') });
      await start.scrollIntoViewIfNeeded();
      await expect(start).toBeVisible();
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
      await start.click();

      await expect(tab(page, 'Spin')).toHaveAttribute('aria-current', 'page');
      await expect(tab(page, 'Me')).not.toHaveAttribute('aria-current', 'page');
      await expect(page.getByRole('heading', { name: 'Me', exact: true })).toHaveCount(0);

      // The shell scrolls to the top on a tab change, so the Spin tab opens at its heading.
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

      const shareLocation = page.getByRole('button', { name: /share my location/i });
      if (await shareLocation.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await shareLocation.click();
      }
      await expect(page.locator('main .aspect-square').first()).toBeVisible({ timeout: 20_000 });
    });
  }
});
