import { expect, type Locator, type Page } from '@playwright/test';

/** Wednesday 12:30, so the bundled fallback places are open. Time keeps moving (the wheel animation needs it). */
export const setLunchtimeClock = async (page: Page) => {
  await page.addInitScript(() => {
    const RealDate = Date;
    const offset = new RealDate(2025, 3, 16, 12, 30, 0).getTime() - RealDate.now();
    globalThis.Date = class extends RealDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) {
          super(RealDate.now() + offset);
        } else {
          super(...(args as [number]));
        }
      }
      static override now() { return RealDate.now() + offset; }
    } as DateConstructor;
  });
};

/** The one-line "Filters · Drive 10 · 24 places" button (also matches while the sheet hides it). */
export const filtersButton = (page: Page): Locator =>
  page.getByRole('button', { name: /^filters/i, includeHidden: true }).first();

export const filtersSheet = (page: Page): Locator => page.getByRole('dialog', { name: 'Filters' });

/** Opens the app on the Spin tab with onboarding skipped and location shared. */
export const openSpinScreenWithLocation = async (page: Page) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('eatspin:first-run-onboarding-seen', '1');
  });
  await page.goto('/');
  await expect(page.locator('text=/What.*for/i').first()).toBeVisible({ timeout: 10_000 });

  const shareLocation = page.getByRole('button', { name: /share my location/i });
  if (await shareLocation.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await shareLocation.click();
  }
  await expect(filtersButton(page)).toContainText(/places?|searching/i, { timeout: 15_000 });
};

export const openFiltersSheet = async (page: Page): Promise<Locator> => {
  await filtersButton(page).click();
  const sheet = filtersSheet(page);
  await expect(sheet).toBeVisible();
  // Let the slide-in finish so positions and sizes are final.
  await sheet.evaluate((el) => Promise.all(el.getAnimations().map((animation) => animation.finished)));
  return sheet;
};

/** The pinned button at the bottom of the sheet ("Show 9 places"). */
export const sheetCta = (sheet: Locator): Locator => sheet.locator('button').last();

/** Reads N from "Show N places" or "Filters · Drive 10 · N places"; 0 for "No places match". */
export const parsePlaceCount = (text: string | null): number | null => {
  const match = /(\d+) places?/i.exec(text ?? '');
  if (match) return Number(match[1]);
  if (/no places match/i.test(text ?? '')) return 0;
  return null;
};

/** The pinned bottom button of the Spin screen, in any of its states. */
export const pinnedSpinButton = (page: Page): Locator =>
  page.getByRole('button', {
    name: /^(spin!|spinning…|no places to spin|need 2\+ places|finding places…|share my location|locating…)$/i,
  });

export const servesGroup = (sheet: Locator): Locator =>
  sheet.getByRole('group', { name: /filter by what.*served/i });

/** Replaces window.open and records the URLs, so "Let's go!" does not open real tabs. */
export const recordWindowOpen = async (page: Page) => {
  await page.addInitScript(() => {
    const opened: string[] = [];
    (window as unknown as { __opened: string[] }).__opened = opened;
    window.open = (url?: string | URL) => {
      opened.push(String(url));
      return null;
    };
  });
};

export const openedUrls = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __opened?: string[] }).__opened ?? []);

/** The full-screen result view that opens when the wheel stops. */
export const resultDialog = (page: Page): Locator => page.getByRole('dialog', { name: 'You got it!' });

/** Taps the pinned Spin button and waits for the result view (the wheel takes about 6 seconds). */
export const spinToResult = async (page: Page): Promise<Locator> => {
  const spin = page.getByRole('button', { name: /^spin!$/i });
  await expect(spin).toBeVisible({ timeout: 20_000 });
  await spin.click();
  const dialog = resultDialog(page);
  await expect(dialog).toBeVisible({ timeout: 25_000 });
  // Let the slide-in finish so positions and sizes are final.
  await dialog.evaluate((el) => Promise.all(el.getAnimations().map((animation) => animation.finished)));
  return dialog;
};
