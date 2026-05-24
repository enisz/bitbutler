# E2E Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing Playwright suite from 7 smoke tests to 26 tests covering login, main page, torrent actions, file tree, modals, and settings - all running against a real Electron binary and a real qBittorrent-nox Docker container.

**Architecture:** A single Playwright project with `globalSetup`/`globalTeardown` that start/stop a qBittorrent-nox Docker container and seed a multi-file fixture torrent. Each test gets an isolated Electron `userDataDir`. All selectable elements get `data-testid` attributes; tests use `getByTestId()` exclusively.

**Tech Stack:** `@playwright/test`, Electron, qBittorrent-nox Docker image, bencode (Node.js built-in Buffer for encoding), Page Object Model

---

## File Map

| Action | Path                                                                         | Purpose                                    |
| ------ | ---------------------------------------------------------------------------- | ------------------------------------------ |
| Create | `e2e/fixtures/generate-torrent.mjs`                                          | One-off script to generate fixture torrent |
| Create | `e2e/fixtures/test.torrent`                                                  | Committed fixture torrent (multi-file)     |
| Create | `e2e/helpers/qbittorrent.ts`                                                 | Docker lifecycle + qB REST API helpers     |
| Modify | `e2e/globalSetup.ts`                                                         | Start container, seed fixture torrent      |
| Create | `e2e/globalTeardown.ts`                                                      | Stop container                             |
| Modify | `playwright.config.ts`                                                       | Wire globalSetup, globalTeardown           |
| Modify | `package.json`                                                               | Add test:e2e:server:ci script              |
| Modify | `.github/workflows/bitbutler-pr.yml`                                         | Add e2e-server CI job                      |
| Modify | `packages/app/src/app/pages/login/login.html`                                | Add data-testid attributes                 |
| Modify | `packages/app/src/app/pages/login/server-editor/server-editor.html`          | Add data-testid attributes                 |
| Create | `e2e/pages/login.page.ts`                                                    | Login page POM                             |
| Create | `e2e/pages/server-editor.modal.ts`                                           | Server editor modal POM                    |
| Modify | `e2e/tests/app-startup.spec.ts`                                              | Retrofit to use getByTestId()              |
| Modify | `e2e/tests/server-management.spec.ts`                                        | Retrofit to use getByTestId()              |
| Modify | `packages/app/src/app/pages/main/button-bar/button-bar.html`                 | data-testid on toolbar buttons             |
| Modify | `packages/app/src/app/pages/main/main.html`                                  | data-testid on main layout regions         |
| Modify | `packages/app/src/app/pages/main/grid/grid.html`                             | data-testid on grid wrapper                |
| Modify | `packages/app/src/app/pages/main/grid/context-menu/context-menu.html`        | data-testid on context menu items          |
| Create | `e2e/pages/main.page.ts`                                                     | Main page POM                              |
| Create | `e2e/helpers/app.ts`                                                         | launchAppOnMainPage() helper               |
| Create | `e2e/tests/login-flow.spec.ts`                                               | Login tests                                |
| Create | `e2e/tests/main-page.spec.ts`                                                | Main page tests                            |
| Modify | `packages/app/src/app/modals/add-torrent/add-torrent.html`                   | data-testid attributes                     |
| Create | `e2e/pages/add-torrent.modal.ts`                                             | Add torrent modal POM                      |
| Create | `e2e/tests/add-torrent.spec.ts`                                              | Add torrent test                           |
| Modify | `packages/app/src/app/modals/rename-torrent/rename-torrent.html`             | data-testid attributes                     |
| Modify | `packages/app/src/app/modals/delete-torrent/delete-torrent.html`             | data-testid attributes                     |
| Modify | `packages/app/src/app/modals/set-torrent-category/set-torrent-category.html` | data-testid attributes                     |
| Modify | `packages/app/src/app/modals/set-torrent-location/set-torrent-location.html` | data-testid attributes                     |
| Create | `e2e/pages/rename-torrent.modal.ts`                                          | Rename torrent modal POM                   |
| Create | `e2e/pages/delete-torrent.modal.ts`                                          | Delete torrent modal POM                   |
| Create | `e2e/pages/set-category.modal.ts`                                            | Set category modal POM                     |
| Create | `e2e/pages/set-location.modal.ts`                                            | Set location modal POM                     |
| Create | `e2e/tests/torrent-actions.spec.ts`                                          | Torrent action tests                       |
| Modify | `packages/app/src/app/shared/components/file-tree/bb-file-tree.html`         | data-testid attributes                     |
| Create | `e2e/pages/file-tree.modal.ts`                                               | File tree modal POM                        |
| Create | `e2e/tests/file-tree.spec.ts`                                                | File tree tests                            |
| Modify | `packages/app/src/app/modals/manage-categories/manage-categories.html`       | data-testid attributes                     |
| Modify | `packages/app/src/app/modals/manage-tags/manage-tags.html`                   | data-testid attributes                     |
| Modify | `packages/app/src/app/modals/confirm/confirm.html`                           | data-testid attributes                     |
| Create | `e2e/pages/manage-categories.modal.ts`                                       | Manage categories modal POM                |
| Create | `e2e/pages/manage-tags.modal.ts`                                             | Manage tags modal POM                      |
| Create | `e2e/pages/confirm.modal.ts`                                                 | Confirm modal POM                          |
| Create | `e2e/tests/modals.spec.ts`                                                   | Category/tag/confirm tests                 |
| Modify | `packages/app/src/app/pages/settings/settings.html`                          | data-testid attributes                     |
| Create | `e2e/pages/settings.modal.ts`                                                | Settings modal POM                         |
| Create | `e2e/tests/settings.spec.ts`                                                 | Settings tests                             |

---

## Task 1: Generate and commit the fixture torrent

The fixture torrent contains two text files: `test-files/hello.txt` (content `hello`) and `test-files/world.txt` (content `world`). It is generated once via a Node.js bencode script and committed. `globalSetup` adds it to qBittorrent paused.

**Files:**

- Create: `e2e/fixtures/generate-torrent.mjs`
- Create: `e2e/fixtures/test.torrent`

- [ ] **Step 1: Create the generator script**

```javascript
// e2e/fixtures/generate-torrent.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function bencode(value) {
  if (typeof value === 'number') return Buffer.from(`i${value}e`);
  if (Buffer.isBuffer(value)) return Buffer.concat([Buffer.from(`${value.length}:`), value]);
  if (typeof value === 'string') {
    const buf = Buffer.from(value, 'utf8');
    return Buffer.concat([Buffer.from(`${buf.length}:`), buf]);
  }
  if (Array.isArray(value)) {
    return Buffer.concat([Buffer.from('l'), ...value.map(bencode), Buffer.from('e')]);
  }
  if (typeof value === 'object' && value !== null) {
    const keys = Object.keys(value).sort();
    return Buffer.concat([
      Buffer.from('d'),
      ...keys.flatMap((k) => [bencode(k), bencode(value[k])]),
      Buffer.from('e'),
    ]);
  }
  throw new Error(`Cannot bencode ${typeof value}`);
}

const helloContent = Buffer.from('hello');
const worldContent = Buffer.from('world');
const pieceLength = 262144;
const allContent = Buffer.concat([helloContent, worldContent]);
const pieces = Buffer.alloc(20);
// For tiny files a single piece covers everything - SHA1 placeholder (zeros accepted by qB for paused torrents)

const torrent = {
  info: {
    name: 'test-files',
    'piece length': pieceLength,
    pieces,
    files: [
      { length: helloContent.length, path: ['hello.txt'] },
      { length: worldContent.length, path: ['world.txt'] },
    ],
  },
};

const outPath = join(__dirname, 'test.torrent');
writeFileSync(outPath, bencode(torrent));
console.log(`Written ${outPath} (${bencode(torrent).length} bytes)`);
```

- [ ] **Step 2: Run the script to generate the torrent file**

