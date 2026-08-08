# Claude-Inspired UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply a more spacious, polished "claude.ai-inspired" visual language (larger corner radii, cleaner card grouping, consistent button shape) to BitButler's UI, and fix a real color bug in the `mint-green` theme - all through the existing tokenized theme system, with no new dependencies and no changes to Angular component logic.

**Architecture:** BitButler already renders every screen through CSS custom properties (`--bs-*` for Bootstrap semantic colors, `--bb-*` for app-specific tokens) set per `[data-bb-theme][data-bs-theme]` combination in `packages/app/src/styles/themes/*/  {_dark,_light}.scss`, plus a handful of shared global classes in `packages/app/src/styles.scss` (`.btn`, `.bb-fieldset`, `.bb-toolbar-dropdown`, etc.) that every page and modal reuses. Research into the live codebase (not just the approved mockups) showed the main torrent view's toolbar (`.bb-tool`, 12px radius), status bar (`.bb-widget`, pill-shaped), and sidebar filters are **already** close to the target language. The one genuine, high-leverage gap is `.bb-fieldset` - the shared section-grouping class used by every tab across the Settings, Add Torrent, and Torrent Details modals - which currently renders as an old-style HTML fieldset (legend text cut into the border). Redesigning that **one** global rule cascades automatically to every modal tab with zero template changes, because they all already use `<fieldset class="bb-fieldset"><legend>...</legend>...</fieldset>`.

Because of this, most of the plan is a small number of shared/global CSS changes rather than per-screen rewrites. No screen needed a template rewrite once the shared classes are updated - the components underneath are already well-built.

**Tech Stack:** Angular 20 (zoneless/signals), Bootstrap 5 + ng-bootstrap, ag-Grid 35 (Theming API via `themeQuartz`), SCSS with CSS custom properties for theming. No new packages.

## Global Constraints

