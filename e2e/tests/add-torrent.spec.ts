import { expect, test } from '@playwright/test';
import * as path from 'node:path';
import { MainPageHandle, launchAppOnMainPage } from '../helpers/app';
import { closeApp } from '../helpers/electron';
import { AddTorrentModal } from '../pages/add-torrent.modal';
import { MainPage } from '../pages/main.page';

test.describe('Add torrent', () => {
  let handle: MainPageHandle;
  let mainPage: MainPage;
  let addTorrentModal: AddTorrentModal;

  test.beforeEach(async () => {
    handle = await launchAppOnMainPage();
    mainPage = new MainPage(handle.page);
    await mainPage.waitForReady();
    addTorrentModal = new AddTorrentModal(handle.page);
  });

  test.afterEach(async () => {
    await closeApp(handle);
  });

  test('add torrent via .torrent file adds a new row to the grid', async () => {
    const countBefore = await mainPage.getTorrentRowCount();

    const torrentPath = path.resolve(__dirname, '../fixtures/test.torrent');
    await handle.page.evaluate(async (filePath) => {
      await window.bitbutler.window.simulateOpenFiles([filePath]);
    }, torrentPath);

    await addTorrentModal.waitForReady();
    await addTorrentModal.submitButton.click();
    await addTorrentModal.modal.waitFor({ state: 'hidden' });

    // Wait for the new row to appear
    await handle.page.waitForFunction(
      (expectedCount) => document.querySelectorAll('.ag-row').length > expectedCount,
      countBefore,
      { timeout: 10_000 },
    );
    const countAfter = await mainPage.getTorrentRowCount();
    expect(countAfter).toBeGreaterThan(countBefore);
  });
});
