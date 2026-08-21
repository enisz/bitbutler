# Angular core upgrade to v22 - design

Issue: [#269](https://github.com/enisz/bitbutler/issues/269)

## Goal

Upgrade the Angular framework from 20.3 to 22.1, pinning TypeScript to the version Angular 22 requires. This is the first of two planned upgrade issues - it unblocks a follow-up ng-select 20 to 24 upgrade (tracked separately, not part of this issue), which requires `@angular/cdk` ^22 as a peer dependency and fixes long-standing `appendTo` dropdown clipping issues via Angular CDK Overlay.

ng-select stays on 20.7.0 in this issue. No ng-select behavior changes are expected or in scope here.

## Current state (verified against this repo, 2026-08-21)

- `@angular/core`, `common`, `compiler`, `compiler-cli`, `forms`, `platform-browser`, `router`, `localize`: `^20.3.0`
- `@angular/cdk`: `^20.2.14`
- `@angular/cli`, `@angular/build`: `^20.3.13`
- `@angular-eslint/*`: `^20.7.0`
- `typescript`: `~5.9.2`
- Already zoneless (no `zone.js` dependency), already on Vitest (`@analogjs/vitest-angular`) rather than Karma, already calls `provideHttpClient()` in `app.config.ts` (root injector).
- `app.routes.ts` is flat (`pages/login`, `pages/main`, wildcard redirect) - no nested routes, no route params.
- CI (`bitbutler-pr.yml`, `release.yml`, `deploy-docs.yml`) runs Node 24.
- Local dev Node is 26.7.0, which the current Angular 20 CLI reports as "Unsupported".

## Target state

- `@angular/core`, `common`, `compiler`, `compiler-cli`, `forms`, `platform-browser`, `router`, `localize`: `^22.1.3`
- `@angular/cdk`: `^22.1.3` (or whatever 22.x `ng update` lands on)
- `@angular/cli`, `@angular/build`: `^22.1.3`
- `@angular-eslint/*`: matching 22.x line
- `typescript`: `~6.0.0` (Angular 22's `@angular/compiler-cli` peer range is `>=6.0 <6.1` - the current npm `latest` for TypeScript, 7.0.2, does **not** satisfy this and must not be picked up automatically)

## Why this needs two hops (20 to 21 to 22), not one

`ng update` only supports upgrading one major version at a time. Verified breaking changes per hop, checked against what already exists in this codebase:

**Angular 21** (released 2026-11-20 per Angular's changelog):

- Zoneless change detection becomes the default - already the case here.
- Karma replaced by Vitest as the default test runner - already the case here (`@analogjs/vitest-angular`).
- `HttpClient` provided in the root injector by default - already the case here (`provideHttpClient()` in `app.config.ts`).
- Net effect: this hop should be close to a no-op for this repo beyond running `ng update` and fixing whatever the automated migrations flag.

**Angular 22** (released 2026-06-03):

- `ChangeDetectionStrategy.OnPush` becomes the default; the `ng update` migration schematic tags existing components `ChangeDetectionStrategy.Eager` automatically so behavior doesn't silently change.
- Route parameters/data inherit from all parent routes by default - not applicable, this app has no nested routes with params.
- `HttpClient` uses the Fetch backend by default.
- Requires TypeScript `>=6.0 <6.1` (verified via `npm view @angular/compiler-cli@22.1.3 peerDependencies`) and Node `^22.22.3 || ^24.15.0 || >=26.0.0` (verified via `npm view @angular/cli@22.1.3 engines`). CI's Node 24 and local Node 26.7.0 both already satisfy this; upgrading should also clear the "Unsupported" Node warning the current Angular 20 CLI shows locally.

## Plan: two commits on one branch, one PR

1. **Commit 1 - Angular 21.** `ng update @angular/core@21 @angular/cli@21 @angular/cdk@21` (let it pull in the matching `@angular/build`, `@angular/localize`, `@angular-eslint/*` versions). Run whatever automated migration schematics it offers. Verify `npm run lint && npm test && npm run build && npm run build:electron` all pass.
2. **Commit 2 - Angular 22.** `ng update @angular/core@22 @angular/cli@22 @angular/cdk@22`. Explicitly pin `typescript` to `~6.0.0` in `package.json` (do not rely on `ng update` or `npm install` to pick the right TS version - verify the installed version after). Let the OnPush migration schematic run and inspect the diff it produces. Verify `npm run lint && npm test && npm run build && npm run build:electron` again, then manually launch the app (`npm start`) and click through login -> main grid -> a settings modal as a sanity check that the renderer still boots and nothing is visibly broken. This is a smoke test, not a full UI audit - dropdown/ng-select behavior specifically is out of scope and will be verified in the follow-up ng-select issue.

## Explicitly out of scope

- `@ng-select/ng-select` stays on 20.7.0. Bumping it to 24.x (which requires this Angular 22 upgrade as a prerequisite) is a separate, already-researched follow-up issue.
- `ag-grid-angular` (peer `@angular/core >= 18.0.0`), `@ngx-translate/core` and `@ngx-translate/http-loader` (peer `>= 18`) need no action for this upgrade - verified via `npm view <pkg> peerDependencies`.
- `better-sqlite3`, `electron`, `bootstrap`, `ng-bootstrap` are unrelated to this Angular core upgrade and are tracked as their own future issues, to be researched and planned individually.

## Risk / rollback

Each `ng update` major hop is its own commit, so a regression can be bisected and reverted independently before the PR is opened. No CI workflow changes are anticipated (Node 24 already satisfies Angular 22's engine requirement).

## Testing

After each commit: `npm run lint`, `npm test`, `npm run build`, `npm run build:electron`. After commit 2: manual smoke test of the Electron app via `npm start` (login -> main grid -> one settings modal).
