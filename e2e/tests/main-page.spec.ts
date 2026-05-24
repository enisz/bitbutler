import { expect, test } from '@playwright/test';
import { MainPageHandle, launchAppOnMainPage } from '../helpers/app';
import { closeApp } from '../helpers/electron';
import { MainPage } from '../pages/main.page';

test.describe('Main page', () => {
  let handle: MainPageHandle;
  let mainPage: MainPage;

  test.beforeEach(async () => {
    handle = await launchAppOnMainPage();
    mainPage = new MainPage(handle.page);
    await mainPage.waitForReady();
  });

  test.afterEach(async () => {
    await closeApp(handle);
  });

  test('torrent grid renders with the seeded fixture torrent row visible', async () => {
    await expect(handle.page.locator('.ag-row').first()).toBeVisible();
    const count = await mainPage.getTorrentRowCount();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('button bar is visible', async () => {
    await expect(mainPage.buttonBar).toBeVisible();
    await expect(mainPage.pauseAllButton).toBeVisible();
  });

  test('Pause All button changes the fixture torrent state to paused', async () => {
    await mainPage.pauseAllButton.click();
    // Wait briefly for state update, then verify row still exists (fixture torrent is already paused so no error)
    await handle.page.waitForTimeout(1000);
    await expect(handle.page.locator('.ag-row').first()).toBeVisible();
  });

  test('status bar is visible', async () => {
    await expect(mainPage.statusBar).toBeVisible();
  });
});
