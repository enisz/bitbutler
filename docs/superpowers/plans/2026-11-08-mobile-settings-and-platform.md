# Mobile Settings Page and Platform Flag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an app platform flag (`desktop` | `mobile`) that decides which UI and settings exist, a header with only menu, search and settings, and a mobile-only settings area with a List page (compact, sort).

**Architecture:** A synchronous `AppPlatform` value (Electron preload from `BB_WINDOW_MODE`, build-time environment for the Capacitor build) is read by a `PlatformService`. `ViewportService.layout` reports `phone` on mobile regardless of width, so the existing phone UI follows platform. The mobile settings page reuses `SettingsPage`/`SettingsShell` with a second config chosen by route data, plus action rows that reuse the menu actions. Route guards keep each platform on its own settings routes.

**Tech Stack:** Angular 22 (zoneless, signals), Vitest via the Angular builder, Electron preload/IPC, `@bitbutler/shared` types.

**Spec:** `docs/superpowers/specs/2026-11-08-mobile-settings-and-platform-design.md` (builds on the 2026-11-05 responsive UI spec and handoff).

## Global Constraints

- Use `-` (hyphen), never an em dash, in code, i18n, commits and docs.
- NO git commits, branches, stashes or checkouts: the owner runs this as a local experiment; leave all changes in the working tree.
- Angular only calls `window.bitbutler.*`; new state uses signals; user actions go through the command bus.
- Every new i18n key goes into both `packages/app/public/i18n/us.json` and `hu.json`.
- `npm run lint` must pass with zero warnings; run `npx prettier --write` on touched paths first.
- Toasts follow the CLAUDE.md rules (Title Case title, message is only the variable detail); skip toasts for results visible in the UI.
- Desktop behaviour is unchanged; mobile preferences never write desktop settings (`compactRows` in `TorrentListGridSettingsService` is not touched by mobile).
- Mobile sort keys, in order: Date added (default, descending), Name, Size, Progress, Download speed, Upload speed, Ratio, Last activity.
- Not on mobile: qBittorrent settings, Startup, Path mappings, Torrent list grid, Status bar, Notifications panes; no Manage servers/tags/categories entries; no Check for updates or Open logs folder.
- Tests: `cd packages/app && npx ng test --watch=false --include=<spec path>`; Electron: `npx vitest run packages/electron/src/<spec>` from the repo root.

## Review Focus

- Desktop platform opens a mobile settings deep link (`/pages/mobile-settings/list`): redirected to `/pages/settings`, never rendered.
- Mobile platform opens `/pages/settings/startup` or `/pages/qb-settings/*`: redirected to the mobile settings route.
- Desktop `compactRows` is `true` and mobile starts for the first time: mobile compact is `false`; toggling it leaves `compactRows` untouched.
- Stored mobile sort key is invalid or from the old key set (`eta`, `state`): falls back to `added_on` descending, no crash.
- `window.bitbutler` or its platform field is missing (tests, first paint, Capacitor before the shell): platform defaults to `desktop`, nothing throws.

---

### Task 1: Baseline (git work skipped by the owner)

No issue, branch or commits: the experiment stays uncommitted in the working tree.

- [ ] **Step 1:** Run `npm run lint` and `npm test`; record any failures that exist before this plan's changes.

### Task 2: Platform value (shared type, preload, environment, service)

**Files:**

- Modify: `packages/shared/src/ipc.types.ts`, `packages/electron/src/preload.ts`, `packages/electron/src/ipc/electron.ts`, `packages/electron/src/preload.spec.ts`
- Create: `packages/app/src/environments/environment.ts`, `packages/app/src/environments/environment.mobile.ts`, `packages/app/src/app/services/platform.service.ts`, `packages/app/src/app/services/platform.service.spec.ts`
- Modify: `packages/app/angular.json` (a `mobile` build configuration with `fileReplacements` for the environment file)

**Interfaces:**

- Produces: `export type AppPlatform = 'desktop' | 'mobile'` in `@bitbutler/shared`; `BitButlerAPI.appPlatform: AppPlatform` (a plain value, not a promise); `PlatformService` with `readonly platform: AppPlatform`, `readonly isMobile: boolean`, `readonly isDesktop: boolean`, `readonly settingsPath: '/pages/mobile-settings' | '/pages/settings'`.