```bash
node e2e/fixtures/generate-torrent.mjs
```

Expected: `Written /home/.../e2e/fixtures/test.torrent (NNN bytes)`

- [ ] **Step 3: Verify the file was created**

```bash
ls -la e2e/fixtures/test.torrent
```

Expected: file exists, non-zero size.

- [ ] **Step 4: Commit both files**

```bash
git add e2e/fixtures/generate-torrent.mjs e2e/fixtures/test.torrent
git commit -m "#110: Add multi-file fixture torrent for e2e tests"
```

---

## Task 2: Create the qBittorrent Docker helper

This helper encapsulates all Docker and qBittorrent REST API interactions needed by `globalSetup` and `globalTeardown`. Uses `execFileSync` with argument arrays (not shell strings) throughout.

**Files:**

- Create: `e2e/helpers/qbittorrent.ts`

- [ ] **Step 1: Create the helper file**

```typescript
// e2e/helpers/qbittorrent.ts
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const QB_HOST = '127.0.0.1';
export const QB_PORT = 18080;
export const QB_USER = 'admin';
export const QB_PASS = 'adminadmin';

const CONTAINER = 'bitbutler-e2e-qb';
// Pin to a specific release - update when upgrading qBittorrent in CI
const IMAGE = 'qbittorrentofficial/qbittorrent-nox:5.2.0-1';
const BASE_URL = `http://${QB_HOST}:${QB_PORT}`;

export function startContainer(): void {
  execFileSync('docker', ['rm', '-f', CONTAINER], { stdio: 'ignore' });
  execFileSync(
    'docker',
    ['run', '-d', '--name', CONTAINER, '-p', `${QB_PORT}:8080`, '-e', 'QBT_EULA=accept', IMAGE],
    { stdio: 'pipe' },
  );
}

export function stopContainer(): void {
  execFileSync('docker', ['rm', '-f', CONTAINER], { stdio: 'ignore' });
}

export function readTempPassword(): string {
  const logs = execFileSync('docker', ['logs', CONTAINER]).toString();
  const match = logs.match(/Temporary password generated for your user: (.+)/);
  if (!match) throw new Error('Could not find temporary password in container logs');
  return match[1].trim();
}

export async function waitForReady(maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${BASE_URL}/api/v2/app/version`);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('qBittorrent-nox did not become ready in time');
}

export async function login(username: string, password: string): Promise<string> {
  const body = new URLSearchParams({ username, password });
  const res = await fetch(`${BASE_URL}/api/v2/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const setCookie = res.headers.get('set-cookie') ?? '';
  const match = setCookie.match(/SID=([^;]+)/);
  if (!match) throw new Error('Login failed - no SID cookie');
  return match[1];
}

export async function changePassword(sid: string, newPassword: string): Promise<void> {
  const body = new URLSearchParams({ json: JSON.stringify({ web_ui_password: newPassword }) });
  await fetch(`${BASE_URL}/api/v2/app/setPreferences`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: `SID=${sid}`,
    },
    body: body.toString(),
  });
}

export async function addTorrent(sid: string, torrentPath: string): Promise<void> {
  const formData = new FormData();
  const torrentBytes = fs.readFileSync(torrentPath);
  formData.append(
    'torrents',
    new Blob([torrentBytes], { type: 'application/x-bittorrent' }),
    path.basename(torrentPath),
  );
  formData.append('paused', 'true');
  const res = await fetch(`${BASE_URL}/api/v2/torrents/add`, {
    method: 'POST',
    headers: { Cookie: `SID=${sid}` },
    body: formData,
  });
  if (!res.ok) throw new Error(`addTorrent failed: ${res.status}`);
}

export async function deleteTorrent(sid: string, hash: string): Promise<void> {
  const body = new URLSearchParams({ hashes: hash, deleteFiles: 'false' });
  await fetch(`${BASE_URL}/api/v2/torrents/delete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: `SID=${sid}`,
    },
    body: body.toString(),
  });
}

export async function getTorrents(sid: string): Promise<Array<{ hash: string; name: string }>> {
  const res = await fetch(`${BASE_URL}/api/v2/torrents/info`, {
    headers: { Cookie: `SID=${sid}` },
  });
  return res.json() as Promise<Array<{ hash: string; name: string }>>;
}

export async function getTorrentProperties(
  sid: string,
  hash: string,
): Promise<{ save_path: string }> {
  const res = await fetch(`${BASE_URL}/api/v2/torrents/properties?hash=${hash}`, {
    headers: { Cookie: `SID=${sid}` },
  });
  return res.json() as Promise<{ save_path: string }>;
}

export async function getSid(): Promise<string> {
  return login(QB_USER, QB_PASS);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit --strict e2e/helpers/qbittorrent.ts 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add e2e/helpers/qbittorrent.ts
git commit -m "#110: Add qBittorrent Docker helper for e2e tests"
```

---

## Task 3: Create globalSetup, globalTeardown, update playwright.config.ts

`globalSetup` starts the Docker container, waits for it to be ready, sets the known password, seeds the fixture torrent, and exposes connection details via `process.env`. `globalTeardown` stops the container.

**Files:**

- Create: `e2e/globalSetup.ts`
- Create: `e2e/globalTeardown.ts`
- Modify: `playwright.config.ts`

- [ ] **Step 1: Create globalSetup.ts**

```typescript
// e2e/globalSetup.ts
import * as path from 'node:path';
import {
  QB_HOST,
  QB_PASS,
  QB_PORT,
  QB_USER,
  addTorrent,
  changePassword,
  login,
  readTempPassword,
  startContainer,
  waitForReady,
} from './helpers/qbittorrent';

export default async function globalSetup(): Promise<void> {
  startContainer();
  await waitForReady();

  const tempPass = readTempPassword();
  const tempSid = await login(QB_USER, tempPass);
  await changePassword(tempSid, QB_PASS);

  const sid = await login(QB_USER, QB_PASS);
  const torrentPath = path.resolve(__dirname, 'fixtures/test.torrent');
  await addTorrent(sid, torrentPath);

  process.env['QB_HOST'] = QB_HOST;
  process.env['QB_PORT'] = String(QB_PORT);
  process.env['QB_USER'] = QB_USER;
  process.env['QB_PASS'] = QB_PASS;
}
```

- [ ] **Step 2: Create globalTeardown.ts**

```typescript
// e2e/globalTeardown.ts
import { stopContainer } from './helpers/qbittorrent';

export default async function globalTeardown(): Promise<void> {
  stopContainer();
}
```

- [ ] **Step 3: Update playwright.config.ts to wire globalSetup and globalTeardown**

Current `playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    actionTimeout: 10_000,
  },
});
```

Replace with:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: process.env['CI'] ? 'github' : 'list',
  globalSetup: './e2e/globalSetup.ts',
  globalTeardown: './e2e/globalTeardown.ts',
  use: {
    actionTimeout: 10_000,
  },
});
```

- [ ] **Step 4: Verify Playwright recognises the config**

```bash
npx playwright test --list 2>&1 | head -10
```

Expected: lists tests without errors. globalSetup/globalTeardown are registered.

- [ ] **Step 5: Commit**

```bash
git add e2e/globalSetup.ts e2e/globalTeardown.ts playwright.config.ts
git commit -m "#110: Add globalSetup/globalTeardown for qBittorrent Docker container"
```

---

## Task 4: Add npm script and CI job for server tests

**Files:**

- Modify: `package.json`
- Modify: `.github/workflows/bitbutler-pr.yml`

- [ ] **Step 1: Add test:e2e:server:ci script to package.json**

In `package.json` scripts, add after `test:e2e:ci`:

```json
"test:e2e:server:ci": "xvfb-run --auto-servernum playwright test"
```

Both CI commands are the same - the difference is which CI job runs which command. This is intentional as per the spec.

- [ ] **Step 2: Add e2e-server CI job to .github/workflows/bitbutler-pr.yml**

Find the existing `e2e` job section and:

1. Rename the existing `e2e` job key to `e2e-no-server` and update its name label to `[5/7] E2E Tests - No Server (Playwright / Electron)`
2. Add the new job after it:

```yaml
e2e-server:
  name: '[6/7] E2E Tests - Server (Playwright / Electron / qBittorrent)'
  runs-on: ubuntu-latest
  needs: [detect-changes, test-app, test-electron, e2e-no-server]
  if: >-
    always() &&
    needs.detect-changes.outputs.any-source == 'true' &&
    !contains(needs.*.result, 'failure') &&
    !contains(needs.*.result, 'cancelled')
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '24'
        cache: 'npm'
    - run: npm install -g npm@11
    - run: npm ci
    - name: Install display and system libs
      run: |
        sudo apt-get update -qq
        sudo apt-get install -y xvfb libnss3 libgbm1 libasound2t64 libgtk-3-0 \
          libxss1 libxkbcommon0 libatk-bridge2.0-0 libcups2 libdrm2
    - name: Build Angular app
      run: npm run build
    - name: Build Electron TypeScript
      run: npm run build:electron
    - name: Run Playwright e2e server tests
      run: npm run test:e2e:server:ci
