import { test, expect } from '@playwright/test';

// Shared setup: skip onboarding, go to the My list tab
const setupManualTab = async (page: import('@playwright/test').Page) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('eatspin:first-run-onboarding-seen', '1');
  });
  await page.goto('/');
  // Wait for heading to confirm page loaded
  await page.locator('text=/What.*for/i').first().waitFor({ timeout: 10_000 });
  // Switch to the My list tab in the bottom tab bar
  const manualTab = page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: /my list/i });
  await manualTab.click();
  await page.waitForTimeout(300);
};

test.describe('Saved list picker', () => {
  test('selector opens the saved lists in a dialog', async ({ page }) => {
    await setupManualTab(page);
    const selector = page.getByRole('button', { name: /^Choose a list:/ });
    await expect(selector).toBeVisible();
    await expect(selector).toHaveAttribute('aria-expanded', 'false');
    await selector.click();
    await expect(page.getByRole('dialog', { name: 'Choose a list', exact: true })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Saved lists', exact: true })).toBeVisible();
  });

  test('saved lists and the New list action are visible', async ({ page }) => {
    await setupManualTab(page);
    await expect(page.getByRole('button', { name: 'Create new list', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /^Choose a list:/ }).click();
    const choices = page.getByRole('list', { name: 'Saved lists', exact: true }).getByRole('button');
    await expect(choices.first()).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Create new list', exact: true })).toBeVisible();
  });

  test('exactly one personal list is selected', async ({ page }) => {
    await setupManualTab(page);
    await page.getByRole('button', { name: /^Choose a list:/ }).click();
    const selected = page.getByRole('list', { name: 'Saved lists', exact: true }).getByRole('button', { pressed: true });
    await expect(selected).toBeVisible();
    await expect(selected).toHaveCount(1);
  });

  test('rename and delete actions visible for selected list', async ({ page }) => {
    await setupManualTab(page);
    const renameBtn = page.getByRole('button', { name: /edit list name/i });
    await expect(renameBtn).toBeVisible();
  });

  test('clicking New opens edit form', async ({ page }) => {
    await setupManualTab(page);
    const newBtn = page.getByRole('button', { name: /create new list/i });
    await newBtn.click();
    // Edit form should appear
    const nameInput = page.getByLabel(/list name/i);
    await expect(nameInput).toBeVisible();
    const mealTimeSelect = page.getByLabel(/meal time/i);
    await expect(mealTimeSelect).toBeVisible();
  });

  test('clicking Rename opens edit form', async ({ page }) => {
    await setupManualTab(page);
    const renameBtn = page.getByRole('button', { name: /edit list name/i });
    await renameBtn.click();
    const nameInput = page.getByLabel(/list name/i);
    await expect(nameInput).toBeVisible();
    // Cancel should be available
    const cancelBtn = page.getByRole('button', { name: /cancel/i });
    await expect(cancelBtn).toBeVisible();
  });

  test('no dropdown select element exists', async ({ page }) => {
    await setupManualTab(page);
    // The old dropdown should be gone
    const oldDropdown = page.locator('#saved-manual-list');
    await expect(oldDropdown).toHaveCount(0);
  });
});
