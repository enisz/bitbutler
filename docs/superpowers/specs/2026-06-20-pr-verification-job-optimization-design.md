# PR Verification Workflow: Skip Unnecessary Steps

## Problem

`.github/workflows/bitbutler-pr.yml` already skips some jobs based on changed
files (via `dorny/paths-filter` in the `detect-changes` job), but the slowest
job - `[5/5] Build & Package` - runs its full cross-platform
`electron-builder` packaging (NSIS, AppImage, deb, rpm, snap, zip, portable,
across both Linux and Windows runners) on _any_ change under `packages/app/**`
or `packages/electron/**`, even when the change has nothing to do with
packaging (e.g. a label tweak or a bug fix in business logic).

Separately, an audit of all jobs found one related correctness gap: root
`package.json` / `package-lock.json` changes (dependency bumps) don't match
the `app` or `electron` filters, so `test-app`, `test-electron`, and `build`
are all currently skipped on a pure dependency bump - exactly the kind of
change most likely to break something.

## Goals

- Skip the expensive cross-platform packaging step when nothing
  packaging-relevant changed.
- Keep a fast, real compiler check (not just unit tests) on every app/electron
  source change, so compile errors are still caught before merge.
- Fix the `package.json`/`package-lock.json` filter gap.
- Make stage numbering in the GitHub Actions tab unambiguous when multiple
  jobs share a stage (e.g. `4a/6`, `4b/6`).

## Non-goals

- Splitting the `lint` job per-package - ESLint is already fast; not worth
  the added complexity.
- Caching `node_modules` / native module rebuilds across jobs - a different
  kind of optimization (speed, not skip-by-path); out of scope for this
  change.
- Any change to `release.yml` - it intentionally always does a full build,
  and continues to act as the final safety net for anything skipped at PR
  time.

## Why this is safe: what each job actually verifies

Unit tests do **not** reliably catch what the build catches:

- `packages/electron`'s `test` script is `vitest run`, which transpiles via
  esbuild and does not type-check. Its `build` script is two separate
  `tsc` invocations, which do. A type error can pass tests and still fail the
  build.
- `packages/app`'s test target uses `tsconfig.spec.json`, not the
  `tsconfig.app.json`/production config used by `ng build --configuration
production`, so production-only failures (bundle budgets, AOT edge cases)
  aren't guaranteed to be caught by tests either.

This is why the design keeps a dedicated **Compile Check** job (running the
real `build:ui`/`build:electron` commands) gated on the same `app`/`electron`
filters as today, rather than relying on unit tests as a stand-in for the
build. Only the **packaging** step (electron-builder turning compiled output
into installers) is gated on a narrower filter, since packaging correctness
depends on packaging config/assets/dependencies, not on application logic.

Residual risk: a packaging-relevant change with no matching filter entry
(unlikely, but possible) would only be caught the next time `release.yml`
runs a full build before publishing - the same safety net that already
implicitly exists today for unrelated changes.

## Design

### New path filter: `packaging`

Add a `packaging` output to the `detect-changes` job's `dorny/paths-filter`
step, alongside the existing `app`, `electron`, and `any-source` filters:

```yaml
packaging:
  - 'package.json'
  - 'package-lock.json'
  - 'packages/app/src/assets/icons/**'
  - 'build/**'
  - 'public/i18n/**'
```

### Filter fix: include `package.json` / `package-lock.json` in `app` and `electron`

```yaml
app:
  - 'packages/app/**'
  - 'packages/shared/**'
  - 'public/**'
  - 'package.json'
  - 'package-lock.json'
electron:
  - 'packages/electron/**'
  - 'packages/shared/**'
  - 'public/**'
  - 'package.json'
  - 'package-lock.json'
```

### Job restructuring

Split today's `[5/5] Build & Package` matrix job into two jobs:

1. **`[5/6] Compile Check`** - runs on `ubuntu-latest` only (no OS-specific
   packaging logic involved in compilation). Steps: `npm ci`, `npm run
build:ui`, `npm run build:electron`. Gated on `needs.detect-changes.outputs.app
== 'true' || needs.detect-changes.outputs.electron == 'true'` (same
   condition as today's build job). Depends on `test-app`/`test-electron`
   succeeding, same as today.

2. **`[6a/6]` / `[6b/6] Package & Distribute (Linux / Windows)`** - the
   existing 2-OS matrix, but only running `electron-builder`. Steps: `npm
ci`, `npm run build:ui`, `npm run build:electron`, RPM tooling install
   (Linux leg only), `npx electron-builder --linux`/`--win`. Gated on
   `needs.detect-changes.outputs.packaging == 'true'`. Depends on `[5/6]
Compile Check` succeeding.

### Stage naming convention

Apply a letter suffix whenever multiple jobs occupy the same stage number, so
the Actions tab is unambiguous:

```
[1/6]  PR Format & Issue Sync
[2/6]  Detect Changes
[3/6]  Code Quality (Lint)
[4a/6] Unit Tests - Angular
[4b/6] Unit Tests - Electron
[5/6]  Compile Check
[6a/6] Package & Distribute (Linux)
[6b/6] Package & Distribute (Windows)
```

## Behavior comparison

| Change                                               | Today                             | After this change                                  |
| ---------------------------------------------------- | --------------------------------- | -------------------------------------------------- |
| App/electron source logic tweak                      | Full matrix build+package runs    | Compile Check runs (fast, 1 OS); packaging skipped |
| Translation string edit (`public/i18n/**`)           | Full matrix build+package runs    | Compile Check runs; packaging skipped              |
| Dependency bump in `package.json`                    | Tests and build all skipped (gap) | Tests, Compile Check, and packaging all run        |
| `build`/`nsis`/`linux` config edit in `package.json` | Full matrix build+package runs    | Compile Check and packaging both run               |
| Docs-only PR                                         | Everything after lint skipped     | Unchanged                                          |

## Testing/validation plan

Since this is a CI workflow change, validation happens by observing actual
PR runs against the new workflow rather than a unit test suite:

- Open the PR that carries this change itself and confirm all stages run
  (it touches `.github/workflows/bitbutler-pr.yml`, which isn't in any
  filter, so manually confirm the expected jobs fire for that PR).
- Follow up with a throwaway test PR per row of the behavior comparison
  table above (e.g. a no-op source tweak, an i18n edit, a `package.json`
  dependency bump) to confirm the corresponding jobs run/skip as designed,
  then close without merging.
