# Mobile and tablet support - handoff

Written 2026-11-05, extended 2026-11-08 (see section 12). Everything needed to continue this work in a new session or on another machine.
Read this first, then the spec and the plan it points to.

## 0. Read this first: nothing is committed

All work below exists **only as uncommitted changes in the working tree of the machine it was done on**
(branch `main`, last commit `c38ddb8`). It will not exist on another machine unless you move it:

- Simplest: create a feature branch (`<issue-id>-<summary>`, see CLAUDE.md), commit everything as WIP
  (`#<id>: wip responsive phone ui`) and push, then check it out on the other machine.
- Or copy the changed and new files (list in section 6), or `git diff` plus the untracked files.
- `.superpowers/` (ledger, brainstorm mockups) is git-ignored and will not travel. Everything useful
  from it is summarized in this file.
- `docs/superpowers/` (spec, plan, this handoff) is also uncommitted. Per CLAUDE.md these files may live on
  a feature branch but must be removed in their own commit (`#<id>: removed spec and plan`) before the PR.

The owner said this is an **experiment**: "not sure if we keep this". So a throwaway branch is fine.

Related documents:

- Spec (binding authority): `docs/superpowers/specs/2026-11-05-responsive-mobile-ui-design.md`
- Plan (12 tasks, all done): `docs/superpowers/plans/2026-11-05-responsive-mobile-ui.md`

## 1. The idea and the why

BitButler is an Electron desktop app for managing remote qBittorrent-nox servers (Angular 22 zoneless
renderer, Electron main process owns all qBittorrent logic, renderer talks only through `window.bitbutler.*`).
The owner wants Android and iOS versions, mainly for quick everyday tasks:

- check the torrent list, **search**, **add** torrents (mostly downloaded `.torrent` files, magnet links too),
  **delete**, **relocate** (change save path), manage **tags**.
- "Not a fully functional app, but the basics." Tablet should get everything the desktop has.
- The mobile app talks **directly to the qBittorrent server**, the same as the desktop app. No desktop
  BitButler in between.
- Owner has about **12,000 torrents**; performance with that many is a hard requirement.

The work was split into **two independent projects** (agreed order: UI first):

1. **Responsive UI** - done (experimental, uncommitted). Useful even without any mobile build.
2. **Mobile shell and transport** - not started. Detailed plan in section 8.

## 2. Decisions the owner made (binding)

- One responsive Angular app and one set of routes. NOT a separate mobile route or duplicated screens.
- Tablet gets the full desktop UI including AG Grid; it only needs touch support and sensible sizing.
- Phone torrent list: **cards with virtual scrolling** plus a **compact/dense toggle** (one-line rows),
  like the desktop grid's compact rows setting.
- Touch model: tap a card opens the torrent details; long-press enters multi-select; a bottom bar then shows
  **Start, Stop, Delete, More**. More opens the remaining desktop context-menu actions in a bottom sheet
  (owner suggested "dropup or modal"; sheet chosen).
- Details screen keeps **all tabs**; on phone peers and trackers become lists, not AG Grid.
- Add torrent: **always show all options** (no quick-add mode).
- Settings (app settings and qBittorrent preferences): **every pane available on phone**, as a drill-down
  (pane list, then the pane).
- Later the owner asked: remove the status filter "pills" under the search bar (states are filtered from the
  drawer instead), and add an X button on the right of the drawer header to close it. Both done.
- UI first, mobile backend later.
- Owner wants a way to start the app in phone, tablet or desktop mode: done (section 5).

Mockup choice (visual companion, now gone): three phone list styles were shown. Chosen: **A cards** (name,
state - percent, speeds, progress bar, size, ETA/ratio, "+" button) with **B dense rows** as the compact toggle.
Rejected: C swipe actions with bottom tab bar.

## 3. What was built (all under `packages/app/src/app/` unless noted)

Width classes, by viewport width only: phone `<= 767.98px`, tablet `768px-1199.98px`, desktop `>= 1200px`.
Touch behaviour is decided by `(pointer: coarse)`, independent of width.

