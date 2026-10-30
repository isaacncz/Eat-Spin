import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('http://localhost:5173/?spotlight-fixture=1', route => route.fulfill({
    contentType: 'text/html',
    body: '<div id="root"></div><script type="module">const {default:RefreshRuntime}=await import("/@react-refresh");RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;const {mountSpinAudioFixture}=await import("/src/test/spin-audio-mount.tsx");mountSpinAudioFixture();</script>',
  }));
  await page.goto('/?spotlight-fixture=1');
});

test('spin spotlights the same wheel, traps focus, and hands off to the result', async ({ page }) => {
  const disc = page.locator('[data-wheel-disc]');
  await disc.evaluate(el => { el.setAttribute('data-original-disc', 'yes'); });
  const originalSize = (await disc.boundingBox())!.width;
  await page.getByRole('button', { name: /spin the wheel/i }).click();
  const spotlight = page.getByRole('dialog', { name: 'Let fate decide.' });
  await expect(spotlight).toBeVisible();
  await expect(spotlight.locator('[data-original-disc="yes"]')).toHaveCount(1);
  await expect.poll(async () => (await disc.boundingBox())!.width).toBeGreaterThanOrEqual(originalSize);
  await expect(spotlight.getByRole('heading')).toBeFocused();
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab');
    await expect(spotlight.locator(':focus')).toHaveCount(1);
  }
  await spotlight.getByRole('button', { name: 'Sound on', exact: true }).click();
  await expect(spotlight.getByRole('button', { name: 'Sound off', exact: true })).toBeVisible();
  const result = page.getByRole('dialog', { name: 'You got it!' });
  await expect(result).toBeVisible({ timeout: 15_000 });
  await expect(spotlight).not.toBeVisible();
  await expect(result.locator(':focus')).toHaveCount(1);
  await result.getByRole('button', { name: 'Back to wheel' }).click();
  await expect(page.locator('[data-original-disc="yes"]')).toBeVisible();
});

test('Escape leaves the spotlight while the spin continues to exactly one result', async ({ page }) => {
  await page.getByRole('button', { name: /spin the wheel/i }).click();
  const spotlight = page.getByRole('dialog', { name: 'Let fate decide.' });
  await expect(spotlight).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(spotlight).not.toBeVisible();
  await expect(page.locator('[data-wheel-disc]')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'You got it!' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('dialog', { name: 'You got it!' })).toHaveCount(1);
});

test('reduced motion reveals directly without the pop-out or spinning delay', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: /spin the wheel/i }).click();
  await expect(page.getByRole('dialog', { name: 'You got it!' })).toBeVisible({ timeout: 3_000 });
  await expect(page.getByRole('dialog', { name: 'Let fate decide.' })).toHaveCount(0);
  await expect(page.locator('.celebration-layer')).toHaveCount(0);
});

test('wheel-to-restaurant transition settles and can be interrupted by Back', async ({ page }) => {
  await page.evaluate(() => {
    const start = document.startViewTransition.bind(document);
    Object.assign(window, { revealTransitions: 0 });
    document.startViewTransition = ((update: () => void) => {
      (window as unknown as { revealTransitions: number }).revealTransitions += 1;
      return start(update);
    }) as typeof document.startViewTransition;
  });
  await page.getByRole('button', { name: /spin the wheel/i }).click();
  const result = page.getByRole('dialog', { name: 'You got it!' });
  await expect(result).toBeVisible({ timeout: 15_000 });
  expect(await page.evaluate(() => (window as unknown as { revealTransitions: number }).revealTransitions)).toBe(1);
  await expect(page.locator('html')).not.toHaveClass(/wheel-reveal-active/);
  await expect(result).toHaveCSS('animation-name', 'none');
  await expect(result.locator('[data-restaurant-reveal]')).toHaveCSS('animation-name', 'none');
  await expect(result.locator(':focus')).toHaveCount(1);
  await result.getByRole('button', { name: 'Back to wheel' }).click();
  await page.getByRole('button', { name: /spin the wheel/i }).click();
  await expect(result).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press('Escape');
  await expect(result).not.toBeVisible();
  await expect(page.locator('html')).not.toHaveClass(/wheel-reveal-active/);
  await expect(page.locator('[data-wheel-disc]')).toBeVisible();
});

test('unsupported browsers still reveal the restaurant and restore focus normally', async ({ page }) => {
  await page.evaluate(() => { Object.defineProperty(document, 'startViewTransition', { value: undefined, configurable: true }); });
  await page.getByRole('button', { name: /spin the wheel/i }).click();
  const result = page.getByRole('dialog', { name: 'You got it!' });
  await expect(result).toBeVisible({ timeout: 15_000 });
  await expect(result.locator(':focus')).toHaveCount(1);
  await expect(page.locator('html')).not.toHaveClass(/wheel-reveal-active/);
  await result.getByRole('button', { name: 'Back to wheel' }).click();
  await expect(page.getByRole('button', { name: /^your pick/i })).toBeFocused();
});
