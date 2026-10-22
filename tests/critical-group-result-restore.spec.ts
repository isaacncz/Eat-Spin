import { test, expect } from '@playwright/test';
for (const animate of [false, true]) {
  test(animate ? 'a recent group result animates once' : 'an older group winner opens directly without a fresh completion', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('eatspin:first-run-onboarding-seen', '1'));
    await page.goto('/');
    await page.evaluate(async (shouldAnimate) => {
      const modulePath = '/src/test/group-result-fixture.tsx';
      const fixture = await import(/* @vite-ignore */ modulePath);
      fixture.mountGroupResult(shouldAnimate);
    }, animate);
    const dialog = page.getByRole('dialog', { name: 'You got it!' });
    await expect(dialog).toBeVisible({ timeout: animate ? 15_000 : 5_000 });
    await expect(dialog).toContainText('Committed winner');
    expect(await page.evaluate(() => (window as unknown as { restoredCompletions: number }).restoredCompletions)).toBe(animate ? 1 : 0);
    await dialog.getByRole('button', { name: 'Back to wheel' }).click();
    await page.getByRole('button', { name: /^Your pick:/ }).click();
    await expect(dialog).toContainText('Committed winner');
    expect(await page.evaluate(() => (window as unknown as { restoredCompletions: number }).restoredCompletions)).toBe(animate ? 1 : 0);
  });
}
