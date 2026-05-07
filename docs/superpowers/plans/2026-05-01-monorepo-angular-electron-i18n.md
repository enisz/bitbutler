# Angular Monorepo + Electron i18n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Angular into a proper self-contained `packages/app` workspace and add translated menu labels to the Electron main process.

**Architecture:** All Angular config files (`angular.json`, tsconfigs) move into `packages/app/` with paths relative to that directory. Root scripts delegate to workspace scripts via `--workspace=packages/app`. Electron reads `public/i18n/<lang>.json` at startup and on language change, rebuilding the native menu with translated labels.

**Tech Stack:** Angular 20 CLI (`@angular/build:application`), npm workspaces, Electron 39, better-sqlite3, Vitest

---

## File Map

### Created

- `packages/app/tsconfig.json` — Angular base tsconfig for the app package
- `packages/app/tsconfig.app.json` — build tsconfig (extends app tsconfig)
- `packages/app/tsconfig.spec.json` — test tsconfig (extends app tsconfig)
- `packages/app/angular.json` — Angular workspace config rooted at `packages/app`
- `packages/electron/src/i18n.ts` — lightweight translation helper (load + dot-path lookup)
- `packages/electron/src/ipc/i18n.ts` — IPC handler for `i18n:language-changed`
- `packages/electron/vitest.config.ts` — Vitest config for electron package unit tests
- `packages/electron/src/i18n.spec.ts` — unit tests for the `t()` function

### Modified

- `packages/app/package.json` — add `serve`, `build`, `build:prod`, `test`, `test:watch` scripts
- `packages/electron/package.json` — add `test` script
- `packages/electron/tsconfig.json` — exclude spec files from the build
- `packages/electron/src/ipc/settings.ts` — add `getInitialLanguage()` export
- `packages/electron/src/main.ts` — load translations before first window, register i18n IPC
- `packages/electron/src/menu.ts` — replace hardcoded labels with `t()` calls
- `packages/electron/src/preload.ts` — add `i18n` namespace
- `packages/shared/src/ipc.types.ts` — add `i18n` to `BitButlerAPI`
- `packages/app/src/app/app.ts` — notify Electron on `onLangChange`
- `public/i18n/us.json` — add `electron.menu.*` keys
- `public/i18n/hu.json` — add `electron.menu.*` keys (Hungarian)
- `package.json` (root) — update scripts, add `extraResources`

### Deleted

- `angular.json` (root)
- `tsconfig.app.json` (root)
- `tsconfig.spec.json` (root)

### Simplified

- `tsconfig.json` (root) — remove `references` array and `angularCompilerOptions`

---

## Task 1: Create `packages/app` TypeScript configs

**Files:**

- Create: `packages/app/tsconfig.json`
- Create: `packages/app/tsconfig.app.json`
- Create: `packages/app/tsconfig.spec.json`

- [ ] **Step 1: Create `packages/app/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc"
  },
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true,
    "typeCheckHostBindings": true,
    "strictTemplates": true
  },
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.spec.json" }]
}
```

- [ ] **Step 2: Create `packages/app/tsconfig.app.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/app",
    "types": ["@angular/localize"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.spec.ts"]
}
```

- [ ] **Step 3: Create `packages/app/tsconfig.spec.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/spec",
    "types": ["vitest/globals", "node"]
  },
  "include": ["src/**/*.d.ts", "src/**/*.spec.ts", "src/test-setup.ts", "src/test-providers.ts"]
}
```

---

## Task 2: Create `packages/app/angular.json`

**Files:**

- Create: `packages/app/angular.json`

- [ ] **Step 1: Create `packages/app/angular.json`**

All paths below are relative to `packages/app/`. Assets reference `../../public` (shared with Electron) and output writes to `../../dist/bitbutler` so electron-builder finds it unchanged.

