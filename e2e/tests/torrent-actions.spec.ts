import { expect, test } from '@playwright/test';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MainPageHandle, launchAppOnMainPage } from '../helpers/app';
import { closeApp } from '../helpers/electron';
import {
  addTorrent,
  createTag,
  deleteTags,
  getSid,
  getTorrentInfo,
  getTorrentProperties,
  getTorrents,
} from '../helpers/qbittorrent';
import { DeleteTorrentModal } from '../pages/delete-torrent.modal';
import { MainPage } from '../pages/main.page';
import { RenameTorrentModal } from '../pages/rename-torrent.modal';
import { SetCategoryModal } from '../pages/set-category.modal';
import { SetLocationModal } from '../pages/set-location.modal';
import { SetTagsModal } from '../pages/set-tags.modal';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

  test('set category on torrent updates via qB API', async () => {
    // Create a category via the qB API
    const sid = await getSid();
    await fetch(`http://127.0.0.1:8080/api/v2/torrents/createCategory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sid },
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

    // The category column is hidden by default; verify via qB API instead
    await handle.page.waitForTimeout(1000);
    const verSid = await getSid();
    const res = await fetch('http://127.0.0.1:8080/api/v2/torrents/info', {
      headers: { Cookie: verSid },
    });
    const torrents = (await res.json()) as Array<{ category: string }>;
    expect(torrents.some((t) => t.category === 'e2e-cat')).toBe(true);
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

  test('start and stop change torrent state via context menu', async () => {
    const hash = process.env['FIXTURE_HASH'] ?? '';

    await mainPage.rightClickTorrentRow();
    await mainPage.ctxStart.click();

    // Poll until the torrent is no longer in a stopped/paused state
    let started = false;
    for (let i = 0; i < 20; i++) {
      const sid = await getSid();
      const info = await getTorrentInfo(sid);
      const t = info.find((t) => t.hash === hash);
      const s = t?.state.toLowerCase() ?? '';
      if (t && !s.includes('stopped') && !s.includes('paused')) {
        started = true;
        break;
      }
      await handle.page.waitForTimeout(500);
    }
    expect(started).toBe(true);

    await mainPage.rightClickTorrentRow();
    await mainPage.ctxStop.click();

    // Poll until stopped/paused
    let stopped = false;
    for (let i = 0; i < 20; i++) {
      const sid = await getSid();
      const info = await getTorrentInfo(sid);
      const t = info.find((t) => t.hash === hash);
      const s = t?.state.toLowerCase() ?? '';
      if (t && (s.includes('stopped') || s.includes('paused'))) {
        stopped = true;
        break;
      }
      await handle.page.waitForTimeout(500);
    }
    expect(stopped).toBe(true);
  });

  test('set tags on torrent updates via qB API', async () => {
    const sid = await getSid();
    await createTag(sid, 'e2e-tag');

    await mainPage.rightClickTorrentRow();
    await mainPage.ctxFilesSubmenu.click();
    const setTagsModal = new SetTagsModal(handle.page);
    await mainPage.ctxSetTags.click();
    await setTagsModal.waitForReady();
    await setTagsModal.selectTag('e2e-tag');
    await setTagsModal.saveButton.click();
    await setTagsModal.modal.waitFor({ state: 'hidden' });

    // Verify via qB API
    await handle.page.waitForTimeout(1000);
    const verSid = await getSid();
    const torrents = await getTorrentInfo(verSid);
    expect(torrents.some((t) => t.tags.includes('e2e-tag'))).toBe(true);

    // Cleanup: deleting the tag removes it from all torrents
    const cleanupSid = await getSid();
    await deleteTags(cleanupSid, 'e2e-tag');
  });

  test('delete torrent without removing files keeps row count lower', async () => {
    const sid = await getSid();
    const torrentPath = path.resolve(__dirname, '../fixtures/test-add.torrent');
    await addTorrent(sid, torrentPath);
    await handle.page.waitForTimeout(1000);
    await handle.page.reload();
    await mainPage.waitForReady();

    const countBefore = await mainPage.getTorrentRowCount();

    const lastRow = handle.page.locator('.ag-row').filter({ hasText: 'test-add-files' });
    await lastRow.click({ button: 'right' });
    const deleteTorrentModal = new DeleteTorrentModal(handle.page);
    await mainPage.ctxDelete.click();
    await deleteTorrentModal.waitForReady();

    const checkbox = deleteTorrentModal.removeFilesCheckbox;
    const isChecked = await checkbox.isChecked();
    if (isChecked) await checkbox.uncheck();

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

  test('delete torrent with delete files removes row from grid', async () => {
    // Add a throwaway torrent using a different fixture so the shared fixture remains intact.
    // test.torrent is already seeded by globalSetup (same hash → qBittorrent 5.x returns 409).
    const sid = await getSid();
    const torrentPath = path.resolve(__dirname, '../fixtures/test-add.torrent');
    await addTorrent(sid, torrentPath);
    await handle.page.waitForTimeout(1000);
    await handle.page.reload();
    await mainPage.waitForReady();

    const countBefore = await mainPage.getTorrentRowCount();

    // Right-click the throwaway row (by name, not .last() which targets the shared fixture)
    const lastRow = handle.page.locator('.ag-row').filter({ hasText: 'test-add-files' });
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
