# Responsive Settings and Single-Line Option Rows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the two-column option grid on narrow windows and truncate option label/sub-text to one line with an ellipsis and an overflow-only tooltip, in every option group of the app.

**Architecture:** A `bbOptionText` directive on `.bb-option__text` makes the text column shrinkable (CSS) and, on hover, shows one `NgbTooltip` with the full text of the hovered line only when that line is cut off. `bb-options--grid` gets a viewport media query that switches it to one column. The directive then replaces the opt-in `bb-option__text--truncate` class and the per-line `bbTooltip` attributes everywhere.

**Tech Stack:** Angular 22 (zoneless, signals, standalone), `@ng-bootstrap/ng-bootstrap` `NgbTooltip`, SCSS, Vitest (`ng test`).

**Spec:** Issue #373 and the design agreed in chat (no separate spec file).

## Global Constraints

- Layouts at normal window widths must not change; only narrow widths (grid) and overflowing text (truncation) differ.
- Use `-` (hyphen), never `—`, in all written output, comments and commit messages.
- Commit format: `#373: short description`. Do not mention Claude in PR/issue text. No `docs` folder in the final PR (remove it in its own commit `#373: removed spec and plan`).
- `npm run lint` is max-warnings=0. Follow the existing directive style in `packages/app/src/app/directives/bb-tooltip.ts` (signals, `inject()`, `@HostListener`, doc comment on the class).
- Grid breakpoint: `@media (max-width: 991.98px)` (matches the existing `login.scss` breakpoint style); tune after viewing the app, keep it in one SCSS variable.

## Review Focus

- Label containing `<bb-popover>` (polling background, add-torrent options, torrent-details general): the popover icon must stay visible when the label text is cut off.
- Row with a fixed-width right control (`bb-option__control`, 50%): text column must shrink and ellipsize, not push the control out of the row.
- Single-column grid: the bottom border of the last rows (`nth-last-child(-n + 2)` rules in `torrent-list-grid.scss`, `notifications.scss`) must be removed from the last row only, not leave a stray divider or remove the one above the last row's neighbor.
- Hover moves from the label to the sub-text of the same row: the tooltip must switch to the new line's text, and must not show for the line that fits.
- Sub-text that is empty or conditional (polling `<small>` with `@if`): no empty tooltip.

---

### Task 1: `bbOptionText` directive

**Files:**

- Create: `packages/app/src/app/directives/bb-option-text.ts`
- Create: `packages/app/src/app/directives/bb-option-text.spec.ts`
- Modify: `packages/app/src/styles.scss:1175-1188` (truncate block)

**Interfaces:**

- Produces: `export class BbOptionText` (standalone directive, selector `[bbOptionText]`). Add it to a component's `imports` and write `<div class="bb-option__text" bbOptionText>`. It needs no inputs.
- The "line" elements it handles are `.bb-option__label` and `.bb-option__sub` children. If a label contains `.bb-option__label-text` (a span wrapping only the text, used when the label also holds a `bb-popover`), that span is the measured/truncated element for the label instead.

- [ ] **Step 1: Write the failing spec** `bb-option-text.spec.ts` (same style as `bb-tooltip.spec.ts`: a host component with a `.bb-option__text` containing a `label.bb-option__label` and `span.bb-option__sub`, and a second host with a label that holds `span.bb-option__label-text` plus a `<span class="icon">`; reuse a `setOverflow(element, scrollWidth, offsetWidth)` helper). Tests, using `NgbTooltip` obtained from the directive's debug element injector:
  - `adds the truncate class to the host` - host has class `bb-option__text--truncate`.
  - `shows the label text when the label overflows` - overflow label, dispatch `mouseover` on the label (`{bubbles: true}`): `tooltip.ngbTooltip` is the label's trimmed, whitespace-collapsed text and `tooltip.disableTooltip` is `false`.
  - `does not show a tooltip when the hovered line fits` - fitting label: `disableTooltip` is `true`.
  - `switches to the sub-text when the hover moves to it` - overflow both; mouseover label then sub: `ngbTooltip` equals the sub-text, and `close` was spied and called on the change.
  - `measures the label text span when present` - second host: overflow set on `.bb-option__label-text` only; tooltip text is that span's text (not the icon).
  - `ignores hovers outside a line` - mouseover on the host itself: `disableTooltip` is `true`.
- [ ] **Step 2: Run to verify failure**

Run: `npm test --workspace @bitbutler/app -- --include src/app/directives/bb-option-text.spec.ts`
Expected: FAIL (module `./bb-option-text` not found).

- [ ] **Step 3: Implement `BbOptionText`** in `bb-option-text.ts`:
  - `hostDirectives: [{ directive: NgbTooltip, inputs: ['placement', 'container'] }]`, `host: { class: 'bb-option__text--truncate' }`.
  - In the constructor set `tooltip.placement = 'bottom'`, `tooltip.tooltipClass = 'bb-tooltip-single-line'`, `tooltip.disableTooltip = true`.
  - `@HostListener('mouseover', ['$event']) onMouseOver(event: MouseEvent)`: resolve the hovered line with `(event.target as HTMLElement).closest('.bb-option__label, .bb-option__sub')` restricted to the host; map a label to its `.bb-option__label-text` child when present. If there is no line or it does not overflow (`scrollWidth <= offsetWidth`), set `disableTooltip = true`. Otherwise set `ngbTooltip` to the line's `textContent` trimmed with whitespace collapsed and `disableTooltip = false`; if the resolved line differs from the previously hovered one while the tooltip is open, `close()` then `open()` so the text refreshes. Remember the last line in a private field and reset it on `mouseleave`.
  - Doc comment on the class in the style of `BbTooltip`.
