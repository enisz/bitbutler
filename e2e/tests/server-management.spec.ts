import { expect, test } from '@playwright/test';
import { AppHandle, closeApp, launchApp } from '../helpers/electron';

test.describe('Server management', () => {
  let handle: AppHandle;

  test.beforeEach(async () => {
    handle = await launchApp();
    // Ensure we're on the login page before each test
    await handle.page.waitForSelector('h1.brand-title');
  });

  test.afterEach(async () => {
    await closeApp(handle);
  });

  test('clicking Add Server opens the server editor modal', async () => {
    await handle.page.locator('button.btn-secondary', { hasText: /add/i }).click();
    await expect(handle.page.locator('.modal-title')).toBeVisible();
  });

  test('server editor modal has a name input', async () => {
    await handle.page.locator('button.btn-secondary', { hasText: /add/i }).click();
    await expect(handle.page.locator('#name')).toBeVisible();
  });

  test('dismissing the modal returns to login page', async () => {
    await handle.page.locator('button.btn-secondary', { hasText: /add/i }).click();
    await handle.page.locator('.modal-header .btn-close').click();
    await expect(handle.page.locator('h1.brand-title')).toBeVisible();
    await expect(handle.page.locator('.modal.show')).not.toBeVisible();
  });
});
