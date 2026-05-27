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
    await this.page.getByTestId('theme-family-select').click();
    await this.page.getByRole('option', { name: familyLabel, exact: true }).click();
  }
}
