# Design: Expand Test Coverage for `src/app/pages`

**Date:** 2026-04-26  
**Branch:** 49-adding-tests

---

## Context

All spec files inside `src/app/pages` have been audited. 11 files already have thorough test coverage. 1 file is missing a spec entirely. 9 spec files exist but contain only a `should create` smoke test.

Type/interface/token-only files (`button-bar.menu.ts`, `context-menu.types.ts`, `context-menu.tokens.ts`, `settings.interface.ts`) have no executable logic and do not need specs.

---

## Scope

### Create (1 new file)

| File                                      | Why                                                                                             |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `settings/settings-state.service.spec.ts` | Service with real logic: dirty-tracking per tab, save-function registry, `saveAll` coordination |

### Enhance (9 existing files)

Each spec is restructured to provide explicit `vi.fn()` mocks for every service whose observable side-effects the tests need to verify. `NO_ERRORS_SCHEMA` is used for components whose child components are out of scope.

| Spec                        | Behaviors to cover                                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `login.spec.ts`             | `trackByFn`, `canConnect`, `addServer`, `editServer`, `deleteServer` (confirm flow), `toggleAutoLogin`                 |
| `main.spec.ts`              | `logoUrl` computed, `theme` signal identity, `serverState` initial value                                               |
| `button-bar.spec.ts`        | `onClick` for every action id, `trackBy`, `clearSearchField`, `hasSelection` computed                                  |
| `status.spec.ts`            | `setGroup`, `setTrackerGroup`, `setSavePathGroup`, `setCategoryGroup`, `setTagGroup`, `clearAll`, `activeKey` computed |
| `settings.spec.ts`          | `selectTab`, `canDeactivate` (clean path / dirty+confirmed / dirty+cancelled), `onSave`                                |
| `general.spec.ts`           | `getFamilyLogo`, `checkUpdates`                                                                                        |
| `server.spec.ts`            | `pathMappings` getter, `addPathMapping`, `removePathMapping` (last mapping resets, others removed), `testMapping`      |
| `status-bar.spec.ts`        | `drop` same-container reorders, `drop` cross-container transfers and marks dirty                                       |
| `torrent-list-grid.spec.ts` | `drop` reorders `orderedColumns`, marks state dirty                                                                    |

---

## Testing approach

- **Explicit mocks:** every `beforeEach` that exercises behavior provides a `providers` array with `vi.fn()` mocks only for the services touched by that describe block.
- **Signal access:** signal values are read via `signal()` calls directly on the component instance; `TestBed.flushEffects()` is called where needed.
- **matchMedia:** added to specs that construct components using `window.matchMedia` (`main`, `button-bar`).
- **Existing `should create` tests preserved** — new tests are added in focused nested `describe` blocks.

---

## Files not changed

| File                                | Reason           |
| ----------------------------------- | ---------------- |
| `tracker.utils.spec.ts`             | Already thorough |
| `filter-group.spec.ts`              | Already thorough |
| `loading-overlay.spec.ts`           | Already thorough |
| `no-row-overlay.spec.ts`            | Already thorough |
| `code-cell-renderer.spec.ts`        | Already thorough |
| `progress-cell-renderer.spec.ts`    | Already thorough |
| `grid.spec.ts`                      | Already thorough |
| `grid-keyboard-nav.service.spec.ts` | Already thorough |
| `grid-pin.service.spec.ts`          | Already thorough |
| `context-menu.spec.ts`              | Already thorough |
| `grid-context-menu.service.spec.ts` | Already thorough |
| `server-state.spec.ts`              | Already thorough |
