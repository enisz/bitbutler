import { expect, test } from '@playwright/test';
import { MainPageHandle, launchAppOnMainPage } from '../helpers/app';
import { closeApp } from '../helpers/electron';
import { DeleteTorrentModal } from '../pages/delete-torrent.modal';
import { MainPage } from '../pages/main.page';
import { ManageCategoriesModal } from '../pages/manage-categories.modal';
import { ManageTagsModal } from '../pages/manage-tags.modal';

test.describe('Modals', () => {
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

  test('manage categories: add a category, it appears in the list', async () => {
    await mainPage.manageGroupButton.click();
    await mainPage.manageCategoriesButton.click();
    const modal = new ManageCategoriesModal(handle.page);
    await modal.waitForReady();
    await modal.addCategory('e2e-test-cat');
    await expect(handle.page.getByTestId('category-item-e2e-test-cat')).toBeVisible();
  });

  test('manage tags: add a tag, it appears in the list', async () => {
    await mainPage.manageGroupButton.click();
    await mainPage.manageTagsButton.click();
    const modal = new ManageTagsModal(handle.page);
    await modal.waitForReady();
    await modal.addTag('e2e-test-tag');
    await expect(handle.page.getByTestId('tag-item-e2e-test-tag')).toBeVisible();
  });

  test('manage categories: delete a category removes it from the list', async () => {
    await mainPage.manageGroupButton.click();
    await mainPage.manageCategoriesButton.click();
    const modal = new ManageCategoriesModal(handle.page);
    await modal.waitForReady();
    await modal.addCategory('e2e-delete-cat');
    await expect(handle.page.getByTestId('category-item-e2e-delete-cat')).toBeVisible();
    await modal.deleteCategory('e2e-delete-cat');
    await expect(handle.page.getByTestId('category-item-e2e-delete-cat')).not.toBeVisible();
  });

  test('manage tags: delete a tag removes it from the list', async () => {
    await mainPage.manageGroupButton.click();
    await mainPage.manageTagsButton.click();
    const modal = new ManageTagsModal(handle.page);
    await modal.waitForReady();
    await modal.addTag('e2e-delete-tag');
    await expect(handle.page.getByTestId('tag-item-e2e-delete-tag')).toBeVisible();
    await modal.deleteTag('e2e-delete-tag');
    await expect(handle.page.getByTestId('tag-item-e2e-delete-tag')).not.toBeVisible();
  });

  test('clicking Cancel on delete keeps the torrent in the grid', async () => {
    const countBefore = await mainPage.getTorrentRowCount();
    await mainPage.rightClickTorrentRow();
    await mainPage.ctxDelete.click();
    const deleteModal = new DeleteTorrentModal(handle.page);
    await deleteModal.waitForReady();
    await deleteModal.cancelButton.click();
    await deleteModal.modal.waitFor({ state: 'hidden' });
    const countAfter = await mainPage.getTorrentRowCount();
    expect(countAfter).toBe(countBefore);
  });
});
