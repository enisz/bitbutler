import { expect, test } from '@playwright/test';
import { MainPageHandle, launchAppOnMainPage } from '../helpers/app';
import { AppHandle, closeApp, launchAppWithDataDir } from '../helpers/electron';
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
    // Options are appended to ngb-modal-window and include an img with alt text; use text filter
    await handle.page.locator('.ng-option').filter({ hasText: targetFamily }).click();

    // Theme is applied only after save completes (async IPC to Electron)
    await settingsModal.saveButton.click();
    await handle.page.waitForFunction(
      (expected) => document.documentElement.getAttribute('data-bb-theme') === expected,
      targetFamilyValue,
      { timeout: 5_000 },
    );

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

  test('theme family persists after app restart', async () => {
    await mainPage.settingsGroupButton.click();
    await mainPage.openSettingsButton.click();
    await settingsModal.waitForReady();

    const initialFamily = await handle.page.evaluate(() =>
      document.documentElement.getAttribute('data-bb-theme'),
    );

    const targetFamily = initialFamily === 'bitbutler' ? 'Aurora' : 'BitButler';
    const targetFamilyValue = targetFamily === 'Aurora' ? 'aurora' : 'bitbutler';

    await handle.page.locator('.bb-tab-panel--active ng-select').nth(2).click();
    await handle.page.locator('.ng-option').filter({ hasText: targetFamily }).click();
    await settingsModal.saveButton.click();
    await handle.page.waitForFunction(
      (expected) => document.documentElement.getAttribute('data-bb-theme') === expected,
      targetFamilyValue,
      { timeout: 5_000 },
    );

    // Restart with the same userDataDir so the saved theme is loaded from the DB
    const { userDataDir } = handle;
    await handle.app.close().catch(() => {});

    const handle2: AppHandle = await launchAppWithDataDir(userDataDir);
    try {
      // ThemeService.init() runs as an APP_INITIALIZER — theme is applied before Angular renders
      await handle2.page.waitForLoadState('domcontentloaded');
      // Give the initializer a moment to run
      await handle2.page.waitForTimeout(2000);

      const persistedFamily = await handle2.page.evaluate(() =>
        document.documentElement.getAttribute('data-bb-theme'),
      );
      expect(persistedFamily).toBe(targetFamilyValue);
    } finally {
      // closeApp deletes the userDataDir; afterEach will try closeApp(handle) but app1 is
      // already closed (swallowed) and rm with force:true succeeds on a missing dir
      await closeApp(handle2);
    }
  });
});