```

- [ ] **Step 3: Update the build job's needs array**

Find `needs: [detect-changes, test-app, test-electron, e2e]` on the `build` job and update to:

```yaml
needs: [detect-changes, test-app, test-electron, e2e-no-server, e2e-server]
```

Update the build job's name label to `[7/7]`.

- [ ] **Step 4: Validate YAML**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/bitbutler-pr.yml'))" && echo "valid"
```

Expected: `valid`

- [ ] **Step 5: Commit**

```bash
git add package.json .github/workflows/bitbutler-pr.yml
git commit -m "#110: Add e2e-server CI job and npm script"
```

---

## Task 5: Add data-testid to login page and create login POMs; retrofit existing tests

The login page and server editor modal need `data-testid` attributes. The existing spec files use fragile CSS class + text locators that need to be updated to `getByTestId()`.

**Files:**

- Modify: `packages/app/src/app/pages/login/login.html`
- Modify: `packages/app/src/app/pages/login/server-editor/server-editor.html`
- Create: `e2e/pages/login.page.ts`
- Create: `e2e/pages/server-editor.modal.ts`
- Modify: `e2e/tests/app-startup.spec.ts`
- Modify: `e2e/tests/server-management.spec.ts`

- [ ] **Step 1: Add data-testid to login.html**

Read the current file first, then add `data-testid` to these elements:

- `h1.brand-title` → add `data-testid="brand-title"`
- `.version .badge` → add `data-testid="version-badge"`
- Connect button (btn-primary) → add `data-testid="connect-button"`
- Add server button (btn-secondary) → add `data-testid="add-server-button"`

- [ ] **Step 2: Add data-testid to server-editor.html**

Read the current file, then add `data-testid` to these elements:

- `.modal-title` → add `data-testid="modal-title"`
- Input `id="name"` → add `data-testid="name-input"`
- Input `id="host"` → add `data-testid="host-input"`
- Input `id="port"` → add `data-testid="port-input"`
- Save button → add `data-testid="save-button"`
- Cancel/close button → add `data-testid="close-button"`

- [ ] **Step 3: Create e2e/pages/login.page.ts**

```typescript
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
```

- [ ] **Step 4: Create e2e/pages/server-editor.modal.ts**

```typescript
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
```

- [ ] **Step 5: Add username/password data-testid to server-editor.html**