- Do not introduce new UI libraries or npm packages - reuse Bootstrap, ng-bootstrap, ag-Grid, and the existing `@fortawesome/*` icon packages already in the project.
- Every color must come from the existing `--bs-*`/`--bb-*` CSS custom property system so it automatically works across all 8 themes x light/dark - never hardcode a hex color in component SCSS for something that should follow the theme.
- Do not change any `.ts` component logic/behavior in this plan - every task is template classes and/or SCSS only, except the mint-green theme fix which is SCSS variable values only.
- `npm run lint` must pass with zero warnings (`--max-warnings=0`, enforced by this repo's ESLint config) after every task.
- Follow the repo's commit format: `#267: <short description>` (issue #267 tracks this work; branch `267-claude-inspired-ui-refresh` is already checked out).
- Use `-` not `—` (em dash) in all commit messages and any written output, per this repo's writing-style rule.

---

## Task 1: Fix the mint-green theme's dark-mode accent color

**Context:** `--bb-accent` is set to `var(--bs-secondary)` in every theme (see `packages/app/src/styles/themes/_theme-utils.scss`'s pattern and every theme file's `install()` mixin) - it's the color used for buttons, active nav/list items, the progress bar fill, and links across the whole app. In `mint-green`'s **light** mode (`packages/app/src/styles/themes/mint-green/_light.scss`), `--bs-secondary` is `#a3b18a`, an actual sage green - correct. But in **dark** mode (`packages/app/src/styles/themes/mint-green/_dark.scss`), `--bs-secondary` is `#dad7cd`, a neutral beige, while the sage tone (`#a3b18a`) sits unused on `--bs-primary` instead. So today, switching a "Mint Green" theme from light to dark silently turns its accent color from green to beige. This is an internal inconsistency in the theme, not a design opinion - it's a bug.

**Files:**

- Modify: `packages/app/src/styles/themes/mint-green/_dark.scss:5` and `:41`

**Interfaces:** None (pure SCSS variable/value change, no new tokens, no Angular changes).

- [ ] **Step 1: Read the current file to confirm line numbers haven't drifted**

Run: view `packages/app/src/styles/themes/mint-green/_dark.scss` lines 1-45. Confirm line 5 is `$bb-dark-secondary: #dad7cd;` and line 41 is `--bs-secondary-rgb: #{string.unquote('218, 215, 205')};`. If the lines have moved, find the same content by searching for `$bb-dark-secondary` and `218, 215, 205` in that file instead of trusting the line numbers below.

- [ ] **Step 2: Change the secondary/accent color to an actual mint tone**

In `packages/app/src/styles/themes/mint-green/_dark.scss`, change:

```scss
$bb-dark-secondary: #dad7cd;
```

to:

```scss
$bb-dark-secondary: #6fbf98;
```

(`#6fbf98` is a fresh mint green that reads clearly against the theme's existing dark background `#1a2e2b` and keeps the same black ink (`--bb-secondary-ink: #000`) already defined for this theme - `#6fbf98` is light enough for black text to stay legible on it.)

Then update the matching RGB comment/string used for `--bs-secondary-rgb` (needed for any `rgba(var(--bs-secondary-rgb), ...)` usage elsewhere in the app). Change:

```scss
--bs-secondary-rgb: #{string.unquote('218, 215, 205')};
```

to:

```scss
--bs-secondary-rgb: #{string.unquote('111, 191, 152')};
```

(111, 191, 152 is the decimal RGB of `#6fbf98`.)

- [ ] **Step 3: Verify nothing else in the file references the old literal color**

Run: `grep -n "dad7cd\|218, 215, 205" packages/app/src/styles/themes/mint-green/_dark.scss`
Expected: no output (both occurrences replaced).

- [ ] **Step 4: Lint and build**

Run: `npm run lint`
Expected: exits 0, no warnings.

Run: `npm run build --workspace=packages/app`
Expected: build succeeds (SCSS compiles - this catches any Sass syntax error from the edit).

- [ ] **Step 5: Manual visual check**

Run: `npm start` (starts the Angular dev server + Electron shell). Once the app window opens: open Settings > General > Appearance, set Theme Family to "Mint Green" and Theme Mode to "Dark". Confirm buttons, the active sidebar filter item, and any progress bars now show a green accent instead of beige. Switch Theme Mode to "Light" and confirm it still looks the same as before (light mode is untouched).

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/styles/themes/mint-green/_dark.scss
git commit -m "$(cat <<'EOF'
#267: fix mint-green dark theme accent color

The dark variant's --bs-secondary (used everywhere as --bb-accent) was
a beige (#dad7cd) instead of a green tone, unlike the light variant
which correctly used the sage color. Buttons, active list items, and
progress bars in mint-green dark mode were beige instead of green.
EOF
)"
```

---

## Task 2: Modernize the shared `.bb-fieldset` section-card language

**Context:** `packages/app/src/app/modals/settings/general/general.html`, `packages/app/src/app/modals/add-torrent/general/general.html`, `packages/app/src/app/modals/torrent-details/general/general.html`, and their sibling tabs (Settings > Server/Status Bar/Torrent List Grid, Add Torrent > Options/Limits/Files, Torrent Details > Content/Peers/Trackers) all group their form fields using `<fieldset class="bb-fieldset"><legend>...</legend>...</fieldset>`. The current `.bb-fieldset` rule (in `packages/app/src/styles.scss`) recreates the classic native `<fieldset>`/`<legend>` look: the legend text floats on top of the border via a negative top margin, cutting into the border line. The approved design mockups use a cleaner pattern instead: a bordered, rounded card with the label sitting inside as a small uppercase heading at the top - no border-cutout.

Because every one of those templates already uses the exact same `.bb-fieldset`/`legend` markup, **this task only touches the shared CSS rule** - no Angular template in any modal needs to change to pick up the new look.

**Files:**

- Modify: `packages/app/src/styles.scss:975-1022` (the `.bb-fieldset` rule block)

**Interfaces:** None - this redefines an existing global CSS class (`.bb-fieldset`) and its nested `legend` selector. No class names change, so no template in any modal needs editing.

- [ ] **Step 1: Confirm the current rule's location**

Run: `grep -n "^.bb-fieldset" packages/app/src/styles.scss`
Expected: one match near line 975. If the line number differs, use that line as the start of the block to replace (the block runs until the closing `}` that matches, ending around 47 lines later, just before the `.tooltip {` rule for tooltip variants).

- [ ] **Step 2: Confirm `.fieldset-action` is unused before removing it**

Run: `grep -rn "fieldset-action" packages/app/src/app`
Expected: no output - this nested selector's target button class isn't used in any component template today, so it's safe to remove as part of this rewrite rather than trying to reposition it for a layout it was never actually placed into.

- [ ] **Step 3: Replace the `.bb-fieldset` block**

In `packages/app/src/styles.scss`, replace this entire block:

```scss
.bb-fieldset {
  border: 1px solid var(--bs-border-color);
  border-radius: 0.5rem;
  margin-top: 1.5rem;
  margin-bottom: 1.5rem;
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
  padding-inline-start: 1.5rem;
  padding-inline-end: 1.5rem;
  position: relative;

  & button.fieldset-action {
    &:active {
      background-color: var(--bs-body-bg);
    }
    position: absolute;
    top: -35px;
    right: 20px;
    background-color: var(--bs-body-bg);
    border: solid 1px var(--bs-border-color);
    display: inline-block;
    font-weight: 400;
    line-height: 1.5;
    text-align: center;
    text-decoration: none;
    vertical-align: middle;
    cursor: pointer;
    transition:
      color 0.15s ease-in-out,
      background-color 0.15s ease-in-out,
      border-color 0.15s ease-in-out,
      box-shadow 0.15s ease-in-out;
    padding: 0.25rem 0.5rem;
    font-size: 0.875rem;
    border-radius: 0.2rem;
  }

  & legend {
    float: none;
    width: auto;
    font-size: 0.9rem;
    font-weight: 600;
    text-transform: uppercase;
    margin-top: -38px;
    margin-left: 10px;
    padding: 0 15px !important;
  }
}
```

with:

```scss
.bb-fieldset {
  border: 1px solid var(--bs-border-color);
  border-radius: var(--bb-control-radius);
  margin-top: 1.25rem;
  margin-bottom: 1.25rem;
  padding: 1.125rem 1.25rem;
  position: relative;

  & legend {
    float: none;
    width: auto;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--bs-secondary-color);
    margin: 0 0 0.875rem;
    padding: 0 !important;
  }
}
```

(`var(--bs-secondary-color)` is an existing Bootstrap-provided muted-text token already used elsewhere in this file, e.g. `.bb-search__clear` and `.bb-filter-clear` - it automatically follows the active theme/mode, so no new custom property is needed.)

- [ ] **Step 4: Lint and build**

Run: `npm run lint`
Expected: exits 0, no warnings.

Run: `npm run build --workspace=packages/app`
Expected: build succeeds.

- [ ] **Step 5: Manual visual check across every affected modal**

Run: `npm start`. In the running app, open each of the following and confirm every section now renders as a rounded bordered card with a small uppercase label at the top-left (not cutting into the border):

- Settings modal: General tab, Server tab, Status Bar tab, Torrent List Grid tab
- Add Torrent modal: General tab, Options tab, Limits tab
- Torrent Details modal (open any torrent, or use Debug menu if available to open it without a live server): General tab

Check this in both `bitbutler` light and dark mode (Settings > General > Appearance > Theme Mode).

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/styles.scss
git commit -m "$(cat <<'EOF'
#267: modernize the shared .bb-fieldset section-card style

Replaces the legend-cut-into-border fieldset look with a rounded
bordered card and an in-flow uppercase label, matching the approved
UI refresh direction. Every Settings/Add Torrent/Torrent Details tab
already shares this one class, so the change cascades without any
template edits. Also removes the unused .fieldset-action rule (no
template referenced it).
EOF
)"
```

---

## Task 3: Unify button corner radius and give the torrent grid the same shape language

**Context:** `packages/app/src/app/pages/main/button-bar/button-bar.scss`'s `.bb-tool` (toolbar buttons) and `.bb-widget` (status bar pills) already use a 12px+ rounded, spacious look consistent with the target direction - no change needed there. Plain Bootstrap `.btn` elements (used in Login, all three modal footers, the Add Torrent input-mode segmented control, etc.) currently get Bootstrap's stock ~6px default radius because `.btn` isn't included in the app's `border-radius: var(--bb-control-radius)` rule (that rule currently only covers `.form-control`/`.form-select`/`.input-group-text` in `packages/app/src/styles.scss`). This task brings `.btn` in line with the rest of the app's controls, and gives the torrent grid's outer wrapper the same rounder radius already used by similar containers elsewhere (`.bb-toolbar` and `.bb-datefilter` both already use 14px).

**Files:**

- Modify: `packages/app/src/styles.scss:13-22` (the `.btn` rule block)
- Modify: `packages/app/src/app/app.const.ts:25-30` (`GRID_PARAMS_SHARED`)

**Interfaces:** None - both changes are value/property additions to existing shared rules; no renamed classes or tokens.

- [ ] **Step 1: Update the global `.btn` rule**

In `packages/app/src/styles.scss`, change:

```scss
.btn {
  font-weight: 500;
  letter-spacing: 0.02em;
  text-transform: none;

  &:focus,
  &:active:focus {
    box-shadow: 0 0 0 0.2rem var(--bb-control-focus-ring) !important;
  }
}
```

to:

```scss
.btn {
  font-weight: 500;
  letter-spacing: 0.02em;
  text-transform: none;
  border-radius: var(--bb-control-radius);

  &:focus,
  &:active:focus {
    box-shadow: 0 0 0 0.2rem var(--bb-control-focus-ring) !important;
  }
}
```

- [ ] **Step 2: Update the ag-Grid shape params**

In `packages/app/src/app/app.const.ts`, in the `GRID_PARAMS_SHARED` object, change:

```ts
  spacing: 6,
  borderRadius: 6,
  wrapperBorderRadius: 10,
```

to:

```ts
  spacing: 6,
  borderRadius: 8,
  wrapperBorderRadius: 14,
```

(14px matches `.bb-toolbar`'s and `.bb-datefilter`'s existing wrapper radius elsewhere in the app - this keeps the grid's outer card consistent with those, not introducing a new number.)

- [ ] **Step 3: Lint and build**

Run: `npm run lint`
Expected: exits 0, no warnings.

Run: `npm run build --workspace=packages/app`
Expected: build succeeds.

- [ ] **Step 4: Manual visual check**

Run: `npm start`. Confirm:

- Every plain button (Login's Connect/Manage Servers, all three modal footers' Save/Cancel/Close, the Add Torrent File/Link/Folder segmented buttons) now has a visibly rounder corner, consistent with the toolbar buttons next to them.
- The torrent grid's outer border/corners (top edge, since `grid.scss` deliberately squares off the bottom to sit flush with the status bar) are slightly rounder than before.
- Nothing overflows or clips oddly at the new radius - check a `.btn-split` button (icon+text combo, e.g. Login's Connect button) specifically, since it relies on `overflow: hidden` clipping its inner `.btn-icon`/`.btn-text` divs to the button's own corner radius.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/styles.scss packages/app/src/app/app.const.ts
git commit -m "$(cat <<'EOF'
#267: unify button and grid corner radius with the rest of the UI

.btn now uses the same --bb-control-radius as form controls, matching
the toolbar's existing .bb-tool buttons instead of Bootstrap's default
smaller radius. Bumped the ag-Grid wrapper radius to 14px to match
.bb-toolbar and .bb-datefilter, which already use that value.
EOF
)"
```

---

## Task 4: Login screen - swap the dashed secondary button style

**Context:** `packages/app/src/app/pages/login/login.html`'s "Manage Servers" button uses the `btn-dashed-secondary` variant (a dashed-border button style defined in `packages/app/src/styles/themes/_theme-utils.scss`'s `bb-install-button-variants` mixin). The approved mockups show a plain solid-bordered secondary button instead. This is the only Login-specific change needed - Task 3 already fixes its button radius, and the rest of `login.scss`'s layout (split hero panel, radial gradient, generous padding, `form-wrapper` max-width) already matches the approved design closely.

**Files:**

- Modify: `packages/app/src/app/pages/login/login.html:78-87`

**Interfaces:** None - this is a class-name swap on an existing button element between two Bootstrap variant classes that are both already fully themed (`bb-install-button-variants` in `_theme-utils.scss` installs `.btn-outline-{variant}` for every color variant, including `secondary`, across all 8 themes).

- [ ] **Step 1: Confirm the current markup**

Run: `grep -n "btn-dashed-secondary" packages/app/src/app/pages/login/login.html`
Expected: one match, the "Manage Servers" button.

- [ ] **Step 2: Swap the class**

In `packages/app/src/app/pages/login/login.html`, change:

```html
<button
  type="button"
  class="btn btn-lg btn-dashed-secondary btn-split"
  (click)="openManageServers()"
></button>
```

to:

```html
<button
  type="button"
  class="btn btn-lg btn-outline-secondary btn-split"
  (click)="openManageServers()"
></button>
```

- [ ] **Step 3: Lint and build**

Run: `npm run lint`
Expected: exits 0, no warnings.

Run: `npm run build --workspace=packages/app`
Expected: build succeeds.

- [ ] **Step 4: Manual visual check**

Run: `npm start`. On the login screen (disconnect/logout if needed to see it), confirm "Manage Servers" now renders with a plain solid outline instead of a dashed one, and still shows the server icon + label via `bb-btn-content`. Check both bitbutler light and dark mode.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/pages/login/login.html
git commit -m "$(cat <<'EOF'
#267: use a plain outline style for the Manage Servers button

Matches the approved UI refresh direction, which uses a plain
secondary outline button rather than the dashed-border variant.
EOF
)"
```

---

## Task 6: Deepen the purple-haze dark-mode accent for better progress-bar contrast

**Context:** Unlike mint-green, purple-haze's `--bs-secondary` is correctly on-hue in both modes (`#ab47bc` light, `#b39ddb` dark - both purple, confirmed by inspecting both theme files). This is not a bug fix. It's a legibility polish: `--bs-secondary` drives `--bb-accent`, which every paused/stopped/queued torrent's progress bar fill uses via Bootstrap's `.bg-secondary` utility (see `torrent-state-variant.ts`'s `'secondary'` case, rendered by `bb-progress.html`'s `[class]="'bg-' + displayVariant()"`). `#b39ddb` is a very light, low-saturation lavender (HSL lightness ~78%) - at the torrent grid's compact row height, thin progress fills in that color read as washed-out/faint rather than clearly "purple." Deepening the value keeps the same hue family while giving the fill more visual presence, matching the refinement the approved design mockup (`main-a-purplehaze.html`) applied for review, which the earlier UI-refresh discussion validated. Note this changes one shared token, so - like every `--bs-secondary` consumer in this theme - it also affects purple-haze dark's buttons, active list items, and badges, not only progress bars; there is no separate progress-only color token in this codebase, and adding one is out of scope for this fix.

**Files:**

- Modify: `packages/app/src/styles/themes/purple-haze/_dark.scss:5` and its matching `--bs-secondary-rgb` line

**Interfaces:** None (pure SCSS variable/value change, no new tokens, no Angular changes).

- [ ] **Step 1: Read the current file to confirm line numbers haven't drifted**

Run: view `packages/app/src/styles/themes/purple-haze/_dark.scss` lines 1-45. Confirm line 5 is `$ph-dark-secondary: #b39ddb;` and find the line with `--bs-secondary-rgb: #{string.unquote('179, 157, 219')};`. If line numbers have moved, search for `$ph-dark-secondary` and `179, 157, 219` in that file instead of trusting the line numbers below.

- [ ] **Step 2: Deepen the secondary/accent color**

In `packages/app/src/styles/themes/purple-haze/_dark.scss`, change:

```scss
$ph-dark-secondary: #b39ddb;
```

to:

```scss
$ph-dark-secondary: #9a7fd1;
```

(`#9a7fd1` keeps the same purple hue as `#b39ddb` but is noticeably more saturated and less pale, so it reads clearly as a progress-bar fill at small sizes. `--bb-secondary-ink: #000` is already defined for this theme and stays legible against the new color - no ink change needed.)

Then update the matching RGB string used for `--bs-secondary-rgb`. Change:

```scss
--bs-secondary-rgb: #{string.unquote('179, 157, 219')};
```

to:

```scss
--bs-secondary-rgb: #{string.unquote('154, 127, 209')};
```

(154, 127, 209 is the decimal RGB of `#9a7fd1`.)

- [ ] **Step 3: Verify nothing else in the file references the old literal color**

Run: `grep -n "b39ddb\|179, 157, 219" packages/app/src/styles/themes/purple-haze/_dark.scss`
Expected: no output (both occurrences replaced).

- [ ] **Step 4: Lint and build**

Run: `npm run lint`
Expected: exits 0, no warnings.

Run: `npm run build --workspace=packages/app`
Expected: build succeeds.

- [ ] **Step 5: Manual visual check**

Run: `npm start`. Open Settings > General > Appearance, set Theme Family to "Purple Haze" and Theme Mode to "Dark". Confirm buttons, the active sidebar filter item, and a paused/stopped torrent's progress bar fill now show a deeper, more saturated purple instead of the pale lavender. Switch Theme Mode to "Light" and confirm it's unchanged (light mode is untouched by this task).

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/styles/themes/purple-haze/_dark.scss
git commit -m "$(cat <<'EOF'
#267: deepen purple-haze dark theme accent for progress-bar contrast

--bs-secondary (used everywhere as --bb-accent, including progress
bar fills for paused/stopped/queued torrents) was a very pale lavender
that read as washed-out at the grid's compact row height. Deepened it
to a more saturated purple in the same hue family, matching the
refinement validated in the approved UI-refresh mockups. Light mode
is unaffected.
EOF
)"
```

---

## Task 7: Full cross-theme verification pass

**Context:** Tasks 1-4 and 6 are all shared/global changes (theme files, two global stylesheet rules, one grid config, one login template edit), so their effects cascade automatically across every screen and every theme. This task is the single end-to-end check called for by this repo's convention of verifying UI changes in the running app before considering the work done - it doesn't modify any code.

**Files:** None modified in this task.

**Interfaces:** None.

- [ ] **Step 1: Full lint and test run**

Run: `npm run lint`
Expected: exits 0.

Run: `npm test`
Expected: all existing tests still pass (this plan made no `.ts` logic changes, so no test should need updating - if any test fails, that's a signal something in a prior task broke something unexpected and needs investigation before proceeding).

- [ ] **Step 2: Start the app and check every touched surface**

Run: `npm start`.

Check each of the following, in **both** `bitbutler` light and dark mode (toggle via the palette/contrast icons on the login screen, or Settings > General > Appearance):

- Login screen: hero panel, Connect/Manage Servers buttons, quick-setting icons.
- Main torrent view: toolbar buttons, sidebar filter groups, the torrent grid, the bottom status bar.
- Settings modal: General, Server, Status Bar, Torrent List Grid tabs.
- Add Torrent modal: General, Options, Limits tabs.
- Torrent Details modal (open any torrent): General tab.

Then switch Theme Family to `mint-green`, mode `dark`, and confirm the accent color (buttons, active filter items, progress bars) is green, not beige.

Then switch Theme Family to `purple-haze`, mode `dark`, and confirm the accent color (buttons, active filter items, and especially a paused/stopped torrent's progress bar) reads as a clear, saturated purple rather than pale lavender. Switch to `purple-haze` light mode and confirm it's unchanged.

Then spot-check one more theme family not touched by any color task (e.g. `ocean-breeze`) in both light and dark to confirm the radius/fieldset changes read correctly against a palette this plan didn't modify.

- [ ] **Step 3: Note any regressions found**

If anything looks broken (clipped corners, illegible contrast, a modal tab that doesn't pick up the new fieldset style because it uses a different class), fix it as a follow-up to the specific task that caused it, re-run that task's lint/build steps, and re-check here. Do not move on to opening a PR until this checklist is clean.

---

## After all tasks are complete

Per this repo's CLAUDE.md conventions:

1. This plan lives in `docs/superpowers/plans/` on the feature branch, which is fine to keep committed while work is in progress (it allows resuming from a different machine/session).
2. Before opening the PR, remove the entire `docs/superpowers/` folder in its own commit (e.g. `#267: removed spec and plan`) - it must not be merged to `main`.
3. Read `.github/pull_request_template.md` and use it as the exact structure for the PR body via `gh pr create`. Include `Fixes #267` in the description.
4. The PR title should be a clean description with no issue ID prefix, e.g. "Refresh UI with a Claude-inspired design language across all themes".
