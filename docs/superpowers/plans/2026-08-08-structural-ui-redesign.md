# Structural UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the structural gap between BitButler's real UI and the approved "Direction A" mockups in the `BitButler UI Refresh` claude.ai/design project (`main-a.html`, `modal-settings-a.html`, `modal-addtorrent-a.html`, `modal-torrentdetails-a.html`, `modal-delete-torrent-a.html`). The earlier plan on this same branch (commits `592c97a`..`872ab25`) only adjusted shared CSS _values_ (radius tokens, two theme colors, one button variant) - it did not change any layout structure, so the running app still doesn't resemble the mockups in the ways that matter most: the header isn't unified, the sidebar's active state doesn't fill solid, modal windows are full-width and top-anchored instead of centered floating cards, tabs use Bootstrap's boxy 3-border style instead of a clean underline, and the torrent grid's progress bars are nearly invisible against the dark background due to a low-contrast track color. This plan closes those specific gaps.

**Architecture:** Continue on the existing branch `267-claude-inspired-ui-refresh` (not pushed, not merged - confirmed via `git log --oneline origin/main` showing no `267:` commits and `git log origin/267-claude-inspired-ui-refresh` returning "unknown revision"). Do not create a new branch or new issue; this is the same visual-refresh effort, just its next phase. Every task below is scoped CSS/SCSS and Angular template changes - no `.ts` component logic changes anywhere in this plan, and no new npm packages. Every color continues to come from the existing `--bs-*`/`--bb-*` CSS custom property system already defined per-theme, so every change here automatically works across all 8 themes x light/dark without per-theme edits, the same pattern that made the `.bb-fieldset` change in the prior phase land cleanly everywhere at once.

**Tech Stack:** Angular 20 (zoneless/signals), Bootstrap 5 + ng-bootstrap (`NgbModal`), ag-Grid 35 (Theming API), SCSS with CSS custom properties for theming. No new packages.

## Important scoping note - mockups are a visual language reference, not a literal feature spec

The mockups are simplified static demos built to show spacing/radius/color/shape - they are **not** literal 1:1 reproductions of every screen's real functionality, and this plan does not remove any existing feature to match a mockup's simplified footer or column set. Two concrete examples, confirmed by reading both the mockup and the real component:

- `modal-torrentdetails-a.html`'s footer shows only a "Close" button. The real `torrent-details.html` footer has a delete icon-button plus four dropdown-menu button groups (Control, Files, Manage, Transfer) plus Close - all of these stay. Only the _shell_ (modal size/position/radius, tab style) changes; the footer's existing buttons and dropdowns are restyled in place, never removed.
- `main-a.html`'s table shows 11 plain columns with no filter icons. The real grid is ag-Grid with column filters, sorting, resizing, context menus, and many more available columns via the column-visibility picker - none of that changes. Only shared shape/color tokens already wired into `GRID_PARAMS_SHARED` (`packages/app/src/app/app.const.ts`) and one low-level component style (the progress bar track) change.

If a task below doesn't mention a piece of existing functionality, that functionality is untouched.

## Global Constraints

- Do not introduce new UI libraries or npm packages - reuse Bootstrap, ng-bootstrap, ag-Grid, and the existing `@fortawesome/*` icon packages already in the project.
- Every color must come from the existing `--bs-*`/`--bb-*` CSS custom property system so it automatically works across all 8 themes x light/dark - never hardcode a hex color in component SCSS for something that should follow the theme.
- Do not change any `.ts` component logic/behavior in this plan - every task is template classes, SCSS, or `NgbModal.open()` call-site _options_ (size/centered - configuration values, not behavior).
- Do not remove or restructure any existing feature, button, dropdown, or column to make a screen match a mockup's simplified appearance - see the scoping note above.
- `npm run lint` must pass with zero warnings (`--max-warnings=0`, enforced by this repo's ESLint config) after every task.
- Follow the repo's commit format: `#267: <short description>` (same issue as the prior phase; branch `267-claude-inspired-ui-refresh` is already checked out with the prior phase's 7 commits on it).
- Use `-` not `—` (em dash) in all commit messages and any written output.
- No task in this plan can be verified by launching the actual Electron app from within an automated/non-interactive implementer subagent (no GUI access). Every task explicitly defers its "does this look right" check to a **human visual pass** - do not claim a task is visually correct without that pass having happened.

---

## Task 1: Unify the global modal shell (size, position, corner radius, footer spacing)