- [ ] **Step 4: CSS** in `styles.scss` (replaces the existing `.bb-option__text--truncate` block, keep the comment style): same truncation as today, plus for a label that contains a text span: `.bb-option__label:has(> .bb-option__label-text)` is `display: flex; min-width: 0;` where `.bb-option__label-text` gets the overflow/nowrap/ellipsis rules (`min-width: 0`) and any other child (the popover) gets `flex-shrink: 0`.
- [ ] **Step 5: Run to verify pass** (same command). Expected: PASS.
- [ ] **Step 6: Commit** `#373: add the bbOptionText directive`

### Task 2: Responsive option grid

**Files:**

- Modify: `packages/app/src/styles.scss:1222-1231`
- Modify: `packages/app/src/app/pages/settings/torrent-list-grid/torrent-list-grid.scss:2`
- Modify: `packages/app/src/app/pages/settings/notifications/notifications.scss:11`
- Modify: `packages/app/src/app/pages/settings/startup/startup.scss:2` (check, see below)

**Interfaces:**

- Produces: `.bb-options--grid` renders one column at `max-width: 991.98px`. `.bb-option--wide` is unchanged.

- [ ] **Step 1: Implement** the media query in `styles.scss`: `grid-template-columns: 1fr` and `gap: 0` for `.bb-options--grid` under the breakpoint (breakpoint in a `$bb-options-grid-breakpoint` variable at the top of that block).
- [ ] **Step 2: Fix the per-page border rules.** In `torrent-list-grid.scss` and `notifications.scss` the "last two rows lose their border" rule must apply only above the breakpoint; below it only `:last-child` loses its border. In `startup.scss` read the `nth-child(3)` rule and make it correct in one column (a single-column list needs the border on every row except the last).
- [ ] **Step 3: Verify build**

Run: `npm run build --workspace @bitbutler/app` (or the root `npm run build`)
Expected: success, no SCSS errors.

- [ ] **Step 4: Commit** `#373: collapse the option grid to one column on narrow windows`

### Task 3: Apply the directive to every option group

**Files (Modify, `packages/app/src/app/` + matching component `.ts` for `imports`):**

- `pages/settings/`: `general`, `startup`, `appearance`, `polling`, `notifications`, `torrent-list-grid`
- `pages/qb-settings/`: `storage`, `bandwidth`, `queue-limits`, `seeding-ratios`
- `modals/`: `add-torrent/options`, `add-torrent/general/folder-picker`, `torrent-details/general`, `server-editor`, `credential-prompt`, `import-torrents`, `import-configuration`

**Interfaces:**

- Consumes: `BbOptionText` from Task 1.

- [ ] **Step 1:** In each file, add `bbOptionText` to every `<div class="bb-option__text ...">` and add `BbOptionText` to the component's `imports` array. Rows with no `bb-option__text` wrapper do not exist (verified), so no new wrappers are needed.
- [ ] **Step 2: Labels with a popover.** For every `.bb-option__label` that contains `<bb-popover>` (`polling`, `add-torrent/options`, `torrent-details/general`, any others found with `grep -rn -B3 '<bb-popover' ... bb-option__label`), wrap only the translated text in `<span class="bb-option__label-text">…</span>` and leave the popover as its sibling inside the label.
- [ ] **Step 3: `import-configuration` and `import-torrents`.** Remove the literal `bb-option__text--truncate` class and the per-line `[bbTooltip]`/`overflowOnly`/`singleLine`/`placement` attributes on the label and sub-text in `import-configuration.html` (the directive supersedes them); keep `credential-prompt`'s existing line tooltips only if they are not on `bb-option__*` lines, otherwise remove them the same way. In `import-torrents.html` the label has a conditional `[bbTooltip]` (legacy-unsupported hint) that is a different tooltip - keep it, and do not give that label the directive's tooltip (the directive's hover handler must not override a label that already has its own `bbTooltip`; if that conflict appears when testing, move the legacy hint to the toggle).
- [ ] **Step 4: Conditional sub-text.** `polling.html` `<small class="bb-option__sub">` can be empty; confirm no tooltip appears for an empty line (covered by the directive: an empty line does not overflow).
- [ ] **Step 5: Lint, format, test**

Run: `npm run lint` then `npm test`
Expected: both pass with zero warnings; fix with `npm run lint:fix` / `npm run format` if needed.

- [ ] **Step 6: Commit** `#373: truncate option rows to a single line across the app`

### Task 4: Verify in the running app

- [ ] **Step 1:** Run the app (`run` skill / `npm start`), open each settings pane (app and qBittorrent) and the add-torrent, torrent-details, server-editor, import and export modals.
- [ ] **Step 2:** Narrow the window below the breakpoint: grids (Startup, Notifications, Torrent list grid, torrent-details general) become one column with no stray borders. Narrow further: long labels/sub-text end in `…`; hovering a cut-off line shows its full text; hovering a line that fits shows nothing; popover icons stay visible; right-hand controls do not move out of the row. At normal width nothing looks different.
- [ ] **Step 3:** Adjust the breakpoint variable if the single-column switch happens too early or late; commit any fix as `#373: <what>`.
- [ ] **Step 4:** Remove the docs folder before the PR: `git rm -r docs` committed as `#373: removed spec and plan`.
