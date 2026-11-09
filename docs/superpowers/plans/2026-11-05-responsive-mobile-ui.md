# Responsive Phone and Tablet UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing Angular app usable on phone and tablet widths (card list, selection mode, bottom sheets, full-screen details/add, settings drill-down, touch support) without changing the desktop UI.

**Architecture:** One app, one set of routes. A `ViewportService` exposes the layout (`phone | tablet | desktop`) and touch capability as signals; components render a phone variant with `@if (viewport.isPhone())`. The phone list reads `FilterService.filtered()`, sorts it, and renders it with `@angular/cdk` virtual scroll. All actions reuse the command bus, `SelectionStoreService` and `GridContextMenuService`.

**Tech Stack:** Angular 22 (zoneless, signals), `@angular/cdk` (scrolling), ng-bootstrap modals, AG Grid (kept for tablet/desktop), ngx-translate, Vitest via `ng test`.

**Spec:** `docs/superpowers/specs/2026-11-05-responsive-mobile-ui-design.md`

## Global Constraints

- **No git commits.** The owner is experimenting: leave all changes uncommitted in the working tree on `main`. Do not create branches, commits or PRs.
- Desktop UI and behaviour unchanged; existing specs keep passing.
- New state uses signals, not `BehaviorSubject`.
- Every new user-visible string is added to both `packages/app/public/i18n/us.json` and `hu.json`.
- All themes in `packages/app/src/styles/themes/` must render new components (use existing CSS variables such as `--bb-chrome`, `--bs-border-color`; no hard-coded colours).
- Layout is decided by viewport width only: phone `max-width: 767.98px`, tablet `768px` to `1199.98px`, desktop `>= 1200px`. Touch behaviour is decided by `(pointer: coarse)`, independent of width.
- Performance budget: scrolling a 12,000-item list stays smooth; filter + sort of 12,000 torrents about 100 ms or less.
- Lint with zero warnings (`npm run lint`) and Prettier formatting; specs live next to components as `*.spec.ts`.
- Use `-` instead of an em dash in all written output and text.
- Run a single spec with: `npx ng test --watch=false --include=<path to spec>` from `packages/app`.

## Review Focus

- A torrent in the current selection is removed by a poll (deleted elsewhere): selection must drop it, and selection mode must exit when it becomes empty (Task 4).
- Window resized across a breakpoint while torrents are selected or a modal is open: no crash, selection preserved or cleanly cleared, desktop grid reappears with state intact (Tasks 1, 6).
- Poll updates re-sort the list while a finger is down: order must be deterministic (hash as tie-break) so cards do not jump between equal sort keys (Task 2).
- Empty list, search with no matches, and disconnected/not-yet-primed store show a message instead of a blank screen (Task 4).
- Magnet torrents whose name is still the info hash, very long names, and unknown ETA (`8640000`) render without breaking the card height (Task 4).

---

## File Structure

New:

- `services/viewport.service.ts` - layout and touch signals.
- `directives/long-press.ts` - `bbLongPress` directive.
- `components/bb-bottom-sheet/bb-bottom-sheet.{ts,html,scss}` - generic slide-up sheet.
- `pages/main/phone/phone-list-state.service.ts` - sort, density, sorted/filtered items.
- `pages/main/phone/torrent-card-list/torrent-card-list.{ts,html,scss}` - virtual-scrolled cards and dense rows.
- `pages/main/phone/phone-action-bar/phone-action-bar.{ts,html,scss}` - selection bar (Start, Stop, Delete, More).
- `pages/main/phone/phone-more.utils.ts` - turns context menu entries into the More sheet list.
- `pages/main/phone/phone-main/phone-main.{ts,html,scss}` - phone shell (top bar, chips, drawer, list, "+").
- Phone list variants for peers/trackers and manage dialogs (Tasks 7, 10).

All paths are relative to `packages/app/src/app/`.

---

### Task 1: ViewportService and layout attribute

**Files:**

- Create: `services/viewport.service.ts`, `services/viewport.service.spec.ts`
- Modify: `app.ts` (set `document.documentElement.dataset['layout']` from `layout()` in an `effect`), `../styles.scss` (see Step 4)

**Interfaces:**

- Produces:

  ```ts
  export type Layout = 'phone' | 'tablet' | 'desktop';
  export const PHONE_MAX_WIDTH = 767.98;
  export const TABLET_MAX_WIDTH = 1199.98;
  @Injectable({ providedIn: 'root' })
  export class ViewportService {
    readonly layout: Signal<Layout>;
    readonly isPhone: Signal<boolean>;
    readonly isTablet: Signal<boolean>;
    readonly isDesktop: Signal<boolean>;
    readonly isTouch: Signal<boolean>; // (pointer: coarse)
  }
  ```

