import { Page } from '@playwright/test';

export class ManageCategoriesModal {
  readonly modal = this.page.getByTestId('manage-categories-modal');
  readonly nameInput = this.page.getByTestId('category-name-input');
  readonly addButton = this.page.getByTestId('add-category-button');
  private readonly confirmOkButton = this.page.getByTestId('confirm-ok-button');

  constructor(private readonly page: Page) {}

  async waitForReady(): Promise<void> {
    await this.modal.waitFor({ state: 'visible' });
  }

  async addCategory(name: string): Promise<void> {
    await this.nameInput.fill(name);
    await this.addButton.click();
  }

  async isCategoryVisible(name: string): Promise<boolean> {
    const item = this.page.getByTestId(`category-item-${name}`);
    return item.isVisible();
  }

  async deleteCategory(name: string): Promise<void> {
    const item = this.page.getByTestId(`category-item-${name}`);
    await item.locator('.btn-link.text-danger').click();
    await this.confirmOkButton.waitFor({ state: 'visible' });
    await this.confirmOkButton.click();
  }
}