| Area               | Files                                                                                            | Notes                                                                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------- |
| Breakpoints        | `services/viewport.service.ts`                                                                   | Signals `layout`, `isPhone`, `isTablet`, `isDesktop`, `isTouch`. `App` sets `<html data-layout>`; `styles.scss` uses `100dvh` and `.bb-safe-bottom` on phone.                                                             |
| Phone list state   | `pages/main/phone/phone-list-state.service.ts`                                                   | `items` = `FilterService.filtered()` sorted (hash tie-break), sort key/direction, density shared with the desktop `compactRows` setting. 12k torrents filter+sort measured ~5 ms.                                         |
| Long press         | `directives/long-press.ts`                                                                       | `bbLongPress`, 500 ms, 10 px move tolerance, swallows the following click, `bbLongPressEnabled` input.                                                                                                                    |
| Card list          | `pages/main/phone/torrent-card-list/*`                                                           | cdk virtual scroll, card 96 px / row 44 px, tap/long-press/select logic, prune effect that drops removed torrents from the selection, empty/no-match/loading messages.                                                    |
| Bottom sheet       | `components/bb-bottom-sheet/*`                                                                   | Generic.                                                                                                                                                                                                                  |
| Action bar + More  | `pages/main/phone/phone-action-bar/*`, `phone-more.utils.ts`                                     | Reuses `GridContextMenuService.buildTorrentMenu`; `buildPhoneMoreEntries` drops grid-only entries and puts `files.setSavePath` first.                                                                                     |
| Phone shell        | `pages/main/phone/phone-main/*`                                                                  | Top bar (menu, search, sort, density), list, FAB "+", selection header (count, select all, close), drawer (logo, name, server, X, `app-status` filters), sort sheet. `Main` swaps in `<app-phone-main>` when `isPhone()`. |
| Details            | `modals/torrent-details/peers/peers-list/*`, `trackers/trackers-list/*`, `peers.*`, `trackers.*` | Lists instead of AG Grid on phone.                                                                                                                                                                                        |
| Modals             | `app.ts`, `ui-command-handler.service.ts`, `login.ts`, `manage-servers.ts`                       | Superseded in section 12: `NgbModalConfig.scrollable = true` globally, and only the big modals opt in to `fullscreen: 'md'` per call. `styles.scss` makes modal tab strips scroll sideways on phone.                      |
| Settings           | `pages/settings-shell/*`                                                                         | `data-phone` list/pane views, back button, Save/Cancel bar stays visible in both views, panes stay mounted.                                                                                                               |
| Manage dialogs     | `components/bb-select-list/*`, `modals/manage-tags                                               | categories                                                                                                                                                                                                                | servers/\*` | Tap-to-select lists on phone sharing the same selection signals as the grids. |
| Tablet/touch       | `directives/touch-context-menu.ts`, `grid.html/.ts`, `main.ts`                                   | Long-press opens the context menu on the main grid (touch only); tablet sidebar starts collapsed, per-session toggle that never writes the saved desktop preference.                                                      |
| i18n               | `public/i18n/us.json`, `hu.json`                                                                 | New keys under `pages.main.phone.*` (list, state, actions, sort, selection, menu, search, add, density, close).                                                                                                           |
| Electron dev modes | `packages/electron/src/main-window.ts`, `main.ts`, root `package.json`, `scripts/start-mode.cjs` | See section 5.                                                                                                                                                                                                            |

Reviewed once by a fresh reviewer; three Important findings were fixed (stale selection after resize, mouse
click lost to long-press on desktop, Delete acting on filter-hidden selected torrents).

## 4. Rulings (deviations and judgment calls)

- ~~Fullscreen modals via one global `NgbModalConfig.fullscreen = 'md'`.~~ Replaced by per-call opt-in (section 12): small dialogs looked wrong full-screen.
- Selection pruning lives in `TorrentCardList` (phone only), not in `SelectionStoreService`.
- `PhoneMain.ngOnDestroy` clears the selection so a leftover selection never reaches the desktop grid.
- **Add torrent unchanged**: it already has general/options/limits/files tabs (files tab uses `bb-file-tree`),
  and the scrollable tab strip plus full-screen modal make it usable. The spec's "stacked sections" idea was
  NOT done. Restructure the template if you want it. The "Folder" input mode (local filesystem) is desktop only.
