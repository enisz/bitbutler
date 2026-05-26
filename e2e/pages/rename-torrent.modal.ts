import { Page } from '@playwright/test';

export class RenameTorrentModal {
  readonly modal = this.page.getByTestId('rename-torrent-modal');
  readonly nameInput = this.page.getByTestId('rename-torrent-input');
  readonly saveButton = this.page.getByTestId('rename-torrent-save');
  readonly cancelButton = this.page.getByTestId('rename-torrent-cancel');

  constructor(private readonly page: Page) {}

  async waitForReady(): Promise<void> {
    await this.modal.waitFor({ state: 'visible' });
  }
}