**Context:** Today, `Settings`, `Add Torrent`, and `Torrent Details` all open via `NgbModal.open(Component, { size: 'xl', centered: false, scrollable: true, ... })` - confirmed at `packages/app/src/app/services/ui-command-handler.service.ts:110-115` (Settings), `:143-149` and `:372-378` (Torrent Details, opened from two call sites), `:158-163` (Add Torrent). `size: 'xl'` maps to Bootstrap's fixed `1140px` breakpoint and `centered: false` anchors the dialog to the top of the viewport. `Delete Torrent` (a `Confirm`-style modal) opens via `this.modalService.open(DeleteTorrent)` with no options object, so it uses Bootstrap's unstyled default (`~500px`, not centered either, since `centered` isn't set per-call and the app-wide default in `packages/app/src/app/app.ts:81` sets `this.modalConfigService.centered = true` - so Delete Torrent actually _is_ already centered by the global default; only Settings/Add Torrent/Torrent Details explicitly override `centered: false`).

The mockups show narrower, vertically centered floating cards: Settings and Torrent Details ~880-920px, Add Torrent ~760px, Delete Torrent ~460px (already close to Bootstrap's ~500px default). This task changes the three `centered: false` call sites to `centered: true`, and gives each modal a specific max-width via a new `windowClass` rather than relying on Bootstrap's fixed `sm`/`lg`/`xl` breakpoints (none of which land close enough to the mockup widths). It also redefines the shared `.modal-content` shell (corner radius, border) globally, since all four modals already share that one Bootstrap class.

**Files:**

- Modify: `packages/app/src/app/services/ui-command-handler.service.ts:110-115`, `:143-149`, `:158-163`, `:372-378` (four `NgbModal.open()` call sites)
- Modify: `packages/app/src/styles.scss` (add new `.bb-modal-md`/`.bb-modal-lg` window-width classes near the existing `.bb-modal-header` rules around line 647; update the existing `[data-bs-theme='light'] .modal-content` / `[data-bs-theme='dark'] .modal-content` rules around line 635-641 to also set border-radius)

**Interfaces:** None - `windowClass` is an existing `NgbModalOptions` string property (space-separated CSS class names applied to the modal's outer window element); no new Angular API surface.

- [ ] **Step 1: Confirm the current call sites**

Run: `grep -n "modalService.open(Settings\|modalService.open(AddTorrent\|modalService.open(TorrentDetails\|modalService.open(DeleteTorrent" packages/app/src/app/services/ui-command-handler.service.ts`
Expected: 5 matches (Settings x1, AddTorrent x1, TorrentDetails x2, DeleteTorrent x1), matching the line ranges above. If line numbers have drifted, use this grep's output to relocate them.

- [ ] **Step 2: Add window-width classes to `styles.scss`**

In `packages/app/src/styles.scss`, immediately after the existing rule block:

```scss
[data-bs-theme='light'] .modal-content {
  box-shadow: 0 1.5rem 3rem rgba(0, 0, 0, 0.25);
}

[data-bs-theme='dark'] .modal-content {
  box-shadow: 0 1.25rem 2.5rem rgba(0, 0, 0, 0.55);
}
```

add:

```scss
.modal-content {
  border-radius: 18px;
  border-color: var(--bs-border-color);
  overflow: hidden;
}

.bb-modal-sm .modal-dialog {
  max-width: 460px;
}

.bb-modal-md .modal-dialog {
  max-width: 760px;
}

.bb-modal-lg .modal-dialog {
  max-width: 920px;
}
```

(`.bb-modal-sm` is provided for completeness/future use - Delete Torrent already renders close to 460px at Bootstrap's default and does not need a class added in this task. `overflow: hidden` on `.modal-content` is required so the new 18px corner radius actually clips the header/body/footer backgrounds, which currently paint square corners past the border.)

- [ ] **Step 3: Apply `windowClass` and `centered: true` at each call site**

In `packages/app/src/app/services/ui-command-handler.service.ts`, change:

```ts
const settingsModalRef = this.modalService.open(Settings, {
  size: 'xl',
  centered: false,
  scrollable: true,
  beforeDismiss: () => settingsModalRef.componentInstance.canDeactivate(),
});
```

to:

```ts
const settingsModalRef = this.modalService.open(Settings, {
  windowClass: 'bb-modal-lg',
  centered: true,
  scrollable: true,
  beforeDismiss: () => settingsModalRef.componentInstance.canDeactivate(),
});
```

(Remove the `size: 'xl'` line entirely - the `windowClass` now controls width instead.)

Change **both** Torrent Details call sites (`:143-149` and `:372-378`) from:

```ts
const torrentDetailsModalRef = this.modalService.open(TorrentDetails, {
  size: 'xl',
  scrollable: true,
  centered: false,
  beforeDismiss: () => (torrentDetailsModalRef.componentInstance as GuardableModal).canDeactivate(),
});
```

to:

```ts
const torrentDetailsModalRef = this.modalService.open(TorrentDetails, {
  windowClass: 'bb-modal-lg',
  scrollable: true,
  centered: true,
  beforeDismiss: () => (torrentDetailsModalRef.componentInstance as GuardableModal).canDeactivate(),
});
```

(Same edit at both call sites - `contentModalRef`/`torrentDetailsModalRef` variable names differ between the two but the shape of the change is identical: drop `size: 'xl'`, add `windowClass: 'bb-modal-lg'`, flip `centered` to `true`.)

Change:

```ts
const addTorrentModalRef = this.modalService.open(AddTorrent, {
  size: 'xl',
  scrollable: true,
  centered: false,
  keyboard: false,
});
```

to:

```ts
const addTorrentModalRef = this.modalService.open(AddTorrent, {
  windowClass: 'bb-modal-md',
  scrollable: true,
  centered: true,
  keyboard: false,
});
```

Leave the `DeleteTorrent` call site (`this.modalService.open(DeleteTorrent)`, no options object) unchanged - it already centers via the app-wide default and is already close to the mockup's 460px.

- [ ] **Step 4: Lint and build**

Run: `npm run lint`
Expected: exits 0, no warnings.

Run: `npm run build --workspace=packages/app`
Expected: build succeeds.

- [ ] **Step 5: Defer visual check**

Do not attempt to launch the app. Note in your report that a human needs to open Settings, Add Torrent, and both Torrent Details entry points (row double-click and the toolbar/context-menu action) and confirm: the modal is centered vertically and horizontally, is visibly narrower than before (not stretching near-full-width), has clearly rounded corners with no square-cornered content bleeding past them, and that `scrollable: true` still lets long tab content (e.g. Settings' General tab) scroll inside the modal body rather than growing the modal past the viewport.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/services/ui-command-handler.service.ts packages/app/src/styles.scss
git commit -m "$(cat <<'EOF'
#267: center and narrow the Settings, Add Torrent, and Torrent Details modals

These three modals opened at Bootstrap's xl (1140px) width, top-anchored
instead of centered. Matches the approved mockups' floating centered card
sizing (760-920px) via new windowClass-driven width classes, and gives
the shared .modal-content shell an 18px corner radius so all four modals
(these three plus Delete Torrent, unchanged) read as one consistent
floating-card language. No modal content, buttons, or dropdowns changed.
EOF
)"
```

---

## Task 2: Restyle the shared modal tab strip (underline instead of boxed tabs)

**Context:** `Settings`, `Add Torrent`, and `Torrent Details` all render their tab strip as `<ul class="nav nav-tabs bb-modal-tabs">` - confirmed identical in `settings.html:5`, `add-torrent.html:11`, `torrent-details.html:23`. `.bb-modal-tabs` (defined in `styles.scss:677-681`) only sets spacing (`margin-top/bottom`, `font-size`) - the actual active/inactive tab appearance comes from Bootstrap's generic `.nav-tabs .nav-link` rules plus this repo's one override at `styles.scss:970-974`:

```scss
.nav-tabs .nav-link.active {
  border-color: var(--bs-border-color) var(--bs-border-color) transparent;
  color: var(--bb-accent);
  font-weight: 600;
}
```

That override keeps Bootstrap's classic 3-sided boxed-tab look (top+left+right border, transparent bottom to blend into the panel below). The mockups use a plain underline: no side borders at all, just a 2px bottom border in the accent color on the active tab, more horizontal padding, and no bold-vs-normal font-weight jump readable as boxiness. Because `.bb-modal-tabs` already uniquely scopes every tab list in the three tabbed modals, this task only needs to add rules scoped to `.bb-modal-tabs`, not touch the generic `.nav-tabs` rule (which may be used elsewhere in the app outside modals - leave it alone).

**Files:**

- Modify: `packages/app/src/styles.scss:677-681` (the `.bb-modal-tabs` rule)

**Interfaces:** None - purely additive/overriding CSS scoped under the existing `.bb-modal-tabs` class already applied in all three tabbed modal templates; no template changes needed.

- [ ] **Step 1: Confirm the current rule**

Run: `grep -n "^.bb-modal-tabs" packages/app/src/styles.scss`
Expected: one match near line 677.

- [ ] **Step 2: Replace the block**

Change:

```scss
.bb-modal-tabs {
  margin-top: 15px;
  margin-bottom: -17px;
  font-size: 0.8rem;
}
```

to:

```scss
.bb-modal-tabs {
  margin-top: 18px;
  margin-bottom: -1px;
  font-size: 0.85rem;
  border-bottom: 0;
  gap: 4px;

  .nav-link {
    border: 0 !important;
    border-bottom: 2px solid transparent !important;
    border-radius: 0 !important;
    padding: 10px 6px;
    margin-bottom: -1px;
    color: var(--bs-secondary-color);
    font-weight: 600;
    background: transparent !important;

    &:hover {
      color: var(--bs-body-color);
      border-bottom-color: var(--bs-border-color) !important;
    }
  }

  .nav-link.active {
    color: var(--bb-accent) !important;
    border-bottom-color: var(--bb-accent) !important;
  }
}
```

(This scoped block fully replaces the previous negative-margin trick with an explicit `border-bottom` underline approach, so it no longer depends on `.nav-tabs .nav-link.active`'s boxed styling at all - every declaration needed for both the active and inactive tab state is now self-contained inside `.bb-modal-tabs`. The `!important`s are necessary because Bootstrap's own `.nav-tabs .nav-link` rule sets `border: 1px solid transparent` with higher specificity than a plain class selector.)

- [ ] **Step 3: Lint and build**

Run: `npm run lint`
Expected: exits 0, no warnings.

Run: `npm run build --workspace=packages/app`
Expected: build succeeds.

- [ ] **Step 4: Defer visual check**

Note in your report: a human needs to open Settings (4 tabs), Add Torrent (4 tabs, one with a warning/info badge icon), and Torrent Details (4 tabs, one showing an unsaved-changes asterisk icon) and confirm each tab strip now shows a clean underline (no boxed borders), the active tab's underline and text are in the accent color, and the small icon badges next to tab labels (unsaved-indicator asterisk, files-tab info icon, warning triangle) still render and don't get clipped by the new padding.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/styles.scss
git commit -m "$(cat <<'EOF'
#267: replace boxed modal tabs with a clean underline style

.bb-modal-tabs (shared by Settings, Add Torrent, and Torrent Details)
relied on Bootstrap's classic 3-sided boxed-tab look. Matches the
approved mockups' plain underline treatment instead, fully self-contained
within .bb-modal-tabs so the generic .nav-tabs rule used elsewhere in the
app is untouched.
EOF
)"
```

---

## Task 3: Delete Torrent modal - solid checkbox and warning callout

**Context:** `delete-torrent.html` (read in full - `packages/app/src/app/modals/delete-torrent/delete-torrent.html`) already has the right _structure_ for the mockup: a `.form-check` checkbox bound to `removeFiles`, and a conditional paragraph shown only when that checkbox is checked. Two things differ from the mockup:

1. **Checkbox appearance.** The app-wide checkbox style (`styles.scss:895-930`, plus per-theme `:checked` background-image rules in every `themes/*/  _dark.scss`/`_light.scss` file) draws an _outline_ box with a colored checkmark glyph drawn via `background-image`, never filling the box itself with a solid color. The mockup shows a _solid-filled_ danger-red box with a white check icon when checked. Changing the shared, app-wide checkbox style would touch every checkbox in the app (every Settings toggle-adjacent checkbox, every form checkbox) - out of scope here. Instead, this task adds a **scoped override** inside `delete-torrent.scss` (currently an empty file) that only applies inside this one modal, using the `.bb-check-danger` class the template already conditionally applies (`delete-torrent.html:14`) when the checkbox is checked.
2. **Warning callout.** The disk-space warning currently renders as a plain `<p class="mt-2 mb-0 text-danger">` (`delete-torrent.html:29-34`) with no border, background, or icon. The mockup wraps it in a bordered, tinted callout box with a warning-triangle icon. This needs both a small template change (wrap the existing paragraph, add an icon) and new scoped CSS.

**Files:**

- Modify: `packages/app/src/app/modals/delete-torrent/delete-torrent.html`
- Modify: `packages/app/src/app/modals/delete-torrent/delete-torrent.scss` (currently empty)
- Modify: `packages/app/src/app/modals/delete-torrent/delete-torrent.ts` (only to add one already-imported-elsewhere FontAwesome icon reference - see Step 2; this is a constant/icon-map addition, not behavior)

**Interfaces:** None new - reuses the existing `icons` object pattern already present in this component (confirmed via `icons.faTrashCan`/`icons.faXmark` already used in the template) and the existing `deleteForm.get('removeFiles')?.value` reactive-form signal already driving the conditional block.

- [ ] **Step 1: Read the current component class to find the icons object**

Run: view `packages/app/src/app/modals/delete-torrent/delete-torrent.ts` in full and locate the `icons = { faTrashCan, faXmark, ... }` (or equivalent) object and its imports from `@fortawesome/free-solid-svg-icons`.

- [ ] **Step 2: Add the warning-triangle icon**

In `packages/app/src/app/modals/delete-torrent/delete-torrent.ts`, add `faTriangleExclamation` to the existing `import { ... } from '@fortawesome/free-solid-svg-icons'` line, and add `faTriangleExclamation` as a new key on the existing `icons` object (matching however `faTrashCan`/`faXmark` are already declared there - same pattern, same object).

- [ ] **Step 3: Update the template**

In `packages/app/src/app/modals/delete-torrent/delete-torrent.html`, change:

```html
@if (deleteForm.get('removeFiles')?.value) {
<p class="mt-2 mb-0 text-danger">
  {{ 'components.modals.delete-torrent.disk-space' | translate: { size: totalSize() | fileSize } }}
</p>
}
```

to:

```html
@if (deleteForm.get('removeFiles')?.value) {
<div class="bb-delete-warning">
  <fa-icon [icon]="icons.faTriangleExclamation"></fa-icon>
  <span
    >{{ 'components.modals.delete-torrent.disk-space' | translate: { size: totalSize() | fileSize }
    }}</span
  >
</div>
}
```

(`fa-icon` requires `FontAwesomeModule` in this component's `imports` array - confirm it's already there via the same read from Step 1; `bb-btn-content`'s use of `fa-icon` elsewhere in this same file's footer buttons confirms the module is already imported at the component level, since `bb-btn-content` itself renders `fa-icon` and is already used here.)

- [ ] **Step 4: Write the scoped SCSS**

In `packages/app/src/app/modals/delete-torrent/delete-torrent.scss` (currently empty), add:

```scss
.form-check.bb-check-danger .form-check-input:checked {
  background-color: var(--bs-danger) !important;
  border-color: var(--bs-danger) !important;
}

.bb-delete-warning {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 0.75rem;
  padding: 12px 14px;
  border-radius: var(--bb-control-radius);
  background-color: color-mix(in srgb, var(--bs-danger) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--bs-danger) 28%, transparent);
  color: var(--bs-danger);
  font-size: 0.85rem;
  line-height: 1.5;

  fa-icon {
    flex-shrink: 0;
    margin-top: 2px;
  }
}
```

(`.form-check.bb-check-danger .form-check-input:checked` only overrides the checkbox's own `background-color`/`border-color` - it does not touch the app-wide checkmark `background-image` rule from the theme files, which still draws its check glyph on top; since the theme files already draw that checkmark in a light/contrasting color for the `danger` variant specifically via the existing `bb-check-danger` scope in `_theme-utils.scss`'s check-marker-colors map, the check glyph should already read correctly against the new solid red fill without further changes - verify this in the Step 6 visual pass.)

- [ ] **Step 5: Lint and build**

Run: `npm run lint`
Expected: exits 0, no warnings.

Run: `npm run build --workspace=packages/app`
Expected: build succeeds.

- [ ] **Step 6: Defer visual check**

Note in your report: a human needs to trigger a delete-torrent confirmation (select 1+ torrents, delete), check the "Also delete the files on disk" checkbox, and confirm: the checkbox fills solid red with a legible check glyph when checked (not just an outlined box with a colored checkmark), and the disk-space warning appears as a bordered/tinted red callout box with a warning-triangle icon to its left, not a bare paragraph of red text.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/modals/delete-torrent/delete-torrent.html packages/app/src/app/modals/delete-torrent/delete-torrent.scss packages/app/src/app/modals/delete-torrent/delete-torrent.ts
git commit -m "$(cat <<'EOF'
#267: solid-fill checkbox and warning callout in Delete Torrent

Scoped to this one modal via the existing bb-check-danger class - the
app-wide checkbox style (outline box + colored checkmark, used
everywhere else) is untouched. The disk-space warning is now a
bordered, tinted callout with an icon instead of a bare paragraph.
EOF
)"
```

---

## Task 4: Unify the main window header (merge brand block and toolbar into one bar)

**Context:** `packages/app/src/app/pages/main/main.html:1-19` already places the brand block (`.bb-brand`) and `<app-button-bar>` inside one `<header>` flex row - structurally they're already siblings in the same bar. The visual gap is that `app-button-bar`'s own template wraps everything in `.bb-toolbar` (`button-bar.scss:7-21`), which gives _itself_ a border, 14px radius, translucent background, and `backdrop-filter: blur(8px)` - so it renders as a separate floating pill sitting inside the header, visually detached from the brand block next to it, rather than both sharing one flat, full-width bordered bar the way the mockup's `.app-header` does. This task removes the toolbar's own box styling (letting it sit flush inside the header instead) and adds the header-level border and a divider between the brand block and the toolbar.

**Files:**

- Modify: `packages/app/src/app/pages/main/main.scss`
- Modify: `packages/app/src/app/pages/main/button-bar/button-bar.scss:7-21`

**Interfaces:** None - pure CSS restructuring of existing elements; no template changes in either component (the divider is added via a CSS pseudo-element on the existing `.bb-brand` element, not a new DOM node, to avoid touching `main.html`).

- [ ] **Step 1: Update `main.scss`**

In `packages/app/src/app/pages/main/main.scss`, change:

```scss
:host {
  --bb-sidebar-width: 300px;
}

.bb-sidebar-width {
  width: var(--bb-sidebar-width);
}
```

to:

```scss
:host {
  --bb-sidebar-width: 300px;
}

.bb-sidebar-width {
  width: var(--bb-sidebar-width);
}

header {
  border-bottom: 1px solid var(--bs-border-color);
}
```

(Leave everything else in the file - `.min-h-0`, `.min-w-0`, `.bb-brand` and its nested `.brand-title`/`small` rules - unchanged.)

Then, still in the same file, change the `.bb-brand` block from:

```scss
.bb-brand {
  .brand-title {
    font-size: 2rem;
    font-weight: 700;
  }

  small {
    color: var(--bs-secondary);
    margin-top: -10px;
    padding: 0 5px;
    display: block;
    width: calc(--bb-sidebar-width / 2);
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
  }
}
```

to:

```scss
.bb-brand {
  position: relative;
  border-right: 1px solid var(--bs-border-color);

  .brand-title {
    font-size: 2rem;
    font-weight: 700;
  }

  small {
    color: var(--bs-secondary);
    margin-top: -10px;
    padding: 0 5px;
    display: block;
    width: calc(--bb-sidebar-width / 2);
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
  }
}
```

(Only `position: relative;` and `border-right: 1px solid var(--bs-border-color);` are added; every existing declaration stays. The `border-right` is what creates the mockup's vertical divider between the brand block and the toolbar - `.bb-brand` is already exactly `var(--bb-sidebar-width)` wide via the `.bb-sidebar-width` class already on it in `main.html:4`, and already sits directly against the toolbar in the flex row, so a right border on it reads as a full-height divider without any new DOM element.)

- [ ] **Step 2: Update `button-bar.scss`**

In `packages/app/src/app/pages/main/button-bar/button-bar.scss`, change:

```scss
.bb-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;

  width: 100%;
  min-width: 0;

  padding: 8px 10px;
  border-radius: 14px;

  background: color-mix(in srgb, var(--bs-dropdown-bg) 88%, transparent);
  border: 1px solid var(--bs-border-color);
  backdrop-filter: blur(8px);
}
```

to:

```scss
.bb-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;

  width: 100%;
  min-width: 0;

  padding: 12px 20px;
}
```

(Every declaration that made `.bb-toolbar` look like its own separate floating panel - `border-radius`, `background`, `border`, `backdrop-filter` - is removed. `padding` is increased from `8px 10px` to `12px 20px` to match the mockup's more generous header padding, now that the toolbar shares the header's own border/background instead of drawing its own.)

- [ ] **Step 3: Lint and build**

Run: `npm run lint`
Expected: exits 0, no warnings.

Run: `npm run build --workspace=packages/app`
Expected: build succeeds.

- [ ] **Step 4: Defer visual check**

Note in your report: a human needs to look at the main torrent view and confirm the header now reads as one continuous bordered bar (a single bottom border spanning the full window width, not two separate boxes), with a vertical divider between the BitButler logo/server-name block and the toolbar buttons, and that the toolbar buttons no longer sit inside their own separately-bordered/blurred pill. Also confirm the toolbar's search input (`.bb-toolbar__search`, unchanged by this task) still reads clearly against the flatter header background.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/pages/main/main.scss packages/app/src/app/pages/main/button-bar/button-bar.scss
git commit -m "$(cat <<'EOF'
#267: unify the header into one bordered bar instead of two floating boxes

The brand block and toolbar already shared one flex header row in the
template, but the toolbar drew its own separate rounded/blurred panel
inside it, reading as a distinct floating pill next to the brand block.
Removed the toolbar's own box styling and added a header-level border
plus a divider on the brand block, matching the approved mockup's single
unified header bar. No buttons, search, or toolbar behavior changed.
EOF
)"
```

---

## Task 5: Sidebar filter list - solid-fill active state

**Context:** The sidebar's filter groups (Status/Trackers/Categories/Tags/Save Paths, rendered by `filter-group.html`/`filter-group.scss`) already use Bootstrap's `.list-group-item-action` with an `.active` modifier class bound to selection state (`filter-group.html:39` and `:55`). Today's active-state styling (`filter-group.scss:10-19`):

```scss
&.active {
  background-color: var(--bb-active-list-item-bg);
  color: var(--bs-body-color);
  border-color: var(--bb-active-list-item-bg) !important;

  .bb-status-badge.bb-status-badge--neutral {
    background-color: var(--bb-accent);
    color: var(--bb-primary-ink);
  }
}
```

`--bb-active-list-item-bg` (defined per-theme, e.g. `bitbutler/_dark.scss:81`) is a translucent accent tint (`color-mix(in srgb, var(--bb-accent) 18%, transparent)`), and the row's own text color stays the neutral `--bs-body-color` - only the small count badge gets a solid accent fill. The mockup's active nav item instead fills the _entire row_ solid with the accent color and flips _all_ the row's text/count color to the ink-contrast color (`--bb-accent-ink` equivalent), reading as a clear "pill" selection rather than a subtle tint. This task changes the active state to a solid fill and updates the row's own text/badge colors to match, using tokens the theme system already defines for exactly this purpose (`--bb-primary-ink`, already used by the neutral badge one line below, generalizes correctly here since every theme defines both `--bb-primary-ink` and `--bb-accent`/`--bb-primary` as a matched pair).

**Files:**

- Modify: `packages/app/src/app/pages/main/status/filter-group/filter-group.scss:10-19`

**Interfaces:** None - CSS-only, no template change; the same `.active` class the template already toggles is being restyled, not renamed.

- [ ] **Step 1: Confirm the current rule**

Run: `grep -n "&.active" packages/app/src/app/pages/main/status/filter-group/filter-group.scss`
Expected: one match near line 10.

- [ ] **Step 2: Replace the block**

Change:

```scss
&.active {
  background-color: var(--bb-active-list-item-bg);
  color: var(--bs-body-color);
  border-color: var(--bb-active-list-item-bg) !important;

  .bb-status-badge.bb-status-badge--neutral {
    background-color: var(--bb-accent);
    color: var(--bb-primary-ink);
  }
}
```

to:

```scss
&.active {
  background-color: var(--bb-accent);
  color: var(--bb-primary-ink);
  border-color: var(--bb-accent) !important;
  font-weight: 600;

  .bb-status-badge {
    background-color: color-mix(in srgb, var(--bb-primary-ink) 18%, transparent) !important;
    color: var(--bb-primary-ink) !important;
  }
}
```

(The badge rule is widened from `.bb-status-badge.bb-status-badge--neutral` to plain `.bb-status-badge` with `!important` on both properties, so it also overrides the colored `text-bg-{variant}` badges used by non-neutral filter items - e.g. a "Downloading" status row with a `bb-variant-info` badge should still read as a legible ink-on-ink-tint chip when that row becomes the active selection, not clash by keeping its own unrelated info-blue fill against the new solid accent row background.)

- [ ] **Step 3: Lint and build**

Run: `npm run lint`
Expected: exits 0, no warnings.

Run: `npm run build --workspace=packages/app`
Expected: build succeeds.

- [ ] **Step 4: Defer visual check**

Note in your report: a human needs to click through each sidebar filter group (Status, Trackers, Categories, Tags, Save Paths) and confirm the selected/active row now fills solid with the accent color and the row's label text and count badge both read clearly in a contrasting ink color, in both light and dark mode, and specifically check a non-neutral-badge row (e.g. a status row that has a colored variant badge, if any currently show as active) to confirm the badge override doesn't produce illegible contrast.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/pages/main/status/filter-group/filter-group.scss
git commit -m "$(cat <<'EOF'
#267: solid-fill the sidebar's active filter row

The active state was a subtle translucent accent tint with only the
count badge solid-filled. Matches the approved mockup's fully solid
accent-filled pill selection instead, with the row's text and badge
both flipping to the theme's ink-contrast color.
EOF
)"
```

---

## Task 6: Torrent grid - fix the progress bar's low-contrast track

**Context:** `bb-progress.scss:6-12` sets the progress bar's _track_ (the empty/background portion, visible where the fill hasn't reached) to `background-color: rgba(255, 255, 255, 0.08)` - a nearly-transparent white overlay. Against the app's very dark backgrounds (e.g. `bitbutler` dark theme's `--bs-body-bg: #121213`), an 8%-opacity white overlay is close to imperceptible, which is exactly what the running app's screenshot showed: progress bars that read as blank space rather than a visible track, especially for the many 0%-progress rows in the default seed data. The _fill_ itself already uses themed, fully-opaque Bootstrap variant colors (`.bg-info`/`.bg-success`/etc. via `torrent-state-variant.ts`) and is not the problem. This task swaps the track to a solid, already-themed token (`--bb-control-bg`, the same background every form input already uses) so the track is clearly visible against the row background in every theme, light or dark, without introducing a new custom property.