- Import Torrents has no phone entry point (phone shell has no toolbar). The Electron native menu is untouched.
- Tablet sidebar is a per-session toggle, never saves.
- Hover tooltips unchanged on touch (ng-bootstrap opens them after a tap).
- Long-press context menu only on the main torrent grid.
- Density is shared with the desktop `compactRows` setting (one setting for both).
- Bottom sheet code was written before its first test run (not watched RED); 5 tests cover it.
- Clipboard "offer pasted magnet link" was dropped (optional in the spec).

## 5. Developer commands

```
npm run start:phone     # fixed 390x640 content window  -> phone layout
npm run start:tablet    # fixed 900x640 content window  -> tablet layout
npm run start:desktop   # normal window, maximized
npm start               # same as desktop
```

- `scripts/start-mode.cjs <mode>` sets `BB_WINDOW_MODE` and runs `npm start` (no cross-env needed).
- `getWindowMode()` in `packages/electron/src/main-window.ts` reads it. Ignored in packaged builds.
  Sizes are in `FIXED_WINDOW_SIZES` there. `main.ts` only maximizes in desktop mode.
- Tests: `cd packages/app && npx ng test --watch=false [--include=<spec path>]` (Vitest via Angular builder).
  Electron: `npx vitest run packages/electron/src/main-window.spec.ts`. Full: `npm test`.
- Lint/format: `npm run lint` (0 warnings), Prettier via `npx prettier --write <paths>`.
- Last full verification: lint clean, prettier clean, app suite 197 files / 2921 tests, `npm run build` OK
  (re-run these on the new machine; a few later small edits were verified only with targeted specs).
  One unrelated electron test (`ipc/export.spec.ts`) failed once in a full run and passed on rerun (timeout flake).

## 6. Changed and new files (working tree vs `c38ddb8`)

Modified: `package.json`, `public/i18n/{us,hu}.json`, `app.ts`, `app.spec.ts`, `styles.scss`,
`modals/manage-{categories,servers,tags}/*` (html, ts, spec), `modals/torrent-details/{peers,trackers}/*`
(html, ts, spec), `pages/main/grid/grid.{html,ts}`, `pages/main/main.{html,ts,spec.ts}`,
`pages/settings-shell/*` (html, scss, ts, spec), `packages/electron/src/{main.ts,main-window.ts,main-window.spec.ts}`.

New: `components/bb-bottom-sheet/`, `components/bb-select-list/`, `directives/long-press*`,
`directives/touch-context-menu*`, `modals/torrent-details/peers/peers-list/`,
`modals/torrent-details/trackers/trackers-list/`, `pages/main/phone/` (list state, more utils,
torrent-card-list, phone-action-bar, phone-main), `services/viewport.service*`, `scripts/start-mode.cjs`,
`docs/superpowers/{specs,plans,handoff}/`.

## 7. Known gaps and deferred items

Not verified visually in a real window on the final code except what the owner reported and approved
("looks pretty good"). Still to check by eye: dark and light themes at phone width, settings drill-down,
add-torrent screen, tablet width with touch emulation.

Deferred minors from the review:

- Seeding cards show an infinity symbol instead of the ratio (qBittorrent reports ETA 8640000 for seeding).
  Fix: show the ratio when ETA is infinite or the torrent is complete.
- Name/state sort builds a collator per comparison; create one `Intl.Collator` (matters at 12k torrents).
  Default sort (date added) is numeric and fast.
- Accessibility: cards are `div`s with `(click)` and no role/tabindex; drawer has no dialog role or Escape;
  search input has only a placeholder (no aria-label); bottom sheet has no focus trap.
