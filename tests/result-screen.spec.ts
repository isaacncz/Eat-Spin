import { test, expect, type Page } from '@playwright/test';

import {
  openedUrls,
  openSpinScreenWithLocation,
  recordWindowOpen,
  resultDialog,
  spinToResult,
  setLunchtimeClock,
} from './spin-helpers';

// Penang: the bundled fallback places are around here, so there is something to spin
// even when Google Places is not reachable.
test.use({
  geolocation: { latitude: 5.4146, longitude: 100.3296 },
  permissions: ['geolocation'],
});

const GAME_KEY = 'eatspin:game-v1';

const claimButton = (page: Page) => page.getByRole('button', { name: /let.s go! claim reward/i });
const yourPick = (page: Page) => page.getByRole('button', { name: /^your pick/i });

/** Opens the app with a lunchtime clock, spins, and returns the result view. */
const reachResult = async (page: Page) => {
  await setLunchtimeClock(page);
  await recordWindowOpen(page);
  await openSpinScreenWithLocation(page);
  return spinToResult(page);
};

const storedXp = (page: Page) =>
  page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as { xp: number }).xp : 0;
  }, GAME_KEY);

test.describe('Result screen', () => {
  test('opens full screen, with focus inside and the page behind locked', async ({ page }) => {
    const dialog = await reachResult(page);

    // With normal motion the floating emoji layer is added (the reduced-motion test checks it is not).
    await expect(page.locator('.celebration-layer')).toHaveCount(1);
    await expect(dialog.getByRole('heading', { name: 'You got it!' })).toBeVisible();
    // A place never visited before is epic, and the tier is spelled out in words.
    const ribbon = dialog.getByTestId('rarity-ribbon');
    await expect(ribbon).toHaveAttribute('data-rarity', 'epic');
    await expect(ribbon).toContainText('Epic place');
    await expect(ribbon).toContainText('3x XP');
    await expect(dialog.getByText('Not visited yet')).toBeVisible();
    await expect(dialog.locator('#spin-result-card h3')).not.toBeEmpty();

    const viewport = page.viewportSize()!;
    const box = await dialog.boundingBox();
    expect(box).toMatchObject({ x: 0, y: 0, width: viewport.width, height: viewport.height });

    // Focus moved in, and the page behind does not scroll.
    await expect(dialog.locator(':focus')).toHaveCount(1);
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 600);
    expect(await page.evaluate(() => window.scrollY)).toBe(before);
  });

  test('shows the actions the screen had before: claim, spin again, save and share', async ({ page }) => {
    const dialog = await reachResult(page);

    await expect(claimButton(page)).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Spin again' })).toBeEnabled();
    await expect(dialog.getByRole('button', { name: 'Save to list' })).toBeEnabled();
    await expect(dialog.getByRole('button', { name: 'Share this result' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Back to wheel' })).toBeVisible();
  });

  test('claiming works once: tiles appear, the button becomes a Maps link, XP is added once', async ({ page }) => {
    const dialog = await reachResult(page);
    expect(await storedXp(page)).toBe(0);

    await claimButton(page).click();

    // Epic is 3x of the 50 XP base.
    const tiles = dialog.getByTestId('reward-tiles');
    await expect(tiles).toBeVisible();
    await expect(tiles).toContainText('Reward claimed!');
    await expect(tiles).toContainText('+150');
    await expect(tiles).toContainText('XP (Epic 3x)');
    await expect(tiles).toContainText('+10');
    await expect(tiles).toContainText('day streak');
    await expect(dialog.getByTestId('reward-tile')).toHaveCount(3);

    // No second claim button. The same place now holds a plain link, and it has focus.
    await expect(claimButton(page)).toHaveCount(0);
    const maps = dialog.getByRole('link', { name: 'Open in Maps' });
    await expect(maps).toHaveAttribute('href', /google\.com\/maps/);
    await expect(maps).toBeFocused();

    expect(await storedXp(page)).toBe(150);
    expect(await openedUrls(page)).toHaveLength(1);

    // Close and reopen: still claimed, and there is nothing to claim again.
    await page.getByRole('button', { name: 'Back to wheel' }).click();
    await yourPick(page).click();
    await expect(resultDialog(page).getByTestId('reward-tiles')).toBeVisible();
    await expect(claimButton(page)).toHaveCount(0);
    expect(await storedXp(page)).toBe(150);
    expect(await openedUrls(page)).toHaveLength(1);
  });

  test('Back returns to the wheel and keeps the pick one tap away', async ({ page }) => {
    const dialog = await reachResult(page);
    const name = (await dialog.locator('#spin-result-card h3').textContent())?.trim() ?? '';

    await page.getByRole('button', { name: 'Back to wheel' }).click();
    await expect(resultDialog(page)).toHaveCount(0);
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');

    const reopen = yourPick(page);
    await expect(reopen).toBeVisible();
    await expect(reopen).toContainText(name);
    await expect(reopen).toBeFocused();

    await reopen.click();
    await expect(resultDialog(page)).toBeVisible();
    await expect(resultDialog(page).locator('#spin-result-card h3')).toHaveText(name);
  });

  test('Esc closes it and gives focus back to the pick button', async ({ page }) => {
    await reachResult(page);

    await page.keyboard.press('Escape');
    await expect(resultDialog(page)).toHaveCount(0);
    await expect(yourPick(page)).toBeFocused();
  });

  test('Tab stays inside the view', async ({ page }) => {
    const dialog = await reachResult(page);

    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab');
      const inside = await dialog.evaluate((el) => el.contains(document.activeElement));
      expect(inside, `focus after ${i + 1} tabs`).toBe(true);
    }
  });

  test('Spin again closes the view, spins, and opens the next result', async ({ page }) => {
    const dialog = await reachResult(page);
    await dialog.getByRole('button', { name: 'Spin again' }).click();

    await expect(resultDialog(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^spinning…$/i })).toBeDisabled();
    await expect(resultDialog(page)).toBeVisible({ timeout: 25_000 });
    // A new result starts unclaimed.
    await expect(claimButton(page)).toBeVisible();
  });

  test('Save to list turns into Saved', async ({ page }) => {
    const dialog = await reachResult(page);
    const save = dialog.getByRole('button', { name: 'Save to list' });
    await save.click();

    const saved = dialog.getByRole('button', { name: 'Saved' });
    await expect(saved).toBeVisible();
    await expect(saved).toBeDisabled();
  });

  test('a level-up modal opens over the view and closing it leaves the result in place', async ({ page }) => {
    await page.addInitScript((key) => {
      // 400 of 500 XP: the 150 XP from an epic place crosses into level 2.
      window.localStorage.setItem(key, JSON.stringify({ v: 1, xp: 400, coins: 0, awardedOn: {} }));
    }, GAME_KEY);
    const dialog = await reachResult(page);

    await claimButton(page).click();
    const levelUp = page.getByTestId('level-up-dialog');
    await expect(levelUp).toBeVisible({ timeout: 5_000 });
    await expect(levelUp).toContainText('level 2');

    await levelUp.getByRole('button', { name: 'Keep going' }).click();
    await expect(levelUp).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId('reward-tiles')).toContainText('Reward claimed!');
  });
});

