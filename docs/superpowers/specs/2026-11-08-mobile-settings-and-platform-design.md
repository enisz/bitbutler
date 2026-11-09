# Mobile settings page and platform flag - design

Date: 2026-11-08. Builds on `2026-11-05-responsive-mobile-ui-design.md` and the handoff in `docs/superpowers/handoff/`.
That work (experimental, uncommitted) added a phone UI that is chosen by viewport width. This design replaces
"width decides which UI" with "platform decides which UI" and adds a mobile-only settings area.

## Why

There is no Electron menu on mobile, so the actions that live in the desktop File/Settings menus need a new
home. The phone is for basics (look at the list, search, add, delete, relocate, tags), so it should get a small,
purpose-built settings area, not the full desktop settings squeezed onto a small screen. Because the mobile
settings differ from the desktop ones, the app must know whether it runs on mobile or desktop independent of
window width, otherwise shrinking a desktop window would swap the settings for a different set.

## Decisions (the owner's)

### Platform vs layout

- Two independent values. **Layout** (`phone`/`tablet`/`desktop`, by width, as today in `ViewportService`) only
  affects how things look. **Platform** (`desktop` or `mobile`) is fixed for the whole run and decides which UI
  and which settings exist.
- On `mobile`, phone and tablet use the **same UI**: the phone card list, header, mobile settings. Tablets do
  not get the AG Grid desktop UI on mobile.
- The platform value comes from Capacitor/build configuration (a build-time environment value for the mobile
  build), so the mobile shell defines what users see.
- Dev: `npm run start:phone` and `npm run start:tablet` (Electron, `BB_WINDOW_MODE`) must report platform
  `mobile` to the renderer so the mobile UI can be tested on a PC. `start:desktop` and `npm start` report
  `desktop`. Ignored in packaged builds, as `BB_WINDOW_MODE` is today.

### Header (mobile)

- Only: menu button, search bar, settings button. The sort button and the compact toggle are removed from the
  header. The "+" add button stays at the bottom right.
- The settings button navigates to a separate route (not a drawer).

### Left drawer (mobile)

- Unchanged: status filters plus tag, category and tracker groups with their manage buttons on the group headers.
  All filtering lives here. There is no column filtering on mobile.
- No "filter is active" indicator above the list (owner decided it is not needed).
- Managing servers is done on the login screen; tags and categories via the drawer group headers. There are no
  separate manage entries on mobile.

### Mobile settings page

A new lazy route, separate from `pages/settings/:pane` and `pages/qb-settings/:pane`, drill-down style (list of
entries, then the entry), reusing the existing settings shell drill-down behaviour where it fits.

Entries:

- **List** (own sub-page): the compact-rows switch and the sort selection.
  - Compact is a **mobile-only setting**, stored separately from the desktop `compactRows` grid setting. Changing
    it on mobile never touches the desktop setting (today the phone list shares `compactRows`; that sharing is
    removed).
  - Sort keys: Date added (default, descending), Name, Size, Progress, Download speed, Upload speed, Ratio, Last
    activity. The active key shows a caret on the right giving the direction. Tapping the active key flips the
    direction; tapping another key makes it active and moves the caret.
  - Default sort is date added, newest on top.
- **General, Appearance, Polling**: the existing panes, reused where they work on a small screen (builder to
  verify).
- **Import / Export**: torrents and configuration (four actions).
- **About.**
- **Disconnect** and **Quit**, visually separated at the bottom.

### Not on mobile

qBittorrent settings, and the app settings panes Startup, Path mappings, Torrent list grid and Status bar. No
Manage servers/tags/categories entries. No Check for updates or Open logs folder (my call, see below).

## Goals

- A phone/tablet user can reach every action they need without the desktop menus.
- Mobile preferences cannot affect desktop preferences and vice versa.
- Platform is a single source of truth the rest of the app reads; no component decides "mobile" by itself.
- Desktop behaviour is unchanged.

## Non-goals and anti-goals

