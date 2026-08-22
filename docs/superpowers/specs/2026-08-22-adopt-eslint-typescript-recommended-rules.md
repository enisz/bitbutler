# Adopt ESLint & typescript-eslint recommended rule sets

Implements: https://github.com/enisz/bitbutler/issues/287

## Goal

`#272`/`#289` migrated ESLint to v9+ flat config with `@angular-eslint` v22, deliberately keeping the
Angular-specific rule set only (no `eslint.configs.recommended`, no `tseslint.configs.recommended`).
This spec adopts the fuller rule set `angular-eslint`'s own flat-config docs recommend for new projects.

## Decisions

1. **Add `eslint.configs.recommended`** (core ESLint correctness rules) to every TS file glob in
   `eslint.config.mjs` (`packages/app/src/**/*.ts`, `packages/electron/src/**/*.ts`,
   `packages/shared/src/**/*.ts`). Requires adding `@eslint/js` as a devDependency (not currently
   installed, even transitively).
2. **Add `tseslint.configs.recommended`** to the same globs. This turns on
   `@typescript-eslint/no-explicit-any` as an error, plus TS-aware overrides of `no-unused-vars` and
   `no-unused-expressions`, and `no-empty-object-type`.
3. **`any` in spec files is disabled, not fixed.** Add a dedicated override block for `**/*.spec.ts`
   that turns `@typescript-eslint/no-explicit-any` back off. Mocks and test doubles legitimately need
   loose typing; fixing the 743 occurrences across 104 spec files would be busywork with no
   correctness benefit. All other recommended rules (including `no-unused-vars`) still apply to specs.
4. **The 156 `any` occurrences in real source (`packages/app/src`, non-spec) must be fixed with real
   types**, not blanket-disabled. `packages/electron` and `packages/shared` currently have zero `any`
   usages in source, so no work is needed there for this rule.
5. **Existing `_`-prefixed unused-parameter convention is preserved via rule config**, not per-site
   edits: `@typescript-eslint/no-unused-vars` gets
   `{ args: 'after-used', argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }`
   so the existing `_params`, `_e`, `_source`-style signatures (required by interfaces like AG Grid's
   `ICellEditorAngularComp`) keep working without a rename.
6. **Empty `catch {}` blocks are intentional (best-effort cleanup/logout) and allowed via config**:
   `no-empty` gets `{ allowEmptyCatch: true }` instead of touching the 12 call sites individually.
7. **`angular.processInlineTemplates`**: enabled for `packages/app/src/**/*.ts` for future-proofing.
   No component in the codebase currently uses an inline `template:` (all use external `.html` files
   via `templateUrl`), so this has zero violations today and is a no-risk addition.
8. **Out of scope** (per the issue): `tseslint.configs.stylistic` — formatting is Prettier's job.

## Sizing (measured against `main` on 2026-08-22 with an experimental config)

- `eslint.configs.recommended` + the TS-aware overrides from `tseslint.configs.recommended`
  (excluding `no-explicit-any`) surface **39 violations** across ~20 files: `no-empty` (12, all
  resolved by the config change in decision 6), `@typescript-eslint/no-unused-vars` (12, 5 resolved
  by decision 5's config change, 7 need real per-site fixes), `@typescript-eslint/no-empty-object-type`
  (3), `@typescript-eslint/no-unused-expressions` (3), `no-case-declarations` (3), `no-control-regex`
  (2), `prefer-const` (2), `preserve-caught-error` (2).
- `@typescript-eslint/no-explicit-any` (`tseslint.configs.recommended`): 899 total occurrences repo-wide
  — 743 in 104 spec files (disabled per decision 3), **156 in 51 non-spec files under `packages/app/src`**
  (must be fixed per decision 4).

## Non-goals

- No behavior changes beyond what's needed to satisfy the new lint rules (e.g. removing a genuinely
  dead function parameter is in scope; redesigning a service is not).
- `tseslint.configs.stylistic` is not adopted (see decision 8).
