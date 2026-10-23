import { test, expect } from '@playwright/test';

// Android Chrome overlays the keyboard: the layout viewport keeps its full height while
// window.visualViewport shrinks. Emulate that instead of resizing the page.
test('destination suggestions stay inside the visible area above an overlaying keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    localStorage.setItem('eatspin:first-run-onboarding-seen', '1');
    const target = new EventTarget();
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: Object.assign(target, { height: 844, offsetTop: 0, width: 390, offsetLeft: 0, scale: 1 }) });
    (window as unknown as { __setKeyboard: (h: number) => void }).__setKeyboard = (h) => {
      (window.visualViewport as unknown as { height: number }).height = h;
      target.dispatchEvent(new Event('resize'));
    };
  });
  await page.route('**/places.googleapis.com/**', (route) => {
    if (route.request().url().includes('places:autocomplete')) {
      const suggestions = Array.from({ length: 5 }, (_, i) => ({ placePrediction: { placeId: `kiara-${i}`, structuredFormat: { mainText: { text: `Mont Kiara ${i}` }, secondaryText: { text: 'Kuala Lumpur, Malaysia' } } } }));
      return route.fulfill({ json: { suggestions } });
    }
    return route.fulfill({ json: { places: [] } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /search around/i }).click();
  const input = page.getByLabel('Search destination');
  await expect(input).toBeVisible();
  await page.evaluate(() => (window as unknown as { __setKeyboard: (h: number) => void }).__setKeyboard(360));
  await input.fill('Mont Kiara');

  const first = page.getByRole('button', { name: /Mont Kiara 0/ });
  await expect(first).toBeVisible();
  for (const locator of [input, page.getByRole('button', { name: /use my current location/i }), first]) {
    const box = await locator.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(360);
  }
  const sheet = page.locator('[data-slot="sheet-content"]');
  const sheetBox = await sheet.boundingBox();
  expect(sheetBox!.y + sheetBox!.height).toBeLessThanOrEqual(360);
  expect(await input.evaluate((el) => getComputedStyle(el).fontSize)).toBe('16px');
});