- A pending debounced save in manage-\*/peers/trackers dialogs could hit a destroyed AG Grid API if the window
  is resized across the breakpoint while the dialog is open (unverified).
- Rows can still move under a finger when sorting by speed/progress (order is deterministic but live).

Other observations:

- The first status pill ("All") was scrolled off-screen in one screenshot (pills are now removed).
- DEV badge (`app.html`) is back to the original; it overlays the top-left corner in dev and can cover the
  hamburger button visually. The drawer now shows the BitButler logo (the phone view otherwise had no logo).

## 8. Project 2: mobile shell and transport (NOT started)

Goal: run this Angular app on Android and iOS and talk to qBittorrent directly. The renderer only knows
`window.bitbutler.*` (typed in `packages/shared/src/ipc.types.ts`, `qb.types.ts`), so mobile means writing a
second implementation of `BitButlerAPI` plus the pieces the Electron main process provides today.

### Framework choice

**Capacitor** (Ionic team) is the recommended wrapper: web app in a native WebView, Angular friendly, plugin
ecosystem. It does NOT provide a Node backend. Alternatives considered:

- **nodejs-mobile** (as a Capacitor/Cordova plugin): real Node on the phone, could reuse main-process code
  nearly as is. But `better-sqlite3` needs cross-compiling per ABI, large app size, fragile builds. Avoid
  unless zero refactoring is paramount.
- **Tauri 2 (mobile)**: any web frontend, but backend is Rust, so the whole backend would be rewritten.
- NativeScript / React Native: would mean rewriting the UI. Rejected.

### What the Electron main process does today and its mobile replacement

| Electron main process                                                                                                                         | Mobile replacement                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/electron/src/qb/` (bridge, endpoints, version handling, re-login, error mapping), `poller.ts` (sync cursor, backoff, 2 min give-up) | Same TypeScript running in the WebView with an **injected HTTP transport** (`CapacitorHttp`), shared by Electron and mobile via a platform-neutral package |
| `ipc/qbittorrent.ts` session (cookie jar, login/logout, low-level request)                                                                    | Native HTTP with cookie handling in the transport; verify cookies work across requests                                                                     |
| `better-sqlite3` (`servers`, `settings` tables) in `db.ts`                                                                                    | `@capacitor-community/sqlite`                                                                                                                              |
| `safeStorage` encrypted server passwords                                                                                                      | Keychain/Keystore plugin (for example `capacitor-secure-storage`)                                                                                          |
| Tray, native menus, window controls, notifications, auto-update                                                                               | Drop, or use local-notifications plugin                                                                                                                    |

### Suggested steps

1. Extract the qB client + poller into a platform-neutral workspace package that takes a transport
   (also benefits the Electron app). `QbService` in the renderer is already a thin wrapper that unwraps
   `IpcResult<T>` and throws `QbError`; `QbPollingService` consumes pushed `QbPollEvent`s - keep those contracts.
2. Add `packages/mobile` (Capacitor) implementing `BitButlerAPI` (`qb`, `server`, `settings`, `window`,
   `electron`, `notification`, `torrent`, `config`) with mobile stubs for the desktop-only namespaces.
3. Android first, then iOS (iOS needs a Mac and an Apple developer account, 99 USD per year).
4. Native file/link handling: open `.torrent` files and `magnet:` links from other apps (Android intent filters,
   iOS document types and URL schemes). The add screen already handles drafts via `OpenFilesService`.

### Risks and platform issues

- **Self-signed certificates and plain HTTP** are common for qBittorrent. iOS App Transport Security and
  Android cleartext traffic rules need explicit configuration; design a per-server "allow insecure" option.
- **CORS**: a plain WebView hitting qBittorrent would be blocked; native HTTP avoids it.
- **Background polling**: iOS/Android suspend apps. Polling only works in the foreground (the poller already
  runs only while the torrent list page is open). "Download finished" push needs a server-side component.
- qBittorrent session cookie handling over native HTTP, and re-login on 403, must be tested against real servers.
- Folder-based "import torrents" and local-path features (open destination) are desktop-only.
- Safe-area insets, dynamic viewport (`dvh`), and soft keyboard behaviour need real-device testing
  (the CSS groundwork `.bb-safe-bottom` and `100dvh` is in place).

## 9. Repo conventions to follow (from CLAUDE.md and the owner's memory)

- Use `-` (hyphen), never an em dash, in all written output, commits and docs.
- Branch: `<issue-id>-<dash-separated-summary>`. Commit: `#IssueID: short description`.
- PR: read `.github/pull_request_template.md` first and follow it exactly; description includes `Fixes #IssueID`;
  title is a clean description without the issue id; **no Claude or attribution text in PR/issue descriptions**
  (owner feedback: nothing appended after the template).
