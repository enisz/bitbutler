// e2e/pages/add-torrent.modal.ts
import { Page } from '@playwright/test';

export class AddTorrentModal {
  readonly modal = this.page.getByTestId('add-torrent-modal');
  readonly submitButton = this.page.getByTestId('add-torrent-submit');
  readonly cancelButton = this.page.getByTestId('add-torrent-cancel');

  constructor(private readonly page: Page) {}

  async waitForReady(): Promise<void> {
    await this.modal.waitFor({ state: 'visible' });
  }
}
