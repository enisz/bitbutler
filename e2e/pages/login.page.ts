// e2e/pages/login.page.ts
import { Page } from '@playwright/test';

export class LoginPage {
  readonly brandTitle = this.page.getByTestId('brand-title');
  readonly versionBadge = this.page.getByTestId('version-badge');
  readonly connectButton = this.page.getByTestId('connect-button');
  readonly addServerButton = this.page.getByTestId('add-server-button');

  constructor(private readonly page: Page) {}

  async waitForReady(): Promise<void> {
    await this.brandTitle.waitFor({ state: 'visible' });
  }
}
