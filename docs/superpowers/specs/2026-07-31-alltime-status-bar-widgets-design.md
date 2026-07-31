# All-time Downloaded / Uploaded / Ratio status bar widgets

## Problem

The status bar's `global-down`, `global-up`, and `ratio` widgets show the current **session's**
transfer totals / ratio as their main value, with the **all-time** (global) figure tucked into the
tooltip. There is no widget that leads with the all-time figure. Users who care primarily about
lifetime totals have to hover every time.

## Goal

Add three new opt-in status bar widgets that mirror the existing session-first widgets but with
the values swapped:

- `alltime-down` - main value: all-time downloaded. Tooltip: session downloaded.
- `alltime-up` - main value: all-time uploaded. Tooltip: session uploaded.
- `alltime-ratio` - main value: all-time (global) ratio. Tooltip: session ratio.

## Non-goals

- No changes to the existing `global-down` / `global-up` / `ratio` widgets.
- No migration of existing users' saved status-bar settings (see "Existing users" below).
- No new IPC/backend data - `qBittorrent` maindata already carries everything needed
  (`alltime_dl`, `alltime_ul`, `global_ratio`, `dl_info_data`, `up_info_data`), and it's already
  polled into `packages/app/src/app/pages/main/server-state/server-state.ts`.

## Design

### No changes to `server-state.ts`

All values the new widgets need are already available as existing signals/inputs on `ServerState`:

- Main values reuse the existing tooltip signals: `allTimeDl()`, `allTimeUl()`, `globalRatio()`.
- Tooltip (session) values reuse the existing pattern already used by `global-down`/`global-up`,
  which read straight off the raw `state()` input rather than a dedicated signal:
  `state()?.dl_info_data`, `state()?.up_info_data`. `alltime-ratio`'s tooltip reuses the existing
  `sessionRatio()` signal (already computed for the `ratio` widget).

No new signals, no changes to the `effect()` in the constructor, no changes to `reset()`.

### `server-state.html`

Add three `@case` blocks to the `#widgetRegistry` template, styled identically to their session
counterparts (same `bb-widget` classes, same icons - `faCloudDownloadAlt`, `faCloudUploadAlt`,
`faShareAlt` - reused per user decision, not new icons):

```
@case ('alltime-down') {
  <div class="bb-widget" [ngbTooltip]="tipAlltimeDl" placement="top" container="body">
    <fa-icon [icon]="icons.faCloudDownloadAlt" class="icon-dl opacity-75"></fa-icon>
    <span class="bb-value bb-fixed-num bb-width-size">{{ allTimeDl() | fileSize }}</span>
  </div>
}
@case ('alltime-up') {
  <div class="bb-widget" [ngbTooltip]="tipAlltimeUl" placement="top" container="body">
    <fa-icon [icon]="icons.faCloudUploadAlt" class="icon-ul opacity-75"></fa-icon>
    <span class="bb-value bb-fixed-num bb-width-size">{{ allTimeUl() | fileSize }}</span>
  </div>
}
@case ('alltime-ratio') {
  <div class="bb-widget cursor-pointer" [ngbTooltip]="tipAlltimeRatio" placement="top"
       container="body" (click)="setGlobalShareLimit()">
    <fa-icon [icon]="icons.faShareAlt" class="text-secondary opacity-75"></fa-icon>
    <span class="bb-value">{{ globalRatio() }}</span>
  </div>
}
```

`alltime-ratio` is clickable (opens the global share-limit modal via the existing
`setGlobalShareLimit()`), mirroring `ratio`. `alltime-down`/`alltime-up` are not clickable,
mirroring `global-down`/`global-up`.

New tooltip `ng-template`s reuse the existing tooltip **title** keys (`total-downloaded`,
`total-uploaded`, `global-ratio`) - same title as their session-first counterparts, since it's the
same concept just framed the other direction - paired with a new `session` value key mirroring the
existing `all-time` key:

```html
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
<ng-template #tipAlltimeRatio>
  {{ 'pages.main.server-state.global-ratio' | translate }}<br /><span class="opacity-75"
    >{{ 'pages.main.server-state.session' | translate: { value: sessionRatio() } }}</span
  >
</ng-template>
```

`ViewChild` references for the three new templates are added to `server-state.ts` (structural
boilerplate only, same as the five existing `@ViewChild('tip...')` lines - no behavioral change).

### Widget registration (`status-bar.ts`, `status-bar-settings.model.ts`)

- `MASTER_WIDGET_KEYS` in `status-bar.ts` gets `'alltime-down'`, `'alltime-up'`,
  `'alltime-ratio'` appended, so they get translated labels and appear in the settings modal's
  widget picker.
- `DEFAULT_STATUS_BAR_SETTINGS.available` in `status-bar-settings.model.ts` gets the same three
  ids appended (joining `'selection'`), so **new installs** see them in the "available" pool,
  ready to be dragged into the left/right bar. They are not added to `left`/`right` by default -
  existing status bar layouts are unaffected.

### Existing users

`available`/`left`/`right` are persisted per-user (via `StatusBarSettingsService` /
`BaseSettingsService`). Existing users who already have a saved status-bar config will not see the
three new widgets in their pool until they reset status-bar settings to defaults - there is no
precedent in this codebase for merging newly-added widget ids into a previously-saved
configuration, and this feature does not introduce one.

### i18n

New keys in both `public/i18n/us.json` and `public/i18n/hu.json`:

- `pages.main.server-state.session` - `"Session: {{value}}"` (en) / `"Munkamenet: {{value}}"` (hu)
  - mirrors the existing `pages.main.server-state.all-time` key.
- `pages.settings.tab.status-bar.widget.alltime-down` - `"All-time Downloaded"` (en) /
  `"Összesített letöltés"` (hu)
- `pages.settings.tab.status-bar.widget.alltime-up` - `"All-time Uploaded"` (en) /
  `"Összesített feltöltés"` (hu)
- `pages.settings.tab.status-bar.widget.alltime-ratio` - `"All-time Ratio"` (en) /
  `"Összesített arány"` (hu)

No changes to existing keys.

### Testing

Extend existing spec files following their current patterns:

- `server-state.spec.ts` - assert the three new `@ViewChild` tooltip templates render with correct
  values for a given `state()` input (mirrors existing tests for `tipGlobalDl`/`tipGlobalUl`/
  `tipRatioGlobal`).
- `status-bar.spec.ts` / `status-bar-settings.service.spec.ts` - assert the three new ids appear
  in `MASTER_WIDGET_KEYS` / default `available` and are correctly translated and mapped to
  `Widget` objects, mirroring existing coverage for `selection`.

No new component, service, or model files are introduced.