- [ ] **Step 1: Write failing tests.** `platform.service.spec.ts`: `defaults to desktop when window.bitbutler is undefined`, `reads mobile from window.bitbutler.appPlatform`, `falls back to the environment value when the preload value is absent`, `settingsPath is /pages/mobile-settings on mobile and /pages/settings on desktop`. `preload.spec.ts`: `exposes appPlatform from the main process synchronously` (mock `ipcRenderer.sendSync` returning `'mobile'`).
- [ ] **Step 2:** Run both specs; expect FAIL (symbols missing).
- [ ] **Step 3:** In `ipc/electron.ts` add `ipcMain.on('electron:get-app-platform', (e) => { e.returnValue = getWindowMode() === 'desktop' ? 'desktop' : 'mobile'; })` (reuse `getWindowMode` from `main-window.ts`; packaged builds already return `desktop`). In `preload.ts` expose `appPlatform: ipcRenderer.sendSync('electron:get-app-platform')`. Add the field to `BitButlerAPI`.
- [ ] **Step 4:** Implement `PlatformService` (`providedIn: 'root'`) reading `window.bitbutler?.appPlatform ?? environment.appPlatform`; `environment.ts` has `appPlatform: 'desktop'`, `environment.mobile.ts` has `'mobile'`; wire the `mobile` configuration in `angular.json`.
- [ ] **Step 5:** Run the specs; expect PASS. Run `npm run build` and `npx ng build --configuration mobile` (from `packages/app`); both succeed.

### Task 3: Layout follows platform

**Files:**

- Modify: `packages/app/src/app/services/viewport.service.ts`, `packages/app/src/app/services/viewport.service.spec.ts`

**Interfaces:**

- Consumes: `PlatformService.isMobile`.
- Produces: `ViewportService.layout` returns `'phone'` whenever the platform is mobile, otherwise the width-based value as today. `isPhone`, `isTablet`, `isDesktop` stay and follow `layout`, so no call site changes.

- [ ] **Step 1: Write failing tests** in `viewport.service.spec.ts`: `layout is phone on mobile platform at desktop width`, `layout is phone on mobile platform at tablet width`, `isDesktop is false on mobile platform`, `desktop platform keeps width-based layout` (provide a stub `PlatformService`).
- [ ] **Step 2:** Run the spec; expect FAIL.
- [ ] **Step 3:** Inject `PlatformService` in `ViewportService` and short-circuit `layout`.
- [ ] **Step 4:** Run `viewport.service.spec.ts`, `app.spec.ts`, `main.spec.ts`; expect PASS (`app.ts` already writes `data-layout` from `layout()`).

### Task 4: Mobile list settings and phone list state

**Files:**

- Create: `packages/app/src/app/models/mobile-list-settings.model.ts`, `packages/app/src/app/services/mobile-list-settings.service.ts` (+ `.spec.ts`)
- Modify: `packages/app/src/app/pages/main/phone/phone-list-state.service.ts` and its spec

**Interfaces:**

- Produces: `PhoneSortKey = 'added_on' | 'name' | 'size' | 'progress' | 'dlspeed' | 'upspeed' | 'ratio' | 'last_activity'`; `export const PHONE_SORT_KEYS: readonly PhoneSortKey[]` in that order; `MobileListSettings { compactRows: boolean; sortKey: PhoneSortKey; sortDesc: boolean }` with `DEFAULT_MOBILE_LIST_SETTINGS = { compactRows: false, sortKey: 'added_on', sortDesc: true }`; `MobileListSettingsService extends BaseSettingsService<MobileListSettings>` with `SETTINGS_ID = 'MobileListSettingsService'`, `normalize` replacing an unknown `sortKey` with the default key and direction.
- `PhoneListStateService` keeps `items`, `sortKey`, `sortDesc`, `compact`, `setSort(key: PhoneSortKey): Promise<void>`, `setCompact(value: boolean): Promise<void>`, now backed by `MobileListSettingsService`; it no longer injects `TorrentListGridSettingsService`.

- [ ] **Step 1: Write failing tests.**
  - Service spec: `defaults are compact false, added_on, descending`; `an unknown stored sortKey falls back to the default`; `compact is independent of TorrentListGridSettings` (grid `compactRows: true` leaves mobile `false`).
  - State spec: `setSort on the active key flips the direction`; `setSort to name starts ascending`; `setSort to size, progress, dlspeed, upspeed, ratio, last_activity or added_on starts descending`; `setCompact persists via MobileListSettingsService and never saves grid settings`; `items sorts by last_activity descending`; keep the existing tie-break test (equal values ordered by hash).
