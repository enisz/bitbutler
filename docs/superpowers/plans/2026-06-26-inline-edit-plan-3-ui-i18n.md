# Inline Cell Edit - Plan 3: Settings UI + i18n

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the "Inline Edit" dropdown option and its popover description to the torrent list grid settings page, with translations in both English and Hungarian.

**Architecture:** Purely additive template and JSON changes. The `RowDoubleClickAction` type already includes `'INLINE_EDIT'` (from Plan 1). No TypeScript logic changes needed here.

**Tech Stack:** Angular template, @ngx-translate, Bootstrap 5 (for `<ul>/<li>` in popover)

## Global Constraints

- Commit format: `#192: short description`
- Zero ESLint warnings: `npm run lint` must pass with exit 0
- **Prerequisite:** Plan 1 must be completed (`'INLINE_EDIT'` exists in `RowDoubleClickAction`)
- Hungarian translation must be provided (the project maintains both `us.json` and `hu.json` in sync)
- Toast/UI copy follows CLAUDE.md conventions: Title-Case titles, sentence-case descriptions
- Hyphen `-` not em dash `—` in all copy
- Issue: #192

---

### Task 1: Add i18n translation keys

**Files:**

- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

**Interfaces:**

- Produces translation keys consumed by Plan 3 Task 2 (the template):
  - `pages.settings.tab.torrent-list-grid.torrent-list-grid-form.row-double-click.value.inline-edit`
  - `pages.settings.tab.torrent-list-grid.popover.double-click-behavior.list-item-4`

- [ ] **Step 1: Add English keys to us.json**

In `public/i18n/us.json`, navigate to:

```
pages > settings > tab > torrent-list-grid > torrent-list-grid-form > row-double-click > value
```

The current `value` object looks like:

```json
"value": {
  "show": "Show in Folder / Open Destination",
  "details": "Open Torrent Details",
  "nothing": "Do nothing"
}
```

Add the new key after `"nothing"`:

```json
"value": {
  "show": "Show in Folder / Open Destination",
  "details": "Open Torrent Details",
  "nothing": "Do nothing",
  "inline-edit": "Inline Edit"
}
```

Then navigate to:

```
pages > settings > tab > torrent-list-grid > popover > double-click-behavior
```

The current object has `list-item-1`, `list-item-2`, `list-item-3`. Add `list-item-4` after `list-item-3`:

```json
"list-item-4": "<strong>Inline Edit</strong>: Makes eligible cells editable directly in the grid - double-click a cell to edit, Enter to confirm, Escape to cancel. Only columns with a direct qBittorrent API endpoint and no value formatter are editable."
```

- [ ] **Step 2: Add Hungarian keys to hu.json**

In `public/i18n/hu.json`, navigate to the same `value` object and add:

```json
"inline-edit": "Helyszíni szerkesztés"
```

Navigate to the same `popover > double-click-behavior` object and add:

```json
"list-item-4": "<strong>Helyszíni szerkesztés</strong>: Lehetővé teszi a megfelelő cellák közvetlen szerkesztését a rácsban - dupla kattintással szerkeszthető a cella, Enter-rel menthető, Escape-pel megszakítható. Csak azok az oszlopok szerkeszthetők, amelyekhez van közvetlen qBittorrent API végpont és nincs értékformázó."
```

- [ ] **Step 3: Verify lint passes**

```bash
npm run lint
```

Expected: exits 0. (Lint checks JSON formatting via Prettier.)

- [ ] **Step 4: Commit**

```bash
git add public/i18n/us.json public/i18n/hu.json
git commit -m "#192: add i18n keys for inline edit dropdown and popover"
```

---

### Task 2: Update the settings template

**Files:**

- Modify: `packages/app/src/app/pages/settings/torrent-list-grid/torrent-list-grid.html`

**Interfaces:**

- Consumes:
  - Translation keys from Task 1
  - `RowDoubleClickAction` value `'INLINE_EDIT'` from Plan 1

- [ ] **Step 1: Add the dropdown item**

In `torrent-list-grid.html`, find the `[items]` binding on the `ng-select` for `rowDoubleClickAction` (around line 163). It currently contains three items. Add a fourth after the `NONE` item:

```html
<ng-select
  [items]="[
                {
                  value: 'SAVE_PATH',
                  label:
                    'pages.settings.tab.torrent-list-grid.torrent-list-grid-form.row-double-click.value.show'
                    | translate,
                },
                {
                  value: 'DETAILS',
                  label:
                    'pages.settings.tab.torrent-list-grid.torrent-list-grid-form.row-double-click.value.details'
                    | translate,
                },
                {
                  value: 'NONE',
                  label:
                    'pages.settings.tab.torrent-list-grid.torrent-list-grid-form.row-double-click.value.nothing'
                    | translate,
                },
                {
                  value: 'INLINE_EDIT',
                  label:
                    'pages.settings.tab.torrent-list-grid.torrent-list-grid-form.row-double-click.value.inline-edit'
                    | translate,
                },
              ]"
  bindValue="value"
  bindLabel="label"
  formControlName="rowDoubleClickAction"
  [clearable]="false"
  [searchable]="false"
  id="rowDoubleClickAction"
  appendTo="body"
>
</ng-select>
```

- [ ] **Step 2: Add the fourth popover list item**

In the same file, find `<ng-template #doubleClickBehavior>` (around line 273). It currently has three `<li>` elements. Add a fourth after the third:

```html
<li
  [innerHTML]="
        'pages.settings.tab.torrent-list-grid.popover.double-click-behavior.list-item-4' | translate
      "
></li>
```

- [ ] **Step 3: Verify lint passes**

```bash
npm run lint
```

Expected: exits 0, no warnings.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/pages/settings/torrent-list-grid/torrent-list-grid.html
git commit -m "#192: add Inline Edit option to row double-click behavior dropdown"
```