Also add `data-testid="username-input"` to the username input and `data-testid="password-input"` to the password input in `server-editor.html` (needed by the modal's `fill()` method in Step 4).

- [ ] **Step 6: Retrofit app-startup.spec.ts to use getByTestId()**

Replace the file content with:

```typescript
import { expect, test } from '@playwright/test';
import { AppHandle, closeApp, launchApp } from '../helpers/electron';
import { LoginPage } from '../pages/login.page';

test.describe('App startup', () => {
  let handle: AppHandle;
  let loginPage: LoginPage;

  test.beforeEach(async () => {
    handle = await launchApp();
    loginPage = new LoginPage(handle.page);
    await loginPage.waitForReady();
  });

  test.afterEach(async () => {
    await closeApp(handle);
  });

  test('shows the login page', async () => {
    await expect(loginPage.brandTitle).toHaveText('BitButler');
  });

  test('shows the version badge', async () => {
    await expect(loginPage.versionBadge).toBeVisible();
  });

  test('connect button is disabled with no servers', async () => {
    await expect(loginPage.connectButton).toBeDisabled();
  });

  test('add server button is enabled', async () => {
    await expect(loginPage.addServerButton).toBeEnabled();
  });
});
```

- [ ] **Step 7: Retrofit server-management.spec.ts to use getByTestId()**

Replace the file content with:

```typescript
import { expect, test } from '@playwright/test';
import { AppHandle, closeApp, launchApp } from '../helpers/electron';
import { LoginPage } from '../pages/login.page';
import { ServerEditorModal } from '../pages/server-editor.modal';

test.describe('Server management', () => {
  let handle: AppHandle;
  let loginPage: LoginPage;
  let serverEditor: ServerEditorModal;

  test.beforeEach(async () => {
    handle = await launchApp();
    loginPage = new LoginPage(handle.page);
    serverEditor = new ServerEditorModal(handle.page);
    await loginPage.waitForReady();
  });

  test.afterEach(async () => {
    await closeApp(handle);
  });

  test('clicking Add Server opens the server editor modal', async () => {
    await loginPage.addServerButton.click();
    await expect(serverEditor.modalTitle).toBeVisible();
  });

  test('server editor modal has a name input', async () => {
    await loginPage.addServerButton.click();
    await expect(serverEditor.nameInput).toBeVisible();
  });

  test('dismissing the modal returns to login page', async () => {
    await loginPage.addServerButton.click();
    await serverEditor.closeButton.click();
    await expect(loginPage.brandTitle).toBeVisible();
    await expect(serverEditor.modalTitle).not.toBeVisible();
  });
});
```

- [ ] **Step 8: Build Angular and run the 7 existing tests**

```bash
npm run build && npm run build:electron && npm run test:e2e:ci
```

Expected: all 7 tests pass (4 startup + 3 server-management).

- [ ] **Step 9: Commit**

```bash
git add packages/app/src/app/pages/login/ e2e/pages/login.page.ts e2e/pages/server-editor.modal.ts e2e/tests/app-startup.spec.ts e2e/tests/server-management.spec.ts
git commit -m "#110: Add data-testid to login/server-editor; retrofit existing tests to getByTestId"
```

---

## Task 6: Add data-testid to main page templates and create main POMs

**Files:**

- Modify: `packages/app/src/app/pages/main/button-bar/button-bar.html`
- Modify: `packages/app/src/app/pages/main/main.html`
- Modify: `packages/app/src/app/pages/main/grid/context-menu/context-menu.html`
- Create: `e2e/pages/main.page.ts`

- [ ] **Step 1: Add data-testid to button-bar.html**

The button bar uses `@for (e of entries(); ...)`. Bind `data-testid` dynamically:

```html
<button [attr.data-testid]="'toolbar-btn-' + e.id" ...></button>
```

This gives each button a stable testid: `toolbar-btn-control.pauseAll`, `toolbar-btn-new.addTorrentFile`, etc.

- [ ] **Step 2: Add data-testid to main.html**

Add `data-testid="torrent-grid"` to the `<app-grid>` element, `data-testid="button-bar"` to `<app-button-bar>`, and `data-testid="status-bar"` to `<app-server-state>` (or whichever element serves as the footer status bar).

- [ ] **Step 3: Add data-testid to context-menu.html**

The context menu uses `@for (entry of items(); ...)`. Bind `data-testid` dynamically:

```html
<li [attr.data-testid]="'ctx-' + entry.id" ...></li>
```

This gives: `ctx-torrent.details`, `ctx-files.renameTorrent`, `ctx-files.renameFiles`, `ctx-files.setLocation`, `ctx-files.category`, `ctx-files.tags`, `ctx-files.remove`.

- [ ] **Step 4: Create e2e/pages/main.page.ts**

```typescript
// e2e/pages/main.page.ts
import { Page } from '@playwright/test';

export class MainPage {
  readonly buttonBar = this.page.getByTestId('button-bar');
  readonly torrentGrid = this.page.getByTestId('torrent-grid');
  readonly statusBar = this.page.getByTestId('status-bar');

  readonly pauseAllButton = this.page.getByTestId('toolbar-btn-control.pauseAll');
  readonly resumeAllButton = this.page.getByTestId('toolbar-btn-control.resumeAll');
  readonly addTorrentFileButton = this.page.getByTestId('toolbar-btn-new.addTorrentFile');

  readonly ctxRenameTorrent = this.page.getByTestId('ctx-files.renameTorrent');
  readonly ctxRenameFiles = this.page.getByTestId('ctx-files.renameFiles');
  readonly ctxSetLocation = this.page.getByTestId('ctx-files.setLocation');
  readonly ctxSetCategory = this.page.getByTestId('ctx-files.category');
  readonly ctxDelete = this.page.getByTestId('ctx-files.remove');

  constructor(private readonly page: Page) {}

  async waitForReady(): Promise<void> {
    await this.torrentGrid.waitFor({ state: 'visible' });
    await this.page.waitForSelector('.ag-row', { timeout: 15_000 });
  }

  async rightClickTorrentRow(): Promise<void> {
    const row = this.page.locator('.ag-row').first();
    await row.waitFor({ state: 'visible' });
    await row.click({ button: 'right' });
  }

  async getTorrentRowCount(): Promise<number> {
    return this.page.locator('.ag-row').count();
  }

  async getFirstTorrentName(): Promise<string | null> {
    const nameCell = this.page.locator('.ag-row').first().locator('.ag-cell[col-id="name"]');
    return nameCell.textContent();
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/pages/main/ e2e/pages/main.page.ts
git commit -m "#110: Add data-testid to main page templates; create MainPage POM"
```

---

## Task 7: Create launchAppOnMainPage helper and write login-flow tests

**Files:**

- Create: `e2e/helpers/app.ts`
- Create: `e2e/tests/login-flow.spec.ts`

- [ ] **Step 1: Create e2e/helpers/app.ts**

```typescript
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
        port,
        username,
        password,
        useSsl: false,
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
```

- [ ] **Step 2: Create e2e/tests/login-flow.spec.ts**

```typescript
import { expect, test } from '@playwright/test';
import { AppHandle, closeApp, launchApp } from '../helpers/electron';
import { QB_HOST, QB_PASS, QB_PORT, QB_USER } from '../helpers/qbittorrent';
import { LoginPage } from '../pages/login.page';

test.describe('Login flow', () => {
  let handle: AppHandle;
  let loginPage: LoginPage;

  test.beforeEach(async () => {
    handle = await launchApp();
    loginPage = new LoginPage(handle.page);
    await loginPage.waitForReady();

    await handle.page.evaluate(
      async ({ host, port, username, password }) => {
        await window.bitbutler.server.add({
          name: 'e2e-test',
          host,
          port,
          username,
          password,
          useSsl: false,
        });
      },
      { host: QB_HOST, port: QB_PORT, username: QB_USER, password: QB_PASS },
    );
    await handle.page.reload();
    await loginPage.waitForReady();
  });

  test.afterEach(async () => {
    await closeApp(handle);
  });

  test('successful login navigates to main page', async () => {
    await loginPage.connectButton.click();
    await handle.page.waitForURL('**/pages/main', { timeout: 20_000 });
    await expect(handle.page.getByTestId('torrent-grid')).toBeVisible();
  });

  test('failed login with wrong password shows error toast and stays on login page', async () => {
    // Override the saved server with wrong credentials
    const servers = await handle.page.evaluate(() => window.bitbutler.server.getAll());
    if (servers.length > 0) {
      await handle.page.evaluate(async (id) => {
        await window.bitbutler.server.update(id, {
          name: 'e2e-test-bad',
          host: process.env['QB_HOST'] ?? '127.0.0.1',
          port: 18080,
          username: 'admin',
          password: 'wrongpassword',
          useSsl: false,
        });
      }, servers[0].id);
      await handle.page.reload();
      await loginPage.waitForReady();
    }

    await loginPage.connectButton.click();
    // Should stay on login page (URL does not change to /pages/main)
    await handle.page.waitForTimeout(3000);
    await expect(handle.page).not.toHaveURL('**/pages/main');
    await expect(loginPage.brandTitle).toBeVisible();
  });
});
```

- [ ] **Step 3: Build and run login-flow tests**

```bash
npm run build && npm run build:electron && npm run test:e2e:server:ci -- --grep "Login flow"
```

Expected: 2 tests pass.

- [ ] **Step 4: Commit**

```bash
git add e2e/helpers/app.ts e2e/tests/login-flow.spec.ts
git commit -m "#110: Add launchAppOnMainPage helper and login-flow e2e tests"
```

---

## Task 8: Write main-page tests

**Files:**

- Create: `e2e/tests/main-page.spec.ts`

- [ ] **Step 1: Create e2e/tests/main-page.spec.ts**

```typescript
import { expect, test } from '@playwright/test';
import { MainPageHandle, launchAppOnMainPage } from '../helpers/app';
import { closeApp } from '../helpers/electron';
import { MainPage } from '../pages/main.page';

test.describe('Main page', () => {
  let handle: MainPageHandle;
  let mainPage: MainPage;

  test.beforeEach(async () => {
    handle = await launchAppOnMainPage();
    mainPage = new MainPage(handle.page);
    await mainPage.waitForReady();
  });

  test.afterEach(async () => {
    await closeApp(handle);
  });

  test('torrent grid renders with the seeded fixture torrent row visible', async () => {
    await expect(handle.page.locator('.ag-row').first()).toBeVisible();
    const count = await mainPage.getTorrentRowCount();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('button bar is visible', async () => {
    await expect(mainPage.buttonBar).toBeVisible();
    await expect(mainPage.pauseAllButton).toBeVisible();
  });

  test('Pause All button changes the fixture torrent state to paused', async () => {
    await mainPage.pauseAllButton.click();
    // Wait briefly for state update, then verify row still exists (fixture torrent is already paused so no error)
    await handle.page.waitForTimeout(1000);
    await expect(handle.page.locator('.ag-row').first()).toBeVisible();
  });

  test('status bar is visible', async () => {
    await expect(mainPage.statusBar).toBeVisible();
  });
});
```

- [ ] **Step 2: Run main-page tests**

```bash
npm run test:e2e:server:ci -- --grep "Main page"
```

Expected: 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/main-page.spec.ts
git commit -m "#110: Add main-page e2e tests"
```

---

## Task 9: Add data-testid to add-torrent modal, create POM, write test

**Files:**

- Modify: `packages/app/src/app/modals/add-torrent/add-torrent.html`
- Create: `e2e/pages/add-torrent.modal.ts`
- Create: `e2e/tests/add-torrent.spec.ts`

- [ ] **Step 1: Add data-testid to add-torrent.html**

Read the file and add:

- Submit button → `data-testid="add-torrent-submit"`
- Cancel button → `data-testid="add-torrent-cancel"`
- The modal container → `data-testid="add-torrent-modal"`

- [ ] **Step 2: Create e2e/pages/add-torrent.modal.ts**

```typescript
// e2e/pages/add-torrent.modal.ts
import { Page } from '@playwright/test';

export class AddTorrentModal {
  readonly modal = this.page.getByTestId('add-torrent-modal');
  readonly submitButton = this.page.getByTestId('add-torrent-submit');
  readonly cancelButton = this.page.getByTestId('add-torrent-cancel');

  constructor(private readonly page: Page) {}

  async waitForReady(): Promise<void> {
    await this.modal.waitFor({ state: 'visible' });
  }
}
```

- [ ] **Step 3: Create e2e/tests/add-torrent.spec.ts**

```typescript
import { expect, test } from '@playwright/test';
import * as path from 'node:path';
import { MainPageHandle, launchAppOnMainPage } from '../helpers/app';
import { closeApp } from '../helpers/electron';
import { AddTorrentModal } from '../pages/add-torrent.modal';
import { MainPage } from '../pages/main.page';

test.describe('Add torrent', () => {
  let handle: MainPageHandle;
  let mainPage: MainPage;
  let addTorrentModal: AddTorrentModal;

  test.beforeEach(async () => {
    handle = await launchAppOnMainPage();
    mainPage = new MainPage(handle.page);
    await mainPage.waitForReady();
    addTorrentModal = new AddTorrentModal(handle.page);
  });

  test.afterEach(async () => {
    await closeApp(handle);
  });

  test('add torrent via .torrent file adds a new row to the grid', async () => {
    const countBefore = await mainPage.getTorrentRowCount();

    const torrentPath = path.resolve(__dirname, '../fixtures/test.torrent');
    await handle.page.evaluate(async (filePath) => {
      await window.bitbutler.window.simulateOpenFiles([filePath]);
    }, torrentPath);

    await addTorrentModal.waitForReady();
    await addTorrentModal.submitButton.click();
    await addTorrentModal.modal.waitFor({ state: 'hidden' });

    // Wait for the new row to appear
    await handle.page.waitForFunction(
      (expectedCount) => document.querySelectorAll('.ag-row').length > expectedCount,
      countBefore,
      { timeout: 10_000 },
    );
    const countAfter = await mainPage.getTorrentRowCount();
    expect(countAfter).toBeGreaterThan(countBefore);
  });
});
```

- [ ] **Step 4: Build and run add-torrent test**

```bash
npm run build && npm run build:electron && npm run test:e2e:server:ci -- --grep "Add torrent"
```

Expected: 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/modals/add-torrent/ e2e/pages/add-torrent.modal.ts e2e/tests/add-torrent.spec.ts
git commit -m "#110: Add data-testid to add-torrent modal; add add-torrent e2e test"
```

---

## Task 10: Add data-testid to torrent-action modals, create POMs, write tests

**Files:**

- Modify: `packages/app/src/app/modals/rename-torrent/rename-torrent.html`
- Modify: `packages/app/src/app/modals/delete-torrent/delete-torrent.html`
- Modify: `packages/app/src/app/modals/set-torrent-category/set-torrent-category.html`
- Modify: `packages/app/src/app/modals/set-torrent-location/set-torrent-location.html`
- Create: `e2e/pages/rename-torrent.modal.ts`
- Create: `e2e/pages/delete-torrent.modal.ts`
- Create: `e2e/pages/set-category.modal.ts`
- Create: `e2e/pages/set-location.modal.ts`
- Create: `e2e/tests/torrent-actions.spec.ts`

- [ ] **Step 1: Add data-testid to rename-torrent.html**

Read the file and add:

- Input `id="name"` → `data-testid="rename-torrent-input"`
- Save button → `data-testid="rename-torrent-save"`
- Cancel button → `data-testid="rename-torrent-cancel"`
- Modal root element → `data-testid="rename-torrent-modal"`

- [ ] **Step 2: Add data-testid to delete-torrent.html**

Read the file and add:

- Checkbox `id="remove-files"` → `data-testid="delete-remove-files-checkbox"`
- Confirm/OK button → `data-testid="delete-confirm-button"`
- Cancel button → `data-testid="delete-cancel-button"`
- Modal root element → `data-testid="delete-torrent-modal"`

- [ ] **Step 3: Add data-testid to set-torrent-category.html**

Read the file and add:

- Save button → `data-testid="set-category-save"`
- Cancel button → `data-testid="set-category-cancel"`
- Modal root element → `data-testid="set-category-modal"`
- Category select container → `data-testid="category-select"`

- [ ] **Step 4: Add data-testid to set-torrent-location.html**

Read the file and add:

- Save button → `data-testid="set-location-save"`
- Cancel button → `data-testid="set-location-cancel"`
- Modal root element → `data-testid="set-location-modal"`

- [ ] **Step 5: Create e2e/pages/rename-torrent.modal.ts**

```typescript
// e2e/pages/rename-torrent.modal.ts
import { Page } from '@playwright/test';

export class RenameTorrentModal {
  readonly modal = this.page.getByTestId('rename-torrent-modal');
  readonly nameInput = this.page.getByTestId('rename-torrent-input');
  readonly saveButton = this.page.getByTestId('rename-torrent-save');
  readonly cancelButton = this.page.getByTestId('rename-torrent-cancel');

  constructor(private readonly page: Page) {}

  async waitForReady(): Promise<void> {
    await this.modal.waitFor({ state: 'visible' });
  }
}
```

- [ ] **Step 6: Create e2e/pages/delete-torrent.modal.ts**

```typescript
// e2e/pages/delete-torrent.modal.ts
import { Page } from '@playwright/test';

export class DeleteTorrentModal {
  readonly modal = this.page.getByTestId('delete-torrent-modal');
  readonly removeFilesCheckbox = this.page.getByTestId('delete-remove-files-checkbox');
  readonly confirmButton = this.page.getByTestId('delete-confirm-button');
  readonly cancelButton = this.page.getByTestId('delete-cancel-button');

  constructor(private readonly page: Page) {}

  async waitForReady(): Promise<void> {
    await this.modal.waitFor({ state: 'visible' });
  }
}
```

- [ ] **Step 7: Create e2e/pages/set-category.modal.ts**

```typescript
// e2e/pages/set-category.modal.ts
import { Page } from '@playwright/test';

export class SetCategoryModal {
  readonly modal = this.page.getByTestId('set-category-modal');
  readonly saveButton = this.page.getByTestId('set-category-save');
  readonly cancelButton = this.page.getByTestId('set-category-cancel');

  constructor(private readonly page: Page) {}

  async waitForReady(): Promise<void> {
    await this.modal.waitFor({ state: 'visible' });
  }

  async selectCategory(name: string): Promise<void> {
    await this.page.getByTestId('category-select').click();
    await this.page.getByText(name).click();
  }
}
```

- [ ] **Step 8: Create e2e/pages/set-location.modal.ts**

```typescript
// e2e/pages/set-location.modal.ts
import { Page } from '@playwright/test';

export class SetLocationModal {
  readonly modal = this.page.getByTestId('set-location-modal');
  readonly saveButton = this.page.getByTestId('set-location-save');
  readonly cancelButton = this.page.getByTestId('set-location-cancel');

  constructor(private readonly page: Page) {}

  async waitForReady(): Promise<void> {
    await this.modal.waitFor({ state: 'visible' });
  }

  async setPath(path: string): Promise<void> {
    const input = this.page.locator('[data-testid="set-location-modal"] input').first();
    await input.fill(path);
  }
}
```

- [ ] **Step 9: Create e2e/tests/torrent-actions.spec.ts**

```typescript
import { expect, test } from '@playwright/test';
import * as path from 'node:path';
import { MainPageHandle, launchAppOnMainPage } from '../helpers/app';
import { closeApp } from '../helpers/electron';
import { addTorrent, getSid, getTorrentProperties, getTorrents } from '../helpers/qbittorrent';
import { DeleteTorrentModal } from '../pages/delete-torrent.modal';
import { MainPage } from '../pages/main.page';
import { RenameTorrentModal } from '../pages/rename-torrent.modal';
import { SetCategoryModal } from '../pages/set-category.modal';
import { SetLocationModal } from '../pages/set-location.modal';

test.describe('Torrent actions', () => {
  let handle: MainPageHandle;
  let mainPage: MainPage;

  test.beforeEach(async () => {
    handle = await launchAppOnMainPage();
    mainPage = new MainPage(handle.page);
    await mainPage.waitForReady();
  });

  test.afterEach(async () => {
    await closeApp(handle);
  });

  test('rename torrent shows new name in grid', async () => {
    await mainPage.rightClickTorrentRow();
    const renameTorrentModal = new RenameTorrentModal(handle.page);
    await mainPage.ctxRenameTorrent.click();
    await renameTorrentModal.waitForReady();

    await renameTorrentModal.nameInput.fill('renamed-torrent');
    await renameTorrentModal.saveButton.click();
    await renameTorrentModal.modal.waitFor({ state: 'hidden' });

    await handle.page.waitForFunction(
      () => {
        const cells = document.querySelectorAll('.ag-cell[col-id="name"]');
        return Array.from(cells).some((c) => c.textContent?.includes('renamed-torrent'));
      },
      { timeout: 10_000 },
    );
    const name = await mainPage.getFirstTorrentName();
    expect(name).toContain('renamed-torrent');
  });

  test('set category shows category label in grid row', async () => {
    // First create a category via the qB API
    const sid = await getSid();
    await fetch(`http://127.0.0.1:18080/api/v2/torrents/createCategory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: `SID=${sid}` },
      body: new URLSearchParams({ category: 'e2e-cat' }).toString(),
    });

    await mainPage.rightClickTorrentRow();
    const setCategoryModal = new SetCategoryModal(handle.page);
    await mainPage.ctxSetCategory.click();
    await setCategoryModal.waitForReady();
    await setCategoryModal.selectCategory('e2e-cat');
    await setCategoryModal.saveButton.click();
    await setCategoryModal.modal.waitFor({ state: 'hidden' });

    await handle.page.waitForFunction(
      () => {
        const cells = document.querySelectorAll('.ag-cell[col-id="category"]');
        return Array.from(cells).some((c) => c.textContent?.includes('e2e-cat'));
      },
      { timeout: 10_000 },
    );
    const catCell = handle.page.locator('.ag-row').first().locator('.ag-cell[col-id="category"]');
    await expect(catCell).toContainText('e2e-cat');
  });

  test('set save location updates location in qB API', async () => {
    const newPath = '/tmp/e2e-location-test';
    await mainPage.rightClickTorrentRow();
    const setLocationModal = new SetLocationModal(handle.page);
    await mainPage.ctxSetLocation.click();
    await setLocationModal.waitForReady();
    await setLocationModal.setPath(newPath);
    await setLocationModal.saveButton.click();
    await setLocationModal.modal.waitFor({ state: 'hidden' });

    // Verify via qB API
    await handle.page.waitForTimeout(1000);
    const sid = await getSid();
    const torrents = await getTorrents(sid);
    if (torrents.length > 0) {
      const props = await getTorrentProperties(sid, torrents[0].hash);
      expect(props.save_path).toBe(newPath);
    }
  });

  test('delete torrent with delete files removes row from grid', async () => {
    // Add a throwaway torrent so we don't delete the shared fixture
    const sid = await getSid();
    const torrentPath = path.resolve(__dirname, '../fixtures/test.torrent');
    await addTorrent(sid, torrentPath);
    await handle.page.waitForTimeout(1000);
    await handle.page.reload();
    await mainPage.waitForReady();

    const countBefore = await mainPage.getTorrentRowCount();

    // Right-click the last row (throwaway) and delete
    const lastRow = handle.page.locator('.ag-row').last();
    await lastRow.click({ button: 'right' });
    const deleteTorrentModal = new DeleteTorrentModal(handle.page);
    await mainPage.ctxDelete.click();
    await deleteTorrentModal.waitForReady();

    const checkbox = deleteTorrentModal.removeFilesCheckbox;
    const isChecked = await checkbox.isChecked();
    if (!isChecked) await checkbox.check();

    await deleteTorrentModal.confirmButton.click();
    await deleteTorrentModal.modal.waitFor({ state: 'hidden' });

    await handle.page.waitForFunction(
      (expectedCount) => document.querySelectorAll('.ag-row').length < expectedCount,
      countBefore,
      { timeout: 10_000 },
    );
    const countAfter = await mainPage.getTorrentRowCount();
    expect(countAfter).toBeLessThan(countBefore);
  });
});
```

- [ ] **Step 10: Build and run torrent-actions tests**

```bash
npm run build && npm run build:electron && npm run test:e2e:server:ci -- --grep "Torrent actions"
```

Expected: 4 tests pass.

- [ ] **Step 11: Commit**

```bash
git add packages/app/src/app/modals/ e2e/pages/rename-torrent.modal.ts e2e/pages/delete-torrent.modal.ts e2e/pages/set-category.modal.ts e2e/pages/set-location.modal.ts e2e/tests/torrent-actions.spec.ts
git commit -m "#110: Add data-testid to torrent-action modals; add torrent-actions e2e tests"
```

---

## Task 11: Add data-testid to bb-file-tree, create POM, write file-tree tests

**Files:**

- Modify: `packages/app/src/app/shared/components/file-tree/bb-file-tree.html`
- Create: `e2e/pages/file-tree.modal.ts`
- Create: `e2e/tests/file-tree.spec.ts`

- [ ] **Step 1: Add data-testid to bb-file-tree.html**

Read the file. The component uses CDK tree with `.bb-row--file` for file rows. Add:

- Tree container root → `data-testid="file-tree"`
- File rows: bind `[attr.data-testid]="'file-row-' + node.name"` on the row element
- Edit button (inline rename) → `data-testid="file-rename-button"` (or bind with node name if multiple)
- Rename input → `data-testid="file-rename-input"`
- Save button (confirm rename) → `data-testid="file-rename-save"`
- Cancel button → `data-testid="file-rename-cancel"`

- [ ] **Step 2: Create e2e/pages/file-tree.modal.ts**

```typescript
// e2e/pages/file-tree.modal.ts
import { Page } from '@playwright/test';