- Issues: use a template from `.github/ISSUE_TEMPLATE/`; pass `--label` explicitly with `gh issue create`.
- Labels are applied by a workflow; do not add them manually.
- Toasts: Title Case title describing the outcome, message is only the variable detail; skip toasts for
  results already visible in the UI.
- New state uses signals; user actions go through the command bus; Angular only calls `window.bitbutler.*`.
- Specs and plans under `docs/superpowers/` may be committed on the feature branch but must be removed in their
  own commit before opening or merging the PR; never link them in PR/issue text.
- Squash-merge default message `<PR title> (#<PR number>)`.

## 10. Practical gotchas learned (save yourself the time)

- jsdom has no layout, so cdk virtual scroll renders no items in tests. The card list is tested through its
  methods and the message states; verify card markup by eye.
- An effect that writes the signal it reads loops forever (this hung the first card-list spec); read the
  written signal with `untracked`.
- In tests, translations are not loaded: templates show keys, so assert on state/signals, not translated text.
- Specs that click router links need `provideRouter([{ path: '**', component: ... }])` to avoid NG04002 noise.
- AG Grid "error #200" lines in test output are pre-existing noise (modules not registered in the test env).
- On Windows with Git Bash, `node -e` receives `C:/...` style paths only when built with `cygpath -m`; and
  backticks inside `node -e "..."` get eaten by the shell. Write patch scripts to a file instead.
- `npm run lint` enforces Prettier; run `npx prettier --write` on touched dirs before linting.

## 11. If continuing the UI work, good next steps

1. Look at it in a real window in all three modes (`start:phone`, `start:tablet`, `start:desktop`) and all themes.
2. Fix the deferred minors in section 7 (ratio for seeding, collator, accessibility) - small and test-first.
3. Decide whether to keep the experiment. If yes: open an issue, create the branch, commit in logical chunks,
   remove `docs/superpowers` in its own commit before the PR, and consider whether the `start:*` scripts and
   `BB_WINDOW_MODE` dev helper should stay (they are dev-only and small).
4. Then start project 2 (section 8), beginning with the transport extraction, which is useful on its own.

## 12. Follow-up session 2026-11-07: fixes found in the phone window

The owner ran `npm run start:phone` and reported four problems on the login screen and its modals. All four
are fixed (uncommitted, like the rest). Lint is clean; the menu, app, toast and ui-command-handler specs
pass. These were not re-checked by eye in a window after the change, so look at them first.

### 12.1 Modal footer unreachable, body not scrolling (server editor)

- Symptom: in the full-screen server editor the Add/Cancel footer was below the window and the body would
  not scroll; only Tab reached the button.
- Cause: ng-bootstrap only wraps the modal component in a flex column when the modal is opened with
  `scrollable: true`. The server editor was opened without it, so the component host element sat between
  `.modal-content` and `.modal-body` and the body never got a bounded height.
- Fix: `NgbModalConfig.scrollable = true` for all modals (`app.ts`). Header and footer stay in view, the body
  scrolls. This also helps short desktop windows. The test in `app.spec.ts` now asserts `scrollable`.

### 12.2 Small dialogs were full-screen (delete confirmation)

- Symptom: the delete-server confirmation filled the screen, with no border and the buttons stuck at the
  bottom.
