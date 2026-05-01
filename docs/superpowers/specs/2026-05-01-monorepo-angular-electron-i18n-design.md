# Design: Proper Angular Monorepo + Electron i18n

**Date:** 2026-05-01  
**Branch:** 64-migrate-to-monorepo  
**Scope:** Two related changes — move Angular into a proper `packages/app` workspace member, and add translation support to the Electron main process.

---

## 1. Monorepo Restructuring

### Problem

`angular.json` lives at the repo root with `"root": ""`, treating the entire repository as the Angular project root. TypeScript configs (`tsconfig.app.json`, `tsconfig.spec.json`) also live at root with hardcoded `packages/app/src/**` paths. This is a leftover from before the monorepo migration — the Angular app was never fully moved into its package.

### Goal

`packages/app` becomes a self-contained Angular workspace. Running `ng` from inside `packages/app` works without any root-level Angular config. The root remains a plain npm workspaces coordinator.

### Files Created in `packages/app/`

| File                 | Purpose                                                           |
| -------------------- | ----------------------------------------------------------------- |
| `angular.json`       | Angular workspace config, `root: ""` relative to `packages/app`   |
| `tsconfig.json`      | Extends `../../tsconfig.json`, adds `angularCompilerOptions`      |
| `tsconfig.app.json`  | Extends `./tsconfig.json`, includes `src/**/*.ts`, excludes specs |
| `tsconfig.spec.json` | Extends `./tsconfig.json`, includes spec/test/setup files         |

### Key Path Decisions (`packages/app/angular.json`)

| Config key                      | Value                            | Notes                                               |
| ------------------------------- | -------------------------------- | --------------------------------------------------- |
| `root`                          | `""`                             | Relative to `packages/app`                          |
| `sourceRoot`                    | `"src"`                          | `packages/app/src`                                  |
| `browser` entry                 | `"src/main.ts"`                  |                                                     |
| Assets                          | `"../../public"`, `"src/assets"` | `public/` stays at repo root (shared with Electron) |
| Styles                          | `"src/styles.scss"`              |                                                     |
| Output path                     | `"../../dist/bitbutler"`         | Keeps electron-builder config unchanged             |
| Style preprocessor includePaths | `["../../node_modules"]`         | Hoisted node_modules                                |
| tsConfig (build)                | `"tsconfig.app.json"`            |                                                     |
| tsConfig (test)                 | `"tsconfig.spec.json"`           |                                                     |
| Test setupFiles                 | `["src/test-setup.ts"]`          |                                                     |
| Test providersFile              | `"src/test-providers.ts"`        |                                                     |

### Root Cleanup

- **Delete** `angular.json`
- **Delete** `tsconfig.app.json`
- **Delete** `tsconfig.spec.json`
- **Simplify** `tsconfig.json` — remove `references` array and `angularCompilerOptions` (both move into `packages/app/tsconfig.json`)

### `packages/app/package.json` — Add Scripts

```json
"scripts": {
  "serve": "ng serve",
  "build": "ng build",
  "test": "ng test --watch=false",
  "test:watch": "ng test"
}
```

### Root `package.json` — Update Scripts

| Script       | Before                  | After                                         |
| ------------ | ----------------------- | --------------------------------------------- |
| `serve`      | `ng serve`              | `npm run serve --workspace=packages/app`      |
| `build`      | `ng build`              | `npm run build --workspace=packages/app`      |
| `test`       | `ng test --watch=false` | `npm run test --workspace=packages/app`       |
| `test:watch` | `ng test`               | `npm run test:watch --workspace=packages/app` |

All other scripts (`start`, `build:ui`, `dist`, etc.) are unaffected.

---

## 2. Electron i18n

### Problem

`menu.ts` has ~15 hardcoded English label strings that are never translated regardless of the user's language setting. The Angular renderer translates before sending IPC payloads, but the menu is built entirely in the main process.

### Goal

The Electron main process reads the shared `public/i18n/` JSON files, resolves dot-path translation keys, and rebuilds the menu in the correct language on startup and on language change.

### New File: `packages/electron/src/i18n.ts`

A lightweight helper with no third-party dependencies:

```typescript
// Loads translations from disk for a given language code.
// Falls back to the key string if a translation is missing.
export function loadTranslations(lang: string): void;
export function t(key: string): string;
```

**File path resolution:**

| Mode                    | Path                                       |
| ----------------------- | ------------------------------------------ |
| Dev (`!app.isPackaged`) | `app.getAppPath()/public/i18n/<lang>.json` |
| Packaged                | `process.resourcesPath/i18n/<lang>.json`   |

### electron-builder `extraResources`

Add to the `build` config in root `package.json`:

```json
"extraResources": [
  { "from": "public/i18n", "to": "i18n" }
]
```

This ensures the i18n files are available at `process.resourcesPath/i18n/` in packaged builds. (They are also in the Angular output inside the asar, but `extraResources` gives Electron a consistent path in both modes.)

### Language Loading Sequence

1. **App start** — `main.ts` reads the current language from the settings DB (already available via the settings module) and calls `loadTranslations(lang)` before building the menu.
2. **Language change** — Angular sends a new IPC message `i18n:language-changed` with the new language code. Electron reloads translations and calls `rebuildMenu()`.

### New IPC Channel

| Channel                 | Direction       | Payload            | Response               |
| ----------------------- | --------------- | ------------------ | ---------------------- |
| `i18n:language-changed` | Renderer → Main | `{ lang: string }` | none (fire-and-forget) |

Registered in the appropriate IPC handler file, calls `loadTranslations(lang)` then `rebuildMenu()`.

### Angular Side

`GeneralSettingsService` already persists the language. When language changes, it additionally calls:

```typescript
window.bitbutler.i18n.languageChanged(lang);
```

A new `i18n` namespace is added to `preload.ts` exposing this single method.

### New Translation Keys

All new keys nested under `electron.menu.*` in `public/i18n/us.json` and `public/i18n/hu.json`:

```
electron.menu.file
electron.menu.file.add-torrent
electron.menu.file.settings
electron.menu.file.import-torrents
electron.menu.file.export-torrents
electron.menu.file.export-all
electron.menu.file.export-selected
electron.menu.file.disconnect
electron.menu.servers
electron.menu.servers.add-new
electron.menu.help
electron.menu.help.check-for-updates
electron.menu.help.about
```

### `menu.ts` Changes

Every `label: 'Literal string'` is replaced with `label: t('electron.menu.<key>')`. `rebuildMenu()` already fires on login state changes and server list changes, so translated labels will always reflect the current language.

---

## Verification

After implementation, the following must pass without changes:

1. `npm run lint` — zero warnings
2. `npm start` — Angular dev server starts, Electron launches, menu labels display in English
3. `npm run build:ui` — Angular production build succeeds, output lands in `dist/bitbutler/`
4. Change language to Hungarian in Settings — menu labels update to Hungarian
5. `npm run test` — all tests pass
