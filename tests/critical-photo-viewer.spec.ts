import { test, expect, type Page } from '@playwright/test';

/** Mounts the synthetic 3-photo carousel and records which photo files are requested. */
async function mountFixture(page: Page) {
  const requested: string[] = [];
  await page.route('**/test-photos/*.svg', async (route) => {
    requested.push(new URL(route.request().url()).pathname);
    await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>' });
  });
  await page.addInitScript(() => localStorage.setItem('eatspin:first-run-onboarding-seen', '1'));
  await page.goto('/');
  await page.evaluate(async () => {
    const modulePath = '/src/test/photo-demand-fixture.tsx';
    (await import(/* @vite-ignore */ modulePath)).mountPhotos();
  });
  return { requested, fixture: page.getByTestId('photo-demand-fixture') };
}

test('tapping a photo opens a viewer that loads only the photo on screen', async ({ page }) => {
  const { requested, fixture } = await mountFixture(page);
  await expect.poll(() => requested).toEqual(['/test-photos/one.svg']);

  const openFirst = fixture.getByRole('button', { name: 'View photo 1 of 3 larger' });
  await openFirst.click();
  const viewer = page.getByRole('dialog', { name: 'Synthetic restaurant' });
  await expect(viewer).toBeVisible();
  await expect(viewer.getByText('Photo 1 of 3')).toBeVisible();
  await expect(viewer.locator('img')).toHaveCount(1);
  expect(requested).not.toContain('/test-photos/two.svg');

  await viewer.getByRole('button', { name: 'Next photo' }).click();
  await expect(viewer.getByText('Photo 2 of 3')).toBeVisible();
  await expect(viewer.locator('img')).toHaveCount(1);
  await expect.poll(() => requested).toContain('/test-photos/two.svg');
  expect(requested).not.toContain('/test-photos/three.svg');

  await page.keyboard.press('ArrowLeft');
  await expect(viewer.getByText('Photo 1 of 3')).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(viewer.getByText('Photo 3 of 3')).toBeVisible();
  await expect.poll(() => requested).toContain('/test-photos/three.svg');

  await page.keyboard.press('Escape');
  await expect(viewer).toHaveCount(0);
  await expect(openFirst).toBeFocused();
});

test('inside another modal dialog, Escape closes only the viewer and focus returns to the photo', async ({ page }) => {
  await page.route('**/test-photos/*.svg', (route) => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
  }));
  await page.addInitScript(() => localStorage.setItem('eatspin:first-run-onboarding-seen', '1'));
  await page.goto('/');
  await page.evaluate(async () => {
    const modulePath = '/src/test/photo-demand-fixture.tsx';
    (await import(/* @vite-ignore */ modulePath)).mountPhotosInDialog();
  });
  const outer = page.getByRole('dialog', { name: 'Outer dialog' });
  const open = outer.getByRole('button', { name: 'View photo 1 of 3 larger' });
  await open.click();
  const viewer = page.getByRole('dialog', { name: 'Synthetic restaurant' });
  await expect(viewer).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(viewer).toHaveCount(0);
  await expect(outer).toBeVisible();
  await expect(open).toBeFocused();
});

test('swiping the viewer changes photo and the close button restores the page', async ({ page }) => {
  const { fixture } = await mountFixture(page);
  await fixture.getByRole('button', { name: 'View photo 1 of 3 larger' }).click();
  const viewer = page.getByRole('dialog', { name: 'Synthetic restaurant' });
  await expect(viewer.getByText('Photo 1 of 3')).toBeVisible();

  const box = (await viewer.locator('img').boundingBox())!;
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2 + 100, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 100, y, { steps: 5 });
  await page.mouse.up();
  await expect(viewer.getByText('Photo 2 of 3')).toBeVisible();

  await viewer.getByRole('button', { name: 'Close photo viewer' }).click();
  await expect(viewer).toHaveCount(0);
});

test('keyboard: the viewer opens on the photo on screen and focus returns to it', async ({ page }) => {
  const { fixture } = await mountFixture(page);
  const first = fixture.getByRole('button', { name: 'View photo 1 of 3 larger' });
  await first.focus();
  await page.keyboard.press('ArrowRight'); // the carousel moves on; focus stays on photo 1's button
  await expect(first).toBeFocused();
  await page.keyboard.press('Enter');
  const viewer = page.getByRole('dialog', { name: 'Synthetic restaurant' });
  await expect(viewer.getByText('Photo 2 of 3')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(viewer).toHaveCount(0);
  await expect(fixture.getByRole('button', { name: 'View photo 2 of 3 larger' })).toBeFocused();
});

test('a failed larger Places photo falls back to the card-size photo', async ({ page }) => {
  const sizes: string[] = [];
  await page.route('https://places.googleapis.com/**', async (route) => {
    const size = new URL(route.request().url()).searchParams.get('maxWidthPx') ?? '';
    sizes.push(size);
    if (size === '720') {
      await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>' });
    } else {
      await route.abort();
    }
  });
  await page.addInitScript(() => localStorage.setItem('eatspin:first-run-onboarding-seen', '1'));
  await page.goto('/');
  await page.evaluate(async () => {
    const modulePath = '/src/test/photo-demand-fixture.tsx';
    const photo = (id: string) => `https://places.googleapis.com/v1/places/p/photos/${id}/media?maxHeightPx=720&maxWidthPx=720&key=test-key`;
    (await import(/* @vite-ignore */ modulePath)).mountPhotos([photo('a'), photo('b')]);
  });
  const fixture = page.getByTestId('photo-demand-fixture');
  await expect.poll(() => sizes).toEqual(['720']);
  await fixture.getByRole('button', { name: 'View photo 1 of 2 larger' }).click();
  const viewer = page.getByRole('dialog', { name: 'Synthetic restaurant' });
  await expect.poll(() => sizes).toContain('1200');
  await expect.poll(() => viewer.locator('img').evaluate((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0)).toBe(true);
  await expect(viewer.getByRole('alert')).toHaveCount(0);
});
