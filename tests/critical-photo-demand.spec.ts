import { test, expect } from '@playwright/test';
test('hidden slides make no photo request until selected', async ({ page }) => {
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
  const fixture = page.getByTestId('photo-demand-fixture');
  await expect(fixture.locator('img')).toHaveCount(1);
  await expect.poll(() => requested).toEqual(['/test-photos/one.svg']);
  await fixture.getByRole('button', { name: 'Go to photo 2' }).click();
  await expect.poll(() => requested).toEqual(['/test-photos/one.svg', '/test-photos/two.svg']);
  await fixture.getByRole('button', { name: 'Go to photo 1' }).click();
  await expect(fixture.locator('img')).toHaveCount(2);
  expect(requested).not.toContain('/test-photos/three.svg');
});
