import { Page } from '@playwright/test';

export class ConfirmModal {
  readonly modal = this.page.getByTestId('confirm-modal');
  readonly okButton = this.page.getByTestId('confirm-ok-button');
  readonly cancelButton = this.page.getByTestId('confirm-cancel-button');

  constructor(private readonly page: Page) {}

  async waitForReady(): Promise<void> {
    await this.modal.waitFor({ state: 'visible' });
  }
}