**Files:**

- Modify: `packages/app/src/app/components/bb-progress/bb-progress.scss:6-12`

**Interfaces:** None - CSS-only, one property value change.

- [ ] **Step 1: Confirm the current rule**

Run: `grep -n "background-color: rgba(255, 255, 255, 0.08)" packages/app/src/app/components/bb-progress/bb-progress.scss`
Expected: one match on line 8.

- [ ] **Step 2: Change the track color**

Change:

```scss
.bb-progress {
  height: 18px !important;
  background-color: rgba(255, 255, 255, 0.08);
  border-radius: 12px !important;
```

to:

```scss
.bb-progress {
  height: 18px !important;
  background-color: var(--bb-control-bg);
  border-radius: 12px !important;
```

(Only the `background-color` line changes; `height`, `border-radius`, and everything else in the file stays exactly as-is - the 18px height and 12px radius are already generous and already match the mockup's intent, they just weren't visible against the old track color.)

- [ ] **Step 3: Lint and build**

Run: `npm run lint`
Expected: exits 0, no warnings.

Run: `npm run build --workspace=packages/app`
Expected: build succeeds.

- [ ] **Step 4: Defer visual check**

Note in your report: a human needs to look at the main torrent grid's Progress column across several rows at different percentages (including 0%) and confirm the track is now clearly visible as a distinct rounded bar shape (not blank space) in both light and dark mode, and that the percentage label text overlaid on the bar (drawn via the existing `background-clip: text` gradient trick in `bb-progress.scss:24-49`, unchanged by this task) is still legible against the new track color.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/bb-progress/bb-progress.scss
git commit -m "$(cat <<'EOF'
#267: fix the torrent grid progress bar's low-contrast track

