import { Page } from '@playwright/test';

export class ManageTagsModal {
  readonly modal = this.page.getByTestId('manage-tags-modal');
  readonly nameInput = this.page.getByTestId('tag-name-input');
  readonly addButton = this.page.getByTestId('add-tag-button');

  constructor(private readonly page: Page) {}

  async waitForReady(): Promise<void> {
    await this.modal.waitFor({ state: 'visible' });
  }

  async addTag(name: string): Promise<void> {
    await this.nameInput.fill(name);
    await this.addButton.click();
  }

  async isTagVisible(name: string): Promise<boolean> {
    const item = this.page.getByTestId(`tag-item-${name}`);
    return item.isVisible();
  }

  async deleteTag(name: string): Promise<void> {
    const item = this.page.getByTestId(`tag-item-${name}`);
    await item.locator('.btn-link.text-danger').click();
  }
}
