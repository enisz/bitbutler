# Responsive UI for phone and tablet - design

## Intent and why

BitButler is an Electron desktop app for managing remote qBittorrent-nox instances. The owner wants to eventually run it on Android and iOS, and to use it from a phone or tablet for quick everyday tasks: checking the torrent list, searching, adding torrents, deleting them, relocating them (changing the save path), and managing tags.

The eventual mobile app will talk to qBittorrent directly (no desktop BitButler in between), exactly like the desktop app does. That requires moving the qBittorrent client and poller out of the Electron main process into something that can run on a phone. **That is a separate, later project and is out of scope here.**

This project is the **responsive UI only**. It is built and tested inside the existing Electron app by resizing the window, against the real Electron backend. It must be a worthwhile improvement on its own, without any mobile build existing.

## Scope

A single Angular app and a single set of routes. The UI adapts to three width classes (phone, tablet, desktop). A shared breakpoint signal selects which presentation a component renders. Desktop behaviour must not regress.

### Width classes

- **Desktop:** the current UI, unchanged.
- **Tablet:** the full desktop feature set, including the AG Grid torrent list. It needs to work with touch and at tablet widths (sidebar collapsed by default, touch alternatives to hover and right-click).
- **Phone:** the presentations described below.

Exact breakpoint pixel values are left to the builder (the login page already uses 991.98px and 767.98px; reuse or align with those where sensible).

### Phone presentations

**Main shell.** The sidebar (status, category and tag filters) becomes a drawer opened from a hamburger button. The toolbar is reduced to a top bar with the drawer button, a search field, and a sort control. A "+" button adds a torrent. A status filter chip row sits under the top bar.

**Torrent list.**

- Cards (name, state, progress bar, speeds, size, ETA, ratio) replace the AG Grid.
- Virtual scrolling, using `@angular/cdk` (already a dependency, already used in `bb-file-tree`). The owner has about 12,000 torrents, so rendering and filtering/sorting cost must be measured early.
- A compact toggle switches to a dense one-line row layout (state dot, name, percentage), mirroring the existing compact-rows setting of the desktop grid. Each density has a fixed item height.
- Data comes from `TorrentStoreService`; actions go through the existing command bus (`TORRENT_*` commands). No action logic is duplicated.
- Sorting needs a phone control, since the grid sorts via column headers.

**Touch model.**

- Tap a card: open the torrent details.
- Long-press a card: enter selection mode. Further taps toggle selection. The top bar shows "N selected" with select-all and close.
- In selection mode a bottom bar offers **Start, Stop, Delete and More**. More opens a bottom sheet containing the remaining actions, reusing the same entries the desktop context menu uses (one source of truth for the action list). **Relocate (set path) is listed first in that sheet.**
- A single torrent without prior selection is handled by long-pressing it (selection of one), so there is one flow only.
- Delete always asks for confirmation, as on desktop.

**Torrent details.** Full-screen instead of a modal, with a horizontally scrollable tab strip. All current tabs are kept. Peers and trackers are rendered as list rows or cards (not AG Grid) showing the most useful fields. The content tab keeps the file tree (`bb-file-tree`, already virtual-scrolled).

