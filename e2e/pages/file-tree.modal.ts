import { Page } from '@playwright/test';

export class FileTreeModal {
  readonly modal = this.page.getByTestId('torrent-details-modal');
  readonly fileTree = this.page.getByTestId('file-tree');
  readonly editButton = this.page.getByTestId('file-tree-edit-button');
  readonly saveButton = this.page.getByTestId('file-tree-save-button');
  readonly cancelButton = this.page.getByTestId('file-tree-cancel-button');

  constructor(private readonly page: Page) {}

  async waitForReady(): Promise<void> {
    await this.modal.waitFor({ state: 'visible' });
    await this.fileTree.waitFor({ state: 'visible' });
  }

  async getFileNames(): Promise<string[]> {
    const rows = this.page.locator('.bb-row--file');
    const count = await rows.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = await rows.nth(i).textContent();
      if (text) names.push(text.trim());
    }
    return names;
  }

  fileRow(name: string) {
    return this.page.getByTestId(`file-row-${name}`);
  }

  async renameFile(currentName: string, newName: string): Promise<void> {
    // Enter edit mode if not already in it
    const editBtn = this.editButton;
    if (await editBtn.isVisible()) {
      await editBtn.click();
    }
    // Find the input associated with this file (data-testid-file attribute matches currentName)
    const input = this.page.locator(`[data-testid-file="${currentName}"]`);
    await input.fill(newName);
    await input.dispatchEvent('change');
    await this.saveButton.click();
  }
}
