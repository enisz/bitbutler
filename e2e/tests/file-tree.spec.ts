import { expect, test } from '@playwright/test';
import { MainPageHandle, launchAppOnMainPage } from '../helpers/app';
import { closeApp } from '../helpers/electron';
import { getSid, getTorrentFiles, renameTorrentFile } from '../helpers/qbittorrent';
import { FileTreeModal } from '../pages/file-tree.modal';
import { MainPage } from '../pages/main.page';

test.describe('File tree', () => {
  let handle: MainPageHandle;
  let mainPage: MainPage;
  let fileTreeModal: FileTreeModal;

  test.beforeEach(async () => {
    handle = await launchAppOnMainPage();
    mainPage = new MainPage(handle.page);
    await mainPage.waitForReady();
    fileTreeModal = new FileTreeModal(handle.page);

    // Open file tree via context menu - renameFiles is inside the files submenu
    await mainPage.rightClickTorrentRow();
    await mainPage.ctxFilesSubmenu.click();
    await mainPage.ctxRenameFiles.click();
    await fileTreeModal.waitForReady();
  });

  test.afterEach(async () => {
    await closeApp(handle);
  });

  test('file tree shows hello.txt and world.txt', async () => {
    const names = await fileTreeModal.getFileNames();
    expect(names.some((n) => n.includes('hello.txt'))).toBe(true);
    expect(names.some((n) => n.includes('world.txt'))).toBe(true);
  });

  test('file tree container is visible', async () => {
    await expect(fileTreeModal.fileTree).toBeVisible();
  });

  test('escape key in edit mode reverts to original names', async () => {
    // Focus a file input and press Escape — onEscapeInInput calls cancelEdit() without confirm
    // (sessionDirty is false since we haven't triggered a change event)
    const input = handle.page.locator('[data-testid-file="hello.txt"]');
    await input.focus();
    await handle.page.keyboard.press('Escape');

    // Edit button reappears when view mode is restored
    await expect(fileTreeModal.editButton).toBeVisible({ timeout: 5_000 });

    const names = await fileTreeModal.getFileNames();
    expect(names.some((n) => n.includes('hello.txt'))).toBe(true);
    expect(names.some((n) => n.includes('world.txt'))).toBe(true);
  });

  test('cancel button exits edit mode without saving changes', async () => {
    // fill() triggers the input event (ngModel update) but NOT change, so sessionDirty stays false
    // and cancelEdit() proceeds without a confirm dialog
    await handle.page.locator('[data-testid-file="hello.txt"]').fill('modified.txt');
    await fileTreeModal.cancelEditMode();

    const names = await fileTreeModal.getFileNames();
    expect(names.some((n) => n.includes('hello.txt'))).toBe(true);
    expect(names.some((n) => n.includes('modified.txt'))).toBe(false);
  });

  test('file rows have data-testid attributes', async () => {
    const helloRow = fileTreeModal.fileRow('hello.txt');
    await expect(helloRow).toBeVisible();
    const worldRow = fileTreeModal.fileRow('world.txt');
    await expect(worldRow).toBeVisible();
  });

  test('rename hello.txt to renamed.txt shows new name in tree', async () => {
    await fileTreeModal.renameFile('hello.txt', 'renamed.txt');

    await handle.page.waitForFunction(
      () => {
        const rows = document.querySelectorAll('.bb-row--file');
        return Array.from(rows).some((r) => r.textContent?.includes('renamed.txt'));
      },
      { timeout: 10_000 },
    );

    const names = await fileTreeModal.getFileNames();
    expect(names.some((n) => n.includes('renamed.txt'))).toBe(true);
  });

  test('rename persists in qBittorrent after save', async () => {
    // world.txt is still intact at this point (only hello.txt was renamed by the previous test)
    const hash = process.env['FIXTURE_HASH'] ?? '';

    await fileTreeModal.renameFile('world.txt', 'e2e-persist.txt');

    // Wait for the tree to return to view mode (saveEdit() exits edit mode)
    await expect(fileTreeModal.editButton).toBeVisible({ timeout: 10_000 });

    // Poll the qB API until the rename propagates
    let persisted = false;
    for (let i = 0; i < 20; i++) {
      const sid = await getSid();
      const files = await getTorrentFiles(sid, hash);
      if (files.some((f) => f.name.endsWith('e2e-persist.txt'))) {
        persisted = true;
        break;
      }
      await handle.page.waitForTimeout(500);
    }
    expect(persisted).toBe(true);

    // Rename back so the fixture is clean for future runs
    const cleanupSid = await getSid();
    await renameTorrentFile(cleanupSid, hash, 'test-files/e2e-persist.txt', 'test-files/world.txt');
  });
});
