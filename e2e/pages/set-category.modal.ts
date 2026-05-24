import { Page } from '@playwright/test';

export class SetCategoryModal {
  readonly modal = this.page.getByTestId('set-category-modal');
  readonly saveButton = this.page.getByTestId('set-category-save');
  readonly cancelButton = this.page.getByTestId('set-category-cancel');

  constructor(private readonly page: Page) {}

  async waitForReady(): Promise<void> {
    await this.modal.waitFor({ state: 'visible' });
  }

  async selectCategory(name: string): Promise<void> {
    await this.page.getByTestId('category-select').click();
    await this.page.getByText(name).click();
  }
}
