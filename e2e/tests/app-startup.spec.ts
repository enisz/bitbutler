import { expect, test } from '@playwright/test';
import { AppHandle, closeApp, launchApp } from '../helpers/electron';
import { LoginPage } from '../pages/login.page';

test.describe('App startup', () => {
  let handle: AppHandle;
  let loginPage: LoginPage;

  test.beforeEach(async () => {
    handle = await launchApp();
    loginPage = new LoginPage(handle.page);
    await loginPage.waitForReady();
  });

  test.afterEach(async () => {
    await closeApp(handle);
  });

  test('shows the login page', async () => {
    await expect(loginPage.brandTitle).toHaveText('BitButler');
  });

  test('shows the version badge', async () => {
    await expect(loginPage.versionBadge).toBeVisible();
  });

  test('connect button is disabled with no servers', async () => {
    await expect(loginPage.connectButton).toBeDisabled();
  });

  test('add server button is enabled', async () => {
    await expect(loginPage.addServerButton).toBeEnabled();
  });
});
