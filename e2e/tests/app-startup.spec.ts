import { expect, test } from '@playwright/test';
import { AppHandle, closeApp, launchApp } from '../helpers/electron';

test.describe('App startup', () => {
  let handle: AppHandle | undefined;

  test.beforeEach(async () => {
    handle = await launchApp();
  });

  test.afterEach(async () => {
    if (handle) await closeApp(handle);
  });

  test('shows the login page', async () => {
    await expect(handle.page.locator('h1.brand-title')).toHaveText('BitButler');
  });

  test('shows the version badge', async () => {
    await expect(handle.page.locator('.version .badge')).toBeVisible();
  });

  test('connect button is disabled with no servers', async () => {
    const connectBtn = handle.page.locator('button.btn-primary', { hasText: /connect/i });
    await expect(connectBtn).toBeDisabled();
  });

  test('add server button is enabled', async () => {
    const addBtn = handle.page.locator('button.btn-secondary', { hasText: /add/i });
    await expect(addBtn).toBeEnabled();
  });
});
