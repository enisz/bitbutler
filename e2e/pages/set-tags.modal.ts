import { Page } from '@playwright/test';

export class SetTagsModal {
  readonly modal = this.page.getByTestId('set-torrent-tags-modal');
  readonly saveButton = this.page.getByTestId('set-torrent-tags-save');
  readonly cancelButton = this.page.getByTestId('set-torrent-tags-cancel');

  constructor(private readonly page: Page) {}

  async waitForReady(): Promise<void> {
    await this.modal.waitFor({ state: 'visible' });
  }

  async selectTag(name: string): Promise<void> {
    await this.page.locator('.modal-body ng-select').first().click();
    const option = this.page.locator('.ng-option').filter({ hasText: name });
    await option.waitFor({ state: 'visible', timeout: 5_000 });
    await option.click();
  }
}
