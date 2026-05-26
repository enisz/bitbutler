// e2e/helpers/app.ts
import { Page } from '@playwright/test';
import { AppHandle, launchApp } from './electron';
import { QB_HOST, QB_PASS, QB_PORT, QB_USER } from './qbittorrent';

export interface MainPageHandle extends AppHandle {
  page: Page;
}

export async function launchAppOnMainPage(): Promise<MainPageHandle> {
  const handle = await launchApp();
  const { page } = handle;

  await page.evaluate(
    async ({ host, port, username, password }) => {
      await window.bitbutler.server.add({
        name: 'e2e-test',
        host,
        protocol: 'http',
        port,
        username,
        password,
      });
    },
    { host: QB_HOST, port: QB_PORT, username: QB_USER, password: QB_PASS },
  );

  await page.reload();
  await page.waitForSelector('[data-testid="brand-title"]', { timeout: 20_000 });

  await page.getByTestId('connect-button').click();
  await page.waitForURL('**/pages/main', { timeout: 20_000 });
  await page.waitForSelector('.ag-row', { timeout: 15_000 });

  return handle;
}