- [ ] **Step 1: Write failing spec** with a fake `window.matchMedia` whose queries can be flipped and fire `change` listeners. Tests: `layout() === 'phone'` when only the phone query matches; `'tablet'` when only the tablet query matches; `'desktop'` otherwise; `isTouch()` follows `(pointer: coarse)` independently of layout; layout updates when a `change` event fires.
- [ ] **Step 2: Run it, expect FAIL** (service missing).
- [ ] **Step 3: Implement** `ViewportService` with `matchMedia` queries `(max-width: 767.98px)`, `(min-width: 768px) and (max-width: 1199.98px)`, `(pointer: coarse)`, each wrapped in a signal updated by a `change` listener (remove listeners via `DestroyRef`). Guard for `matchMedia` being undefined (default `desktop`, not touch).
- [ ] **Step 4:** In `app.ts` add the `effect` setting `data-layout`; in `styles.scss` make `.vh-100` usage on the main and settings pages use `100dvh` under `[data-layout='phone']` and add `padding-bottom: env(safe-area-inset-bottom)` for bottom bars (class `.bb-safe-bottom`).
- [ ] **Step 5: Run the spec, expect PASS.** Run `npm run lint` from the repo root, expect 0 warnings.

---

### Task 2: Phone list state and performance spike

**Files:**

- Create: `pages/main/phone/phone-list-state.service.ts`, `pages/main/phone/phone-list-state.service.spec.ts`

**Interfaces:**

- Consumes: `FilterService.filtered: Signal<Torrent[]>`, `TorrentListGridSettingsService` (read and write the existing `compactRows` setting; one shared density setting for grid and phone list, my call).
- Produces:

  ```ts
  export type PhoneSortKey =
    | 'name'
    | 'added_on'
    | 'progress'
    | 'dlspeed'
    | 'upspeed'
    | 'size'
    | 'ratio'
    | 'eta'
    | 'state';
  @Injectable({ providedIn: 'root' })
  export class PhoneListStateService {
    readonly sortKey: Signal<PhoneSortKey>; // default 'added_on'
    readonly sortDesc: Signal<boolean>; // default true
    readonly compact: Signal<boolean>;
    readonly items: Signal<Torrent[]>; // FilterService.filtered() sorted
    setSort(key: PhoneSortKey, desc?: boolean): void; // same key without desc toggles direction
    setCompact(value: boolean): void;
  }
  ```

- [ ] **Step 1: Write failing specs:** `items()` sorts by each key ascending and descending; ties break on `hash` ascending so equal keys never swap order between emissions; `setSort` with the same key toggles `sortDesc`; names sort case-insensitively via `localeCompare`; changing the filter changes `items()`.
- [ ] **Step 2: Add a performance spec** named `sorts and filters 12000 torrents within budget`: build 12,000 synthetic `Torrent`s in the `TorrentStoreService` (via `applyMaindata` with `full_update`), set a search term, and assert `items()` evaluates in under 250 ms (looser than the 100 ms goal to avoid CI flakiness; log the measured time).
- [ ] **Step 3: Run, expect FAIL.**
- [ ] **Step 4: Implement** the service. Sort a copy of `filtered()` with one comparator per key (precompute `name.toLowerCase()` only if the spike misses budget).
- [ ] **Step 5: Run, expect PASS.** If the performance spec fails, stop and report the measured time before changing `TorrentStoreService` (spec allows memoised indexes there if desktop behaviour and specs stay unchanged).

---

### Task 3: Long-press directive

**Files:**

- Create: `directives/long-press.ts`, `directives/long-press.spec.ts`

**Interfaces:**

- Produces: standalone directive `[bbLongPress]` with `output<PointerEvent>('bbLongPress')`, input `bbLongPressMs` (default 500). Also suppresses the click that follows a successful long press (so tap handlers do not also fire).

- [ ] **Step 1: Write failing spec** (fake timers): emits after 500 ms of `pointerdown` without release; does not emit on `pointerup` at 300 ms; cancels when the pointer moves more than 10 px; cancels on `pointercancel`; the `click` directly after a long press is stopped (`stopImmediatePropagation`) but a later click is not; ignores mouse right button.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** with host listeners for `pointerdown/move/up/cancel/click`, one timer, tracked start coordinates.
- [ ] **Step 4: Run, expect PASS.**

---

### Task 4: Torrent card list (virtual scroll, cards, dense rows, selection)

