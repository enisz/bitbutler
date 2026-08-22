# bootstrap / @ng-bootstrap/ng-bootstrap Upgrade - Design

**Issue:** #288 (linked under #270)
**Branch:** `288-upgrade-bootstrap-and-ng-bootstrap` (branched off `main` - no peer blocker, per the issue)

## Goal

Bump `bootstrap` from `5.3.6` to `5.3.8` and `@ng-bootstrap/ng-bootstrap` from
`19.0.1` to `21.0.0`, keeping every modal, tooltip, popover, dropdown,
collapse, datepicker, typeahead, and accordion instance in the app rendering
and behaving exactly as before.

## Background

Resolved current versions, both declared only in the root `package.json`
(hoisted-dependency monorepo - `packages/app/package.json` lists neither):

- `bootstrap` - `package.json:228` (`"^5.3.6"`)
- `@ng-bootstrap/ng-bootstrap` - `package.json:218` (`"^19.0.1"`)
- `@popperjs/core` - `package.json:222` (`"^2.11.8"`) - already satisfies
  ng-bootstrap v21's peer requirement (`^2.11.8`), no change needed.

`@ng-bootstrap/ng-bootstrap@21.0.0`'s peer dependencies require
`@angular/core` `^22.0.0`, `@angular/common` `^22.0.0`, `@angular/forms`
`^22.0.0`, `@angular/localize` `^22.0.0` - all already satisfied on `main`
(Angular `22.1.3` from #269). No blocker; this branches directly off `main`.

## Breaking changes relevant to this codebase

Researched against GitHub releases (`gh api repos/twbs/bootstrap/releases`
and `repos/ng-bootstrap/ng-bootstrap/releases`), not assumed from the issue:

1. **`bootstrap` 5.3.7 / 5.3.8** - both are docs/CSS/JS patch releases: a
   `color-contrast()` WCAG 2.1 fix, a flex-container spinner-distortion fix,
   a `trigger: "hover click"` tooltip/popover fix, and a search-input cursor
   tweak. No breaking changes, no class renames. Zero risk.

2. **`@ng-bootstrap/ng-bootstrap` 20.0.0** - bumps minimum Angular to `21`
   (already satisfied) and adds opt-in per-component secondary entry points
   (e.g. `@ng-bootstrap/ng-bootstrap/pagination`) for smaller bundles. Not a
   breaking change - the main entrypoint still re-exports everything. Not
   adopted here (see Out of scope).

3. **`@ng-bootstrap/ng-bootstrap` 21.0.0** - bumps minimum Angular to `22`
   (already satisfied). One breaking change: **`NgbAccordion`'s change
   detection strategy moved from `Eager` to `OnPush`.** The only accordion
   usage in this codebase is
   `packages/app/src/app/modals/update-available/update-available.ts` /
   `update-available.html`. Inspected directly:
   - The host component (`UpdateAvailable`) already declares
     `changeDetection: ChangeDetectionStrategy.OnPush` and is entirely
     signal/computed-driven - no direct DOM mutation, no reliance on
     zone-triggered CD.
   - The template binds `[collapsed]="i !== 0"` and
     `[disabled]="itemId(release.id) === activeReleaseId()"` on
     `ngbAccordionItem`, both derived from a plain `@for` loop variable and a
     `signal<string | null>` (`activeReleaseId`), and `(show)` writes back
     into that same signal via `activeReleaseId.set($event)`.
   - Since every binding here already flows through Angular's own
     change-detection graph (signals + `OnPush` host), `NgbAccordion`
     switching its _own_ internal strategy to `OnPush` should have no
     observable effect - there is no eager/manual CD dependency to lose.
     Risk is low, but this is the one item worth an explicit manual re-check
     (Task 2) since no other part of the codebase exercises this component.
     Also has automated coverage: `update-available.spec.ts` exists (unlike
     most modals with visual-only surfaces), so `npm test` will catch
     host-level breakage too.

No other breaking changes were found for `NgbModal`, `NgbTooltip`,
`NgbPopover`, `NgbDropdownModule`, `NgbCollapse`, `NgbDatepickerI18n`/
`NgbDate`/`NgbDateStruct`, or `NgbTypeahead` between 19.0.1 and 21.0.0.

## What changes in this codebase

### 1. Dependency bump

- `package.json:228` - `"bootstrap": "^5.3.6"` -> `"^5.3.8"`
- `package.json:218` - `"@ng-bootstrap/ng-bootstrap": "^19.0.1"` -> `"^21.0.0"`
- `@popperjs/core` stays at `"^2.11.8"` - already compatible.

No codemod exists for either package (unlike ag-grid) - this is a plain
version bump.

### 2. Manual QA surface (mostly no automated DOM-level coverage)

Grepped every `ngb*` directive/class usage in `packages/app/src` to build
the QA checklist:

- **Modals** (`NgbModal`/`NgbActiveModal`/`NgbModalConfig`, `.modal-*`,
  `.modal-backdrop` overrides in `styles.scss:70,90,731,737,742,746` and
  `torrent-details.scss:1,44`) - opened from many places across the app
  (server, settings, add-torrent, torrent-details, import-torrents,
  update-available, set-path, set-torrent-tags/category,
  manage-categories, seeding-ratios, bandwidth, general, storage).
- **Tooltips** (`NgbTooltip`/`NgbTooltipModule`/`NgbTooltipConfig`, `.tooltip*`
  overrides in `styles.scss:1089,1254-1365` and `login.scss:110`) - used
  widely for truncated text and icon hints.
- **Popovers** (`NgbPopover`/`NgbPopoverConfig` in
  `bb-popover.ts`/`bb-popover.scss:31,44,57-58`).
- **Dropdowns** (`NgbDropdownModule`).
- **Collapse** (`NgbCollapse`).
- **Datepicker** (`NgbDate`/`NgbDateStruct`/custom
  `NgbDatepickerI18n` in `custom-datepicker-i18n.service.ts`, consumed by
  `datepicker-range-filter` - an ag-grid column filter popup, already
  covered by `datepicker-range-filter.spec.ts`'s ~85 `it()` blocks at the
  logic level).
- **Typeahead** (`NgbTypeahead`, `ngb-typeahead-window.dropdown-menu`
  overrides in `styles.scss:689,727`).
- **Accordion** (`NgbAccordionModule` in `update-available` - see Breaking
  Changes item 3 above; also has `.accordion-*` overrides in
  `update-available.scss:67-101` and `styles.scss:1418-1429`).

None of the SCSS overrides target classes that changed shape in either
package - they're all stable public Bootstrap component classes
(`.modal-content`, `.dropdown-menu`, `.tooltip-inner`, `.popover-body`,
`.accordion-button`, etc.), confirmed by checking the bootstrap 5.3.7/5.3.8
changelogs (no CSS class renames) and the ng-bootstrap 20/21 changelogs (no
DOM/class changes, only the accordion CD-strategy change noted above). Risk
is low across the board, but since almost none of this surface has automated
DOM-level test coverage, it still needs a manual visual pass.

## Testing strategy

- `npm run lint`, `npm run build`, `npm test` immediately after the version
  bump, to catch pure version-bump breakage (type errors, `update-available`
  logic regressions caught by its existing spec).
- Manual QA in a running dev build (`npm start`), in both light and dark
  themes:
  - Open a representative modal (e.g. Settings) and confirm it opens/closes,
    backdrop themes correctly, and header/body/footer render as before.
  - Hover an element with a tooltip and confirm placement/arrow/theming.
  - Open the `bb-popover` component and confirm placement/arrow/theming.
  - Open a dropdown (e.g. a select-style trigger) and confirm it opens and
    themes correctly.
  - Trigger an `NgbCollapse` usage and confirm expand/collapse animates.
  - Open the datepicker-range column filter and confirm the calendar
    renders, localized labels are correct, and date selection still filters
    the grid.
  - Type into a typeahead input and confirm the dropdown suggestion list
    renders and themes correctly.
  - Open the Update Available modal (or simulate it) and confirm the
    accordion expands/collapses correctly, `closeOthers` still closes the
    previously-open release, and the currently-installing release stays
    `disabled`.

## Out of scope

- Any change to `better-sqlite3` or `electron` (tracked separately under
  #270).
- Adopting `@ng-bootstrap/ng-bootstrap` v20's per-component secondary entry
  points - the app currently imports from the main entrypoint and there's no
  bundle-size problem motivating the switch.
- Documentation site updates - per CLAUDE.md, docs updates happen once the
  feature/PR has stabilized; this is an internal dependency bump with no
  user-facing behavior change, so none is expected, to be reconfirmed once
  implementation is done.