```json
{
  "$schema": "../../node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "newProjectRoot": "projects",
  "projects": {
    "bitbutler": {
      "projectType": "application",
      "schematics": {
        "@schematics/angular:component": {
          "style": "scss"
        }
      },
      "root": "",
      "sourceRoot": "src",
      "prefix": "app",
      "architect": {
        "build": {
          "builder": "@angular/build:application",
          "options": {
            "outputPath": "../../dist/bitbutler",
            "browser": "src/main.ts",
            "tsConfig": "tsconfig.app.json",
            "inlineStyleLanguage": "scss",
            "assets": [
              {
                "glob": "**/*",
                "input": "../../public"
              },
              "src/assets"
            ],
            "styles": ["src/styles.scss"],
            "polyfills": ["@angular/localize/init"],
            "stylePreprocessorOptions": {
              "includePaths": ["../../node_modules"]
            }
          },
          "configurations": {
            "production": {
              "budgets": [
                {
                  "type": "initial",
                  "maximumWarning": "3mb",
                  "maximumError": "5mb"
                },
                {
                  "type": "anyComponentStyle",
                  "maximumWarning": "10kb",
                  "maximumError": "20kb"
                },
                {
                  "type": "any",
                  "maximumWarning": "1.2mb",
                  "maximumError": "1.5mb"
                }
              ],
              "outputHashing": "all"
            },
            "development": {
              "optimization": false,
              "extractLicenses": false,
              "sourceMap": true,
              "outputHashing": "media"
            }
          },
          "defaultConfiguration": "production"
        },
        "serve": {
          "builder": "@angular/build:dev-server",
          "configurations": {
            "production": {
              "buildTarget": "bitbutler:build:production"
            },
            "development": {
              "buildTarget": "bitbutler:build:development"
            }
          },
          "defaultConfiguration": "development"
        },
        "extract-i18n": {
          "builder": "@angular/build:extract-i18n"
        },
        "test": {
          "builder": "@angular/build:unit-test",
          "options": {
            "buildTarget": "bitbutler:build",
            "tsConfig": "tsconfig.spec.json",
            "runner": "vitest",
            "setupFiles": ["src/test-setup.ts"],
            "providersFile": "src/test-providers.ts",
            "reporters": ["verbose"]
          }
        }
      }
    }
  },
  "cli": {
    "analytics": false
  }
}
```

---

## Task 3: Update scripts in `packages/app/package.json` and root `package.json`

**Files:**

- Modify: `packages/app/package.json`
- Modify: `package.json` (root)

- [ ] **Step 1: Update `packages/app/package.json`**

Replace the entire file:

```json
{
  "name": "@bitbutler/app",
  "version": "1.1.0",
  "private": true,
  "scripts": {
    "serve": "ng serve",
    "build": "ng build",
    "build:prod": "ng build --configuration production --base-href ./",
    "test": "ng test --watch=false",
    "test:watch": "ng test"
  },
  "dependencies": {
    "@bitbutler/shared": "*"
  }
}
```

- [ ] **Step 2: Update root `package.json` — change four scripts**

Find the `"scripts"` section in root `package.json`. Make these four changes:

| Key          | Old value                                                                                                   | New value                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `serve`      | `"ng serve"`                                                                                                | `"npm run serve --workspace=packages/app"`                                                           |
| `build`      | `"ng build"`                                                                                                | `"npm run build --workspace=packages/app"`                                                           |
| `build:ui`   | `"npm run workspace:clean && ng build --configuration production --base-href ./ && npm run build:electron"` | `"npm run workspace:clean && npm run build:prod --workspace=packages/app && npm run build:electron"` |
| `test`       | `"ng test --watch=false"`                                                                                   | `"npm run test --workspace=packages/app"`                                                            |
| `test:watch` | `"ng test"`                                                                                                 | `"npm run test:watch --workspace=packages/app"`                                                      |

---

## Task 4: Delete root Angular configs and simplify root `tsconfig.json`