- Not the Capacitor shell, transport or native plugins (project 2 in the handoff).
- Not a full settings parity with desktop on mobile.
- Anti-goal: shrinking a desktop window must never show the mobile settings page or the mobile-only List
  settings.
- Anti-goal: a mobile-only toggle silently changing a desktop setting.

## My calls (owner has not confirmed these)

- Switching sort to Name starts ascending (A-Z); switching to Date added goes to newest first. Other keys start
  descending (largest/fastest first).
- The mobile List settings (compact, sort) persist across sessions in the existing settings store under their own
  key (alternative: reset each session).
- A narrow window on **desktop** platform keeps the existing width-driven phone-style layout (card list, the
  settings drill-down) but uses the **desktop** settings routes. Only the mobile platform shows the mobile
  settings page.
- Notifications pane: not included on mobile for now (mobile notifications will differ); revisit with the shell.
- "Check for updates" and "Open logs folder" are left out (updates come from the app stores).
- Live-reordering rows while sorting by speed or progress is accepted as a known limitation.

## Clarifications from the builder check

- **Navigation and guards (my call):** the settings button goes to the mobile route when platform is `mobile`
  and to the existing desktop settings route when platform is `desktop`, whatever the width. Route guards redirect
  on a mismatch (mobile platform hitting `pages/settings/*` or `pages/qb-settings/*`, desktop platform hitting the
  mobile route), so the anti-goal holds under deep links. The plan needs a task for the guard.
- **Reused panes:** the General pane has no desktop-only fields (it covers delete torrent file, input type,
  language, date format, first day of week), so it is reused whole. Appearance and Polling are reused as they
  are, subject to the builder checking them for desktop-only fields. The per-pane Save, discard and restore
  defaults behaviour from #390 applies unchanged.
- **Import / Export, Disconnect, Quit:** these already exist as menu actions (`file.exportTorrents`,
  `file.importTorrents`, `file.exportConfiguration`, `file.importConfiguration`, `file.disconnect`, `file.quit`)
  that the renderer handles. The mobile rows trigger the same actions, so this is UI only. The backing logic stays
  in the Electron main process; a mobile backend for it belongs to the shell project and is out of scope here. In
  `start:phone` and `start:tablet`, Quit really quits and Disconnect logs out and returns to login. On iOS the
  Quit row is omitted once the shell exists (my call; iOS apps do not quit themselves).
- **Platform plumbing (my call):** two sources, read synchronously before the app bootstraps so guards and the
  first render never wait on it. Electron reports it through the preload value derived from `BB_WINDOW_MODE`
  (`phone` and `tablet` give `mobile`, otherwise `desktop`). The Capacitor build sets a build-time environment
  value. The Electron value takes precedence when present.
- **Sort state:** the new sort replaces the phone card list's current sort button and its state in
  `PhoneListStateService`; only the mobile card list uses it. The desktop grid's own sort is untouched.
- **Baseline:** build on the current uncommitted phone work (viewport service, card list, settings shell
  drill-down). The plan should start by committing it to a feature branch as a baseline. On the mobile platform
  the phone UI is chosen by platform, not width, so the width checks that currently pick it change.
- **Migration:** mobile compact starts at its own default; the old shared `compactRows` value is not copied.

## Constraints (from the repo)

- Angular only talks to `window.bitbutler.*`; the platform value reaches the renderer through that contract
  (shared types in `packages/shared`) or a build-time environment value, not by Node/Electron access.
- Signals for new state, user actions through the command bus, toast rules in CLAUDE.md, i18n keys in both
  `us.json` and `hu.json`, lint with zero warnings.
- Specs/plans under `docs/superpowers/` stay on the feature branch and are removed in their own commit before
  the PR.

## Left to the builder

- Exact mechanism for the platform value (environment file vs shared API field) and its name.
- Route name, component structure and how much of `SettingsShell` is reused.
- Storage shape of the mobile settings, and which of General/Appearance/Polling reuse cleanly.
- How import/export dialogs are reached and presented on mobile.
- Visual design of the rows, caret and sections, following the existing theme tokens.
- Test strategy.
