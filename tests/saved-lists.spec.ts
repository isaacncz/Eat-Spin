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

test.describe('Saved lists chips', () => {
  test('chip bar renders with listbox role', async ({ page }) => {
    await setupManualTab(page);
    const chipBar = page.getByRole('listbox', { name: /saved lists/i });
    await expect(chipBar).toBeVisible();
  });

  test('at least one chip and New button visible', async ({ page }) => {
    await setupManualTab(page);
    const chipBar = page.getByRole('listbox', { name: /saved lists/i });
    // At least one option chip
    const chips = chipBar.getByRole('option');
    await expect(chips.first()).toBeVisible();
    // New list button
    const newBtn = page.getByRole('button', { name: /create new list/i });
    await expect(newBtn).toBeVisible();
  });

  test('selected chip has aria-selected true', async ({ page }) => {
    await setupManualTab(page);
    const chipBar = page.getByRole('listbox', { name: /saved lists/i });
    const selectedChip = chipBar.getByRole('option', { selected: true });
    await expect(selectedChip).toBeVisible();
    // Only one should be selected
    await expect(selectedChip).toHaveCount(1);
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