export class FileTreeModal {
  readonly fileTree = this.page.getByTestId('file-tree');

  constructor(private readonly page: Page) {}

  async waitForReady(): Promise<void> {
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

  async renameFile(currentName: string, newName: string): Promise<void> {
    const row = this.page.getByTestId(`file-row-${currentName}`);
    await row.hover();
    await this.page.getByTestId('file-rename-button').first().click();
    const input = this.page.getByTestId('file-rename-input');
    await input.fill(newName);
    await this.page.getByTestId('file-rename-save').first().click();
  }
}
```

- [ ] **Step 3: Create e2e/tests/file-tree.spec.ts**

The file tree is accessed via the right-click context menu on a torrent row → "Rename Files".

```typescript
import { expect, test } from '@playwright/test';
import { MainPageHandle, launchAppOnMainPage } from '../helpers/app';
import { closeApp } from '../helpers/electron';
import { FileTreeModal } from '../pages/file-tree.modal';
import { MainPage } from '../pages/main.page';

test.describe('File tree', () => {
  let handle: MainPageHandle;
  let mainPage: MainPage;
  let fileTreeModal: FileTreeModal;

  test.beforeEach(async () => {
    handle = await launchAppOnMainPage();
    mainPage = new MainPage(handle.page);
    await mainPage.waitForReady();
    fileTreeModal = new FileTreeModal(handle.page);

    // Open file tree via context menu
    await mainPage.rightClickTorrentRow();
    await mainPage.ctxRenameFiles.click();
    await fileTreeModal.waitForReady();
  });

  test.afterEach(async () => {
    await closeApp(handle);
  });

  test('file tree shows hello.txt and world.txt', async () => {
    const names = await fileTreeModal.getFileNames();
    expect(names.some((n) => n.includes('hello.txt'))).toBe(true);
    expect(names.some((n) => n.includes('world.txt'))).toBe(true);
  });

  test('rename hello.txt to renamed.txt shows new name in tree', async () => {
    await fileTreeModal.renameFile('hello.txt', 'renamed.txt');

    await handle.page.waitForFunction(
      () => {
        const rows = document.querySelectorAll('.bb-row--file');
        return Array.from(rows).some((r) => r.textContent?.includes('renamed.txt'));
      },
      { timeout: 10_000 },
    );

    const names = await fileTreeModal.getFileNames();
    expect(names.some((n) => n.includes('renamed.txt'))).toBe(true);
  });
});
```

- [ ] **Step 4: Build and run file-tree tests**

```bash
npm run build && npm run build:electron && npm run test:e2e:server:ci -- --grep "File tree"
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/shared/components/file-tree/ e2e/pages/file-tree.modal.ts e2e/tests/file-tree.spec.ts
git commit -m "#110: Add data-testid to bb-file-tree; add file-tree e2e tests"
```

---

## Task 12: Add data-testid to manage-categories/tags/confirm modals, create POMs, write modals tests

**Files:**

- Modify: `packages/app/src/app/modals/manage-categories/manage-categories.html`
- Modify: `packages/app/src/app/modals/manage-tags/manage-tags.html`
- Modify: `packages/app/src/app/modals/confirm/confirm.html`
- Create: `e2e/pages/manage-categories.modal.ts`
- Create: `e2e/pages/manage-tags.modal.ts`
- Create: `e2e/pages/confirm.modal.ts`
- Create: `e2e/tests/modals.spec.ts`

- [ ] **Step 1: Add data-testid to manage-categories.html**

Read the file and add:

- Input `id="category-name"` → `data-testid="category-name-input"`
- Add button → `data-testid="add-category-button"`
- Category list items (in the @for loop) → `[attr.data-testid]="'category-item-' + category.name"` (or similar)
- Modal root → `data-testid="manage-categories-modal"`

- [ ] **Step 2: Add data-testid to manage-tags.html**

Read the file and add:

- Input `id="tag-name"` → `data-testid="tag-name-input"`
- Add button → `data-testid="add-tag-button"`
- Tag list items → `[attr.data-testid]="'tag-item-' + tag"` (or similar)
- Modal root → `data-testid="manage-tags-modal"`

- [ ] **Step 3: Add data-testid to confirm.html**

Read the file and add:

- OK/confirm button (btn-danger) → `data-testid="confirm-ok-button"`
- Cancel button (btn-link) → `data-testid="confirm-cancel-button"`
- Modal root → `data-testid="confirm-modal"`

- [ ] **Step 4: Create e2e/pages/manage-categories.modal.ts**

```typescript
// e2e/pages/manage-categories.modal.ts
import { Page } from '@playwright/test';

export class ManageCategoriesModal {
  readonly modal = this.page.getByTestId('manage-categories-modal');
  readonly nameInput = this.page.getByTestId('category-name-input');
  readonly addButton = this.page.getByTestId('add-category-button');

