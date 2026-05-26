import { expect, test } from '@playwright/test';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MainPageHandle, launchAppOnMainPage } from '../helpers/app';
import { closeApp } from '../helpers/electron';
import { deleteTorrent, getSid, getTorrents } from '../helpers/qbittorrent';
import { AddTorrentModal } from '../pages/add-torrent.modal';
import { MainPage } from '../pages/main.page';
import { TorrentExistsModal } from '../pages/torrent-exists.modal';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    // Delete test-add-files so it doesn't contaminate subsequent test files
    try {
      const sid = await getSid();
      const torrents = await getTorrents(sid);
      const added = torrents.find((t) => t.name === 'test-add-files');
      if (added) await deleteTorrent(sid, added.hash);
    } catch {
      // best-effort
    }
    await closeApp(handle);
  });

  test('cancelling the add torrent modal does not add a row', async () => {
    const countBefore = await mainPage.getTorrentRowCount();

    const torrentPath = path.resolve(__dirname, '../fixtures/test-add.torrent');
    await handle.page.evaluate(async (filePath) => {
      await window.bitbutler.window.simulateOpenFiles([filePath]);
    }, torrentPath);

    await addTorrentModal.waitForReady();
    await addTorrentModal.cancelButton.click();
    await addTorrentModal.modal.waitFor({ state: 'hidden' });

    const countAfter = await mainPage.getTorrentRowCount();
    expect(countAfter).toBe(countBefore);
  });

  test('adding a duplicate torrent shows the torrent-exists modal', async () => {
    // test.torrent is already seeded by globalSetup — adding it again triggers a 409 response
    // which the app handles by showing the TorrentExists modal
    const torrentPath = path.resolve(__dirname, '../fixtures/test.torrent');
    await handle.page.evaluate(async (filePath) => {
      await window.bitbutler.window.simulateOpenFiles([filePath]);
    }, torrentPath);

    await addTorrentModal.waitForReady();
    await addTorrentModal.submitButton.click();

    const torrentExistsModal = new TorrentExistsModal(handle.page);
    await torrentExistsModal.waitForReady();
    await expect(torrentExistsModal.modal).toBeVisible();
  });

  test('add torrent via .torrent file adds a new row to the grid', async () => {
    const countBefore = await mainPage.getTorrentRowCount();

    const torrentPath = path.resolve(__dirname, '../fixtures/test-add.torrent');
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
