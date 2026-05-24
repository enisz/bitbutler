import { expect, test } from '@playwright/test';
import * as path from 'node:path';
import { MainPageHandle, launchAppOnMainPage } from '../helpers/app';
import { closeApp } from '../helpers/electron';
import { addTorrent, getSid, getTorrentProperties, getTorrents } from '../helpers/qbittorrent';
import { DeleteTorrentModal } from '../pages/delete-torrent.modal';
import { MainPage } from '../pages/main.page';
import { RenameTorrentModal } from '../pages/rename-torrent.modal';
import { SetCategoryModal } from '../pages/set-category.modal';
import { SetLocationModal } from '../pages/set-location.modal';

test.describe('Torrent actions', () => {
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

  test('rename torrent shows new name in grid', async () => {
    await mainPage.rightClickTorrentRow();
    await mainPage.ctxFilesSubmenu.click();
    const renameTorrentModal = new RenameTorrentModal(handle.page);
    await mainPage.ctxRenameTorrent.click();
    await renameTorrentModal.waitForReady();

    await renameTorrentModal.nameInput.fill('renamed-torrent');
    await renameTorrentModal.saveButton.click();
    await renameTorrentModal.modal.waitFor({ state: 'hidden' });

    await handle.page.waitForFunction(
      () => {
        const cells = document.querySelectorAll('.ag-cell[col-id="name"]');
        return Array.from(cells).some((c) => c.textContent?.includes('renamed-torrent'));
      },
      { timeout: 10_000 },
    );
    const name = await mainPage.getFirstTorrentName();
    expect(name).toContain('renamed-torrent');
  });

  test('set category shows category label in grid row', async () => {
    // First create a category via the qB API
    const sid = await getSid();
    await fetch(`http://127.0.0.1:18080/api/v2/torrents/createCategory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: `SID=${sid}` },
      body: new URLSearchParams({ category: 'e2e-cat' }).toString(),
    });

    await mainPage.rightClickTorrentRow();
    await mainPage.ctxFilesSubmenu.click();
    const setCategoryModal = new SetCategoryModal(handle.page);
    await mainPage.ctxSetCategory.click();
    await setCategoryModal.waitForReady();
    await setCategoryModal.selectCategory('e2e-cat');
    await setCategoryModal.saveButton.click();
    await setCategoryModal.modal.waitFor({ state: 'hidden' });

    await handle.page.waitForFunction(
      () => {
        const cells = document.querySelectorAll('.ag-cell[col-id="category"]');
        return Array.from(cells).some((c) => c.textContent?.includes('e2e-cat'));
      },
      { timeout: 10_000 },
    );
    const catCell = handle.page.locator('.ag-row').first().locator('.ag-cell[col-id="category"]');
    await expect(catCell).toContainText('e2e-cat');
  });

  test('set save location updates location in qB API', async () => {
    const newPath = '/tmp/e2e-location-test';
    await mainPage.rightClickTorrentRow();
    await mainPage.ctxFilesSubmenu.click();
    const setLocationModal = new SetLocationModal(handle.page);
    await mainPage.ctxSetLocation.click();
    await setLocationModal.waitForReady();
    await setLocationModal.setPath(newPath);
    await setLocationModal.saveButton.click();
    await setLocationModal.modal.waitFor({ state: 'hidden' });

    // Verify via qB API
    await handle.page.waitForTimeout(1000);
    const verSid = await getSid();
    const torrents = await getTorrents(verSid);
    if (torrents.length > 0) {
      const props = await getTorrentProperties(verSid, torrents[0].hash);
      expect(props.save_path).toBe(newPath);
    }
  });

  test('delete torrent with delete files removes row from grid', async () => {
    // Add a throwaway torrent so we don't delete the shared fixture
    const sid = await getSid();
    const torrentPath = path.resolve(__dirname, '../fixtures/test.torrent');
    await addTorrent(sid, torrentPath);
    await handle.page.waitForTimeout(1000);
    await handle.page.reload();
    await mainPage.waitForReady();

    const countBefore = await mainPage.getTorrentRowCount();

    // Right-click the last row (throwaway) and delete
    const lastRow = handle.page.locator('.ag-row').last();
    await lastRow.click({ button: 'right' });
    const deleteTorrentModal = new DeleteTorrentModal(handle.page);
    await mainPage.ctxDelete.click();
    await deleteTorrentModal.waitForReady();

    const checkbox = deleteTorrentModal.removeFilesCheckbox;
    const isChecked = await checkbox.isChecked();
    if (!isChecked) await checkbox.check();

    await deleteTorrentModal.confirmButton.click();
    await deleteTorrentModal.modal.waitFor({ state: 'hidden' });

    await handle.page.waitForFunction(
      (expectedCount) => document.querySelectorAll('.ag-row').length < expectedCount,
      countBefore,
      { timeout: 10_000 },
    );
    const countAfter = await mainPage.getTorrentRowCount();
    expect(countAfter).toBeLessThan(countBefore);
  });
});
