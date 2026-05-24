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
    const input = this.page.locator('[data-testid="set-location-modal"] input').first();
    await input.fill(newPath);
  }
}