test.describe('Result screen with reduced motion', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('has no celebration, confetti or tile animation, and the reward is all there', async ({ page }) => {
    const dialog = await reachResult(page);
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    await expect(page.locator('.celebration-layer')).toHaveCount(0);

    await claimButton(page).click();
    await expect(dialog.getByTestId('reward-tiles')).toContainText('+150');
    await expect(dialog.getByTestId('confetti-burst')).toHaveCount(0);
    await expect(dialog.locator('.reward-tile-pop')).toHaveCount(0);
    await expect(dialog.getByTestId('reward-tile')).toHaveCount(3);
  });
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 360, height: 800 },
  { width: 360, height: 640 },
]) {
  test.describe(`Result screen at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test('no horizontal overflow, and every control is at least 44px', async ({ page }) => {
      const dialog = await reachResult(page);

      const measure = () => page.evaluate(() => {
        const view = document.querySelector('[role="dialog"]')!;
        const undersized = [...view.querySelectorAll('button, a[href]')]
          .filter((el) => {
            const box = el.getBoundingClientRect();
            return box.width > 1 && box.height > 1 && (box.width < 43.5 || box.height < 43.5);
          })
          .map((el) => `${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
        return {
          page: document.documentElement.scrollWidth - window.innerWidth,
          view: view.scrollWidth - view.clientWidth,
          undersized,
        };
      });

      expect(await measure()).toEqual({ page: 0, view: 0, undersized: [] });

      await claimButton(page).click();
      await expect(dialog.getByTestId('reward-tiles')).toBeVisible();
      expect(await measure()).toEqual({ page: 0, view: 0, undersized: [] });
    });

    test('the pinned buttons sit at the bottom and never cover the card or the reward tiles', async ({ page }) => {
      const dialog = await reachResult(page);
      const regions = () => dialog.evaluate((view) => {
        const footer = view.querySelector('footer')!.getBoundingClientRect();
        const scroller = view.querySelector('footer')!.previousElementSibling!;
        const area = scroller.getBoundingClientRect();
        const tiles = view.querySelector('[data-testid="reward-tiles"]')?.getBoundingClientRect();
        return {
          footerTop: Math.round(footer.top),
          footerBottom: Math.round(footer.bottom),
          areaBottom: Math.round(area.bottom),
          tilesTop: tiles ? Math.round(tiles.top) : null,
          tilesBottom: tiles ? Math.round(tiles.bottom) : null,
          areaTop: Math.round(area.top),
        };
      });

      const before = await regions();
      expect(before.footerBottom).toBe(viewport.height);
      // The scrolling area ends where the pinned buttons start, so nothing is underneath them.
      expect(before.areaBottom).toBeLessThanOrEqual(before.footerTop);

      await claimButton(page).click();
      await expect(dialog.getByTestId('reward-tiles')).toBeVisible();
      // The tiles are brought into view, above the pinned buttons.
      await expect.poll(async () => {
        const after = await regions();
        return after.tilesBottom !== null
          && after.tilesBottom <= after.footerTop
          && (after.tilesTop ?? 0) >= after.areaTop;
      }).toBe(true);
    });
  });
}