**Files:**

- Create: `pages/main/phone/torrent-card-list/torrent-card-list.{ts,html,scss,spec.ts}`

**Interfaces:**

- Consumes: `PhoneListStateService.items`/`compact`, `SelectionStoreService` (`selected`, `set`, `setByHashes`, `clear`), `CommandBusService.emit({ type: 'UI_OPEN_TORRENT_DETAILS', hash })`, `UiFormatService` for sizes/speeds/ETA, `bbLongPress`.
- Produces: `selector: 'app-torrent-card-list'`; exports `CARD_ITEM_SIZE = 96` and `ROW_ITEM_SIZE = 44`; `selectionMode: Signal<boolean>` (true when `SelectionStoreService.selected()` is non-empty).

- [ ] **Step 1: Write failing specs:**
  - tap on a card with no selection emits `UI_OPEN_TORRENT_DETAILS` with its hash;
  - long press on a card selects exactly that torrent and `selectionMode()` becomes true;
  - while `selectionMode()`, a tap toggles that torrent in `SelectionStoreService` and does not open details;
  - un-toggling the last selected torrent turns `selectionMode()` off;
  - **Review Focus:** when the store removes a selected torrent (apply maindata with `torrents_removed`), `selectedHashes()` drops it and `selectionMode()` turns off if it was the last;
  - virtual scroll `itemSize` is `CARD_ITEM_SIZE` when `compact()` is false and `ROW_ITEM_SIZE` when true;
  - **Review Focus:** with 0 items and no search shows the empty message; with a search and 0 items shows the "no matches" message; before `isPrimed()` shows `app-loader` or a loading message;
  - **Review Focus:** a torrent named as a 40-char info hash, a 300-char name, and `eta = 8640000` render with the name truncated (CSS `text-overflow`) and ETA shown as an infinity symbol, without changing item height.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** the component (OnPush, `cdk-virtual-scroll-viewport` with `[itemSize]`, `*cdkVirtualFor` tracking `hash`). Card shows name, state label, progress bar, down/up speed, size, ETA, ratio; dense row shows state dot, name, percentage. State colours reuse the same state-to-colour mapping the grid's `status-dot-cell-renderer` uses (extract it to a shared function in `pages/main/grid/renderers/` if it is private). Selected cards get a checked marker and highlighted background.
- [ ] **Step 4: Add translations** (empty, no matches, loading) to `us.json` and `hu.json`.
- [ ] **Step 5: Run, expect PASS.**

---

### Task 5: Bottom sheet, More list and action bar

**Files:**

- Create: `components/bb-bottom-sheet/bb-bottom-sheet.{ts,html,scss,spec.ts}`, `pages/main/phone/phone-more.utils.ts` + spec, `pages/main/phone/phone-action-bar/phone-action-bar.{ts,html,scss,spec.ts}`

**Interfaces:**

- Produces:
  - `BbBottomSheet`: `selector: 'app-bb-bottom-sheet'`; `open = model(false)`; `title = input<string>()`; closes on backdrop tap and Escape; content projected; honours `.bb-safe-bottom`.
  - ```ts
    export function buildPhoneMoreEntries(entries: ContextMenuEntry[]): ContextMenuEntry[];
    ```
    Removes `control.start`, `control.stop`, `torrent.details`, `files.remove`, the `copy` submenu entries `torrent.copyCellValue`, the `row.pin` submenu, and any entry whose id starts with `all.`; moves `files.setSavePath` (flattened out of the `files` submenu) to the first position; keeps the rest in order.
  - `PhoneActionBar`: `selector: 'app-phone-action-bar'`; buttons Start (`TORRENT_RESUME`), Stop (`TORRENT_PAUSE`), Delete (`UI_TORRENT_DELETE_REQUEST`, no `hashes`, so the existing delete modal confirms and uses the selection), More (opens the sheet listing entries from `GridContextMenuService.buildTorrentMenu({ row: selected[0], selected, rowPinned: null })` passed through `buildPhoneMoreEntries`). Selecting an item runs its `action` (command or function) and closes the sheet. Submenus render as nested lists inside the sheet.

- [ ] **Step 1: Write failing specs:** sheet opens/closes via the `open` model and backdrop click; `buildPhoneMoreEntries` puts `files.setSavePath` first, drops the listed ids, and leaves `queue`, `transfer`, `maintenance` and `manage` entries; action bar emits the three commands with the expected `type`s; Delete passes no `hashes` (so selection is used); More lists `files.setSavePath` first for a one-torrent and a three-torrent selection; clicking an entry with a function action calls it and closes the sheet; the bar is disabled/hidden when nothing is selected.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** the three units. Reuse `ContextMenuEntry` types unchanged; `GridContextMenuService` is provided at component level in `Grid`, so provide it in `PhoneActionBar` too (`providers: [GridContextMenuService]`).
- [ ] **Step 4: Add translations**, then **Run, expect PASS.**