**Add torrent.** A full-screen sheet instead of the modal. Entry from the "+" button: pick a `.torrent` file or paste a magnet link. The screen **always shows all options**: save path, category, tags, start paused or not, and file selection from the torrent's content. Options are grouped in scrollable sections instead of the desktop modal's tabs (builder's call on grouping). The file list for a magnet link may only appear once qBittorrent has fetched the metadata.

**Settings.** Both settings pages (app settings and qBittorrent preferences) keep every pane. On phone the settings shell becomes a drill-down: the pane list first, then the selected pane full-screen with a back button. All panes already stay mounted and `:pane` only selects the visible one; keep that behaviour.

**Other modals.** Simple modals (delete, set path, tags, categories, etc.) shrink to phone width (ng-bootstrap/Bootstrap full-screen-on-small option where appropriate). Modals with AG Grid (manage servers, manage categories, manage tags, import torrents) need phone-friendly layouts or list alternatives.

**Login and server management.** The login page already has breakpoints. Server selection and the server editor must be usable on phone. (Builder's call on details.)

### Touch support (tablet and phone)

- The context menu currently opens only on `contextmenu` (right-click); it needs a long-press equivalent on tablet.
- Hover tooltips need a touch alternative or must be non-essential.
- Grid keyboard navigation and inline editing assume a keyboard; on tablet they should degrade gracefully.

## Goals

- Phone: check the list, search, add, delete, relocate and tag torrents comfortably with one thumb.
- Tablet: everything the desktop app does, usable by touch.
- Handles about 12,000 torrents without janky scrolling or slow filtering.
- Desktop UI and behaviour unchanged.
- Keeps the existing architecture: signals, command bus, `window.bitbutler.*` only, translations in `us.json` and `hu.json`, all themes working.

## Non-goals

- The Capacitor (or any) mobile shell, native builds, and app store work.
- Moving the qBittorrent client and poller out of Electron, and any native HTTP, secure-storage or SQLite work.
- Opening `.torrent` files or `magnet:` links from other apps (share-sheet/intents).
- Background polling and push notifications.
- A separate mobile route or a duplicated set of screens.

## Anti-goals

- Two parallel codebases for the same screens that drift apart.
- Duplicated action logic in phone components instead of the command bus.
- Any desktop regression.
- Phone performance that degrades noticeably with a 12,000 torrent library.

## Constraints

- Angular 22 zoneless, signal-based; new state in signals, not `BehaviorSubject`.
- Follow the repo's conventions (CLAUDE.md): toasts rules, lint with zero warnings, Prettier, specs alongside components, branch/commit/PR conventions.
- Both languages (`us.json`, `hu.json`) updated for any new text.
- All themes (`packages/app/src/styles/themes/`) must render the new phone components correctly.
- The app currently pins main and settings pages to `100vw`/`100vh`; phone browsers' dynamic toolbars and safe-area insets should be considered.

## Decided by the owner

- One responsive app, not a separate mobile route.
- Tablet gets the full desktop UI, including AG Grid.
- Card list with virtual scrolling plus a compact/dense toggle.
- Tap opens details; long-press selects; bottom bar with Start, Stop, Delete, More.
- More opens the remaining desktop context menu actions (as a bottom sheet).
- Details keeps all tabs; peers and trackers become lists/responsive tables, not AG Grid.
- Add screen always shows all options.
- All settings panes available on phone via drill-down.
- UI first, mobile shell and transport later as a separate project.

## Builder's calls so far (the owner has not decided these)

- Bottom sheet rather than a modal for the More actions.
- Sort control next to the search field.
- Offering a clipboard magnet link automatically on the add chooser.
- Relocate placed first in the More sheet.
- Which fields appear on peers and trackers rows.
- Sidebar defaults to collapsed on tablet.
- **Performance budget (my call):** scrolling the 12,000-item list stays smooth (no visible dropped frames on a mid-range laptop at a throttled CPU), and search/filter/sort apply in roughly 100 ms or less. Start with a short spike that renders a synthetic 12,000-item list through the proposed pipeline. If the budget is missed, refactoring `TorrentStoreService` (memoized indexes, etc.) is allowed, provided desktop behaviour and its specs do not change.
- **Breakpoint signal contract (my call):** layout (phone, tablet, desktop) is decided by viewport width only. Touch-specific behaviour (long-press context menu, no hover-only affordances) is decided by `pointer: coarse` (or equivalent), independent of width, so a touch laptop at desktop width keeps the desktop layout but gets long-press.
- **Tablet sidebar (my call):** it is the existing collapsible sidebar, collapsed by default at tablet width, with no hamburger or overlay. Only phone gets the drawer.
- **Action list (my call):** the existing `GridContextMenuService` already builds `ContextMenuEntry` items. Reuse it as the source for the phone More sheet. Every torrent action is reachable on phone. Grid-only entries (column header menu, column chooser, pin/unpin columns, copy cell value) are not shown on phone. Extracting entry building from AG Grid types, if needed, is in scope.
- **Modals on phone (my call):** simple form modals (delete, set path, tags, category, rename, share limit, transfer limit, confirm, credential prompt, server editor) become full-screen on phone. Manage servers, manage categories and manage tags get a list layout on phone instead of AG Grid. Import torrents is not offered on phone, because it is a desktop file-import feature.
- **Magnet metadata (my call):** the add screen keeps the desktop modal's existing behaviour for magnet links. No new IPC or main-process work is in scope. If the desktop flow cannot show a file list for a magnet link before metadata arrives, the phone flow behaves the same way.
- **Clipboard magnet offer (my call):** optional and last; skip if it needs a permission prompt in Electron.
- **Testing (my call):** unit specs alongside new components (including selection mode state and the breakpoint signal), plus a manual checklist for gestures and layouts at phone and tablet widths.

## Left to the builder

- Breakpoint values and how the breakpoint signal is implemented and provided.
- Component structure and file layout for the phone variants.
- Sizing of the work into tasks, and ordering (suggested: breakpoint service and phone shell, list with virtual scroll, selection and actions, details, add screen, settings drill-down, other modals, tablet touch fixes).
- Testing approach and a performance check with a large synthetic list.

## Success looks like

The owner resizes the Electron window to phone width and can search, scroll a 12,000-item list smoothly, long-press to select, delete or relocate torrents, add a torrent from a file or magnet with all options, open details with all tabs, and reach every settings pane. At tablet width the full desktop UI is usable with touch. At desktop width nothing has changed.
