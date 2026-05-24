import { ElectronApplication, Page, _electron as electron } from '@playwright/test';
import electronPath from 'electron';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

const ELECTRON_BIN: string = electronPath;

export interface AppHandle {
  app: ElectronApplication;
  page: Page;
  userDataDir: string;
}

export async function launchApp(): Promise<AppHandle> {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bitbutler-e2e-'));

  const app = await electron.launch({
    executablePath: ELECTRON_BIN,
    args: [`--user-data-dir=${userDataDir}`, '.'],
    chromiumSandbox: false,
    env: {
      ...process.env,
      PLAYWRIGHT_E2E: '1',
    },
    timeout: 30_000,
  });

  // Wait for the main window. Skip any devtools windows.
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');

  return { app, page, userDataDir };
}

export async function closeApp({ app, userDataDir }: AppHandle): Promise<void> {
  await app.close().catch(() => {});
  await fs.rm(userDataDir, { recursive: true, force: true });
}
