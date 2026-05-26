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
    // Click the ng-select inside the modal body to open the dropdown
    await this.page.locator('.modal-body ng-select').first().click();
    // Wait for the option to appear (category list is fetched asynchronously)
    const option = this.page.locator('.ng-option').filter({ hasText: name });
    await option.waitFor({ state: 'visible' });
    await option.click();
  }
}
