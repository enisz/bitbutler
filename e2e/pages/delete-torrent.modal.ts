import { Page } from '@playwright/test';

export class DeleteTorrentModal {
  readonly modal = this.page.getByTestId('delete-torrent-modal');
  readonly removeFilesCheckbox = this.page.getByTestId('delete-remove-files-checkbox');
  readonly confirmButton = this.page.getByTestId('delete-confirm-button');
  readonly cancelButton = this.page.getByTestId('delete-cancel-button');

  constructor(private readonly page: Page) {}

  async waitForReady(): Promise<void> {
    await this.modal.waitFor({ state: 'visible' });
  }
}
