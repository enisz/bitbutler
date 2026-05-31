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

});