- [ ] **Step 2:** Run both specs; expect FAIL.
- [ ] **Step 3:** Implement the model, service and rewritten state service. Use one module-level `Intl.Collator` for name sorting (handoff minor).
- [ ] **Step 4:** Run both specs; expect PASS.

### Task 5: Header with menu, search and settings only

**Files:**

- Modify: `packages/app/src/app/pages/main/phone/phone-main/phone-main.{html,ts,spec.ts}`, `phone-main.scss`, `packages/app/src/app/services/ui-command-handler.service.ts` (+ spec), `packages/app/public/i18n/{us,hu}.json`

**Interfaces:**

- Consumes: `PlatformService.settingsPath`.
- Produces: `PhoneMain.openSettings(): void` navigating to `PlatformService.settingsPath`; the `UI_OPEN_SETTINGS` handler navigates to the same path.

- [ ] **Step 1: Write failing tests.** `phone-main.spec.ts`: `header has the menu, search and settings buttons only` (no `phone-sort`, no `density-toggle`); `settings button navigates to /pages/mobile-settings on mobile`; `settings button navigates to /pages/settings on desktop platform`. `ui-command-handler.service.spec.ts`: `UI_OPEN_SETTINGS goes to the platform settings path`.
- [ ] **Step 2:** Run the specs; expect FAIL.
- [ ] **Step 3:** Remove the sort button, density toggle, sort bottom sheet and their code (`sortKeys`, `pickSort`, `toggleCompact`, `sortSheetOpen`, unused icons) from `PhoneMain`; add a `data-testid="phone-settings"` icon button using `pages.main.phone.settings` (new aria-label key); delete now-unused `pages.main.phone.sort.*`, `density` keys. Update `UI_OPEN_SETTINGS`.
- [ ] **Step 4:** Run the specs plus `app.spec.ts`; expect PASS.

### Task 6: Platform route guards and mobile settings route

**Files:**

- Create: `packages/app/src/app/guards/platform.guard.ts` (+ `.spec.ts`)
- Modify: `packages/app/src/app/app.routes.ts`

**Interfaces:**

- Produces: `platformGuard(required: AppPlatform): CanActivateFn`; when `PlatformService.platform !== required` it returns a `UrlTree`: for `required = 'desktop'` on mobile `/pages/mobile-settings`, for `required = 'mobile'` on desktop `/pages/settings`.
- Routes: `pages/settings`, `pages/settings/:pane`, `pages/qb-settings`, `pages/qb-settings/:pane` get `canActivate: [platformGuard('desktop')]`. New `pages/mobile-settings` (redirects to `mobile-settings/list`) and `pages/mobile-settings/:pane` with `canActivate: [platformGuard('mobile')]`, `canDeactivate: [unsavedChangesGuard]`, `data: { settings: 'mobile' }`, loading `SettingsPage`.

- [ ] **Step 1: Write failing tests** in `platform.guard.spec.ts`: `desktop guard allows desktop`, `desktop guard redirects mobile to /pages/mobile-settings`, `mobile guard allows mobile`, `mobile guard redirects desktop to /pages/settings`.
- [ ] **Step 2:** Run the spec; expect FAIL.
- [ ] **Step 3:** Implement the guard and routes.
- [ ] **Step 4:** Run the spec; expect PASS.

### Task 7: Settings shell action rows and menu action reuse

**Files:**

- Modify: `packages/app/src/app/pages/settings-shell/settings-shell.model.ts`, `settings-shell.{ts,html,scss,spec.ts}`, `packages/app/src/app/services/menu-bar-command-handler.service.ts` (+ spec)

**Interfaces:**

- Produces: `SettingsActionDef { id: string; labelKey: string; icon: IconDefinition; danger?: boolean; menuAction: string }`; `SettingsNavGroup.actions?: SettingsActionDef[]`; `SettingsShell` output `actionRun = output<SettingsActionDef>()`, rendered as rows in the phone pane list (after the pane rows of that group, `danger` styled, a divider before a group that has only actions); `MenuBarCommandHandlerService.runAction(action: string): void` containing the existing `file.*`, `help.about` switch cases, called by the `clicks$` subscription so behaviour is unchanged.

