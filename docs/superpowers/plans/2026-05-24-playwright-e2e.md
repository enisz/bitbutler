# Playwright E2E Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Playwright end-to-end tests that launch the real Electron app headlessly and assert on visible UI behavior, integrated into GitHub CI.

**Architecture:** Playwright's `_electron` launcher runs the compiled Electron binary against pre-built Angular output, with an isolated SQLite database per test run via `userDataDir`. Tests live in `e2e/` at the repo root, separate from Angular unit tests. A single env var (`PLAYWRIGHT_E2E=1`) switches Electron from dev-server mode to loading built files, keeping the main-window patch minimal.

**Tech Stack:** `@playwright/test`, xvfb (CI only), Electron binary from `node_modules/electron`

---

## File Map

| Action | Path                                   | Purpose                                                    |
| ------ | -------------------------------------- | ---------------------------------------------------------- |
| Create | `playwright.config.ts`                 | Playwright configuration                                   |
| Create | `e2e/helpers/electron.ts`              | Reusable launch/teardown for all specs                     |
| Create | `e2e/tests/app-startup.spec.ts`        | Smoke tests: app boots, login page renders                 |
| Create | `e2e/tests/server-management.spec.ts`  | Add-server modal open/close                                |
| Modify | `packages/electron/src/main-window.ts` | Add `PLAYWRIGHT_E2E` env var check                         |
| Modify | `package.json`                         | Add `test:e2e` script and `@playwright/test` devDependency |
| Modify | `.github/workflows/bitbutler-pr.yml`   | Add e2e CI job                                             |

---

## Task 1: Install `@playwright/test` and add npm script

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
npm install --save-dev @playwright/test
```

- [ ] **Step 2: Add the `test:e2e` script to root `package.json`**

In the `"scripts"` block, add:

```json
"test:e2e": "playwright test",
"test:e2e:ci": "xvfb-run --auto-servernum playwright test"
```

- [ ] **Step 3: Verify the package is present**

```bash
node -e "require('@playwright/test'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "#110: Add @playwright/test devDependency"
```

---

## Task 2: Patch `main-window.ts` for test mode

The Electron app checks `!app.isPackaged` to decide whether to load from `localhost:4200` (dev) or from the built Angular files. In e2e tests the app is not packaged, so without a patch it would try to connect to a dev server that isn't running. A single env-var check fixes this.

**Files:**

- Modify: `packages/electron/src/main-window.ts:5`

- [ ] **Step 1: Change the `isDev` line**

Current (line 5):

```typescript
const isDev = !app.isPackaged;
```

Replace with:

```typescript
const isDev = !app.isPackaged && !process.env['PLAYWRIGHT_E2E'];
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build:electron
```

Expected: no errors, `packages/electron/dist/main.js` updated.

- [ ] **Step 3: Commit**

```bash
git add packages/electron/src/main-window.ts
git commit -m "#110: Support PLAYWRIGHT_E2E env var for loading built files in e2e tests"
```

---

## Task 3: Create `playwright.config.ts`

**Files:**

- Create: `playwright.config.ts`

- [ ] **Step 1: Create the file**

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

- [ ] **Step 2: Verify Playwright recognises the config**

```bash
npx playwright test --list 2>&1 | head -5
```

Expected: output showing 0 test files found (no tests written yet), no config errors.

- [ ] **Step 3: Commit**

```bash
git add playwright.config.ts
git commit -m "#110: Add Playwright configuration"
```

---

## Task 4: Create the Electron launch helper

This helper is imported by every spec. It handles launching the Electron binary with the right flags, a temporary isolated user-data directory (so each run starts with a fresh SQLite database and no saved servers), and cleanup on teardown.

**Files:**

- Create: `e2e/helpers/electron.ts`

- [ ] **Step 1: Create the helper**

```typescript
import { ElectronApplication, Page, _electron as electron } from '@playwright/test';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

const ELECTRON_BIN =
  process.platform === 'win32'
    ? path.resolve('node_modules/electron/dist/electron.exe')
    : path.resolve('node_modules/electron/dist/electron');

export interface AppHandle {
  app: ElectronApplication;
  page: Page;
  userDataDir: string;
}

