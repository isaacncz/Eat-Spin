import { expect, type Page } from '@playwright/test';

export async function openListPicker(page: Page) {
  await page.getByRole('button', { name: /^Choose a list:/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Choose a list', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function chooseSavedList(page: Page, name: string) {
  const dialog = await openListPicker(page);
  await dialog.getByRole('button', { name: `Open list ${name}`, exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

export async function expectSavedListCount(page: Page, count: number) {
  const dialog = await openListPicker(page);
  await expect(dialog.getByRole('list', { name: 'Saved lists', exact: true }).getByRole('listitem')).toHaveCount(count);
  await dialog.getByRole('button', { name: 'Close list picker', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}
