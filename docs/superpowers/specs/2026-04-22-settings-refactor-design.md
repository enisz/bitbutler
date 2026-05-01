# Settings & TorrentDetails Refactor Design

**Date:** 2026-04-22  
**Branch:** 35-refactoring  
**Scope:** Settings modal (all 4 tabs) + TorrentDetails modal

---

## Problem

Both `Settings` and `TorrentDetails` use a single `loadedComponent` signal that destroys and recreates tab components on every switch. This causes:

- A spinner flicker on every tab switch (async `import()` on each visit)
- No possibility of tab-change animation
- In Settings: each tab auto-saves independently with a 1s debounce — no explicit Save button, no unsaved-change guard
- In Settings: theme family/mode changes apply instantly to the DOM, bypassing any save flow
- In TorrentDetails: tab switch triggers `canDeactivate` unnecessarily (state is lost because component is destroyed)

---

## Goals

- Pre-load all tab components in parallel on modal open — no spinner, no flicker
- Keep all loaded tab components alive in the DOM — CSS animation on tab switch
- Settings: centralise save logic, add explicit Save button, guard on unsaved changes, `*` on dirty tab labels
- Settings: theme changes only apply when the user clicks Save
- TorrentDetails: same loading/animation improvements; Content tab shows `*` when dirty

---

## Architecture

### Shared loading pattern (both modals)

Replace `loadedComponent = signal<Type | null>` with `loadedComponents = signal<Map<TabId, Type>>`.

On `ngOnInit`, fire all `loadComponent()` dynamic imports in parallel:

```typescript
const results = await Promise.all(
  this.tabs.map((t) => t.loadComponent().then((c) => [t.id, c] as const)),
);
this.loadedComponents.set(new Map(results));
```

The template renders every entry in the map simultaneously. Only the active panel is visible; inactive panels are hidden via CSS class. `selectTab` becomes a synchronous signal set — no async, no null transition.

### Shared CSS animation pattern (both modals)

```scss
.bb-tab-panels {
  position: relative;
}

.bb-tab-panel {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;

  &--active {
    position: relative;
    opacity: 1;
    pointer-events: auto;
  }
}
```

Active panel uses `position: relative` so it drives the container height. Inactive panels are `position: absolute; opacity: 0` — out of flow, invisible, non-interactive.

---

## Settings-specific changes

### `SettingsStateService`

New `@Injectable()` provided only in the `Settings` component (not root). Lives for the lifetime of the modal.

| Member                 | Type                                      | Description                                                      |
| ---------------------- | ----------------------------------------- | ---------------------------------------------------------------- |
| `dirtyTabs`            | `signal<Record<SettingsTabId, boolean>>`  | Per-tab dirty flag, all `false` on init                          |
| `isDirty`              | `computed<boolean>`                       | `true` if any tab is dirty — drives Save button disabled state   |
| `isDirtyMap`           | `computed<Record<...>>`                   | Exposes full record for template key access                      |
| `saveFns`              | `Map<SettingsTabId, () => Promise<void>>` | Registered save callbacks                                        |
| `markDirty(id, dirty)` | method                                    | Sets one tab's dirty flag                                        |
| `registerSave(id, fn)` | method                                    | Called by each tab on `ngOnInit`                                 |
| `saveAll()`            | `async` method                            | Runs all dirty save fns in parallel, resets all flags to `false` |

### `Settings` component

- Adds `providers: [SettingsStateService]`
- Implements `GuardableModal` (`canDeactivate()` checks `stateService.isDirty()`, shows confirm dialog if dirty)
- `onDismiss()` and `onClose()` both go through `canDeactivate()`
- Tab labels: `{{ tab.label | translate }}{{ stateService.isDirtyMap()[tab.id] ? ' *' : '' }}`
- Footer: Save button added next to Close; disabled when `!stateService.isDirty()`; click calls `stateService.saveAll()`

### Tab component changes

All four tabs:

- Remove `debounceTime` + auto-save `valueChanges` subscription
- `ngOnInit`: call `stateService.registerSave(tabId, () => this.save())`
- `ngOnInit`: subscribe to `valueChanges` → `stateService.markDirty(tabId, true)` (no debounce)

**General tab:**

- Remove `onThemeChange()` — no direct `ThemeService` calls from form interactions
- Save function: `generalSettingsService.save(formValue)` then `themeService.applyFromSettings(family, mode)`

**Server tab:**

- Save function: `serverSettingsService.save(formValue)`

**TorrentListGrid tab:**

- `drop()` handler: update `orderedColumns`, call `stateService.markDirty('torrent-list-grid', true)` — do not call `save()`
- Save function: existing column-state resolution logic

**StatusBar tab:**

- `drop()` handler: call `stateService.markDirty('status-bar', true)` — do not call `saveSettings()`
- Save function: `statusBarSettingsService.save({ available, left, right })`

### `ThemeService`

Add one method:

```typescript
public applyFromSettings(family: ThemeFamily, mode: ThemeMode): void {
  this._family.set(family);
  this._mode.set(mode);
}
```

Updates the signals (triggering the existing `effect()` that writes `data-bb-theme` and `data-bs-theme` to `document.documentElement`) without writing to storage. Existing `setFamily` and `setMode` are unchanged.

---

## TorrentDetails-specific changes

- Same parallel loading + keep-alive pattern as Settings
- `selectTab` becomes synchronous; `canDeactivate` check removed from it (tabs are never destroyed)
- `canDeactivate` remains in `onDismiss()` and `onClose()`
- Content tab label: `{{ tab.label }}{{ tab.id === 'content' && guardService.isDirty() ? ' *' : '' }}`
- No changes to `ModalGuardService` or the Content tab's dirty-tracking logic

---

## Prerequisites

The following files exist in git history (commit `73864a5`) but are not present in the current working tree. They must be restored before implementation begins:

- `src/app/models/guardable-modal.interface.ts`
- `src/app/services/modal-guard.service.ts`

Both are used as-is — no changes needed to their content.

---

## What is not changing

- `ModalGuardService` — restored from git, otherwise unchanged
- `GuardableModal` interface — restored from git, otherwise unchanged
- Each tab's internal form structure and validation
- All settings service interfaces (`GeneralSettingsService`, `ServerSettingsService`, etc.)
- The confirm dialog used by `canDeactivate`
- Toast notifications on successful save (each tab's save fn keeps its own toast call)
