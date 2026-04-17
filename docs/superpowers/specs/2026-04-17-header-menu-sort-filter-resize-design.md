# Header Context Menu — Sort, Filter & Resize Actions

**Date:** 2026-04-17  
**Status:** Approved

## Overview

Extend the column header context menu (`buildHeaderMenu`) with three new submenus: **Sort**, **Filter**, and **Resize**. All additions use ag-grid Community APIs only — no Enterprise license required.

---

## Updated Menu Structure

```
[column display name]         ← header (existing)
Sort ▶                        ← new submenu
Filter ▶                      ← new submenu
Pin Column ▶                  ← existing submenu (unchanged)
Resize ▶                      ← new submenu
Hide column                   ← existing item (unchanged)
──────────────────────────────
[Fields header + toggles]     ← existing (unchanged)
──────────────────────────────
[Visibility header]           ← existing (unchanged)
Show All / Hide All           ← existing (unchanged)
```

The standalone "Clear filter" item is **removed** from the top level and **absorbed** into the Filter submenu.

---

## Sort Submenu

**Trigger item:** `id: 'sort'`, label `submenu.sort`, icon `faSort`

| Item | id | Label key | Icon | Disabled when |
|------|----|-----------|------|---------------|
| Sort Ascending | `sort.asc` | `item.sort-ascending` | `faSortUp` | `column.getSort() === 'asc'` |
| Sort Descending | `sort.desc` | `item.sort-descending` | `faSortDown` | `column.getSort() === 'desc'` |
| Clear Sort | `sort.clear` | `item.clear-sort` | `faXmark` | `!column.getSort()` |

**Implementation:**

```typescript
// Sort ascending
api.applyColumnState({ state: [{ colId: payload.colId, sort: 'asc' }] });

// Sort descending
api.applyColumnState({ state: [{ colId: payload.colId, sort: 'desc' }] });

// Clear sort
api.applyColumnState({ state: [{ colId: payload.colId, sort: null }] });
```

---

## Filter Submenu

**Trigger item:** `id: 'filter'`, label `submenu.filter`, icon `faFilter`

| Item | id | Label key | Icon | Disabled when |
|------|----|-----------|------|---------------|
| Open Filter | `filter.open` | `item.open-filter` | `faFilter` | `column.getColDef().filter === false` |
| Clear Filter | `filter.clear` | `item.clear-filter` | `faFilterCircleXmark` | `!column.isFilterActive()` |
| Show Floating Filters / Hide Floating Filters | `filter.toggleFloating` | dynamic (see below) | `faEye` / `faEyeSlash` | — |

**Dynamic label/icon for floating filter toggle:**  
Read `api.getGridOption('floatingFilter')` at menu-build time:
- If `true` (floating filters visible): label `item.hide-floating-filters`, icon `faEyeSlash`
- If `false` / `undefined`: label `item.show-floating-filters`, icon `faEye`

**Implementation:**

```typescript
// Open filter popup
api.showColumnFilter(payload.colId);

// Clear filter (same as existing standalone item)
this.filterService.clearColumnFilter(payload.colId);

// Toggle floating filter (global)
api.setGridOption('floatingFilter', !api.getGridOption('floatingFilter'));
```

---

## Resize Submenu

**Trigger item:** `id: 'resize'`, label `submenu.resize`, icon `faArrowsLeftRight`

| Item | id | Label key | Icon |
|------|----|-----------|------|
| Auto-size This Column | `resize.column` | `item.autosize-column` | `faArrowsLeftRight` |
| Auto-size All Columns | `resize.all` | `item.autosize-all-columns` | `faArrowsLeftRight` |

**Implementation:**

```typescript
// Auto-size this column
api.autoSizeColumn(payload.colId);

// Auto-size all columns
api.autoSizeAllColumns();
```

---

## i18n Keys

### New keys to add (`us.json` and `hu.json`)

Under `pages.main.grid.context-menu`:

```json
"submenu": {
  "sort": "Sort",
  "filter": "Filter",
  "resize": "Resize"
},
"item": {
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

The existing `item.clear-filter` key is reused inside the Filter submenu — no key change needed.

---

## Files to Change

| File | Change |
|------|--------|
| `grid-context-menu.service.ts` | Add Sort, Filter, Resize submenus; remove standalone clear-filter item |
| `public/i18n/us.json` | Add new submenu and item keys |
| `public/i18n/hu.json` | Add new submenu and item keys (Hungarian) |

No new files. `context-menu.types.ts`, `context-menu.ts`, `context-menu.html`, and `context-menu.scss` are unchanged.