---

### Task 6: Phone shell and wiring into Main

**Files:**

- Create: `pages/main/phone/phone-main/phone-main.{ts,html,scss,spec.ts}`
- Modify: `pages/main/main.html`, `pages/main/main.ts`, `pages/main/main.scss`

**Interfaces:**

- Consumes: `ViewportService.isPhone`, `FilterService` (`setSearch`, `setStates`, `external`), `PhoneListStateService`, `QbPollingService`/store as `Main` already does, `Status` component for the drawer, `CommandBusService.emit({ type: 'UI_ADD_TORRENT' })`.
- Produces: `selector: 'app-phone-main'`.

- [ ] **Step 1: Write failing specs:** `Main` renders `app-phone-main` and not `app-grid`/`app-button-bar` when `isPhone()`; the reverse on tablet/desktop; typing in the search field calls `FilterService.setSearch`; tapping a status chip calls `setStates` with that state (and "All" clears them); the sort menu calls `PhoneListStateService.setSort`; the density toggle calls `setCompact`; the hamburger opens the drawer containing `app-status`; "+" emits `UI_ADD_TORRENT`; when `selectionMode()` is true the top bar shows "N selected" with select-all and close (close calls `SelectionStoreService.clear()`) and the action bar appears; **Review Focus:** flipping `isPhone` to false and back keeps the selection and filter state.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** `Main` keeps its polling/theme logic and only swaps the template body with `@if (viewport.isPhone()) { <app-phone-main/> } @else { existing markup }`. Status chips are counts from `TorrentStoreService.countsByState`/`statesWithCounts`. Drawer is a CSS off-canvas panel with a backdrop.
- [ ] **Step 4: Add translations**, then **Run these specs plus `main.spec.ts`, expect PASS.**
- [ ] **Step 5: Manual check:** `npm start`, resize the Electron window below 768 px; confirm card list, search, chips, drawer, selection, bottom bar, and that widening the window restores the grid.

---

### Task 7: Torrent details full-screen with list variants

**Files:**

- Modify: `modals/torrent-details/torrent-details.{ts,html,scss}`, `modals/torrent-details/peers/peers.{ts,html,scss}`, `modals/torrent-details/trackers/trackers.{ts,html,scss}`, `services/ui-command-handler.service.ts` (`UI_OPEN_TORRENT_DETAILS`)
- Create: `modals/torrent-details/peers/peers-list/peers-list.{ts,html,scss,spec.ts}`, `modals/torrent-details/trackers/trackers-list/trackers-list.{ts,html,scss,spec.ts}`

**Interfaces:**

- Consumes: the existing data service `torrent-details-data.service.ts` signals the peers and trackers grids already bind to (read the `Peers` and `Trackers` components to reuse the same row models).
- Produces: `PeersList` (`app-peers-list`) rows with address:port, client, progress and down/up speed; `TrackersList` (`app-trackers-list`) rows with URL, status and peers/seeds/leeches.

- [ ] **Step 1: Write failing specs:** in `ui-command-handler.service.spec.ts`, on phone `UI_OPEN_TORRENT_DETAILS` opens the modal with `fullscreen: true` (and `size: 'xl'` otherwise); `Peers` renders `app-peers-list` and no `ag-grid-angular` when `isPhone()`; `Trackers` likewise; the new list components render one row per input item with the expected fields.
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Make the tab strip horizontally scrollable on phone (`overflow-x: auto; white-space: nowrap`). The list components are plain `@for` lists (peers lists are bounded, no virtual scroll needed). Content tab keeps `bb-file-tree`.
- [ ] **Step 4: Add translations, run specs, expect PASS.**

---

### Task 8: Add torrent full-screen

**Files:**

- Modify: `modals/add-torrent/add-torrent.{ts,html,scss}`, `services/ui-command-handler.service.ts` (`UI_ADD_TORRENT`), and the add-torrent child files grid under `modals/add-torrent/files/`

