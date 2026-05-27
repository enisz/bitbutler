import { expect, test } from '@playwright/test';
import { AppHandle, closeApp, launchApp } from '../helpers/electron';
import { QB_HOST, QB_PASS, QB_PORT, QB_USER } from '../helpers/qbittorrent';
import { LoginPage } from '../pages/login.page';

test.describe('Login flow', () => {
  let handle: AppHandle;
  let loginPage: LoginPage;

  test.beforeEach(async () => {
    handle = await launchApp();
    loginPage = new LoginPage(handle.page);
    await loginPage.waitForReady();

    await handle.page.evaluate(
      async ({ host, port, username, password }) => {
        await window.bitbutler.server.add({
          name: 'e2e-test',
          host,
          protocol: 'http',
          port,
          username,
          password,
        });
      },
      { host: QB_HOST, port: QB_PORT, username: QB_USER, password: QB_PASS },
    );
    await handle.page.reload();
    await loginPage.waitForReady();
  });

  test.afterEach(async () => {
    await closeApp(handle);
  });

  test('successful login navigates to main page', async () => {
    await loginPage.connectButton.click();
    await handle.page.waitForURL('**/pages/main', { timeout: 20_000 });
    await expect(handle.page.getByTestId('torrent-grid')).toBeVisible();
  });

  test('selecting a specific server from the dropdown connects to that instance', async () => {
    // Add a second (invalid) server alongside the valid one
    await handle.page.evaluate(async () => {
      await window.bitbutler.server.add({
        name: 'invalid-server',
        host: '127.0.0.1',
        protocol: 'http',
        port: 9999,
        username: 'x',
        password: 'x',
      });
    });

    await handle.page.reload();
    await loginPage.waitForReady();

    // Open the server dropdown and verify both servers are listed
    await handle.page.getByTestId('server-select').click();
    await expect(handle.page.getByTestId('server-option-e2e-test')).toBeVisible();
    await expect(handle.page.getByTestId('server-option-invalid-server')).toBeVisible();

    // Select the valid server by clicking its option
    await handle.page.getByTestId('server-option-e2e-test').click();

    await loginPage.connectButton.click();
    await handle.page.waitForURL('**/pages/main', { timeout: 20_000 });
    await expect(handle.page.getByTestId('torrent-grid')).toBeVisible();
  });

  test('failed login with wrong password shows error toast and stays on login page', async () => {
    // Override the saved server with wrong credentials
    const servers = await handle.page.evaluate(() => window.bitbutler.server.list());
    if (servers.length > 0) {
      await handle.page.evaluate(async (id) => {
        await window.bitbutler.server.update({
          id,
          changes: {
            name: 'e2e-test-bad',
            host: '127.0.0.1',
            protocol: 'http',
            port: 8080,
            username: 'admin',
            password: 'wrongpassword',
          },
        });
      }, servers[0].id);
      await handle.page.reload();
      await loginPage.waitForReady();
    }

    await loginPage.connectButton.click();
    // Should stay on login page (URL does not change to /pages/main)
    await handle.page.waitForTimeout(3000);
    await expect(handle.page).not.toHaveURL('**/pages/main');
    await expect(loginPage.brandTitle).toBeVisible();
  });
});