**Files:**

- Delete: `angular.json` (root)
- Delete: `tsconfig.app.json` (root)
- Delete: `tsconfig.spec.json` (root)
- Modify: `tsconfig.json` (root)

- [ ] **Step 1: Delete the three root-level files**

```bash
rm angular.json tsconfig.app.json tsconfig.spec.json
```

- [ ] **Step 2: Replace root `tsconfig.json` with the stripped-down base config**

The `angularCompilerOptions` and `references` move into `packages/app/tsconfig.json`. Root keeps only the compiler options that all packages inherit:

```json
{
  "compileOnSave": false,
  "compilerOptions": {
    "strict": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "experimentalDecorators": true,
    "importHelpers": true,
    "target": "ES2022",
    "module": "preserve"
  }
}
```

---

## Task 5: Verify Angular build and commit

- [ ] **Step 1: Run lint from the repo root**

```bash
npm run lint
```

Expected: exits with code 0, zero warnings, zero errors.

- [ ] **Step 2: Run the dev build**

```bash
npm run build
```

Expected: Angular build succeeds, output written to `dist/bitbutler/browser/`.

- [ ] **Step 3: Run tests**

```bash
npm run test
```

Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/app/angular.json packages/app/tsconfig.json packages/app/tsconfig.app.json packages/app/tsconfig.spec.json packages/app/package.json package.json tsconfig.json
git commit -m "#64: move Angular workspace into packages/app"
```

---

## Task 6: Add Electron menu translation keys to i18n JSON files

**Files:**

- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

- [ ] **Step 1: Add `electron` top-level key to `public/i18n/us.json`**

Add the following at the top level of the JSON object (after the last existing key, before the closing `}`):

```json
"electron": {
  "menu": {
    "file": "File",
    "add-torrent": "Add Torrent\u2026",
    "settings": "Settings",
    "import-torrents": "Import Torrents",
    "export-torrents": "Export Torrents",
    "export-all": "All",
    "export-selected": "Selected",
    "disconnect": "Disconnect",
    "servers": "Servers",
    "add-new": "Add new\u2026",
    "help": "Help",
    "check-for-updates": "Check for Updates",
    "about": "About BitButler"
  }
}
```

- [ ] **Step 2: Add `electron` top-level key to `public/i18n/hu.json`**

```json
"electron": {
  "menu": {
    "file": "Fájl",
    "add-torrent": "Torrent hozzáadása\u2026",
    "settings": "Beállítások",
    "import-torrents": "Torrentek importálása",
    "export-torrents": "Torrentek exportálása",
    "export-all": "Mind",
    "export-selected": "Kiválasztottak",
    "disconnect": "Kijelentkezés",
    "servers": "Szerverek",
    "add-new": "Új hozzáadása\u2026",
    "help": "Súgó",
    "check-for-updates": "Frissítések keresése",
    "about": "A BitButlerről"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add public/i18n/us.json public/i18n/hu.json
git commit -m "#64: add electron menu translation keys"
```

---

## Task 7: Create `packages/electron/src/i18n.ts` with tests

**Files:**

- Create: `packages/electron/vitest.config.ts`
- Modify: `packages/electron/package.json`
- Create: `packages/electron/src/i18n.spec.ts`
- Create: `packages/electron/src/i18n.ts`

- [ ] **Step 1: Create `packages/electron/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
```

- [ ] **Step 2: Update `packages/electron/package.json` — add `test` script**

```json
{
  "name": "@bitbutler/electron",
  "version": "1.1.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "@bitbutler/shared": "*"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json && tsc -p tsconfig.preload.json",
    "test": "vitest run"
  }
}
```

- [ ] **Step 3: Exclude spec files from the Electron build tsconfig**

`packages/electron/tsconfig.json` currently excludes only `src/preload.ts` and `dist/**`. Without excluding spec files, `tsc` will try to compile `i18n.spec.ts` and fail because it imports `vitest`. Update the `exclude` array:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "skipLibCheck": true,
    "declaration": false,
    "verbatimModuleSyntax": true,
    "types": ["node"]
  },
  "exclude": ["src/preload.ts", "src/**/*.spec.ts", "dist/**"]
}
```

- [ ] **Step 4: Write the failing tests in `packages/electron/src/i18n.spec.ts`**

These tests cover the dot-path lookup logic by calling an internal helper that we will expose for testing. The `loadTranslations`/`t` functions are tested using mocked Electron and fs modules.

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => '/fake/app',
  },
}));

vi.mock('node:fs', () => ({
  default: {
    readFileSync: vi.fn(),
  },
}));

describe('i18n', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns the key when translations are empty', async () => {
    const fs = await import('node:fs');
    vi.mocked(fs.default.readFileSync).mockReturnValue('{}');

    const { loadTranslations, t } = await import('./i18n.js');
    loadTranslations('us');

    expect(t('some.missing.key')).toBe('some.missing.key');
  });

  it('resolves a top-level key', async () => {
    const fs = await import('node:fs');
    vi.mocked(fs.default.readFileSync).mockReturnValue(JSON.stringify({ greeting: 'Hello' }));

    const { loadTranslations, t } = await import('./i18n.js');
    loadTranslations('us');

    expect(t('greeting')).toBe('Hello');
  });

  it('resolves a nested dot-path key', async () => {
    const fs = await import('node:fs');
    vi.mocked(fs.default.readFileSync).mockReturnValue(
      JSON.stringify({ electron: { menu: { file: 'File' } } }),
    );

    const { loadTranslations, t } = await import('./i18n.js');
    loadTranslations('us');

    expect(t('electron.menu.file')).toBe('File');
  });

  it('returns the key for a partial path that resolves to a non-string', async () => {
    const fs = await import('node:fs');
    vi.mocked(fs.default.readFileSync).mockReturnValue(
      JSON.stringify({ electron: { menu: { file: 'File' } } }),
    );

    const { loadTranslations, t } = await import('./i18n.js');
    loadTranslations('us');

    // 'electron.menu' resolves to an object, not a string — fall back to key
    expect(t('electron.menu')).toBe('electron.menu');
  });

  it('returns the key when readFileSync throws', async () => {
    const fs = await import('node:fs');
    vi.mocked(fs.default.readFileSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });

    const { loadTranslations, t } = await import('./i18n.js');
    loadTranslations('us');

    expect(t('electron.menu.file')).toBe('electron.menu.file');
  });

  it('uses dev path when app is not packaged', async () => {
    const fs = await import('node:fs');
    vi.mocked(fs.default.readFileSync).mockReturnValue('{}');

    const { loadTranslations } = await import('./i18n.js');
    loadTranslations('us');

    expect(vi.mocked(fs.default.readFileSync)).toHaveBeenCalledWith(
      '/fake/app/public/i18n/us.json',
      'utf-8',
    );
  });
});
```

- [ ] **Step 5: Run the tests — expect them to fail (module not found)**

```bash
npm run test --workspace=packages/electron
```

Expected: fails with `Cannot find module './i18n.js'`.

- [ ] **Step 6: Create `packages/electron/src/i18n.ts`**

```typescript
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

type TranslationMap = Record<string, unknown>;

let translations: TranslationMap = {};

function getI18nFilePath(lang: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'i18n', `${lang}.json`);
  }
  return path.join(app.getAppPath(), 'public', 'i18n', `${lang}.json`);
}

export function loadTranslations(lang: string): void {
  const filePath = getI18nFilePath(lang);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    translations = JSON.parse(content) as TranslationMap;
  } catch (e) {
    console.warn(`[i18n] Failed to load translations for "${lang}":`, e);
    translations = {};
  }
}

export function t(key: string): string {
  const value = key.split('.').reduce<unknown>((obj, k) => {
    if (obj !== null && typeof obj === 'object') {
      return (obj as TranslationMap)[k];
    }
    return undefined;
  }, translations);
  return typeof value === 'string' ? value : key;
}
```

- [ ] **Step 7: Run the tests — expect them to pass**

```bash
npm run test --workspace=packages/electron
```

Expected: 5 tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/electron/vitest.config.ts packages/electron/package.json packages/electron/tsconfig.json packages/electron/src/i18n.ts packages/electron/src/i18n.spec.ts
git commit -m "#64: add Electron i18n translation helper with tests"
```

---

## Task 8: Add `getInitialLanguage()` to settings IPC and create i18n IPC handler

**Files:**

- Modify: `packages/electron/src/ipc/settings.ts`
- Create: `packages/electron/src/ipc/i18n.ts`

- [ ] **Step 1: Export `getInitialLanguage()` from `packages/electron/src/ipc/settings.ts`**

Add this function at the bottom of the file. It uses the already-prepared `stmtGet` statement to read the language synchronously without going through IPC:

```typescript
export function getInitialLanguage(): string {
  try {
    const row = stmtGet.get('GeneralSettingsService');
    if (!row?.json) return 'us';
    const settings = JSON.parse(row.json) as Record<string, unknown>;
    const lang = (settings?.language as Record<string, unknown>)?.language;
    return typeof lang === 'string' && lang ? lang : 'us';
  } catch {
    return 'us';
  }
}
```

- [ ] **Step 2: Create `packages/electron/src/ipc/i18n.ts`**

```typescript
import { ipcMain } from 'electron';
import { loadTranslations } from '../i18n.js';
import { rebuildMenu } from '../menu.js';

export function registerI18nIpcHandlers(): void {
  ipcMain.on('i18n:language-changed', (_event, payload: unknown) => {
    const lang =
      payload !== null && typeof payload === 'object'
        ? ((payload as Record<string, unknown>).lang as string | undefined)
        : undefined;

    if (typeof lang === 'string' && lang) {
      loadTranslations(lang);
      rebuildMenu();
    }
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/electron/src/ipc/settings.ts packages/electron/src/ipc/i18n.ts
git commit -m "#64: add getInitialLanguage and i18n IPC handler"
```

---

## Task 9: Update `main.ts` to load translations on startup and register IPC handler

**Files:**

- Modify: `packages/electron/src/main.ts`

- [ ] **Step 1: Add imports to `packages/electron/src/main.ts`**

Add these two lines to the existing imports at the top of `main.ts`:

```typescript
import { loadTranslations } from './i18n.js';
import { registerI18nIpcHandlers } from './ipc/i18n.js';
import { getInitialLanguage } from './ipc/settings.js';
```

- [ ] **Step 2: Call `loadTranslations` and register the IPC handler inside `app.whenReady()`**

The `app.whenReady().then(...)` block currently reads:

```typescript
app.whenReady().then(() => {
  createOrRestoreMainWindow();

  app.on('activate', () => {
    createOrRestoreMainWindow();
  });
});
```

Replace it with:

```typescript
app.whenReady().then(() => {
  loadTranslations(getInitialLanguage());
  registerI18nIpcHandlers();
  createOrRestoreMainWindow();

  app.on('activate', () => {
    createOrRestoreMainWindow();
  });
});
```

- [ ] **Step 3: Commit**

```bash
git add packages/electron/src/main.ts
git commit -m "#64: load translations on Electron startup"
```

---

## Task 10: Update `menu.ts` to use `t()`

**Files:**

- Modify: `packages/electron/src/menu.ts`

- [ ] **Step 1: Add import for `t` at the top of `packages/electron/src/menu.ts`**

Add this import after the existing imports:

```typescript
import { t } from './i18n.js';
```

- [ ] **Step 2: Replace all hardcoded label strings with `t()` calls**

Replace the entire `template` array in the `rebuildMenu` function with the following. Every `label: 'literal'` becomes `label: t('electron.menu.<key>')`:

```typescript
const template: Electron.MenuItemConstructorOptions[] = [
  {
    label: t('electron.menu.file'),
    submenu: [
      {
        label: t('electron.menu.add-torrent'),
        accelerator: 'Ctrl+O',
        enabled: loggedIn,
        click: () => sendMenuAction(mainWindow, 'file.addTorrent'),
      },
      {
        label: t('electron.menu.settings'),
        accelerator: 'Ctrl+,',
        enabled: loggedIn,
        click: () => sendMenuAction(mainWindow, 'file.settings'),
      },
      { type: 'separator' },
      {
        label: t('electron.menu.import-torrents'),
        accelerator: 'Ctrl+I',
        enabled: loggedIn,
        click: () => sendMenuAction(mainWindow, 'file.import'),
      },
      {
        label: t('electron.menu.export-torrents'),
        enabled: loggedIn,
        submenu: [
          {
            label: t('electron.menu.export-all'),
            click: () => sendMenuAction(mainWindow, 'file.export.all'),
          },
          {
            label: t('electron.menu.export-selected'),
            click: () => sendMenuAction(mainWindow, 'file.export.selected'),
          },
        ],
      },
      { type: 'separator' },
      {
        label: t('electron.menu.disconnect'),
        enabled: loggedIn,
        click: () => sendMenuAction(mainWindow, 'file.disconnect'),
      },
      { type: 'separator' },
      { role: 'quit' },
    ],
  },
  ...(loggedIn
    ? [
        {
          label: t('electron.menu.servers'),
          submenu: [
            ...(servers.length >= 2 ? [...serverMenuItems, { type: 'separator' as const }] : []),
            {
              label: t('electron.menu.add-new'),
              click: () => sendMenuAction(mainWindow, 'server.add'),
            },
          ],
        },
      ]
    : []),
  {
    label: t('electron.menu.help'),
    submenu: [
      {
        label: t('electron.menu.check-for-updates'),
        click: () => sendMenuAction(mainWindow, 'help.checkForUpdates'),
      },
      { type: 'separator' },
      {
        label: t('electron.menu.about'),
        click: () => sendMenuAction(mainWindow, 'help.about'),
      },
    ],
  },
  ...(isDev
    ? [
        {
          label: 'Debug',
          submenu: [
            {
              label: 'Open DevTools',
              accelerator: 'F12',
              click: () => getMainWindow()?.webContents.openDevTools({ mode: 'detach' }),
            },
            { type: 'separator' as const },
            {
              label: 'Show a Notification',
              submenu: [
                {
                  label: 'Notification from Renderer',
                  click: () => sendMenuAction(mainWindow, 'debug.notification'),
                },
                {
                  label: 'Notification from Main',
                  click: () => notify('Notification Test', 'A notification from the Main process'),
                },
              ],
            },
            {
              label: 'Show a toast',
              submenu: [
                {
                  label: 'Primary',
                  click: () => sendMenuAction(mainWindow, 'debug.toast.primary'),
                },
                {
                  label: 'Secondary',
                  click: () => sendMenuAction(mainWindow, 'debug.toast.secondary'),
                },
                {
                  label: 'Success',
                  click: () => sendMenuAction(mainWindow, 'debug.toast.success'),
                },
                {
                  label: 'Danger',
                  click: () => sendMenuAction(mainWindow, 'debug.toast.danger'),
                },
                {
                  label: 'Warning',
                  click: () => sendMenuAction(mainWindow, 'debug.toast.warning'),
                },
                { label: 'Info', click: () => sendMenuAction(mainWindow, 'debug.toast.info') },
                { label: 'Light', click: () => sendMenuAction(mainWindow, 'debug.toast.light') },
                { label: 'Dark', click: () => sendMenuAction(mainWindow, 'debug.toast.dark') },
                {
                  label: 'Adaptive',
                  click: () => sendMenuAction(mainWindow, 'debug.toast.adaptive'),
                },
                { type: 'separator' as const },
                {
                  label: 'Random',
                  accelerator: 'Ctrl+.',
                  click: () => sendMenuAction(mainWindow, 'debug.toast.random'),
                },
                {
                  label: 'One of each',
                  click: () => sendMenuAction(mainWindow, 'debug.toast.all'),
                },
              ],
            },
            { type: 'separator' as const },
            {
              label: 'Reload',
              accelerator: 'Ctrl+R',
              click: () => sendMenuAction(mainWindow, 'debug.reload'),
            },
          ],
        },
      ]
    : []),
];
```

Note: Debug menu labels are intentionally left in English — they only appear in dev mode and don't need translation.

- [ ] **Step 3: Build the electron package to check for TypeScript errors**

```bash
npm run build:electron
```

Expected: exits with code 0, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add packages/electron/src/menu.ts
git commit -m "#64: use translated labels in Electron menu"
```

---

## Task 11: Wire the language change IPC — shared types, preload, Angular

**Files:**

- Modify: `packages/shared/src/ipc.types.ts`
- Modify: `packages/electron/src/preload.ts`
- Modify: `packages/app/src/app/app.ts`

- [ ] **Step 1: Add `i18n` namespace to `BitButlerAPI` in `packages/shared/src/ipc.types.ts`**

Add this property to the `BitButlerAPI` interface after the `settings` block:

```typescript
  i18n: {
    languageChanged(lang: string): void;
  };
```

- [ ] **Step 2: Add `i18n` namespace to `packages/electron/src/preload.ts`**

Add this block to the `api` object after `settings`:

```typescript
  i18n: {
    languageChanged: (lang) => ipcRenderer.send('i18n:language-changed', { lang }),
  },
```

- [ ] **Step 3: Notify Electron on language change in `packages/app/src/app/app.ts`**

Find the existing `translateService.onLangChange` subscription in `ngOnInit()`:

```typescript
this.translateService.onLangChange
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe((event: LangChangeEvent) => this.setTimeagoLanguage(event.lang));
```

Replace it with:

```typescript
this.translateService.onLangChange
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe((event: LangChangeEvent) => {
    this.setTimeagoLanguage(event.lang);
    window.bitbutler.i18n.languageChanged(event.lang);
  });
```

- [ ] **Step 4: Add `extraResources` entry to electron-builder config in root `package.json`**

In root `package.json`, find the `"build"` → `"extraResources"` key. Currently it only has the icon entry:

```json
"extraResources": [
  {
    "from": "packages/app/src/assets/icons/bitbutler.png",
    "to": "bitbutler.png"
  }
]
```

Add the i18n entry:

```json
"extraResources": [
  {
    "from": "packages/app/src/assets/icons/bitbutler.png",
    "to": "bitbutler.png"
  },
  {
    "from": "public/i18n",
    "to": "i18n"
  }
]
```

- [ ] **Step 5: Run lint**

```bash
npm run lint
```

Expected: exits with code 0.

- [ ] **Step 6: Run tests**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 7: Final commit**

```bash
git add packages/shared/src/ipc.types.ts packages/electron/src/preload.ts packages/app/src/app/app.ts package.json
git commit -m "#64: wire language change IPC — preload, Angular, electron-builder"
```

---

## Verification Checklist

After all tasks are complete:

- [ ] `npm run lint` — zero warnings, zero errors
- [ ] `npm run build` — Angular build succeeds, output in `dist/bitbutler/browser/`
- [ ] `npm run test` — all tests pass (Angular + Electron)
- [ ] `npm start` — app launches, menu shows English labels
- [ ] Change language to Hungarian in Settings → Save → menu labels switch to Hungarian
- [ ] Change back to English → menu labels switch back
