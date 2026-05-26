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
    // Click the toggle button specifically - inputs inside the row call stopPropagation in edit mode
    const dirRow = this.page.locator('.bb-row--dir').first();
    await dirRow.waitFor({ state: 'visible' });
    await dirRow.locator('.bb-toggle').click();
    await this.page.locator('.bb-row--file').first().waitFor({ state: 'visible' });
  }

  async getFileNames(): Promise<string[]> {
    const rows = this.page.locator('.bb-row--file');
    const count = await rows.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      // data-testid is "file-row-<name>" - more reliable than textContent() which misses input values in edit mode
      const testid = await rows.nth(i).getAttribute('data-testid');
      if (testid?.startsWith('file-row-')) {
        names.push(testid.slice('file-row-'.length));
      }
    }
    return names;
  }

  fileRow(name: string) {
    return this.page.getByTestId(`file-row-${name}`);
  }

  async cancelEditMode(): Promise<void> {
    await this.cancelButton.click();
    await this.editButton.waitFor({ state: 'visible' });
  }

  async renameFile(currentName: string, newName: string): Promise<void> {
    const editBtn = this.editButton;
    if (await editBtn.isVisible()) {
      await editBtn.click();
    }
    const input = this.page.locator(`[data-testid-file="${currentName}"]`);
    await input.fill(newName);
    // press Enter via keyboard (not via locator) because fill() triggers ngModel which updates
    // data-testid-file to the new name, making the original locator stale for any follow-up action.
    // onRenameEnter calls onFileNameChange + saveEdit, so no separate saveButton click needed.
    await this.page.keyboard.press('Enter');
  }
}
