// e2e/pages/server-editor.modal.ts
import { Page } from '@playwright/test';

export class ServerEditorModal {
  readonly modalTitle = this.page.getByTestId('modal-title');
  readonly nameInput = this.page.getByTestId('name-input');
  readonly hostInput = this.page.getByTestId('host-input');
  readonly portInput = this.page.getByTestId('port-input');
  readonly saveButton = this.page.getByTestId('save-button');
  readonly closeButton = this.page.getByTestId('close-button');

  constructor(private readonly page: Page) {}

  async fill(
    name: string,
    host: string,
    port: number,
    username: string,
    password: string,
  ): Promise<void> {
    await this.nameInput.fill(name);
    await this.hostInput.fill(host);
    await this.portInput.fill(String(port));
    await this.page.getByTestId('username-input').fill(username);
    await this.page.getByTestId('password-input').fill(password);
  }

  async waitForReady(): Promise<void> {
    await this.modalTitle.waitFor({ state: 'visible' });
  }
}
