import { Page } from '@playwright/test';

export class TorrentExistsModal {
  readonly modal = this.page.getByTestId('torrent-exists-modal');

  constructor(private readonly page: Page) {}

  async waitForReady(): Promise<void> {
    await this.modal.waitFor({ state: 'visible' });
  }
}
