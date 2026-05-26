import { expect, test } from '@playwright/test';
import { AppHandle, closeApp, launchApp } from '../helpers/electron';
import { QB_HOST, QB_PASS, QB_PORT, QB_USER } from '../helpers/qbittorrent';
import { LoginPage } from '../pages/login.page';
import { ServerEditorModal } from '../pages/server-editor.modal';

test.describe('Server management', () => {
  let handle: AppHandle;
  let loginPage: LoginPage;
  let serverEditor: ServerEditorModal;

  test.beforeEach(async () => {
    handle = await launchApp();
    loginPage = new LoginPage(handle.page);
    serverEditor = new ServerEditorModal(handle.page);
    await loginPage.waitForReady();
  });

  test.afterEach(async () => {
    await closeApp(handle);
  });

  test('clicking Add Server opens the server editor modal', async () => {
    await loginPage.addServerButton.click();
    await expect(serverEditor.modalTitle).toBeVisible();
  });

  test('server editor modal has a name input', async () => {
    await loginPage.addServerButton.click();
    await expect(serverEditor.nameInput).toBeVisible();
  });

  test('dismissing the modal returns to login page', async () => {
    await loginPage.addServerButton.click();
    await serverEditor.closeButton.click();
    await expect(loginPage.brandTitle).toBeVisible();
    await expect(serverEditor.modalTitle).not.toBeVisible();
  });

  test('save button is disabled until all required fields are filled', async () => {
    await loginPage.addServerButton.click();
    await serverEditor.waitForReady();
    await expect(serverEditor.saveButton).toBeDisabled();

    // Name alone is not enough — host, username, password are also required
    await serverEditor.nameInput.fill('partial');
    await expect(serverEditor.saveButton).toBeDisabled();

    // Fill all required fields
    await serverEditor.fill('full-server', QB_HOST, QB_PORT, QB_USER, QB_PASS);
    await expect(serverEditor.saveButton).toBeEnabled();
  });

  test('saving a new server adds it to the server list', async () => {
    await loginPage.addServerButton.click();
    await serverEditor.waitForReady();
    await serverEditor.fill('e2e-new-server', QB_HOST, QB_PORT, QB_USER, QB_PASS);
    await serverEditor.saveButton.click();
    await serverEditor.modalTitle.waitFor({ state: 'hidden' });

    const servers = await handle.page.evaluate(() => window.bitbutler.server.list());
    expect((servers as Array<{ name: string }>).some((s) => s.name === 'e2e-new-server')).toBe(
      true,
    );
  });

  test('deleting a server removes it from the list', async () => {
    // Pre-add a server via IPC
    await handle.page.evaluate(
      async ({ host, port, username, password }) => {
        await window.bitbutler.server.add({
          name: 'delete-me',
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

    // Open the server dropdown and click the delete button for "delete-me"
    await handle.page.locator('ng-select#server').click();
    const option = handle.page.locator('.ng-option').filter({ hasText: 'delete-me' });
    await option.waitFor({ state: 'visible' });
    await option.locator('.btn-link.text-danger').click();

    const servers = await handle.page.evaluate(() => window.bitbutler.server.list());
    expect((servers as Array<{ name: string }>).every((s) => s.name !== 'delete-me')).toBe(true);
  });

  test('editing a server name updates it in the list', async () => {
    // Pre-add a server via IPC
    await handle.page.evaluate(
      async ({ host, port, username, password }) => {
        await window.bitbutler.server.add({
          name: 'edit-me',
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

    // Open dropdown and click the edit button (2nd button in the btn-group)
    await handle.page.locator('ng-select#server').click();
    const option = handle.page.locator('.ng-option').filter({ hasText: 'edit-me' });
    await option.waitFor({ state: 'visible' });
    await option.locator('.btn-group .btn-link').nth(1).click();

    await serverEditor.waitForReady();
    await serverEditor.nameInput.fill('renamed-server');
    await serverEditor.saveButton.click();
    await serverEditor.modalTitle.waitFor({ state: 'hidden' });

    const servers = await handle.page.evaluate(() => window.bitbutler.server.list());
    expect(
      (servers as Array<{ name: string }>).some((s) => s.name === 'renamed-server'),
    ).toBe(true);
  });
});
