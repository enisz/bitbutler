# ng-select v24 Upgrade - Design

**Issue:** #273 (linked under #270)
**Branch:** `273-upgrade-ng-select-to-v24` (branched off `269-upgrade-angular-core-to-v22`)

## Goal

Bump `@ng-select/ng-select` from `20.7.0` to `24.0.2` and remove the `appendTo`
workaround that's no longer needed once the dropdown panel renders through
Angular CDK Overlay.

## Background

v24 moves the dropdown panel's DOM location from a child of `<ng-select>`
(unless `appendTo` was set) to Angular's CDK Overlay
(`.cdk-overlay-container`). Peer requirements are already satisfied:
`@angular/cdk`, `@angular/core`, `@angular/common`, `@angular/forms` are all
`^22.1.3` in root `package.json` (this is a hoisted-dependency monorepo -
`@bitbutler/app`'s own `package.json` only lists `@bitbutler/shared`).

`packages/app/src/styles.scss:1042` already forces:

```scss
.cdk-overlay-container,
.cdk-global-overlay-wrapper {
  z-index: 11000 !important;
}
```

This was added for the toast service and grid context menu, both of which
already use CDK Overlay. Because ng-select's panel will now render into the
same `.cdk-overlay-container`, it inherits that stacking automatically - which
is why every `appendTo="body"` in this codebase (added purely to escape modal
clipping / z-index) becomes dead weight.

## Breaking changes relevant to this codebase

1. **Dropdown panel renders in CDK Overlay** - DOM location and z-index are
   overlay-managed now; `appendTo` becomes "DOM containment only", not a
   positioning mechanism. Custom panel CSS must be scoped via select classes,
   not ancestor wrappers.
2. **Behavioral:** `(typeahead)` now only emits while the user is typing
   (select/close/clear no longer re-emit it). No `(typeahead)` listeners
   exist in this codebase today (the "typeahead" hits in `save-path-select`
   are `ngbTypeahead`, unrelated) - no code change needed, just worth knowing.
3. **Behavioral:** Escape only calls `preventDefault` when it closes an open
   dropdown (previously always). Selects that live inside Bootstrap modals
   which also close on Escape should be spot-checked.
4. **v24.0.1 security fix:** default option labels render as text instead of
   HTML. No template in this codebase binds HTML into a default ng-select
   label (the `[innerHTML]` hits found during research are unrelated
   translated popover text in `options.html` / `torrent-list-grid.html`) - no
   change needed.

## What changes in this codebase

### 1. Dependency bump

`package.json:219` - `"@ng-select/ng-select": "^20.7.0"` -> `"^24.0.2"`.

### 2. Remove the `appendTo` workaround

**Wrapper components** - `appendTo` exists on these three purely to forward
the now-obsolete workaround down to their inner `<ng-select>`. Remove the
input and its template binding entirely (no backwards-compat shim):

| Component          | Input definition         | Template binding           |
| ------------------ | ------------------------ | -------------------------- |
| `category-select`  | `category-select.ts:57`  | `category-select.html:13`  |
| `tag-select`       | `tag-select.ts:49`       | `tag-select.html:16`       |
| `save-path-select` | `save-path-select.ts:59` | `save-path-select.html:35` |

Call sites passing `appendTo="body"` into these wrapper components (must be
cleaned up in the same change, or the build fails on an unknown bound
input):

- `packages/app/src/app/modals/add-torrent/general/general.html:279` (`app-save-path-select`)
- `packages/app/src/app/modals/add-torrent/general/general.html:298` (`app-category-select`)
- `packages/app/src/app/modals/add-torrent/general/general.html:304` (`app-tag-select`)
- `packages/app/src/app/modals/settings/general/general.html:165` (`app-save-path-select`)

Test coverage: `save-path-select.spec.ts:107-108` asserts
`component.appendTo()` defaults to `''` - remove that test along with the
input.

**Raw `<ng-select appendTo="body">` usages** - remove the attribute outright
from every occurrence below (dropdown will render correctly without it,
inheriting the app's existing `.cdk-overlay-container` z-index):

- `packages/app/src/app/components/bb-file-tree/bb-file-tree.html:180,279`
- `packages/app/src/app/modals/set-torrent-tags/set-torrent-tags.html:38`
- `packages/app/src/app/modals/qb-settings/seeding-ratios/seeding-ratios.html:53`
- `packages/app/src/app/modals/add-torrent/options/options.html:16`
- `packages/app/src/app/modals/qb-settings/bandwidth/bandwidth.html:133,148,161,181,194`
- `packages/app/src/app/modals/manage-categories/manage-categories.html:93`
- `packages/app/src/app/modals/set-torrent-category/set-torrent-category.html:38`
- `packages/app/src/app/modals/qb-settings/storage/storage.html:88,111,127,143,159`
- `packages/app/src/app/modals/settings/server/server.html:152`
- `packages/app/src/app/modals/settings/general/general.html:211,250,287,422,468,519`
- `packages/app/src/app/modals/set-path/set-path.html:45`
- `packages/app/src/app/modals/settings/torrent-list-grid/torrent-list-grid.html:149,330`

**What must NOT be removed** - the ag-grid column-filter portal mechanism in
`operator-filter-base.ts` and its 8 call sites (`[appendTo]="popupPortalSelector"`
in the `column-filters/*` components). This solves a different problem: ag-grid's
`PopupService` closes a filter popup on any outside mousedown unless the
click lands inside an element tagged `ag-custom-component-popup`. That's
independent of ng-select's positioning mechanism and still applies under CDK
Overlay. Only the stale comment in `operator-filter-base.ts:5-11,40-44`
(explaining the old positioning-reference-frame requirement, which no longer
applies since CDK Overlay always positions via viewport coordinates) needs
rewriting - the portal creation, `position: relative`, and class-tagging logic
stays.

### 3. Theming cleanup

`packages/app/src/styles/_ng-select.scss` - remove the hardcoded
`z-index: 9999 !important;` on `.ng-dropdown-panel` (the migration guide
calls this out explicitly: forked themes should drop positional/z-index
overrides now that the overlay container owns stacking). Re-verify after the
bump that the rest of the file's selectors (`.ng-dropdown-panel .ng-dropdown-panel-items .ng-option`,
etc.) still match, since the panel is now a CDK overlay child rather than
nested under `.ng-select`.

## Testing strategy

- `npm run lint`, `npm run build`, `npm test` after the dependency bump alone
  (before touching `appendTo`), to isolate pure version-bump breakage from
  the `appendTo` refactor.
- Same three commands again after the `appendTo` removal and SCSS cleanup.
- Manual QA in a running dev build (`npm start`): open every modal/page that
  contains a select (login page, add-torrent, set-path, set-torrent-tags,
  set-torrent-category, manage-categories, qb-settings bandwidth/storage/
  seeding-ratios, settings general/server/torrent-list-grid, bb-file-tree)
  and confirm the dropdown opens, is positioned correctly, isn't clipped, and
  is styled consistently in both light and dark themes.
- Specifically verify the ag-grid column filters (duration/size/boolean/
  ratio-limit/time-limit/number/text) still keep their popup open when
  interacting with the embedded ng-select.
- Spot-check Escape behavior on a couple of modals containing selects, to
  confirm the modal still closes as expected.

## Out of scope

- Any change to `ag-grid-angular`, `better-sqlite3`, `electron`, or
  `bootstrap`/`ng-bootstrap` (tracked separately under #270).
- Documentation site updates (per CLAUDE.md, docs updates happen once the
  feature/PR has stabilized - this is an internal dependency bump with no
  user-facing behavior change, so no docs update is expected, but this will
  be reconfirmed once implementation is done).
