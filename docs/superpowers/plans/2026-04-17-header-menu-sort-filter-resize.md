# Header Menu Sort, Filter & Resize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Sort, Filter, and Resize submenus to the column header context menu in the ag-grid torrent list.

**Architecture:** All changes are confined to `grid-context-menu.service.ts` (logic) and the two i18n locale files. `buildHeaderMenu()` is a synchronous method that receives the full ag-grid `api` and `column` objects, so every ag-grid Community API call can be made inline. No new files, no new Angular services.

**Tech Stack:** Angular 20 (zoneless, signals), ag-grid Community 35, FontAwesome 6 free-solid, @ngx-translate

---

## File Map

| File | Change |
|------|--------|
| `public/i18n/us.json` | Add 3 submenu keys + 8 item keys |
| `public/i18n/hu.json` | Same keys with Hungarian translations |
| `src/app/pages/main/grid/context-menu/grid-context-menu.service.ts` | Add Sort/Filter/Resize submenus; absorb standalone clear-filter into Filter submenu; fix ordering |

---

### Task 1: Add i18n keys

**Files:**
- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

- [ ] **Step 1: Add submenu keys to us.json**

In `public/i18n/us.json`, locate the `"submenu"` object under `pages.main.grid.context-menu` and add the three new keys. The object currently ends with `"pin-column": "Pin Column"`:

```json
"submenu": {
  "copy": "Copy",
  "pin-row": "Pin Row",
  "files": "Files",
  "speed": "Speed",
  "maintenance": "Maintenance",
  "queue": "Queue",
  "pin-column": "Pin Column",
  "sort": "Sort",
  "filter": "Filter",
  "resize": "Resize"
},
```

- [ ] **Step 2: Add item keys to us.json**

In `public/i18n/us.json`, locate the `"item"` object and add the eight new keys after `"unpin-column": "Unpin column"`:

```json
"item": {
  ...existing keys...,
  "unpin-column": "Unpin column",
  "sort-ascending": "Sort Ascending",
  "sort-descending": "Sort Descending",
  "clear-sort": "Clear Sort",
  "open-filter": "Open Filter",
  "show-floating-filters": "Show Floating Filters",
  "hide-floating-filters": "Hide Floating Filters",
  "autosize-column": "Auto-size This Column",
  "autosize-all-columns": "Auto-size All Columns"
}
```

- [ ] **Step 3: Add submenu keys to hu.json**

In `public/i18n/hu.json`, locate the `"submenu"` object and add:

```json
"submenu": {
  "copy": "Másolás",
  "pin-row": "Sor rögzítése",
  "files": "Fájlok",
  "speed": "Sebesség",
  "maintenance": "Karbantartás",
  "queue": "Sor",
  "pin-column": "Oszlop rögzítése",
  "sort": "Rendezés",
  "filter": "Szűrő",
  "resize": "Átméretezés"
},
```

- [ ] **Step 4: Add item keys to hu.json**

In `public/i18n/hu.json`, locate the `"item"` object and add after `"unpin-column"`:

```json
"item": {
  ...existing keys...,
  "unpin-column": "Oszlop rögzítésének feloldása",
  "sort-ascending": "Növekvő rendezés",
  "sort-descending": "Csökkenő rendezés",
  "clear-sort": "Rendezés törlése",
  "open-filter": "Szűrő megnyitása",
  "show-floating-filters": "Lebegő szűrők megjelenítése",
  "hide-floating-filters": "Lebegő szűrők elrejtése",
  "autosize-column": "Oszlop automatikus méretezése",
  "autosize-all-columns": "Összes oszlop automatikus méretezése"
}
```

- [ ] **Step 5: Run lint**

```bash
npm run lint
```

Expected: no output (clean exit).

- [ ] **Step 6: Commit**

```bash
git add public/i18n/us.json public/i18n/hu.json
git commit -m "#31: add i18n keys for sort, filter, resize header menu submenus"
```

---

### Task 2: Add Sort submenu

**Files:**
- Modify: `src/app/pages/main/grid/context-menu/grid-context-menu.service.ts`

- [ ] **Step 1: Add new icon imports**

In `grid-context-menu.service.ts`, the FontAwesome import block currently reads:

```typescript
import {
  faArrowDown,
  faArrowLeft,
  faArrowRight,
  faArrowsDownToLine,
  faArrowsUpToLine,
  faArrowUp,
  faBullhorn,
  faCheck,
  faCode,
  faCopy,
  faDownload,
  faEye,
  faEyeSlash,
  faFilePen,
  faFilterCircleXmark,
  faFolderOpen,
  faFolderTree,
  faForwardFast,
  faHashtag,
  faInfoCircle,
  faLink,
  faPause,
  faPen,
  faPlay,
  faRotate,
  faShare,
  faTags,
  faTrashCan,
  faUpload,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
```

Replace it with (added `faArrowsLeftRight`, `faFilter`, `faSort`, `faSortDown`, `faSortUp`):

```typescript
import {
  faArrowDown,
  faArrowLeft,
  faArrowRight,
  faArrowsDownToLine,
  faArrowsLeftRight,
  faArrowsUpToLine,
  faArrowUp,
  faBullhorn,
  faCheck,
  faCode,
  faCopy,
  faDownload,
  faEye,
  faEyeSlash,
  faFilePen,
  faFilter,
  faFilterCircleXmark,
  faFolderOpen,
  faFolderTree,
  faForwardFast,
  faHashtag,
  faInfoCircle,
  faLink,
  faPause,
  faPen,
  faPlay,
  faRotate,
  faShare,
  faSort,
  faSortDown,
  faSortUp,
  faTags,
  faTrashCan,
  faUpload,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
```

- [ ] **Step 2: Add Sort submenu to buildHeaderMenu**

In `buildHeaderMenu`, the `items` array currently starts with:

```typescript
const items: ContextMenuEntry[] = [
  { kind: 'header', label: payload.displayName },
  {
    kind: 'item',
    id: `toggle.${payload.colId}`,
    label: 'pages.main.grid.context-menu.item.hide-column',
    icon: faEyeSlash,
    action: () => { ... },
  },
  {
    kind: 'item',
    id: `clearFilter.${payload.colId}`,
    label: 'pages.main.grid.context-menu.item.clear-filter',
    icon: faFilterCircleXmark,
    disabled: !column.isFilterActive(),
    action: () => { ... },
  },
  {
    kind: 'submenu',
    id: `pin.${payload.colId}`,
    ...
  },
```

Replace the opening of `items` so that the Sort submenu appears right after the header, before the existing items. The Sort submenu reads the active sort state from `column.getSort()` at menu-open time:

```typescript
const items: ContextMenuEntry[] = [
  { kind: 'header', label: payload.displayName },
  // ── Sort submenu ────────────────────────────────────────────────────
  {
    kind: 'submenu',
    id: `sort.${payload.colId}`,
    label: 'pages.main.grid.context-menu.submenu.sort',
    icon: faSort,
    children: [
      {
        kind: 'item',
        id: `sort.asc.${payload.colId}`,
        label: 'pages.main.grid.context-menu.item.sort-ascending',
        icon: faSortUp,
        disabled: column.getSort() === 'asc',
        action: () =>
          api.applyColumnState({ state: [{ colId: payload.colId, sort: 'asc' }] }),
      },
      {
        kind: 'item',
        id: `sort.desc.${payload.colId}`,
        label: 'pages.main.grid.context-menu.item.sort-descending',
        icon: faSortDown,
        disabled: column.getSort() === 'desc',
        action: () =>
          api.applyColumnState({ state: [{ colId: payload.colId, sort: 'desc' }] }),
      },
      {
        kind: 'item',
        id: `sort.clear.${payload.colId}`,
        label: 'pages.main.grid.context-menu.item.clear-sort',
        icon: faXmark,
        disabled: !column.getSort(),
        action: () =>
          api.applyColumnState({ state: [{ colId: payload.colId, sort: null }] }),
      },
    ],
  },
  {
    kind: 'item',
    id: `toggle.${payload.colId}`,
    ...rest of existing items unchanged...
```

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: clean exit.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/main/grid/context-menu/grid-context-menu.service.ts
git commit -m "#31: add Sort submenu to header context menu"
```

---

### Task 3: Add Filter submenu and absorb clear-filter

**Files:**
- Modify: `src/app/pages/main/grid/context-menu/grid-context-menu.service.ts`

- [ ] **Step 1: Replace standalone clear-filter item with Filter submenu**

In `buildHeaderMenu`, remove the standalone clear-filter item:

```typescript
// REMOVE THIS:
{
  kind: 'item',
  id: `clearFilter.${payload.colId}`,
  label: 'pages.main.grid.context-menu.item.clear-filter',
  icon: faFilterCircleXmark,
  disabled: !column.isFilterActive(),
  action: () => {
    this.filterService.clearColumnFilter(payload.colId);
  },
},
```

And insert a Filter submenu in its place (between Sort and Pin):

```typescript
// ── Filter submenu ───────────────────────────────────────────────────
{
  kind: 'submenu',
  id: `filter.${payload.colId}`,
  label: 'pages.main.grid.context-menu.submenu.filter',
  icon: faFilter,
  children: [
    {
      kind: 'item',
      id: `filter.open.${payload.colId}`,
      label: 'pages.main.grid.context-menu.item.open-filter',
      icon: faFilter,
      disabled: column.getColDef().filter === false,
      action: () => api.showColumnFilter(payload.colId),
    },
    {
      kind: 'item',
      id: `filter.clear.${payload.colId}`,
      label: 'pages.main.grid.context-menu.item.clear-filter',
      icon: faFilterCircleXmark,
      disabled: !column.isFilterActive(),
      action: () => this.filterService.clearColumnFilter(payload.colId),
    },
    {
      kind: 'item',
      id: `filter.toggleFloating.${payload.colId}`,
      label:
        api.getGridOption('floatingFilter') === true
          ? 'pages.main.grid.context-menu.item.hide-floating-filters'
          : 'pages.main.grid.context-menu.item.show-floating-filters',
      icon: api.getGridOption('floatingFilter') === true ? faEyeSlash : faEye,
      action: () =>
        api.setGridOption('floatingFilter', !api.getGridOption('floatingFilter')),
    },
  ],
},
```

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: clean exit.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/main/grid/context-menu/grid-context-menu.service.ts
git commit -m "#31: add Filter submenu to header context menu; absorb clear-filter"
```

---

### Task 4: Add Resize submenu and verify final ordering

**Files:**
- Modify: `src/app/pages/main/grid/context-menu/grid-context-menu.service.ts`

- [ ] **Step 1: Add Resize submenu between Pin and Hide column**

In `buildHeaderMenu`, the current order after Filter is: Pin submenu → Hide column. Insert Resize between Pin and Hide:

```typescript
// ── Resize submenu ───────────────────────────────────────────────────
{
  kind: 'submenu',
  id: `resize.${payload.colId}`,
  label: 'pages.main.grid.context-menu.submenu.resize',
  icon: faArrowsLeftRight,
  children: [
    {
      kind: 'item',
      id: `resize.column.${payload.colId}`,
      label: 'pages.main.grid.context-menu.item.autosize-column',
      icon: faArrowsLeftRight,
      action: () => api.autoSizeColumn(payload.colId),
    },
    {
      kind: 'item',
      id: `resize.all.${payload.colId}`,
      label: 'pages.main.grid.context-menu.item.autosize-all-columns',
      icon: faArrowsLeftRight,
      action: () => api.autoSizeAllColumns(),
    },
  ],
},
```

- [ ] **Step 2: Verify the complete items array ordering**

After this step, the `items` array in `buildHeaderMenu` must read in this order:

```
{ kind: 'header', label: payload.displayName }
{ kind: 'submenu', id: `sort.${payload.colId}`, ... }       // Sort ▶
{ kind: 'submenu', id: `filter.${payload.colId}`, ... }     // Filter ▶
{ kind: 'submenu', id: `pin.${payload.colId}`, ... }        // Pin Column ▶
{ kind: 'submenu', id: `resize.${payload.colId}`, ... }     // Resize ▶
{ kind: 'item',    id: `toggle.${payload.colId}`, ... }     // Hide Column
{ kind: 'divider' }
{ kind: 'header', label: '...header.fields' }
...fields
{ kind: 'divider' }
{ kind: 'header', label: '...header.visibility' }
{ kind: 'item', id: 'all.show', ... }
{ kind: 'item', id: 'all.hide', ... }
```

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: clean exit.

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/main/grid/context-menu/grid-context-menu.service.ts
git commit -m "#31: add Resize submenu to header context menu"
```
