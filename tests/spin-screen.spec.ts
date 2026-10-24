import { test, expect, type Page } from '@playwright/test';

import {
  filtersButton,
  filtersSheet,
  openFiltersSheet,
  openSpinScreenWithLocation,
  parsePlaceCount,
  pinnedSpinButton,
  sheetCta,
  setLunchtimeClock,
} from './spin-helpers';

// Penang: the bundled fallback places are around here, so there is something to spin
// even when Google Places is not reachable.
test.use({
  geolocation: { latitude: 5.4146, longitude: 100.3296 },
  permissions: ['geolocation'],
});

const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' });

/** Waits for the Filters sheet count to settle (no "Finding places…") and returns it. */
const settledSheetCount = async (page: Page): Promise<number | null> => {
  const cta = sheetCta(filtersSheet(page));
  await expect(cta).not.toHaveText(/finding places/i, { timeout: 15_000 });
  return parsePlaceCount(await cta.textContent());
};

test.describe('Spin screen', () => {
  test.beforeEach(async ({ page }) => {
    await setLunchtimeClock(page);
  });

  test('shows the heading, quick picks, one-line Filters button and a pinned Spin button', async ({ page }) => {
    await openSpinScreenWithLocation(page);

    await expect(page.getByRole('heading', { level: 1, name: /what.*s for/i })).toBeVisible();
    await expect(page.getByRole('group', { name: /quick picks/i }).getByRole('button')).toHaveText([
      'Quick Bite',
      'Treat Myself',
      'Healthy',
      'Surprise Me!',
    ]);
    await expect(filtersButton(page)).toHaveText(/^Filters · 5 km · (\d+ places?|searching…)$/);
    await expect(page.getByRole('progressbar', { name: /experience points/i })).toBeVisible();
  });

  test('the Filters button is the only filter UI on the screen until it is opened', async ({ page }) => {
    await openSpinScreenWithLocation(page);
    await expect(page.getByRole('group', { name: /how far/i })).toHaveCount(0);
    await expect(filtersSheet(page)).toHaveCount(0);
  });

  test('picking a quick pick applies its food types to the filters', async ({ page }) => {
    await openSpinScreenWithLocation(page);
    await page.getByRole('button', { name: 'Healthy' }).click();
    await expect(page.getByRole('button', { name: 'Healthy' })).toHaveAttribute('aria-pressed', 'true');

    const sheet = await openFiltersSheet(page);
    const foodType = sheet.getByRole('group', { name: 'Food type' });
    await expect(foodType.getByRole('button', { name: /vegetarian/i })).toHaveAttribute('aria-pressed', 'true');
    await expect(foodType.getByRole('button', { name: /cafe/i })).toHaveAttribute('aria-pressed', 'true');
  });

  test('the pinned Spin button stays above the tab bar', async ({ page }) => {
    await openSpinScreenWithLocation(page);
    const spin = pinnedSpinButton(page);
    await expect(spin).toBeVisible();

    const spinBox = await spin.boundingBox();
    const navBox = await nav(page).boundingBox();
    expect(spinBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(Math.round((spinBox?.y ?? 0) + (spinBox?.height ?? 0))).toBeLessThanOrEqual(Math.round(navBox?.y ?? 0));

    // Still there after scrolling to the end of the page, and nothing ends up behind it.
    // Wait for places to finish loading first, since the page grows when the wheel appears.
    await expect(page.getByRole('button', { name: /^spin!$/i })).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(async () => {
        await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
        return page.evaluate(
          () => Math.abs(window.scrollY + window.innerHeight - document.documentElement.scrollHeight) <= 1,
        );
      })
      .toBe(true);
    const after = await spin.boundingBox();
    expect(Math.round((after?.y ?? 0) + (after?.height ?? 0))).toBeLessThanOrEqual(Math.round(navBox?.y ?? 0));
    const mainBottom = await page.locator('main').evaluate((el) => el.getBoundingClientRect().bottom);
    expect(Math.round(mainBottom)).toBeLessThanOrEqual(Math.round(navBox?.y ?? 0));
  });

  test('spinning from the pinned button shows a result', async ({ page }) => {
    await setLunchtimeClock(page);
    await openSpinScreenWithLocation(page);
    const spin = page.getByRole('button', { name: /^spin!$/i });
    test.skip(
      !(await spin.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true, () => false)),
      'needs at least two places nearby',
    );

    await spin.click();
    await expect(page.getByRole('button', { name: /^spinning…$/i })).toBeDisabled();
    await expect(page.locator('#spin-result-card')).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('Filters sheet', () => {
  test.beforeEach(async ({ page }) => {
    await setLunchtimeClock(page);
    await openSpinScreenWithLocation(page);
  });

  test('opens from the Filters button with every filter group', async ({ page }) => {
    const sheet = await openFiltersSheet(page);

    await expect(sheet.getByRole('heading', { name: 'Filters' })).toBeVisible();
    await expect(sheet.getByRole('group', { name: /how far/i }).getByRole('button')).toHaveText([/^1 km/, /^3 km/, /^5 km/, /^10 km/]);
    await expect(sheet.getByRole('checkbox', { name: 'Open now only' })).toBeChecked();
    await expect(sheet.getByRole('group', { name: 'Price' }).getByRole('button')).toHaveText(['$', '$$', '$$$', '$$$$']);
    await expect(sheet.getByRole('group', { name: 'Food type' }).getByRole('button').first()).toBeVisible();
    await expect(sheet.getByRole('group', { name: /filter by what.*served/i }).getByRole('button')).toHaveCount(7);
    await expect(sheet.getByRole('button', { name: 'Reset' })).toBeVisible();
    await expect(sheetCta(sheet)).toHaveText(/^(Show \d+ places?|No places match|Finding places…)$/);
  });

  test('closes with Esc and returns focus to the Filters button', async ({ page }) => {
    await openFiltersSheet(page);
    await page.keyboard.press('Escape');
    await expect(filtersSheet(page)).toHaveCount(0);
    await expect(filtersButton(page)).toBeFocused();
  });

  test('closes with the pinned button and when the dimmed page is tapped', async ({ page }) => {
    const sheet = await openFiltersSheet(page);
    await sheetCta(sheet).click();
    await expect(filtersSheet(page)).toHaveCount(0);

    await openFiltersSheet(page);
    await page.mouse.click(10, 10);
    await expect(filtersSheet(page)).toHaveCount(0);
  });

  test('keeps keyboard focus inside while open', async ({ page }) => {
    await openFiltersSheet(page);
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true);
    }
  });

  test('changes apply at once and "Show N places" matches the count on the Filters button', async ({ page }) => {
    const sheet = await openFiltersSheet(page);

    await sheet.getByRole('group', { name: 'Price' }).getByRole('button', { name: '$$', exact: true }).click();
    await expect(sheet.getByRole('group', { name: 'Price' }).getByRole('button', { name: '$$', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const shown = await settledSheetCount(page);
    expect(shown).not.toBeNull();

    await sheetCta(sheet).click();
    await expect(filtersSheet(page)).toHaveCount(0);
    // One filter is on, and the button says so (a badge, and in its accessible name).
    await expect(filtersButton(page)).toHaveAccessibleName(/^Filters · 5 km · \d+ places?, 1 filter on$/);
    expect(parsePlaceCount(await filtersButton(page).getAttribute('aria-label'))).toBe(shown);
  });

  test('changing the range updates the Filters button summary', async ({ page }) => {
    const sheet = await openFiltersSheet(page);
    await sheet.getByRole('button', { name: /^1 km/ }).click();
    await expect(sheet.getByRole('button', { name: /^1 km/ })).toHaveAttribute('aria-pressed', 'true');
    await settledSheetCount(page);
    await sheetCta(sheet).click();
    await expect(filtersButton(page)).toHaveText(/^Filters · 1 km · /);
  });

  test('food type is capped at three', async ({ page }) => {
    const sheet = await openFiltersSheet(page);
    const foodType = sheet.getByRole('group', { name: 'Food type' });
    const chips = foodType.getByRole('button');

    for (let i = 0; i < 3; i++) await chips.nth(i).click();
    await expect(sheet.getByText('3/3 picked')).toBeVisible();
    await expect(chips.nth(3)).toBeDisabled();
    // A picked one can still be turned off.
    await chips.nth(0).click();
    await expect(chips.nth(3)).toBeEnabled();
  });

  test('Reset clears every filter and goes back to the default range', async ({ page }) => {
    const sheet = await openFiltersSheet(page);
    const price = sheet.getByRole('group', { name: 'Price' }).getByRole('button', { name: '$$$', exact: true });
    const coffee = sheet.getByRole('group', { name: /filter by what.*served/i }).getByRole('button', { name: /coffee/i });
    const walk = sheet.getByRole('button', { name: /^1 km/ });

    await price.click();
    await coffee.click();
    await walk.click();
    await expect(price).toHaveAttribute('aria-pressed', 'true');

    await sheet.getByRole('button', { name: 'Reset' }).click();
    await expect(price).toHaveAttribute('aria-pressed', 'false');
    await expect(coffee).toHaveAttribute('aria-pressed', 'false');
    await expect(sheet.getByRole('button', { name: /^5 km/ })).toHaveAttribute('aria-pressed', 'true');
    await sheetCta(sheet).click();
    await expect(filtersButton(page)).toHaveAccessibleName(/^Filters · 5 km · \d+ places?$/);
  });
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 360, height: 800 },
]) {
  test.describe(`Spin screen at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test.beforeEach(async ({ page }) => {
      await setLunchtimeClock(page);
      await openSpinScreenWithLocation(page);
    });

    test('no horizontal overflow, with the sheet closed or open', async ({ page }) => {
      const widths = () => page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));

      const closed = await widths();
      expect(closed.scrollWidth, 'Spin screen should not scroll sideways').toBe(closed.innerWidth);

      await openFiltersSheet(page);
      const open = await widths();
      expect(open.scrollWidth, 'Filters sheet should not scroll sideways').toBe(open.innerWidth);
    });

    test('every tappable control on the screen and in the sheet is at least 44px', async ({ page }) => {
      const undersized = () => page.evaluate(() => {
        const roots = [...document.querySelectorAll('main, [role="dialog"], nav[aria-label="Main"]')];
        return roots.flatMap((root) => [...root.querySelectorAll('button, a[href], input, select')])
          .filter((el) => {
            const style = getComputedStyle(el);
            const box = el.getBoundingClientRect();
            // Skip hidden and off-screen (scrolled away) controls; the sr-only 1px ones are not tappable.
            return style.visibility !== 'hidden' && box.width > 1 && box.height > 1
              && (box.width < 43.5 || box.height < 43.5);
          })
          .map((el) => `${(el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 30)} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
      });

      expect(await undersized(), 'Spin screen').toEqual([]);
      await openFiltersSheet(page);
      expect(await undersized(), 'Filters sheet').toEqual([]);
    });

    test('the sheet fills the bottom of the screen and its pinned button is visible', async ({ page }) => {
      const sheet = await openFiltersSheet(page);
      const box = await sheet.boundingBox();
      const cta = await sheetCta(sheet).boundingBox();

      expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(viewport.height);
      expect(box?.width).toBe(viewport.width);
      expect(Math.round((cta?.y ?? 0) + (cta?.height ?? 0))).toBeLessThanOrEqual(viewport.height);
      expect(cta?.height ?? 0).toBeGreaterThanOrEqual(44);
    });
  });
}

test.describe('Spin screen on a 360x640 phone', () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test('the wheel and the Spin button are visible together without scrolling', async ({ page }) => {
    await setLunchtimeClock(page);
    await openSpinScreenWithLocation(page);
    const spin = page.getByRole('button', { name: /^spin!$/i });
    test.skip(
      !(await spin.waitFor({ state: 'visible', timeout: 15_000 }).then(() => true, () => false)),
      'needs at least two places nearby',
    );

    const wheel = page.locator('.aspect-square').first();
    const wheelBox = await wheel.boundingBox();
    const spinBox = await spin.boundingBox();
    const navBox = await nav(page).boundingBox();

    expect(wheelBox?.width ?? 0).toBeGreaterThanOrEqual(200);
    expect(Math.round((wheelBox?.y ?? 0) + (wheelBox?.height ?? 0))).toBeLessThanOrEqual(Math.round(spinBox?.y ?? 0));
    expect(Math.round((spinBox?.y ?? 0) + (spinBox?.height ?? 0))).toBeLessThanOrEqual(Math.round(navBox?.y ?? 0));
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});
