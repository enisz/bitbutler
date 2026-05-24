import { expect, test } from '@playwright/test';
import { AppHandle, closeApp, launchApp } from '../helpers/electron';
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
});