export async function launchApp(): Promise<AppHandle> {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bitbutler-e2e-'));

  const app = await electron.launch({
    executablePath: ELECTRON_BIN,
    args: ['--no-sandbox', '.'],
    env: {
      ...process.env,
      PLAYWRIGHT_E2E: '1',
    },
    userDataDir,
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
```

- [ ] **Step 2: Verify TypeScript can resolve the imports**

```bash
npx tsc --noEmit --strict e2e/helpers/electron.ts 2>&1 | head -20
```

Expected: no errors. If there are `Cannot find module` errors for `@playwright/test`, the install in Task 1 may not have completed — re-run `npm install`.

- [ ] **Step 3: Commit**

```bash
git add e2e/helpers/electron.ts
git commit -m "#110: Add Electron launch helper for e2e tests"
```

---

## Task 5: Write and pass app-startup tests

These tests verify the app boots to the login page with correct content and that the Connect button is disabled when no servers are configured. Because the `userDataDir` is isolated (fresh each run), there are no pre-existing servers.

**Files:**

- Create: `e2e/tests/app-startup.spec.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { expect, test } from '@playwright/test';
import { AppHandle, closeApp, launchApp } from '../helpers/electron';

test.describe('App startup', () => {
  let handle: AppHandle;

  test.beforeEach(async () => {
    handle = await launchApp();
  });

  test.afterEach(async () => {
    await closeApp(handle);
  });

  test('shows the login page', async () => {
    await expect(handle.page.locator('h1.brand-title')).toHaveText('BitButler');
  });

  test('shows the version badge', async () => {
    await expect(handle.page.locator('.version .badge')).toBeVisible();
  });

  test('connect button is disabled with no servers', async () => {
    const connectBtn = handle.page.locator('button.btn-primary', { hasText: /connect/i });
    await expect(connectBtn).toBeDisabled();
  });

  test('add server button is enabled', async () => {
    const addBtn = handle.page.locator('button.btn-secondary', { hasText: /add/i });
    await expect(addBtn).toBeEnabled();
  });
});
```

- [ ] **Step 2: Build the app (required before running e2e)**

```bash
npm run build && npm run build:electron
```

Expected: both commands exit 0. Angular output at `dist/bitbutler/browser/index.html`, Electron TS at `packages/electron/dist/main.js`.

- [ ] **Step 3: Run the tests and expect them to FAIL (no xvfb locally on Linux headless, or app not loading yet)**

On Linux desktop or Windows — run directly:

```bash
npm run test:e2e -- --project='' 2>&1 | tail -30
```

On Linux CI/headless:

```bash
npm run test:e2e:ci 2>&1 | tail -30
```

Expected outcome: tests either pass outright (happy path) or fail with a clear error like `waitForLoadState` timeout — which tells you whether the app actually booted. Investigate if the error is `ENOENT` on the Electron binary (wrong path) or a white screen (build output missing).

- [ ] **Step 4: Fix any launch issues and re-run until all 4 tests pass**

Common issues and fixes:

| Symptom                      | Fix                                                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `ENOENT` on electron binary  | Check `ELECTRON_BIN` path; on Linux it may be `node_modules/electron/dist/electron` without `.exe`                      |
| White screen / load timeout  | Verify `dist/bitbutler/browser/index.html` exists after `npm run build`                                                 |
| `waitForLoadState` times out | Increase `timeout` in `launchApp()` or add `await page.waitForSelector('h1.brand-title')`                               |
| `h1.brand-title` not found   | Angular hasn't rendered yet — add `await page.waitForSelector('h1.brand-title', { timeout: 20_000 })` before assertions |

- [ ] **Step 5: Run the full test suite and confirm no regressions**

```bash
npm run test:e2e
```

Expected: 4 passing.

- [ ] **Step 6: Commit**

```bash
git add e2e/tests/app-startup.spec.ts
git commit -m "#110: Add app-startup e2e tests"
```

---

## Task 6: Write and pass server-management tests

Tests that the "Add Server" flow opens the modal and that the modal can be dismissed. No qBittorrent server is needed — just UI interactions.

**Files:**

- Create: `e2e/tests/server-management.spec.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { expect, test } from '@playwright/test';
import { AppHandle, closeApp, launchApp } from '../helpers/electron';

test.describe('Server management', () => {
  let handle: AppHandle;

  test.beforeEach(async () => {
    handle = await launchApp();
    // Ensure we're on the login page before each test
    await handle.page.waitForSelector('h1.brand-title');
  });

  test.afterEach(async () => {
    await closeApp(handle);
  });

  test('clicking Add Server opens the server editor modal', async () => {
    await handle.page.locator('button.btn-secondary', { hasText: /add/i }).click();
    await expect(handle.page.locator('.modal-title')).toBeVisible();
  });

  test('server editor modal has a name input', async () => {
    await handle.page.locator('button.btn-secondary', { hasText: /add/i }).click();
    await expect(handle.page.locator('#name')).toBeVisible();
  });

  test('dismissing the modal returns to login page', async () => {
    await handle.page.locator('button.btn-secondary', { hasText: /add/i }).click();
    await handle.page.locator('.modal-header .btn-close').click();
    await expect(handle.page.locator('h1.brand-title')).toBeVisible();
    await expect(handle.page.locator('.modal')).not.toBeVisible();
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
npm run test:e2e
```

Expected: all 7 tests (4 from Task 5 + 3 from Task 6) pass.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/server-management.spec.ts
git commit -m "#110: Add server-management e2e tests"
```

---

## Task 7: Wire e2e into GitHub CI

The new `e2e` job runs on ubuntu-latest only, after unit tests pass, before the build job. It installs xvfb and required Chromium system libraries, builds the app, then runs Playwright under `xvfb-run`.

Note: the `npm ci` step here does NOT set `ELECTRON_SKIP_BINARY_DOWNLOAD: '1'` — the Electron binary is required for e2e tests.

**Files:**

- Modify: `.github/workflows/bitbutler-pr.yml`

- [ ] **Step 1: Add the `e2e` job to the workflow**

In `.github/workflows/bitbutler-pr.yml`, add a new job after `test-electron` and update the `build` job's `needs` to include `e2e`:

```yaml
e2e:
  name: '[5/6] E2E Tests (Playwright / Electron)'
  runs-on: ubuntu-latest
  needs: [detect-changes, test-app, test-electron]
  if: >-
    always() &&
    needs.detect-changes.outputs.any-source == 'true' &&
    !contains(needs.*.result, 'failure') &&
    !contains(needs.*.result, 'cancelled')
  steps:
    - uses: actions/checkout@v6
    - uses: actions/setup-node@v6
      with:
        node-version: '24'
        cache: 'npm'
    - run: npm install -g npm@11
    - run: npm ci

    - name: Install display and Chromium system libraries
      run: |
        sudo apt-get update -qq
        sudo apt-get install -y xvfb libnss3 libgbm1 libasound2t64 libgtk-3-0 libxss1 libxkbcommon0 libatk-bridge2.0-0 libcups2 libdrm2

    - name: Build Angular app
      run: npm run build
      env:
        ELECTRON_SKIP_BINARY_DOWNLOAD: '1'

    - name: Build Electron TypeScript
      run: npm run build:electron

    - name: Run Playwright e2e tests
      run: npm run test:e2e:ci
```

- [ ] **Step 2: Update the `build` job's `needs` array to include `e2e`**

Current `needs` on the `build` job:

```yaml
needs: [detect-changes, test-app, test-electron]
```

Change to:

```yaml
needs: [detect-changes, test-app, test-electron, e2e]
```

Also update the job numbering label from `[5/5]` to `[6/6]`.

- [ ] **Step 3: Verify the YAML is valid**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/bitbutler-pr.yml'))" && echo "valid"
```

Expected: `valid`

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/bitbutler-pr.yml
git commit -m "#110: Add Playwright e2e job to CI"
```

---

## Self-review

**Spec coverage:**

- ✅ Install Playwright - Task 1
- ✅ Isolated database per test - Task 4 (`userDataDir`)
- ✅ Works on Windows (native display) and Linux (xvfb in CI only) - Tasks 4 + 7
- ✅ Tests go in `e2e/` not `.spec.ts` - File Map
- ✅ Separate `npm run test:e2e` script - Task 1
- ✅ CI integration - Task 7
- ✅ App-startup tests - Task 5
- ✅ Server management tests - Task 6

**Placeholder scan:** No TBDs or unimplemented steps found.

**Type consistency:** `AppHandle`, `launchApp`, `closeApp` defined in Task 4 and used consistently in Tasks 5 and 6.
