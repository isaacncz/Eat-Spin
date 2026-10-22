import { test, expect, type Page } from '@playwright/test';

const TAB_LABELS = ['Spin', 'My list', 'Group', 'Me'] as const;

const mainNav = (page: Page) => page.getByRole('navigation', { name: 'Main' });
const tab = (page: Page, label: (typeof TAB_LABELS)[number]) =>
  mainNav(page).getByRole('button', { name: new RegExp(`^${label}`) });

const openApp = async (page: Page) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('eatspin:first-run-onboarding-seen', '1');
  });
  await page.goto('/');
  await expect(mainNav(page)).toBeVisible({ timeout: 10_000 });
};

test.describe('Bottom tab bar', () => {
  test('has the four tabs in order and opens on Spin', async ({ page }) => {
    await openApp(page);

    await expect(mainNav(page).getByRole('button')).toHaveText([...TAB_LABELS]);
    await expect(tab(page, 'Spin')).toHaveAttribute('aria-current', 'page');
    for (const label of ['My list', 'Group', 'Me'] as const) {
      await expect(tab(page, label)).not.toHaveAttribute('aria-current', 'page');
    }
    await expect(page.locator('text=/What.*for/i').first()).toBeVisible();
  });

  test('is the only navigation: no top navbar', async ({ page }) => {
    await openApp(page);
    await expect(page.getByRole('navigation')).toHaveCount(1);
  });

  test('tabs are at least 44px tall and wide and sit at the bottom of the screen', async ({ page }) => {
    await openApp(page);

    for (const label of TAB_LABELS) {
      const box = await tab(page, label).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    }

    const navBox = await mainNav(page).boundingBox();
    const viewportHeight = page.viewportSize()?.height ?? 0;
    expect(Math.round((navBox?.y ?? 0) + (navBox?.height ?? 0))).toBe(viewportHeight);
  });

  test('switching tabs moves aria-current and shows each screen', async ({ page }) => {
    await openApp(page);

    await tab(page, 'My list').click();
    await expect(tab(page, 'My list')).toHaveAttribute('aria-current', 'page');
    await expect(tab(page, 'Spin')).not.toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('listbox', { name: /saved lists/i })).toBeVisible();

    await tab(page, 'Group').click();
    await expect(tab(page, 'Group')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { name: 'Group spin', exact: true })).toBeVisible();

    await tab(page, 'Me').click();
    await expect(tab(page, 'Me')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { name: 'Me', exact: true })).toBeVisible();
    await expect(page.getByRole('progressbar', { name: /experience points/i })).toBeVisible();

    await tab(page, 'Spin').click();
    await expect(tab(page, 'Spin')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('text=/What.*for/i').first()).toBeVisible();
  });

  test('a shared room link opens the Group tab', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('eatspin:first-run-onboarding-seen', '1');
    });
    await page.goto('/?room=ABC123');
    await expect(tab(page, 'Group')).toHaveAttribute('aria-current', 'page');
  });

  test('landing sections sit behind a collapsed About EatSpin row on Me', async ({ page }) => {
    await openApp(page);
    await tab(page, 'Me').click();

    const about = page.getByRole('button', { name: /about eatspin/i });
    await expect(about).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('heading', { name: /how it works/i })).toHaveCount(0);

    await about.click();
    await expect(about).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('heading', { name: /how it works/i })).toBeVisible({ timeout: 10_000 });
  });

  test('content is not hidden behind the bar when scrolled to the end', async ({ page }) => {
    await openApp(page);

    for (const label of TAB_LABELS) {
      await tab(page, label).click();
      await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      const mainBottom = await page.locator('main').evaluate((el) => el.getBoundingClientRect().bottom);
      const navTop = (await mainNav(page).boundingBox())?.y ?? 0;
      expect(Math.round(mainBottom), `${label}: end of content should clear the tab bar`).toBeLessThanOrEqual(Math.round(navTop));
    }
  });
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 360, height: 800 },
]) {
  test.describe(`Bottom tab bar at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test('no horizontal overflow on any tab', async ({ page }) => {
      await openApp(page);

      for (const label of TAB_LABELS) {
        await tab(page, label).click();
        const { scrollWidth, innerWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
        }));
        expect(scrollWidth, `${label}: page should not scroll sideways`).toBe(innerWidth);
      }
    });
  });
}
