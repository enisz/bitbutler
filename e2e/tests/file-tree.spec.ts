import { expect, test } from '@playwright/test';
import { MainPageHandle, launchAppOnMainPage } from '../helpers/app';
import { closeApp } from '../helpers/electron';
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
});
