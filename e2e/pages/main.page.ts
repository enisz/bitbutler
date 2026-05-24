import { Page } from '@playwright/test';

export class MainPage {
  readonly buttonBar = this.page.getByTestId('button-bar');
  readonly torrentGrid = this.page.getByTestId('torrent-grid');
  readonly statusBar = this.page.getByTestId('status-bar');

  // Toolbar group toggles (open dropdowns)
  readonly addGroupButton = this.page.getByTestId('toolbar-btn-new');
  readonly settingsGroupButton = this.page.getByTestId('toolbar-btn-settings');
  readonly manageGroupButton = this.page.getByTestId('toolbar-btn-manage');

  // Toolbar dropdown items (inside groups)
  readonly addTorrentFileButton = this.page.getByTestId('toolbar-btn-new.addTorrentFile');
  readonly addTorrentLinkButton = this.page.getByTestId('toolbar-btn-new.addTorrentLink');
  readonly openSettingsButton = this.page.getByTestId('toolbar-btn-settings.open');
  readonly openQbSettingsButton = this.page.getByTestId('toolbar-btn-qb-settings.open');
  readonly manageServersButton = this.page.getByTestId('toolbar-btn-manage.servers');
  readonly manageTagsButton = this.page.getByTestId('toolbar-btn-manage.tags');
  readonly manageCategoriesButton = this.page.getByTestId('toolbar-btn-manage.categories');

  // Toolbar action buttons (direct, not in groups)
  readonly deleteTorrentButton = this.page.getByTestId('toolbar-btn-delete.deleteTorrent');
  readonly resumeButton = this.page.getByTestId('toolbar-btn-control.resume');
  readonly pauseButton = this.page.getByTestId('toolbar-btn-control.pause');
  readonly resumeAllButton = this.page.getByTestId('toolbar-btn-control.resumeAll');
  readonly pauseAllButton = this.page.getByTestId('toolbar-btn-control.pauseAll');
  readonly queueMoveTopButton = this.page.getByTestId('toolbar-btn-queue.moveTop');
  readonly queueMoveUpButton = this.page.getByTestId('toolbar-btn-queue.moveUp');
  readonly queueMoveDownButton = this.page.getByTestId('toolbar-btn-queue.moveDown');
  readonly queueMoveBottomButton = this.page.getByTestId('toolbar-btn-queue.moveBottom');

  // Context menu - top-level items
  readonly ctxStart = this.page.getByTestId('ctx-control.start');
  readonly ctxStop = this.page.getByTestId('ctx-control.stop');
  readonly ctxForceResume = this.page.getByTestId('ctx-control.forceResume');
  readonly ctxTorrentDetails = this.page.getByTestId('ctx-torrent.details');
  readonly ctxDelete = this.page.getByTestId('ctx-files.remove');

  // Context menu - submenu triggers
  readonly ctxFilesSubmenu = this.page.getByTestId('ctx-files');
  readonly ctxQueueSubmenu = this.page.getByTestId('ctx-queue');
  readonly ctxTransferSubmenu = this.page.getByTestId('ctx-transfer');
  readonly ctxMaintenanceSubmenu = this.page.getByTestId('ctx-maintenance');
  readonly ctxCopySubmenu = this.page.getByTestId('ctx-copy');
  readonly ctxPinRowSubmenu = this.page.getByTestId('ctx-row.pin');

  // Context menu - files submenu items
  readonly ctxOpenDestination = this.page.getByTestId('ctx-files.openDestination');
  readonly ctxSetLocation = this.page.getByTestId('ctx-files.setLocation');
  readonly ctxRenameTorrent = this.page.getByTestId('ctx-files.renameTorrent');
  readonly ctxRenameFiles = this.page.getByTestId('ctx-files.renameFiles');
  readonly ctxSetCategory = this.page.getByTestId('ctx-files.category');
  readonly ctxSetTags = this.page.getByTestId('ctx-files.tags');

  // Context menu - copy submenu items
  readonly ctxCopyCellValue = this.page.getByTestId('ctx-cell.copyValue');
  readonly ctxCopyInfoHash = this.page.getByTestId('ctx-torrent.copyInfoHash');
  readonly ctxCopyMagnet = this.page.getByTestId('ctx-torrent.copyMagnet');
  readonly ctxCopyJson = this.page.getByTestId('ctx-torrent.copyJson');

  constructor(private readonly page: Page) {}

  async waitForReady(): Promise<void> {
    await this.torrentGrid.waitFor({ state: 'visible' });
    await this.page.waitForSelector('.ag-row', { timeout: 15_000 });
  }

  async rightClickTorrentRow(): Promise<void> {
    const row = this.page.locator('.ag-row').first();
    await row.waitFor({ state: 'visible' });
    await row.click({ button: 'right' });
  }

  async getTorrentRowCount(): Promise<number> {
    return this.page.locator('.ag-row').count();
  }

  async getFirstTorrentName(): Promise<string | null> {
    const nameCell = this.page.locator('.ag-row').first().locator('.ag-cell[col-id="name"]');
    return nameCell.textContent();
  }
}
