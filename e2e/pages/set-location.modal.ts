import { Page } from '@playwright/test';

export class SetLocationModal {
  readonly modal = this.page.getByTestId('set-location-modal');
  readonly saveButton = this.page.getByTestId('set-location-save');
  readonly cancelButton = this.page.getByTestId('set-location-cancel');

  constructor(private readonly page: Page) {}

  async waitForReady(): Promise<void> {
    await this.modal.waitFor({ state: 'visible' });
  }

  async setPath(newPath: string): Promise<void> {
    const ngSelect = this.page.getByTestId('save-path-select-input');
    await ngSelect.click();
    const input = ngSelect.locator('input[type="text"]');
    await input.fill(newPath);
    await this.page.keyboard.press('Enter');
  }
}