- [ ] **Step 1: Write failing tests.** Shell spec: `phone list renders action rows`, `clicking an action row emits actionRun with its def`, `desktop sidebar does not render action rows`. Handler spec: `runAction('file.exportTorrents') emits UI_EXPORT_TORRENTS`, `runAction('file.disconnect') emits UI_DISCONNECT`, `runAction('file.quit') emits UI_QUIT`, `runAction('help.about') emits UI_OPEN_ABOUT`, plus the existing menu-click tests still pass.
- [ ] **Step 2:** Run the specs; expect FAIL.
- [ ] **Step 3:** Extract `runAction` and add the shell inputs and template.
- [ ] **Step 4:** Run both specs; expect PASS.

### Task 8: Mobile settings page

**Files:**

- Create: `packages/app/src/app/pages/settings/mobile-list/mobile-list.{ts,html,scss,spec.ts}`, `packages/app/src/app/pages/settings/mobile-settings-page.config.ts`
- Modify: `packages/app/src/app/pages/settings/settings-page.{ts,html,spec.ts}`, `settings.interface.ts`, `packages/app/public/i18n/{us,hu}.json`

**Interfaces:**

- Consumes: `MobileListSettingsService`/`PhoneListStateService` (Task 4), `SettingsActionDef` and `actionRun` (Task 7), `MenuBarCommandHandlerService.runAction`, the `data: { settings: 'mobile' }` route flag (Task 6).
- Produces: `MOBILE_SETTINGS_BASE_PATH = '/pages/mobile-settings'`; `MOBILE_SETTINGS_PAGE_CONFIG: SettingsPageConfig` with panes `list` (new `MobileList`, `formId: 'mobile-list'`), `general`, `appearance`, `polling` (existing components, same `formId`s as in `SETTINGS_PAGE_CONFIG`), and action groups: Data (`file.importTorrents`, `file.exportTorrents`, `file.importConfiguration`, `file.exportConfiguration`), Help (`help.about`), Session (`file.disconnect`, `file.quit`, `danger: true` on quit). `SettingsPage` picks the config, base path and valid pane ids from `route.snapshot.data['settings']` (`'mobile'` or default) and derives valid ids from `config.groups` instead of `SETTINGS_PANE_IDS`; on `actionRun` it calls `runAction(def.menuAction)`.

- [ ] **Step 1: Write failing tests.**
  - `mobile-list.spec.ts`: `shows the eight sort keys in order` (assert the `PHONE_SORT_KEYS` order in the rendered rows); `the active key shows the direction caret and others do not`; `tapping the active key flips the caret direction`; `tapping another key moves the caret and starts name ascending, others descending`; `the compact switch reflects and updates mobile compact only`.
  - `settings-page.spec.ts`: `mobile route data selects the mobile config`; `mobile pane list contains list, general, appearance and polling and none of startup, path-mappings, torrent-list-grid, status-bar, notifications`; `an unknown :pane on the mobile route lands on list`; `actionRun file.quit calls runAction('file.quit')`; existing desktop tests still pass.
- [ ] **Step 2:** Run the specs; expect FAIL.
- [ ] **Step 3:** Implement `MobileList` (applies changes immediately, never dirty, no Save bar entry needed), the config, and the `SettingsPage` generalization. Add i18n keys under `pages.mobile-settings.*` (title, group labels, pane labels and descriptions, action labels) in both languages.
- [ ] **Step 4:** Run both specs, then the full app suite; expect PASS.

### Task 9: Verification

- [ ] **Step 1:** `npx prettier --write` on touched paths, `npm run lint` (0 warnings), `npm test`, `npm run build`, and `npx ng build --configuration mobile` from `packages/app`; all pass (an existing `ipc/export.spec.ts` timeout flake may need one rerun).
- [ ] **Step 2:** Run `npm run start:phone` and `npm run start:tablet`: header shows menu, search, settings; settings opens the mobile page; List page sorts and toggles compact; Data, Help and Session rows open the right dialogs; Disconnect returns to login. Run `npm run start:desktop` and shrink the window below 768px: phone-style layout, settings button opens `/pages/settings`, and pasting `/pages/mobile-settings/list` redirects. Report what was and was not checked by eye.
