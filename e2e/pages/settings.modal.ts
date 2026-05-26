import { Page } from '@playwright/test';

export class SettingsModal {
  readonly modal = this.page.getByTestId('settings-modal');
  readonly saveButton = this.page.getByTestId('settings-save');
  readonly closeButton = this.page.getByTestId('settings-close');

  readonly tabGeneral = this.page.getByTestId('settings-tab-general');
  readonly tabServer = this.page.getByTestId('settings-tab-server');
  readonly tabTorrentListGrid = this.page.getByTestId('settings-tab-torrent-list-grid');
  readonly tabStatusBar = this.page.getByTestId('settings-tab-status-bar');

  constructor(private readonly page: Page) {}

  async waitForReady(): Promise<void> {
    await this.modal.waitFor({ state: 'visible' });
  }

  async selectThemeFamily(familyLabel: string): Promise<void> {
    // The family ng-select is inside the active general tab panel.
    // It is the third ng-select in the general tab (after toastPosition and language).
    const familySelect = this.page
      .locator('.bb-tab-panel--active ng-select')
      .filter({ hasText: familyLabel })
      .first();
    // If the dropdown is not yet open, click the container to open it.
    const container = this.page.locator('.bb-tab-panel--active ng-select').nth(2);
    await container.click();
    await this.page.getByRole('option', { name: familyLabel, exact: true }).click();
  }
}
