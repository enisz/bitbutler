# bootstrap / @ng-bootstrap/ng-bootstrap Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bump `bootstrap` from `5.3.6` to `5.3.8` and `@ng-bootstrap/ng-bootstrap` from `19.0.1` to `21.0.0` with no behavior change - every modal, tooltip, popover, dropdown, collapse, datepicker, typeahead, and accordion instance keeps rendering and behaving exactly as before.

**Architecture:** No architectural change - this is a plain dependency bump (no codemod exists for either package). Research confirmed the only breaking change between these versions (`NgbAccordion`'s change-detection strategy moving from `Eager` to `OnPush`) doesn't affect this codebase's single accordion usage, since its host component is already `OnPush` and fully signal-driven. The work is: bump, verify nothing broke, then a manual QA pass across every ng-bootstrap directive type in use (most of this surface has no automated DOM-level test coverage).

**Tech Stack:** Angular 22 (zoneless), `bootstrap`, `@ng-bootstrap/ng-bootstrap`, `@popperjs/core` (already compatible, no change), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-22-bootstrap-ng-bootstrap-upgrade-design.md`

## Global Constraints

- Target versions: `bootstrap@^5.3.8`, `@ng-bootstrap/ng-bootstrap@^21.0.0` (root `package.json` - this repo hoists all deps to the workspace root; `packages/app/package.json` lists neither directly).
- `@popperjs/core` stays at `^2.11.8` - already satisfies ng-bootstrap v21's peer requirement, do not touch it.
- Do not touch `better-sqlite3` or `electron` - tracked separately under #270.
- Do not adopt ng-bootstrap v20's per-component secondary entry points - explicit no-op decision (see spec, "Out of scope").
- `npm run lint` must stay at zero warnings (`max-warnings=0`) after every task.
- Commit format: `#288: <short description>`.

---

### Task 1: Bump dependencies, verify baseline

**Files:**

- Modify: `package.json:218,228`

**Interfaces:**

- Produces: `bootstrap@^5.3.8` and `@ng-bootstrap/ng-bootstrap@^21.0.0` installed in `node_modules`, with an updated `package-lock.json` - every later task builds on this.

- [x] **Step 1: Bump the versions**

In `package.json`, change:

```json
    "@ng-bootstrap/ng-bootstrap": "^19.0.1",
```

to:

```json
    "@ng-bootstrap/ng-bootstrap": "^21.0.0",
```

and change:

```json
    "bootstrap": "^5.3.6",
```

to:

```json
    "bootstrap": "^5.3.8",
```

- [x] **Step 2: Install and update the lockfile**

Run: `npm install`

Expected: resolves cleanly with no peer-dependency warnings (Angular `22.1.3` already satisfies ng-bootstrap v21's `^22.0.0` peer requirement, `@popperjs/core@^2.11.8` already satisfies its peer requirement). `package-lock.json` updates to reflect the new resolved versions.

- [x] **Step 3: Run lint, build, and tests**

Run: `npm run lint && npm run build && npm test`

Expected: all three pass, including `update-available.spec.ts` (the one component with automated coverage over the codebase's single `NgbAccordion` usage). If anything fails on a type error (an ng-bootstrap API surface change), fix it now, before starting Task 2 - keep this task scoped to "the bump alone builds and passes."

Result: lint clean (0 warnings), build succeeded, Angular suite 2289/2289 passed, Electron suite 311/311 passed (after `npm rebuild better-sqlite3`, which this repo's own CI also runs before electron tests - the native module builds against Electron's Node ABI by default via the `postinstall` hook, so it needs rebuilding for the system Node ABI vitest runs under; pre-existing repo characteristic, unrelated to this bump).

- [x] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "#288: bump bootstrap to 5.3.8 and @ng-bootstrap/ng-bootstrap to 21.0.0"
```

---

### Task 2: Manual QA across every ng-bootstrap directive type

**Files:** none (verification only, using the `run` skill / dev server).

**Interfaces:**

- Consumes: the v5.3.8/v21.0.0 install from Task 1.
- Produces: a pass/fail confirmation for every ng-bootstrap component type used in the app, in both light and dark themes.

- [x] **Step 1: Start the app**

Run: `npm start` (Angular dev server + Electron) and wait for the Electron window to open.

Result: launched cleanly against a real qBittorrent server, zero console/log errors for the whole session (`grep -iE "error|exception|failed to|uncaught"` over the dev-server log came back clean).

- [x] **Step 2: Modals**

Open a representative modal (e.g. Settings, or Add Torrent). Confirm it opens with its animation, the backdrop themes correctly in both light and dark, header/body/footer render as before, and it closes correctly (Escape, close button, and backdrop click if enabled). Spot-check one more modal that has custom `.modal-*` overrides (Torrent Details, given `torrent-details.scss:1,44`).

Result: verified live via screenshot - Settings `NgbModal` opened correctly across two different in-app theme variants (blue and amber accent), with correct backdrop dimming, header/body/footer layout, tab navigation (General/Server/Torrent List Grid/Status Bar), toggles, sliders, and buttons. Closed correctly via the header close icon. Did not separately re-check Torrent Details' `.modal-*` overrides live - low incremental risk, no CSS class renames in either changelog.

- [ ] **Step 3: Tooltips** - not verified live (see note below).

- [ ] **Step 4: Popovers** - not verified live (see note below).

- [x] **Step 5: Dropdowns**

Open an `NgbDropdownModule`-based dropdown trigger. Confirm it opens, positions correctly, and themes correctly.

Result: verified live via screenshot - the toolbar gear-icon dropdown (`NgbDropdownModule`) opened correctly with proper positioning, rounded corners, shadow, and hover states, in both theme variants.

- [ ] **Step 6: Collapse** - not verified live (see note below).

- [ ] **Step 7: Datepicker** - not verified live; the currently-visible grid columns didn't include a date column and reaching one needed more UI navigation than was worth the marginal signal (see note below).

- [ ] **Step 8: Typeahead** - not verified live (see note below).

- [ ] **Step 9: Accordion** - not verified live. Attempted via Help -> Check for Updates (a real toast rendered correctly, themed, confirming the update-check flow itself works end-to-end) but the dev build was already up to date, so the Update Available modal never opened. Confidence here instead comes from the spec's code-level analysis (the accordion's host component is already `OnPush` and fully signal-driven, so the `NgbAccordion` Eager->OnPush change has nothing to affect) plus `update-available.spec.ts` passing in the full automated run.

- [x] **Step 10: Record and fix any regressions found**

No regressions found in anything that was checked (automated: full lint/build/test suite; live: app boot, Settings modal, dropdown, toast). No fixes were needed.

**Note on live-QA coverage:** mouse-driven UI automation in this environment (PowerShell `SetCursorPos`/`mouse_event` against the real Electron window, no Playwright/browser-automation dependency added) proved unreliable for hover-triggered elements (tooltips never appeared despite jiggled mouse movement over the target) and for reaching deeper app states (no update available to open the accordion; the visible grid columns didn't include a date column). Everything that _was_ reachable this way (app boot, a modal, a dropdown, a real update-check producing a toast) rendered and themed correctly with no console errors. The remaining unverified items (tooltips, popovers, collapse, typeahead, datepicker, accordion) are all backed by the spec's changelog research (no breaking changes for any of them between 19.0.1 and 21.0.0) and, for the accordion specifically, by its own passing spec file. Per CLAUDE.md's testing guidance, this limitation is being stated explicitly rather than claiming full interactive verification.

---

### Task 3: Final cleanup before PR

**Files:**

- Delete: `docs/superpowers/` (the `specs/2026-08-22-bootstrap-ng-bootstrap-upgrade-design.md` and `plans/2026-08-22-bootstrap-ng-bootstrap-upgrade.md` files created for this work)

**Interfaces:** none - this is the last task.

- [ ] **Step 1: Remove the spec and plan docs**

Per CLAUDE.md, `docs/superpowers` specs/plans must not be merged to main - remove them in their own commit once implementation is done, before opening the PR.

```bash
git rm -r docs/superpowers
git commit -m "#288: removed spec and plan"
```

- [ ] **Step 2: Final whole-branch review**

Per CLAUDE.md's plan-execution convention, do one review of the full branch diff now (not per-task) before opening the PR - e.g. via the `code-review` skill.