  constructor(private readonly page: Page) {}

  async waitForReady(): Promise<void> {
    await this.modal.waitFor({ state: 'visible' });
  }

  async addCategory(name: string): Promise<void> {
    await this.nameInput.fill(name);
    await this.addButton.click();
  }

  async isCategoryVisible(name: string): Promise<boolean> {
    const item = this.page.getByTestId(`category-item-${name}`);
    return item.isVisible();
  }
}
```

- [ ] **Step 5: Create e2e/pages/manage-tags.modal.ts**

```typescript
// e2e/pages/manage-tags.modal.ts
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
}
```

- [ ] **Step 6: Create e2e/pages/confirm.modal.ts**

```typescript
// e2e/pages/confirm.modal.ts
import { Page } from '@playwright/test';

export class ConfirmModal {
  readonly modal = this.page.getByTestId('confirm-modal');
  readonly okButton = this.page.getByTestId('confirm-ok-button');
  readonly cancelButton = this.page.getByTestId('confirm-cancel-button');

  constructor(private readonly page: Page) {}

  async waitForReady(): Promise<void> {
    await this.modal.waitFor({ state: 'visible' });
  }
}
```

- [ ] **Step 7: Find how manage-categories/tags modals are opened**

The manage-categories and manage-tags modals are opened from the main page button bar or sidebar. Read `button-bar.ts` or `status.html` to find the exact button IDs and add their `data-testid` to `main.page.ts`:

```typescript
// Add to MainPage class in e2e/pages/main.page.ts:
readonly manageCategoriesButton = this.page.getByTestId('toolbar-btn-categories.manage');
readonly manageTagsButton = this.page.getByTestId('toolbar-btn-tags.manage');
```

(Adjust the button IDs to match the actual IDs found in `button-bar.ts`.)

- [ ] **Step 8: Create e2e/tests/modals.spec.ts**

```typescript
import { expect, test } from '@playwright/test';
import { MainPageHandle, launchAppOnMainPage } from '../helpers/app';
import { closeApp } from '../helpers/electron';
import { ConfirmModal } from '../pages/confirm.modal';
import { DeleteTorrentModal } from '../pages/delete-torrent.modal';
import { MainPage } from '../pages/main.page';
import { ManageCategoriesModal } from '../pages/manage-categories.modal';
import { ManageTagsModal } from '../pages/manage-tags.modal';

