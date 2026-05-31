import { ElectronApplication, Page, _electron as electron } from '@playwright/test';
import * as fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';

const ELECTRON_BIN: string = createRequire(import.meta.url)('electron') as string;

export interface AppHandle {
  app: ElectronApplication;
  page: Page;
  userDataDir: string;
}

// Linux CI has no keyring daemon; basic store makes safeStorage.isEncryptionAvailable() return true.
const EXTRA_ARGS = process.platform === 'linux' ? ['--password-store=basic'] : [];

export async function launchApp(): Promise<AppHandle> {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bitbutler-e2e-'));

  const app = await electron.launch({
    executablePath: ELECTRON_BIN,
    args: [`--user-data-dir=${userDataDir}`, '.', ...EXTRA_ARGS],
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

export async function launchAppWithDataDir(userDataDir: string): Promise<AppHandle> {
  const app = await electron.launch({
    executablePath: ELECTRON_BIN,
    args: [`--user-data-dir=${userDataDir}`, '.', ...EXTRA_ARGS],
    chromiumSandbox: false,
    env: {
      ...process.env,
      PLAYWRIGHT_E2E: '1',
    },
    timeout: 30_000,
  });

  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');

  return { app, page, userDataDir };
}

export async function closeApp({ app, userDataDir }: AppHandle): Promise<void> {
  await app.close().catch(() => {});
  await fs.rm(userDataDir, { recursive: true, force: true });
}
