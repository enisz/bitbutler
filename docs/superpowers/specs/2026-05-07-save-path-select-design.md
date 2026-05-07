# Save Path Select Component — Design Spec

**Date:** 2026-05-07  
**Branch:** 66-changing-add-torrent-view

## Summary

Replace all `ngbTypeahead`-based save-path inputs with a new reusable `save-path-select` component backed by `ng-select`. The component follows the existing `category-select` / `tag-select` pattern. `TypeaheadService` is deleted once it has no remaining consumers.

---

## New Component: `save-path-select`

**Location:** `packages/app/src/app/components/save-path-select/`

**Files:**

- `save-path-select.ts`
- `save-path-select.html`
- `save-path-select.scss`
- `save-path-select.spec.ts`

### Behaviour

- Standalone `ControlValueAccessor` wrapping `ng-select` (mirrors `category-select` exactly)
- `selectControl: FormControl<string | null>` — single-select
- `paths` signal derived from `TorrentStoreService.torrentsArray()` — unique, sorted `save_path` values (same logic currently in `TypeaheadService.paths`)
- `[addTag]` handler returns the typed term as-is with no backend call, allowing free-form new paths
- `[searchable]="true"`, `[clearable]="true"`
- `@Input() autofocus = false` — focuses `ng-select` on `AfterViewInit` when true
- `keyDownFn` blocks Escape from propagating (same as other select components)

---

## Modified Components

### `add-torrent`

- Replace the `<input ngbTypeahead>` savepath block with `<app-save-path-select formControlName="savepath">`
- Remove `NgbTypeahead` from imports
- Remove `TypeaheadService` injection and `searchSavePaths` / `savePathControl` references

### `set-torrent-location`

- Replace the `<input ngbTypeahead>` with `<app-save-path-select formControlName="path" [autofocus]="true">`
- Remove `NgbTypeahead`, `AutofocusDirective`, `TypeaheadService` from imports/injections
- Remove `savePathControl` and `searchSavePaths` references

### `server/server.ts` (path mappings)

- Replace the `remote` path `<input [ngbTypeahead]="searchSavePaths">` inputs with `<app-save-path-select formControlName="remote">`
- Remove `NgbTypeahead` and `TypeaheadService` from imports/injections
- The `local` path field is unchanged (local filesystem path with Browse button)

---

## Deleted Files

- `packages/app/src/app/services/typeahead.service.ts`
- `packages/app/src/app/services/typeahead.service.spec.ts`

`TypeaheadService` has no remaining consumers after the above changes.

---

## Out of Scope

- No changes to context menu wiring, command bus, or IPC
- No new translation keys
- No changes to the `local` path field in server settings