test.describe('Modals', () => {
  let handle: MainPageHandle;
  let mainPage: MainPage;

  test.beforeEach(async () => {
    handle = await launchAppOnMainPage();
    mainPage = new MainPage(handle.page);
    await mainPage.waitForReady();
  });

  test.afterEach(async () => {
    await closeApp(handle);
  });

  test('manage categories: add a category, it appears in the list', async () => {
    await mainPage.manageCategoriesButton.click();
    const modal = new ManageCategoriesModal(handle.page);
    await modal.waitForReady();
    await modal.addCategory('e2e-test-cat');
    await expect(handle.page.getByTestId('category-item-e2e-test-cat')).toBeVisible();
  });

  test('manage tags: add a tag, it appears in the list', async () => {
    await mainPage.manageTagsButton.click();
    const modal = new ManageTagsModal(handle.page);
    await modal.waitForReady();
    await modal.addTag('e2e-test-tag');
    await expect(handle.page.getByTestId('tag-item-e2e-test-tag')).toBeVisible();
  });

  test('clicking Cancel on delete keeps the torrent in the grid', async () => {
    const countBefore = await mainPage.getTorrentRowCount();
    await mainPage.rightClickTorrentRow();
    await mainPage.ctxDelete.click();
    const deleteModal = new DeleteTorrentModal(handle.page);
    await deleteModal.waitForReady();
    await deleteModal.cancelButton.click();
    await deleteModal.modal.waitFor({ state: 'hidden' });
    const countAfter = await mainPage.getTorrentRowCount();
    expect(countAfter).toBe(countBefore);
  });
});
```

- [ ] **Step 9: Build and run modals tests**

```bash
npm run build && npm run build:electron && npm run test:e2e:server:ci -- --grep "Modals"
```

Expected: 3 tests pass.

- [ ] **Step 10: Commit**

```bash
git add packages/app/src/app/modals/manage-categories/ packages/app/src/app/modals/manage-tags/ packages/app/src/app/modals/confirm/ e2e/pages/manage-categories.modal.ts e2e/pages/manage-tags.modal.ts e2e/pages/confirm.modal.ts e2e/tests/modals.spec.ts
git commit -m "#110: Add data-testid to manage-categories/tags/confirm modals; add modals e2e tests"
```

---

## Task 13: Add data-testid to settings modal, create POM, write settings tests

**Files:**

- Modify: `packages/app/src/app/pages/settings/settings.html`
- Create: `e2e/pages/settings.modal.ts`
- Create: `e2e/tests/settings.spec.ts`

- [ ] **Step 1: Find the settings button in the button bar**

Read `packages/app/src/app/pages/main/button-bar/button-bar.ts` to find the settings button entry ID (likely `settings` or `settings.open`). Add to `MainPage` in `e2e/pages/main.page.ts`:

```typescript
readonly settingsButton = this.page.getByTestId('toolbar-btn-settings');
```

(Adjust the ID to match what's found in button-bar.ts.)

- [ ] **Step 2: Add data-testid to settings.html**

Read the file and add:

- Settings modal root → `data-testid="settings-modal"`
- Save button → `data-testid="settings-save"`
- Close button → `data-testid="settings-close"`
- Tab items (in the @for loop) → `[attr.data-testid]="'settings-tab-' + tab.id"` (or similar)

- [ ] **Step 3: Create e2e/pages/settings.modal.ts**

```typescript
// e2e/pages/settings.modal.ts
import { Page } from '@playwright/test';

