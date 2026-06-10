# Localize ng-select Labels via NgSelectConfig

**Date:** 2026-06-10

## Summary

`ng-select` exposes its built-in UI strings (add-tag prompt, clear-all, loading, not-found, type-to-search) via the injectable `NgSelectConfig` singleton, but they are currently hardcoded to English defaults. Configure these globally in `app.ts` from new `general.form.ng-select.*` translation keys, kept in sync with the active language via the existing `translateService.onLangChange` subscription - mirroring the existing `TimeagoIntl` pattern already used for `ngx-timeago`.

---

## Goals

- All `ng-select` instances across the app show localized text for: add-tag prompt, clear-all, loading, not-found, type-to-search.
- Labels update immediately when the user switches language at runtime (no restart required).
- New translation keys added to both `public/i18n/us.json` and `public/i18n/hu.json` under `general.form.ng-select.*`.

## Out of scope

- `placeholder` / `fixedPlaceholder` and any other `NgSelectConfig` properties not listed in #147.
- Per-instance overrides on individual `ng-select` usages (12 components currently use it).
- Changes to existing keys such as `general.button.clear-all`.

---

## Translation keys

| Key                                     | US             | HU                    |
| --------------------------------------- | -------------- | --------------------- |
| `general.form.ng-select.add-tag`        | Add item       | Elem hozzáadása       |
| `general.form.ng-select.clear-all`      | Clear all      | Összes törlése        |
| `general.form.ng-select.loading`        | Loading...     | Betöltés...           |
| `general.form.ng-select.not-found`      | No items found | Nem található elem    |
| `general.form.ng-select.type-to-search` | Type to search | Gépeljen a kereséshez |

These join the existing `general.form.feedback.*` keys under the `general.form` namespace, grouping shared form-control strings together.

---

## Changes

### `packages/app/src/app/app.ts`

- Import `NgSelectConfig` from `@ng-select/ng-select`.
- Inject it alongside the existing `NgbModalConfig` / `NgbTooltipConfig` injections:
  ```ts
  private readonly ngSelectConfigService = inject(NgSelectConfig);
  ```
- Add a private `setNgSelectTranslations()` method that sets `addTagText`, `clearAllText`, `loadingText`, `notFoundText`, and `typeToSearchText` from `translateService.instant('general.form.ng-select.*')`.
- Call `setNgSelectTranslations()` once in the constructor (initial language).
- Call it again inside the existing `translateService.onLangChange` subscription, alongside `setTimeagoLanguage(event.lang)`.

### `public/i18n/us.json` / `public/i18n/hu.json`

- Add a `form.ng-select` object (5 keys above) under the existing `general` namespace in both files.

---

## Testing

- `app.spec.ts`:
  - After creating the `App` component, assert `NgSelectConfig`'s 5 properties equal the corresponding translation keys (the fake loader's `instant()` falls back to returning the key itself, so this confirms the right keys are wired up).
  - Emit on `translateService.onLangChange` and verify the labels are recomputed (e.g. spy on `translateService.instant` and confirm it's called again with the same 5 keys).

---

## File change summary

| File                               | Change                                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------------------- |
| `packages/app/src/app/app.ts`      | Inject `NgSelectConfig`, add `setNgSelectTranslations()`, call on init and on language change |
| `packages/app/src/app/app.spec.ts` | Add tests for initial config and language-change reactivity                                   |
| `public/i18n/us.json`              | Add `general.form.ng-select.*` keys (English)                                                 |
| `public/i18n/hu.json`              | Add `general.form.ng-select.*` keys (Hungarian)                                               |

---

## GitHub workflow

- Feature branch: `147-translate-ng-select-labels` (created from `main`).
- PR description includes `Fixes #147`.
