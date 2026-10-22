import { test, expect } from '@playwright/test';
test('a manual spin is recorded and appears in Me', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('eatspin:first-run-onboarding-seen', '1'));
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Main' });
  await nav.getByRole('button', { name: /^My list/i }).click();
  for (const name of ['Synthetic noodles', 'Synthetic rice']) {
    await page.getByLabel('Add a place', { exact: true }).fill(name);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Spin this list' }).click();
  await page.getByRole('button', { name: /spin the wheel/i }).click();
  await expect(page.getByRole('dialog', { name: 'You got it!' })).toBeVisible({ timeout: 25_000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('eatspin_spins') ?? '[]'));
  expect(saved).toHaveLength(1);
  await page.getByRole('button', { name: 'Back to wheel' }).click();
  await nav.getByRole('button', { name: /^Me/i }).click();
  await expect(page.getByRole('region', { name: 'Stats' })).toContainText('1');
});