- [ ] **Step 1: Write failing specs:** on phone `UI_ADD_TORRENT` opens `AddTorrent` with `fullscreen: true` and a phone-friendly size option, otherwise unchanged; in `add-torrent.spec.ts`, when `isPhone()` the tab navigation renders as stacked sections (all options present: save path, category, tags, start paused, file selection) and every form control exists; the footer actions (Add, Cancel) are always visible (`sticky-bottom`).
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Keep the form and submit logic untouched; change only template structure and styles under `isPhone()`. Replace the file-selection AG Grid with the existing `bb-file-tree` checkbox view if it already supports checkboxes (it does for the desktop torrent details content tab); otherwise render a checkbox list with virtual scroll. Add a button to pick a `.torrent` file (existing file input) and a textarea for magnet links, both already present in the desktop form.
- [ ] **Step 4: Run specs, expect PASS.** Manual check: add a file torrent and a magnet at phone width with every option visible.

---

### Task 9: Settings shell drill-down

**Files:**

- Modify: `pages/settings-shell/settings-shell.{ts,html,scss}`, `pages/settings-shell/settings-shell.spec.ts`

**Interfaces:**

- Consumes: `ViewportService.isPhone`, existing `activePane`, `config().groups`, `[routerLink]` navigation.

- [ ] **Step 1: Write failing specs:** on phone with no pane chosen (new input/route state `phoneView = 'list' | 'pane'`) the shell shows the pane list and hides the pane content; selecting a pane navigates to `[config().basePath, pane.id]` and shows the content with a back button; back returns to the list (not out of settings); the top-level back button leaves settings only from the list view; on non-phone widths behaviour is unchanged. All panes remain mounted (assert pane components are still in the DOM but hidden).
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** using CSS under `[data-layout='phone']` plus a signal for list vs pane view. Replace `100vw/100vh` with `100%`/`100dvh`; sidebar becomes full width; the existing per-pane discard/restore header stays reachable.
- [ ] **Step 4: Run, expect PASS.** Manual check both settings pages at phone width.

---

### Task 10: Remaining modals and manage dialogs

**Files:**

- Modify: `services/ui-command-handler.service.ts` (modal open options), `modals/manage-servers/`, `modals/manage-categories/`, `modals/manage-tags/` (add phone list variants), simple modals' open calls

- [ ] **Step 1: Write failing specs:** for the simple modals (delete, set path, tags, category, rename, share limit, transfer limit, confirm, credential prompt, server editor) opened on phone, `modalService.open` receives `fullscreen: true`; `ManageServers`, `ManageCategories`, `ManageTags` render a list (rows with name and edit/delete actions) and no `ag-grid-angular` on phone; `UI_IMPORT_TORRENTS` is ignored on phone (no menu entry, no modal).
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Add one helper (for example `modalOptionsFor(viewport)` in `services/ui-command-handler.service.ts`) so full-screen-on-phone is decided in one place. Keep each manage dialog's data and commands; only the presentation changes.
- [ ] **Step 4: Run specs, expect PASS.**

---

### Task 11: Tablet and touch support

**Files:**

- Modify: `services/context-menu.service.ts`, `pages/main/grid/grid.html` / `grid.ts` (long-press hook), `services/sidebar-settings.service.ts` defaults or `pages/main/main.ts` (initial collapsed state at tablet width), tooltip directive/usages

- [ ] **Step 1: Write failing specs:** with `isTouch()` true, a long press on a grid row opens the same context menu `contextmenu` opens (reuse `bbLongPress` or `ContextMenuService`'s open call); with `isTouch()` false long press does nothing extra; at tablet width with no saved sidebar settings the sidebar starts collapsed, and a saved preference still wins; `bbTooltip` does not open on hover when `isTouch()` and the tooltip's information is also available elsewhere (accessible label or visible text).
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** Do not change desktop (non-touch, wide) behaviour. AG Grid inline edit and keyboard navigation stay as they are; verify they do not trap focus on touch.
- [ ] **Step 4: Run specs, expect PASS.** Manual check at tablet width in Chrome device emulation.

---

### Task 12: Login, server management, final verification

**Files:**

- Modify: `pages/login/login.scss`, server selection UI as needed

- [ ] **Step 1:** At phone width, walk through login, server switching and the server editor; fix any overflow or unreachable controls (use existing breakpoints in `login.scss`).
- [ ] **Step 2: Run the full check:** `npm run lint`, `npm test`, `npm run build`. Expect 0 lint warnings, all specs passing, and a successful production build.
- [ ] **Step 3: Manual checklist** (record results in the final report): phone width list with the synthetic 12,000-torrent store scrolls smoothly; search, sort, compact toggle; long-press selection; Start/Stop/Delete/More incl. Set Path first; details with all tabs; add by file and by magnet with all options; every settings pane on both settings pages; tablet width full grid with touch context menu; desktop width visually unchanged.