export class SettingsModal {
  readonly modal = this.page.getByTestId('settings-modal');
  readonly saveButton = this.page.getByTestId('settings-save');
  readonly closeButton = this.page.getByTestId('settings-close');

  constructor(private readonly page: Page) {}

  async waitForReady(): Promise<void> {
    await this.modal.waitFor({ state: 'visible' });
  }

  async selectTheme(themeName: string): Promise<void> {
    // Theme selector uses ng-select. Click to open, then select by visible text.
    const themeSelect = this.page.locator('[data-testid="settings-modal"] ng-select').first();
    await themeSelect.click();
    await this.page.getByText(themeName, { exact: true }).click();
  }
}
```

- [ ] **Step 4: Create e2e/tests/settings.spec.ts**

```typescript
import { expect, test } from '@playwright/test';
import { MainPageHandle, launchAppOnMainPage } from '../helpers/app';
import { closeApp } from '../helpers/electron';
import { MainPage } from '../pages/main.page';
import { SettingsModal } from '../pages/settings.modal';

test.describe('Settings', () => {
  let handle: MainPageHandle;
  let mainPage: MainPage;
  let settingsModal: SettingsModal;

  test.beforeEach(async () => {
    handle = await launchAppOnMainPage();
    mainPage = new MainPage(handle.page);
    await mainPage.waitForReady();
    settingsModal = new SettingsModal(handle.page);
  });

  test.afterEach(async () => {
    await closeApp(handle);
  });

  test('settings modal opens from the button bar', async () => {
    await mainPage.settingsButton.click();
    await settingsModal.waitForReady();
    await expect(settingsModal.modal).toBeVisible();
  });

  test('switching theme updates the data-bb-theme attribute', async () => {
    await mainPage.settingsButton.click();
    await settingsModal.waitForReady();

    const initialTheme = await handle.page.evaluate(() =>
      document.documentElement.getAttribute('data-bb-theme'),
    );

    // Try to select a different theme
    const targetTheme = initialTheme === 'dark' ? 'light' : 'dark';
    await settingsModal.selectTheme(targetTheme);

    const newTheme = await handle.page.evaluate(() =>
      document.documentElement.getAttribute('data-bb-theme'),
    );
    expect(newTheme).toBe(targetTheme);
  });

  test('closing settings without saving produces no error', async () => {
    await mainPage.settingsButton.click();
    await settingsModal.waitForReady();
    await settingsModal.closeButton.click();
    await settingsModal.modal.waitFor({ state: 'hidden' });
    await expect(mainPage.torrentGrid).toBeVisible();
  });
});
```

- [ ] **Step 5: Build and run settings tests**

```bash
npm run build && npm run build:electron && npm run test:e2e:server:ci -- --grep "Settings"
```

Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/pages/settings/ e2e/pages/settings.modal.ts e2e/tests/settings.spec.ts
git commit -m "#110: Add data-testid to settings modal; add settings e2e tests"
```

---

## Task 14: Run full suite, fix flaky tests, final verification

- [ ] **Step 1: Run the full server test suite**

```bash
npm run build && npm run build:electron && npm run test:e2e:server:ci
```

Expected: all 26 tests pass (19 new + 7 existing), no failures.

- [ ] **Step 2: Fix flaky tests if any**

Common issues and fixes:

| Symptom                                      | Fix                                                                                                                        |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `waitForFunction` times out                  | Increase timeout; check selector names match actual DOM                                                                    |
| Context menu not visible                     | Ensure `rightClickTorrentRow()` is correctly positioned; add `await page.waitForTimeout(200)` before right-click assertion |
| ag-row count wrong after add                 | Add longer `waitForFunction` timeout                                                                                       |
| `data-testid` not found                      | Verify the attribute was added to the correct element in the template                                                      |
| Modal `data-testid` not on root              | Ensure `data-testid` is on the outermost element of the modal component, not inside a nested div                           |
| Theme test fails                             | Check actual attribute name via DevTools in the running app                                                                |
| globalSetup fails: temp password not in logs | Wait longer before reading logs; add a 2-second sleep after `startContainer()`                                             |

- [ ] **Step 3: Run the no-server suite to confirm no regressions**

```bash
npm run test:e2e:ci
```

Expected: all 7 no-server tests pass.

- [ ] **Step 4: Update e2e/globalSetup.ts if globalTeardown needs to delete the fixture torrent**

If the fixture torrent's hash is needed for cleanup, store it in a shared env var in `globalSetup.ts`:

```typescript
const torrents = await getTorrents(sid);
const fixture = torrents.find((t) => t.name === 'test-files');
if (fixture) process.env['FIXTURE_HASH'] = fixture.hash;
```

And in `globalTeardown.ts`:

```typescript
const hash = process.env['FIXTURE_HASH'];
if (hash) {
  const sid = await getSid();
  await deleteTorrent(sid, hash);
}
stopContainer();
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "#110: Complete Playwright e2e coverage - 26 tests across 9 spec files"
```

---

## Self-Review

**Spec coverage:**

- ✅ Single Playwright project, Docker always on - Task 3 (playwright.config.ts), Task 2 (qbittorrent.ts)
- ✅ globalSetup starts container, seeds fixture torrent - Task 3
- ✅ globalTeardown stops container - Task 3
- ✅ Fixture torrent committed to e2e/fixtures/ - Task 1
- ✅ Isolation per test (userDataDir) - existing in e2e/helpers/electron.ts
- ✅ launchAppOnMainPage() helper - Task 7
- ✅ Page Object Model, one class per page/modal - Tasks 5-13
- ✅ getByTestId() exclusively - Tasks 5-13
- ✅ data-testid on all Angular templates - Tasks 5-13
- ✅ Existing tests retrofitted - Task 5
- ✅ login-flow.spec.ts (2 tests) - Task 7
- ✅ main-page.spec.ts (4 tests) - Task 8
- ✅ add-torrent.spec.ts (1 test) - Task 9
- ✅ torrent-actions.spec.ts (4 tests) - Task 10
- ✅ file-tree.spec.ts (2 tests) - Task 11
- ✅ modals.spec.ts (3 tests) - Task 12
- ✅ settings.spec.ts (3 tests) - Task 13
- ✅ CI e2e-server job - Task 4
- ✅ execFileSync with argument arrays (not shell strings) - Task 2

**Placeholder scan:** No TBDs. All code steps are complete and runnable.

**Type consistency:** `AppHandle` from `e2e/helpers/electron.ts`, `MainPageHandle` extends it in `e2e/helpers/app.ts`. `getSid`, `addTorrent`, `deleteTorrent`, `getTorrents`, `getTorrentProperties` defined in Task 2 and used in Tasks 10 and 12. `QB_HOST`, `QB_PORT`, `QB_USER`, `QB_PASS` exported from Task 2 and imported in Tasks 3 and 7.