- Fix: the global `fullscreen = 'md'` was removed. Full-screen is now passed per call
  (`fullscreen: 'md'`) for the big modals only: server editor (all four open sites), add torrent, torrent
  details (both sites), manage servers / tags / categories (including the login page's manage servers),
  export torrents, import torrents, import configuration.
- Everything else (confirm, delete, rename, set path, transfer and share limit, set tags, set category,
  about, update available, torrent exists, export configuration, credential prompt, category and tag
  editors) stays a centered card. On phone `styles.scss` gives those a `--bs-modal-margin` of 1rem so the
  border is visible.
- Open question for the owner: set tags and set category are cards now; they can be made full-screen if
  the lists feel cramped.
- Files: `app.ts`, `services/ui-command-handler.service.ts`, `pages/login/login.ts`,
  `modals/manage-servers/manage-servers.ts`, `styles.scss`.

### 12.3 No Electron menu in phone and tablet dev modes

- `rebuildMenu()` in `packages/electron/src/menu.ts` calls `Menu.setApplicationMenu(null)` and returns when
  `getWindowMode()` is `phone` or `tablet`, because a real phone or tablet build has no application menu.
  Desktop and packaged builds are unchanged (`getWindowMode()` is always `desktop` when packaged).
- `menu.spec.ts` mocks `./main-window.js` and has a new test for both modes.
- Tray and accelerators are not affected by this change.

### 12.4 Toasts on phone

- Proposal, implemented: at the phone width (<= 767.98px) toasts span the full width with a 12 px gutter on
  each side, anchored at the top below `env(safe-area-inset-top)`. The corner setting
  (`notifications.app.position`) is ignored on phone. Top was chosen because the bottom would cover the
  selection action bar and the "+" button. Tablet keeps the corner stack.
- `ToastService` injects `ViewportService` and re-applies the position strategy from an `effect` on
  `isPhone()`, so crossing the breakpoint switches live. `styles.scss` stretches `.bb-toast-container` and
  removes the `min-width` and `max-width` of `.bb-toast` under `:root[data-layout='phone']`.
- Not done: swipe to dismiss (an easy follow-up). `.bb-toast-overlay-pane` in `styles.scss` is a leftover
  class that nothing applies.

### 12.5 Other changed files in this session

`services/toast.service.ts`, `app.ts`, `app.spec.ts`, `styles.scss`, `services/ui-command-handler.service.ts`,
`pages/login/login.ts`, `modals/manage-servers/manage-servers.ts`, `packages/electron/src/menu.ts`,
`packages/electron/src/menu.spec.ts`. Nothing was committed.

### 12.6 Design export zips (side task)

The owner wanted material for Claude Design. Zips were written to the session scratchpad, so they are not in
the repo and will be gone with it:

- all `.css` / `.scss` files (135 files, paths from the repo root),
- the `app-bb-logo` component folder,
- every `.ts`, `.html` and `.scss` file under `packages/app/src/app`, specs excluded (430 files).

Regenerate with `git ls-files -co --exclude-standard -- '<glob>'` piped into `zip -@` so untracked phone
files are included and `node_modules` is skipped. The styles zip predates the `styles.scss` edits of this
session.

### 12.7 How the logo is tinted (reference)

`app-bb-logo` is one inline SVG (`components/bb-logo/bb-logo.html`, 512x512 viewBox). The accent shapes use
`fill="currentColor"`; the character keeps fixed fills (`#F8ECD4`, `#140A06`, `#030201`). `bb-logo.scss`
sets `:host { color: var(--bb-accent) }`, so each theme's `--bb-accent` tints it. The optional `family`
input pins it to `FAMILY_ACCENT_COLORS[family]` (`theme.service.ts`) via an inline `style.color`, which the
login theme picker uses. Inputs: `size` (default 190), `family`. Used at 190 / 180 (login), 40 (sidebar),
26 (settings header), 36 (phone drawer), 60 (About), 20 (theme picker). The files in `readme/` are only for
`README.md`; the tray, notifications and favicon use `public/bitbutler.png` and `bitbutler.ico`.