The track (the empty portion of the bar) was an 8%-opacity white
overlay, nearly invisible against the app's dark backgrounds - this is
why progress bars in the running app read as blank space rather than a
visible bar, especially for 0%-progress rows. Swapped to the same solid
--bb-control-bg token every form input already uses, so the track is
clearly visible in every theme without a new custom property.
EOF
)"
```

---

## Task 7: Full cross-theme, cross-modal human visual verification pass

**Context:** Tasks 1-6 are all shared/global changes (a modal-open config change plus five scoped CSS changes), so their effects cascade automatically across every screen and every theme - but every task above deferred its own visual check, since no implementer in this plan has GUI access. This task is the single consolidated pass that actually has to happen before this phase is considered done. It does not modify any code.

**Files:** None modified in this task.

**Interfaces:** None.

- [ ] **Step 1: Full lint and test run**

Run: `npm run lint`
Expected: exits 0.

Run: `npm test`
Expected: all tests pass. This plan makes no `.ts` logic changes (Task 3's `.ts` edit is an icon-import/icon-map addition, not logic), so no test should need updating.

Note: if `packages/electron`'s tests fail with a `better-sqlite3` / `NODE_MODULE_VERSION` mismatch error, that's a native-module ABI mismatch between the Node version `npm test` runs under and whichever Node version the module was last built for - unrelated to this plan's changes. Fix with `npm rebuild` before re-running. If you subsequently need to run the Electron app itself (`npm start`), re-run `npx electron-rebuild -f -w better-sqlite3` afterward - the two rebuild targets are different and running one leaves the other broken; this is a pre-existing characteristic of this project's native dependency, not something to fix as part of this plan.

- [ ] **Step 2: Human visual pass**

Run `npm start`. Check each of the following, in **both** `bitbutler` light and dark mode, plus one additional theme in dark mode (e.g. `purple-haze`, already color-corrected in the prior phase):

- **Login screen** - confirm no regression (this plan does not touch Login; it should look exactly as it did after the prior phase).
- **Main torrent view** - the header now reads as one bordered bar with a divider between brand and toolbar (Task 4); the sidebar's active filter row is a solid accent-filled pill (Task 5); the grid's progress bars have a clearly visible track at every percentage including 0% (Task 6).
- **Settings modal** - opens centered, narrower, with 18px rounded corners (Task 1); tabs show a clean underline instead of boxed borders (Task 2); confirm the modal is still `scrollable` and long content (General tab) scrolls inside it rather than growing past the viewport.
- **Add Torrent modal** - same shell/tab checks as Settings (Tasks 1-2); confirm the File/Link/Folder segmented control and all form fields still work exactly as before (no functional change was made here).
- **Torrent Details modal**, opened both by double-clicking a row and via its toolbar/context-menu action - same shell/tab checks (Tasks 1-2); confirm the footer's delete button, and all four dropdown button groups (Control/Files/Manage/Transfer) plus Close are all still present and functional (Task 1 changed only the modal's size/position, not its footer).
- **Delete Torrent modal** - the "Also delete files on disk" checkbox fills solid red with a legible check when checked, and the disk-space warning renders as a bordered/tinted callout with an icon (Task 3).

- [ ] **Step 3: Note any regressions found**

If anything looks broken (a modal too narrow for its content, a tab strip icon clipped, a checkbox glyph illegible against its new fill, contrast issues on the sidebar's colored-badge active state), fix it as a follow-up to the specific task that caused it, re-run that task's lint/build steps, and re-check here. Do not move on to opening a PR until this checklist is clean.

---

## After all tasks are complete

Per this repo's CLAUDE.md conventions:

1. This plan lives in `docs/superpowers/plans/` on the feature branch, which is fine to keep committed while work is in progress (it allows resuming from a different machine/session).
2. Before opening the PR, remove the entire `docs/superpowers/` folder in its own commit (e.g. `#267: removed spec and plan`) - it must not be merged to `main`.
3. Read `.github/pull_request_template.md` and use it as the exact structure for the PR body via `gh pr create`. Include `Fixes #267` in the description.
4. The PR title should be a clean description with no issue ID prefix, e.g. "Refresh UI with a Claude-inspired design language across all themes".
5. This is the same issue/branch as the prior phase (7 commits already on it: mint-green/purple-haze color fixes, `.bb-fieldset` redesign, button/grid radius unification, Login button variant, and the final-review fix wave). Do not open a second PR for this phase - it's additional commits on the same branch, reviewed and merged together with the prior phase's work.
