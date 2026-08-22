# ESLint v9+ Flat Config Migration - Design Spec

**Issue:** [#272](https://github.com/enisz/bitbutler/issues/272) - Migrate ESLint to v9 flat config and bump `@angular-eslint` to v22

## Goal

Replace the legacy `.eslintrc.json` + `.eslintignore` setup with ESLint's flat config (`eslint.config.mjs`), bump ESLint from 8.57.1 to the current stable line, and bump `@angular-eslint/*` from 21.4.0 to 22.x. This closes a gap left by #269 (Angular core v22 upgrade): `@angular-eslint@22.x` requires ESLint `^9.0.0 || ^10.0.0` and dropped the legacy eslintrc-compatible shareable configs entirely.

`npm run lint` must stay at zero warnings (`--max-warnings=0`) when this is done.

## Non-goals

- No other dependency bump. This is purely the ESLint/tooling migration.
- No adoption of `eslint.configs.recommended` or `tseslint.configs.recommended`. Layering those on top of the Angular-specific rules would turn on `@typescript-eslint/no-explicit-any` as an error, which hits 114 non-spec call sites across the monorepo - a type-safety cleanup, not a tooling migration. Tracked separately as [#287](https://github.com/enisz/bitbutler/issues/287).
- No `@angular-eslint/builder` and no `ng lint` architect target. `npm run lint` calls `eslint` directly today (the architect target was removed as dead weight in #269); nothing in this issue asks for it back.
- No inline-template lint processor (`angular.processInlineTemplates`). Old config never linted inline `@Component` templates; strict parity keeps that unchanged.

## Current state (baseline)

`.eslintrc.json` (root, `"root": true`) has four `overrides` blocks:

| Files                                   | Extends                                                                      | Notes                                                                                |
| --------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `packages/app/src/**/*.ts`              | `plugin:@angular-eslint/recommended`, `plugin:prettier/recommended`          | Angular-specific rules only - not `eslint:recommended`, not typescript-eslint rules  |
| `packages/app/src/**/*.html`            | `plugin:@angular-eslint/template/recommended`, `plugin:prettier/recommended` | Template-specific rules only                                                         |
| `packages/electron/src/**/*.ts`         | `plugin:prettier/recommended`                                                | `@typescript-eslint/parser` for TS syntax only, no rule set. `env: { node, es2022 }` |
| `packages/shared/src/**/*.ts`           | `plugin:prettier/recommended`                                                | Same as electron                                                                     |
| `packages/docs/docs/.vitepress/**/*.ts` | `plugin:prettier/recommended`                                                | Same as electron                                                                     |

`.eslintignore`: `node_modules/`, `dist/`, `dist-electron/`, `out/`, `coverage/`, `.release/`, `**/*.min.js`, `packages/*/node_modules/`.

`package.json` `lint` script (note: **does not** include `packages/shared/src` despite the override existing for it - a pre-existing gap):

```
eslint "packages/app/src/**/*.{ts,html}" "packages/electron/src/**/*.ts" "packages/docs/docs/.vitepress/**/*.ts"
```

Relevant current devDependency versions: `eslint@^8.57.1`, `@angular-eslint/eslint-plugin@^21.4.0`, `@angular-eslint/eslint-plugin-template@^21.4.0`, `@angular-eslint/template-parser@^21.4.0`, `@typescript-eslint/eslint-plugin@^8.54.0`, `@typescript-eslint/parser@^8.54.0`. `@angular/cli@^22.1.5`, `@angular/core@^22.1.3`, `typescript@~6.0.0` (already at the v22 baseline from #269).

Verified via package inspection (npm registry `dist-tags` + downloaded tarballs of `angular-eslint@22.1.0` and `typescript-eslint@8.67.0`):

- `angular.configs.tsRecommended` and `angular.configs.templateRecommended` are pre-built arrays that already bind their own parser (`typescript-eslint`'s parser for `tsRecommended`, `@angular-eslint/template-parser` for `templateRecommended`) - no manual `languageOptions.parser` needed when extending them.
- `angular-eslint@22.1.0`'s `tsRecommended` adds one rule not present in the old v21 `@angular-eslint/eslint-plugin` recommended config: `@angular-eslint/prefer-on-push-component-change-detection` (`error`). This is an unavoidable consequence of the version bump itself.
- `typescript-eslint@8.67.0` exposes `.parser` and `.plugin` directly (for the parser-only overrides) and a `.config()` helper that supports an `extends` array inside each config block (mixing single objects and spread arrays), matching the pattern used below.
- `eslint-plugin-prettier@5.5.5` ships a ready-made flat config at `eslint-plugin-prettier/recommended` - a single object merging `eslint-config-prettier`'s rules, `eslint-config-prettire/prettier`'s override rules, and `'prettier/prettier': 'error'`. This is the flat-config equivalent of today's `plugin:prettier/recommended`.
- Peer ranges confirm compatibility: `angular-eslint@22.1.0` peers `eslint: ^9.0.0 || ^10.0.0`, `@angular/cli: >=22.0.0 <23.0.0`, `typescript-eslint: ^8.0.0`. `typescript-eslint@8.67.0` peers `eslint: ^8.57.0 || ^9.0.0 || ^10.0.0`, `typescript: >=4.8.4 <6.1.0`. All satisfied by this repo's current `@angular/cli@^22.1.5` / `typescript@~6.0.0`.
- `require()` / `@ts-ignore` / `@ts-nocheck` / `namespace` usage across `app`, `electron`, `shared` is zero - confirms the only real cost of the (rejected) "full recommended bundle" option is `no-explicit-any` (114 hits), not any of typescript-eslint recommended's other ~20 rules.
- `eslint-plugin-n` is a devDependency but not referenced anywhere in `.eslintrc.json` - already a dead/unused dependency before this issue. Out of scope (not a dependency bump, and removing dead deps isn't part of this migration's stated goal); leave untouched.

## Target state

### `package.json` devDependencies

Remove: `@angular-eslint/eslint-plugin`, `@angular-eslint/eslint-plugin-template`, `@angular-eslint/template-parser`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`. (Confirmed via repo-wide grep: none of these five packages are imported or referenced anywhere outside `.eslintrc.json` and `package.json`/`package-lock.json`. They become transitive dependencies of the two umbrella packages below.)

Add: `angular-eslint@^22.1.0`, `typescript-eslint@^8.67.0`.

Bump: `eslint@^8.57.1` -> `eslint@^10.9.0`.

Unchanged: `eslint-config-prettier`, `eslint-plugin-prettier`, `eslint-plugin-n`, `prettier`, `@trivago/prettier-plugin-sort-imports`.

### `eslint.config.mjs` (new file, repo root)

```js
// @ts-check
import angular from 'angular-eslint';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-electron/**',
      '**/out/**',
      '**/coverage/**',
      '**/.release/**',
      '**/*.min.js',
    ],
  },
  {
    files: ['packages/app/src/**/*.ts'],
    extends: [...angular.configs.tsRecommended, eslintPluginPrettierRecommended],
  },
  {
    files: ['packages/app/src/**/*.html'],
    extends: [...angular.configs.templateRecommended, eslintPluginPrettierRecommended],
  },
  {
    files: ['packages/electron/src/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    extends: [eslintPluginPrettierRecommended],
  },
  {
    files: ['packages/shared/src/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    extends: [eslintPluginPrettierRecommended],
  },
  {
    files: ['packages/docs/docs/.vitepress/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    extends: [eslintPluginPrettierRecommended],
  },
);
```

Design notes:

- `.eslintignore` is deleted; ESLint 9+ no longer reads it. Its patterns move into the top-level `ignores` block above, rewritten with `**/` prefixes and `/**` suffixes so directory ignores are unambiguous under the flat-config matcher (the old bare `dist/`-style entries are gitignore-style and could be read either way; the explicit form removes any doubt). `packages/*/node_modules/` is folded into the general `**/node_modules/**` entry.
- The old `env: { node: true, es2022: true }` for the electron/shared/docs overrides is dropped. No rule set is ever applied in those overrides (parser-only, same as today), so no rule reads `languageOptions.globals` - dropping it changes nothing about lint output.
- `packages/shared/src/**/*.ts` is a new block (see "Fix the shared-package lint gap" below) - it did not exist in the actual lint invocation before, only in the unused `.eslintrc.json` override.

### `package.json` scripts

```
"lint": "eslint \"packages/app/src/**/*.{ts,html}\" \"packages/electron/src/**/*.ts\" \"packages/shared/src/**/*.ts\" \"packages/docs/docs/.vitepress/**/*.ts\""
```

`lint:fix` is unchanged (`npm run lint -- --fix`).

### Fix the shared-package lint gap

`packages/shared/src/**/*.ts` (7 files) is added to the `lint` script glob for the first time. Since it only ever had the parser-only override applied (no rule set), the risk of new violations here is low, but it must be verified by actually running lint (see Verification).

### Fix-up pass

After dependency changes land, run `npm run lint` and fix everything it surfaces until `--max-warnings=0` passes again. Expected sources of new violations, in likely order of appearance:

1. `@angular-eslint/prefer-on-push-component-change-detection` (new in v22's `tsRecommended`) on any `packages/app/src` component not already using `ChangeDetectionStrategy.OnPush`.
2. Whatever `packages/shared/src` turns up now that it's actually linted for the first time.
3. Any other rule-implementation differences between the v21 and v22 line of `@angular-eslint/*` rules.

Each violation gets fixed at the source (or, if a rule is judged not to fit the codebase's style, disabled with a one-line justification comment) - not blanket-disabled to make the count go away.

## Testing / Verification

1. `npm ci` (after `package.json` changes) - confirms the new dependency graph resolves cleanly (no `ERESOLVE` from the peer ranges verified above).
2. `npm run lint` - must exit 0 with zero warnings.
3. `npm test` - confirms no test runner regression from the ESLint/TS tooling change (lint and test are independent pipelines, but this is a sanity check).
4. `npm run build` and `npm run build:electron` - confirms nothing about the build pipeline depended on the removed `@angular-eslint/*`/`@typescript-eslint/*` packages being present as direct dependencies.

## Out of scope / follow-ups

- [#287](https://github.com/enisz/bitbutler/issues/287) - adopt `eslint.configs.recommended` + `tseslint.configs.recommended` (and decide on the inline-template processor) as a separate, deliberately-scoped follow-up, given the `no-explicit-any` cleanup it implies.
