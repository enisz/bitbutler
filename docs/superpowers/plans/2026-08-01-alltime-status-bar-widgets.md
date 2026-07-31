# All-time Status Bar Widgets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three opt-in status bar widgets - `alltime-down`, `alltime-up`, `alltime-ratio` - that lead with the all-time (global) downloaded/uploaded/ratio value and show the current session's value in the tooltip, mirroring the existing `global-down`/`global-up`/`ratio` widgets (which do the reverse).

**Architecture:** Purely additive changes to the existing `ServerState` component (`packages/app/src/app/pages/main/server-state/`) and the status bar widget-picker settings (`packages/app/src/app/modals/settings/status-bar/status-bar.ts`, `packages/app/src/app/models/status-bar-settings.model.ts`), plus new translation keys. No new files, no new signals, no IPC changes - every data point the new widgets need (`allTimeDl()`, `allTimeUl()`, `globalRatio()`, `sessionRatio()`, and the raw `state()` input's `dl_info_data`/`up_info_data`) already exists on `ServerState`.

**Tech Stack:** Angular 20 (zoneless, standalone components, signals), `@ngx-translate/core`, `ng-bootstrap` tooltips, Vitest (`@angular/build:unit-test` runner).

## Global Constraints

- Use `-` (hyphen) instead of `—` (em dash) in all written output, including code comments/strings.
- Commit format: `#251: short description` (this work is tracked under issue #251, branch `251-alltime-status-bar-widgets`, already checked out).
- `npm run lint` must pass with zero warnings (`max-warnings=0`).
- New widgets are opt-in only: added to `DEFAULT_STATUS_BAR_SETTINGS.available`, NOT to `left`/`right` - no existing user-visible default layout changes.
- Reuse existing icons (`faCloudDownloadAlt`, `faCloudUploadAlt`, `faShareAlt`) and existing signals - do not add new signals to `ServerState`.
- Translation keys must be added to both `public/i18n/us.json` and `public/i18n/hu.json`.

---

## Task 1: Add translation keys

**Files:**

- Modify: `public/i18n/us.json:1424` (insert after), `public/i18n/us.json:1651` (insert after)
- Modify: `public/i18n/hu.json:1424` (insert after), `public/i18n/hu.json:1651` (insert after)

**Interfaces:**

- Produces: translation keys `pages.main.server-state.session`, `pages.settings.tab.status-bar.widget.alltime-down`, `pages.settings.tab.status-bar.widget.alltime-up`, `pages.settings.tab.status-bar.widget.alltime-ratio` - consumed by Task 2 (tooltip templates) and Task 3 (`MASTER_WIDGET_KEYS`).

- [ ] **Step 1: Add the `session` tooltip-value key to `us.json`**

In `public/i18n/us.json`, inside the `pages.main.server-state` object, the current content around line 1424 reads:

```json
        "global-ratio": "Global Ratio",
        "all-time": "All-time: {{value}}",
        "total-downloaded": "Total Downloaded",
```

Insert a new `session` key directly after `all-time`:

```json
        "global-ratio": "Global Ratio",
        "all-time": "All-time: {{value}}",
        "session": "Session: {{value}}",
        "total-downloaded": "Total Downloaded",
```

- [ ] **Step 2: Add the three widget-picker labels to `us.json`**

In the same file, inside `pages.settings.tab.status-bar.widget`, the current content around line 1649-1651 reads:

```json
            "ratio": "Share Ratio",
            "global-down": "Global Downloaded",
            "global-up": "Global Uploaded",
```

Replace it with:

```json
            "ratio": "Share Ratio",
            "alltime-ratio": "All-time Ratio",
            "global-down": "Global Downloaded",
            "alltime-down": "All-time Downloaded",
            "global-up": "Global Uploaded",
            "alltime-up": "All-time Uploaded",
```

- [ ] **Step 3: Mirror both changes in `hu.json`**

In `public/i18n/hu.json`, inside `pages.main.server-state` (around line 1424):

```json
        "global-ratio": "Globális arány",
        "all-time": "Összesített: {{value}}",
        "total-downloaded": "Összes letöltés",
```

becomes:

```json
        "global-ratio": "Globális arány",
        "all-time": "Összesített: {{value}}",
        "session": "Munkamenet: {{value}}",
        "total-downloaded": "Összes letöltés",
```

And inside `pages.settings.tab.status-bar.widget` (around line 1649-1651):

```json
            "ratio": "Megosztási arány",
            "global-down": "Globális letöltés",
            "global-up": "Globális feltöltés",
```

becomes:

```json
            "ratio": "Megosztási arány",
            "alltime-ratio": "Összesített arány",
            "global-down": "Globális letöltés",
            "alltime-down": "Összesített letöltés",
            "global-up": "Globális feltöltés",
            "alltime-up": "Összesített feltöltés",
```

- [ ] **Step 4: Validate JSON syntax**

Run:

```bash
node -e "JSON.parse(require('fs').readFileSync('public/i18n/us.json', 'utf8')); JSON.parse(require('fs').readFileSync('public/i18n/hu.json', 'utf8')); console.log('OK')"
```

Expected: `OK` (no `SyntaxError` thrown).

- [ ] **Step 5: Commit**

```bash
git add public/i18n/us.json public/i18n/hu.json
git commit -m "#251: add translation keys for all-time status bar widgets"
```

---

## Task 2: Add the three widget cases and tooltips to `ServerState`

**Files:**

- Modify: `packages/app/src/app/pages/main/server-state/server-state.ts:64-68` (ViewChild declarations)
- Modify: `packages/app/src/app/pages/main/server-state/server-state.html:61-88` (new `@case` blocks), `:177-208` (new `ng-template` tooltips)
- Test: `packages/app/src/app/pages/main/server-state/server-state.spec.ts` (regression only - no new component logic is added, so no new unit tests are required; the compiler's template type-checking against the `@ViewChild` names is the correctness check for this task)

**Interfaces:**

- Consumes: `allTimeDl()`, `allTimeUl()`, `globalRatio()`, `sessionRatio()` (existing signals on `ServerState`), `state()` (existing input), `icons.faCloudDownloadAlt`, `icons.faCloudUploadAlt`, `icons.faShareAlt` (existing), `setGlobalShareLimit()` (existing method).
- Produces: three new widget ids consumable by the `#widgetRegistry` switch and by Task 3's `MASTER_WIDGET_KEYS`: `'alltime-down'`, `'alltime-up'`, `'alltime-ratio'`.

- [ ] **Step 1: Add the three new `@ViewChild` template refs**

In `packages/app/src/app/pages/main/server-state/server-state.ts`, the current lines 64-68 read:

```typescript
  @ViewChild('tipRatioGlobal') tipRatioGlobal!: TemplateRef<any>;
  @ViewChild('tipGlobalDl') tipGlobalDl!: TemplateRef<any>;
  @ViewChild('tipGlobalUl') tipGlobalUl!: TemplateRef<any>;
  @ViewChild('tipLiveDl') tipLiveDl!: TemplateRef<any>;
  @ViewChild('tipLiveUl') tipLiveUl!: TemplateRef<any>;
```

Change to:

```typescript
  @ViewChild('tipRatioGlobal') tipRatioGlobal!: TemplateRef<any>;
  @ViewChild('tipGlobalDl') tipGlobalDl!: TemplateRef<any>;
  @ViewChild('tipGlobalUl') tipGlobalUl!: TemplateRef<any>;
  @ViewChild('tipLiveDl') tipLiveDl!: TemplateRef<any>;
  @ViewChild('tipLiveUl') tipLiveUl!: TemplateRef<any>;
  @ViewChild('tipAlltimeRatio') tipAlltimeRatio!: TemplateRef<any>;
  @ViewChild('tipAlltimeDl') tipAlltimeDl!: TemplateRef<any>;
  @ViewChild('tipAlltimeUl') tipAlltimeUl!: TemplateRef<any>;
```

- [ ] **Step 2: Add the `alltime-ratio` widget case**

In `packages/app/src/app/pages/main/server-state/server-state.html`, the `@case ('ratio')` block currently ends at line 72:

```html
@case ('ratio') {
<div
  class="bb-widget cursor-pointer"
  [ngbTooltip]="tipRatioGlobal"
  placement="top"
  container="body"
  (click)="setGlobalShareLimit()"
>
  <fa-icon [icon]="icons.faShareAlt" class="text-secondary opacity-75"></fa-icon>
  <span class="bb-value">{{ sessionRatio() }}</span>
</div>
}
```

Insert a new case immediately after it (before `@case ('global-down')`):

```html
@case ('alltime-ratio') {
<div
  class="bb-widget cursor-pointer"
  [ngbTooltip]="tipAlltimeRatio"
  placement="top"
  container="body"
  (click)="setGlobalShareLimit()"
>
  <fa-icon [icon]="icons.faShareAlt" class="text-secondary opacity-75"></fa-icon>
  <span class="bb-value">{{ globalRatio() }}</span>
</div>
}
```

- [ ] **Step 3: Add the `alltime-down` widget case**

The `@case ('global-down')` block currently reads:

```html
@case ('global-down') {
<div class="bb-widget" [ngbTooltip]="tipGlobalDl" placement="top" container="body">
  <fa-icon [icon]="icons.faCloudDownloadAlt" class="icon-dl opacity-75"></fa-icon>
  <span class="bb-value bb-fixed-num bb-width-size"
    >{{ state()?.dl_info_data ?? 0 | fileSize }}</span
  >
</div>
}
```

Insert a new case immediately after it (before `@case ('global-up')`):

```html
@case ('alltime-down') {
<div class="bb-widget" [ngbTooltip]="tipAlltimeDl" placement="top" container="body">
  <fa-icon [icon]="icons.faCloudDownloadAlt" class="icon-dl opacity-75"></fa-icon>
  <span class="bb-value bb-fixed-num bb-width-size">{{ allTimeDl() | fileSize }}</span>
</div>
}
```

- [ ] **Step 4: Add the `alltime-up` widget case**

The `@case ('global-up')` block currently reads:

```html
@case ('global-up') {
<div class="bb-widget" [ngbTooltip]="tipGlobalUl" placement="top" container="body">
  <fa-icon [icon]="icons.faCloudUploadAlt" class="icon-ul opacity-75"></fa-icon>
  <span class="bb-value bb-fixed-num bb-width-size"
    >{{ state()?.up_info_data ?? 0 | fileSize }}</span
  >
</div>
}
```

Insert a new case immediately after it (before `@case ('download-speed')`):

```html
@case ('alltime-up') {
<div class="bb-widget" [ngbTooltip]="tipAlltimeUl" placement="top" container="body">
  <fa-icon [icon]="icons.faCloudUploadAlt" class="icon-ul opacity-75"></fa-icon>
  <span class="bb-value bb-fixed-num bb-width-size">{{ allTimeUl() | fileSize }}</span>
</div>
}
```

- [ ] **Step 5: Add the three new tooltip templates**

The existing tooltip templates at the bottom of the file currently read (lines 177-192 shown; `tipLiveDl`/`tipLiveUl` follow after):

```html
<ng-template #tipConnection>{{ 'pages.main.server-state.network-status' | translate }}</ng-template>
<ng-template #tipRatioGlobal>
  {{ 'pages.main.server-state.global-ratio' | translate }}<br /><span class="opacity-75"
    >{{ 'pages.main.server-state.all-time' | translate: { value: globalRatio() } }}</span
  >
</ng-template>
<ng-template #tipGlobalDl>
  {{ 'pages.main.server-state.total-downloaded' | translate }}<br /><span class="opacity-75"
    >{{ 'pages.main.server-state.all-time' | translate: { value: (allTimeDl() | fileSize) } }}</span
  >
</ng-template>
<ng-template #tipGlobalUl>
  {{ 'pages.main.server-state.total-uploaded' | translate }}<br /><span class="opacity-75"
    >{{ 'pages.main.server-state.all-time' | translate: { value: (allTimeUl() | fileSize) } }}</span
  >
</ng-template>
```

Insert three new templates immediately after `tipGlobalUl` (before `tipLiveDl`):

```html
<ng-template #tipAlltimeRatio>
  {{ 'pages.main.server-state.global-ratio' | translate }}<br /><span class="opacity-75"
    >{{ 'pages.main.server-state.session' | translate: { value: sessionRatio() } }}</span
  >
</ng-template>
<ng-template #tipAlltimeDl>
  {{ 'pages.main.server-state.total-downloaded' | translate }}<br /><span class="opacity-75"
    >{{ 'pages.main.server-state.session' | translate: { value: (state()?.dl_info_data ?? 0 |
    fileSize) } }}</span
  >
</ng-template>
<ng-template #tipAlltimeUl>
  {{ 'pages.main.server-state.total-uploaded' | translate }}<br /><span class="opacity-75"
    >{{ 'pages.main.server-state.session' | translate: { value: (state()?.up_info_data ?? 0 |
    fileSize) } }}</span
  >
</ng-template>
```

- [ ] **Step 6: Run the existing regression suite**

Run:

```bash
cd packages/app && npx ng test --watch=false
```

Expected: all existing `server-state.spec.ts` tests still PASS (no new logic was added, this confirms nothing broke).

- [ ] **Step 7: Build to catch template errors**

Run:

```bash
npm run build
```

Expected: build succeeds with no Angular template type-check errors (a typo'd `[ngbTooltip]` binding name or missing `@ViewChild` would fail here).

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/app/pages/main/server-state/server-state.ts packages/app/src/app/pages/main/server-state/server-state.html
git commit -m "#251: add all-time downloaded/uploaded/ratio widget markup"
```

---

## Task 3: Register the new widgets in the status bar settings

**Files:**

- Modify: `packages/app/src/app/modals/settings/status-bar/status-bar.ts:41-53` (`MASTER_WIDGET_KEYS`)
- Modify: `packages/app/src/app/models/status-bar-settings.model.ts:7-11` (`DEFAULT_STATUS_BAR_SETTINGS`)
- Test: `packages/app/src/app/services/status-bar-settings.service.spec.ts` (existing test already asserts full equality against `DEFAULT_STATUS_BAR_SETTINGS`, so it automatically covers the new ids)

**Interfaces:**

- Consumes: widget ids `'alltime-down'`, `'alltime-up'`, `'alltime-ratio'` from Task 2, and the `pages.settings.tab.status-bar.widget.alltime-*` translation keys from Task 1.
- Produces: the three ids become selectable in the "Status Bar" settings tab's widget pool.

- [ ] **Step 1: Add the new ids to `MASTER_WIDGET_KEYS`**

In `packages/app/src/app/modals/settings/status-bar/status-bar.ts`, the current array (lines 41-53) reads:

```typescript
  private readonly MASTER_WIDGET_KEYS = [
    'connection-status',
    'nodes',
    'ratio',
    'global-down',
    'global-up',
    'download-speed',
    'upload-speed',
    'free-space',
    'session-stats',
    'selection',
    'polling-indicator',
  ];
```

Change to:

```typescript
  private readonly MASTER_WIDGET_KEYS = [
    'connection-status',
    'nodes',
    'ratio',
    'alltime-ratio',
    'global-down',
    'alltime-down',
    'global-up',
    'alltime-up',
    'download-speed',
    'upload-speed',
    'free-space',
    'session-stats',
    'selection',
    'polling-indicator',
  ];
```

- [ ] **Step 2: Add the new ids to the default `available` pool**

In `packages/app/src/app/models/status-bar-settings.model.ts`, the current default (lines 7-11) reads:

```typescript
export const DEFAULT_STATUS_BAR_SETTINGS: StatusBarSettings = {
  available: ['selection'],
  left: ['connection-status', 'nodes', 'ratio', 'global-down', 'global-up'],
  right: ['download-speed', 'upload-speed', 'free-space', 'polling-indicator'],
};
```

Change to:

```typescript
export const DEFAULT_STATUS_BAR_SETTINGS: StatusBarSettings = {
  available: ['selection', 'alltime-down', 'alltime-up', 'alltime-ratio'],
  left: ['connection-status', 'nodes', 'ratio', 'global-down', 'global-up'],
  right: ['download-speed', 'upload-speed', 'free-space', 'polling-indicator'],
};
```

- [ ] **Step 3: Run the status bar settings test suite**

Run:

```bash
cd packages/app && npx ng test --watch=false
```

Expected: `status-bar-settings.service.spec.ts` PASSES (`should return default settings when nothing is stored` now compares against the updated `DEFAULT_STATUS_BAR_SETTINGS` constant automatically), and `status-bar.spec.ts` still PASSES unchanged.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/modals/settings/status-bar/status-bar.ts packages/app/src/app/models/status-bar-settings.model.ts
git commit -m "#251: register all-time widgets in status bar settings"
```

---

## Task 4: Manual verification and full CI-equivalent check

**Files:** none (verification only)

**Interfaces:** N/A

- [ ] **Step 1: Run the full workspace test suite**

Run:

```bash
npm test
```

Expected: all workspaces PASS, zero failures.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: zero errors, zero warnings (project enforces `max-warnings=0`).

- [ ] **Step 3: Start the app and verify visually**

Run:

```bash
npm start
```

In the running app:

1. Open Settings -> Status Bar tab.
2. Confirm three new entries appear in the "Widget Pool": "All-time Downloaded", "All-time Uploaded", "All-time Ratio".
3. Drag all three into the left or right bar and save.
4. Back on the main torrent grid, confirm each new widget shows the all-time value as its main value.
5. Hover each: `alltime-down`/`alltime-up` tooltips should show "Total Downloaded"/"Total Uploaded" with "Session: <value>" underneath; `alltime-ratio` tooltip should show "Global Ratio" with "Session: <value>" underneath.
6. Click the `alltime-ratio` widget and confirm it opens the same global share-limit modal that clicking the existing `ratio` widget opens.
7. Switch the app language to Hungarian (Settings -> General) and repeat steps 2 and 5 to confirm the Hungarian labels/tooltips render correctly.

- [ ] **Step 4: Update the widget pool default for existing local settings (optional, dev-only)**

If your local status bar settings were saved before this change and the new widgets don't appear in the pool, reset the Status Bar settings tab to defaults (or clear the `StatusBarSettingsService` entry from local storage) to pick up the new `DEFAULT_STATUS_BAR_SETTINGS.available` list. This is expected per the spec's "Existing users" section and needs no code change.

- [ ] **Step 5: Remove the spec/plan docs and open the PR**

Per this repo's convention, `docs/superpowers/specs/` and `docs/superpowers/plans/` must not be merged to main:

```bash
git rm -r docs
git commit -m "#251: removed spec and plan"
```

Then follow the `.github/pull_request_template.md` structure to open the PR (title: a clean description, no issue id; body must include `Fixes #251`).
