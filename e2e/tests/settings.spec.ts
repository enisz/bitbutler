import { expect, test } from '@playwright/test';
import { MainPageHandle, launchAppOnMainPage } from '../helpers/app';
import { closeApp } from '../helpers/electron';
import { MainPage } from '../pages/main.page';
import { SettingsModal } from '../pages/settings.modal';

test.describe('Settings', () => {
  let handle: MainPageHandle;
  let mainPage: MainPage;
  let settingsModal: SettingsModal;

  test.beforeEach(async () => {
    handle = await launchAppOnMainPage();
    mainPage = new MainPage(handle.page);
    await mainPage.waitForReady();
    settingsModal = new SettingsModal(handle.page);
  });

  test.afterEach(async () => {
    await closeApp(handle);
  });

  test('settings modal opens from the button bar', async () => {
    await mainPage.settingsGroupButton.click();
    await mainPage.openSettingsButton.click();
    await settingsModal.waitForReady();
    await expect(settingsModal.modal).toBeVisible();
  });

  test('all four tabs are visible in the settings modal', async () => {
    await mainPage.settingsGroupButton.click();
    await mainPage.openSettingsButton.click();
    await settingsModal.waitForReady();

    await expect(settingsModal.tabGeneral).toBeVisible();
    await expect(settingsModal.tabServer).toBeVisible();
    await expect(settingsModal.tabTorrentListGrid).toBeVisible();
    await expect(settingsModal.tabStatusBar).toBeVisible();
  });

  test('switching theme family updates the data-bb-theme attribute', async () => {
    await mainPage.settingsGroupButton.click();
    await mainPage.openSettingsButton.click();
    await settingsModal.waitForReady();

    const initialFamily = await handle.page.evaluate(() =>
      document.documentElement.getAttribute('data-bb-theme'),
    );

    // Pick a family different from the current one
    const targetFamily = initialFamily === 'bitbutler' ? 'Aurora' : 'BitButler';
    const targetFamilyValue = targetFamily === 'Aurora' ? 'aurora' : 'bitbutler';

    // Open the family ng-select (third ng-select in the general tab panel)
    const familySelect = handle.page.locator('.bb-tab-panel--active ng-select').nth(2);
    await familySelect.click();
    await handle.page.getByRole('option', { name: targetFamily, exact: true }).click();

    const newFamily = await handle.page.evaluate(() =>
      document.documentElement.getAttribute('data-bb-theme'),
    );
    expect(newFamily).toBe(targetFamilyValue);
  });

  test('closing settings without saving produces no error', async () => {
    await mainPage.settingsGroupButton.click();
    await mainPage.openSettingsButton.click();
    await settingsModal.waitForReady();
    await settingsModal.closeButton.click();
    await settingsModal.modal.waitFor({ state: 'hidden' });
    await expect(mainPage.torrentGrid).toBeVisible();
  });

  test('save button is disabled when settings are not dirty', async () => {
    await mainPage.settingsGroupButton.click();
    await mainPage.openSettingsButton.click();
    await settingsModal.waitForReady();
    await expect(settingsModal.saveButton).toBeDisabled();
  });
});
